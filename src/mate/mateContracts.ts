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
  | "CLINICAL_NARRATIVE"
  | "DOCUMENT_FACT"
  | "CORRECTION"
  | "REASSESSMENT"
  | "QUESTION"
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
});

/** Current executable ErMate routing rule: known age 0-16 is pediatric. */
export function matePediatricRoute(ageYears: number | null | undefined): boolean | null {
  if (ageYears === null || ageYears === undefined) return null;
  return ageYears >= 0 && ageYears <= 16;
}
