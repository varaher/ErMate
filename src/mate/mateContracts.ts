import type { ClinicalCase } from "../types";

/**
 * MATE V1 contracts.
 *
 * MATE is a scribe companion over ErMate's existing ClinicalCase and document
 * formats. It does not introduce a second patient record or redefine Adult,
 * Pediatric, or Discharge Summary schemas.
 */

export type MateMode = "DICTATION" | "CONSULTATION";
export type MateExecutionMode = "PREVIEW" | "WRITE";

export type MateIntent =
  | "CONVERSATION"
  | "CLINICAL_NARRATIVE"
  | "DOCUMENT_FACT"
  | "CORRECTION"
  | "REASSESSMENT"
  | "QUESTION"
  | "ROUNDS"
  | "APP_ACTION"
  | "MIXED";

export type MateEvidenceState =
  | "EXPLICIT_POSITIVE"
  | "EXPLICIT_NEGATIVE"
  | "EXPLICIT_UNKNOWN"
  | "AMBIGUOUS"
  | "CONTRADICTORY"
  | "CONDITIONAL_PLAN";

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

export type MateCapabilityRisk =
  | "READ_ONLY"
  | "NON_DESTRUCTIVE_WRITE"
  | "CONFIRMATION_REQUIRED"
  | "DESTRUCTIVE";

export interface MateEvidence {
  /** Exact words that support the proposed fact. */
  text: string;
  speakerRole: MateSpeakerRole;
  informationSource: MateInformationSource;
}

export interface MateProposedFact {
  id: string;
  state: MateEvidenceState;
  /** Existing ClinicalCase destination only. No parallel MATE schema. */
  destination: string;
  value: unknown;
  evidence: MateEvidence;
  requiresClarification: boolean;
  clarificationReason?: string;
}

export interface MatePreviewResult {
  executionMode: "PREVIEW";
  caseId: ClinicalCase["id"] | null;
  isPediatric: boolean | null;
  intents: MateIntent[];
  proposedFacts: MateProposedFact[];
  blockedFacts: MateProposedFact[];
  questions: string[];
  appActions: string[];
}

/**
 * A MATE capability is a route into an EXISTING ErMate feature. The capability
 * registry must never duplicate the underlying clinical engine.
 */
export interface MateCapability {
  id: string;
  label: string;
  description: string;
  risk: MateCapabilityRisk;
  requiresActiveCase: boolean;
  writesClinicalRecord: boolean;
  existingEndpoint?: string;
}

/**
 * Rounds is an existing ErMate decision-support lane. MATE only routes the
 * current case/question to it and returns its response conversationally.
 * Rounds output is NEVER silently promoted into documentation.
 */
export const MATE_ROUNDS_CAPABILITY: MateCapability = Object.freeze({
  id: "case.rounds.review",
  label: "7-Lens Clinical Rounds",
  description: "Run the active case through ErMate's existing Clinical Rounds / 7-Lens debrief engine.",
  risk: "READ_ONLY",
  requiresActiveCase: true,
  writesClinicalRecord: false,
  existingEndpoint: "/api/rounds-debrief",
});

export const MATE_ROUNDS_RULES = Object.freeze({
  readCurrentCase: true,
  mayAnswerConversationally: true,
  mayIdentifyGaps: true,
  maySuggestConsiderations: true,
  autoDocumentOutput: false,
  autoChangeDiagnosis: false,
  autoChangeTreatment: false,
  autoChangeDisposition: false,
});

/**
 * Locked documentation invariants for MATE V1.
 *
 * Explicit positive -> capture.
 * Explicit negative -> capture.
 * Unmentioned -> never create.
 * Unknown -> preserve as unknown.
 * Ambiguous/contradictory -> do not silently resolve.
 * Conditional plan -> never convert to a completed treatment/disposition.
 * Partial GCS -> never infer missing components or total.
 * Reassessment -> preserve chronology; do not overwrite arrival vitals.
 * Clinical discussion/reasoning -> never enter the record unless the clinician
 * explicitly asks to document it.
 */
export const MATE_DOCUMENTATION_RULES = Object.freeze({
  explicitPositive: "capture",
  explicitNegative: "capture",
  unmentioned: "do-not-create",
  explicitUnknown: "preserve-unknown",
  ambiguous: "block-or-preserve-verbatim",
  contradictory: "block-and-clarify",
  conditionalPlan: "plan-only",
  partialGcs: "never-infer",
  reassessment: "append-chronologically",
  clinicalDiscussion: "do-not-document-by-default",
  roundsOutput: "decision-support-only-unless-explicitly-documented",
});

/** Current executable ErMate routing rule: known age 0-16 is pediatric. */
export function matePediatricRoute(ageYears: number | null | undefined): boolean | null {
  if (ageYears === null || ageYears === undefined) return null;
  return ageYears >= 0 && ageYears <= 16;
}
