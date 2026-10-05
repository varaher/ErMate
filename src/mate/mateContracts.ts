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
  | "NOT_MENTIONED";

export interface MateSectionMapping {
  adultSection: string;
  pediatricSection: string;
  dischargeSection: string;
}

export interface MateFieldProvenance {
  sourceText: string;
  evidence: MateEvidenceState;
  mappedAt: string;
}

export interface MatePreviewEnvelope {
  mode: MateExecutionMode;
  intent: MateIntent;
  caseId: string | null;
  bedNo: string | null;
  pediatric: boolean;
  unappliedExtraction: Record<string, unknown>;
  provenance: Record<string, MateFieldProvenance>;
  requiresConfirmation: boolean;
  notes: string[];
}

export interface MatePreviewResult {
  envelope: MatePreviewEnvelope;
  canApply: boolean;
  reasonsBlocked: string[];
}

/**
 * Locked pediatric routing invariant.
 *
 * Age < 18 always routes to Pediatric Case Sheet.
 * Age >= 18 always routes to Adult Case Sheet.
 * Null age defaults to Adult with a prompt to confirm age.
 */
export function matePediatricRoute(
  patientAgeYears: number | null | undefined
): { isPediatric: boolean; reason: string } {
  if (patientAgeYears === null || patientAgeYears === undefined) {
    return {
      isPediatric: false,
      reason: "Age not specified; default to Adult with age confirmation required",
    };
  }
  if (patientAgeYears < 18) {
    return {
      isPediatric: true,
      reason: `Age ${patientAgeYears} < 18: strictly Pediatric Case Sheet`,
    };
  }
  return {
    isPediatric: false,
    reason: `Age ${patientAgeYears} >= 18: Adult Case Sheet`,
  };
}

/**
 * Locked clinical documentation rules.
 */
export const MATE_DOCUMENTATION_RULES = {
  explicitPositive: "MUST capture and map to corresponding section",
  explicitNegative: "MUST capture as explicit negative, never drop silently",
  notMentioned: "MUST leave null/blank, NEVER infer normal or baseline",
  ambiguous: "MUST flag for confirmation, never guess",
  contradiction: "MUST highlight conflict to clinician before write",
} as const;

/**
 * Locked 7-lens rounds review rules.
 */
export const MATE_ROUNDS_RULES = {
  execution: "READ-ONLY. Never writes to ClinicalCase directly.",
  context: "Must bind to active case or require bed reference.",
  action: "Dispatches to existing ErMate lens pipeline.",
} as const;
