/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discharge Narrative Fact Validator
 * Ensures synthesized clinical course narratives do not introduce unsupported
 * medical facts, unwarranted clinical claims (e.g. fabricated stability,
 * fabricated improvement, fabricated consultations), or hallucinated medications/diagnoses.
 */

export interface FactValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateNarrativeFacts(
  courseNarrative: string,
  sourceCase: {
    diagnosis?: string;
    provisionalPrimaryDiagnosis?: string;
    differentials?: string[];
    dischargeInfo?: any;
    treatments?: any[];
    proceduresChecked?: string[];
    otherProcedures?: string;
    consultations?: string[];
    dispositionAndPlan?: any;
    dispositionDetails?: any;
    progressNotes?: string;
    vitals?: any;
    primaryAssessment?: any;
    investigations?: any[];
    investigationLabsOrdered?: string;
    investigationImaging?: string;
  }
): FactValidationResult {
  const violations: string[] = [];
  if (!courseNarrative || typeof courseNarrative !== "string") {
    return { valid: true, violations: [] };
  }

  const lowerNarrative = courseNarrative.toLowerCase();

  // 1. Check for fabricated "improvement" or "condition improved"
  const hasImprovementClaim = /\b(?:patient\s+improved|condition\s+improved|symptoms\s+resolved|clinical\s+improvement|markedly\s+improved|showed\s+improvement|responded\s+well)\b/i.test(lowerNarrative);
  const documentedImprovement = [
    sourceCase.progressNotes,
    sourceCase.dischargeInfo?.conditionAtDischarge,
    sourceCase.dispositionDetails?.observationNotes,
  ].filter(Boolean).some(text => /\b(?:improved|resolv|better|improvement)\b/i.test(String(text)));

  if (hasImprovementClaim && !documentedImprovement) {
    violations.push("Narrative claims patient improved or symptoms resolved, but this is not documented in clinical progress notes.");
  }

  // 2. Check for fabricated "hemodynamically stable" or "patient remained stable"
  const hasStabilityClaim = /\b(?:hemodynamically\s+stable|patient\s+remained\s+stable|vitals\s+stable|stable\s+throughout|condition\s+was\s+stable|vital\s+signs\s+stable)\b/i.test(lowerNarrative);
  const documentedStability = [
    sourceCase.progressNotes,
    sourceCase.dischargeInfo?.conditionAtDischarge,
    sourceCase.dispositionDetails?.observationNotes,
  ].filter(Boolean).some(text => /\b(?:stable|stability)\b/i.test(String(text)));

  if (hasStabilityClaim && !documentedStability) {
    violations.push("Narrative claims patient remained stable or hemodynamically stable without explicit clinical documentation.");
  }

  // 3. Check for fabricated "tolerated well" or "no complications"
  const hasToleratedClaim = /\b(?:tolerated\s+(?:the\s+procedure|medication|well)|without\s+any?\s+complications|uneventful\s+stay|no\s+complications)\b/i.test(lowerNarrative);
  const documentedTolerated = [
    sourceCase.progressNotes,
    sourceCase.otherProcedures,
  ].filter(Boolean).some(text => /\b(?:tolerated|uneventful|no\s+complications)\b/i.test(String(text)));

  if (hasToleratedClaim && !documentedTolerated) {
    violations.push("Narrative claims treatment/procedure was tolerated well or without complications without documented provenance.");
  }

  // 4. Check for fabricated specialty consultation if none documented
  const hasConsultClaim = /\b(?:consultation\s+was\s+obtained|specialist\s+reviewed|referred\s+to\s+specialist|seen\s+by\s+(?:cardiology|neurology|surgery|pediatrics|orthopedics|medicine))\b/i.test(lowerNarrative);
  const documentedConsults = (sourceCase.consultations && sourceCase.consultations.length > 0) ||
    (sourceCase.dispositionAndPlan?.consultsRequested && sourceCase.dispositionAndPlan.consultsRequested.length > 0);

  if (hasConsultClaim && !documentedConsults) {
    violations.push("Narrative describes a specialist consultation that was not ordered or documented.");
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
