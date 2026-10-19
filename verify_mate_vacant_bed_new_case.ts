import fs from "fs";
import { detectExplicitNewCaseIntent, bedFromUnmatchedReference, shouldStartCaseForVacantBed } from "./src/mate/mateNewCaseIntent";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
import { resolveInterpretedPatient } from "./src/mate/matePatientDisambiguator";
import { resolveMateCaseReference } from "./src/mate/mateCaseResolver";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

// Phrases that failed on the phone
for (const s of ["new patient bed 11", "New pt in bed no 11", "Start a case in bed no 11", "start new patient in bed 4", "create a case bed 7", "fresh arrival bed 3"])
  t(`new-case intent: ${s}`, detectExplicitNewCaseIntent(s));
// Must NOT become new-case (existing patient operations)
for (const s of ["open case in bed 5", "open the case for bed 5", "summarise bed 9", "bed 11 bp 120/80", "show new cases", "what is the case in bed 3"])
  t(`not new-case: ${s}`, !detectExplicitNewCaseIntent(s));

t("bare short number is a bed", bedFromUnmatchedReference({ type: "DISPLAY_ID", value: "11" }) === "11");
t("10b normalised", bedFromUnmatchedReference({ type: "BED", value: "10b" }) === "10B");
t("long display id never a bed", bedFromUnmatchedReference({ type: "DISPLAY_ID", value: "261006004" }) === null);
t("C-2976 never a bed", bedFromUnmatchedReference({ type: "DISPLAY_ID", value: "C-2976" }) === null);
t("no reference", bedFromUnmatchedReference(null) === null);

const dict = "Patient number 11, patient presented with a complaint of chest pain associated with sweating. heart rate of 80, BP of 140 by 80, respiratory rate 18.";
t("clinical dictation starts case", shouldStartCaseForVacantBed({ utterance: dict, mayContainClinicalUpdate: planMateConversation(dict).mayContainClinicalUpdate }));
t("explicit phrase starts case", shouldStartCaseForVacantBed({ utterance: "Start a case in bed no 11", mayContainClinicalUpdate: false }));
t("summarise bed 9 does not", !shouldStartCaseForVacantBed({ utterance: "summarise bed 9", mayContainClinicalUpdate: planMateConversation("summarise bed 9").mayContainClinicalUpdate }));
t("question does not", !shouldStartCaseForVacantBed({ utterance: "what is the BP in bed 9?", mayContainClinicalUpdate: true }));

// Occupied bed is still protected: short number resolves to the occupant, never a new case
const occ: any = { id: "c1", bedNo: "11", status: "Active", patient: { name: "X" } };
const r = resolveInterpretedPatient({ reference: { type: "BED", value: "11" }, censusCases: [occ] });
t("occupied bed resolves to occupant", r.status === "RESOLVED" && r.caseId === "c1");
const v = resolveMateCaseReference({ utterance: "Bed 11", cases: [occ] });
t("occupied bed blocks vacant check", v.status === "RESOLVED");
const v3 = resolveMateCaseReference({ utterance: "Bed 11", cases: [{ ...occ, bedNo: "11A" }] });
t("occupied slot 11A also blocks (family)", v3.status !== "NOT_FOUND");
const v2 = resolveMateCaseReference({ utterance: "Bed 12", cases: [occ] });
t("vacant bed passes vacant check", v2.status === "NOT_FOUND");

// Wiring
const src = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
t("component re-exports detector", /export \{ detectExplicitNewCaseIntent \} from "\.\.\/mate\/mateNewCaseIntent"/.test(src));
t("vacant-bed branch precedes NOT_FOUND stop", src.indexOf("startNewCaseInBed(unmatchedBed") > 0 && src.indexOf("startNewCaseInBed(unmatchedBed") < src.indexOf('if (patientResolution.status === "NOT_FOUND") {'));
t("NOT_FOUND stop kept", /Explicit reference \(bed \/ case no\. \/ list index\) that matches nothing/.test(src));
t("occupancy re-checked before creating", /vacantCheck\.status === "NOT_FOUND"/.test(src)); 

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
