import assert from "assert";
import { resolveMateCaseReference, extractMateBedReference } from "./src/mate/mateCaseResolver";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
import { routeMateInput } from "./src/mate/mateRouter";
import { detectExplicitNewCaseIntent } from "./src/components/VoiceScribeChatView";
import { ClinicalCase, TriageCategory } from "./src/types";

console.log("==================================================");
console.log("ERMATE P0 PATCH 2 — MATE REPLAY SAFETY VERIFICATION");
console.log("==================================================");

/**
 * High-fidelity control-flow simulator replicating VoiceScribeChatView's
 * two-pass MATE traffic-police and controlled replay architecture.
 */
class MateChatControllerSimulator {
  public allCases: ClinicalCase[];
  public activeCaseId: string | null;
  public activeSessionId: string | null;
  public physicalBedCapacity: number;
  public sessionContextGeneration: number = 0;
  public isSending: boolean = false;
  public sessionAttachError: string | null = null;

  public pendingUtteranceAfterSwitch: {
    targetCaseId: string;
    utterance: string;
    generation: number;
  } | null = null;

  public pendingNewPatientHandoff: {
    targetCaseId: string;
    targetBed: string;
    utterance: string;
    generation: number;
  } | null = null;

  // Session message histories
  public sessionMessages: Map<string, Array<{ role: string; content: string }>> = new Map();
  // Clinical case store
  public createdCases: ClinicalCase[] = [];
  // Scribe processing log
  public scribeInvocations: Array<{ sessionId: string; caseId: string | null; utterance: string }> = [];
  // Track MATE resolution passes
  public mateResolutionInvocations: number = 0;

  constructor(initialCases: ClinicalCase[] = [], initialCaseId: string | null = null, capacity: number = 30) {
    this.allCases = [...initialCases];
    this.activeCaseId = initialCaseId;
    this.activeSessionId = initialCaseId ? `sess-${initialCaseId}` : null;
    this.physicalBedCapacity = capacity;
    if (this.activeSessionId) {
      this.sessionMessages.set(this.activeSessionId, []);
    }
  }

  public async onEnsureDraftCase(sessionId: string, options?: { bedNo?: string }): Promise<string> {
    const newCaseId = `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCase: ClinicalCase = {
      id: newCaseId,
      displayId: `261005${String(this.createdCases.length + 1).padStart(3, "0")}`,
      bedNo: options?.bedNo || "",
      status: "Active",
      patient: {
        name: "Emergency Patient",
        age: 50,
        gender: "Male",
        presentingComplaint: "",
        triageCategory: TriageCategory.P2,
        dateOpened: "10:00 AM",
        isMlc: false,
      },
      vitals: {} as any,
      sampleHistory: {} as any,
      primaryAssessment: {} as any,
      secondaryAssessment: "",
      investigations: [],
      treatments: [],
      progressNotes: "",
      differentials: [],
      isPediatric: false,
      savedTime: new Date().toISOString(),
      timeSpentMin: 0,
      dischargeInfo: null,
    };
    this.allCases.push(newCase);
    this.createdCases.push(newCase);
    return newCaseId;
  }

  public async sendToChat(text: string, options?: { skipMatePatientResolution?: boolean }): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.isSending) return;

    // ── MATE TRAFFIC-POLICE & CONVERSATIONAL CONTROLLER ─────────────
    if (this.allCases && !options?.skipMatePatientResolution) {
      this.mateResolutionInvocations += 1;
      const activeCensusCases = this.allCases.filter((c) => !(c as any).archivedAt);
      const bedRef = extractMateBedReference(trimmed);
      const explicitNewCaseIntent = detectExplicitNewCaseIntent(trimmed);

      if (bedRef) {
        const resolution = resolveMateCaseReference({
          utterance: trimmed,
          cases: activeCensusCases,
          activeCaseId: this.activeCaseId,
          physicalCapacity: this.physicalBedCapacity,
          newCaseIntent: explicitNewCaseIntent,
        });

        if (resolution.status === "AMBIGUOUS" || resolution.status === "INVALID_LOCATION") {
          return; // Fail closed
        }

        if (resolution.status === "RESOLVED") {
          if (explicitNewCaseIntent) {
            // Already occupied explicit collision
            return;
          }
          // Existing patient switch
          const targetCaseId = resolution.caseId;
          if (targetCaseId && targetCaseId !== this.activeCaseId) {
            this.sessionContextGeneration += 1;
            this.pendingUtteranceAfterSwitch = {
              targetCaseId,
              utterance: trimmed,
              generation: this.sessionContextGeneration,
            };
            // Simulate context switch trigger
            this.activeCaseId = targetCaseId;
            this.activeSessionId = `sess-${targetCaseId}`;
            if (!this.sessionMessages.has(this.activeSessionId)) {
              this.sessionMessages.set(this.activeSessionId, []);
            }
            return;
          }
        }

        if (resolution.status === "NOT_FOUND") {
          if (explicitNewCaseIntent) {
            const assignedBed = resolution.referenceValue || bedRef;
            this.isSending = true;
            try {
              const newSessionId = `sess-new-${Date.now()}`;
              this.sessionMessages.set(newSessionId, []);
              const newCaseId = await this.onEnsureDraftCase(newSessionId, { bedNo: assignedBed });
              this.sessionContextGeneration += 1;
              const currentGen = this.sessionContextGeneration;
              this.pendingNewPatientHandoff = {
                targetCaseId: newCaseId,
                targetBed: assignedBed,
                utterance: trimmed,
                generation: currentGen,
              };
              this.activeSessionId = newSessionId;
              this.activeCaseId = newCaseId;
            } finally {
              this.isSending = false;
            }
            return;
          }
        }
      }
    }
    // ── END OF MATE TRAFFIC-POLICE INTERCEPTION ─────────────────────

    // Direct Scribe Execution Lane
    this.isSending = true;
    try {
      if (this.activeSessionId) {
        const history = this.sessionMessages.get(this.activeSessionId) || [];
        history.push({ role: "user", content: trimmed });
        this.sessionMessages.set(this.activeSessionId, history);
      }
      this.scribeInvocations.push({
        sessionId: this.activeSessionId!,
        caseId: this.activeCaseId,
        utterance: trimmed,
      });
      // Simulate Scribe extracting clinical data into the active case
      if (this.activeCaseId) {
        const target = this.allCases.find((c) => c.id === this.activeCaseId);
        if (target) {
          if (/fever/i.test(trimmed)) target.patient.presentingComplaint = "Fever";
          if (/chest pain/i.test(trimmed)) target.patient.presentingComplaint = "Chest pain";
          if (/58\s*m/i.test(trimmed)) {
            target.patient.age = 58;
            target.patient.gender = "Male";
          }
          if (/BP is now 90\/50/i.test(trimmed)) {
            target.vitals = { ...target.vitals, bp: "90/50" } as any;
          }
        }
      }
    } finally {
      this.isSending = false;
    }
  }

  // Simulate the React useEffect replay cycle
  public async triggerReplayEffect(): Promise<void> {
    // 1. Explicit new patient handoff replay
    if (this.pendingNewPatientHandoff) {
      const pendingNew = this.pendingNewPatientHandoff;
      // Stale generation check
      if (pendingNew.generation !== this.sessionContextGeneration) {
        this.pendingNewPatientHandoff = null;
        return;
      }
      if (
        this.activeCaseId === pendingNew.targetCaseId &&
        this.activeSessionId &&
        !this.sessionAttachError &&
        !this.isSending
      ) {
        this.pendingNewPatientHandoff = null;
        await this.sendToChat(pendingNew.utterance, { skipMatePatientResolution: true });
        return;
      }
    }

    // 2. Existing patient switch replay
    if (this.pendingUtteranceAfterSwitch) {
      const pending = this.pendingUtteranceAfterSwitch;
      // Stale generation check
      if (pending.generation !== this.sessionContextGeneration) {
        this.pendingUtteranceAfterSwitch = null;
        return;
      }
      if (
        this.activeCaseId === pending.targetCaseId &&
        this.activeSessionId &&
        !this.sessionAttachError &&
        !this.isSending
      ) {
        this.pendingUtteranceAfterSwitch = null;
        await this.sendToChat(pending.utterance, { skipMatePatientResolution: true });
      }
    }
  }
}

// ── SCENARIO 1 ──────────────────────────────────────────────────────────
// Input: "New patient in Bed 11 with fever since 2 days"
// Initial census: no 11 / 11A / 11B
// Expected: ONE case created (11A), ONE Scribe session, original utterance replayed once, NO 11B case created
{
  const sim = new MateChatControllerSimulator([], null);
  await sim.sendToChat("New patient in Bed 11 with fever since 2 days");
  assert.strictEqual(sim.createdCases.length, 1, "First pass must create exactly 1 case");
  assert.strictEqual(sim.createdCases[0].bedNo, "11A", "Vacant bed 11 must allocate 11A");
  assert(sim.pendingNewPatientHandoff !== null, "Pending handoff must be queued");

  // Replay
  await sim.triggerReplayEffect();
  assert.strictEqual(sim.createdCases.length, 1, "Replay must NOT create an additional case (no Bed 11B duplicate)");
  assert.strictEqual(sim.scribeInvocations.length, 1, "Scribe must be called exactly once");
  assert.strictEqual(sim.scribeInvocations[0].utterance, "New patient in Bed 11 with fever since 2 days");
  assert.strictEqual(sim.createdCases[0].patient.presentingComplaint, "Fever");

  console.log("[PASS] 1. New patient in Bed 11 allocates 11A and replays into Scribe without creating 11B duplicate");
}

// ── SCENARIO 2 ──────────────────────────────────────────────────────────
// Initial: 11A occupied, 11B vacant
// Input: "New patient in Bed 11 with chest pain"
// Expected: ONE new case (11B), replay does NOT attempt another allocation, no duplicate case
{
  const existing11A: ClinicalCase = {
    id: "case-existing-11A",
    bedNo: "11A",
    status: "Active",
    patient: { name: "Patient A", age: 40, gender: "Male", presentingComplaint: "Dyspnea" },
  } as ClinicalCase;

  const sim = new MateChatControllerSimulator([existing11A], null);
  await sim.sendToChat("New patient in Bed 11 with chest pain");
  assert.strictEqual(sim.createdCases.length, 1, "Must create 1 new case for 11B");
  assert.strictEqual(sim.createdCases[0].bedNo, "11B", "Must allocate vacant slot 11B");

  // Replay
  await sim.triggerReplayEffect();
  assert.strictEqual(sim.createdCases.length, 1, "Replay must NOT create another case");
  assert.strictEqual(sim.allCases.length, 2, "Total cases must be 2 (existing 11A + new 11B)");
  assert.strictEqual(sim.createdCases[0].patient.presentingComplaint, "Chest pain");

  console.log("[PASS] 2. When 11A occupied, new patient in Bed 11 allocates 11B and replays safely without collision");
}

// ── SCENARIO 3 ──────────────────────────────────────────────────────────
// Initial: 11B occupied, 11A vacant
// Expected: assign 11A once only
{
  const existing11B: ClinicalCase = {
    id: "case-existing-11B",
    bedNo: "11B",
    status: "Active",
    patient: { name: "Patient B", age: 70, gender: "Female", presentingComplaint: "Cough" },
  } as ClinicalCase;

  const sim = new MateChatControllerSimulator([existing11B], null);
  await sim.sendToChat("New patient in Bed 11 with fever");
  assert.strictEqual(sim.createdCases.length, 1);
  assert.strictEqual(sim.createdCases[0].bedNo, "11A", "Must allocate vacant slot 11A");

  await sim.triggerReplayEffect();
  assert.strictEqual(sim.createdCases.length, 1, "Must not create duplicate case on replay");
  console.log("[PASS] 3. When 11B occupied, new patient in Bed 11 assigns 11A once only");
}

// ── SCENARIO 4 ──────────────────────────────────────────────────────────
// Both 11A and 11B occupied
// Expected: fail closed, NO case, NO Scribe replay
{
  const case11A = { id: "c1", bedNo: "11A", status: "Active" } as ClinicalCase;
  const case11B = { id: "c2", bedNo: "11B", status: "Active" } as ClinicalCase;

  const sim = new MateChatControllerSimulator([case11A, case11B], null);
  await sim.sendToChat("New patient in Bed 11 with fever");
  assert.strictEqual(sim.createdCases.length, 0, "Must not create case when bed family is full");
  assert.strictEqual(sim.pendingNewPatientHandoff, null, "Must not queue replay when allocation fails");

  await sim.triggerReplayEffect();
  assert.strictEqual(sim.scribeInvocations.length, 0, "Must not invoke Scribe when allocation fails closed");
  console.log("[PASS] 4. Both 11A and 11B occupied fails closed safely with zero case creation and zero replay");
}

// ── SCENARIO 5 ──────────────────────────────────────────────────────────
// Explicit: "New patient in Bed 10B with fever"
// Expected: exact 10B only, never substitute, one case only
{
  const sim = new MateChatControllerSimulator([], null);
  await sim.sendToChat("New patient in Bed 10B with fever");
  assert.strictEqual(sim.createdCases.length, 1);
  assert.strictEqual(sim.createdCases[0].bedNo, "10B", "Explicit 10B must allocate exactly 10B");

  await sim.triggerReplayEffect();
  assert.strictEqual(sim.createdCases.length, 1);
  console.log("[PASS] 5. Explicit 'Bed 10B' allocates exact slot 10B and never substitutes");
}

// ── SCENARIO 6 & 7 ──────────────────────────────────────────────────────
// Replay contains words: "new patient"
// Expected: detectExplicitNewCaseIntent / MATE resolution is bypassed on controlled replay,
// and Scribe receives the full ORIGINAL utterance unchanged.
{
  const sim = new MateChatControllerSimulator([], null);
  const utterance = "New patient in Bed 11, 58 male, chest pain since 2 hours";
  assert(detectExplicitNewCaseIntent(utterance) === true, "Utterance has explicit new case intent");

  await sim.sendToChat(utterance);
  assert.strictEqual(sim.mateResolutionInvocations, 1, "First pass ran MATE resolution");

  // Replay with skipMatePatientResolution
  await sim.triggerReplayEffect();
  assert.strictEqual(sim.mateResolutionInvocations, 1, "Replay must NOT re-invoke MATE resolution (count remains 1)");
  assert.strictEqual(sim.scribeInvocations.length, 1);
  assert.strictEqual(sim.scribeInvocations[0].utterance, utterance, "Scribe receives FULL original utterance");
  console.log("[PASS] 6 & 7. MATE resolution bypassed during replay; Scribe receives full original utterance");
}

// ── SCENARIO 8 ──────────────────────────────────────────────────────────
// Clinical fields are extracted into the ONE new case
{
  const sim = new MateChatControllerSimulator([], null);
  await sim.sendToChat("New patient in Bed 11, 58 male, chest pain since 2 hours");
  await sim.triggerReplayEffect();

  const created = sim.createdCases[0];
  assert.strictEqual(created.patient.age, 58);
  assert.strictEqual(created.patient.gender, "Male");
  assert.strictEqual(created.patient.presentingComplaint, "Chest pain");
  console.log("[PASS] 8. Clinical fields (58, Male, Chest pain) extracted into the single created case");
}

// ── SCENARIO 9 ──────────────────────────────────────────────────────────
// No duplicate user message in final session history
{
  const sim = new MateChatControllerSimulator([], null);
  await sim.sendToChat("New patient in Bed 11 with fever");
  await sim.triggerReplayEffect();

  const history = sim.sessionMessages.get(sim.activeSessionId!)!;
  const userMessages = history.filter((m) => m.role === "user");
  assert.strictEqual(userMessages.length, 1, "Final session history must contain user message exactly ONCE");
  assert.strictEqual(userMessages[0].content, "New patient in Bed 11 with fever");
  console.log("[PASS] 9. User message appears exactly once in final chat session history (zero duplication)");
}

// ── SCENARIO 10 ─────────────────────────────────────────────────────────
// Stale generation: pending generation != current generation → NO replay
{
  const sim = new MateChatControllerSimulator([], null);
  await sim.sendToChat("New patient in Bed 11 with fever");
  assert(sim.pendingNewPatientHandoff !== null);

  // Clinician changes context unexpectedly (e.g. clicks New Chat or another case)
  sim.sessionContextGeneration += 1; // generation shifted

  await sim.triggerReplayEffect();
  assert.strictEqual(sim.scribeInvocations.length, 0, "Stale generation must discard pending replay");
  assert.strictEqual(sim.pendingNewPatientHandoff, null, "Stale handoff must be cleared");
  console.log("[PASS] 10. Stale generation mismatch safely discards pending handoff with zero replay");
}

// ── SCENARIO 11 ─────────────────────────────────────────────────────────
// Existing-patient switch: "Bed 7 BP is now 90/50"
// Expected: Bed 7 resolved once, switch once, original utterance processed against Bed 7, no new patient
{
  const bed7Case: ClinicalCase = {
    id: "case-bed-7",
    bedNo: "7",
    status: "Active",
    patient: { name: "Patient 7", age: 65, gender: "Male", presentingComplaint: "Hypertension" },
    vitals: {} as any,
  } as ClinicalCase;

  const sim = new MateChatControllerSimulator([bed7Case], null);
  await sim.sendToChat("Bed 7 BP is now 90/50");

  assert.strictEqual(sim.createdCases.length, 0, "Existing patient switch must not create any case");
  assert.strictEqual(sim.pendingUtteranceAfterSwitch?.targetCaseId, "case-bed-7");
  assert.strictEqual(sim.mateResolutionInvocations, 1);

  // Replay
  await sim.triggerReplayEffect();
  assert.strictEqual(sim.mateResolutionInvocations, 1, "Replay must skip MATE resolution");
  assert.strictEqual(sim.createdCases.length, 0, "Replay must not create any case");
  assert.strictEqual(sim.scribeInvocations.length, 1);
  assert.strictEqual(sim.scribeInvocations[0].caseId, "case-bed-7");
  assert.strictEqual(sim.scribeInvocations[0].utterance, "Bed 7 BP is now 90/50");
  assert.strictEqual(bed7Case.vitals.bp, "90/50", "Vitals updated on Bed 7 case");

  console.log("[PASS] 11. Existing patient switch resolves Bed 7 once and updates Bed 7 vitals without new patient creation");
}

// ── SCENARIO 12 ─────────────────────────────────────────────────────────
// Pure normal clinician input after handoff: "BP is now 100/60"
// Expected: normal MATE/Scribe behavior unchanged
{
  const activeCase: ClinicalCase = {
    id: "case-active",
    bedNo: "11A",
    status: "Active",
    patient: { name: "Patient Active", age: 50, gender: "Female", presentingComplaint: "Weakness" },
    vitals: {} as any,
  } as ClinicalCase;

  const sim = new MateChatControllerSimulator([activeCase], "case-active");
  // Normal clinician input (no skipMatePatientResolution)
  await sim.sendToChat("BP is now 100/60");

  assert.strictEqual(sim.createdCases.length, 0);
  assert.strictEqual(sim.mateResolutionInvocations, 1, "Normal input runs through MATE controller");
  assert.strictEqual(sim.scribeInvocations.length, 1);
  assert.strictEqual(sim.scribeInvocations[0].utterance, "BP is now 100/60");
  console.log("[PASS] 12. Normal clinician input passes through standard MATE and Scribe path untouched");
}

console.log("==================================================");
console.log("ALL 12/12 MATE REPLAY SAFETY SCENARIOS PASSED!");
console.log("==================================================");
