/**
 * Adult ER case sheet = the hospital's "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD"
 * (Neeraj, 21 Nov 2026: "follow this for ER cases, no deviation").
 * The sample case is the one from his hospital EMR screenshots.
 * Run: npx tsx verify_er_case_record_format.ts
 */
import { readFileSync } from "fs";
import { formatCaseSheetText, formatCaseSheetHtml } from "./src/utils/caseSheetFormat";
import { buildErCaseRecord, splitSentences, ER_RECORD_TITLE } from "./src/utils/erCaseRecord";

let passed = 0, failed = 0;
const ok = (c: any, n: string, extra = "") => { if (c) passed++; else { failed++; console.error("FAIL:", n, extra); } };

const sample: any = {
  caseId: "261121001", hospitalName: "Test Hospital",
  patient: { name: "Test Patient", age: 68, sex: "M", uhid: "U1", bed: "ER-3", weight: null },
  arrival: { date: "21 Nov 2026", time: "08:40" },
  clinician: "Joshua",
  presentingComplaint: "Breathing difficulty since today morning. Fever with chills since today morning.",
  primarySurvey: {
    airway: "Patent",
    breathing: "Bilateral air entry present with basal crepitations",
    circulation: "CRT less than 2 seconds, peripheral pulses well felt",
    disability: "Pupils bilaterally equal and reactive to light",
    exposure: null,
    vitalsContext: { rr: "24", spo2: "88% on room air, improved to 92% on oxygen at 4 L", hr: "129", bp: "170/100", gcsComponents: "15/15 — E4 V5 M6", grbs: "180 mg/dL", temp: "102°F" },
  },
  ecg: { performed: true, findings: "Normal sinus rhythm" },
  vbgAbg: { type: "VBG", performed: true, values: [
    { name: "pH", param: "ph", value: 7.432 }, { name: "pCO2", param: "pco2", value: 36.4 }, { name: "HCO3", param: "hco3", value: 23.8 },
    { name: "Na", param: "na", value: 138 }, { name: "K", param: "k", value: 3.7 }, { name: "Lactate", param: "lactate", value: 2.0 },
  ] },
  bedsideEcho: { performed: true, findings: "Moderate LV function. POOR ECHO WINDOW" },
  efast: { performed: false, findings: "" },
  hpi: "The patient presented to the Emergency Department with complaints of fever with chills and breathing difficulty since today morning. He initially sought medical attention at a local hospital, where Inj. Lasix and symptomatic treatment were administered.",
  events: null,
  symptoms: ["Fever with chills. Breathing difficulty."],
  pastHistory: ["Known case of COPD; Coronary artery disease (CAD); Dyslipidemia (DLP); Hypertension"],
  currentMedications: [],
  surgicalHistory: "Status post coronary artery bypass grafting (CABG)",
  familyHistory: null, lmp: null,
  allergies: ["No known allergies"],
  lastMeal: null,
  secondarySurvey: {
    general: "Pallor: Absent. Icterus: Absent. Cyanosis: Absent. Clubbing: Absent. Edema: Absent.",
    cvs: "S1 and S2 heard, normal",
    respiratory: "Chest expansion noted. Bilateral air entry present. Bilateral basal crepitations present.",
    abdomen: "Soft, non-distended and non-tender. Bowel sounds present.",
    cns: "Conscious and oriented. No focal neurological deficits.",
    extremities: "No visible abnormalities noted at the time of examination",
  },
  psychologicalAssessment: { notes: "No features suggestive of depression, anxiety, psychosis, agitation or suicidal ideation. No history of substance use reported." },
  investigationLabsOrdered: "CBC, CRP, RFT, LFT, Urea, Serum electrolytes, BNP, Troponin I",
  investigationImaging: "Chest X-ray, Echocardiogram",
  labs: [], cultureResults: [], investigationResultsSummary: null,
  treatmentGiven: ["Inj. Paracetamol 1 g IV stat", "Nebulization with Duolin stat", "Budecort inhalation stat", "Inj. Sompraz 40 mg IV stat"],
  treatmentNotes: null, treatment: null,
  procedures: { proceduresChecked: [], otherProcedures: null, procedureNotes: [] },
  consultation: { consultsRequested: ["Pulmonology"], consultantReview: null },
  disposition: { status: "ER observation", destinationUnit: null, durationInEr: null, conditionAtShift: null, managementPlan: null, consultsRequested: ["Pulmonology"], followUpAdvice: null },
  provisionalDiagnosis: "",
  differentials: [{ diagnosis: "Acute exacerbation of COPD", status: "suspected" }, { diagnosis: "Acute pulmonary edema", status: "" }],
  provisionalDifferentialDiagnoses: null,
  isPediatric: false, pediatricDetails: null,
  notes: { progressNotes: null, addendum: null },
  safetyAndAccreditation: null, isMlc: false, mlcDetails: null,
  signatureBlock: { clinicianName: "Joshua", consultantName: "Padmapriya", timestamp: null },
};

const emr = formatCaseSheetText(sample, { forEmr: true });
const expected = `INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD
Case Seen By: Dr. Joshua at 8:40 AM.
Presenting Complaint:
    Breathing difficulty since today morning.
    Fever with chills since today morning.
Primary Assessment:
    Airway → Patent.
    Breathing → RR: 24/min, SpO2: 88% on room air, improved to 92% on oxygen at 4 L. Bilateral air entry present with basal crepitations.
    Circulation → CRT: less than 2 seconds, HR: 129/min, BP: 170/100 mmHg. Peripheral pulses well felt.
    Disability → GCS: E4 V5 M6 (15/15), pupils bilaterally equal and reactive to light. GRBS: 180 mg/dL.
    Exposure → Temperature: 102°F.
Adjuvants to Primary:
ECG:
- Normal sinus rhythm.
VBG:
    pH: 7.432
    pCO2: 36.4 mmHg
    HCO3: 23.8 mmol/L
    Sodium: 138 mmol/L
    Potassium: 3.7 mmol/L
    Lactate: 2 mmol/L
Bedside Screening Echo:
    Moderate LV function.
    POOR ECHO WINDOW.
History of Present Illness:
The patient presented to the Emergency Department with complaints of fever with chills and breathing difficulty since today morning. He initially sought medical attention at a local hospital, where Inj. Lasix and symptomatic treatment were administered.
Secondary Survey:
Signs and Symptoms:
    Fever with chills.
    Breathing difficulty.
Past Medical History:
    Known case of COPD.
    Coronary artery disease (CAD).
    Dyslipidemia (DLP).
    Hypertension.
Surgical History:
- Status post coronary artery bypass grafting (CABG).
Family / Gynae History:
- Not documented.
Allergies:
- No known allergies.
General Examination:
    Pallor: Absent.
    Icterus: Absent.
    Cyanosis: Absent.
    Clubbing: Absent.
    Edema: Absent.
Systemic Examination:
CVS:
- S1 and S2 heard, normal.
CHEST:
    Chest expansion noted.
    Bilateral air entry present.
    Bilateral basal crepitations present.
Abdomen:
    Soft, non-distended and non-tender.
    Bowel sounds present.
CNS:
    Conscious and oriented.
    No focal neurological deficits.
Extremities and Back:
- No visible abnormalities noted at the time of examination.
Psychological Assessment:
    No features suggestive of depression, anxiety, psychosis, agitation or suicidal ideation.
    No history of substance use reported.
Investigations:
    CBC
    CRP
    RFT
    LFT
    Urea
    Serum electrolytes
    BNP
    Troponin I
    Chest X-ray
    Echocardiogram
Treatment Plan:
    Inj. Paracetamol 1 g IV stat.
    Nebulization with Duolin stat.
    Budecort inhalation stat.
    Inj. Sompraz 40 mg IV stat.
Disposition:
    ER observation.
    Pulmonology consultation.
Differential Diagnosis:
    Acute exacerbation of COPD.
    Acute pulmonary edema.
EM Resident: Dr. Joshua
EM Consultant: Dr. Padmapriya
`;

// Line-by-line comparison with the hospital record
const got = emr.split("\n"), want = expected.split("\n");
const firstDiff = want.findIndex((w, i) => got[i] !== w);
ok(firstDiff === -1 && got.length === want.length, "Copy to EMR text matches the hospital record line for line",
  firstDiff >= 0 ? `\n  line ${firstDiff + 1}\n  want: ${JSON.stringify(want[firstDiff])}\n  got:  ${JSON.stringify(got[firstDiff])}` : `length ${got.length} vs ${want.length}`);

// Section order is fixed
const order = ["Presenting Complaint:", "Primary Assessment:", "Adjuvants to Primary:", "History of Present Illness:", "Secondary Survey:", "Signs and Symptoms:", "Past Medical History:", "Surgical History:", "Family / Gynae History:", "Allergies:", "General Examination:", "Systemic Examination:", "Psychological Assessment:", "Investigations:", "Treatment Plan:", "Disposition:", "Differential Diagnosis:", "EM Resident:", "EM Consultant:"];
const pos = order.map((h) => emr.indexOf(h.endsWith(":") && !h.startsWith("EM") ? `\n${h}\n` : `\n${h}`));
ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), "every hospital section present, in the hospital's order");

// Empty case: every core heading still printed, nothing invented
const empty: any = { ...sample, presentingComplaint: "", primarySurvey: { airway: null, breathing: null, circulation: null, disability: null, exposure: null, vitalsContext: {} },
  ecg: { performed: false, findings: "" }, vbgAbg: { type: null, performed: false, values: [] }, bedsideEcho: { performed: false, findings: "" },
  hpi: null, symptoms: [], pastHistory: [], surgicalHistory: null, allergies: [], secondarySurvey: { general: null, cvs: null, respiratory: null, abdomen: null, cns: null, extremities: null },
  psychologicalAssessment: null, investigationLabsOrdered: null, investigationImaging: null, treatmentGiven: [], differentials: [],
  disposition: { status: null, destinationUnit: null, durationInEr: null, conditionAtShift: null, managementPlan: null, consultsRequested: [], followUpAdvice: null },
  consultation: { consultsRequested: [], consultantReview: null }, clinician: null, signatureBlock: { clinicianName: null, consultantName: null, timestamp: null } };
const e = formatCaseSheetText(empty, { forEmr: true });
ok(order.every((h) => e.includes(h)), "empty case still prints every hospital heading");
ok(!/Absent|Patent|normal|NAD|WNL|within normal/i.test(e), "empty case invents no findings (Rule 8)");
ok(e.includes("Case Seen By: Not documented.") && e.includes("EM Resident: Not documented"), "missing doctor says Not documented, never a made-up name");
ok(!e.includes("Triage:") && !e.includes("MLC") && !e.includes("Current Medications:") && !e.includes("Procedures:"), "extra sections only when recorded");

// Extras appear when recorded, next to their natural section
const extra = formatCaseSheetText({ ...sample, currentMedications: ["Tab. Aspirin 75 mg OD"], lastMeal: "2 hours ago", lmp: "10/11/2026",
  isMlc: true, mlcDetails: { natureOfIncident: "RTA", dateTimeOfIncident: null, placeOfIncident: null, identificationMark: null, informantBroughtBy: null, policeStation: null },
  provisionalDiagnosis: "Acute exacerbation of COPD", triageCategory: "P2 (Urgent)" }, { forEmr: true });
ok(extra.indexOf("Current Medications:") > extra.indexOf("Past Medical History:") && extra.indexOf("Current Medications:") < extra.indexOf("Surgical History:"), "medications sit after past history");
ok(/Family \/ Gynae History:\n- LMP: 10\/11\/2026\./.test(extra), "LMP goes under Family / Gynae History");
ok(extra.indexOf("Provisional Diagnosis:") < extra.indexOf("Differential Diagnosis:"), "provisional diagnosis just before differentials");
ok(/Medico-Legal Case \(MLC\):\n    Nature of incident: RTA\./.test(extra) && /Triage:\n    Triage category: P2 \(Urgent\)\./.test(extra), "MLC and triage shown when recorded");

// Splitting rules
ok(JSON.stringify(splitSentences("Inj. Lasix given. Dr. Rao informed")) === JSON.stringify(["Inj. Lasix given.", "Dr. Rao informed"]), "no split after Inj. / Dr.");
ok(splitSentences("pH 7.43. K 3.7").length === 2 && splitSentences("Temp 37.5 C").length === 1, "decimals never split");

// Copy for normal use keeps a patient header; HTML is one paragraph per line with bold headings
const normal = formatCaseSheetText(sample);
ok(normal.startsWith("Test Hospital\nCase ID: 261121001\nName: Test Patient") && normal.includes(`\n\n${ER_RECORD_TITLE}\n`), "printed/copy version: patient header, then the record");
const html = formatCaseSheetHtml(sample, { forEmr: true });
ok(html.includes("<p><strong>Presenting Complaint:</strong></p>") && html.includes('<p style="margin-left:40px"><strong>Airway</strong> → Patent.</p>') && html.includes("<p><strong>EM Consultant:</strong> Dr. Padmapriya</p>"), "rich-text paste: bold headings, indented lines");
ok(!/font|color|class=/.test(html), "rich-text paste adds no fonts or colours");

// Pediatric unchanged
const ped = formatCaseSheetText({ ...sample, isPediatric: true, pediatricDetails: null }, { forEmr: true });
ok(!ped.includes("Adjuvants to Primary:") && ped.includes("PRIMARY SURVEY"), "pediatric cases keep the pediatric sheet");

// Wiring
const print = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
ok(/\{!data\.isPediatric && <ErCaseRecordBody lines=\{buildErCaseRecord\(data\)\} \/>\}/.test(print), "printed sheet renders the same record for adults");
for (const f of ["src/components/CaseSheetPrintView.tsx", "src/components/CopyToEmrPanel.tsx", "src/components/CaseSheetView.tsx"]) {
  ok(/formatCaseSheetHtml\(/.test(readFileSync(f, "utf8")), `${f}: rich-text copy uses the same record`);
}
ok(buildErCaseRecord(sample)[0].kind === "title", "builder starts with the title");

console.log(`${passed} passed, ${failed} failed`);
if (failed) console.log("\n----- generated -----\n" + emr);
process.exit(failed ? 1 : 0);