import fs from "fs";
import { parsePastedSheetHeader, parsePastedDischargeDraft, mergePastedSheetIntoExtraction, detectSheetIdentityConflict } from "./src/mate/pastedSheetParser";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const a = `EMERGENCY CASE SHEET
Name: R. Kumar  Age/Sex: 54/M  UHID: 123456  Date: 18/10/2026
Chief complaints: Chest pain x 2 hrs
Diagnosis: Acute anterior wall STEMI
Treatment given: Aspirin 300 mg
Discharge medications:
Tab Aspirin 75 mg OD
Tab Atorvastatin 40 mg HS
Condition at discharge: Stable
Follow up: Cardiology OPD in 1 week. Return if chest pain.
Signature: Dr X`;
const h = parsePastedSheetHeader(a), d = parsePastedDischargeDraft(a);
t("name", h.patientName === "R. Kumar");
t("age", h.age === "54");
t("sex", h.gender === "Male");
t("bare Diagnosis: is NOT promoted to discharge diagnosis", d.primaryDiagnosis === undefined);
t("explicit Final diagnosis IS", parsePastedDischargeDraft("Final Diagnosis: Acute anterior wall STEMI").primaryDiagnosis === "Acute anterior wall STEMI");
t("Impression / Provisional not promoted", Object.keys(parsePastedDischargeDraft("Impression: ? sepsis\nProvisional Diagnosis: UTI")).length === 0);
t("condition", d.conditionAtDischarge === "Stable");
t("discharge meds multi-line", d.dischargeMedications === "Tab Aspirin 75 mg OD\nTab Atorvastatin 40 mg HS");
t("follow-up", /Cardiology OPD in 1 week/.test(d.followUpPlan || ""));
t("ER 'Treatment given' NOT taken as discharge meds", !/Aspirin 300/.test(d.dischargeMedications || ""));

const b = `Patient Name: Mrs. Latha Menon, Age: 62 years, Sex: Female\nPresenting complaint: fever\nFinal Diagnosis: Urosepsis\nAdvice on discharge: Plenty of oral fluids; review in 3 days.`;
const hb = parsePastedSheetHeader(b), db = parsePastedDischargeDraft(b);
t("name with title stripped", hb.patientName === "Latha Menon");
t("age years / female", hb.age === "62" && hb.gender === "Female");
t("final diagnosis", db.primaryDiagnosis === "Urosepsis");
t("advice on discharge → follow-up", /review in 3 days/.test(db.followUpPlan || ""));

// Safety: nothing invented from a note without labels
const none = parsePastedSheetHeader("chest pain since morning, BP 140/80, HR 90, age of onset 2 hours");
t("no name invented", none.patientName === undefined);
t("'age of onset' not an age", none.age === undefined);
t("no discharge draft from plain note", Object.keys(parsePastedDischargeDraft("chest pain, BP 140/80, plan admit and monitor")).length === 0);
t("age out of range ignored", parsePastedSheetHeader("Age: 250").age === undefined);

// Merge fills blanks only
const m = mergePastedSheetIntoExtraction({ patientName: "Already Set", age: "", gender: "Unknown" }, a);
t("existing name kept", m.patientName === "Already Set");
t("blank age filled", m.age === "54");
t("unknown gender filled", m.gender === "Male");
t("follow-up advice carried to case sheet", /Cardiology OPD/.test(m.followUpAdvice));
t("discharge draft attached", m.dischargeInfoDraft?.dischargeMedications?.includes("Atorvastatin"));
const m2 = mergePastedSheetIntoExtraction({ dischargeInfoDraft: { followUpPlan: "Existing plan", dischargeMedications: "" } }, a);
t("existing non-empty discharge draft value kept", m2.dischargeInfoDraft.followUpPlan === "Existing plan");
t("blank discharge draft value filled", /Atorvastatin/.test(m2.dischargeInfoDraft.dischargeMedications));
t("blank-valued extraction not overwritten by sheet name", mergePastedSheetIntoExtraction({ patientName: "Set Name" }, a).patientName === "Set Name");

// Unlabelled honorific header (real-world sheet)
const real = "Mrs. CLARAMMA ABRAHAM\nAge - 79 Y/ F        ER- 1859001, B- ERP1-08D\n\nINITIAL ASSESSMENT\nPresenting Complaint: Reduced response since 1 day";
const hr = parsePastedSheetHeader(real);
t("honorific first-line name", hr.patientName === "CLARAMMA ABRAHAM");
t("Age - 79 Y/ F", hr.age === "79" && hr.gender === "Female");
t("a clinical first line is not a name", parsePastedSheetHeader("Mr. Sharma has chest pain since morning and BP is high").patientName === undefined);

// Identity conflict: sheet for another patient must not merge into the open one
t("different name blocks", !!detectSheetIdentityConflict(real, { name: "Ravi Menon", age: 79, gender: "Female" }));
t("same name ok", detectSheetIdentityConflict(real, { name: "Claramma Abraham", age: 79, gender: "Female" }) === null);
t("partial name overlap ok", detectSheetIdentityConflict(real, { name: "Claramma", age: 79, gender: "F" }) === null);
t("different sex blocks", !!detectSheetIdentityConflict(real, { name: "", age: 79, gender: "Male" }));
t("age gap >5 blocks", !!detectSheetIdentityConflict(real, { name: "", age: 30, gender: "Female" }));
t("age gap <=5 ok", detectSheetIdentityConflict(real, { name: "", age: 76, gender: "Female" }) === null);
t("open patient with no details = no conflict", detectSheetIdentityConflict(real, { name: "", age: null, gender: "" }) === null);
t("sheet without header = no conflict", detectSheetIdentityConflict("Presenting Complaint: fever\nHR 90 BP 120/80", { name: "Ravi Menon", age: 40, gender: "Male" }) === null);
t("no open patient = no conflict", detectSheetIdentityConflict(real, null) === null);
t("input not mutated", mergePastedSheetIntoExtraction({}, a) !== undefined);

// Wiring
const chat = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
const app = fs.readFileSync("./src/App.tsx", "utf8");
const dis = fs.readFileSync("./src/components/DischargeSummaryView.tsx", "utf8");
t("paste merged only for full case sheets", /if \(looksLikeFullCaseSheet\(trimmed\)\) \{\s*Object\.assign\(fieldsToExtract, mergePastedSheetIntoExtraction\(fieldsToExtract, trimmed\)\)/.test(chat));
t("discharge preview applies pasted draft", /extracted\?\.dischargeInfoDraft/.test(app) && /draftCase\.dischargeInfo = \{/.test(app));
t("auto AI draft fills only fields blank at response time", /handleAiDraft\(true\)/.test(dis) && /blankNow\(prev\)/.test(dis) && /setFollowUpPlan\(\(p\) => apply\(p,/.test(dis));
t("conflict guard wired before extraction", /detectSheetIdentityConflict\(trimmed,/.test(chat) && /does not match the open patient/.test(chat));
t("manual AI draft button replaces as before", /onClick=\{\(\) => handleAiDraft\(false\)\}/.test(dis));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
