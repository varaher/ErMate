import fs from "fs";
import { detectPatientAnnouncement, shouldStartCaseForVacantBed, detectExplicitNewCaseIntent } from "./src/mate/mateNewCaseIntent";
import { extractMateBedReference } from "./src/mate/mateCaseResolver";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

for (const s of ["I have apt in bed no 9", "I have a patient in bed 9", "we got a new pt in bed 4", "I've got a patient in bed 12", "there is a patient in bed 3", "received a patient in bed 7", "I have one patient in bed no 2"])
  t(`announcement: ${s}`, detectPatientAnnouncement(s) && extractMateBedReference(s) !== null);
for (const s of ["summarise patient in bed 9", "open the patient in bed 9", "what is the BP of the patient in bed 9?", "do I have a patient in bed 9?", "patient in bed 9 has BP 80/50", "bed 9", "show patient in bed 9", "how many patients do I have", "I have a headache"])
  t(`not announcement: ${s}`, !detectPatientAnnouncement(s));

t("announcement is not an explicit new-case phrase (separate, vacant-only path)", !detectExplicitNewCaseIntent("I have apt in bed no 9"));
t("announcement starts a case on a vacant bed", shouldStartCaseForVacantBed({ utterance: "I have apt in bed no 9", mayContainClinicalUpdate: planMateConversation("I have apt in bed no 9").mayContainClinicalUpdate }));
t("plain 'bed 9' still does not", !shouldStartCaseForVacantBed({ utterance: "bed 9", mayContainClinicalUpdate: false }));
t("question never starts", !shouldStartCaseForVacantBed({ utterance: "do I have a patient in bed 9?", mayContainClinicalUpdate: false }));

const src = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
t("local announce block exists", /detectPatientAnnouncement\(trimmed\)/.test(src) && /startNewCaseInBed\(bedRef, bedRef, true\)/.test(src));
t("announce path requires vacant bed", /announceCheck\.status === "NOT_FOUND"/.test(src));
t("announce block runs before the interpreter", src.indexOf("startNewCaseInBed(bedRef, bedRef, true)") < src.indexOf("// ── PART 2: SERVER INTERPRETATION"));
t("announce-only posts a ready message and does not replay", /pendingNew\.announceOnly/.test(src) && /is ready\. Dictate, or paste the case sheet\./.test(src));
t("explicit new-patient replay unchanged", /sendToChat\(pendingNew\.utterance, \{ skipMatePatientResolution: true \}\)/.test(src));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
