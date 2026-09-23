/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discharge Summary Synchronization Engine
 * Pure functional helpers to derive initial discharge summary fields from ClinicalCase,
 * intelligently merge latest case updates into an active discharge draft without clobbering manual edits,
 * and avoid duplicate paragraphs or redundant bullet points.
 */

import { ClinicalCase, DischargeInfo } from "../types";

/**
 * Format primary assessment findings into a concise narrative string
 */
export function formatPrimaryAssessmentForCourse(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.primaryAssessment) {
    const pa = c.primaryAssessment;
    if (pa.airway || pa.airwayStatus) {
      parts.push(`Airway: ${pa.airway || pa.airwayStatus}`);
    }
    if (pa.breathing || pa.breathingStatus) {
      parts.push(`Breathing: ${pa.breathing || pa.breathingStatus}`);
    }
    if (pa.circulation || pa.circulationStatus) {
      parts.push(`Circulation: ${pa.circulation || pa.circulationStatus}`);
    }
    if (pa.disability || pa.disabilityStatus) {
      parts.push(`Disability: ${pa.disability || pa.disabilityStatus}`);
    }
    if (pa.exposure || pa.exposureStatus) {
      parts.push(`Exposure: ${pa.exposure || pa.exposureStatus}`);
    }
  }
  return parts.join("; ");
}

/**
 * Format procedures checked and other procedures into readable text
 */
export function formatProceduresText(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.proceduresChecked && c.proceduresChecked.length > 0) {
    const readable = c.proceduresChecked.map(p => {
      if (p === "foleys") return "Foley's Catheterization";
      if (p === "ng_tube") return "Nasogastric (NG) Tube";
      if (p === "iv_cannula") return "IV Cannulation";
      if (p === "intubation") return "Endotracheal Intubation";
      if (p === "central_line") return "Central Venous Line";
      if (p === "suturing") return "Wound Suturing";
      if (p === "splint") return "Splinting / Immobilization";
      if (p === "nebulization") return "Nebulization";
      return p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    });
    parts.push(`Procedures performed: ${readable.join(", ")}.`);
  }
  if (c.otherProcedures && c.otherProcedures.trim()) {
    parts.push(c.otherProcedures.trim());
  }
  return parts.join(" ");
}

/**
 * Format consultations requested or reviewed into readable text
 */
export function formatConsultationsText(c: ClinicalCase): string {
  const parts: string[] = [];
  const consults = c.dispositionAndPlan?.consultsRequested || [];
  if (consults.length > 0) {
    parts.push(`Specialist consultations requested: ${consults.join(", ")}.`);
  }
  if (c.consultantReview?.reviewText) {
    const by = c.consultantReview.reviewedBy ? ` (${c.consultantReview.reviewedBy})` : "";
    parts.push(`Consultant Review${by}: ${c.consultantReview.reviewText}`);
  }
  return parts.join(" ");
}

/**
 * Format bedside adjuncts (ECG, eFAST/POCUS, ABG/VBG)
 */
export function formatBedsideAdjunctsText(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.adjuncts?.ecgDetails || c.primaryAssessment?.circulation) {
    if (c.adjuncts?.ecgDetails && c.adjuncts.ecgDetails.trim()) {
      parts.push(`ECG: ${c.adjuncts.ecgDetails.trim()}`);
    }
  }
  if (c.adjuncts?.efastNotes && c.adjuncts.efastNotes.trim()) {
    parts.push(`eFAST/POCUS: ${c.adjuncts.efastNotes.trim()}`);
  }
  if (c.adjuncts?.abgDetails && c.adjuncts.abgDetails.trim()) {
    parts.push(`Blood Gas (ABG/VBG): ${c.adjuncts.abgDetails.trim()}`);
  }
  return parts.join("; ");
}

/**
 * Build initial clinical course narrative from all latest clinical case sources
 */
export function deriveInitialCourseInHospital(c: ClinicalCase): string {
  const sections: string[] = [];

  // 1. Initial Presentation / Primary Assessment
  const pc = c.patient.presentingComplaint ? `Patient presented with ${c.patient.presentingComplaint}.` : "";
  const primarySurveyStr = formatPrimaryAssessmentForCourse(c);
  if (pc || primarySurveyStr) {
    const surveyLine = [pc, primarySurveyStr ? `Initial assessment: ${primarySurveyStr}.` : ""].filter(Boolean).join(" ");
    sections.push(surveyLine);
  }

  // 2. Bedside Adjuncts (ECG, POCUS, ABG)
  const adjunctsStr = formatBedsideAdjunctsText(c);
  if (adjunctsStr) {
    sections.push(`Bedside Diagnostics: ${adjunctsStr}.`);
  }

  // 3. ER Treatments & IV Fluids administered
  const rxParts: string[] = [];
  if (c.treatments && c.treatments.length > 0) {
    const meds = c.treatments.map(t => `${t.drugName} ${t.dose || ""} (${t.route || "IV/Oral"})`).join(", ");
    rxParts.push(`Medications administered in ER: ${meds}.`);
  }
  if (c.infusions && c.infusions.length > 0) {
    const infs = c.infusions.map(i => `${i.fluidName} ${i.dose || ""} @ ${i.rate || ""}`).join(", ");
    rxParts.push(`IV Infusions: ${infs}.`);
  }
  if (c.treatmentNotes && c.treatmentNotes.trim()) {
    rxParts.push(`Treatment notes: ${c.treatmentNotes.trim()}`);
  }
  if (rxParts.length > 0) {
    sections.push(rxParts.join(" "));
  }

  // 4. Procedures
  const procStr = formatProceduresText(c);
  if (procStr) {
    sections.push(procStr);
  }

  // 5. Consultations
  const consultStr = formatConsultationsText(c);
  if (consultStr) {
    sections.push(consultStr);
  }

  // 6. Chronological Progress Notes / Updates
  if (c.progressNotes && c.progressNotes.trim()) {
    const cleanedNotes = c.progressNotes.trim();
    if (!sections.some(s => s.toLowerCase().includes(cleanedNotes.toLowerCase()))) {
      sections.push(`Clinical Course / Progress Notes:\n${cleanedNotes}`);
    }
  }

  // 7. Pediatric specific notes if applicable
  if (c.isPediatric && c.pediatricDetails) {
    const pedParts: string[] = [];
    const pd = c.pediatricDetails as any;
    const weight = pd.patientWeight || pd.weightKg;
    if (weight) pedParts.push(`Weight: ${weight} kg`);
    
    const wob = pd.patWorkOfBreathing || pd.pediatricTriangle?.workOfBreathing || pd.breathingWob;
    if (wob) pedParts.push(`Work of Breathing: ${wob}`);

    const appearance = pd.patAppearance || pd.pediatricTriangle?.appearance || pd.patAppearanceTone;
    if (appearance) pedParts.push(`Appearance: ${appearance}`);

    const circulation = pd.patCirculation || pd.circulationSkinColorTemp;
    if (circulation) pedParts.push(`Circulation: ${circulation}`);

    const imm = pd.immunizationHistory || pd.immunizationStatus;
    if (imm) pedParts.push(`Immunization: ${imm}`);

    if (pedParts.length > 0) {
      sections.push(`Pediatric Assessment: ${pedParts.join(", ")}.`);
    }
  }

  // 8. ER Observation & Disposition condition
  if (c.dispositionDetails?.observationNotes && c.dispositionDetails.observationNotes.trim()) {
    sections.push(`Observation & Evaluation: ${c.dispositionDetails.observationNotes.trim()}`);
  }

  return sections.join("\n\n").trim() || "Patient evaluated and stabilized in ER.";
}

/**
 * Format structured investigations into text
 */
export function formatInvestigationsText(c: ClinicalCase): string {
  const lines: string[] = [];

  // Laboratory investigations
  if (c.investigations && c.investigations.length > 0) {
    c.investigations.forEach(i => {
      const val = i.result ? `: ${i.result}` : ": Done";
      lines.push(`${i.testName}${val}`);
    });
  }

  // Free-text lab summary if present and not redundant
  if (c.investigationLabsOrdered && c.investigationLabsOrdered.trim()) {
    const labs = c.investigationLabsOrdered.trim();
    if (!lines.some(l => l.toLowerCase().includes(labs.toLowerCase()))) {
      lines.push(`Ordered Labs: ${labs}`);
    }
  }

  // Diagnostic imaging
  if (c.investigationImaging && c.investigationImaging.trim()) {
    lines.push(`Diagnostic Imaging: ${c.investigationImaging.trim()}`);
  }

  // Results summary
  if (c.investigationResultsSummary && c.investigationResultsSummary.trim()) {
    lines.push(`Results Summary: ${c.investigationResultsSummary.trim()}`);
  }

  return lines.join("\n").trim();
}

/**
 * Format outpatient / discharge medications from treatments
 */
export function formatDischargeMedicationsText(c: ClinicalCase): string {
  if (!c.treatments || c.treatments.length === 0) {
    return "";
  }
  return c.treatments.map((t, idx) => {
    const dose = t.dose ? ` ${t.dose}` : "";
    const route = t.route ? ` (${t.route})` : "";
    const instruction = t.instruction ? ` - ${t.instruction}` : " - As directed";
    return `${idx + 1}. ${t.drugName}${dose}${route}${instruction}`;
  }).join("\n");
}

/**
 * Intelligently merge new investigations from ClinicalCase into existing investigations text
 * Preserves user's custom formatting or extra typed notes while appending new tests.
 */
export function mergeInvestigations(existingText: string, c: ClinicalCase): string {
  const newTests = formatInvestigationsText(c);
  if (!existingText || !existingText.trim()) {
    return newTests;
  }
  if (!newTests) {
    return existingText;
  }

  const existingLower = existingText.toLowerCase();
  const newLines = newTests.split("\n").map(l => l.trim()).filter(Boolean);
  const toAppend: string[] = [];

  for (const line of newLines) {
    // Check if key part of test already exists
    const testNameKey = line.split(":")[0]?.trim().toLowerCase();
    if (testNameKey && !existingLower.includes(testNameKey)) {
      toAppend.push(line);
    }
  }

  if (toAppend.length === 0) {
    return existingText;
  }

  return `${existingText.trim()}\n${toAppend.join("\n")}`.trim();
}

/**
 * Intelligently merge medications:
 * Preserves clinician's manual discharge prescriptions and appends newly added ER treatments.
 */
export function mergeDischargeMedications(existingText: string, c: ClinicalCase): string {
  if (!existingText || !existingText.trim()) {
    return formatDischargeMedicationsText(c);
  }
  if (!c.treatments || c.treatments.length === 0) {
    return existingText;
  }

  const existingLower = existingText.toLowerCase();
  const toAdd: string[] = [];

  // Count existing numbered items
  const existingLines = existingText.split("\n");
  let nextNum = existingLines.length + 1;

  for (const t of c.treatments) {
    if (!t.drugName) continue;
    if (!existingLower.includes(t.drugName.toLowerCase())) {
      const dose = t.dose ? ` ${t.dose}` : "";
      const route = t.route ? ` (${t.route})` : "";
      const instruction = t.instruction ? ` - ${t.instruction}` : " - As directed";
      toAdd.push(`${nextNum}. ${t.drugName}${dose}${route}${instruction}`);
      nextNum++;
    }
  }

  if (toAdd.length === 0) {
    return existingText;
  }

  return `${existingText.trim()}\n${toAdd.join("\n")}`.trim();
}

/**
 * Intelligently merge clinical course:
 * Keeps clinician's manual edits and appends new progress notes, procedures, or consultations without duplicate paragraphs.
 */
export function mergeCourseInHospital(existingText: string, c: ClinicalCase): string {
  if (!existingText || !existingText.trim()) {
    return deriveInitialCourseInHospital(c);
  }

  const existingLower = existingText.toLowerCase();
  const additions: string[] = [];

  // Check progress notes
  if (c.progressNotes && c.progressNotes.trim()) {
    const notes = c.progressNotes.trim();
    // Split into individual note entries (e.g. [14:20] - ...)
    const noteLines = notes.split("\n").map(l => l.trim()).filter(Boolean);
    const unrecordedNotes: string[] = [];
    for (const n of noteLines) {
      if (!existingLower.includes(n.toLowerCase())) {
        unrecordedNotes.push(n);
      }
    }
    if (unrecordedNotes.length > 0) {
      additions.push(`Updated Progress Notes:\n${unrecordedNotes.join("\n")}`);
    }
  }

  // Check procedures
  const procStr = formatProceduresText(c);
  if (procStr && !existingLower.includes(procStr.toLowerCase())) {
    additions.push(procStr);
  }

  // Check consults
  const consultStr = formatConsultationsText(c);
  if (consultStr && !existingLower.includes(consultStr.toLowerCase())) {
    additions.push(consultStr);
  }

  // Check bedside diagnostics
  const adjunctsStr = formatBedsideAdjunctsText(c);
  if (adjunctsStr && !existingLower.includes(adjunctsStr.toLowerCase())) {
    additions.push(`Bedside Diagnostics: ${adjunctsStr}.`);
  }

  if (additions.length === 0) {
    return existingText;
  }

  return `${existingText.trim()}\n\n${additions.join("\n\n")}`.trim();
}
