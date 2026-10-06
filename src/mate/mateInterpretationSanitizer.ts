/**
 * ErMate — Shared MATE Interpretation Sanitizer
 *
 * Safe for use in both Vite client bundles and server routes.
 */

import type {
  MateInterpretation,
  MatePlannedTask,
  MatePlannedTaskType,
  MateTaskAccessMode,
} from "./mateInterpretationTypes";

const VALID_TASK_TYPES = new Set<MatePlannedTaskType>([
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

const VALID_ACCESS_MODES = new Set<MateTaskAccessMode>(["READ", "WRITE", "OPERATIONAL"]);

const VALID_SECTIONS = new Set([
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

const VALID_TABS = new Set([
  "dashboard",
  "cases",
  "handover",
  "learn",
  "tools",
  "logbook",
  "team",
  "analytics",
]);

export function sanitizeInterpretation(raw: any): MateInterpretation {
  if (!raw || typeof raw !== "object") {
    return {
      conversationalReply: "I'm ready. What would you like to review?",
      tasks: [],
      needsClarification: false,
      confidence: "LOW",
    };
  }

  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const sanitizedTasks: MatePlannedTask[] = [];

  for (const t of rawTasks) {
    if (!t || typeof t !== "object") continue;
    if (!VALID_TASK_TYPES.has(t.type)) {
      continue;
    }

    const accessMode = VALID_ACCESS_MODES.has(t.accessMode) ? t.accessMode : "READ";
    const section = t.section && VALID_SECTIONS.has(String(t.section).toLowerCase()) ? String(t.section).toLowerCase() : undefined;
    const targetTab = t.targetTab && VALID_TABS.has(String(t.targetTab).toLowerCase()) ? String(t.targetTab).toLowerCase() : undefined;
    const relativeIndex = typeof t.relativeIndex === "number" && t.relativeIndex >= 0 ? t.relativeIndex : undefined;
    const reminderMinutes = typeof t.reminderMinutes === "number" && t.reminderMinutes > 0 ? t.reminderMinutes : undefined;
    const sourceText = typeof t.sourceText === "string" ? t.sourceText.trim() : undefined;

    sanitizedTasks.push({
      type: t.type,
      accessMode,
      sourceText,
      section,
      targetTab,
      relativeIndex,
      reminderMinutes,
      dependsOnPreviousTask: Boolean(t.dependsOnPreviousTask),
    });
  }

  let patientReference = undefined;
  if (raw.patientReference && typeof raw.patientReference === "object") {
    const rawType = String(raw.patientReference.type || "").toUpperCase();
    const validRefTypes = ["BED", "DISPLAY_ID", "CURRENT", "RECENT", "LIST_INDEX", "NONE"];
    const type = validRefTypes.includes(rawType) ? (rawType as any) : "NONE";
    const value = raw.patientReference.value !== undefined && raw.patientReference.value !== null
      ? String(raw.patientReference.value).trim()
      : null;
    patientReference = { type, value };
  }

  return {
    conversationalReply: typeof raw.conversationalReply === "string" ? raw.conversationalReply.trim() : undefined,
    patientReference,
    tasks: sanitizedTasks,
    needsClarification: Boolean(raw.needsClarification),
    clarificationQuestion: typeof raw.clarificationQuestion === "string" ? raw.clarificationQuestion.trim() : undefined,
    confidence: ["HIGH", "MEDIUM", "LOW"].includes(raw.confidence) ? raw.confidence : (sanitizedTasks.length > 0 ? "MEDIUM" : "LOW"),
  };
}
