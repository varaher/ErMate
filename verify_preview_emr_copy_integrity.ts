// MARKER: ERMATE-PREVIEW-EMR-COPY-INTEGRITY-V1
// Audit 23 Nov 2026: after the doctor edits the case-sheet preview, every output — full Copy to EMR,
// section-wise EMR fields, and print — must use the edited draft, never an older snapshot.
import { readFileSync } from "fs";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { applySectionEdits } from "./src/lib/previewedit";
import { formatCaseSheetText, formatCaseSheetHtml } from "./src/utils/caseSheetFormat";
import { buildEmrSections } from "./src/utils/emrSections";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

const base: any = {
  id: "c1", patient: { name: "A", age: 66, gender: "Male", presentingComplaint: "Fall" },
  vitals: { hr: "80", rr: "20", temp: "97 F" },
  sampleHistory: { hpi: "OLD-HPI-TEXT", allergies: "None", symptoms: "pain", pastHistory: "DM" },
  primaryAssessment: { airway: "patent" },
  secondaryAssessment: "", secondarySurvey: { cvs: "s1 s2" },
  treatments: [{ id: "t1", drugName: "Inj A", dose: "1 mg", route: "IV" }],
  differentials: [{ diagnosis: "SAH", status: "CONSISTENT", reasoning: "", citations: [], nextSteps: [] }],
  createdAt: new Date().toISOString(),
};
const view = (c: any) => convertClinicalCaseToCaseSheetData(c);

// 1. Doctor edits HPI in the preview → draft changes
const r = applySectionEdits(base, view(base), "History", { hpi: "EDITED-HPI-TEXT" });
const draft = r.next;
t("edit produced a new draft", r.changed === 1 && draft !== base);

// 2. Everything built from the draft shows the edit and not the old text (adult ER record path)
const data = view(draft);
const text = formatCaseSheetText(data);
const html = formatCaseSheetHtml(data);
const emrHtml = formatCaseSheetHtml(data, { forEmr: true });
const sections = buildEmrSections(data);
const sectionText = JSON.stringify(sections);
t("full copy (text) has the edit", text.includes("EDITED-HPI-TEXT") && !text.includes("OLD-HPI-TEXT"));
t("full copy (HTML) has the edit", html.includes("EDITED-HPI-TEXT") && !html.includes("OLD-HPI-TEXT"));
t("EMR copy HTML has the edit", emrHtml.includes("EDITED-HPI-TEXT") && !emrHtml.includes("OLD-HPI-TEXT"));
t("section-wise EMR fields have the edit", sectionText.includes("EDITED-HPI-TEXT") && !sectionText.includes("OLD-HPI-TEXT"));

// 3. Paediatric path too
const ped: any = { ...draft, isPediatric: true, patient: { ...draft.patient, age: 6 } };
const pdata: any = { ...view(ped), isPediatric: true };
t("paediatric copy has the edit", formatCaseSheetText(pdata).includes("EDITED-HPI-TEXT"));

// 4. Wiring in the component
const src = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
t("editable preview ignores a caller-supplied data snapshot", /const data = \(canEditPreview \? null : propData\) \|\|/.test(src));
t("copy uses the same data object as the preview", /handleCopyCaseSheet[\s\S]{0,400}formatCaseSheetHtml\(data\)/.test(src));
t("EMR fields button present in the preview toolbar", src.includes('id="preview-emr-fields-button"'));
t("EMR fields button still present in the saved-sheet toolbar", src.includes('id="print-emr-fields-button"'));
t("EMR fields panel receives the preview data", (src.match(/<CopyToEmrPanel data=\{data\}/g) || []).length >= 2);

console.log(`\nPreview → EMR copy integrity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);