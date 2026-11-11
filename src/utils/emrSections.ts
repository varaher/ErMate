/**
 * ErMate — "Copy to EMR, field by field" sections.
 *
 * Splits the SAVED case sheet into the separate boxes a hospital EMR template usually has
 * (Chief Complaints, HOPI, Past History, Vitals, Examination, Investigations, Diagnosis,
 * Treatment, Plan …) so each can be copied into its own EMR field.
 *
 * Rules (same as formatCaseSheetText):
 *  - Reads the SAME CaseSheetData the printed case sheet uses. Read-only: never writes the case.
 *  - Plain text only. No markdown, no HTML, no icons.
 *  - Nothing invented. Lines that would only say "Not documented" are LEFT OUT of a field
 *    copy (so the EMR box isn't filled with filler). A section with nothing recorded is
 *    shown as "Not documented" and has nothing to copy.
 */
import type { CaseSheetData } from "../components/CaseSheetPrintView";
import { formatAge } from "./ageLabel";

export type EmrSectionKey =
  | "patient" | "complaints" | "hopi" | "pastHistory" | "allergiesMeds" | "vitals" | "primarySurvey"
  | "examination" | "adjuncts" | "investigations" | "diagnosis" | "treatment" | "procedures"
  | "consults" | "plan" | "notes" | "pediatric" | "mlc";

export interface EmrSection {
  key: EmrSectionKey;
  /** Default label shown on the card (doctors can rename it in their layout). */
  title: string;
  /** Plain text to paste. "" = nothing recorded. */
  text: string;
}

/** All sections in default order, with the label most EMRs use. */
export const EMR_SECTION_CATALOG: Array<{ key: EmrSectionKey; title: string }> = [
  { key: "complaints", title: "Chief Complaints" },
  { key: "hopi", title: "History of Presenting Illness" },
  { key: "pastHistory", title: "Past History" },
  { key: "allergiesMeds", title: "Allergies & Medications" },
  { key: "vitals", title: "Vitals" },
  { key: "primarySurvey", title: "Primary Survey" },
  { key: "examination", title: "Examination" },
  { key: "adjuncts", title: "ECG / Bedside Tests" },
  { key: "investigations", title: "Investigations" },
  { key: "diagnosis", title: "Diagnosis" },
  { key: "treatment", title: "Treatment Given" },
  { key: "procedures", title: "Procedures" },
  { key: "consults", title: "Consultations" },
  { key: "plan", title: "Disposition & Plan" },
  { key: "notes", title: "Progress Notes" },
  { key: "pediatric", title: "Pediatric Assessment" },
  { key: "mlc", title: "Medico-Legal Details" },
  { key: "patient", title: "Patient Details" },
];

/** Default layout = the common structured-EMR order. */
export const DEFAULT_EMR_LAYOUT: EmrSectionKey[] = [
  "complaints", "hopi", "pastHistory", "allergiesMeds", "vitals", "examination",
  "investigations", "diagnosis", "treatment", "plan",
];

const has = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim().length > 0;
const s = (v: unknown): string => String(v ?? "").trim();
const join = (items?: Array<string | null | undefined> | null): string =>
  (items || []).map((x) => s(x)).filter(Boolean).join(", ");

/** "Label: value" only when the value exists. */
const line = (label: string, v: unknown): string => (has(v) ? `${label}: ${s(v)}` : "");
const lines = (arr: string[]): string => arr.filter((l) => l !== "").join("\n");

export function buildEmrSections(data: CaseSheetData): Record<EmrSectionKey, EmrSection> {
  const p = data.patient || ({} as any);
  const ps = data.primarySurvey || ({} as any);
  const vc = ps.vitalsContext || {};
  const ss = data.secondarySurvey || ({} as any);
  const d = data.pediatricDetails as any;
  const m = data.mlcDetails as any;
  const disp = data.disposition || ({} as any);

  const out = {} as Record<EmrSectionKey, EmrSection>;
  const put = (key: EmrSectionKey, text: string) => {
    const title = EMR_SECTION_CATALOG.find((c) => c.key === key)!.title;
    out[key] = { key, title, text: text.trim() };
  };

  put("patient", lines([
    line("Name", p.name),
    p.age !== null && p.age !== undefined && s(p.age) !== "" ? `Age / Sex: ${formatAge(p.age, p.ageMonths, p.ageDays)} ${s(p.sex)}`.trimEnd() : line("Sex", p.sex),
    has(p.weight) ? `Weight: ${s(p.weight)} kg` : "",
    line("UHID", p.uhid),
    line("Bed", p.bed),
    has(data.arrival?.date) || has(data.arrival?.time) ? `Arrival: ${`${s(data.arrival?.date)} ${s(data.arrival?.time)}`.trim()}` : "",
    line("Triage", data.triageCategory),
  ]));

  put("complaints", s(data.presentingComplaint));

  put("hopi", lines([
    s(data.hpi),
    has(data.events) && !s(data.hpi).includes(s(data.events)) ? `Events: ${s(data.events)}` : "",
    join(data.symptoms) ? `Associated symptoms: ${join(data.symptoms)}` : "",
  ]));

  put("pastHistory", lines([
    join(data.pastHistory) ? `Past history: ${join(data.pastHistory)}` : "",
    line("Surgical history", data.surgicalHistory),
    line("Family history", data.familyHistory),
    line("Last meal", data.lastMeal),
    line("LMP", data.lmp),
  ]));

  put("allergiesMeds", lines([
    join(data.allergies) ? `Allergies: ${join(data.allergies)}` : "",
    join(data.currentMedications) ? `Current medications: ${join(data.currentMedications)}` : "",
  ]));

  const vitals = [
    has(vc.hr) ? `HR ${s(vc.hr)}` : "",
    has(vc.bp) ? `BP ${s(vc.bp)}` : "",
    has(vc.rr) ? `RR ${s(vc.rr)}` : "",
    has(vc.spo2) ? `SpO2 ${s(vc.spo2)}` : "",
    has(vc.temp) ? `Temp ${s(vc.temp)}` : "",
    has(vc.gcsComponents || vc.gcs) ? `GCS ${s(vc.gcsComponents || vc.gcs)}` : "",
    has(vc.grbs) ? `GRBS ${s(vc.grbs)}` : "",
  ].filter(Boolean);
  put("vitals", vitals.join(" | "));

  put("primarySurvey", lines([
    line("Airway", ps.airway), line("Breathing", ps.breathing), line("Circulation", ps.circulation),
    line("Disability", ps.disability), line("Exposure", ps.exposure),
  ]));

  put("examination", lines([
    line("General", ss.general), line("CVS", ss.cvs), line("RS", ss.respiratory),
    line("Abdomen", ss.abdomen), line("CNS", ss.cns), line("Extremities", ss.extremities),
  ]));

  const adj: string[] = [];
  if (has(data.ecg?.findings)) adj.push(`ECG: ${s(data.ecg?.findings)}`);
  if (has(data.bedsideEcho?.findings)) adj.push(`Bedside Echo: ${s(data.bedsideEcho?.findings)}`);
  if (has(data.efast?.findings)) adj.push(`eFAST: ${s(data.efast?.findings)}`);
  if (data.vbgAbg?.performed) {
    const v = (data.vbgAbg.values || []).filter((x) => x.value !== null && x.value !== undefined).map((x) => `${x.name} ${x.value}`);
    if (v.length || has(data.vbgAbg.notes)) adj.push(`${data.vbgAbg.type || "Blood gas"}: ${[v.join(", "), has(data.vbgAbg.notes) ? `(${s(data.vbgAbg.notes)})` : ""].filter(Boolean).join(" ")}`);
  }
  put("adjuncts", lines(adj));

  const inv: string[] = [];
  (data.labs || []).forEach((panel) => {
    const v = (panel.values || []).filter((x) => x.value !== null && x.value !== undefined)
      .map((x) => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ""}`);
    if (v.length) inv.push(`${panel.panelName}: ${v.join(", ")}`);
  });
  (data.cultureResults || []).forEach((c) => { if (has(c.result)) inv.push(`${c.name}: ${s(c.result)}`); });
  if (has(data.investigationLabsOrdered)) inv.push(`Ordered: ${s(data.investigationLabsOrdered)}`);
  if (has(data.investigationImaging)) inv.push(`Imaging: ${s(data.investigationImaging)}`);
  if (has(data.investigationResultsSummary)) inv.push(`Results: ${s(data.investigationResultsSummary)}`);
  put("investigations", lines(inv));

  const dx: string[] = [];
  if (has(data.provisionalDiagnosis)) dx.push(`Provisional diagnosis: ${s(data.provisionalDiagnosis)}`);
  if (data.differentials?.length) dx.push(`Differentials: ${data.differentials.map((x) => `${x.diagnosis}${x.status ? ` (${x.status})` : ""}`).join("; ")}`);
  else if (has(data.provisionalDifferentialDiagnoses)) dx.push(`Differentials: ${s(data.provisionalDifferentialDiagnoses)}`);
  put("diagnosis", lines(dx));

  const tx: string[] = (data.treatmentGiven || []).filter(has).map((t, i) => `${i + 1}. ${s(t)}`);
  if (has(data.treatmentNotes)) tx.push(`Notes: ${s(data.treatmentNotes)}`);
  if (has(data.treatment?.otherNotes)) tx.push(`Other: ${s(data.treatment?.otherNotes)}`);
  put("treatment", lines(tx));

  const proc: string[] = [];
  (data.procedures?.procedureNotes || []).forEach((n: any) => {
    const when = [n?.metadata?.date, n?.metadata?.time].filter(Boolean).join(" ");
    proc.push(`${n?.procedureName || "Procedure"}${when ? ` (${when})` : ""}${n?.generatedNarrative ? `: ${n.generatedNarrative}` : ""}`);
  });
  if (data.procedures?.proceduresChecked?.length) proc.push(data.procedures.proceduresChecked.join(", "));
  if (has(data.procedures?.otherProcedures)) proc.push(`Other: ${s(data.procedures.otherProcedures)}`);
  put("procedures", lines(proc));

  const cons: string[] = [];
  if (data.consultation?.consultsRequested?.length) cons.push(`Requested: ${data.consultation.consultsRequested.join(", ")}`);
  const r = data.consultation?.consultantReview;
  if (r && has(r.reviewText)) cons.push(`Review${has(r.reviewedBy) ? ` by ${s(r.reviewedBy)}` : ""}${has(r.timestamp) ? ` (${s(r.timestamp)})` : ""}: ${s(r.reviewText)}`);
  put("consults", lines(cons));

  put("plan", lines([
    line("Disposition", disp.status), line("Destination", disp.destinationUnit),
    line("Condition", disp.conditionAtShift), line("Plan", disp.managementPlan),
    line("Follow-up", disp.followUpAdvice),
  ]));

  put("notes", lines([s(data.notes?.progressNotes), has(data.notes?.addendum) ? `Addendum: ${s(data.notes?.addendum)}` : ""]));

  put("pediatric", data.isPediatric && d ? lines([
    has(d.weight) ? `Weight: ${s(d.weight)} kg` : "",
    [d.patAppearanceTone, d.patAppearanceInteractivity, d.patAppearanceConsolability, d.patAppearanceLookGaze, d.patAppearanceSpeechCry].some(has)
      ? `PAT Appearance: ${[["Tone", d.patAppearanceTone], ["Interactivity", d.patAppearanceInteractivity], ["Consolability", d.patAppearanceConsolability], ["Look/Gaze", d.patAppearanceLookGaze], ["Speech/Cry", d.patAppearanceSpeechCry]].filter(([, v]) => has(v)).map(([k, v]) => `${k} ${s(v)}`).join("; ")}` : "",
    line("PAT Work of breathing", d.patWorkOfBreathing),
    line("PAT Circulation to skin", d.patCirculation),
    line("Birth history", d.birthHistory), line("Feeding history", d.feedingHistory),
    line("Developmental history", d.developmentalHistory), line("Immunization", d.immunizationHistory),
  ]) : "");

  put("mlc", (data.isMlc || m) ? lines([
    line("Nature of incident", m?.natureOfIncident), line("Date & time of incident", m?.dateTimeOfIncident),
    line("Place of incident", m?.placeOfIncident), line("Identification mark", m?.identificationMark),
    line("Brought by / informant", m?.informantBroughtBy), line("Police station", m?.policeStation),
  ]) : "");

  return out;
}

/* ── Doctor's EMR layout (per device) ─────────────────────────── */

export interface EmrLayoutItem {
  key: EmrSectionKey;
  /** Label as in the doctor's hospital EMR (optional rename). */
  label?: string;
}

const LAYOUT_KEY = "ermate_emr_layout_v1";

export function loadEmrLayout(): EmrLayoutItem[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const valid = new Set(EMR_SECTION_CATALOG.map((c) => c.key));
      const items = (Array.isArray(parsed) ? parsed : [])
        .filter((x: any) => x && valid.has(x.key))
        .map((x: any) => ({ key: x.key as EmrSectionKey, label: typeof x.label === "string" ? x.label.slice(0, 40) : undefined }));
      if (items.length) return items;
    }
  } catch { /* storage unavailable → default */ }
  return DEFAULT_EMR_LAYOUT.map((key) => ({ key }));
}

export function saveEmrLayout(items: EmrLayoutItem[]): void {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(items)); } catch { /* best-effort */ }
}

export function resetEmrLayout(): EmrLayoutItem[] {
  try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
  return DEFAULT_EMR_LAYOUT.map((key) => ({ key }));
}