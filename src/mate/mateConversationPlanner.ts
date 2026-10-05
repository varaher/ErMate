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
 * - write Firestore
 * - create Scribe sessions
 * - decide diagnoses/treatment
 *
 * Clinical content continues unchanged into the existing Scribe.
 *
 * This deterministic planner is the safety/contract layer. A semantic
 * model-based interpreter can later emit the SAME plan shape without
 * changing the execution architecture.
 */

export type MateConversationAction =
  | "BED_STATUS"
  | "PATIENT_OPEN"
  | "CASE_SUMMARY"
  | "CASE_SHEET_OPEN"
  | "PREVIOUS_PATIENT";

export interface MateConversationPlan {
  actions: MateConversationAction[];

  /**
   * True for follow-up references such as:
   * "open it", "summarise him", "show her case"
   *
   * The caller resolves this only from established MATE conversation
   * context. It must never guess a patient.
   */
  refersToRecentPatient: boolean;

  /**
   * Conservative signal only.
   *
   * If true, operational handling must NOT swallow the utterance.
   * The clinical content still belongs to the existing Scribe pipeline.
   */
  mayContainClinicalUpdate: boolean;
}

function has(
  actions: MateConversationAction[],
  action: MateConversationAction
) {
  if (!actions.includes(action)) {
    actions.push(action);
  }
}

export function planMateConversation(
  input: string
): MateConversationPlan {
  const raw = input.trim();

  const text = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const actions: MateConversationAction[] = [];

  const caseSheetOpen =
    /\b(?:open|show|view)\s+(?:(?:the|his|her|their|this|that)\s+)?case\s*sheet\b/i.test(
      text
    );

  if (caseSheetOpen) {
    has(actions, "CASE_SHEET_OPEN");
  }

  const previousPatient =
    /\b(?:go\s+back\s+to|return\s+to|switch\s+back\s+to|open)\s+(?:the\s+)?(?:previous|last)\s+(?:patient|case)\b/i.test(
      text
    );

  if (previousPatient) {
    has(actions, "PREVIOUS_PATIENT");
  }

  const bedStatus =
    /\b(?:occupied|vacant|free|available|unoccupied)\b/i.test(text) ||
    /\bwho(?:'s|\s+is)\s+(?:in|on)\s+(?:the\s+)?(?:bed\s*)?/i.test(
      text
    ) ||
    /\b(?:anyone|somebody|someone)\s+(?:in|on)\s+(?:the\s+)?(?:bed\s*)?/i.test(
      text
    );

  if (bedStatus) {
    has(actions, "BED_STATUS");
  }

  const summary =
    /\b(?:summari[sz]e|summary|brief\s+me|quick\s+summary|give\s+me\s+(?:a\s+)?(?:quick\s+)?summary|tell\s+me\s+about)\b/i.test(
      text
    );

  if (summary) {
    has(actions, "CASE_SUMMARY");
  }

  /*
   * "Open Bed 10B" means establish/switch patient context.
   *
   * "Open the case sheet" is deliberately excluded: that is an ErMate
   * workflow action, not patient-context selection.
   */
  const patientOpen =
    !caseSheetOpen &&
    (
      /\b(?:open|review|switch\s+to|go\s+to|take\s+me\s+to)\s+(?:the\s+)?(?:patient\s+(?:in\s+)?)?(?:bed\b|patient\b|case\b)/i.test(
        text
      ) ||
      /^\s*(?:open|review)\s+(?:it|him|her|them)\s*[.!?]*$/i.test(
        raw
      )
    );

  if (patientOpen) {
    has(actions, "PATIENT_OPEN");
  }

  const refersToRecentPatient =
    !/\bbed\b/i.test(text) &&
    (
      /\b(?:it|him|his|her|them|their)\b/i.test(text) ||
      /\b(?:this|that)\s+(?:patient|case)\b/i.test(text)
    ) &&
    (
      actions.includes("PATIENT_OPEN") ||
      actions.includes("CASE_SUMMARY") ||
      actions.includes("CASE_SHEET_OPEN")
    );

  /*
   * Conservative clinical-update signal.
   *
   * We intentionally do NOT extract the fact here. This only prevents
   * an operational command from consuming clinical dictation.
   */
  const mayContainClinicalUpdate =
    /\b(?:bp|blood\s+pressure|pulse|heart\s+rate|hr|spo2|saturation|respiratory\s+rate|rr|temperature|temp|gcs|grbs|pain\s+score)\b/i.test(
      text
    ) &&
    (
      /\b(?:now|is|was|became|dropped|falling|rising|changed|repeat)\b/i.test(
        text
      ) ||
      /\d/.test(text)
    );

  return {
    actions,
    refersToRecentPatient,
    mayContainClinicalUpdate,
  };
}
