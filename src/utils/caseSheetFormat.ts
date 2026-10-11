/**
 * src/utils/caseSheetFormat.ts
 *
 * ONE canonical Case Sheet -> plain text formatter for "Copy Case Sheet".
 *
 * It reads the SAME CaseSheetData that CaseSheetPrintView renders, so what the
 * clinician sees and what they paste into the hospital EMR/HIS are the same.
 *
 * Rules:
 * - Plain text only: no markdown (**), no HTML, no icons, no UI labels.
 * - UPPERCASE section headings, "Label: value" lines, blank line between sections.
 * - Missing values are written as "Not documented". Nothing is invented:
 *   no default "normal" findings, no assumed negatives.
 * - Adult and pediatric both supported (pediatric block only when isPediatric).
 */
import type { CaseSheetData } from "../components/CaseSheetPrintView";

const ND = "Not documented";

function val(v: unknown): string {
  if (v === null || v === undefined) return ND;
  const s = String(v).trim();
  return s ? s : ND;
}

function list(items: Array<string | null | undefined> | undefined | null): string {
  const clean = (items || []).map((x) => (x == null ? "" : String(x).trim())).filter(Boolean);
  return clean.length ? clean.join(", ") : ND;
}

function hasText(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim().length > 0;
}

export function formatCaseSheetText(data: CaseSheetData): string {
  const out: string[] = [];
  const section = (title: string, lines: string[]) => {
    const body = lines.filter((l) => l !== "");
    if (body.length === 0) return;
    out.push(title.toUpperCase());
    out.push(...body);
    out.push("");
  };

  // Header
  out.push(`${(data.hospitalName || "").trim() || "Hospital not set"}`);
  out.push(`EMERGENCY DEPARTMENT — CASE SHEET${data.isPediatric ? " (PEDIATRIC)" : ""}${data.isMlc ? " - MLC" : ""}`);
  out.push(`Case ID: ${val(data.caseId)}`);
  out.push("");

  // Patient
  const p = data.patient;
  section("Patient Details", [
    `Name: ${val(p.name)}`,
    `Age / Sex: ${p.age !== null && p.age !== undefined ? `${p.age}y` : ND} ${p.sex || ""}`.trimEnd(),
    `UHID: ${val(p.uhid)}`,
    `Bed: ${val(p.bed)}`,
    `Arrival: ${hasText(data.arrival?.date) || hasText(data.arrival?.time) ? `${data.arrival?.date || ""} ${data.arrival?.time || ""}`.trim() : ND}`,
    `Treating Clinician: ${val(data.clinician)}`,
    hasText(data.triageCategory) ? `Triage: ${data.triageCategory}` : "",
    hasText(data.caseType) ? `Case Type: ${data.caseType}` : "",
  ]);

  // MLC
  if (data.isMlc || data.mlcDetails) {
    const m = data.mlcDetails;
    section("Medico-Legal Case Details", [
      `Nature of incident: ${val(m?.natureOfIncident)}`,
      `Date & time of incident: ${val(m?.dateTimeOfIncident)}`,
      `Place of incident: ${val(m?.placeOfIncident)}`,
      `Identification mark: ${val(m?.identificationMark)}`,
      `Brought by / informant: ${val(m?.informantBroughtBy)}`,
      hasText(m?.policeStation) ? `Police station: ${m?.policeStation}` : "",
    ]);
  }

  section("Presenting Complaint", [val(data.presentingComplaint)]);

  // Pediatric
  if (data.isPediatric && data.pediatricDetails) {
    const d = data.pediatricDetails;
    section("Pediatric Assessment (PAT)", [
      `Weight: ${hasText(d.weight) ? `${d.weight} kg` : ND}`,
      `PAT Appearance: Tone ${val(d.patAppearanceTone)}; Interactivity ${val(d.patAppearanceInteractivity)}; Consolability ${val(d.patAppearanceConsolability)}; Look/Gaze ${val(d.patAppearanceLookGaze)}; Speech/Cry ${val(d.patAppearanceSpeechCry)}`,
      `PAT Work of Breathing: ${val(d.patWorkOfBreathing)}`,
      `PAT Circulation to Skin: ${val(d.patCirculation)}`,
      hasText(d.birthHistory) ? `Birth History: ${d.birthHistory}` : "",
      hasText(d.feedingHistory) ? `Feeding History: ${d.feedingHistory}` : "",
      hasText(d.developmentalHistory) ? `Developmental History: ${d.developmentalHistory}` : "",
      `Immunization History: ${val(d.immunizationHistory)}`,
      hasText(d.broughtBy) ? `Brought By: ${d.broughtBy}` : "",
      hasText(d.informant) ? `Informant: ${d.informant}` : "",
    ]);
  }

  // Primary survey + vitals
  const ps = data.primarySurvey;
  const vc = ps?.vitalsContext || {};
  section("Primary Survey (ABCDE)", [
    `A — Airway: ${val(ps?.airway)}`,
    `B — Breathing: ${val(ps?.breathing)}`,
    `C — Circulation: ${val(ps?.circulation)}`,
    `D — Disability: ${val(ps?.disability)}`,
    `E — Exposure: ${val(ps?.exposure)}`,
  ]);
  section("Vitals", [
    `HR: ${val(vc.hr)} | BP: ${val(vc.bp)} | RR: ${val(vc.rr)} | SpO2: ${val(vc.spo2)} | Temp: ${val(vc.temp)} | GCS: ${val(vc.gcsComponents || vc.gcs)} | GRBS: ${val(vc.grbs)}`,
  ]);

  // Adjuncts (only those performed / documented)
  const adj: string[] = [];
  if (data.ecg?.performed || hasText(data.ecg?.findings)) adj.push(`ECG: ${val(data.ecg?.findings)}`);
  if (data.bedsideEcho?.performed || hasText(data.bedsideEcho?.findings)) adj.push(`Bedside Echo: ${val(data.bedsideEcho?.findings)}`);
  if (data.efast?.performed || hasText(data.efast?.findings)) adj.push(`eFAST: ${val(data.efast?.findings)}`);
  if (data.vbgAbg?.performed) {
    const vals = (data.vbgAbg.values || []).filter((x) => x.value !== null && x.value !== undefined).map((x) => `${x.name} ${x.value}`);
    adj.push(`${data.vbgAbg.type || "Blood gas"}: ${vals.length ? vals.join(", ") : ND}${hasText(data.vbgAbg.notes) ? ` (${data.vbgAbg.notes})` : ""}`);
  }
  section("Adjuncts", adj);

  // SAMPLE
  section("SAMPLE History", [
    `S — Signs & Symptoms: ${list(data.symptoms)}`,
    `A — Allergies: ${list(data.allergies)}`,
    `M — Medications: ${list(data.currentMedications)}`,
    `P — Past History: ${list(data.pastHistory)}`,
    `L — Last Meal: ${val(data.lastMeal)}`,
    `E — Events: ${val(data.events)}`,
    hasText(data.familyHistory) ? `Family History: ${data.familyHistory}` : "",
  ]);

  // Diagnosis (adult: after examination; pediatric: after treatment — same order as the on-screen sheet)
  const writeDiagnosis = () => {
    const dx: string[] = [`Provisional Diagnosis: ${val(data.provisionalDiagnosis)}`];
    if (data.differentials?.length) {
      dx.push(`Differentials: ${data.differentials.map((d) => `${d.diagnosis}${d.status ? ` (${d.status})` : ""}`).join("; ")}`);
    } else if (hasText(data.provisionalDifferentialDiagnoses)) {
      dx.push(`Differentials: ${data.provisionalDifferentialDiagnoses}`);
    }
    section("Diagnosis", dx);
  };

  // Examination
  const ss = data.secondarySurvey;
  section(data.isPediatric ? "Focused Physical Examination" : "Secondary Survey / Systemic Examination", [
    `General: ${val(ss?.general)}`,
    `CVS: ${val(ss?.cvs)}`,
    `RS: ${val(ss?.respiratory)}`,
    `Abdomen: ${val(ss?.abdomen)}`,
    `CNS: ${val(ss?.cns)}`,
    `Extremities: ${val(ss?.extremities)}`,
  ]);

  if (!data.isPediatric) writeDiagnosis();

  // Investigations
  const inv: string[] = [];
  (data.labs || []).forEach((panel) => {
    const vals = (panel.values || []).filter((x) => x.value !== null && x.value !== undefined)
      .map((x) => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ""}`);
    if (vals.length) inv.push(`${panel.panelName}: ${vals.join(", ")}`);
  });
  (data.cultureResults || []).forEach((c) => inv.push(`${c.name}: ${val(c.result)}`));
  if (hasText(data.investigationLabsOrdered)) inv.push(`Ordered: ${data.investigationLabsOrdered}`);
  if (hasText(data.investigationImaging)) inv.push(`Imaging: ${data.investigationImaging}`);
  if (hasText(data.investigationResultsSummary)) inv.push(`Results: ${data.investigationResultsSummary}`);
  section("Investigations", inv.length ? inv : [ND]);

  // Treatment
  const tx: string[] = (data.treatmentGiven || []).map((t, i) => `${i + 1}. ${t}`);
  if (hasText(data.treatmentNotes)) tx.push(`Notes: ${data.treatmentNotes}`);
  if (hasText(data.treatment?.otherNotes)) tx.push(`Other: ${data.treatment?.otherNotes}`);
  section("Treatment Given", tx.length ? tx : [ND]);

  if (data.isPediatric) writeDiagnosis();

  // Procedures (only if any documented)
  const proc: string[] = [];
  (data.procedures?.procedureNotes || []).forEach((note: any) => {
    const when = [note?.metadata?.date, note?.metadata?.time].filter(Boolean).join(" ");
    proc.push(`${note?.procedureName || "Procedure"}${when ? ` (${when})` : ""}${note?.generatedNarrative ? `: ${note.generatedNarrative}` : ""}`);
  });
  if (data.procedures?.proceduresChecked?.length) proc.push(data.procedures.proceduresChecked.join(", "));
  if (hasText(data.procedures?.otherProcedures)) proc.push(`Other: ${data.procedures.otherProcedures}`);
  section("Procedures", proc);

  // Consults
  const consults: string[] = [];
  if (data.consultation?.consultsRequested?.length) consults.push(`Requested: ${data.consultation.consultsRequested.join(", ")}`);
  if (data.consultation?.consultantReview) {
    const r = data.consultation.consultantReview;
    consults.push(`Review by ${val(r.reviewedBy)}${hasText(r.timestamp) ? ` (${r.timestamp})` : ""}: ${val(r.reviewText)}`);
  }
  section("Consultations", consults);

  // Disposition
  const disp = data.disposition;
  section("Disposition", [
    `Disposition: ${val(disp?.status)}`,
    hasText(disp?.destinationUnit) ? `Destination: ${disp?.destinationUnit}` : "",
    hasText(disp?.conditionAtShift) ? `Condition at shift: ${disp?.conditionAtShift}` : "",
    hasText(disp?.durationInEr) ? `Duration in ER: ${disp?.durationInEr}` : "",
    hasText(disp?.managementPlan) ? `Plan: ${disp?.managementPlan}` : "",
    hasText(disp?.followUpAdvice) ? `Follow-up: ${disp?.followUpAdvice}` : "",
  ]);

  // Notes
  section("Progress Notes", hasText(data.notes?.progressNotes) ? [String(data.notes.progressNotes).trim()] : []);
  section("Addendum", hasText(data.notes?.addendum) ? [String(data.notes.addendum).trim()] : []);

  // Signature
  const sig = (data as any).signatureBlock || {};
  section("Clinicians", [
    `EM Resident / Treating Doctor: ${val(sig.clinicianName)}`,
    `EM Consultant: ${val(sig.consultantName)}`,
  ]);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
