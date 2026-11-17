// Edit what was dictated before it goes to the case sheet preview.
// Edits are kept as a small path -> value map inside the dictation's own extraction data (key "__edits"),
// applied on top of the merged dictation, so a later dictation never silently undoes a doctor's correction.

export const EDITS_KEY = "__edits";

export type EditKind = "text" | "long" | "number" | "bool" | "list";
export interface EditableField {
  path: string;
  label: string;
  group: string;
  kind: EditKind;
  value: string;
  edited?: boolean;
}

const HIDDEN_TOP = new Set([
  "isPediatric", "controlledPatches", "userConfirmationSummary", "intent",
  "clinicianUpdates", "clinicianUpdateText", EDITS_KEY,
  // Edited as rows (see ROW_LISTS), or derived from those rows.
  "treatmentGiven", "treatments", "labs", "investigations", "imaging", "investigationLabsOrdered", "investigationImaging",
]);
const HIDDEN_PATHS = new Set(["dischargeInfoEdit.medRows", "dischargeInfoEdit.dischargeMedications"]);
const HIDDEN_LEAF = new Set(["mlcConfirmedByClinician", "possibleMlc", "id", "timestamp"]);

// Fields a doctor may want to ADD even when nothing was dictated for them.
export const ADDABLE_FIELDS: { path: string; label: string; group: string; kind: EditKind }[] = [
  { path: "vitals.hr", label: "HR", group: "Vitals", kind: "text" },
  { path: "vitals.bp", label: "BP", group: "Vitals", kind: "text" },
  { path: "vitals.rr", label: "RR", group: "Vitals", kind: "text" },
  { path: "vitals.spo2", label: "SpO2", group: "Vitals", kind: "text" },
  { path: "vitals.temp", label: "Temp", group: "Vitals", kind: "text" },
  { path: "vitals.gcs", label: "GCS total", group: "Vitals", kind: "text" },
  { path: "vitals.gcs_e", label: "GCS eye (E)", group: "Vitals", kind: "text" },
  { path: "vitals.gcs_v", label: "GCS verbal (V)", group: "Vitals", kind: "text" },
  { path: "vitals.gcs_m", label: "GCS motor (M)", group: "Vitals", kind: "text" },
  { path: "vitals.grbs", label: "GRBS", group: "Vitals", kind: "text" },
  { path: "airway", label: "Airway", group: "Primary assessment", kind: "long" },
  { path: "breathing", label: "Breathing", group: "Primary assessment", kind: "long" },
  { path: "circulation", label: "Circulation", group: "Primary assessment", kind: "long" },
  { path: "disability", label: "Disability", group: "Primary assessment", kind: "long" },
  { path: "exposure", label: "Exposure", group: "Primary assessment", kind: "long" },
  { path: "secondarySurvey.general", label: "General exam", group: "Secondary survey", kind: "long" },
  { path: "secondarySurvey.cvs", label: "CVS", group: "Secondary survey", kind: "long" },
  { path: "secondarySurvey.respiratory", label: "Chest / RS", group: "Secondary survey", kind: "long" },
  { path: "secondarySurvey.abdomen", label: "Abdomen", group: "Secondary survey", kind: "long" },
  { path: "secondarySurvey.cns", label: "CNS", group: "Secondary survey", kind: "long" },
  { path: "secondarySurvey.extremities", label: "Extremities", group: "Secondary survey", kind: "long" },
  { path: "presentingComplaint", label: "Presenting complaint", group: "History", kind: "long" },
  { path: "hpi", label: "HPI", group: "History", kind: "long" },
  { path: "diagnosis", label: "Diagnosis", group: "Assessment", kind: "long" },
  { path: "differentialDiagnosis", label: "Differentials", group: "Assessment", kind: "long" },
  { path: "disposition", label: "Disposition", group: "Assessment", kind: "long" },
  // Not dictated. Filled here, they go into the discharge summary preview.
  { path: "dischargeInfoEdit.courseInHospital", label: "Course in hospital", group: "Discharge only", kind: "long" },
  { path: "dischargeInfoEdit.conditionAtDischarge", label: "Condition at discharge", group: "Discharge only", kind: "text" },
  { path: "dischargeInfoEdit.followUpPlan", label: "Follow-up", group: "Discharge only", kind: "long" },
  { path: "dischargeInfoEdit.patientInstructions", label: "Advice and red flags", group: "Discharge only", kind: "long" },
];

// Offered only for children (age 16 or under). These are the paediatric case sheet's own fields.
export const PEDIATRIC_ADDABLE_FIELDS: { path: string; label: string; group: string; kind: EditKind }[] = [
  { path: "pediatricDetails.weight", label: "Weight (kg)", group: "Child", kind: "text" },
  { path: "pediatricDetails.patAppearanceTone", label: "Appearance: tone", group: "Child", kind: "text" },
  { path: "pediatricDetails.patAppearanceInteractivity", label: "Appearance: interactivity", group: "Child", kind: "text" },
  { path: "pediatricDetails.patAppearanceConsolability", label: "Appearance: consolability", group: "Child", kind: "text" },
  { path: "pediatricDetails.patAppearanceLookGaze", label: "Appearance: look / gaze", group: "Child", kind: "text" },
  { path: "pediatricDetails.patAppearanceSpeechCry", label: "Appearance: speech / cry", group: "Child", kind: "text" },
  { path: "pediatricDetails.airwayStatus", label: "Airway status", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.airwayCry", label: "Airway: cry", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.breathingWob", label: "Work of breathing", group: "Child primary assessment", kind: "long" },
  { path: "pediatricDetails.breathingAirEntry", label: "Air entry", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.circulationCrt", label: "CRT", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.circulationSkinColorTemp", label: "Skin colour / temp", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.disabilityAvpuGcs", label: "AVPU / GCS", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.disabilityPupils", label: "Pupils", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.exposureSignsOfTrauma", label: "Signs of trauma", group: "Child primary assessment", kind: "text" },
  { path: "pediatricDetails.birthHistory", label: "Birth history", group: "Child history", kind: "long" },
  { path: "pediatricDetails.feedingHistory", label: "Feeding history", group: "Child history", kind: "long" },
  { path: "pediatricDetails.immunizationHistory", label: "Immunisation", group: "Child history", kind: "long" },
  { path: "pediatricDetails.developmentalHistory", label: "Development", group: "Child history", kind: "long" },
];

const GROUPS: Record<string, string> = {
  dischargeInfoEdit: "Discharge only",
  pediatricDetails: "Child",
  vitals: "Vitals", airway: "Primary assessment", breathing: "Primary assessment", circulation: "Primary assessment",
  disability: "Primary assessment", exposure: "Primary assessment", primaryAssessment: "Primary assessment",
  secondarySurvey: "Secondary survey", secondaryAssessment: "Secondary survey",
  generalExamination: "Secondary survey", cvsExamination: "Secondary survey", respiratoryExamination: "Secondary survey",
  abdomenExamination: "Secondary survey", cnsExamination: "Secondary survey", extremitiesExamination: "Secondary survey",
  presentingComplaint: "History", hpi: "History", sampleHistory: "History", pastMedicalHistory: "History",
  allergies: "History", currentMedications: "History", events: "History", symptoms: "History",
  diagnosis: "Assessment", differentialDiagnosis: "Assessment", disposition: "Assessment",
  treatmentGiven: "Treatment", drugs: "Treatment", procedures: "Treatment", plan: "Treatment",
  investigations: "Investigations", labs: "Investigations", imaging: "Investigations", vbgAbg: "Investigations",
  patientName: "Patient", age: "Patient", gender: "Patient", bedNo: "Patient",
};

export function labelFor(key: string): string {
  const k = key.replace(/_/g, " ");
  const spaced = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function splitEdits(data: any): { data: any; edits: Record<string, any> } {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { data, edits: {} };
  const { [EDITS_KEY]: e, ...rest } = data as any;
  return { data: rest, edits: e && typeof e === "object" && !Array.isArray(e) ? e : {} };
}

const isPlain = (v: any) => v !== null && typeof v === "object" && !Array.isArray(v);

export function getPath(obj: any, path: string): any {
  let cur = obj;
  for (const p of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

// Returns a changed copy; the input is never touched.
export function setPath(obj: any, path: string, value: any): any {
  const parts = path.split(".");
  const root: any = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) { cur[p] = value; break; }
    const next = cur[p];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    const copy = Array.isArray(next) ? [...next] : isPlain(next) ? { ...next } : (nextIsIndex ? [] : {});
    cur[p] = copy;
    cur = copy;
  }
  return root;
}

export function applyEdits(merged: any, editsList: Record<string, any>[]): any {
  let out = merged || {};
  for (const edits of editsList) {
    for (const [path, value] of Object.entries(edits || {})) out = setPath(out, path, value);
  }
  return out;
}

const emptyish = (v: any) => v === null || v === undefined || v === "";

function pushField(out: EditableField[], path: string, top: string, label0: string, v: any) {
  if (emptyish(v)) return;
  const known = ADDABLE_FIELDS.find(a => a.path === path);
  const label = known ? known.label : label0;
  if (Array.isArray(v) && v.every(x => typeof x === "string")) {
    if (v.length === 0) return;
    out.push({ path, label, group: GROUPS[top] || "Other", kind: "list", value: v.join("\n") });
    return;
  }
  if (typeof v === "boolean") { out.push({ path, label, group: GROUPS[top] || "Other", kind: "bool", value: String(v) }); return; }
  if (typeof v === "number") { out.push({ path, label, group: GROUPS[top] || "Other", kind: "number", value: String(v) }); return; }
  if (typeof v === "string") {
    out.push({ path, label, group: GROUPS[top] || "Other", kind: v.length > 60 || v.includes("\n") ? "long" : "text", value: v });
  }
}

function walk(out: EditableField[], node: any, path: string, top: string, label: string, depth: number) {
  if (emptyish(node)) return;
  if (HIDDEN_PATHS.has(path)) return;
  if (Array.isArray(node) && !node.every(x => typeof x === "string")) {
    if (depth >= 3) return;
    node.forEach((item, i) => walk(out, item, `${path}.${i}`, top, `${label} ${i + 1}`, depth + 1));
    return;
  }
  if (isPlain(node)) {
    if (depth >= 3) return;
    for (const [k, v] of Object.entries(node)) {
      if (HIDDEN_LEAF.has(k)) continue;
      walk(out, v, `${path}.${k}`, top, depth === 0 ? labelFor(k) : `${label} ${labelFor(k)}`, depth + 1);
    }
    return;
  }
  pushField(out, path, top, label, node);
}

// Every value the doctor can change: what was captured, then the usual fields that were not dictated.
export function isChildCapture(merged: any, caseAge?: any): boolean {
  const toAge = (x: any) => { const n = parseFloat(String(x ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : null; };
  if (merged && merged.isPediatric === true) return true;
  const a = toAge(merged?.age) ?? toAge(caseAge);
  return a !== null && a <= 16;
}

export function editableFields(merged: any, opts?: { pediatric?: boolean }): EditableField[] {
  const out: EditableField[] = [];
  const data = splitEdits(merged).data || {};
  for (const [k, v] of Object.entries(data)) {
    if (HIDDEN_TOP.has(k)) continue;
    walk(out, v, k, k, labelFor(k), 0);
  }
  const have = new Set(out.map(f => f.path));
  const offered = opts?.pediatric ? [...ADDABLE_FIELDS, ...PEDIATRIC_ADDABLE_FIELDS] : ADDABLE_FIELDS;
  for (const a of offered) {
    if (have.has(a.path)) continue;
    const cur = getPath(data, a.path);
    if (!emptyish(cur) && typeof cur === "string") continue;
    out.push({ path: a.path, label: a.label, group: a.group, kind: a.kind, value: "" });
  }
  return out;
}

// Turn the text the doctor typed back into the same kind of value the field had.
export function parseEditedValue(kind: EditKind, text: string): any {
  const t = text.replace(/\r/g, "");
  if (kind === "list") return t.split("\n").map(s => s.trim()).filter(Boolean);
  if (kind === "bool") return t.trim().toLowerCase() === "true";
  if (kind === "number") {
    const n = Number(t.trim());
    return t.trim() !== "" && Number.isFinite(n) ? n : t.trim();
  }
  return t.trim();
}

// Only the rows the doctor actually changed.
export function diffEdits(fields: EditableField[], draft: Record<string, string>): Record<string, any> {
  const edits: Record<string, any> = {};
  for (const f of fields) {
    const d = draft[f.path];
    if (d === undefined || d === f.value) continue;
    edits[f.path] = parseEditedValue(f.kind, d);
  }
  return edits;
}

export function collectEditedPaths(editsList: Record<string, any>[]): Set<string> {
  const s = new Set<string>();
  for (const e of editsList) for (const k of Object.keys(e || {})) s.add(k);
  return s;
}

// ---- Rows: drugs, labs, imaging / other tests, discharge medications ----
export interface EditRow { cells: Record<string, string>; src?: any; del?: boolean }
export interface RowListDef {
  id: "drugs" | "labs" | "imaging" | "dm";
  tab: "case" | "discharge";
  label: string;
  addLabel: string;
  cols: { key: string; label: string }[];
}
export const ROW_LISTS: RowListDef[] = [
  { id: "drugs", tab: "case", label: "Drugs given", addLabel: "Add drug", cols: [{ key: "drugName", label: "Drug" }, { key: "dose", label: "Dose" }, { key: "route", label: "Route" }] },
  { id: "labs", tab: "case", label: "Labs", addLabel: "Add lab", cols: [{ key: "name", label: "Test" }, { key: "value", label: "Result" }] },
  { id: "imaging", tab: "case", label: "Imaging and other tests", addLabel: "Add test", cols: [{ key: "name", label: "Test" }, { key: "value", label: "Result" }] },
  { id: "dm", tab: "discharge", label: "Discharge medications", addLabel: "Add medication", cols: [{ key: "name", label: "Medication" }, { key: "dose", label: "Dose" }, { key: "freq", label: "Frequency" }] },
];

const str = (v: any) => (v === null || v === undefined ? "" : String(v));

export function getRows(merged: any, id: RowListDef["id"]): EditRow[] {
  const data = splitEdits(merged).data || {};
  const list = (path: string): any[] => { const a = getPath(data, path); return Array.isArray(a) ? a : []; };
  if (id === "drugs") {
    return list("treatmentGiven").map(it => typeof it === "string"
      ? { cells: { drugName: it, dose: "", route: "" } }
      : { cells: { drugName: str(it?.drugName ?? it?.name), dose: str(it?.dose), route: str(it?.route) }, src: it });
  }
  if (id === "labs" || id === "imaging") {
    return list(id).map(it => typeof it === "string"
      ? { cells: { name: it, value: "" } }
      : { cells: { name: str(it?.name ?? it?.testName), value: str(it?.value ?? it?.result) }, src: it });
  }
  return list("dischargeInfoEdit.medRows").map(it => ({ cells: { name: str(it?.name), dose: str(it?.dose), freq: str(it?.freq) }, src: it }));
}

const keptRows = (def: RowListDef, rows: EditRow[]) =>
  rows.filter(r => !r.del && def.cols.some(c => str(r.cells[c.key]).trim()));
const cellsOf = (def: RowListDef, rows: EditRow[]) =>
  keptRows(def, rows).map(r => def.cols.map(c => str(r.cells[c.key]).trim()));

// Edits for one list, or {} when the doctor changed nothing. Whole lists are replaced so adds and deletes both work.
export function diffRowEdits(merged: any, id: RowListDef["id"], rows: EditRow[]): Record<string, any> {
  const def = ROW_LISTS.find(d => d.id === id)!;
  if (JSON.stringify(cellsOf(def, rows)) === JSON.stringify(cellsOf(def, getRows(merged, id)))) return {};
  const items = keptRows(def, rows).map(r => {
    const base = r.src && typeof r.src === "object" ? { ...r.src } : {};
    for (const c of def.cols) base[c.key] = str(r.cells[c.key]).trim();
    return base;
  });
  const line = (x: any) => (x.value ? `${x.name}: ${x.value}` : x.name);
  if (id === "drugs") return { treatmentGiven: items };
  if (id === "labs") {
    return {
      labs: items,
      investigations: items.map((l, i) => ({ id: `inv-edit-${i}`, testName: l.name, result: l.value || "Ordered", isAbnormal: false })),
      investigationLabsOrdered: items.map(line).join(", "),
    };
  }
  if (id === "imaging") return { imaging: items, investigationImaging: items.map(line).join(", ") };
  return {
    "dischargeInfoEdit.medRows": items,
    "dischargeInfoEdit.dischargeMedications": items.map(m => [m.name, m.dose, m.freq].filter(Boolean).join(" ")).join("\n"),
  };
}