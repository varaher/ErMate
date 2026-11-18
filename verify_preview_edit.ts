import { readFileSync } from "fs";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { EDIT_SECTIONS, EDIT_GROUPS, applySectionEdits, isEditableSection } from "./src/lib/previewedit";
import { buildIcuEmrSections, buildIcuNoteText, newNote } from "./src/icu/icuLogic";

let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };

const base: any = {
  id: "c1", patient: { name: "A", age: 66, gender: "Male", presentingComplaint: "Fall" },
  vitals: { hr: "80", rr: "20", temp: "97 F" },
  sampleHistory: { hpi: "old hpi", allergies: "None", symptoms: "pain", pastHistory: "DM" },
  primaryAssessment: { airway: "patent" },
  secondaryAssessment: "", secondarySurvey: { cvs: "s1 s2" },
  treatments: [{ id: "t1", drugName: "Inj A", dose: "1 mg", route: "IV" }],
  differentials: [{ diagnosis: "SAH", status: "CONSISTENT", reasoning: "", citations: [], nextSteps: [] }],
  createdAt: new Date().toISOString(),
};
const view = (c: any) => convertClinicalCaseToCaseSheetData(c);
const edit = (c: any, title: string, vals: Record<string, string>) => {
  const r = applySectionEdits(c, view(c), title, vals);
  return { c: r.next, n: r.changed };
};

// every editable heading exists and no field key repeats inside a section
for (const [title, fields] of Object.entries(EDIT_SECTIONS)) {
  t(`section "${title}" is editable`, isEditableSection(title));
  t(`section "${title}" has unique field keys`, new Set(fields.map((f) => f.key)).size === fields.length);
}

// history text shows in the preview after the edit
let r = edit(base, "History", { hpi: "new hpi", allergies: "Penicillin" });
t("two fields changed", r.n === 2);
t("HPI shows", view(r.c).hpi === "new hpi");
t("allergies show", view(r.c).allergies.join(",") === "Penicillin");
t("original draft untouched", base.sampleHistory.hpi === "old hpi");

// unchanged text counts as no edit
r = edit(base, "History", { hpi: "old hpi" });
t("same text is no edit", r.n === 0 && r.c === base);

// presenting complaint, primary survey, vitals
r = edit(base, "Presenting Complaint", { cc: "Road traffic accident" });
t("complaint shows", view(r.c).presentingComplaint === "Road traffic accident");
r = edit(base, "Primary Survey", { airway: "ET tube at 21 cm", hr: "92", temp: "98.6 F" });
t("airway shows", view(r.c).primarySurvey.airway === "ET tube at 21 cm");
t("vitals written as typed", r.c.vitals.hr === "92" && r.c.vitals.temp === "98.6 F");

// secondary survey line (discharge copy kept in step when it exists)
r = edit(base, "Secondary Survey", { cvs: "S1 S2 heard" });
t("CVS shows", view(r.c).secondarySurvey.cvs === "S1 S2 heard");
const withDis = { ...base, dischargeInfo: { secondaryCvs: "old copy" } };
r = edit(withDis, "Secondary Survey", { cvs: "typed" });
t("discharge copy follows", view(r.c).secondarySurvey.cvs === "typed");

// drugs, one per line
r = edit(base, "Treatment Given & Emergency Orders", { drugs: "Inj Sompraz 40 mg IV stat\nInj Mannitol 100 mL IV stat" });
t("drug lines show", view(r.c).treatmentGiven.length === 2 && view(r.c).treatmentGiven[0] === "Inj Sompraz 40 mg IV stat");

// differentials keep the old status when the text matches
r = edit(base, "Differential Diagnosis", { differentials: "SAH\nDKA" });
const dd = view(r.c).differentials;
t("differentials", dd.length === 2 && dd[0].status === "CONSISTENT" && dd[1].diagnosis === "DKA");

// investigations, disposition, notes
r = edit(base, "Investigations & Diagnostic Studies", { imaging: "CT brain plain" });
t("imaging shows", view(r.c).investigationImaging === "CT brain plain");
r = edit(base, "Disposition & Outcome", { destination: "SICU", plan: "Neurosurgery review" });
t("disposition shows", view(r.c).disposition.destinationUnit === "SICU" && view(r.c).disposition.managementPlan === "Neurosurgery review");

// ICU preview: edited wording wins, can be reset, and flows into the full note text
const note: any = newNote({ admissionId: "a1", kind: "daily", authorUid: "u", authorName: null });
try {
  const adm = { unitName: "SICU", bed: "2A", admittedAt: new Date().toISOString() };
  const plain = buildIcuEmrSections(note, adm as any);
  t("ICU sections build", plain.length === 10 && plain.every((s) => !s.edited));
  const edited = buildIcuEmrSections({ ...note, emrEdits: { summary: "Stable on ventilator." } } as any, adm as any);
  const sm = edited.find((s) => s.key === "summary")!;
  t("ICU edit wins and is flagged", sm.text === "Stable on ventilator." && sm.edited === true);
  t("ICU full note uses the edit", buildIcuNoteText({ ...note, emrEdits: { summary: "Stable on ventilator." } } as any, adm as any, { name: "Dr X" }).includes("Stable on ventilator."));
  const blank = buildIcuEmrSections({ ...note, emrEdits: { summary: "   " } } as any, adm as any).find((s) => s.key === "summary")!;
  t("blank edit falls back to generated text", !blank.edited);
} catch (e: any) {
  // the ICU builders need the full note shape; the wiring checks below still apply
  console.log("ICU builder call failed:", e?.message);
  fail++;
}

// wiring
const pv = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
t("preview applies the edited draft", pv.includes("onApplyPreview((shownCase || clinicalCase) as ClinicalCase)"));
t("edit toggle only in preview", pv.includes("canEditPreview = Boolean(isPreview && clinicalCase && onApplyPreview)"));
t("preview tour requested", pv.includes('requestTour("preview")'));
const icu = readFileSync("src/icu/IcuNoteView.tsx", "utf8");
t("ICU preview edit hidden once signed", icu.includes('const canEdit = note.status !== "signed"'));

if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");

// One-window form: every group maps to a real editable section.
for (const g of EDIT_GROUPS) t(`group "${g.label}" maps to an editable section`, isEditableSection(g.title));
{
  const src = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
  t("one-window form is wired", src.includes("<EditAllForm") && src.includes("EDIT_GROUPS.map"));
  t("old section pop-up is gone", !src.includes("SectionEditor") && !src.includes("PreviewEditCtx"));
}