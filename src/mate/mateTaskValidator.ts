/**
 * ErMate — MATE Task Validator
 *
 * Validates untrusted planned tasks from the model interpreter.
 *
 * Invariants:
 * 1. Sanitizes and validates each task before execution.
 * 2. Reject or sanitize:
 *    - unknown task types
 *    - unknown app tabs
 *    - unknown case sections
 *    - negative reminder times
 *    - arbitrary caseId
 *    - arbitrary hospitalId
 *    - arbitrary actorUid
 *    - unsupported access modes
 * 3. Never allows untrusted internal UUID override.
 */

import type { MatePlannedTask, MatePlannedTaskType, MateTaskAccessMode } from "./mateInterpretationTypes";
import type { MateTask, MateActionCapability } from "./mateContracts";
import { createMateTask } from "./mateContracts";

export const ALLOWED_TASK_TYPES = new Set<MatePlannedTaskType>([
  "ER_OVERVIEW",
  "LIST_PATIENTS",
  "COUNT_PATIENTS",
  "LIST_OCCUPIED_BEDS",
  "CASE_SUMMARY",
  "CASE_EXPLAIN",
  "CASE_COMPLETENESS",
  "DISCHARGE_PENDING",
  "OPEN_CASE",
  "OPEN_CASE_SECTION",
  "NAVIGATE_APP",
  "DOCUMENT_CLINICAL_UPDATE",
  "CREATE_REASSESSMENT_REMINDER",
]);

export const ALLOWED_ACCESS_MODES = new Set<MateTaskAccessMode>(["READ", "WRITE", "OPERATIONAL"]);

export const ALLOWED_APP_TABS = new Set<string>([
  "dashboard",
  "cases",
  "handover",
  "learn",
  "tools",
  "logbook",
  "team",
  "analytics",
]);

export const ALLOWED_SECTIONS = new Set<string>([
  "complaints",
  "primary-survey",
  "history",
  "secondary-survey",
  "investigations",
  "trends",
  "treatment",
  "notes",
  "disposition",
  "rounds",
]);

export interface ValidatedMateTaskEnvelope {
  isValid: boolean;
  sanitizedPlannedTask: MatePlannedTask | null;
  mateTask: MateTask | null;
  rejectionReason?: string;
}

export function validateAndBuildMateTask(params: {
  plannedTask: MatePlannedTask;
  actorUid: string;
  hospitalId: string | null;
  conversationId: string;
  deterministicCaseId: string | null;
  deterministicBedNo: string | null;
  scribeSessionId: string | null;
  contextGeneration: number;
  sourceUtterance: string;
}): ValidatedMateTaskEnvelope {
  const {
    plannedTask,
    actorUid,
    hospitalId,
    conversationId,
    deterministicCaseId,
    deterministicBedNo,
    scribeSessionId,
    contextGeneration,
    sourceUtterance,
  } = params;

  if (!plannedTask || typeof plannedTask !== "object") {
    return {
      isValid: false,
      sanitizedPlannedTask: null,
      mateTask: null,
      rejectionReason: "Task payload is null or not an object.",
    };
  }

  if (!ALLOWED_TASK_TYPES.has(plannedTask.type)) {
    return {
      isValid: false,
      sanitizedPlannedTask: null,
      mateTask: null,
      rejectionReason: `Unknown task type: ${plannedTask.type}`,
    };
  }

  const accessMode: MateTaskAccessMode = ALLOWED_ACCESS_MODES.has(plannedTask.accessMode)
    ? plannedTask.accessMode
    : "READ";

  let sanitizedSection: string | undefined = undefined;
  if (plannedTask.type === "OPEN_CASE_SECTION") {
    const rawSection = String(plannedTask.section || "").toLowerCase().trim();
    if (!ALLOWED_SECTIONS.has(rawSection)) {
      return {
        isValid: false,
        sanitizedPlannedTask: null,
        mateTask: null,
        rejectionReason: `Unknown or unsupported case section: ${plannedTask.section}`,
      };
    }
    sanitizedSection = rawSection;
  }

  let sanitizedTargetTab: string | undefined = undefined;
  if (plannedTask.type === "NAVIGATE_APP") {
    const rawTab = String(plannedTask.targetTab || "").toLowerCase().trim();
    if (!ALLOWED_APP_TABS.has(rawTab)) {
      return {
        isValid: false,
        sanitizedPlannedTask: null,
        mateTask: null,
        rejectionReason: `Unknown or unsupported application tab: ${plannedTask.targetTab}`,
      };
    }
    sanitizedTargetTab = rawTab;
  }

  let sanitizedReminderMinutes: number | undefined = undefined;
  if (plannedTask.type === "CREATE_REASSESSMENT_REMINDER") {
    const minutes = Number(plannedTask.reminderMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      return {
        isValid: false,
        sanitizedPlannedTask: null,
        mateTask: null,
        rejectionReason: "Reminder minutes must be a positive number.",
      };
    }
    sanitizedReminderMinutes = minutes;
  }

  const sanitizedPlanned: MatePlannedTask = {
    type: plannedTask.type,
    accessMode,
    sourceText: typeof plannedTask.sourceText === "string" ? plannedTask.sourceText.trim() : undefined,
    section: sanitizedSection,
    targetTab: sanitizedTargetTab,
    relativeIndex: typeof plannedTask.relativeIndex === "number" && plannedTask.relativeIndex >= 0 ? plannedTask.relativeIndex : undefined,
    reminderMinutes: sanitizedReminderMinutes,
    dependsOnPreviousTask: Boolean(plannedTask.dependsOnPreviousTask),
  };

  // Map to MateActionCapability
  let capability: MateActionCapability = "case.open";
  if (sanitizedPlanned.type === "OPEN_CASE") capability = "case.open";
  else if (sanitizedPlanned.type === "OPEN_CASE_SECTION") capability = "case.navigate";
  else if (sanitizedPlanned.type === "CASE_SUMMARY") capability = "case.summary";
  else if (sanitizedPlanned.type === "CASE_COMPLETENESS") capability = "case.discharge.pending";
  else if (sanitizedPlanned.type === "DISCHARGE_PENDING") capability = "case.discharge.pending";
  else if (sanitizedPlanned.type === "CASE_EXPLAIN") capability = "case.rounds.review";
  else if (sanitizedPlanned.type === "NAVIGATE_APP") capability = "case.navigate";
  else if (sanitizedPlanned.type === "DOCUMENT_CLINICAL_UPDATE") capability = "case.document";
  else if (sanitizedPlanned.type === "CREATE_REASSESSMENT_REMINDER") capability = "reminder.create";
  else capability = "case.open";

  const mateTask = createMateTask({
    actorUid,
    hospitalId,
    conversationId,
    caseId: deterministicCaseId, // Deterministic ID, NEVER arbitrary model ID!
    bedNo: deterministicBedNo,
    scribeSessionId,
    capability,
    accessMode,
    sourceUtterance,
    contextGeneration,
    payload: {
      type: sanitizedPlanned.type,
      section: sanitizedPlanned.section,
      targetTab: sanitizedPlanned.targetTab,
      sourceText: sanitizedPlanned.sourceText,
      reminderMinutes: sanitizedPlanned.reminderMinutes,
    },
  });

  return {
    isValid: true,
    sanitizedPlannedTask: sanitizedPlanned,
    mateTask,
  };
}
