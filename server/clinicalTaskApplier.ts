/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side Universal Clinical Task Applier (Adult + Pediatric + Discharge Summary)
 *
 * Central registry and deterministic natural-language patch resolver for ER cases.
 * Classifies intent (QUESTION, DOCUMENT_FACT, CASE_UPDATE, APP_ACTION, MIXED),
 * maps natural-language clinical commands into validated patches against existing ClinicalCase fields,
 * and preserves all unedited data with zero hallucinations.
 *
 * FULL-DICTATION GATE FIX (Sept 2026): the patch regexes in this file are built
 * for short, single-line commands ("CVS S1 S2 heard", "add inj X 1g IV"). They
 * were previously run on full multi-section dictations classed as DOCUMENT_FACT,
 * where they corrupted the case sheet AFTER extraction had produced clean values:
 *   - `\bpa` matched inside the name "Patma" → abdomen = raw transcript text
 *   - CVS / RS / CNS captured to the next period, spanning other systems
 *   - the period split cut decimals ("pH 7.425" → "7")
 *   - CNS overwrote extraction's CNS value, dropping dictated limb power grades
 *   - "heart rate 80" was read as a subxiphoid/pericardial eFAST view
 *   - psych "Normal" was inferred from the word "normal" anywhere in the text
 * isFullDictation() now returns zero patches for full dictations; extraction and
 * the explicit-section parsers in scribeChatTurn.ts own those fields.
 */

import { normalizeConsultationSpecialty, deduplicateConsultations } from "./consultationNormalization";

export type ClinicalIntent =
  | "QUESTION"
  | "DOCUMENT_FACT"
  | "CASE_UPDATE"
  | "APP_ACTION"
  | "MIXED";

export interface RegistryFieldDef {
  path: string;
  section: string;
  label: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  appliesTo: "adult" | "pediatric" | "both";
  supportedOperations: ("set" | "append" | "addItem")[];
}

export const CLINICAL_FIELD_REGISTRY: Record<string, RegistryFieldDef> = {
  // Vitals
  "vitals.bp": { path: "vitals.bp", section: "Vitals", label: "Blood Pressure", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.hr": { path: "vitals.hr", section: "Vitals", label: "Heart Rate", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.rr": { path: "vitals.rr", section: "Vitals", label: "Respiratory Rate", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.spo2": { path: "vitals.spo2", section: "Vitals", label: "SpO2", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.temp": { path: "vitals.temp", section: "Vitals", label: "Temperature", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.grbs": { path: "vitals.grbs", section: "Vitals", label: "GRBS / Blood Sugar", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.painScore": { path: "vitals.painScore", section: "Vitals", label: "Pain Score", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.gcs": { path: "vitals.gcs", section: "Vitals", label: "GCS Total", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "vitals.avpu": { path: "vitals.avpu", section: "Vitals", label: "AVPU Scale", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "patient.triageCategory": { path: "patient.triageCategory", section: "Triage", label: "Triage Priority", type: "string", appliesTo: "both", supportedOperations: ["set"] },

  // SAMPLE History
  "sampleHistory.symptoms": { path: "sampleHistory.symptoms", section: "SAMPLE History", label: "Symptoms (HPI)", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "sampleHistory.allergies": { path: "sampleHistory.allergies", section: "SAMPLE History", label: "Allergies", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "sampleHistory.medications": { path: "sampleHistory.medications", section: "SAMPLE History", label: "Current Medications", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "sampleHistory.pastHistory": { path: "sampleHistory.pastHistory", section: "SAMPLE History", label: "Past Medical History", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "sampleHistory.lastMeal": { path: "sampleHistory.lastMeal", section: "SAMPLE History", label: "Last Meal", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "sampleHistory.events": { path: "sampleHistory.events", section: "SAMPLE History", label: "Preceding Events / Mechanism", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "events": { path: "events", section: "SAMPLE History", label: "Preceding Events / Mechanism", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "sampleHistory.psychiatricFlags": { path: "sampleHistory.psychiatricFlags", section: "SAMPLE History", label: "Psychological / Psychiatric Assessment", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // Primary Assessment (ABCDE)
  "primaryAssessment.airway": { path: "primaryAssessment.airway", section: "Primary Survey", label: "Airway", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "primaryAssessment.airwayStatus": { path: "primaryAssessment.airwayStatus", section: "Primary Survey", label: "Airway Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "primaryAssessment.breathing": { path: "primaryAssessment.breathing", section: "Primary Survey", label: "Breathing", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "primaryAssessment.breathingStatus": { path: "primaryAssessment.breathingStatus", section: "Primary Survey", label: "Breathing Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "primaryAssessment.circulation": { path: "primaryAssessment.circulation", section: "Primary Survey", label: "Circulation", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "primaryAssessment.circulationStatus": { path: "primaryAssessment.circulationStatus", section: "Primary Survey", label: "Circulation Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "primaryAssessment.disability": { path: "primaryAssessment.disability", section: "Primary Survey", label: "Disability", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "primaryAssessment.disabilityStatus": { path: "primaryAssessment.disabilityStatus", section: "Primary Survey", label: "Disability Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "primaryAssessment.exposure": { path: "primaryAssessment.exposure", section: "Primary Survey", label: "Exposure", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "primaryAssessment.exposureStatus": { path: "primaryAssessment.exposureStatus", section: "Primary Survey", label: "Exposure Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },

  // Secondary Examination
  "secondarySurvey.general": { path: "secondarySurvey.general", section: "Secondary Exam", label: "General Examination", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.cvs": { path: "secondarySurvey.cvs", section: "Secondary Exam", label: "Cardiovascular System", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.respiratory": { path: "secondarySurvey.respiratory", section: "Secondary Exam", label: "Respiratory System", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.abdomen": { path: "secondarySurvey.abdomen", section: "Secondary Exam", label: "Per Abdomen", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.cns": { path: "secondarySurvey.cns", section: "Secondary Exam", label: "Central Nervous System", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.extremities": { path: "secondarySurvey.extremities", section: "Secondary Exam", label: "Extremities", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "secondarySurvey.cSpineExam": { path: "secondarySurvey.cSpineExam", section: "Secondary Exam", label: "Cervical Spine", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // POCUS / Bedside Diagnostics
  "adjuncts.echoDone": { path: "adjuncts.echoDone", section: "Bedside Diagnostics", label: "Bedside Echo Performed", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "adjuncts.echoFindings": { path: "adjuncts.echoFindings", section: "Bedside Diagnostics", label: "Bedside Echo Findings", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "adjuncts.efastNotes": { path: "adjuncts.efastNotes", section: "Bedside Diagnostics", label: "eFAST / POCUS Findings", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "fastFindings": { path: "fastFindings", section: "Bedside Diagnostics", label: "eFAST Organ Map", type: "object", appliesTo: "both", supportedOperations: ["set"] },

  // Investigations
  "investigations": { path: "investigations", section: "Investigations", label: "Ordered Investigations", type: "array", appliesTo: "both", supportedOperations: ["addItem"] },
  "investigationLabsOrdered": { path: "investigationLabsOrdered", section: "Investigations", label: "Labs Ordered Text", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "investigationImaging": { path: "investigationImaging", section: "Investigations", label: "Imaging Ordered Text", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // Treatments & Medications
  "treatments": { path: "treatments", section: "Treatments", label: "Administered Treatments", type: "array", appliesTo: "both", supportedOperations: ["addItem"] },
  "treatmentNotes": { path: "treatmentNotes", section: "Treatments", label: "Treatment Notes / Plan", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // Procedures
  "proceduresChecked": { path: "proceduresChecked", section: "Procedures", label: "Procedures Performed", type: "array", appliesTo: "both", supportedOperations: ["addItem"] },
  "otherProcedures": { path: "otherProcedures", section: "Procedures", label: "Procedure Notes", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // Consultations
  "dispositionAndPlan.consultsRequested": { path: "dispositionAndPlan.consultsRequested", section: "Consultations", label: "Requested Consults", type: "array", appliesTo: "both", supportedOperations: ["addItem"] },
  "consultantReview": { path: "consultantReview", section: "Consultations", label: "Consultant Review Narrative", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },

  // Diagnosis & Differentials
  "provisionalPrimaryDiagnosis": { path: "provisionalPrimaryDiagnosis", section: "Diagnosis", label: "Provisional Primary Diagnosis", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "differentials": { path: "differentials", section: "Diagnosis", label: "Differential Diagnoses", type: "array", appliesTo: "both", supportedOperations: ["addItem"] },

  // Progress Notes
  "progressNotes": { path: "progressNotes", section: "Progress Notes", label: "Chronological Progress Notes", type: "string", appliesTo: "both", supportedOperations: ["append"] },

  // Disposition & Plan
  "dispositionAndPlan.dispositionStatus": { path: "dispositionAndPlan.dispositionStatus", section: "Disposition", label: "Disposition Status", type: "string", appliesTo: "both", supportedOperations: ["set"] },
  "dispositionAndPlan.managementPlan": { path: "dispositionAndPlan.managementPlan", section: "Disposition", label: "Management Plan", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "dispositionAndPlan.followUpAdvice": { path: "dispositionAndPlan.followUpAdvice", section: "Disposition", label: "Follow-up Advice", type: "string", appliesTo: "both", supportedOperations: ["set", "append"] },
  "conditionAtShift": { path: "conditionAtShift", section: "Disposition", label: "Condition at Shift Handover", type: "string", appliesTo: "both", supportedOperations: ["set"] },

  // Pediatric Specific
  "pediatricDetails.weight": { path: "pediatricDetails.weight", section: "Pediatric Details", label: "Weight", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.broughtBy": { path: "pediatricDetails.broughtBy", section: "Pediatric Details", label: "Brought By", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.informant": { path: "pediatricDetails.informant", section: "Pediatric Details", label: "Informant", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patAppearanceTone": { path: "pediatricDetails.patAppearanceTone", section: "Pediatric Assessment Triangle", label: "PAT Tone", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patAppearanceInteractivity": { path: "pediatricDetails.patAppearanceInteractivity", section: "Pediatric Assessment Triangle", label: "PAT Interactivity", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patAppearanceConsolability": { path: "pediatricDetails.patAppearanceConsolability", section: "Pediatric Assessment Triangle", label: "PAT Consolability", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patAppearanceLookGaze": { path: "pediatricDetails.patAppearanceLookGaze", section: "Pediatric Assessment Triangle", label: "PAT Look/Gaze", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patAppearanceSpeechCry": { path: "pediatricDetails.patAppearanceSpeechCry", section: "Pediatric Assessment Triangle", label: "PAT Speech/Cry", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patWorkOfBreathing": { path: "pediatricDetails.patWorkOfBreathing", section: "Pediatric Assessment Triangle", label: "PAT Work of Breathing", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.patCirculation": { path: "pediatricDetails.patCirculation", section: "Pediatric Assessment Triangle", label: "PAT Circulation", type: "string", appliesTo: "pediatric", supportedOperations: ["set"] },
  "pediatricDetails.birthHistory": { path: "pediatricDetails.birthHistory", section: "Pediatric History", label: "Birth History", type: "string", appliesTo: "pediatric", supportedOperations: ["set", "append"] },
  "pediatricDetails.immunizationHistory": { path: "pediatricDetails.immunizationHistory", section: "Pediatric History", label: "Immunization History", type: "string", appliesTo: "pediatric", supportedOperations: ["set", "append"] },
  "pediatricDetails.developmentalHistory": { path: "pediatricDetails.developmentalHistory", section: "Pediatric History", label: "Developmental History", type: "string", appliesTo: "pediatric", supportedOperations: ["set", "append"] },
  "pediatricDetails.feedingHistory": { path: "pediatricDetails.feedingHistory", section: "Pediatric History", label: "Feeding History", type: "string", appliesTo: "pediatric", supportedOperations: ["set", "append"] },
};

export interface ClinicalPatch {
  path: string;
  operation: "set" | "append" | "addItem";
  value: any;
  label: string;
  section: string;
}

export interface ClinicalTaskResolution {
  intent: ClinicalIntent;
  patches: ClinicalPatch[];
  clinicianUpdateText: string;
  userConfirmationSummary: string;
  requiresConfirmation: boolean;
  ambiguityQuestion?: string;
  progressNoteEntry?: string;
}

/**
 * Classifies clinician message intent deterministically.
 */
export function classifyClinicalTaskIntent(input: string): {
  intent: ClinicalIntent;
  questionPart?: string;
  commandPart?: string;
} {
  const text = (input || "").trim();
  if (!text) return { intent: "QUESTION" };

  // 1. Check for pure App Actions (Discharge Summary, View, Print)
  const isAppAction =
    /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+(?:a\s+|the\s+)?discharge\s+(?:summary|note)\b/i.test(text) ||
    /^\s*discharge\s+(?:summary|note)\s*$/i.test(text) ||
    /^\s*ds\s*$/i.test(text) ||
    /^\s*(?:view|show|open|print)\s+case\s+sheet\s*$/i.test(text);

  if (isAppAction) {
    return { intent: "APP_ACTION", commandPart: text };
  }

  const hasQuestionWord = /\b(?:should\s+(?:i|we)|can\s+(?:we|i)|what\s+dose|is\s+it\s+safe|recommend|guideline|differential\s+for|suggest)\b/i.test(text);
  const endsWithQuestion = text.endsWith("?");

  const hasUpdateIndicator =
    /\b(?:add|insert|update|set|mark|record|enter|send|sent|given|administered|inj|iv|im|mg|gm|stat|efast|fast|foley|catheter|past\s+medical|sample|allerg|medication|vitals|bp|pulse|hr|spo2|rr|temp|grbs|gcs|icu|ward|admit|discharge|reviewed|consulted|pallor|icterus|cyanosis|edema)\b/i.test(text);

  if ((endsWithQuestion || hasQuestionWord) && hasUpdateIndicator) {
    return { intent: "MIXED", questionPart: text, commandPart: text };
  }

  if (endsWithQuestion || (hasQuestionWord && !hasUpdateIndicator)) {
    return { intent: "QUESTION", questionPart: text };
  }

  if (/^(?:add|insert|set|update|mark|send|record|plan)\b/i.test(text)) {
    return { intent: "CASE_UPDATE", commandPart: text };
  }

  return { intent: "DOCUMENT_FACT", commandPart: text };
}

// ── Full-dictation gate ──────────────────────────────────────────────
// Full multi-section dictations are owned by the LLM extraction + explicit-section
// parsers in scribeChatTurn.ts. The patch regexes below are built for short,
// single-line commands and corrupt multi-section text (e.g. `\bpa` inside "Patma",
// "heart rate" read as a pericardial view, CNS power grades overwritten).
const FULL_DICTATION_MARKERS: RegExp[] = [
  /\bprimary\s+(?:assessment|survey)\b/i,
  /\bsecondary\s+(?:assessment|survey)\b/i,
  /\bhistory\s+of\s+presenting\s+illness\b/i,
  /\bgeneral\s+exam(?:ination)?\b/i,
  /\bsystemic\s+exam(?:ination)?\b/i,
  /\bcvs\b/i,
  /\bcns\b/i,
  /\bpsychological\s+assessment\b/i,
  /\binvestigations?\s*:/i,
  /\btreatment\s+plan\b/i,
  /\bdifferential\s+diagnosis\b/i,
];

export function isFullDictation(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean).length;
  const markers = FULL_DICTATION_MARKERS.filter(r => r.test(text)).length;
  return words > 60 || markers >= 2;
}

/**
 * Normal-Language Target Resolver (server-side):
 * Transforms unstructured clinical update sentences into structured patches against the registry.
 */
export function resolveNaturalLanguageClinicalTask(
  rawInputText: string,
  currentCase?: any,
  isPediatricCase?: boolean,
  clientTimeString?: string
): ClinicalTaskResolution {
  const text = (rawInputText || "").trim();
  const { intent } = classifyClinicalTaskIntent(text);

  if (intent === "QUESTION") {
    return {
      intent: "QUESTION",
      patches: [],
      clinicianUpdateText: text,
      userConfirmationSummary: "",
      requiresConfirmation: false
    };
  }

  // Full dictations: zero deterministic patches. Extraction owns every field.
  if (isFullDictation(text)) {
    return {
      intent,
      patches: [],
      clinicianUpdateText: text,
      userConfirmationSummary: "",
      requiresConfirmation: false
    };
  }

  const patches: ClinicalPatch[] = [];
  const time = clientTimeString || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 0. Vitals Extraction (BP, HR, RR, SpO2, Temp, GRBS)
  const bpMatch = text.match(/\b(?:bp|blood\s+pressure)\s*(?:is|:|=)?\s*(\d{2,3}\s*\/\s*\d{2,3})\b/i) ||
                  text.match(/\b(\d{2,3}\/\d{2,3})\s*(?:mmhg)?\b/i);
  if (bpMatch && bpMatch[1]) {
    const bpVal = bpMatch[1].replace(/\s+/g, "");
    patches.push({
      path: "vitals.bp",
      operation: "set",
      value: bpVal,
      label: `Vitals → BP: ${bpVal} mmHg`,
      section: "Vitals"
    });
  }

  const hrMatch = text.match(/\b(?:hr|pulse|heart\s+rate)\s*(?:is|:|=)?\s*(\d{2,3})\s*(?:bpm)?\b/i) ||
                  text.match(/\b(\d{2,3})\s*(?:bpm)\b/i);
  if (hrMatch && hrMatch[1]) {
    patches.push({
      path: "vitals.hr",
      operation: "set",
      value: hrMatch[1],
      label: `Vitals → HR: ${hrMatch[1]} bpm`,
      section: "Vitals"
    });
  }

  const rrMatch = text.match(/\b(?:rr|resp\s+rate|respiratory\s+rate)\s*(?:is|:|=)?\s*(\d{1,2})\s*(?:cpm|bpm|\/min)?\b/i);
  if (rrMatch && rrMatch[1]) {
    patches.push({
      path: "vitals.rr",
      operation: "set",
      value: rrMatch[1],
      label: `Vitals → RR: ${rrMatch[1]} /min`,
      section: "Vitals"
    });
  }

  const spo2Match = text.match(/\b(?:spo2|o2\s*sat|saturation)\s*(?:is|:|=)?\s*(\d{2,3})\s*%?\b/i) ||
                    text.match(/\b(\d{2,3})%\s*(?:on\s*(?:ra|room\s*air)|spO2)?\b/i);
  if (spo2Match && spo2Match[1]) {
    patches.push({
      path: "vitals.spo2",
      operation: "set",
      value: `${spo2Match[1]}%`,
      label: `Vitals → SpO2: ${spo2Match[1]}%`,
      section: "Vitals"
    });
  }

  const tempMatch = text.match(/\b(?:temp|temperature)\s*(?:is|:|=)?\s*(\d{2,3}(?:\.\d)?)\s*(?:°?[cf]|deg)?\b/i);
  if (tempMatch && tempMatch[1]) {
    patches.push({
      path: "vitals.temp",
      operation: "set",
      value: tempMatch[1],
      label: `Vitals → Temp: ${tempMatch[1]}`,
      section: "Vitals"
    });
  }

  const grbsMatch = text.match(/\b(?:grbs|rbs|blood\s+sugar|glucose)\s*(?:is|:|=)?\s*(\d{2,3})\s*(?:mg\/dl)?\b/i);
  if (grbsMatch && grbsMatch[1]) {
    patches.push({
      path: "vitals.grbs",
      operation: "set",
      value: grbsMatch[1],
      label: `Vitals → GRBS: ${grbsMatch[1]} mg/dL`,
      section: "Vitals"
    });
  }

  // Ambiguity check
  if (/\btroponin\s+(?:is\s+)?positive\b/i.test(text) && !/\b(?:lab|result|differ|differential|diagnosis|investigation)\b/i.test(text)) {
    return {
      intent,
      patches: [],
      clinicianUpdateText: text,
      userConfirmationSummary: "",
      requiresConfirmation: true,
      ambiguityQuestion: "Document 'Troponin positive' as a lab result or add Acute Coronary Syndrome to the differential diagnosis?"
    };
  }

  // 1. eFAST / POCUS Bedside Diagnostics
  if (/\b(?:efast|fast|pocus|bedside\s+echo|ultrasound)\b/i.test(text)) {
    const isPositive = /\b(?:positive|fluid|free\s+fluid|hemoperitoneum|collection)\b/i.test(text);
    const isNegative = /\b(?:negative|clear|normal|no\s+fluid)\b/i.test(text);

    let organ: string | null = null;
    let organKey: "heart" | "abdomen" | "pelvis" | null = null;

    if (/\b(?:bladder|pelvis|pelvic|suprapubic)\b/i.test(text)) {
      organ = "Pelvis / Bladder"; organKey = "pelvis";
    } else if (/\b(?:ruq|morison\w*|hepatorenal|liver)\b/i.test(text)) {
      organ = "RUQ / Morison's pouch"; organKey = "abdomen";
    } else if (/\b(?:luq|splenorenal|spleen)\b/i.test(text)) {
      organ = "LUQ / Splenorenal"; organKey = "abdomen";
    } else if (/\b(?:heart(?!\s+rate)|pericard\w*|subxiphoid)\b/i.test(text)) {
      organ = "Subxiphoid / Pericardial"; organKey = "heart";
    }

    const status = isPositive ? "Positive (free fluid detected)" : isNegative ? "Negative" : "Documented";
    // No organ named → record the global statement only. Never invent a specific view.
    const findingStr = organ ? `${organ}: ${status}` : `eFAST: ${status}`;

    patches.push({
      path: "adjuncts.efastNotes",
      operation: "append",
      value: findingStr,
      label: `eFAST / POCUS → ${findingStr}`,
      section: "Bedside Diagnostics"
    });

    if (organKey) {
      patches.push({
        path: "fastFindings",
        operation: "set",
        value: { [organKey]: status },
        label: `eFAST Organ Map → ${organKey}: ${status}`,
        section: "Bedside Diagnostics"
      });
    }
  }

  // 2. SAMPLE History & Psychological Assessment
  if (/\b(?:sample|past\s+medical|allerg|medication|psychological)\b/i.test(text)) {
    // PMH Nil
    if (/(?:past\s+medical(?:\s+history)?|pmh)\b[^.]*?\b(?:nil|none|no\s+comorbidities|nkco|negative)\b/i.test(text) ||
        /\b(?:nil|no)\s+(?:past\s+medical\s+history|pmh|comorbidities)\b/i.test(text)) {
      patches.push({
        path: "sampleHistory.pastHistory",
        operation: "set",
        value: "Nil",
        label: "SAMPLE → Past Medical History: Nil",
        section: "SAMPLE History"
      });
    }

    // Allergies Nil
    if (/allerg(?:y|ies)\b[^.]*?\b(?:nil|none|no\s+known|nkda|negative)\b/i.test(text) ||
        /\b(?:nil|no)\s+allerg(?:y|ies)\b/i.test(text)) {
      patches.push({
        path: "sampleHistory.allergies",
        operation: "set",
        value: "Nil",
        label: "SAMPLE → Allergies: Nil",
        section: "SAMPLE History"
      });
    }

    // Medications Nil
    if (/(?:regular\s+)?medication(?:s)?\b[^.]*?\b(?:nil|none|not\s+taking|negative)\b/i.test(text) ||
        /\b(?:nil|no)\s+(?:regular\s+)?medications\b/i.test(text)) {
      patches.push({
        path: "sampleHistory.medications",
        operation: "set",
        value: "Nil",
        label: "SAMPLE → Medications: Nil",
        section: "SAMPLE History"
      });
    }

    // Psychological Assessment — verbatim dictated content only, never collapsed to "Normal"
    const psychMatch = text.match(
      /\b(?:psychological|psychiatric)\s+(?:assessment|evaluation|status)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i
    );
    if (psychMatch && psychMatch[1] && psychMatch[1].trim()) {
      const val = psychMatch[1].trim();
      patches.push({
        path: "sampleHistory.psychiatricFlags",
        operation: "set",
        value: val,
        label: `SAMPLE → Psychological Assessment: ${val}`,
        section: "SAMPLE History"
      });
    }

    // Last Meal
    const lastMealMatch = text.match(/last\s+meal\s*(?:at|is|was|:)?\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm|hours\s+ago)?|[a-zA-Z0-9\s]+?)(?=\.|,|$)/i);
    if (lastMealMatch && lastMealMatch[1]) {
      const mealVal = lastMealMatch[1].trim();
      patches.push({
        path: "sampleHistory.lastMeal",
        operation: "set",
        value: mealVal,
        label: `SAMPLE → Last Meal: ${mealVal}`,
        section: "SAMPLE History"
      });
    }
  }

  // 3. Treatments
  const treatmentMatch = text.match(/(?:add\s+|give\s+|administer\s+|start\s+)?(?:inj\.?|tab\.?|syrup|infusion)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+([0-9]+(?:\.[0-9]+)?\s*(?:mg|g|gm|ml|mcg|units|meq|fr))\s*(iv|oral|im|sc|subcutaneous|inhalation|pr|po)?\s*(stat|sos|od|bd|tds|qid|q8h|q6h|continuous)?/i);
  if (treatmentMatch && treatmentMatch[1] && !["efast", "fast", "foley", "catheter", "meal", "sample"].includes(treatmentMatch[1].toLowerCase())) {
    const rawDrug = treatmentMatch[1].trim();
    const dose = treatmentMatch[2].trim();
    const route = (treatmentMatch[3] || "IV").toUpperCase();
    const instruction = treatmentMatch[4] ? treatmentMatch[4].toUpperCase() : "Stat";
    const drugName = rawDrug.charAt(0).toUpperCase() + rawDrug.slice(1);

    const treatmentItem = {
      id: `trt-cmd-${Date.now()}`,
      drugName,
      dose,
      route,
      instruction,
      timeGiven: time,
      ipsgVerified: true,
      provenance: "scribe"
    };

    patches.push({
      path: "treatments",
      operation: "addItem",
      value: treatmentItem,
      label: `Treatment → ${drugName} ${dose} ${route} ${instruction}`,
      section: "Treatments"
    });
  }

  // 4. Investigations
  const sendMatch = text.match(/(?:send|order|check|plan)\s+(?:serum\s+)?([a-zA-Z0-9\s,/-]+?)(?=\s+and|\s+along|\.|$)/i);
  if (sendMatch && sendMatch[1]) {
    const candidateTests = sendMatch[1].split(/,|\band\b/).map(t => t.trim()).filter(Boolean);
    for (const test of candidateTests) {
      if (!/^(?:inj|tab|foley|catheter|icu|ward|efast|fast)$/i.test(test)) {
        const formattedTest = test.replace(/\b\w/g, c => c.toUpperCase());
        const invObj = {
          id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          testName: formattedTest,
          result: "Ordered",
          orderTime: time,
          resultTime: "Pending",
          isAbnormal: false
        };

        patches.push({
          path: "investigations",
          operation: "addItem",
          value: invObj,
          label: `Investigations → ${formattedTest}`,
          section: "Investigations"
        });

        patches.push({
          path: "investigationLabsOrdered",
          operation: "append",
          value: formattedTest,
          label: `Labs Ordered → ${formattedTest}`,
          section: "Investigations"
        });
      }
    }
  }

  // 5. Procedures
  if (/\b(?:catheter|foley|ng\s*tube|ryles|sutur|stitch|lavage|splint|reduction|intubat)\b/i.test(text)) {
    let procCode = "other";
    let procName = text.replace(/^(?:add\s+|insert\s+)/i, "").trim();

    if (/\b(?:foley|catheter)\b/i.test(text)) procCode = "foleys";
    else if (/\b(?:ng\s*tube|ryle)\b/i.test(text)) procCode = "ng_tube";
    else if (/\b(?:lavage)\b/i.test(text)) procCode = "gastric_lavage";
    else if (/\b(?:sutur|stitch)\b/i.test(text)) procCode = "suturing";
    else if (/\b(?:splint)\b/i.test(text)) procCode = "splinting";
    else if (/\b(?:reduct)\b/i.test(text)) procCode = "reduction";

    patches.push({
      path: "proceduresChecked",
      operation: "addItem",
      value: procCode,
      label: `Procedures Checked → ${procCode}`,
      section: "Procedures"
    });

    patches.push({
      path: "otherProcedures",
      operation: "append",
      value: procName,
      label: `Procedure Notes → ${procName}`,
      section: "Procedures"
    });
  }

  // 6. SAMPLE Events / Preceding History
  const eventMatch = text.match(/\b(?:preceding\s+event|event|mechanism(?:\s+of\s+injury)?)\s*[:\-]?\s*([^\.\n;,]+)/i) ||
    text.match(/\b(snake\s+bite[^\.\n;,]*|scorpion\s+sting[^\.\n;,]*|dog\s+bite[^\.\n;,]*|animal\s+bite[^\.\n;,]*|organophosphate\s+poisoning[^\.\n;,]*|consumption\s+of\s+[^\.\n;,]+|accidental\s+ingestion[^\.\n;,]*|overdose[^\.\n;,]*|fall\s+from\s+[^\.\n;,]+|slip\s+and\s+fall[^\.\n;,]*|physical\s+assault[^\.\n;,]*|stab\s+injury[^\.\n;,]*|electrocution[^\.\n;,]*|near\s+drowning[^\.\n;,]*|two-wheeler\s+vs\s+four-wheeler[^\.\n;,]*|road\s+traffic\s+accident[^\.\n;,]*|rta\b[^\.\n;,]*)/i);
  if (eventMatch && eventMatch[1]) {
    let evVal = eventMatch[1].trim();
    if (/^rta\s+/i.test(evVal)) evVal = evVal.replace(/^rta\s+/i, "Road traffic accident involving ");
    else if (/^rta$/i.test(evVal)) evVal = "Road traffic accident";
    else if (/^two-wheeler\s+vs/i.test(evVal)) evVal = "Road traffic accident involving " + evVal;
    evVal = evVal.charAt(0).toUpperCase() + evVal.slice(1);

    patches.push({
      path: "sampleHistory.events",
      operation: "set",
      value: evVal,
      label: `Preceding Events → ${evVal}`,
      section: "SAMPLE History"
    });
    patches.push({
      path: "events",
      operation: "set",
      value: evVal,
      label: `Events → ${evVal}`,
      section: "SAMPLE History"
    });
  }

  // 7. Secondary Examination (All 6 Systems)
  // Header alternations carry a trailing \b (so `pa` cannot match inside "Patma",
  // `rs` inside other words), and value groups are decimal-safe (stop at a
  // sentence period, never at the "." inside "7.425").
  // General Examination
  if (/\b(?:pallor|icterus|cyanosis|clubbing|lymphadenopathy|edema|oedema|pedal\s+edema|general\s+exam(?:ination)?)\b/i.test(text) && !/\b(?:cvs|cns|rs|pa|respiratory|abdomen)\b/i.test(text)) {
    const cleanExam = text.replace(/^(?:add\s+|general\s+exam(?:ination)?\s*:?\s*)/i, "").trim();
    patches.push({
      path: "secondarySurvey.general",
      operation: "append",
      value: cleanExam,
      label: `General Examination → ${cleanExam}`,
      section: "Secondary Exam"
    });
  }

  // CVS Examination
  const cvsMatch = text.match(/\b(?:cvs|cardiovascular(?:\s+system)?)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i) ||
    text.match(/\b(s1\s+s2\s+heard[^\.\n;,]*|no\s+murmurs?[^\.\n;,]*|systolic\s+murmur[^\.\n;,]*)/i);
  if (cvsMatch && cvsMatch[1]) {
    const val = cvsMatch[1].trim();
    patches.push({
      path: "secondarySurvey.cvs",
      operation: "append",
      value: val,
      label: `CVS Examination → ${val}`,
      section: "Secondary Exam"
    });
  }

  // Respiratory (RS) Examination
  const respMatch = text.match(/\b(?:rs|respiratory(?:\s+system)?|chest(?:\s*[\/\-]\s*rs)?)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i) ||
    text.match(/\b(bilateral\s+air\s+entry[^\.\n;,]*|air\s+entry\s+bilaterally\s+equal[^\.\n;,]*|normal\s+vesicular\s+breath\s+sounds[^\.\n;,]*|bilateral\s+wheeze[^\.\n;,]*|bilateral\s+crepitations?[^\.\n;,]*|clear\s+breath\s+sounds[^\.\n;,]*)/i);
  if (respMatch && respMatch[1]) {
    const val = respMatch[1].trim();
    patches.push({
      path: "secondarySurvey.respiratory",
      operation: "append",
      value: val,
      label: `Respiratory (RS) → ${val}`,
      section: "Secondary Exam"
    });
  }

  // Abdomen (PA) Examination
  const abdMatch = text.match(/\b(?:pa|p\/a|per\s+abdomen|abdomen(?:\s+exam(?:ination)?)?)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i) ||
    text.match(/\b(abdomen\s+soft[^\.\n;,]*|per\s+abdomen\s+soft[^\.\n;,]*|soft\s+non[- ]tender[^\.\n;,]*|tenderness\s+in\s+[^\.\n;,]+|guarding[^\.\n;,]*|rigidity[^\.\n;,]*|bowel\s+sounds\s+present[^\.\n;,]*)/i);
  if (abdMatch && abdMatch[1]) {
    const val = abdMatch[1].trim();
    patches.push({
      path: "secondarySurvey.abdomen",
      operation: "append",
      value: val,
      label: `Abdomen (PA) → ${val}`,
      section: "Secondary Exam"
    });
  }

  // CNS Examination
  const cnsMatch = text.match(/\b(?:cns|central\s+nervous\s+system|neurological(?:\s+exam(?:ination)?)?)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i) ||
    text.match(/\b(conscious\s+and\s+oriented[^\.\n;,]*|moving\s+all\s+four\s+limbs[^\.\n;,]*|no\s+focal\s+neurological\s+deficit[^\.\n;,]*|cranial\s+nerves\s+intact[^\.\n;,]*|plantars\s+flexor[^\.\n;,]*)/i);
  if (cnsMatch && cnsMatch[1]) {
    const val = cnsMatch[1].trim();
    patches.push({
      path: "secondarySurvey.cns",
      operation: "append",
      value: val,
      label: `CNS Examination → ${val}`,
      section: "Secondary Exam"
    });
  }

  // Extremities Examination
  const extMatch = text.match(/\b(?:extremit(?:y|ies)|local\s+exam(?:ination)?)\b\s*[:\-]?\s*((?:[^.\n;]|(?<=\d)\.(?=\d))+)/i) ||
    text.match(/\b(peripheral\s+edema[^\.\n;,]*|pedal\s+edema[^\.\n;,]*|peripheral\s+pulses\s+palpable[^\.\n;,]*|no\s+deformity[^\.\n;,]*|swelling\s+over\s+[^\.\n;,]+)/i);
  if (extMatch && extMatch[1]) {
    const val = extMatch[1].trim();
    patches.push({
      path: "secondarySurvey.extremities",
      operation: "append",
      value: val,
      label: `Extremities → ${val}`,
      section: "Secondary Exam"
    });
  }

  // 8. Consultations
  const consultMatch =
    text.match(/(?:urgent\s+)?([a-zA-Z]+(?:\s+surgery|\s+medicine|\s+obgyn|\s+gynecology)?)\s+(?:consult(?:ation)?(?:\s+requested|\s+sought|\s+called|\s+sent|\s+planned)?|reviewed|consulted|opinion\s+taken|advised|referral)\b/i) ||
    text.match(/(?:consult|refer\s+to|opinion\s+from)\s+(?:urgent\s+)?([a-zA-Z]+(?:\s+surgery|\s+medicine)?)\b/i);
  if (consultMatch && consultMatch[1] && !["patient", "resident", "consultant", "nurse", "er"].includes(consultMatch[1].toLowerCase())) {
    const rawSpecialty = consultMatch[1].trim();
    const specialty = normalizeConsultationSpecialty(rawSpecialty) || rawSpecialty.replace(/\b\w/g, c => c.toUpperCase());
    patches.push({
      path: "dispositionAndPlan.consultsRequested",
      operation: "addItem",
      value: specialty,
      label: `Consultations → ${specialty}`,
      section: "Consultations"
    });
    patches.push({
      path: "consultsRequested",
      operation: "addItem",
      value: specialty,
      label: `Consultations → ${specialty}`,
      section: "Consultations"
    });
    patches.push({
      path: "consultantReview",
      operation: "append",
      value: `${specialty} consult requested / reviewed`,
      label: `Consultant Review → ${specialty}`,
      section: "Consultations"
    });
  }

  // 9. Disposition
  if (/\b(?:plan\s+)?(?:icu\s+admission|admit\s+to\s+icu|admit\s+to\s+ward|discharge\s+home|transfer\s+to|lama|referral)\b/i.test(text)) {
    let dispStatus = "Admit to ICU";
    if (/\b(?:ward)\b/i.test(text)) dispStatus = "Admit to Ward";
    else if (/\b(?:discharge)\b/i.test(text)) dispStatus = "Discharge Home";
    else if (/\b(?:lama)\b/i.test(text)) dispStatus = "LAMA";
    else if (/\b(?:refer)\b/i.test(text)) dispStatus = "Refer to Higher Center";

    patches.push({
      path: "dispositionAndPlan.dispositionStatus",
      operation: "set",
      value: dispStatus,
      label: `Disposition → ${dispStatus}`,
      section: "Disposition"
    });

    patches.push({
      path: "dispositionAndPlan.managementPlan",
      operation: "append",
      value: text.replace(/^(?:add\s+|plan\s+)/i, "").trim(),
      label: `Management Plan → ${text.trim()}`,
      section: "Disposition"
    });
  }

  // Progress Note Entry
  const progressNoteText = `[${time}] — ${text.replace(/^add\s+/i, "")}`;

  let summary = "";
  if (patches.length === 1) {
    summary = `✓ Updated ${patches[0].label}`;
  } else if (patches.length > 1) {
    const uniqueLabels = Array.from(new Set(patches.map(p => p.label)));
    summary = `${uniqueLabels.length} updates ready:\n${uniqueLabels.map(l => `• ${l}`).join("\n")}`;
  }

  return {
    intent,
    patches,
    clinicianUpdateText: text,
    userConfirmationSummary: summary,
    requiresConfirmation: patches.length > 0,
    progressNoteEntry: progressNoteText
  };
}

/**
 * Validates and safely applies patches to a ClinicalCase without losing existing fields.
 * Follows Delta Merge Safety Rules strictly.
 */
export function applyClinicalPatchesToCase(
  currentCase: any,
  patches: ClinicalPatch[],
  clinicianUpdateText?: string,
  clientTime?: string
): any {
  if (!currentCase) return currentCase;

  // Deep clone to prevent direct object mutations
  const updated = JSON.parse(JSON.stringify(currentCase));
  const time = clientTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  for (const patch of patches) {
    const reg = CLINICAL_FIELD_REGISTRY[patch.path];
    if (!reg) {
      console.warn(`[ClinicalTaskApplier] Unknown registry path: ${patch.path}, skipping.`);
      continue;
    }

    // Apply by path segments
    const segments = patch.path.split(".");
    if (segments.length === 1) {
      const field = segments[0];
      if (patch.operation === "set") {
        updated[field] = patch.value;
      } else if (patch.operation === "append") {
        const existing = updated[field] || "";
        updated[field] = existing ? `${existing}; ${patch.value}` : String(patch.value);
      } else if (patch.operation === "addItem") {
        const existingArr = Array.isArray(updated[field]) ? updated[field] : [];
        if (field === "consultsRequested") {
          updated[field] = deduplicateConsultations([...existingArr, patch.value]);
        } else if (typeof patch.value === "string") {
          if (!existingArr.includes(patch.value)) existingArr.push(patch.value);
          updated[field] = existingArr;
        } else if (typeof patch.value === "object" && patch.value !== null) {
          const exists = existingArr.some((item: any) =>
            (item.drugName && item.drugName.toLowerCase() === (patch.value.drugName || "").toLowerCase()) ||
            (item.testName && item.testName.toLowerCase() === (patch.value.testName || "").toLowerCase())
          );
          if (!exists) existingArr.push(patch.value);
          updated[field] = existingArr;
        } else {
          updated[field] = existingArr;
        }
      }
    } else if (segments.length === 2) {
      const [parent, child] = segments;
      if (!updated[parent]) updated[parent] = {};
      const targetObj = updated[parent];

      if (patch.operation === "set") {
        targetObj[child] = patch.value;
      } else if (patch.operation === "append") {
        const existing = targetObj[child] || "";
        targetObj[child] = existing ? `${existing}; ${patch.value}` : String(patch.value);
      } else if (patch.operation === "addItem") {
        const existingArr = Array.isArray(targetObj[child]) ? targetObj[child] : [];
        if (child === "consultsRequested") {
          targetObj[child] = deduplicateConsultations([...existingArr, patch.value]);
        } else {
          if (!existingArr.includes(patch.value)) existingArr.push(patch.value);
          targetObj[child] = existingArr;
        }
      }
    }
  }

  // Progress Notes Continuity: append chronological update note
  if (clinicianUpdateText && clinicianUpdateText.trim()) {
    const cleanText = clinicianUpdateText.trim();
    if (!/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(cleanText)) {
      const noteLine = `[${time}] — ${cleanText.replace(/^add\s+/i, "")}`;
      const existingNotes = (updated.progressNotes || "").trim();
      if (!existingNotes.includes(cleanText)) {
        updated.progressNotes = existingNotes ? `${existingNotes}\n${noteLine}` : noteLine;
      }
    }
  }

  return updated;
}