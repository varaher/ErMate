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

export type MateActionCapability =
  | "case.open"
  | "case.document"
  | "case.summary"
  | "case.discharge.preview"
  | "case.discharge.pending"
  | "case.rounds.review"
  | "case.reassessment"
  | "case.search"
  | "case.navigate"
  | "reminder.create";

export type MateAccessMode = "READ" | "WRITE" | "OPERATIONAL";

/**
 * In-flight task execution contract for MATE universal app orchestration.
 *
 * IMPORTANT:
 * - This is NOT a patient record.
 * - Lives only as in-flight orchestration metadata during clinician turn.
 * - Binds strictly to actorUid and references ClinicalCase.id.
 * - Never duplicates clinical schemas or creates a second EMR record.
 */
export interface MateTask {
  readonly taskId: string;
  readonly actorUid: string;
  readonly hospitalId: string | null;
  readonly conversationId: string;
  readonly caseId: string | null;
  readonly bedNo: string | null;
  readonly scribeSessionId: string | null;
  readonly capability: MateActionCapability;
  readonly accessMode: MateAccessMode;
  readonly sourceUtterance: string;
  readonly contextGeneration: number;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface MateTaskResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly message: string;
  readonly errorCode?: string;
  readonly resultData?: Readonly<Record<string, unknown>>;
}

/**
 * Factory for creating an immutable MateTask execution contract.
 * Fails closed if required actor identity or task identifier is missing.
 */
export function createMateTask(params: {
  taskId?: string;
  actorUid: string;
  hospitalId?: string | null;
  conversationId: string;
  caseId?: string | null;
  bedNo?: string | null;
  scribeSessionId?: string | null;
  capability: MateActionCapability;
  accessMode: MateAccessMode;
  sourceUtterance: string;
  contextGeneration: number;
  payload?: Record<string, unknown>;
}): Readonly<MateTask> {
  if (!params.actorUid || String(params.actorUid).trim() === "") {
    throw new Error("Cannot create MateTask: actorUid is strictly required.");
  }
  if (!params.conversationId || String(params.conversationId).trim() === "") {
    throw new Error("Cannot create MateTask: conversationId is strictly required.");
  }
  if (!params.capability) {
    throw new Error("Cannot create MateTask: capability is strictly required.");
  }

  const task: MateTask = {
    taskId: params.taskId || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    actorUid: params.actorUid,
    hospitalId: params.hospitalId || null,
    conversationId: params.conversationId,
    caseId: params.caseId || null,
    bedNo: params.bedNo || null,
    scribeSessionId: params.scribeSessionId || null,
    capability: params.capability,
    accessMode: params.accessMode,
    sourceUtterance: params.sourceUtterance,
    contextGeneration: params.contextGeneration,
    payload: params.payload ? Object.freeze({ ...params.payload }) : undefined,
    createdAt: new Date().toISOString(),
  };

  return Object.freeze(task);
}

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
