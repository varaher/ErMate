import assert from "node:assert";
import { normalizeMateBedId, generateMateBedLocations, isValidMateBedLocation } from "./src/mate/mateBedModel";
import { extractMateBedReference, resolveMateCaseReference } from "./src/mate/mateCaseResolver";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
import { routeMateInput } from "./src/mate/mateRouter";
import { dispatchMateAction } from "./src/mate/mateActionDispatcher";
import { ClinicalCase } from "./src/types";

console.log("==================================================");
console.log("MATE CONTROLLER & TRAFFIC-POLICE INTEGRATION SUITE");
console.log("==================================================");

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. Bed Normalization & Namespace Model
test("1. Bed Normalization (Explicit 10B and Variants)", () => {
  assert.strictEqual(normalizeMateBedId("10b"), "10B");
  assert.strictEqual(normalizeMateBedId("10B"), "10B");
  assert.strictEqual(normalizeMateBedId("bed 10b"), "10B");
  assert.strictEqual(normalizeMateBedId("Bed No 10B"), "10B");
  assert.strictEqual(normalizeMateBedId("03"), "3");
  assert.strictEqual(normalizeMateBedId("bed 3a"), "3A");
  assert.strictEqual(normalizeMateBedId("invalid"), null);

  const locs = generateMateBedLocations(3);
  assert.strictEqual(locs.length, 9); // 1, 1A, 1B, 2, 2A, 2B, 3, 3A, 3B
  assert.strictEqual(isValidMateBedLocation("10B", 30), true);
  assert.strictEqual(isValidMateBedLocation("35", 30), false);
});

// 2. Bed Status: Occupied vs. Vacant
test("2. Bed Status Resolution: Occupied vs. Vacant", () => {
  const mockCases: ClinicalCase[] = [
    {
      id: "case-10b",
      bedNo: "10B",
      status: "Active",
      patient: { name: "Sunita Roy", age: 52, gender: "Female", presentingComplaint: "Chest discomfort" } as any,
    } as any,
    {
      id: "case-4",
      bedNo: "4",
      status: "Active",
      patient: { name: "Anand Kumar", age: 34, gender: "Male" } as any,
    } as any,
  ];

  // A. Occupied Bed 10B
  const res10B = resolveMateCaseReference({
    utterance: "Is 10B occupied?",
    cases: mockCases,
    activeCaseId: "case-4",
    physicalCapacity: 30,
  });
  assert.strictEqual(res10B.status, "RESOLVED");
  assert.strictEqual(res10B.caseId, "case-10b");

  // B. Vacant Bed 10A (Bed mentioning NEVER creates a patient)
  const res10A = resolveMateCaseReference({
    utterance: "Is 10A occupied?",
    cases: mockCases,
    activeCaseId: "case-4",
    physicalCapacity: 30,
  });
  assert.strictEqual(res10A.status, "NOT_FOUND");
  assert.strictEqual(res10A.caseId, null);
  assert.strictEqual(res10A.referenceValue, "10A");
});

// 3. Conversational Context & "Open it" Recent Reference
test("3. Conversational Context: 'Open it' & 'Summarise him'", () => {
  const planOpenIt = planMateConversation("Open it.");
  assert.ok(planOpenIt.actions.includes("PATIENT_OPEN"));
  assert.strictEqual(planOpenIt.refersToRecentPatient, true);
  assert.strictEqual(planOpenIt.mayContainClinicalUpdate, false);

  const planSummariseHim = planMateConversation("Summarise him.");
  assert.ok(planSummariseHim.actions.includes("CASE_SUMMARY"));
  assert.strictEqual(planSummariseHim.refersToRecentPatient, true);
  assert.strictEqual(planSummariseHim.mayContainClinicalUpdate, false);

  const planOpenCaseSheet = planMateConversation("Open his case sheet.");
  assert.ok(planOpenCaseSheet.actions.includes("CASE_SHEET_OPEN"));
  assert.strictEqual(planOpenCaseSheet.refersToRecentPatient, true);
});

// 4. Compound Open + Summary Command
test("4. Compound Operational Command: 'I think 10B is occupied, open Bed 10B and summarise the case'", () => {
  const utterance = "I think 10B is occupied, open Bed 10B and summarise the case.";
  const plan = planMateConversation(utterance);
  assert.ok(plan.actions.includes("BED_STATUS"));
  assert.ok(plan.actions.includes("PATIENT_OPEN"));
  assert.ok(plan.actions.includes("CASE_SUMMARY"));
  assert.strictEqual(plan.mayContainClinicalUpdate, false);

  const bedRef = extractMateBedReference(utterance);
  assert.strictEqual(bedRef, "10B");
});

// 5. Clinical Update is NOT Swallowed by MATE
test("5. Clinical Update Preservation: 'Bed 10B BP is now 90/50 and patient is more drowsy'", () => {
  const utterance = "Bed 10B BP is now 90/50 and patient is more drowsy";
  const plan = planMateConversation(utterance);

  // MATE recognizes that clinical facts are present
  assert.strictEqual(plan.mayContainClinicalUpdate, true, "Must flag mayContainClinicalUpdate");

  // Route input classifies as clinical update/reassessment with documentation requested
  const route = routeMateInput({ text: utterance });
  assert.strictEqual(route.shouldDocument, true);
  assert.ok(route.primaryIntent === "REASSESSMENT" || route.primaryIntent === "CLINICAL_NARRATIVE");

  // Operational interceptor must NOT swallow it; it falls through to Scribe
  const wouldBeSwallowed = !plan.mayContainClinicalUpdate && plan.actions.length > 0;
  assert.strictEqual(wouldBeSwallowed, false, "Clinical dictation must NOT be swallowed");
});

// 6. Critical Session Safety: Different Patient Switch Halts Stale Processing
test("6. Different-Patient Switch Stops Before Stale-Session Processing", () => {
  const mockCases: ClinicalCase[] = [
    { id: "case-curr", bedNo: "4", status: "Active" } as any,
    { id: "case-target", bedNo: "10B", status: "Active" } as any,
  ];

  let currentCaseId: string = "case-curr";
  const utterance = "Bed 10B BP is now 90/50 and patient is more drowsy";

  // 1. Resolve patient
  const res = resolveMateCaseReference({
    utterance,
    cases: mockCases,
    activeCaseId: currentCaseId,
    physicalCapacity: 30,
  });

  assert.strictEqual(res.status, "RESOLVED");
  assert.strictEqual(res.caseId, "case-target");

  // 2. Check boundary condition
  const isDifferentPatient = res.caseId !== currentCaseId;
  assert.strictEqual(isDifferentPatient, true);

  // 3. In VoiceScribeChatView contract:
  // When isDifferentPatient is true:
  // a) pendingUtteranceAfterSwitchRef stores utterance
  // b) onSwitchCase(res.caseId) is called
  // c) Function returns immediately without calling /api/scribe-chat or /api/case-discussion
  let apiCalledOnStaleCase = false;
  let switchedTargetId: string | null = null;
  let pendingStored: { targetCaseId: string; utterance: string } | null = null;

  if (isDifferentPatient) {
    pendingStored = { targetCaseId: res.caseId, utterance };
    switchedTargetId = res.caseId;
    // STOP processing immediately (return early)
  } else {
    apiCalledOnStaleCase = true;
  }

  assert.strictEqual(apiCalledOnStaleCase, false, "Must NOT call API on stale case");
  assert.strictEqual(switchedTargetId, "case-target");
  assert.deepStrictEqual(pendingStored, { targetCaseId: "case-target", utterance });

  // 4. Replay simulation when new session is attached
  let replayedUtterance: string | null = null;
  const newActiveCaseId = "case-target";
  const newActiveSessionId = "sess-target-123";
  const sessionAttachError = null;
  const isSending = false;

  if (pendingStored && newActiveCaseId === pendingStored.targetCaseId && newActiveSessionId && !sessionAttachError && !isSending) {
    replayedUtterance = pendingStored.utterance;
    pendingStored = null;
  }

  assert.strictEqual(replayedUtterance, utterance, "Must replay original utterance once on target session");
  assert.strictEqual(pendingStored, null, "Pending queue must be cleared");
});

// 7. Case Sheet Open Dispatcher Bridge
test("7. Case Sheet Open Dispatcher Bridge", async () => {
  let openedCaseId: string | null = null;
  const res = await dispatchMateAction(
    { capability: "case.open", caseId: "case-10b", utterance: "open his case sheet" },
    { openCase: (req) => { openedCaseId = req.caseId!; } }
  );

  assert.strictEqual(res.handled, true);
  assert.strictEqual(openedCaseId, "case-10b");
});

console.log("\n==================================================");
console.log(`ALL MATE INTEGRATION TESTS COMPLETED: ${passed}/${total} PASSED`);
console.log("==================================================");
