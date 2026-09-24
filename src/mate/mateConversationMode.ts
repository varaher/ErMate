/**
 * MATE consultation / ambient conversation contract.
 *
 * This file intentionally does NOT start recording or change the Sarvam pipeline.
 * It defines how diarized speech must be represented before clinical extraction.
 */

export type MateInputMode = "DICTATION" | "CONSULTATION" | "AMBIENT_ER";

export type MateSpeakerRole =
  | "doctor"
  | "patient"
  | "relative"
  | "nurse"
  | "resident"
  | "other_clinician"
  | "unknown";

export type MateInformationSource =
  | "clinician_dictation"
  | "patient_reported"
  | "collateral_history"
  | "clinician_observed"
  | "clinician_measured"
  | "investigation_result"
  | "unknown";

export interface MateDiarizedUtterance {
  speakerId: string;
  speakerRole: MateSpeakerRole;
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
  roleConfidence?: number;
}

export interface MateConversationSession {
  mode: MateInputMode;
  caseId?: string | null;
  explicitlyStarted: boolean;
  recordingIndicatorVisible: boolean;
  utterances: MateDiarizedUtterance[];
}

export interface MateSourceAttribution {
  speakerId: string;
  speakerRole: MateSpeakerRole;
  informationSource: MateInformationSource;
  evidenceText: string;
}

/**
 * Safety invariant: a doctor's QUESTION is not evidence that the patient has
 * the condition being asked about. Clinical facts require an answer, clinician
 * observation/measurement, investigation result, or explicit clinician dictation.
 */
export function canUtteranceCreateClinicalFact(
  mode: MateInputMode,
  utterance: MateDiarizedUtterance,
): boolean {
  const text = utterance.text.trim();
  if (!text) return false;

  if (mode === "DICTATION") {
    return utterance.speakerRole === "doctor" ||
      utterance.speakerRole === "resident" ||
      utterance.speakerRole === "other_clinician";
  }

  // In consultation/ambient mode, patient and collateral answers may support
  // history facts; clinician speech may support explicit observations/dictation,
  // but interrogative clinician speech must not itself become a patient fact.
  if (
    utterance.speakerRole === "doctor" ||
    utterance.speakerRole === "resident" ||
    utterance.speakerRole === "other_clinician" ||
    utterance.speakerRole === "nurse"
  ) {
    if (/\?\s*$/.test(text)) return false;
    if (/^(?:do|does|did|are|is|was|were|have|has|had|can|could|when|where|what|why|how)\b/i.test(text)) {
      return false;
    }
  }

  return true;
}

export function inferInformationSource(
  mode: MateInputMode,
  utterance: MateDiarizedUtterance,
): MateInformationSource {
  if (mode === "DICTATION") return "clinician_dictation";

  switch (utterance.speakerRole) {
    case "patient":
      return "patient_reported";
    case "relative":
      return "collateral_history";
    case "doctor":
    case "resident":
    case "other_clinician":
    case "nurse":
      return "clinician_observed";
    default:
      return "unknown";
  }
}

/**
 * Unknown speaker identity must remain unknown. MATE must not silently label the
 * second voice as the patient in a multi-person ER environment.
 */
export function requiresSpeakerClarification(utterance: MateDiarizedUtterance): boolean {
  return utterance.speakerRole === "unknown";
}
