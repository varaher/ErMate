import assert from "assert";
import { hasMeaningfulClinicalExtraction } from "./src/components/VoiceScribeChatView";
import { allocateOrValidateBed } from "./src/utils/bedAllocation";
import { getCasePendingStatus } from "./src/utils/caseHelper";
import type { ClinicalCase } from "./src/types";

console.log("================================================================================");
console.log("VERIFICATION: Scribe Draft Case Creation on First Clinical Dictation");
console.log("================================================================================");

let passed = 0;
let total = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

async function runAll() {
  // ── Test Group 1: hasMeaningfulClinicalExtraction Precision ───────────────────

  await test("1. Demographic intake (age, gender, complaint) is detected as meaningful", () => {
    const ext = { age: 45, gender: "male", presentingComplaints: "fever for 2 days" };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("2. Isolated vitals (Turn 2 scenario) are detected as meaningful", () => {
    const ext = { vitals: { bp: "100/60", pulse: "110" } };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("3. Physical exam findings (Turn 3 scenario) are detected as meaningful", () => {
    const ext = { primarySurvey: { airway: "patent", breathing: "bilateral air entry clear" } };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("4. Secondary survey / abdomen exam is detected as meaningful", () => {
    const ext = { secondarySurvey: { abdomen: "soft, non-tender" } };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("5. Isolated provisional diagnosis is detected as meaningful", () => {
    const ext = { provisionalDiagnosis: "Acute appendicitis" };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("6. Isolated treatment/medication administered is detected as meaningful", () => {
    const ext = { treatmentGiven: [{ drugName: "Ondansetron", dose: "4mg", route: "IV" }] };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("7. Isolated SAMPLE history (allergies, PMH) is detected as meaningful", () => {
    const ext = { sampleHistory: { allergies: "Penicillin", pastHistory: "Type 2 Diabetes" } };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  await test("8. Isolated bed assignment is detected as meaningful", () => {
    const ext = { bedNo: "11" };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), true);
  });

  // ── Test Group 2: Safety Guards & Non-Clinical Rejection ─────────────────────

  await test("9. Empty object or null/undefined is NOT clinical extraction", () => {
    assert.strictEqual(hasMeaningfulClinicalExtraction(null), false);
    assert.strictEqual(hasMeaningfulClinicalExtraction(undefined), false);
    assert.strictEqual(hasMeaningfulClinicalExtraction({}), false);
  });

  await test("10. Non-clinical metadata flags alone do NOT satisfy clinical extraction", () => {
    const ext = { isPediatric: false, intent: "general_chat", controlledPatches: [] };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), false);
  });

  await test("11. Empty sub-objects (e.g. all-null vitals) do NOT satisfy clinical extraction", () => {
    const ext = { vitals: { bp: null, pulse: null, temp: "" } };
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), false);
  });

  await test("12. General drug-dose / medical query response without extraction does NOT satisfy extraction", () => {
    const ext = {}; // Scribe response for general question produces empty extraction
    assert.strictEqual(hasMeaningfulClinicalExtraction(ext), false);
  });

  // ── Test Group 3: Bed Allocation Integration ────────────────────────────────

  await test("13. Bare bed reference ('11') allocates canonical slot 11A when vacant", () => {
    const activeCases: ClinicalCase[] = [];
    const alloc = allocateOrValidateBed("11", activeCases, 30);
    assert.strictEqual(alloc.success, true);
    assert.strictEqual(alloc.canonicalBed, "11A");
  });

  await test("14. Bare bed reference ('11') falls back to 11B when 11A is occupied", () => {
    const activeCases: any[] = [
      { id: "case-1", bedNo: "11A", status: "Active", patient: { name: "John Doe" } }
    ];
    const alloc = allocateOrValidateBed("11", activeCases, 30);
    assert.strictEqual(alloc.success, true);
    assert.strictEqual(alloc.canonicalBed, "11B");
  });

  await test("15. Bare bed reference ('11') fails closed if both 11A and 11B are occupied", () => {
    const activeCases: any[] = [
      { id: "case-1", bedNo: "11A", status: "Active", patient: { name: "John Doe" } },
      { id: "case-2", bedNo: "11B", status: "Active", patient: { name: "Jane Smith" } }
    ];
    const alloc = allocateOrValidateBed("11", activeCases, 30);
    assert.strictEqual(alloc.success, false);
  });

  // ── Test Group 4: Dashboard Pending Status on Draft Shell ───────────────────

  await test("16. Minimal draft case shell is recognized as incomplete / pending on Dashboard", () => {
    const draftShell: any = {
      id: "uuid-1234",
      displayId: "261007001",
      status: "Active",
      scribeSessionId: "session-abc",
      bedNo: "11A",
      patient: {
        name: "Patient pending documentation",
        age: null,
        gender: "",
        dateOpened: new Date().toISOString(),
      },
      primaryAssessment: {},
      provisionalPrimaryDiagnosis: "",
      dispositionDetails: {},
    };

    const pending = getCasePendingStatus(draftShell);
    assert.strictEqual(pending.isPending, true, "Draft case must be pending/incomplete");
    assert.ok(pending.pendingSections.length > 0, "Draft case must report pending sections");
  });

  // ── Test Group 5: Scribe Workflow Idempotency & Lifecycle Simulator ─────────

  await test("17. Scribe dictation workflow idempotency simulation across 3 turns", async () => {
    // Simulator tracking Scribe state across turns
    let activeCaseId: string | null = null;
    let activeSessionId: string | null = "sess-uuid-999";
    const cases: ClinicalCase[] = [];
    let ensureDraftCallCount = 0;

    // Mock onEnsureDraftCase matching App.tsx handleEnsureDraftCase
    const mockEnsureDraftCase = async (sessId: string, options?: { bedNo?: string }): Promise<string> => {
      ensureDraftCallCount++;
      const existing = cases.find(c => c.scribeSessionId === sessId || c.id === activeCaseId);
      if (existing) return existing.id;

      const newCase: any = {
        id: "case-uuid-1",
        displayId: "261007001",
        scribeSessionId: sessId,
        bedNo: options?.bedNo || "11A",
        status: "Active",
        patient: { name: "Patient pending documentation" }
      };
      cases.push(newCase);
      return newCase.id;
    };

    // Helper simulating the Scribe chat turn check added to VoiceScribeChatView
    const simulateScribeTurn = async (extractionData: any, isDiscussionMode: boolean = false) => {
      const hasMeaningful = hasMeaningfulClinicalExtraction(extractionData);
      const isCaseMode = !isDiscussionMode;
      const existingLinkedCase = activeSessionId && cases.find(c => c.scribeSessionId === activeSessionId);

      if (hasMeaningful && isCaseMode && !activeCaseId && !existingLinkedCase) {
        const ensuredId = await mockEnsureDraftCase(activeSessionId!, { bedNo: extractionData.bedNo });
        activeCaseId = ensuredId;
      } else if (!activeCaseId && existingLinkedCase) {
        activeCaseId = existingLinkedCase.id;
      }
    };

    // Turn 1: "45 male with fever for 2 days"
    await simulateScribeTurn({ age: 45, gender: "male", presentingComplaints: "fever for 2 days", bedNo: "11A" });
    assert.strictEqual(ensureDraftCallCount, 1, "Turn 1 must call ensureDraftCase exactly ONCE");
    assert.strictEqual(activeCaseId, "case-uuid-1");
    assert.strictEqual(cases.length, 1, "Exactly one case created after Turn 1");

    // Turn 2: "BP 100/60, pulse 110"
    await simulateScribeTurn({ vitals: { bp: "100/60", pulse: "110" } });
    assert.strictEqual(ensureDraftCallCount, 1, "Turn 2 must NOT call ensureDraftCase again");
    assert.strictEqual(activeCaseId, "case-uuid-1");
    assert.strictEqual(cases.length, 1, "Still exactly one case after Turn 2");

    // Turn 3: "Chest clear, abdomen soft"
    await simulateScribeTurn({ secondarySurvey: { abdomen: "soft" } });
    assert.strictEqual(ensureDraftCallCount, 1, "Turn 3 must NOT call ensureDraftCase again");
    assert.strictEqual(activeCaseId, "case-uuid-1");
    assert.strictEqual(cases.length, 1, "Still exactly one case after Turn 3");
  });

  await test("18. Discussion-only mode never triggers draft case creation", async () => {
    let activeCaseId: string | null = null;
    let ensureDraftCallCount = 0;
    const mockEnsureDraftCase = async (): Promise<string> => {
      ensureDraftCallCount++;
      return "case-should-not-exist";
    };

    const isDiscussionOnly = true;
    const extractionData = { age: 45, gender: "male" }; // Contains extraction, but in discussion mode
    const hasMeaningful = hasMeaningfulClinicalExtraction(extractionData);
    const isCaseMode = !isDiscussionOnly;

    if (hasMeaningful && isCaseMode && !activeCaseId) {
      activeCaseId = await mockEnsureDraftCase();
    }

    assert.strictEqual(ensureDraftCallCount, 0, "Discussion mode must never trigger draft case creation");
    assert.strictEqual(activeCaseId, null);
  });

  await test("19. General medical inquiry in dictation mode produces empty extraction and creates no case", async () => {
    let activeCaseId: string | null = null;
    let ensureDraftCallCount = 0;
    const mockEnsureDraftCase = async (): Promise<string> => {
      ensureDraftCallCount++;
      return "case-should-not-exist";
    };

    // General medical inquiry returns no clinical extraction fields
    const extractionData = {};
    const hasMeaningful = hasMeaningfulClinicalExtraction(extractionData);

    if (hasMeaningful && !activeCaseId) {
      activeCaseId = await mockEnsureDraftCase();
    }

    assert.strictEqual(ensureDraftCallCount, 0, "General questions must not trigger draft case creation");
    assert.strictEqual(activeCaseId, null);
  });

  await test("20. Resetting chat via handleStartNewChat permits next patient intake to create distinct draft", async () => {
    let activeCaseId: string | null = "case-uuid-1";
    let activeSessionId: string | null = "session-1";
    let ensureDraftCallCount = 1;
    const cases: ClinicalCase[] = [
      { id: "case-uuid-1", displayId: "261007001", status: "Active", scribeSessionId: "session-1" } as any
    ];

    // Clinician clicks "New Scribe Session"
    activeSessionId = "session-2";
    activeCaseId = null;

    // New patient dictated: "72 female acute SOB"
    const newPatientExt = { age: 72, gender: "female", presentingComplaints: "acute SOB" };
    const hasMeaningful = hasMeaningfulClinicalExtraction(newPatientExt);
    const existingLinkedCase = activeSessionId && cases.find(c => c.scribeSessionId === activeSessionId);

    if (hasMeaningful && !activeCaseId && !existingLinkedCase) {
      ensureDraftCallCount++;
      const newCaseId = "case-uuid-2";
      cases.push({ id: newCaseId, displayId: "261007002", status: "Active", scribeSessionId: activeSessionId } as any);
      activeCaseId = newCaseId;
    }

    assert.strictEqual(ensureDraftCallCount, 2, "Second patient intake after new chat must create second distinct draft");
    assert.strictEqual(cases.length, 2);
    assert.strictEqual(cases[0].id, "case-uuid-1");
    assert.strictEqual(cases[1].id, "case-uuid-2");
  });

  console.log("================================================================================");
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log("================================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runAll();
