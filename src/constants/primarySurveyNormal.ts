/**
 * src/constants/primarySurveyNormal.ts
 *
 * CANONICAL SOURCE OF TRUTH: Primary Survey (ABCDE) Normal Template
 *
 * Approved clinical narratives and structured fields:
 * - A (Airway): "Airway patent. No stridor or obstruction."
 * - B (Breathing): "Equal chest expansion. Vesicular breath sounds bilaterally. No added sounds."
 * - C (Circulation): "Warm peripheries. CRT < 2 seconds. Pulses palpable bilaterally."
 * - D (Disability): "GCS 15/15. Pupils equal and reactive to light. No focal neurological deficit."
 *   Explicit Primary Survey normal action sets E4 V5 M6 = 15/15.
 * - E (Exposure): "No external injuries or significant findings."
 *
 * INVARIANT: Never overwrites measured numeric vitals (RR, SpO2, HR, BP, Temp, GRBS, Pain).
 */

export const CANONICAL_PRIMARY_SURVEY_NARRATIVE = {
  airway: "Airway patent. No stridor or obstruction.",
  breathing: "Equal chest expansion. Vesicular breath sounds bilaterally. No added sounds.",
  circulation: "Warm peripheries. CRT < 2 seconds. Pulses palpable bilaterally.",
  disability: "GCS 15/15. Pupils equal and reactive to light. No focal neurological deficit.",
  exposure: "No external injuries or significant findings.",
} as const;

export const CANONICAL_PRIMARY_SURVEY_STATUS = {
  airwayStatus: "Normal" as const,
  breathingStatus: "Normal" as const,
  circulationStatus: "Normal" as const,
  disabilityStatus: "Normal" as const,
  exposureStatus: "Normal" as const,
};

/**
 * Structured survey values matching PrimarySurvey interface in src/types.ts
 */
export function getCanonicalPrimarySurveyNormalObject(caseType: string = "Medical") {
  const isTrauma = caseType?.toLowerCase() === "trauma";
  return {
    airway: {
      status: "patent",
      intervention: null,
      cSpine: isTrauma ? "immobilised" : "not_applicable",
    },
    breathing: {
      workOfBreathing: "normal",
      airEntry: "Bilaterally equal",
      addedSounds: "Clear",
      chestWall: isTrauma ? "Normal" : null,
      o2Delivery: "Room air",
    },
    circulation: {
      rhythm: "regular",
      crt: "<2sec",
      peripheralPulses: "normal",
      skinPerfusion: "Warm + dry",
      bleeding: isTrauma ? "Nil" : null,
      ivAccess: null,
    },
    disability: {
      gcsE: "4",
      gcsV: "5",
      gcsM: "6",
      gcsTotal: "15",
      pupilsEqual: true,
      pupilSizeR: "3",
      pupilSizeL: "3",
      pupilReaction: "reactive",
      focalDeficit: "Nil",
      seizure: "none",
    },
    exposure: {
      skin: "No external injuries or significant findings",
      logRoll: isTrauma ? "Spine clear" : null,
      pelvis: isTrauma ? "stable" : null,
      hypothermiaPrevention: true,
    },
  };
}

/**
 * Checks if Primary Survey already contains non-empty or abnormal findings.
 */
export function hasDocumentedPrimarySurveyFindings(
  primaryAssessment?: any,
  surveyObj?: any
): boolean {
  if (!primaryAssessment && !surveyObj) return false;

  const textFields = [
    primaryAssessment?.airway,
    primaryAssessment?.breathing,
    primaryAssessment?.circulation,
    primaryAssessment?.disability,
    primaryAssessment?.exposure,
  ].filter(val => typeof val === "string" && val.trim().length > 0);

  // If any text field exists and isn't the exact canonical normal text
  const isCanonical =
    primaryAssessment?.airway === CANONICAL_PRIMARY_SURVEY_NARRATIVE.airway &&
    primaryAssessment?.breathing === CANONICAL_PRIMARY_SURVEY_NARRATIVE.breathing &&
    primaryAssessment?.circulation === CANONICAL_PRIMARY_SURVEY_NARRATIVE.circulation &&
    primaryAssessment?.disability === CANONICAL_PRIMARY_SURVEY_NARRATIVE.disability &&
    primaryAssessment?.exposure === CANONICAL_PRIMARY_SURVEY_NARRATIVE.exposure;

  if (textFields.length > 0 && !isCanonical) {
    return true;
  }

  // Check structured survey if present
  if (surveyObj) {
    const s = surveyObj;
    // Check airway
    if (s.airway?.status && !["patent", "Normal", "normal"].includes(s.airway.status)) return true;
    if (s.airway?.intervention) return true;
    // Check breathing
    if (s.breathing?.workOfBreathing && !["normal", "Normal"].includes(s.breathing.workOfBreathing)) return true;
    if (s.breathing?.addedSounds && !["Clear", "None", "Nil", "no added sounds"].includes(s.breathing.addedSounds.toLowerCase())) return true;
    // Check circulation
    if (s.circulation?.crt && !["<2sec", "normal", "< 2 seconds", "< 2s"].includes(s.circulation.crt.toLowerCase())) return true;
    if (s.circulation?.rhythm && !["regular", "Normal"].includes(s.circulation.rhythm.toLowerCase())) return true;
    // Check disability
    if (s.disability?.gcsTotal && Number(s.disability.gcsTotal) < 15) return true;
    if (s.disability?.pupilReaction && !["reactive", "Normal"].includes(s.disability.pupilReaction.toLowerCase())) return true;
    if (s.disability?.focalDeficit && !["nil", "none", "no"].includes(s.disability.focalDeficit.toLowerCase())) return true;
  }

  return false;
}
