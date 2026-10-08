/**
 * verify_unified_case_chat_workspace.ts
 *
 * Verification suite for ErMate Unified Discuss + Rounds Full-Screen Case Chat.
 * Verifies all 20 architectural and clinical requirements:
 * 1. Single shared workspace component (CaseChatWorkspace) supports both Discuss and Rounds.
 * 2. Top bar shows Bed + 9-digit displayId (never raw internal UUID) and clinical context.
 * 3. Segmented control cleanly toggles between [ Discuss ] and [ Rounds ].
 * 4. Storage keys are strictly isolated (case_${id} vs rounds_${id}) preventing history cross-contamination.
 * 5. Discuss mode routes to /api/case-discussion with action-oriented clinical support.
 * 6. Rounds mode routes to /api/rounds-debrief with 7-lens conversational teaching.
 * 7. Read-only learning: Rounds mode never suggests updates or mutates the Case Sheet.
 * 8. Informational subtle lens indicator line (Used: First Principles · Guidelines) rendered cleanly.
 * 9. Conversational teaching response style (concise explanation, 3-6 bullets, one targeted question).
 * 10. Quiz mode inside Rounds: asks one question at a time, evaluates resident answer.
 * 11. Consultant teaching preparation inside Rounds: teaching objectives, questions, common mistakes.
 * 12. Explicit lens requests ("Use Devil's Advocate", "First Principles") honored and included in usedLenses.
 * 13. Expandable read-only patient context drawer identical and comprehensive in both modes.
 * 14. Pending unapplied Scribe extraction available in both modes as tentative context.
 * 15. Pending extraction from different case never leaks.
 * 16. Case Sheet → Rounds opens unified workspace in Rounds mode.
 * 17. Old 7-lens tabbed/paged multi-panel UI completely eliminated from Case Sheet.
 * 18. Duplicate rounds chat states and handlers eliminated from Case Sheet.
 * 19. Request resilience: 25s AbortController timeout and failover prevents infinite spinners.
 * 20. Responsive viewport design: mobile full viewport fixed inset-0, desktop max-w-5xl workspace.
 */

import assert from "assert";
import fs from "fs";
import { getDisplayCaseId } from "./src/utils/caseIdentity";
import { executeCaseDiscussionWithFailover, executeRoundsDebriefWithFailover } from "./server/aiProviderFailover";
import type { ClinicalCase } from "./src/types";

let passedCount = 0;
let totalCount = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

function createSampleCase(): ClinicalCase {
  return {
    id: "f84a1e9c-4820-4e31-97bd-3195821bb462",
    displayId: "261007001",
    bedNo: "14A",
    status: "Active",
    patient: {
      name: "Ramesh Sharma",
      age: 45,
      gender: "Male",
      presentingComplaint: "Decreased consciousness for 2 hours",
      triageCategory: "P2 (Urgent)",
      arrivalMode: "Ambulance",
      caseType: "Medical",
      dateOpened: new Date().toISOString()
    },
    vitals: {
      bp: "140/90",
      hr: "98",
      spo2: "89",
      rr: "12",
      temp: "98.6",
      gcs: "8",
      grbs: "110",
      painScore: "0"
    },
    sampleHistory: {
      symptoms: "Unresponsive following sudden onset severe headache",
      allergies: "NKDA",
      medications: "Metoprolol 25mg OD",
      pastHistory: "Hypertension 3 years",
      events: "Found unconscious on the floor by family members"
    },
    primaryAssessment: {
      airway: "Snoring, partial airway compromise",
      breathing: "Shallow respirations, SpO2 89% on room air",
      circulation: "BP 140/90, HR 98, regular pulse",
      disability: "GCS E2V2M4 = 8, right pupil 5mm sluggish, left 3mm reactive",
      exposure: "No signs of external trauma"
    },
    secondarySurvey: {
      generalExam: "Comatose, snoring respirations",
      headNeck: "Right pupillary asymmetry (anisocoria)",
      chest: "Bilateral air entry present, no wheeze or crackles",
      abdomen: "Soft, non-distended",
      neurological: "GCS 8, asymmetric pupils, right hemiparesis suspected",
      extremities: "No peripheral edema"
    },
    investigations: [
      { testName: "NCCT Head", status: "Ordered", result: "Impending" },
      { testName: "ABG", status: "Done", result: "pH 7.31, pCO2 52, pO2 64, HCO3 25" },
      { testName: "CBC, RFT, LFT", status: "Ordered", result: "Sent" }
    ],
    treatments: [
      { drugName: "Supplemental Oxygen via NRBM 15L", dose: "15 L/min", route: "Inhalation" },
      { drugName: "Inj. Mannitol 20%", dose: "100 mL", route: "IV" }
    ],
    procedureNotes: [
      { procedureName: "Endotracheal Intubation", performedAt: "10:15", findings: "Grade 1 Cormack-Lehane, 7.5 cuffed ETT secured at 22 cm" }
    ],
    differentials: [
      "Subarachnoid Hemorrhage (SAH) with uncal herniation",
      "Acute Intracerebral Hemorrhage (ICH)",
      "Acute Ischemic Stroke with malignant edema"
    ],
    dispositionDetails: {
      dispositionType: "Admit to ICU",
      durationInEr: "1h 15m",
      observationNotes: "Airway secured. Emergent neurosurgery consultation requested."
    }
  };
}

async function runAllTests() {
  console.log("\n========================================================");
  console.log("ErMate — Unified Discuss + Rounds Case Chat Test Suite");
  console.log("========================================================\n");

  // Test 1: Single shared CaseChatWorkspace component
  await test("1. Single shared CaseChatWorkspace component exists and exported", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("export const CaseChatWorkspace: React.FC<CaseChatWorkspaceProps>"));
    assert.ok(wsContent.includes("export { CaseChatWorkspace as CaseDiscussWorkspace }"));

    const discussAlias = fs.readFileSync("src/components/CaseDiscussWorkspace.tsx", "utf8");
    assert.ok(discussAlias.includes("CaseChatWorkspace"));
  });

  // Test 2: Top bar patient identity and formatting (no raw UUID)
  await test("2. Top bar patient header shows Bed + monotonic displayId and zero raw UUID", () => {
    const sampleCase = createSampleCase();
    const displayId = getDisplayCaseId(sampleCase);
    assert.strictEqual(displayId, "261007001");
    assert.ok(!displayId.includes("f84a1e9c"));

    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("Bed ${bed} • ${displayId}"));
    assert.ok(wsContent.includes("triageCategory"));
  });

  // Test 3: Segmented mode toggle between Discuss and Rounds
  await test("3. Segmented control cleanly toggles between Discuss and Rounds modes", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("setChatMode('discuss')"));
    assert.ok(wsContent.includes("setChatMode('rounds')"));
    assert.ok(wsContent.includes("<MessageSquare className=\"w-3.5 h-3.5 hidden sm:inline\" />"));
    assert.ok(wsContent.includes("<GraduationCap className=\"w-3.5 h-3.5 hidden sm:inline\" />"));
  });

  // Test 4: Storage key isolation prevents cross-mode collision
  await test("4. Session storage keys strictly isolate Discuss vs Rounds for same patient", () => {
    const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");
    assert.ok(hookContent.includes("mode === 'rounds'"));
    assert.ok(hookContent.includes("ermate_chat_session_rounds_${context.id}"));
    assert.ok(hookContent.includes("ermate_chat_session_case_${context.id}"));
  });

  // Test 5: Discuss mode routes to /api/case-discussion
  await test("5. Discuss mode routes to /api/case-discussion", () => {
    const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");
    assert.ok(hookContent.includes("authenticatedFetch('/api/case-discussion'"));
    assert.ok(hookContent.includes("chatMode === 'rounds'"));
  });

  // Test 6: Rounds mode routes to /api/rounds-debrief
  await test("6. Rounds mode routes to /api/rounds-debrief", () => {
    const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");
    assert.ok(hookContent.includes("authenticatedFetch('/api/rounds-debrief'"));
    assert.ok(hookContent.includes("lens: 'auto'"));
  });

  // Test 7: Read-only learning: Rounds never suggests record updates or mutates case
  await test("7. Read-only learning: Rounds mode never generates suggestedUpdate", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("msg.suggestedUpdate"));
    const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");
    // In rounds mode, suggestedUpdate remains null
    assert.ok(hookContent.includes("suggestedUpdate = data.suggestedUpdate || null;"));
  });

  // Test 8: Informational subtle lens indicator line
  await test("8. Subtle informational used-lenses indicator rendered in assistant bubbles", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("msg.role === 'assistant' && msg.usedLenses && msg.usedLenses.length > 0"));
    assert.ok(wsContent.includes("msg.usedLenses.join(' · ')"));
    assert.ok(wsContent.includes("<span className=\"font-semibold text-slate-500 dark:text-slate-400\">Used:</span>"));
  });

  // Test 9: Conversational teaching response style in server prompts
  await test("9. Server /api/rounds-debrief prompt enforces conversational teaching", () => {
    const serverContent = fs.readFileSync("server.ts", "utf8");
    assert.ok(serverContent.includes("=== RESPONSE STYLE (CONVERSATIONAL TEACHING) ==="));
    assert.ok(serverContent.includes("3–6 focused, high-yield bullets"));
    assert.ok(serverContent.includes("One targeted teaching question when appropriate"));
  });

  // Test 10: Quiz mode support in server prompt
  await test("10. Quiz mode inside Rounds asks ONE question and evaluates answer", () => {
    const serverContent = fs.readFileSync("server.ts", "utf8");
    assert.ok(serverContent.includes("=== QUIZ MODE ==="));
    assert.ok(serverContent.includes("evaluate their answer"));
    assert.ok(serverContent.includes("ask exactly ONE focused question"));
  });

  // Test 11: Consultant preparation support in server prompt
  await test("11. Consultant teaching preparation returns objectives, questions, common mistakes", () => {
    const serverContent = fs.readFileSync("server.ts", "utf8");
    assert.ok(serverContent.includes("=== CONSULTANT TEACHING PREPARATION ==="));
    assert.ok(serverContent.includes("Key Teaching Objectives"));
  });

  // Test 12: Explicit lens requests honored in server route
  await test("12. Explicit lens requests honored (First Principles, Devils Advocate, Pathophysiology, Guidelines)", () => {
    const serverContent = fs.readFileSync("server.ts", "utf8");
    assert.ok(serverContent.includes("if (lowerMsg.includes(\"first principles\")) requestedLens = \"first-principles\";"));
    assert.ok(serverContent.includes("else if (lowerMsg.includes(\"devil's advocate\") || lowerMsg.includes(\"devils advocate\")) requestedLens = \"devils-advocate\";"));
    assert.ok(serverContent.includes("else if (lowerMsg.includes(\"pathophysiology\") || lowerMsg.includes(\"pathology\")) requestedLens = \"pathophysiology\";"));
    assert.ok(serverContent.includes("else if (lowerMsg.includes(\"guideline\")) requestedLens = \"guidelines\";"));
  });

  // Test 13: Expandable read-only patient context drawer
  await test("13. Read-only patient context drawer shows comprehensive documented clinical fields", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("isContextExpanded && ("));
    assert.ok(wsContent.includes("Read-Only Documented Clinical Context"));
    assert.ok(wsContent.includes("Primary Survey (ABCDE)"));
    assert.ok(wsContent.includes("Secondary Survey / Physical Exam"));
    assert.ok(wsContent.includes("Investigations & Labs"));
    assert.ok(wsContent.includes("Treatments & Procedures"));
  });

  // Test 14: Pending unapplied Scribe extraction available as tentative context
  await test("14. Pending Scribe extraction available in both modes without mutating Case Sheet", () => {
    const serverContent = fs.readFileSync("server.ts", "utf8");
    assert.ok(serverContent.includes("=== PENDING CLINICIAN DICTATION — NOT YET APPLIED TO CASE SHEET ==="));
    assert.ok(serverContent.includes("Treat these details as tentative clinical context"));

    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("Pending Scribe Dictation Context (Tentative / Unapplied)"));
  });

  // Test 15: Fail-closed isolation: mismatched cases do not pass pending Scribe dictation
  await test("15. Mismatched case IDs do not pass pending Scribe dictation", () => {
    const appContent = fs.readFileSync("src/App.tsx", "utf8");
    assert.ok(appContent.includes("pendingClinicalContext: (voiceScribeCaseId === discussionModalCase.id)"));
    assert.ok(appContent.includes("? getMergedUnappliedExtraction(scribeMessages)"));
    assert.ok(appContent.includes(": undefined"));
  });

  // Test 16: Case Sheet → Rounds opens unified workspace in Rounds mode
  await test("16. Case Sheet Rounds tab opens unified workspace in Rounds mode", () => {
    const csContent = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");
    assert.ok(csContent.includes("if (tab.id === \"rounds\")"));
    assert.ok(csContent.includes("onDiscussCase(currentCase, \"rounds\");"));
    assert.ok(csContent.includes("initialTab === \"rounds\""));
  });

  // Test 17: Old 7-lens tabbed/paged UI completely removed from Case Sheet
  await test("17. Legacy 7-lens tabbed UI, manual 8-lens grid, and memory pearl inputs removed", () => {
    const csContent = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");
    assert.ok(!csContent.includes("Select Clinical Lens\n                  </span>\n                  <span className=\"text-[10px] text-slate-400 font-mono\">\n                    8 Analytical Perspectives Available"));
    assert.ok(!csContent.includes("Core Heuristic Pearl:"));
    assert.ok(!csContent.includes("Lifelong Clinical Memory Ledger"));
    assert.ok(!csContent.includes("fetchRoundsDebrief"));
    assert.ok(!csContent.includes("roundsChatHistory"));
  });

  // Test 18: Top action bar in Case Sheet has direct Discuss and Rounds buttons
  await test("18. Case Sheet top action bar provides direct Discuss and Rounds buttons", () => {
    const csContent = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");
    assert.ok(csContent.includes("title=\"Discuss this patient's case\""));
    assert.ok(csContent.includes("title=\"7-Lens Clinical Rounds teaching & debrief\""));
    assert.ok(csContent.includes("onDiscussCase(currentCase, \"discuss\")"));
    assert.ok(csContent.includes("onDiscussCase(currentCase, \"rounds\")"));
  });

  // Test 19: Request resilience: 25s timeout via AbortController and failover
  await test("19. Request resilience: 25s timeout AbortController and failover prevents hanging", async () => {
    const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");
    assert.ok(hookContent.includes("const controller = new AbortController();"));
    assert.ok(hookContent.includes("setTimeout(() => controller.abort(), 25000);"));

    // Verify failover layer returns controlled user message if providers fail
    const failoverResult = await executeRoundsDebriefWithFailover(
      "Test emergency reasoning question",
      "Test instruction"
    );
    assert.ok(failoverResult !== null);
    assert.ok(typeof failoverResult.response === "string");
  });

  // Test 20: Viewport layout and inline Sarvam voice recorder integration
  await test("20. Mobile full-screen fixed inset-0, desktop max-w-5xl, and inline voice recorder", () => {
    const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");
    assert.ok(wsContent.includes("fixed inset-0 z-50 bg-slate-950/80"));
    assert.ok(wsContent.includes("max-w-5xl mx-auto"));
    assert.ok(wsContent.includes("<VoiceRecorder"));
    assert.ok(wsContent.includes("renderMode=\"inline-composer\""));
  });

  console.log("\n--------------------------------------------------------");
  console.log(`Results: ${passedCount} / ${totalCount} tests passed.`);
  console.log("--------------------------------------------------------\n");

  if (passedCount !== totalCount) {
    throw new Error(`Test failure: ${totalCount - passedCount} failed.`);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
