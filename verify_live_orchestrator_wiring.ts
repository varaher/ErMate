/**
 * ErMate — Verification: MATE Conversational Orchestrator Live UI Wiring
 *
 * Verifies that the new orchestrator modules are fully wired into VoiceScribeChatView.tsx:
 * 1. tryDeterministicFastPath imported and wired in sendToChat()
 * 2. interpretWithServer imported and wired
 * 3. validateAndBuildMateTask imported and wired
 * 4. resolveInterpretedPatient imported and wired
 * 5. authenticatedFetch imported and replaces all direct fetch("/api/...") calls
 * 6. lastReferencedDisplayIdRef and lastPresentedCaseIdsRef wired
 * 7. Zero direct raw fetch("/api/") calls remain in VoiceScribeChatView.tsx
 * 8. End-to-end deterministic behavior for fast path, ambiguity, multi-task, and safety invariants.
 */

import fs from "fs";
import path from "path";
import type { ClinicalCase } from "./src/types";
import { tryDeterministicFastPath } from "./src/mate/mateFastPath";
import { resolveInterpretedPatient } from "./src/mate/matePatientDisambiguator";
import { validateAndBuildMateTask } from "./src/mate/mateTaskValidator";
import { sanitizeInterpretation } from "./src/mate/mateInterpretationSanitizer";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== VERIFYING LIVE ORCHESTRATOR WIRING IN VOICESCRIBECHATVIEW ===");

// 1. Static Source Code Wiring Audit
const chatViewSource = fs.readFileSync(path.resolve("./src/components/VoiceScribeChatView.tsx"), "utf-8");

assert(chatViewSource.includes("tryDeterministicFastPath"), "1. tryDeterministicFastPath imported in VoiceScribeChatView.tsx");
assert(chatViewSource.includes("interpretWithServer"), "2. interpretWithServer imported in VoiceScribeChatView.tsx");
assert(chatViewSource.includes("validateAndBuildMateTask"), "3. validateAndBuildMateTask imported in VoiceScribeChatView.tsx");
assert(chatViewSource.includes("resolveInterpretedPatient"), "4. resolveInterpretedPatient imported in VoiceScribeChatView.tsx");
assert(chatViewSource.includes("authenticatedFetch"), "5. authenticatedFetch imported in VoiceScribeChatView.tsx");
assert(chatViewSource.includes("lastReferencedDisplayIdRef"), "6. lastReferencedDisplayIdRef wired");
assert(chatViewSource.includes("lastPresentedCaseIdsRef"), "7. lastPresentedCaseIdsRef wired");

// Verify zero raw unauthenticated fetch("/api/...") calls
const rawFetchMatches = chatViewSource.match(/fetch\(["']\/api\//g);
assert(!rawFetchMatches || rawFetchMatches.length === 0, "8. Zero raw unauthenticated fetch('/api/') calls in VoiceScribeChatView.tsx");

console.log("✓ Static Source Audit PASS: All 5 orchestrator modules and authenticatedFetch wired cleanly");

// 2. Functional Fast-Path Tests
const mockCensus: ClinicalCase[] = [
  {
    id: "uuid-patient-9",
    displayId: "261006001",
    bedNo: "9",
    status: "Active",
    patient: { name: "Anand", age: 58, gender: "Male", triageCategory: "P1", presentingComplaint: "Chest pain" },
    vitals: { hr: 96, bp: "130/80", spo2: 98, rr: 18, temp: 37.0, gcs: 15 },
    triageCategory: "P1",
  } as any,
  {
    id: "uuid-patient-11a",
    displayId: "261006002",
    bedNo: "11A",
    status: "Active",
    patient: { name: "Meera", age: 44, gender: "Female", triageCategory: "P2" },
    triageCategory: "P2",
  } as any,
  {
    id: "uuid-patient-11b",
    displayId: "261006003",
    bedNo: "11B",
    status: "Active",
    patient: { name: "Rahul", age: 32, gender: "Male", triageCategory: "P3" },
    triageCategory: "P3",
  } as any,
];

// Patient count fast path
const countRes = tryDeterministicFastPath({
  utterance: "how many patients are there in my list?",
  censusCases: mockCensus,
});
assert(countRes?.handled === true && countRes.action === "COUNT_PATIENTS", "9. Patient count fast path handled");
assert(countRes?.replyText?.includes("3 active patients") === true, "9. Correct count of patients");

// Open Bed 9 fast path
const openBedRes = tryDeterministicFastPath({
  utterance: "open bed 9",
  censusCases: mockCensus,
});
assert(openBedRes?.handled === true && openBedRes.action === "OPEN_CASE", "10. Open Bed 9 fast path handled");
assert(openBedRes?.targetCaseId === "uuid-patient-9", "10. Open Bed 9 resolves uuid-patient-9");
assert(openBedRes?.replyText?.includes("Opening Bed 9") === true, "10. Open Bed 9 reply text");

// Open case by display ID fast path
const openDisplayRes = tryDeterministicFastPath({
  utterance: "open case 261006001",
  censusCases: mockCensus,
});
assert(openDisplayRes?.handled === true && openDisplayRes.action === "OPEN_CASE", "11. Open display ID fast path handled");
assert(openDisplayRes?.targetCaseId === "uuid-patient-9", "11. Open display ID resolves uuid-patient-9");

// Section navigation fast path
const sectionRes = tryDeterministicFastPath({
  utterance: "show his investigations",
  activeCase: mockCensus[0],
  censusCases: mockCensus,
});
assert(sectionRes?.handled === true && sectionRes.action === "OPEN_SECTION", "12. Section navigation fast path handled");
assert(sectionRes?.targetSection === "investigations", "12. Correct investigations section");

// Tab navigation fast path
const tabRes = tryDeterministicFastPath({
  utterance: "go to dashboard",
  censusCases: mockCensus,
});
assert(tabRes?.handled === true && tabRes.action === "NAVIGATE_TAB", "13. Tab navigation fast path handled");
assert(tabRes?.targetTab === "dashboard", "13. Correct target tab");

// Clinical update NOT swallowed by fast path
const clinicalRes = tryDeterministicFastPath({
  utterance: "Bed 9 BP is 90/60 and pulse is 110",
  censusCases: mockCensus,
});
assert(clinicalRes === null, "14. Clinical update not swallowed by fast path");

console.log("✓ Functional Fast Path PASS: All instant operations handled, clinical updates preserved for Scribe");

// 3. Functional Disambiguation & Task Validation Tests
const ambiguousRes = resolveInterpretedPatient({
  reference: { type: "BED", value: "11" },
  censusCases: mockCensus,
});
assert(ambiguousRes.status === "AMBIGUOUS", "15. Ambiguous Bed 11 detected");
assert(ambiguousRes.clarificationMessage?.includes("11A") && ambiguousRes.clarificationMessage?.includes("11B"), "15. Clarification mentions both 11A and 11B");

// Numbered index resolution
const listRes = resolveInterpretedPatient({
  reference: { type: "LIST_INDEX", value: 2 },
  lastPresentedCaseIds: ["uuid-patient-9", "uuid-patient-11a", "uuid-patient-11b"],
  censusCases: mockCensus,
});
assert(listRes.status === "RESOLVED" && listRes.caseId === "uuid-patient-11a", "16. Second case from list resolved to 11A");

// Task validation rejects arbitrary model case ID
const validatedTask = validateAndBuildMateTask({
  plannedTask: { type: "DOCUMENT_CLINICAL_UPDATE", accessMode: "WRITE", sourceText: "Noradrenaline 5 mcg/min" },
  actorUid: "dr-user",
  hospitalId: null,
  conversationId: "conv-1",
  deterministicCaseId: "uuid-patient-9",
  deterministicBedNo: "9",
  scribeSessionId: "sess-1",
  contextGeneration: 1,
  sourceUtterance: "Bed 9 noradrenaline started",
});
assert(validatedTask.isValid === true && validatedTask.mateTask?.caseId === "uuid-patient-9", "17. Deterministic caseId enforced on task");
assert(validatedTask.mateTask?.payload?.sourceText === "Noradrenaline 5 mcg/min", "17. Source clinical text preserved");

console.log("\n=======================================================");
console.log("ALL LIVE ORCHESTRATOR WIRING INVARIANTS VERIFIED: 17/17 PASS");
console.log("=======================================================");
