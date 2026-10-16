/**
 * ErMate — MATE Conversational Interpretation & Orchestrator Contracts
 *
 * Suggested contract defined in milestone prompt:
 * - MateInterpretation
 * - MatePlannedTask
 * - Task access modes and types
 *
 * Invariants:
 * 1. Interpretation ONLY: does NOT contain clinical field extraction or ClinicalCase mutations.
 * 2. Model outputs are UNTRUSTED: all tasks undergo deterministic validation before execution.
 * 3. Never exposes internal UUIDs or technical database details.
 */

export type MatePatientReferenceType =
  | "BED"
  | "DISPLAY_ID"
  | "CURRENT"
  | "RECENT"
  | "LIST_INDEX"
  | "NONE";

export interface MatePatientReference {
  type: MatePatientReferenceType;
  value?: string | number | null;
}

export type MatePlannedTaskType =
  | "ER_OVERVIEW"
  | "LIST_PATIENTS"
  | "COUNT_PATIENTS"
  | "LIST_OCCUPIED_BEDS"
  | "CASE_SUMMARY"
  | "CASE_EXPLAIN"
  | "CASE_COMPLETENESS"
  | "DISCHARGE_PENDING"
  | "OPEN_CASE"
  | "OPEN_CASE_SECTION"
  | "NAVIGATE_APP"
  | "DOCUMENT_CLINICAL_UPDATE"
  | "CREATE_REASSESSMENT_REMINDER";

export type MateTaskAccessMode = "READ" | "WRITE" | "OPERATIONAL";

export interface MatePlannedTask {
  type: MatePlannedTaskType;
  accessMode: MateTaskAccessMode;
  sourceText?: string;
  section?: string;
  targetTab?: string;
  relativeIndex?: number;
  reminderMinutes?: number;
  dependsOnPreviousTask?: boolean;
}

export interface MateInterpretation {
  conversationalReply?: string;
  patientReference?: MatePatientReference;
  tasks: MatePlannedTask[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface MateInterpretationRequestBody {
  utterance: string;
  conversationContext?: {
    lastReferencedBed?: string | null;
    lastReferencedDisplayId?: string | null;
    hasActivePatient?: boolean;
    lastPresentedCount?: number;
    /** The patient currently open on screen. Bed / case number only — never name or identifiers. */
    currentPatient?: { bed?: string | null; displayId?: string | null; status?: string | null } | null;
    /** Last few chat turns so follow-ups ("him", "what's left", "and the labs?") make sense. De-identified server-side. */
    recentTurns?: Array<{ role: "doctor" | "mate"; text: string }>;
  };
  runtimeContext?: {
    activeTopLevelTab?: string;
    activeSurface?: string;
    hasActiveCase?: boolean;
    userRole?: string;
  };
  censusSummary?: {
    totalActive: number;
    occupiedBeds: string[];
    triageCounts?: { p1: number; p2: number; p3: number };
    incompleteCount?: number;
    unassignedCount?: number;
  };
}
