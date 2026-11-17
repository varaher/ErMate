// Row add/delete and discharge-only edits in "Edit before preview".
import { applyEdits, editableFields, getRows, diffRowEdits, ROW_LISTS, splitEdits } from "./src/lib/extractionedits";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };

const merged: any = {
  treatmentGiven: [{ drugName: "Inj. Ceftriaxone", dose: "1 g", route: "IV", timeGiven: "10:00" }, "Inj. Ondansetron"],
  labs: [{ name: "Hb", value: "11.2" }, { name: "Creatinine", value: "1.4" }],
  imaging: [{ name: "ECG", value: "Sinus tachycardia" }],
  investigations: [{ id: "inv-1", testName: "Hb", result: "11.2" }],
  vitals: { hr: "96" },
};

// rows load
const drugs = getRows(merged, "drugs");
t("drugs load, object and string", drugs.length === 2 && drugs[0].cells.dose === "1 g" && drugs[1].cells.drugName === "Inj. Ondansetron");
t("labs load", getRows(merged, "labs").length === 2);
t("no edit when unchanged", Object.keys(diffRowEdits(merged, "drugs", drugs)).length === 0);

// delete one drug, keep the other
const del = drugs.map((r, i) => (i === 1 ? { ...r, del: true } : r));
const e1 = diffRowEdits(merged, "drugs", del);
t("delete drops the row", Array.isArray(e1.treatmentGiven) && e1.treatmentGiven.length === 1);
t("kept row keeps hidden fields", e1.treatmentGiven[0].timeGiven === "10:00");

// add a drug
const add = [...drugs, { cells: { drugName: "Inj. Pantoprazole", dose: "40 mg", route: "IV" } }];
const e2 = diffRowEdits(merged, "drugs", add);
t("add appends", e2.treatmentGiven.length === 3 && e2.treatmentGiven[2].drugName === "Inj. Pantoprazole");

// blank added row ignored
t("blank row ignored", Object.keys(diffRowEdits(merged, "drugs", [...drugs, { cells: {} }])).length === 0);

// lab edit mirrors investigations and the text line
const labs = getRows(merged, "labs");
const lab2 = labs.map((r, i) => (i === 0 ? { ...r, cells: { ...r.cells, value: "9.8" } } : r));
const e3 = diffRowEdits(merged, "labs", lab2);
t("lab value edited", e3.labs[0].value === "9.8");
t("investigations mirror labs", e3.investigations.length === 2 && e3.investigations[0].testName === "Hb" && e3.investigations[0].result === "9.8");
t("labs text line", e3.investigationLabsOrdered === "Hb: 9.8, Creatinine: 1.4");

// delete all labs
const e4 = diffRowEdits(merged, "labs", labs.map(r => ({ ...r, del: true })));
t("delete all labs gives empty lists", e4.labs.length === 0 && e4.investigations.length === 0 && e4.investigationLabsOrdered === "");

// imaging
const e5 = diffRowEdits(merged, "imaging", [...getRows(merged, "imaging"), { cells: { name: "Chest X-ray", value: "Right lower zone opacity" } }]);
t("imaging line", e5.investigationImaging === "ECG: Sinus tachycardia, Chest X-ray: Right lower zone opacity");

// edits apply on top of merged, input untouched
const out = applyEdits(merged, [e1, e3]);
t("applied", out.treatmentGiven.length === 1 && out.labs[0].value === "9.8");
t("input untouched", merged.treatmentGiven.length === 2 && merged.labs[0].value === "11.2");

// discharge medication rows
const dm = diffRowEdits(merged, "dm", [{ cells: { name: "Tab. Cefixime", dose: "200 mg", freq: "BD x 5 days" } }]);
t("dm string", dm["dischargeInfoEdit.dischargeMedications"] === "Tab. Cefixime 200 mg BD x 5 days");
const withDm = applyEdits(merged, [dm]);
t("dm rows reload", getRows(withDm, "dm").length === 1 && getRows(withDm, "dm")[0].cells.freq === "BD x 5 days");
t("dm value reaches dischargeInfoEdit", withDm.dischargeInfoEdit.dischargeMedications.includes("Cefixime"));

// field list: rows are not duplicated as flat fields; discharge-only fields offered
const fields = editableFields(withDm);
t("no flat drug fields", !fields.some(f => /^(treatmentGiven|labs|imaging|investigations)\./.test(f.path)));
t("no flat med fields", !fields.some(f => f.path.startsWith("dischargeInfoEdit.medRows") || f.path === "dischargeInfoEdit.dischargeMedications"));
t("discharge-only fields offered", ["courseInHospital", "conditionAtDischarge", "followUpPlan", "patientInstructions"].every(k => fields.some(f => f.path === "dischargeInfoEdit." + k && f.group === "Discharge only")));
t("case fields still there", fields.some(f => f.path === "vitals.hr" && f.value === "96") && fields.some(f => f.path === "vitals.rr"));
t("row list defs", ROW_LISTS.length === 4 && ROW_LISTS.filter(d => d.tab === "discharge").length === 1);
t("splitEdits unaffected", Object.keys(splitEdits({ a: 1, __edits: { x: 1 } }).edits).length === 1);

console.log(fail === 0 ? "ALL PASS verify_edit_rows" : fail + " FAILED");
process.exit(fail ? 1 : 0);