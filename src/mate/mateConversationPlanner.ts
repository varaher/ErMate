/**
 * MATE Conversational Planner
 *
 * PURPOSE
 * -------
 * Convert ordinary clinician phrasing into a small operational plan.
 *
 * This module is deliberately NON-CLINICAL.
 *
 * It does NOT:
 * - extract clinical facts
 * - modify ClinicalCase
 * - write to Firestore
 * - create Scribe sessions
 * - make diagnostic or treatment decisions
 */

export type MateConversationAction =
  | "BED_STATUS"
  | "PATIENT_OPEN"
  | "CASE_SUMMARY"
  | "CASE_SHEET_OPEN"
  | "PREVIOUS_PATIENT";

export interface MateConversationPlan {
  actions: MateConversationAction[];
  refersToRecentPatient: boolean;
  mayContainClinicalUpdate: boolean;
}

const PRONOUN_REFERENCE_PATTERNS = [
  /\b(?:open|show|view|summarise|summarize|review)\s+(?:it|him|her|them|this\s+patient|this\s+case|this\s+one)\b/i,
  /\b(?:what\s+about|how\s+about)\s+(?:him|her|them|this\s+patient|this\s+case)\b/i,
  /\b(?:his|her|their)\s+(?:case|casesheet|case\s*sheet|summary|details|file)\b/i,
];

const CASE_SUMMARY_PATTERNS = [
  /\bsummaris?e\b/i,
  /\bgive\s+me\s+(?:a\s+)?summary\b/i,
  /\bcase\s+summary\b/i,
  /\bbrief\s+me\s+on\b/i,
  /\btell\s+me\s+about\b/i,
];

const BED_STATUS_PATTERNS = [
  /\bis\s+bed\b/i,
  /\bis\s+[0-9]{1,3}[ab]?\s+occupied\b/i,
  /\bwho\s+is\s+in\s+bed\b/i,
  /\bwho\s+is\s+on\s+bed\b/i,
  /\bwho\s+is\s+in\s+[0-9]{1,3}[ab]?\b/i,
  /\boccupied\b/i,
  /\bvacant\b/i,
  /\bempty\b/i,
  /\bfree\b/i,
];

const PATIENT_OPEN_PATTERNS = [
  /\bopen\s+bed\b/i,
  /\bopen\s+[0-9]{1,3}[ab]?\b/i,
  /\bopen\s+patient\b/i,
  /\bopen\s+him\b/i,
  /\bopen\s+her\b/i,
  /\bopen\s+it\b/i,
  /\bgo\s+to\s+bed\b/i,
  /\bswitch\s+to\s+bed\b/i,
  /\bselect\s+bed\b/i,
];

const CASE_SHEET_OPEN_PATTERNS = [
  /\bcase\s*sheet\b/i,
  /\bopen\s+(?:the\s+)?case\s*sheet\b/i,
  /\bview\s+(?:the\s+)?case\s*sheet\b/i,
  /\bshow\s+(?:the\s+)?case\s*sheet\b/i,
];

const CLINICAL_FACT_INDICATORS = [
  /\bbp\b/i,
  /\bhr\b/i,
  /\bpulse\b/i,
  /\bspo2\b/i,
  /\brr\b/i,
  /\btemp\b/i,
  /\bvitals\b/i,
  /\bgcs\b/i,
  /\bstarted\b/i,
  /\bgiven\b/i,
  /\bmg\b/i,
  /\biv\b/i,
  /\bpain\b/i,
  /\bdrowsy\b/i,
  /\bcomplaining\b/i,
  /\bshortness\s+of\s+breath\b/i,
  /\bsob\b/i,
  /\bvomiting\b/i,
  /\bfever\b/i,
  /\bchest\s+pain\b/i,
];

export function planMateConversation(text: string): MateConversationPlan {
  const trimmed = text.trim();
  const actions: MateConversationAction[] = [];

  const refersToRecentPatient = PRONOUN_REFERENCE_PATTERNS.some((p) =>
    p.test(trimmed)
  );

  if (BED_STATUS_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("BED_STATUS");
  }

  if (CASE_SUMMARY_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("CASE_SUMMARY");
  }

  if (CASE_SHEET_OPEN_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("CASE_SHEET_OPEN");
  }

  if (PATIENT_OPEN_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("PATIENT_OPEN");
  }

  if (/\b(?:previous|last)\s+patient\b/i.test(trimmed)) {
    actions.push("PREVIOUS_PATIENT");
  }

  const mayContainClinicalUpdate = CLINICAL_FACT_INDICATORS.some((p) =>
    p.test(trimmed)
  );

  return {
    actions,
    refersToRecentPatient,
    mayContainClinicalUpdate,
  };
}
