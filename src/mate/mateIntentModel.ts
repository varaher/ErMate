/**
 * MATE turn/intent model.
 *
 * A clinician does NOT have to speak in Q&A or command form. A single natural
 * ER narrative may contain dozens of documentation facts plus corrections,
 * reassessments, plans, questions and app actions.
 *
 * This module defines the contract only. It does not alter the current Scribe,
 * ClinicalCase schema, pediatric routing or Sarvam pipeline.
 */

export type MateAtomicIntent =
  | "CLINICAL_NARRATIVE"
  | "DOCUMENT_FACT"
  | "CORRECTION"
  | "REASSESSMENT"
  | "QUESTION"
  | "APP_ACTION"
  | "WORKFLOW_ACTION";

export type MateTurnKind = MateAtomicIntent | "MIXED";

export type MateFactCertainty =
  | "explicit"
  | "explicit_negative"
  | "explicit_unknown"
  | "ambiguous"
  | "conditional_plan";

export interface MateNarrativeSegment {
  /** Exact source words supporting this segment. */
  evidenceText: string;
  intent: MateAtomicIntent;
  certainty: MateFactCertainty;
  /** Canonical destination hint only; final write is controlled by validated ErMate mapping. */
  destinationHint?: string;
  /** Never inferred. Values are present only when explicitly supported by evidenceText. */
  value?: unknown;
}

export interface MateParsedTurn {
  kind: MateTurnKind;
  /** Original transcript is retained for auditability. */
  transcript: string;
  segments: MateNarrativeSegment[];
  /** True when the turn describes a new patient rather than the current active case. */
  requestsNewCase: boolean;
  /** True when at least one segment needs clinician clarification before a write. */
  needsClarification: boolean;
}

/**
 * Locked MATE narrative rules.
 * These are application invariants, not suggestions to a language model.
 */
export const MATE_NARRATIVE_RULES = Object.freeze({
  explicitPositive: "capture",
  explicitNegative: "capture",
  explicitUnknown: "preserve-unknown",
  unmentioned: "do-not-create",
  ambiguous: "clarify-or-preserve-verbatim",
  contradictory: "flag-do-not-silently-resolve",
  conditionalPlan: "store-as-plan-not-completed-action",
  clinicalDiscussion: "never-write-unless-clinician-explicitly-requests-documentation",
  repeatVitals: "append-reassessment-do-not-overwrite-arrival-vitals",
  partialGcs: "keep-partial-never-complete-by-inference",
  sectionBoundary: "one-fact-one-canonical-destination-unless-schema-explicitly-shares-it",
});

/**
 * Whether a parsed turn contains documentation work. Clinical narratives are
 * documentation-capable even when the doctor never says "document" or "add".
 */
export function mateTurnContainsDocumentation(turn: MateParsedTurn): boolean {
  return turn.segments.some((segment) =>
    segment.intent === "CLINICAL_NARRATIVE" ||
    segment.intent === "DOCUMENT_FACT" ||
    segment.intent === "CORRECTION" ||
    segment.intent === "REASSESSMENT"
  );
}

/**
 * Questions and educational discussion are deliberately separated from factual
 * documentation so model reasoning cannot leak into the patient record.
 */
export function mateTurnContainsClinicalQuestion(turn: MateParsedTurn): boolean {
  return turn.segments.some((segment) => segment.intent === "QUESTION");
}
