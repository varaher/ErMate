import fs from "fs";
import { isReferenceGroundedInUtterance, groundPatientReference, isLongClinicalPaste, looksLikeFullCaseSheet, bedFromUnmatchedReference } from "./src/mate/mateNewCaseIntent";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const g = (type: any, value: any, u: string) => isReferenceGroundedInUtterance({ type, value }, u);

// Numbers inside a dictation are NOT beds
t("RR 18 not a bed", !g("BED", "18", "HR 80, BP 140 by 80, RR 18, SpO2 98%"));
t("BP by 80 not a case no.", !g("DISPLAY_ID", "80", "BP 140 by 80, HR 90"));
t("GCS 15 not a bed", !g("BED", "15", "GCS 15, pupils reacting"));
t("age 54 not a bed", !g("DISPLAY_ID", "54", "54 year old male with chest pain"));
// Real references ARE grounded
t("bed 11", g("BED", "11", "bed 11 chest pain"));
t("bed no 11", g("BED", "11", "New pt in bed no 11"));
t("patient number 11", g("DISPLAY_ID", "11", "Patient number 11, presented with chest pain"));
t("pt no. 7", g("BED", "7", "pt no. 7 vomiting"));
t("bed 10B", g("BED", "10B", "bed 10b bp dropped"));
t("bare reply 11", g("BED", "11", "11"));
t("long display id anywhere", g("DISPLAY_ID", "261006004", "case 261006004 PMH nil"));
t("C-2976", g("DISPLAY_ID", "C-2976", "open C-2976"));
t("bed 1 is not bed 11", !g("BED", "1", "bed 11 chest pain"));
t("CURRENT/RECENT untouched", g("CURRENT", null, "what's pending"));
t("ungrounded → NONE", groundPatientReference({ type: "BED", value: "18" }, "RR 18, HR 80")?.type === "NONE");
t("grounded kept", groundPatientReference({ type: "BED", value: "11" }, "bed 11 pain")?.type === "BED");
t("ungrounded short number no longer a bed", bedFromUnmatchedReference(groundPatientReference({ type: "DISPLAY_ID", value: "18" }, "RR 18")) === null);

const sheet = `EMERGENCY CASE SHEET\nName: R. Kumar Age/Sex: 54/M\nChief complaints: Chest pain x 2 hrs with sweating, radiating to left arm\nHPI: Known HTN and T2DM on regular medication. Pain central, severe, associated with sweating and breathlessness since morning.\nVitals: HR 98, BP 150/90, RR 20, SpO2 97% RA, Temp 98.6F, GCS 15\nExamination: CVS S1S2 normal. RS clear. P/A soft, non tender. CNS no deficit.\nInvestigations: ECG ST elevation V1-V4. Troponin I 2.4 ng/mL. Chest X-ray normal. Blood sugar 210.\nTreatment given: Aspirin 300 mg, Clopidogrel 300 mg, Atorvastatin 80 mg, heparin.\nDiagnosis: Acute anterior wall STEMI\nDisposition: Shifted to cath lab. Advice on discharge: review in 1 week.`;
t("pasted sheet = long clinical paste", isLongClinicalPaste(sheet, planMateConversation(sheet).mayContainClinicalUpdate));
t("pasted sheet looks like full sheet", looksLikeFullCaseSheet(sheet));
t("short dictation not a paste", !isLongClinicalPaste("HR 80 BP 140/80", true));
t("question not a paste", !isLongClinicalPaste(sheet + " what next?", true));
t("short note not a full sheet", !looksLikeFullCaseSheet("chest pain, BP 140/80, ECG normal, diagnosis atypical chest pain"));

// Wiring
const src = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
t("interpreter skipped for long paste", /isLongClinicalPaste\(trimmed, planMateConversation\(trimmed\)\.mayContainClinicalUpdate\)/.test(src) && /skipInterpreter\s*\?/.test(src));
t("clarification skipped for dictation", /needsClarification && interp\.clarificationQuestion && !dictationNotQuestion/.test(src));
t("conversational stop skipped for dictation", /interp\.conversationalReply && !dictationNotQuestion/.test(src));
t("reference grounded before resolve", /groundPatientReference\(interp\.patientReference, trimmed\)/.test(src) && /resolveRef\(groundedRef\)/.test(src));
t("vacant-bed start uses grounded ref", /bedFromUnmatchedReference\(groundedRef\)/.test(src));
t("discharge button offered for pasted sheet", /data\.dischargeIntent \|\| looksLikeFullCaseSheet\(trimmed\)/.test(src));
t("NOT_FOUND stop kept for explicit refs", /that matches nothing/.test(src));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
