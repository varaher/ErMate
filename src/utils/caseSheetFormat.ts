// ============================================================
// ErMate — Canonical Case Sheet Plain-Text Formatter
// Single source of truth for Case Sheet plain-text clipboard / EMR output.
// Used by CaseSheetPrintView, CaseSheetView, and MATE previews.
// Guarantees zero-hallucination, clean EMR compatibility, and
// strict clinical field parity with the universal visual preview.
// ============================================================

import type { CaseSheetData, VitalReading, LabPanel } from "../components/CaseSheetPrintView";
import { formatFlagged } from "../components/clinicalRanges";

function formatVitalsLine(vitals: VitalReading[]): string {
  const parts: string[] = [];
  for (const v of vitals) {
    if (v.displayValue) {
      parts.push(`${v.label}: ${v.displayValue}`);
    } else if (v.value !== null && v.value !== undefined) {
      parts.push(`${v.label}: ${v.value}${v.unit ? ` ${v.unit}` : ""}`);
    }
  }
  return parts.length > 0 ? parts.join(" | ") : "Not documented";
}

export function formatCaseSheetText(data: CaseSheetData): string {
  const lines: string[] = [];

  // 1. Hospital & Record Header
  const hospitalName = (data.hospitalName && data.hospitalName.trim() ? data.hospitalName.trim() : "[Hospital name not set]").toUpperCase();
  lines.push(`**${hospitalName}**`);
  lines.push(`EMERGENCY DEPARTMENT — CASE SHEET${data.isMlc ? " · MLC CASE" : ""}`);
  lines.push(`Case ID: ${data.caseId}`);
  lines.push(`Captured: ${data.arrival.date || "N/A"} ${data.arrival.time || ""}`);
  lines.push("Confidential Medical Record");
  lines.push("");

  // 2. Patient Demographics
  lines.push("**PATIENT DEMOGRAPHICS:**");
  lines.push(`- Name: ${data.patient.name || "Not recorded"}`);
  lines.push(`- Age / Sex: ${data.patient.age !== null && data.patient.age !== undefined ? `${data.patient.age}y` : "—"} ${data.patient.sex || "—"}`);
  lines.push(`- UHID: ${data.patient.uhid || "—"}`);
  lines.push(`- Bed / Location: ${data.patient.bed || "—"}`);
  lines.push(`- Arrival: ${data.arrival.date || "—"} ${data.arrival.time || ""}`);
  lines.push(`- Treating Clinician: ${data.clinician || "Not recorded"}`);
  if (data.triageCategory) {
    lines.push(`- Triage Category: ${data.triageCategory}`);
  }
  if (data.caseType) {
    lines.push(`- Case Type: ${data.caseType}`);
  }
  lines.push("");

  // 3. Presenting Complaint
  lines.push("**CHIEF COMPLAINTS / PRESENTING COMPLAINT:**");
  lines.push(data.presentingComplaint ? `- ${data.presentingComplaint}` : "- Not documented");
  lines.push("");

  if (data.isPediatric) {
    // ---------------------------------------------------------
    // PEDIATRIC SPECIFIC SECTION
    // Ordering:
    // PAT -> Primary Survey -> Adjuncts -> SAMPLE History ->
    // Focused Physical Examination -> Psychological Assessment ->
    // Investigations -> Treatment Given -> Provisional Diagnosis ->
    // Differentials -> Procedures -> Consults -> Safety -> Disposition -> Notes -> Signature
    // ---------------------------------------------------------

    // 4. Pediatric Assessment (PAT / TICLS)
    if (data.pediatricDetails) {
      const ped = data.pediatricDetails;
      lines.push("**PEDIATRIC ASSESSMENT (PAT):**");
      lines.push(`- Weight: ${ped.weight ? `${ped.weight} kg` : "Not recorded"}`);
      lines.push(
        `- PAT — Appearance (TICLS): Tone: ${ped.patAppearanceTone || "—"}, ` +
        `Interactivity: ${ped.patAppearanceInteractivity || "—"}, ` +
        `Consolability: ${ped.patAppearanceConsolability || "—"}, ` +
        `Look/Gaze: ${ped.patAppearanceLookGaze || "—"}, ` +
        `Speech/Cry: ${ped.patAppearanceSpeechCry || "—"}`
      );
      lines.push(`- Work of Breathing: ${ped.patWorkOfBreathing || "—"} | Circulation: ${ped.patCirculation || "—"}`);
      if (ped.birthHistory) lines.push(`- Birth History: ${ped.birthHistory}`);
      if (ped.feedingHistory) lines.push(`- Feeding History: ${ped.feedingHistory}`);
      if (ped.developmentalHistory) lines.push(`- Developmental History: ${ped.developmentalHistory}`);
      lines.push(`- Immunization History: ${ped.immunizationHistory || "Not recorded"}`);
      if (ped.broughtBy) lines.push(`- Brought By: ${ped.broughtBy}`);
      if (ped.informant) lines.push(`- Informant: ${ped.informant}`);
      lines.push("");
    }

    // 5. Initial Vitals & Primary Survey (ABCDE)
    lines.push("**INITIAL VITALS & PRIMARY SURVEY (ABCDE):**");
    lines.push(`- Initial Vitals: ${formatVitalsLine(data.initialVitals)}`);
    lines.push(`- A — Airway: ${data.primarySurvey.airway || "Not documented"}`);
    lines.push(`- B — Breathing: ${data.primarySurvey.breathing || "Not documented"}`);
    lines.push(`- C — Circulation: ${data.primarySurvey.circulation || "Not documented"}`);
    lines.push(`- D — Disability: ${data.primarySurvey.disability || "Not documented"}`);
    lines.push(`- E — Exposure: ${data.primarySurvey.exposure || "Not documented"}`);
    lines.push("");

    // 6. Adjuncts to Primary Assessment
    lines.push("**ADJUNCTS TO PRIMARY ASSESSMENT:**");
    lines.push(`- ECG: ${data.ecg.findings || (data.ecg.performed ? "Performed" : "Not documented")}`);
    lines.push(`- Bedside Echo: ${data.bedsideEcho.findings || (data.bedsideEcho.performed ? "Performed" : "Not documented")}`);
    lines.push(`- eFAST: ${data.efast.findings || (data.efast.performed ? "Performed" : "Not documented")}`);
    if (data.vbgAbg.performed || data.vbgAbg.type || data.vbgAbg.values.length > 0) {
      const vbgParts = data.vbgAbg.values.map(v => `${v.name}: ${v.value}`).join(", ");
      lines.push(`- ${data.vbgAbg.type || "Blood Gas"}: ${vbgParts || "Performed"}${data.vbgAbg.notes ? ` — ${data.vbgAbg.notes}` : ""}`);
    } else {
      lines.push("- VBG/ABG: Not documented");
    }
    lines.push("");

    // 7. SAMPLE History
    lines.push("**SECONDARY ASSESSMENT / SAMPLE HISTORY:**");
    lines.push(`- S — Signs & Symptoms: ${data.symptoms.length > 0 ? data.symptoms.join(", ") : "None documented"}`);
    lines.push(`- A — Allergies: ${data.allergies.length > 0 ? data.allergies.join(", ") : "None documented"}`);
    lines.push(`- M — Medications: ${data.currentMedications.length > 0 ? data.currentMedications.join(", ") : "None documented"}`);
    lines.push(`- P — Past Medical History: ${data.pastHistory.length > 0 ? data.pastHistory.join(" · ") : "Not significant"}`);
    lines.push(`- L — Last Meal: ${data.lastMeal || "Not documented"}`);
    lines.push(`- E — Events Preceding: ${data.events || "Not documented"}`);
    lines.push("");

    // 8. Focused Physical Examination
    lines.push("**FOCUSED PHYSICAL EXAMINATION:**");
    lines.push(`- General Examination: ${data.secondarySurvey.general || "Not documented"}`);
    lines.push(`- Respiratory (RS): ${data.secondarySurvey.respiratory || "Not documented"}`);
    lines.push(`- Cardiovascular (CVS): ${data.secondarySurvey.cvs || "Not documented"}`);
    lines.push(`- Per Abdomen (PA): ${data.secondarySurvey.abdomen || "Not documented"}`);
    lines.push(`- Central Nervous System (CNS): ${data.secondarySurvey.cns || "Not documented"}`);
    lines.push(`- Extremities & Back: ${data.secondarySurvey.extremities || "Not documented"}`);
    lines.push("");

    // 9. Psychological Assessment
    if (data.psychologicalAssessment) {
      const psych = data.psychologicalAssessment;
      lines.push("**PSYCHOLOGICAL ASSESSMENT:**");
      if (psych.suicidalIdeation !== undefined && psych.suicidalIdeation !== null) lines.push(`- Suicidal Ideation: ${psych.suicidalIdeation ? "Yes" : "No"}`);
      if (psych.selfHarmHistory !== undefined && psych.selfHarmHistory !== null) lines.push(`- Self-Harm History: ${psych.selfHarmHistory ? "Yes" : "No"}`);
      if (psych.intentToHarmOthers !== undefined && psych.intentToHarmOthers !== null) lines.push(`- Intent to Harm Others: ${psych.intentToHarmOthers ? "Yes" : "No"}`);
      if (psych.substanceAbuse !== undefined && psych.substanceAbuse !== null) lines.push(`- Substance Abuse: ${psych.substanceAbuse ? "Yes" : "No"}`);
      if (psych.psychiatricHistory !== undefined && psych.psychiatricHistory !== null) lines.push(`- Psychiatric History: ${psych.psychiatricHistory ? "Yes" : "No"}`);
      if (psych.currentlyOnPsychiatricTreatment !== undefined && psych.currentlyOnPsychiatricTreatment !== null) lines.push(`- Prior Mental Health Treatment: ${psych.currentlyOnPsychiatricTreatment ? "Yes" : "No"}`);
      if (psych.notes) lines.push(`- Observations / Notes: ${psych.notes}`);
      lines.push("");
    }

    // 10. Investigations & Diagnostic Studies
    const hasInvestigations = Boolean(
      data.investigationLabsOrdered ||
      data.labs.length > 0 ||
      data.investigationImaging ||
      data.investigationResultsSummary
    );
    if (hasInvestigations) {
      lines.push("**INVESTIGATIONS & DIAGNOSTIC STUDIES:**");
      if (data.investigationLabsOrdered) {
        lines.push(`- Laboratory Investigations Ordered:\n  ${data.investigationLabsOrdered}`);
      }
      if (data.labs.length > 0) {
        for (const panel of data.labs) {
          const panelVals = panel.values
            .map(v => `${v.name}: ${v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending")}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`)
            .join("  |  ");
          lines.push(`- ${panel.panelName}: ${panelVals}`);
        }
      }
      if (data.investigationImaging) {
        lines.push(`- Diagnostic Imaging (X-Ray / CT / MRI / USG):\n  ${data.investigationImaging}`);
      }
      if (data.investigationResultsSummary) {
        lines.push(`- Investigation Results Summary:\n  ${data.investigationResultsSummary}`);
      }
      lines.push("");
    }

    // 11. Treatment Given & Emergency Orders
    const hasTreatments = Boolean(
      data.treatmentGiven.length > 0 ||
      data.treatmentNotes
    );
    if (hasTreatments) {
      lines.push("**TREATMENT GIVEN & EMERGENCY ORDERS:**");
      if (data.treatmentGiven.length > 0) {
        data.treatmentGiven.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
      }
      if (data.treatmentNotes) {
        lines.push(`- Treatment Notes & Orders: ${data.treatmentNotes}`);
      }
      lines.push("");
    }

    // 12. Provisional Diagnosis
    lines.push("**PROVISIONAL DIAGNOSIS:**");
    lines.push(data.provisionalDiagnosis ? `- ${data.provisionalDiagnosis}` : "- Not documented");
    if (data.differentials.length > 0 || data.provisionalDifferentialDiagnoses) {
      lines.push("**Differential Diagnosis:**");
      if (data.differentials.length > 0) {
        data.differentials.forEach((d, i) => lines.push(`  ${i + 1}. ${d.diagnosis}${d.status ? ` (${d.status})` : ""}`));
      }
      if (data.provisionalDifferentialDiagnoses) {
        lines.push(`- Notes / Details: ${data.provisionalDifferentialDiagnoses}`);
      }
    }
    lines.push("");

  } else {
    // ---------------------------------------------------------
    // ADULT SECTION
    // Ordering:
    // Primary Survey -> Adjuncts -> SAMPLE History ->
    // Secondary Survey -> Psychological Assessment ->
    // Provisional & Differential Diagnosis ->
    // Investigations -> Treatment Given -> Procedures ->
    // Consults -> Safety -> Disposition -> Notes -> Signature
    // ---------------------------------------------------------

    // 4. Initial Vitals & Primary Survey (ABCDE)
    lines.push("**PRIMARY SURVEY (ABCDE):**");
    lines.push(`- Initial Vitals: ${formatVitalsLine(data.initialVitals)}`);
    lines.push(`- A — Airway: ${data.primarySurvey.airway || "Not documented"}`);
    lines.push(`- B — Breathing: ${data.primarySurvey.breathing || "Not documented"}`);
    lines.push(`- C — Circulation: ${data.primarySurvey.circulation || "Not documented"}`);
    lines.push(`- D — Disability: ${data.primarySurvey.disability || "Not documented"}`);
    lines.push(`- E — Exposure: ${data.primarySurvey.exposure || "Not documented"}`);
    lines.push("");

    // 5. Adjuncts to Primary Assessment
    lines.push("**ADJUNCTS TO PRIMARY ASSESSMENT:**");
    lines.push(`- ECG: ${data.ecg.findings || (data.ecg.performed ? "Performed" : "Not documented")}`);
    lines.push(`- Bedside Echo: ${data.bedsideEcho.findings || (data.bedsideEcho.performed ? "Performed" : "Not documented")}`);
    lines.push(`- eFAST: ${data.efast.findings || (data.efast.performed ? "Performed" : "Not documented")}`);
    if (data.vbgAbg.performed || data.vbgAbg.type || data.vbgAbg.values.length > 0) {
      const vbgParts = data.vbgAbg.values.map(v => `${v.name}: ${v.value}`).join(", ");
      lines.push(`- ${data.vbgAbg.type || "Blood Gas"}: ${vbgParts || "Performed"}${data.vbgAbg.notes ? ` — ${data.vbgAbg.notes}` : ""}`);
    } else {
      lines.push("- VBG/ABG: Not documented");
    }
    lines.push("");

    // 6. SAMPLE History
    lines.push("**SAMPLE HISTORY:**");
    lines.push(`- S — Signs & Symptoms: ${data.symptoms.length > 0 ? data.symptoms.join(", ") : "None documented"}`);
    lines.push(`- A — Allergies: ${data.allergies.length > 0 ? data.allergies.join(", ") : "None documented"}`);
    lines.push(`- M — Current Medications: ${data.currentMedications.length > 0 ? data.currentMedications.join(", ") : "None documented"}`);
    lines.push(`- P — Past Medical History: ${data.pastHistory.length > 0 ? data.pastHistory.join(" · ") : "Not significant"}`);
    lines.push(`- L — Last Meal: ${data.lastMeal || "Not documented"}`);
    lines.push(`- E — Events Preceding: ${data.events || "Not documented"}`);
    lines.push("");

    // 7. Secondary Survey
    lines.push("**SECONDARY SURVEY (SYSTEMIC & GENERAL EXAMINATION):**");
    lines.push(`- General Examination: ${data.secondarySurvey.general || "Not documented"}`);
    lines.push(`- Cardiovascular (CVS): ${data.secondarySurvey.cvs || "Not documented"}`);
    lines.push(`- Respiratory (RS): ${data.secondarySurvey.respiratory || "Not documented"}`);
    lines.push(`- Per Abdomen (PA): ${data.secondarySurvey.abdomen || "Not documented"}`);
    lines.push(`- Central Nervous System (CNS): ${data.secondarySurvey.cns || "Not documented"}`);
    lines.push(`- Extremities & Back: ${data.secondarySurvey.extremities || "Not documented"}`);
    lines.push("");

    // 8. Psychological Assessment
    if (data.psychologicalAssessment) {
      const psych = data.psychologicalAssessment;
      lines.push("**PSYCHOLOGICAL ASSESSMENT:**");
      if (psych.suicidalIdeation !== undefined && psych.suicidalIdeation !== null) lines.push(`- Suicidal Ideation: ${psych.suicidalIdeation ? "Yes" : "No"}`);
      if (psych.selfHarmHistory !== undefined && psych.selfHarmHistory !== null) lines.push(`- Self-Harm History: ${psych.selfHarmHistory ? "Yes" : "No"}`);
      if (psych.intentToHarmOthers !== undefined && psych.intentToHarmOthers !== null) lines.push(`- Intent to Harm Others: ${psych.intentToHarmOthers ? "Yes" : "No"}`);
      if (psych.substanceAbuse !== undefined && psych.substanceAbuse !== null) lines.push(`- Substance Abuse: ${psych.substanceAbuse ? "Yes" : "No"}`);
      if (psych.psychiatricHistory !== undefined && psych.psychiatricHistory !== null) lines.push(`- Psychiatric History: ${psych.psychiatricHistory ? "Yes" : "No"}`);
      if (psych.currentlyOnPsychiatricTreatment !== undefined && psych.currentlyOnPsychiatricTreatment !== null) lines.push(`- Prior Mental Health Treatment: ${psych.currentlyOnPsychiatricTreatment ? "Yes" : "No"}`);
      if (psych.notes) lines.push(`- Observations / Notes: ${psych.notes}`);
      lines.push("");
    }

    // 9. Provisional & Differential Diagnosis
    lines.push("**PROVISIONAL & DIFFERENTIAL DIAGNOSIS:**");
    lines.push(data.provisionalDiagnosis ? `- Provisional Diagnosis: ${data.provisionalDiagnosis}` : "- Provisional Diagnosis: Not documented");
    if (data.differentials.length > 0) {
      lines.push("- Differential Diagnosis:");
      data.differentials.forEach((d, i) => lines.push(`  ${i + 1}. ${d.diagnosis}${d.status ? ` (${d.status})` : ""}`));
    }
    if (data.provisionalDifferentialDiagnoses) {
      lines.push(`- Notes / Details: ${data.provisionalDifferentialDiagnoses}`);
    }
    lines.push("");

    // 10. Investigations & Diagnostic Studies
    const hasInvestigations = Boolean(
      data.investigationLabsOrdered ||
      data.labs.length > 0 ||
      data.investigationImaging ||
      data.investigationResultsSummary
    );
    if (hasInvestigations) {
      lines.push("**INVESTIGATIONS & DIAGNOSTIC STUDIES:**");
      if (data.investigationLabsOrdered) {
        lines.push(`- Laboratory Investigations Ordered:\n  ${data.investigationLabsOrdered}`);
      }
      if (data.labs.length > 0) {
        for (const panel of data.labs) {
          const panelVals = panel.values
            .map(v => `${v.name}: ${v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending")}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`)
            .join("  |  ");
          lines.push(`- ${panel.panelName}: ${panelVals}`);
        }
      }
      if (data.investigationImaging) {
        lines.push(`- Diagnostic Imaging (X-Ray / CT / MRI / USG):\n  ${data.investigationImaging}`);
      }
      if (data.investigationResultsSummary) {
        lines.push(`- Investigation Results Summary:\n  ${data.investigationResultsSummary}`);
      }
      lines.push("");
    }

    // 11. Treatment Given & Emergency Orders
    const hasTreatments = Boolean(
      data.treatmentGiven.length > 0 ||
      data.treatmentNotes
    );
    if (hasTreatments) {
      lines.push("**TREATMENT GIVEN & EMERGENCY ORDERS:**");
      if (data.treatmentGiven.length > 0) {
        data.treatmentGiven.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
      }
      if (data.treatmentNotes) {
        lines.push(`- Treatment Notes & Orders: ${data.treatmentNotes}`);
      }
      lines.push("");
    }
  }

  // -----------------------------------------------------------
  // COMMON CLOSING SECTIONS (Procedures, Consults, Safety, Disposition, Notes, Signatures)
  // -----------------------------------------------------------

  // Procedures & Interventions
  const hasProcedures = Boolean(
    (data.procedures.procedureNotes && data.procedures.procedureNotes.length > 0) ||
    data.procedures.proceduresChecked.length > 0 ||
    data.procedures.otherProcedures
  );
  if (hasProcedures) {
    lines.push("**PROCEDURES & INTERVENTIONS:**");
    if (data.procedures.procedureNotes && data.procedures.procedureNotes.length > 0) {
      for (const note of data.procedures.procedureNotes) {
        const timeStr = [note.metadata.date, note.metadata.time].filter(Boolean).join(" ");
        lines.push(`- ${note.procedureName}${timeStr ? ` (${timeStr})` : ""}:`);
        lines.push(`  ${note.generatedNarrative}`);
      }
    }
    if (data.procedures.proceduresChecked.length > 0) {
      lines.push(`- Procedures Performed: ${data.procedures.proceduresChecked.join(", ")}`);
    }
    if (data.procedures.otherProcedures) {
      lines.push(`- Procedure Details: ${data.procedures.otherProcedures}`);
    }
    lines.push("");
  }

  // Specialist Consultation & Review
  const hasConsultation = Boolean(
    data.consultation.consultsRequested.length > 0 ||
    data.consultation.consultantReview
  );
  if (hasConsultation) {
    lines.push("**SPECIALIST CONSULTATION & REVIEW:**");
    if (data.consultation.consultsRequested.length > 0) {
      lines.push(`- Consults Requested: ${data.consultation.consultsRequested.join(", ")}`);
    }
    if (data.consultation.consultantReview) {
      const cr = data.consultation.consultantReview;
      lines.push(`- Consultant Review${cr.reviewedBy ? ` (${cr.reviewedBy})` : ""}${cr.timestamp ? ` [${cr.timestamp}]` : ""}:`);
      lines.push(`  ${cr.reviewText}`);
    }
    lines.push("");
  }

  // Safety & Accreditation Standards
  const sa = data.safetyAndAccreditation;
  const hasSafety = Boolean(
    sa && (
      sa.ipsg.length > 0 ||
      sa.vulnerability.length > 0 ||
      sa.fallRisk ||
      sa.consentTimeOut.length > 0
    )
  );
  if (hasSafety) {
    lines.push("**SAFETY & ACCREDITATION STANDARDS:**");
    if (sa.ipsg.length > 0) {
      lines.push(`- International Patient Safety Goals (IPSG): ${sa.ipsg.join("; ")}`);
    }
    if (sa.fallRisk) {
      lines.push(`- Fall Risk: ${sa.fallRisk}`);
    }
    if (sa.vulnerability.length > 0) {
      lines.push(`- Vulnerability Flags: ${sa.vulnerability.join("; ")}`);
    }
    if (sa.consentTimeOut.length > 0) {
      lines.push(`- Informed Consent & Time-Out: ${sa.consentTimeOut.join("; ")}`);
    }
    lines.push("");
  }

  // Disposition & Outcome
  lines.push("**DISPOSITION & OUTCOME:**");
  lines.push(`- Status: ${data.disposition.status || "Not yet determined"}`);
  if (data.disposition.destinationUnit) lines.push(`- Destination: ${data.disposition.destinationUnit}`);
  if (data.disposition.durationInEr) lines.push(`- Duration in ER: ${data.disposition.durationInEr}`);
  if (data.disposition.conditionAtShift) lines.push(`- Condition at Shift: ${data.disposition.conditionAtShift}`);
  if (data.disposition.managementPlan) lines.push(`- Management Plan: ${data.disposition.managementPlan}`);
  if (data.disposition.consultsRequested.length > 0) lines.push(`- Consults Requested: ${data.disposition.consultsRequested.join(", ")}`);
  if (data.disposition.followUpAdvice) lines.push(`- Follow-Up Advice: ${data.disposition.followUpAdvice}`);
  lines.push("");

  // Clinical Notes & Addendum
  const hasProgressNotes = data.notes.progressNotes && data.notes.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation.";
  const hasAddendum = Boolean(data.notes.addendum);
  if (hasProgressNotes || hasAddendum) {
    lines.push("**CLINICAL NOTES & ADDENDUM:**");
    if (hasProgressNotes) {
      lines.push(`- Progress Notes:\n  ${data.notes.progressNotes}`);
    }
    if (hasAddendum) {
      lines.push(`- Addendum:\n  ${data.notes.addendum}`);
    }
    lines.push("");
  }

  // Signature Block
  lines.push("--------------------------------------------------");
  lines.push(`Treating ER Physician: ${data.signatureBlock.clinicianName || "Not recorded"}`);
  if (data.signatureBlock.consultantName) {
    lines.push(`EM Consultant: ${data.signatureBlock.consultantName}`);
  }
  lines.push(`Signed: ${data.signatureBlock.timestamp || "Not recorded"}`);
  lines.push("Electronically Signed Confidential Record");

  return lines.join("\n");
}
