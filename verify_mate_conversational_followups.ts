/**
 * Verification: MATE conversational follow-ups (Oct 16 2026 field test)
 *
 * Field bug: with Bed 24 open, "can u just tell me whst pending ." answered
 * "You have 3 pending cases, including 1 triage P2" (whole-ER census) instead of Bed 24.
 *
 * 1. Typo'd pending follow-up with a patient open -> that patient's completeness, not census
 * 2. Same question with NO patient open -> not handled as a patient follow-up
 * 3. Whole-ER phrasing ("which cases are pending") still lists all cases
 * 4. Naming another bed is never answered for the open patient
 * 5. Discharge-pending phrasing is left to the discharge path
 * 6. Clinical facts in the utterance are never fast-pathed
 * 7. Replies are conversational and contain no internal IDs
 * 8. Greeting is time-aware and friendly
 */

import type { ClinicalCase } from "./src/types";
import { tryDeterministicFastPath } from "./src/mate/mateFastPath";
import { formatCaseCompletenessReply, greetingForNow, isCurrentPatientPendingFollowUp } from "./src/mate/mateReplies";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) console.log(`PASS: ${msg}`);
  else { console.error(`FAIL: ${msg}`); failures++; }
}

const mk = (id: string, bed: string, extra: Partial<ClinicalCase> = {}): ClinicalCase =>
  ({ id, bedNo: bed, displayId: `2610160${bed.padStart(2, "0")}`, status: "Active", patient: { name: "Test", age: 40, gender: "Male" }, ...extra } as any);

const bed24 = mk("uuid-bed-24-aaaa", "24");
const census = [bed24, mk("uuid-bed-3", "3"), mk("uuid-bed-7", "7", { triage: "P2" } as any)];

// 1
const r1 = tryDeterministicFastPath({ utterance: "can u just tell me whst pending .", activeCase: bed24, censusCases: census });
check(r1?.handled === true && r1.action === "CASE_COMPLETENESS", "1. typo'd pending follow-up handled as completeness");
check(r1?.targetCaseId === bed24.id, "1. answered for the open patient (Bed 24)");
check(!!r1?.replyText?.includes("Bed 24") && !/pending cases/i.test(r1?.replyText || ""), "1. reply is about Bed 24, not the census");

for (const u of ["what's pending", "anything left?", "what is missing", "whats remaining for him"]) {
  const r = tryDeterministicFastPath({ utterance: u, activeCase: bed24, censusCases: census });
  check(r?.action === "CASE_COMPLETENESS" && r.targetCaseId === bed24.id, `1b. "${u}" -> Bed 24 completeness`);
}

// 2
const r2 = tryDeterministicFastPath({ utterance: "what's pending", activeCase: null, censusCases: census });
check(r2?.action !== "CASE_COMPLETENESS", "2. no open patient -> not a patient follow-up");

// 3
const r3 = tryDeterministicFastPath({ utterance: "which cases are incomplete", activeCase: bed24, censusCases: census });
check(r3?.action === "INCOMPLETE_LIST", "3. whole-ER question still lists all cases");
check(!isCurrentPatientPendingFollowUp("what's pending for all patients"), "3b. 'all patients' is whole-ER");

// 4
check(!isCurrentPatientPendingFollowUp("what's pending in bed 7"), "4. naming another bed is not a current-patient follow-up");
const r4 = tryDeterministicFastPath({ utterance: "what's pending in bed 7", activeCase: bed24, censusCases: census });
check(!(r4?.action === "CASE_COMPLETENESS" && r4.targetCaseId === bed24.id), "4b. never answered for Bed 24");

// 5
check(!isCurrentPatientPendingFollowUp("what is pending for discharge"), "5. discharge phrasing left to discharge path");

// 6
const r6 = tryDeterministicFastPath({ utterance: "bp 80/50 noradrenaline started, what's pending", activeCase: bed24, censusCases: census });
check(r6 === null, "6. clinical facts are never fast-pathed");

// 6b. Clinical dictation containing pending/left/missing words must NOT be swallowed
for (const u of ["troponin pending", "CT brain report pending", "left sided weakness", "left hand swelling since morning", "no missing teeth", "culture sent results pending", "remaining history unremarkable", "is troponin pending?"]) {
  const r = tryDeterministicFastPath({ utterance: u, activeCase: bed24, censusCases: census });
  check(r?.action !== "CASE_COMPLETENESS", `6b. dictation not swallowed: "${u}"`);
}
check(tryDeterministicFastPath({ utterance: "what is left", activeCase: bed24, censusCases: census })?.action === "CASE_COMPLETENESS", "6c. 'what is left' still handled");

// 7
const reply = formatCaseCompletenessReply(bed24);
check(!reply.includes(bed24.id) && !/uuid/i.test(reply), "7. no internal ID in reply");
check(/^Bed 24 (still needs|is fully documented)/.test(reply), "7b. reads like a sentence, not a report");

// 8
check(greetingForNow(new Date(2026, 9, 16, 9)).startsWith("Good morning"), "8. morning greeting");
check(greetingForNow(new Date(2026, 9, 16, 14)).startsWith("Good afternoon"), "8b. afternoon greeting");
const g = tryDeterministicFastPath({ utterance: "hi good morning", activeCase: bed24, censusCases: census });
check(g?.action === "SOCIAL" && !!g.replyText?.includes("Doctor"), "8c. greeting handled");

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nAll conversational follow-up checks passed.");
