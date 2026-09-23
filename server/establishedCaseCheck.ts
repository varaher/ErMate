/**
 * establishedCaseCheck.ts
 *
 * Distinguishes between a newly created/minimal demographics-only case
 * and an actually established Case Sheet.
 *
 * Rules:
 * - A newly created demographics-only/minimal case (with just ID, name, age,
 *   presenting complaint, baseline vitals, or empty defaults) is NOT established.
 * - An established case is recognized by REAL evidence:
 *   1. Persisted or applied Scribe extraction history (e.g. extractionApplied === true
 *      or confirmation of previous case sheet preparation).
 *   2. Meaningful clinical Case Sheet content:
 *      - Documented progressNotes / chronological notes.
 *      - Documented treatments / medications in ER.
 *      - Documented diagnostic investigations (labs / imaging).
 *      - Documented differential diagnoses.
 *      - Documented procedures or clinical impressions / treatment notes.
 *      - Meaningful Primary Survey narrative (ABCDE) beyond blank/default status.
 *      - Meaningful Secondary Survey findings across organ systems.
 *      - Meaningful SAMPLE history beyond demographics (past history, medications,
 *        allergies, or events).
 */

export function isEstablishedCaseSheet(
  caseData: any,
  messages?: any[]
): boolean {
  if (!caseData || typeof caseData !== "object") return false;

  // 1. Evidence of persisted/applied Scribe extraction history
  if (Array.isArray(messages) && messages.length > 0) {
    if (
      messages.some(
        (m: any) =>
          m &&
          (m.extractionApplied === true ||
            (typeof m.id === "string" && m.id.endsWith("-case-sheet-prepared")) ||
            (typeof m.text === "string" && m.text.includes("Case Sheet prepared successfully")))
      )
    ) {
      return true;
    }
  }
  if (caseData.hasAppliedScribeHistory === true) {
    return true;
  }

  // 2. Meaningful clinical progress notes
  if (typeof caseData.progressNotes === "string") {
    const cleanNotes = caseData.progressNotes.trim();
    if (
      cleanNotes.length > 0 &&
      cleanNotes !== "Case created via ErMate Voice Scribe dictation."
    ) {
      return true;
    }
  }

  // 3. Documented ER treatments / medications
  if (Array.isArray(caseData.treatments) && caseData.treatments.length > 0) {
    return true;
  }

  // 4. Documented diagnostic investigations (ordered labs/imaging)
  if (Array.isArray(caseData.investigations) && caseData.investigations.length > 0) {
    return true;
  }

  // 5. Documented differential diagnoses
  if (Array.isArray(caseData.differentials) && caseData.differentials.length > 0) {
    return true;
  }

  // 6. Documented procedures or clinical impressions / treatment notes
  if (Array.isArray(caseData.procedures) && caseData.procedures.length > 0) {
    return true;
  }
  if (typeof caseData.treatmentNotes === "string" && caseData.treatmentNotes.trim().length > 0) {
    return true;
  }
  if (typeof caseData.clinicalImpression === "string" && caseData.clinicalImpression.trim().length > 0) {
    return true;
  }

  // 7. Meaningful Primary Survey narrative (ABCDE) beyond blank/default status
  const pa = caseData.primaryAssessment;
  if (pa && typeof pa === "object") {
    const hasAirwayText = typeof pa.airway === "string" && pa.airway.trim().length > 0;
    const hasBreathingText = typeof pa.breathing === "string" && pa.breathing.trim().length > 0;
    const hasCirculationText = typeof pa.circulation === "string" && pa.circulation.trim().length > 0;
    const hasDisabilityText = typeof pa.disability === "string" && pa.disability.trim().length > 0;
    const hasExposureText = typeof pa.exposure === "string" && pa.exposure.trim().length > 0;
    if (hasAirwayText || hasBreathingText || hasCirculationText || hasDisabilityText || hasExposureText) {
      return true;
    }
    if (pa.survey && typeof pa.survey === "object") {
      const s = pa.survey;
      if (
        (s.airway?.intervention && s.airway.intervention.trim()) ||
        (s.breathing?.workOfBreathing && s.breathing.workOfBreathing.trim()) ||
        (s.circulation?.rhythm && s.circulation.rhythm.trim()) ||
        (s.disability?.focalDeficit && s.disability.focalDeficit.trim())
      ) {
        return true;
      }
    }
  }

  // 8. Meaningful Secondary Survey findings across organ systems
  if (caseData.secondarySurvey && typeof caseData.secondarySurvey === "object") {
    const sec = caseData.secondarySurvey;
    const hasSecFinding = Object.values(sec).some(
      (v: any) => typeof v === "string" && v.trim().length > 0
    );
    if (hasSecFinding) return true;
  }
  if (typeof caseData.secondaryAssessment === "string" && caseData.secondaryAssessment.trim().length > 0) {
    return true;
  }

  // 9. Meaningful SAMPLE history beyond demographics/presenting complaint
  const sh = caseData.sampleHistory;
  if (sh && typeof sh === "object") {
    const isMeaningful = (val: any): boolean => {
      if (typeof val !== "string") return false;
      const t = val.trim().toLowerCase();
      return (
        t.length > 0 &&
        !["not documented", "none", "no", "nil", "n/a", "nkda", "none documented"].includes(t)
      );
    };
    if (
      isMeaningful(sh.pastHistory) ||
      isMeaningful(sh.medications) ||
      isMeaningful(sh.allergies) ||
      (typeof sh.events === "string" && sh.events.trim().length > 0)
    ) {
      return true;
    }
  }

  return false;
}
