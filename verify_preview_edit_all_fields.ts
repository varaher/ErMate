/**
 * Preview Edit mode, 24 Nov 2026 (Neeraj: "the main purpose of edit section is to edit all the fields,
 * the things which are not documented also"). In Edit mode every adult case-sheet field has an editable
 * line — an editable "Not documented." placeholder when empty. Print / Copy to EMR never pass `editing`,
 * so their output is unchanged. Toolbar buttons wrap with room instead of squeezing.
 */
import fs from "node:fs";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { buildErCaseRecord, erCaseRecordToText } from "./src/utils/erCaseRecord";
import { EDIT_SECTIONS, EDIT_GROUPS, applySectionEdits } from "./src/lib/previewedit";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const empty: any = { id: "e1", patient: { name: "A", age: 40, gender: "Male" }, vitals: {}, createdAt: new Date().toISOString() };
const full: any = {
  id: "f1", patient: { name: "B", age: 66, gender: "Female", presentingComplaint: "Chest pain" },
  vitals: { hr: "110", rr: "24", bp: "90/60", spo2: "92", temp: "99 F" },
  sampleHistory: { hpi: "Pain since 2 hours.", allergies: "None", symptoms: "pain", pastHistory: "DM", medications: "Metformin", socialHistory: "Smoker", lastMeal: "8 pm", lmp: "Menopausal", familyHistory: "Father MI" },
  primaryAssessment: { airway: "patent", survey: { adjuncts: { ecgStatus: "Abnormal", ecgNotes: "ST elevation V1-V4", echoNotes: "RWMA", abg: { sampleType: "VBG", ph: "7.30", finalDiagnosis: "Metabolic acidosis" } }, circulation: { efast: { ruq: "positive" } } } },
  secondarySurvey: { cvs: "S1 S2" },
  treatments: [{ id: "t1", drugName: "Inj A", dose: "1 mg", route: "IV" }], treatmentNotes: "Cath lab activated",
  differentials: [{ diagnosis: "STEMI", status: "CONFIRMED", reasoning: "", citations: [], nextSteps: [] }],
  investigationLabsOrdered: "CBC, Trop I", investigationImaging: "CXR", investigationResultsSummary: "Trop raised",
  provisionalPrimaryDiagnosis: "Anterior STEMI", progressNotes: "Better", addendumNotes: "Seen by cardio",
  dispositionAndPlan: { dispositionStatus: "Admitted", destinationUnit: "CCU", managementPlan: "PCI", followUpAdvice: "Cardiology OPD" }, conditionAtShift: "Stable",
};
const view = (c: any) => convertClinicalCaseToCaseSheetData(c);

// 1. Print / Copy output unchanged (no `editing`)
// Expected text = output of the 24 Nov 2026 builder before Edit mode changes (print / EMR copy must not move).
const BEFORE: Record<string, string> = {
  "empty": "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD\nCase Seen By: Not documented.\nPresenting Complaint:\n    Not documented.\nPrimary Assessment:\n    Airway → Not documented.\n    Breathing → Not documented.\n    Circulation → Not documented.\n    Disability → Not documented.\n    Exposure → Not documented.\nAdjuvants to Primary:\n    Not documented.\nHistory of Present Illness:\nNot documented.\nSecondary Survey:\nSigns and Symptoms:\n    Not documented.\nPast Medical History:\n    Not documented.\nSurgical History:\n- Not documented.\nFamily / Gynae History:\n- Not documented.\nAllergies:\n- Not documented.\nGeneral Examination:\n    Not documented.\nSystemic Examination:\nCVS:\n- Not documented.\nCHEST:\n    Not documented.\nAbdomen:\n    Not documented.\nCNS:\n    Not documented.\nExtremities and Back:\n- Not documented.\nPsychological Assessment:\n    Not documented.\nInvestigations:\n    Not documented.\nTreatment Plan:\n    Not documented.\nDisposition:\n    Not documented.\nDifferential Diagnosis:\n    Not documented.\nEM Resident: Not documented\nEM Consultant: Not documented\n",
  "full": "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD\nCase Seen By: Not documented.\nPresenting Complaint:\n    Chest pain.\nPrimary Assessment:\n    Airway → Patent.\n    Breathing → RR: 24/min, SpO2: 92%.\n    Circulation → HR: 110/min, BP: 90/60 mmHg.\n    Disability → Not documented.\n    Exposure → Temperature: 99 F.\nAdjuvants to Primary:\nECG:\n- Abnormal — ST elevation V1-V4.\nVBG:\n    pH: 7.3\n    Interpretation: Metabolic acidosis.\nBedside Screening Echo:\n    RWMA.\neFAST:\n    Positive (ruq: positive).\nHistory of Present Illness:\nPain since 2 hours.\nSecondary Survey:\nSigns and Symptoms:\n    Pain.\nPast Medical History:\n    DM.\nCurrent Medications:\n    Metformin.\nSurgical History:\n- Not documented.\nFamily / Gynae History:\n- Father MI.\n- LMP: Menopausal.\nSocial History:\n- Smoker.\nAllergies:\n- None.\nLast Meal:\n- 8 pm.\nGeneral Examination:\n    Not documented.\nSystemic Examination:\nCVS:\n- S1 S2.\nCHEST:\n    Not documented.\nAbdomen:\n    Not documented.\nCNS:\n    Not documented.\nExtremities and Back:\n- Not documented.\nPsychological Assessment:\n    Not documented.\nInvestigations:\n    CBC\n    Trop I\n    CXR\n    Trop raised.\nTreatment Plan:\n    Inj A 1 mg IV.\n    Cath lab activated.\nDisposition:\n    Admitted — CCU.\n    Condition: Stable.\n    PCI.\n    Follow-up: Cardiology OPD.\nProvisional Diagnosis:\n    Anterior STEMI.\nDifferential Diagnosis:\n    STEMI (CONFIRMED).\nProgress Notes:\n    Better.\nAddendum:\n    Seen by cardio.\nEM Resident: Not documented\nEM Consultant: Not documented\n"
};
for (const [n, c] of [["empty", empty], ["full", full]] as const) {
  t(`${n}: non-edit record identical to before`, erCaseRecordToText(buildErCaseRecord(view(c))) === BEFORE[n]);
}

// 2. Edit mode: every field of the editor has a line on the sheet, and on an empty case each is an editable placeholder
const edLines = buildErCaseRecord(view(empty), { editing: true });
const tagged = new Set(edLines.flatMap((l: any) => [l.edit, ...(l.segs || []).map((s: any) => s.edit)]).filter(Boolean).map((e: any) => `${e.s}|${e.k}`));
const skip = new Set(["rr", "hr", "spo2", "bp", "grbs", "temp", "status_x"]); // vitals: "More fields"
const normal = (s: string) => (s === "History" || s === "Secondary Assessment / History" ? "History" : s);
for (const g of EDIT_GROUPS.filter((x) => !x.pediatricOnly)) {
  for (const f of EDIT_SECTIONS[g.title]) {
    if (skip.has(f.key)) continue;
    const found = [...tagged].some((x) => { const [s, k] = x.split("|"); return k === f.key && EDIT_SECTIONS[s] === EDIT_SECTIONS[normal(g.title)]; });
    t(`empty case, edit mode: "${g.label} › ${f.label}" is editable on the sheet`, found);
  }
}
t("empty case: placeholders are editable (ph) and say Not documented", edLines.filter((l: any) => l.edit?.ph).every((l: any) => l.text === "Not documented."));
t("no 'Not documented.' line is left read-only in edit mode (except signatures / case seen by)", edLines.filter((l: any) => l.kind !== "labelled" && l.text === "Not documented." && !l.edit).length === 0);

// 3. Each field is one contiguous run (a block commit replaces the whole field)
const fullEd = buildErCaseRecord(view(full), { editing: true });
const runs = new Map<string, number>();
let prev = "";
for (const l of fullEd as any[]) { const k = l.edit ? `${l.edit.s}|${l.edit.k}` : ""; if (k && k !== prev) runs.set(k, (runs.get(k) || 0) + 1); prev = k; }
t("every editable field appears as one block", [...runs.values()].every((n) => n === 1));
t("full case edit mode: differential name editable even with a status", fullEd.some((l: any) => l.edit?.k === "differentials" && /STEMI/.test(l.text)));

// 4. Adjunct fields round-trip
const ed = (c: any, vals: Record<string, string>) => applySectionEdits(c, view(c), "Adjuvants to Primary", vals).next;
let c = ed(empty, { ecg: "Sinus tachycardia", echo: "Good LV function", efast: "No free fluid", gas: "Normal gas" });
let d = view(c);
t("ECG typed on empty case shows", d.ecg.findings === "Sinus tachycardia");
t("Echo typed shows", d.bedsideEcho.findings === "Good LV function");
t("eFAST typed shows", d.efast.findings === "No free fluid");
t("VBG interpretation typed shows", d.vbgAbg.notes === "Normal gas");
c = ed(full, { ecg: "Sinus rhythm, no ST change" });
t("ECG: status prefix dropped when the typed text replaces it", view(c).ecg.findings === "Sinus rhythm, no ST change");
const ecgShown = view(full).ecg.findings;
c = ed(full, { ecg: ecgShown + ". Q waves" });
t("ECG: edit keeping the status keeps it once", view(c).ecg.findings === ecgShown + ". Q waves");
c = ed(full, { ecg: "" });
t("ECG cleared -> Not documented", !view(c).ecg.findings && !view(c).ecg.performed);
const ef = view(full).efast.findings;
c = ed(full, { efast: `${ef} · Pelvis clear` });
t("eFAST: structured windows kept, added note shown once", view(c).efast.findings === `${ef} · Pelvis clear`);
c = ed(full, { efast: "Negative scan" });
t("eFAST: retyped text replaces the structured line", view(c).efast.findings === "Negative scan");
c = ed(full, { efast: "" });
t("eFAST cleared -> nothing shown", !view(c).efast.findings);
c = ed(full, { gas: "" });
t("VBG interpretation cleared", !view(c).vbgAbg.notes);
c = ed(full, { echo: "" });
t("Echo cleared", !view(c).bedsideEcho.findings);

// 5. Hidden-when-empty history / notes fields now typeable and saved
const hist = applySectionEdits(empty, view(empty), "History", { socialHistory: "Teacher", lastMeal: "Noon", lmp: "10/11/2026", medications: "Amlodipine", events: "Fall at home" }).next;
const hd = view(hist);
t("social history / last meal / LMP / medications typed on empty case show", hd.socialHistory === "Teacher" && hd.lastMeal === "Noon" && hd.lmp === "10/11/2026" && hd.currentMedications.join(",") === "Amlodipine");
const nt = applySectionEdits(empty, view(empty), "Clinical Notes & Addendum", { notes: "Reviewed", addendum: "Late entry" }).next;
t("progress notes / addendum typed on empty case show", view(nt).notes.progressNotes === "Reviewed" && view(nt).notes.addendum === "Late entry");
const ds = applySectionEdits(empty, view(empty), "Disposition & Outcome", { status: "Discharged", destination: "Home", condition: "Stable", followUp: "OPD 1 week" }).next;
t("disposition fields typed on empty case show", view(ds).disposition.status === "Discharged" && view(ds).disposition.destinationUnit === "Home" && view(ds).disposition.followUpAdvice === "OPD 1 week");

// 6. Wiring + toolbar spacing
const pv = fs.readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
t("preview passes editing only while Edit is on", /buildErCaseRecord\(data, \{ editing: Boolean\(inlineEdit && inlineOn\) \}\)/.test(pv));
t("print / copy builders do not pass editing", !/erCaseRecordTo(Text|Html)\(buildErCaseRecord\([^)]*editing/.test(fs.readFileSync("src/utils/caseSheetFormat.ts", "utf8")));
t("toolbar wraps with gaps", /flex flex-wrap items-center gap-2 sm:gap-2\.5 w-full sm:w-auto justify-end" data-preview-toolbar/.test(pv));
for (const id of ["preview-copy-casesheet-button", "preview-emr-fields-button", "preview-print-casesheet-button", "preview-edit-toggle"]) {
  const i = pv.indexOf(`id="${id}"`);
  const cls = pv.slice(i, i + 700);
  t(`${id}: roomy padding, no squeeze, no clipped text`, /flex-auto sm:flex-none shrink-0/.test(cls) && /px-4 py-2 whitespace-nowrap/.test(cls));
}
t("Adjuncts chip in the edit form", EDIT_GROUPS.some((g) => g.id === "adjuncts" && g.title === "Adjuvants to Primary"));


// 7. Pediatric sheet: adjuncts, PAT and differentials typeable in Edit mode
t("ped adjuncts: shown and typeable in Edit mode, even when empty", /if \(ieOn\) \{[\s\S]{0,300}const A = "Adjuncts to Primary Assessment"/.test(pv) && ["ecg", "echo", "efast", "gas"].every((k) => new RegExp(`<EdText s=\\{A\\} k="${k}"`).test(pv)));
t("ped adjuncts heading maps to the adjunct editor", EDIT_SECTIONS["Adjuncts to Primary Assessment"] === EDIT_SECTIONS["Adjuvants to Primary"]);
const PAT_KEYS = ["weight", "patAppearanceTone", "patAppearanceInteractivity", "patAppearanceConsolability", "patAppearanceLookGaze", "patAppearanceSpeechCry", "patWorkOfBreathing", "patCirculation", "birthHistory", "feedingHistory", "developmentalHistory", "immunizationHistory", "broughtBy", "informant"];
t("ped PAT: every line typeable in Edit mode", PAT_KEYS.every((k) => pv.includes(`row("`) && new RegExp(`row\\("[^"]+", "${k}"`).test(pv)) && PAT_KEYS.every((k) => EDIT_SECTIONS["Pediatric Assessment (PAT)"].some((f) => f.key === k)));
t("ped PAT block shown in Edit mode even when nothing recorded", /\{ieNow && \(\(\) => \{[\s\S]{0,200}const P = "Pediatric Assessment \(PAT\)"/.test(pv));
const kid: any = { id: "k1", isPediatric: true, patient: { name: "C", age: 4, gender: "Male" }, vitals: {}, createdAt: new Date().toISOString() };
let k2 = applySectionEdits(kid, view(kid), "Pediatric Assessment (PAT)", { weight: "14 kg", patWorkOfBreathing: "Subcostal retractions", immunizationHistory: "Up to date" }).next;
t("ped PAT typed on an empty child shows", view(k2).pediatricDetails?.weight == "14" && view(k2).pediatricDetails?.patWorkOfBreathing === "Subcostal retractions" && view(k2).pediatricDetails?.immunizationHistory === "Up to date");
k2 = applySectionEdits(k2, view(k2), "Pediatric Assessment (PAT)", { patWorkOfBreathing: "" }).next;
t("ped PAT cleared", !view(k2).pediatricDetails?.patWorkOfBreathing);
t("PAT chip only on pediatric cases", EDIT_GROUPS.some((g) => g.id === "pat" && g.pediatricOnly) && /EDIT_GROUPS\.filter\(\(g\) => !g\.pediatricOnly \|\| data\.isPediatric\)/.test(pv));
t("ped differentials with a status are typeable too", /<SectionHeading>Differential Diagnosis<\/SectionHeading>\s*\{ieNow \? \(/.test(pv));

// 8. Discharge summary: MLC, LMP, disposition, date, pediatric notes typeable in Edit mode
const ds2 = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
for (const k of ["isMlc", "mlcNo", "dispositionStatus", "dischargeDateTime", "pedWeight", "pedWorkOfBreathing", "pedCirculation", "pedImmunization"]) {
  t(`discharge: ${k} typeable on the sheet and has a setter`, new RegExp(`<DF k="${k}"`).test(ds2) && new RegExp(`\\b${k}: set`).test(ds2));
}
t("discharge: LMP line shown while editing", /\(lmp \|\| inlineOn \|\| isLmpApplicable/.test(ds2));
t("discharge: pediatric notes saved with the summary", /pedWeight,\s*pedWorkOfBreathing,\s*pedCirculation,\s*pedImmunization,/.test(ds2) && /pedImmunization\?: string/.test(fs.readFileSync("src/types.ts", "utf8")));
t("discharge: typed MLC normalises to Yes / No", /setIsMlc\(\/\^y\/i\.test\(v\.trim\(\)\) \? "Yes" : "No"\)/.test(ds2));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);