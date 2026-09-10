export type CaseSheetKind = "adult" | "pediatric";

export interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  kind: CaseSheetKind | "both"; // "both" = identity/MLC/signature items shared across both sheets
}

export const CASE_SHEET_CHECKLIST: ChecklistItem[] = [
  // Shared — Identity
  { id: "patientName", label: "Patient Name", section: "Identity", kind: "both" },
  { id: "ageSex", label: "Age/Sex", section: "Identity", kind: "both" },
  { id: "address", label: "Address", section: "Identity", kind: "both" },
  { id: "phone", label: "Phone Number", section: "Identity", kind: "both" },
  { id: "arrivalDateTime", label: "Date & Time of Arrival", section: "Identity", kind: "both" },

  // Shared — MLC
  { id: "mlcDateTime", label: "Date & Time of Incident", section: "MLC", kind: "both" },
  { id: "mlcPlace", label: "Place of Incident", section: "MLC", kind: "both" },
  { id: "mlcNature", label: "Nature of Incident", section: "MLC", kind: "both" },
  { id: "mlcMechanism", label: "Mechanism of Injury", section: "MLC", kind: "both" },
  { id: "mlcBroughtBy", label: "Brought By", section: "MLC", kind: "both" },
  { id: "mlcInformant", label: "Informant", section: "MLC", kind: "both" },
  { id: "mlcIdMark", label: "Identification Mark", section: "MLC", kind: "both" },

  { id: "chiefComplaint", label: "Presenting Complaint", section: "Chief", kind: "both" },

  // Pediatric-only — PAT
  { id: "patAppearance", label: "PAT — Appearance", section: "PAT", kind: "pediatric" },
  { id: "patTone", label: "PAT — Tone", section: "PAT", kind: "pediatric" },
  { id: "patInteractivity", label: "PAT — Interactivity", section: "PAT", kind: "pediatric" },
  { id: "patConsolability", label: "PAT — Consolability", section: "PAT", kind: "pediatric" },
  { id: "patLookGaze", label: "PAT — Look/Gaze", section: "PAT", kind: "pediatric" },
  { id: "patSpeechCry", label: "PAT — Speech/Cry", section: "PAT", kind: "pediatric" },

  // Shared — Primary Survey (adult wording vs pediatric wording differ but same slot)
  { id: "airway", label: "Airway", section: "Primary", kind: "both" },
  { id: "breathing", label: "Breathing", section: "Primary", kind: "both" },
  { id: "circulation", label: "Circulation", section: "Primary", kind: "both" },
  { id: "disability", label: "Disability", section: "Primary", kind: "both" },
  { id: "exposure", label: "Exposure", section: "Primary", kind: "both" },
  { id: "extremities", label: "Extremities", section: "Primary", kind: "both" }, // NEW — was missing from adult entirely

  // Shared — Adjuncts
  { id: "ecg", label: "ECG", section: "Adjunct", kind: "both" },
  { id: "vbgAbg", label: "VBG/ABG", section: "Adjunct", kind: "both" },
  { id: "echo", label: "Bedside Echo", section: "Adjunct", kind: "both" },
  { id: "fastHeart", label: "FAST/EFAST — Heart", section: "Adjunct", kind: "both" }, // NEW for adult
  { id: "fastAbdomen", label: "FAST/EFAST — Abdomen", section: "Adjunct", kind: "both" },
  { id: "fastLungs", label: "FAST/EFAST — Lungs", section: "Adjunct", kind: "pediatric" },
  { id: "fastPelvis", label: "FAST/EFAST — Pelvis", section: "Adjunct", kind: "both" },
  { id: "fastExtremities", label: "FAST/EFAST — Extremities", section: "Adjunct", kind: "pediatric" },

  // Adult-only — History
  { id: "hpi", label: "History of Present Illness", section: "History", kind: "adult" },
  { id: "signsSymptoms", label: "Signs and Symptoms", section: "History", kind: "both" },
  { id: "pmh", label: "Past Medical History", section: "History", kind: "both" },
  { id: "surgicalHistory", label: "Surgical History", section: "History", kind: "adult" },
  { id: "pastSurgeriesImmunization", label: "Past Surgeries & Immunization Status", section: "History", kind: "pediatric" },
  { id: "familyGynaeHistory", label: "Family / Gynae History", section: "History", kind: "adult" },
  { id: "lmp", label: "LMP", section: "History", kind: "adult" },
  { id: "allergies", label: "Allergies", section: "History", kind: "both" },
  { id: "medications", label: "Medications", section: "History", kind: "both" },
  { id: "lastMeal", label: "Last Meal", section: "History", kind: "pediatric" },
  { id: "events", label: "Events", section: "History", kind: "pediatric" },

  // Adult-only — General/Systemic Exam
  { id: "generalExam", label: "General Examination", section: "Exam", kind: "adult" },
  { id: "cvsExam", label: "Systemic Exam — CVS", section: "Exam", kind: "adult" },
  { id: "chestExam", label: "Systemic Exam — Chest", section: "Exam", kind: "adult" },
  { id: "abdomenExam", label: "Systemic Exam — Abdomen", section: "Exam", kind: "adult" },
  { id: "cnsExam", label: "Systemic Exam — CNS", section: "Exam", kind: "adult" },

  // Pediatric-only — Focused Exam
  { id: "heentExam", label: "Focused Exam — HEENT", section: "Exam", kind: "pediatric" },
  { id: "respExam", label: "Focused Exam — Respiratory", section: "Exam", kind: "pediatric" },
  { id: "cvExam", label: "Focused Exam — Cardiovascular", section: "Exam", kind: "pediatric" },
  { id: "abdomenFocusedExam", label: "Focused Exam — Abdomen", section: "Exam", kind: "pediatric" },
  { id: "backExam", label: "Focused Exam — Back", section: "Exam", kind: "pediatric" },
  { id: "extremitiesFocusedExam", label: "Focused Exam — Extremities", section: "Exam", kind: "pediatric" },

  // Adult-only — Psych (never auto-filled, per locked design decision)
  { id: "psychAssessment", label: "Psychological Assessment", section: "Psych", kind: "adult" },

  // Shared — Disposition
  { id: "provisionalDiagnosis", label: "Provisional Diagnosis", section: "Disposition", kind: "both" },
  { id: "conditionAtShift", label: "Condition at Time of Shift", section: "Disposition", kind: "pediatric" },
  { id: "investigations", label: "Investigations", section: "Disposition", kind: "both" },
  { id: "treatmentPlan", label: "Treatment Plan", section: "Disposition", kind: "both" },
  { id: "disposition", label: "Disposition", section: "Disposition", kind: "both" },
  { id: "differentialDiagnosis", label: "Differential Diagnosis", section: "Disposition", kind: "both" },

  // Shared — Signature
  { id: "emResident", label: "EM Resident", section: "Signature", kind: "both" },
  { id: "emConsultant", label: "EM Consultant", section: "Signature", kind: "both" },
];

export function getChecklistForKind(kind: CaseSheetKind): ChecklistItem[] {
  return CASE_SHEET_CHECKLIST.filter(item => item.kind === kind || item.kind === "both");
}

export function buildChecklistPromptSection(kind: CaseSheetKind): string {
  const items = getChecklistForKind(kind);
  const bySection: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    if (!bySection[item.section]) bySection[item.section] = [];
    bySection[item.section].push(item);
  }
  let out =
    "Extract data for EVERY field listed below, grouped by section. " +
    "If the doctor did not mention a field, return null for it — " +
    "do NOT invent, assume, or apply a default value for any of them.\n\n";
  for (const [section, sectionItems] of Object.entries(bySection)) {
    out += `${section}:\n`;
    for (const item of sectionItems) {
      out += `  - ${item.id}: ${item.label}\n`;
    }
    out += "\n";
  }
  return out;
}
