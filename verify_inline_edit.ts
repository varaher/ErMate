/** Edit in place on the adult preview: every editable line writes back to the right field, read-only lines stay read-only. */
import { readFileSync } from "fs";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { buildErCaseRecord, erCaseRecordToText } from "./src/utils/erCaseRecord";
import { applySectionEdits, EDIT_SECTIONS } from "./src/lib/previewedit";
import { blockEditText, blockTextToValue } from "./src/components/InlineEdit";

let fail = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok) fail++; };
const base: any = { id: "c", status: "Active", patient: { name: "A", age: 40, gender: "Male", presentingComplaint: "Vomiting. Abdominal pain." }, vitals: { rr: "24", spo2: "88", hr: "129", bp: "170/100" }, sampleHistory: {}, primaryAssessment: { airway: "Patent", breathing: "Air entry equal", circulation: "CRT less than 2 seconds, pulses felt", disability: "", exposure: "" }, secondarySurvey: {} };
const dataOf = (c: any) => convertClinicalCaseToCaseSheetData({ ...base, ...c } as any) as any;
const lines = (c: any) => buildErCaseRecord(dataOf(c));
const tags = (c: any) => new Set(lines(c).flatMap((l: any) => [l.edit, ...(l.segs || []).map((s: any) => s.edit)]).filter(Boolean).map((e: any) => `${e.s}|${e.k}`));

// every tag points at a real field of the edit map
const all = tags({ sampleHistory: { symptoms: "x", socialHistory: "y", familyHistory: "z", allergies: "a", pastHistory: "p", medications: "m", surgicalHistory: "s", lastMeal: "l", hpi: "h", events: "e", psychiatricFlags: "n" }, secondarySurvey: { general: "g", cvs: "c", respiratory: "r", abdomen: "ab", cns: "cn", extremities: "ex" }, differentials: [{ diagnosis: "ACS", status: "POSSIBLE" }], provisionalDifferentialDiagnoses: "also dissection", provisionalPrimaryDiagnosis: "Chest pain", investigationLabsOrdered: "CBC", investigationImaging: "CXR", investigationResultsSummary: "ok", treatments: [{ id: "1", drugName: "Inj X", dose: "", route: "" }], treatmentNotes: "obs", progressNotes: "note", addendumNotes: "add", dispositionAndPlan: { managementPlan: "admit" } });
t("tags found", all.size > 20);
t("every tag maps to a real field", [...all].every((k) => { const [s, key] = k.split("|"); return (EDIT_SECTIONS[s] || []).some((f) => f.key === key); }));

// block text helpers
t("dash rows keep their dash while typing", blockEditText("dash", ["No known allergies."], false) === "- No known allergies.");
t("dash marks removed when stored", blockTextToValue("- A\n- B\n\n  - C ") === "A\nB\nC");
t("placeholder starts empty", blockEditText("item", ["Not documented."], true) === "");

// round trips through the same writer the preview uses
const edit = (c: any, s: string, k: string, v: string) => applySectionEdits({ ...base, ...c }, dataOf(c), s, { [k]: v }).next;
t("complaint", edit({}, "Presenting Complaint", "cc", "Fever").patient.presentingComplaint === "Fever");
t("breathing findings only", edit({}, "Primary Survey", "breathing", "Crepitations").primaryAssessment.breathing === "Crepitations" && edit({}, "Primary Survey", "breathing", "Crepitations").vitals.rr === "24");
t("allergies", edit({}, "History", "allergies", "None").sampleHistory.allergies === "None");
t("social history", edit({}, "History", "socialHistory", "Smoker").sampleHistory.socialHistory === "Smoker");
t("HPI typed by the doctor is protected from auto-rewrite", edit({}, "History", "hpi", "Own words").sampleHistory.hpiSource === "doctor");
t("psychology: SAMPLE note written", edit({}, "Psychological Assessment", "psych", "Normal").sampleHistory.psychiatricFlags === "Normal");
t("psychology: structured notes kept in step", edit({ psychologicalAssessment: { notes: "Old", suicidalIdeation: false } }, "Psychological Assessment", "psych", "New").psychologicalAssessment.notes === "New");
t("psychology: string form kept in step", edit({ psychologicalAssessment: "Old" }, "Psychological Assessment", "psych", "New").psychologicalAssessment === "New");

// primary lines
const prim = (c: any, label: string) => lines(c).find((l: any) => l.kind === "labelled" && l.label === label) as any;
t("breathing: vitals fixed, findings typeable", (() => { const l = prim({}, "Breathing"); return l.segs.filter((s: any) => s.edit).length === 1 && !l.segs[0].edit && /RR: 24/.test(l.segs[0].text); })());
t("circulation: CRT and findings are two pieces", prim({}, "Circulation").segs.filter((s: any) => s.edit).length === 2);
t("segments always re-assemble to the printed line", ["Airway", "Breathing", "Circulation", "Disability", "Exposure"].every((lb) => { const l = prim({}, lb); return !l.segs || l.segs.some((s: any) => s.edit?.ph) || l.segs.map((s: any) => s.text).join("") === l.text; }));
t("placeholder pieces show the same Not documented. text", ["Airway", "Disability"].every((lb) => { const l = prim({ primaryAssessment: { airway: "", disability: "" }, vitals: {} }, lb); return l.text === "Not documented." && l.segs[0].edit.ph && l.segs[0].hint === "Not documented."; }));
t("vitals-only line gets an empty piece to type findings", (() => { const l = prim({ primaryAssessment: { ...base.primaryAssessment, exposure: "" }, vitals: { temp: "99 F" } }, "Exposure"); return l.segs.length === 2 && l.segs[1].edit && l.segs[1].text === ""; })());

// read-only things stay read-only
t("differential with a status in brackets is not editable", !lines({ differentials: [{ diagnosis: "ACS", status: "CONFIRMED" }] }).some((l: any) => l.edit?.k === "differentials"));
t("MLC / triage / signatures are not editable", lines({}).filter((l: any) => l.kind === "labelled" && /^(Case Seen By|EM Resident|EM Consultant)$/.test(l.label)).every((l: any) => !l.segs));

// the copy / print text is unchanged by the tags
t("plain text output has no edit markup", !/edit|"s":/.test(erCaseRecordToText(lines({}))));

// wiring
const view = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
t("adult preview edits in place, pediatric keeps the window", /const inlineEdit = Boolean\(canEditPreview && data && !data\.isPediatric && !applySuccess\)/.test(view) && /onEdit=\{inlineEdit \? commitInlineEdit : undefined\}/.test(view));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);