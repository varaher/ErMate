import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, MoreVertical, Paperclip, Sparkles, MessageSquare, Mic as MicIcon, Activity, AlertTriangle, Plus, X } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  subscribeSessionAndLegacyHistory,
  appendChatMessage,
  updateChatMessage,
  createScribeSession,
  resolveSessionForExistingCase,
  generateNewDiscussionId,
  subscribeDiscussionHistory,
  appendDiscussionMessage,
  saveDiscussionSummary,
  getChatHistory,
  getDiscussionHistory,
} from "../services/scribeChatStorage";
import { resolveWorkspaceForUser } from "../utils/workspaceResolver";
import VoiceRecorder from "./shared/VoiceRecorder";
import Markdown from "react-markdown";
import { getChecklistForKind, type CaseSheetKind } from "../../server/caseSheetChecklist";
import { ScribeReasoningRenderer } from "./ScribeReasoningRenderer";
import { isEstablishedCaseSheet } from "../utils/establishedCaseCheck";
import { PROCEDURE_DEFINITIONS, ProcedureDefinition } from "../data/procedureDefinitions";
import { ProcedureNote } from "../types/procedureNotes";
import { ProcedureNoteFormModal } from "./ProcedureNoteFormModal";
import type { ClinicalCase } from "../types";
import {
  planMateConversation,
} from "../mate/mateConversationPlanner";
import {
  routeMateInput,
} from "../mate/mateRouter";
import {
  extractMateBedReference,
  resolveMateCaseReference,
} from "../mate/mateCaseResolver";
import {
  dispatchMateAction,
} from "../mate/mateActionDispatcher";
import {
  extractMateDisplayIdReference,
  resolveMateCaseByDisplayId,
} from "../mate/mateCaseDisplayResolver";
import { getCasePendingStatus } from "../utils/caseHelper";
import { checkDischargeCompleteness } from "../utils/dischargeCompleteness";

type ChatMode = "dictation" | "discuss";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  mode?: ChatMode;
  extractionData?: any;
  extractionApplied?: boolean;
  dischargeDraft?: string;
  dischargeApplied?: boolean;
  dischargeIntent?: boolean;
  clinicalReasoning?: {
    differentials?: string[];
    watchFor?: string[];
    references?: string[];
  };
}

/**
 * Detect explicit new-patient intake intent.
 * Locked rule: Bed mention alone NEVER creates a patient.
 * Only explicit new patient phrases ("new patient in Bed 11", "start a new case for Bed 12",
 * "patient just arrived in Bed 11 with chest pain") trigger new case creation.
 */
export function detectExplicitNewCaseIntent(text: string): boolean {
  if (!text) return false;
  return /\b(?:new\s+(?:patient|case|intake|arrival|admission)|start\s+a?\s*new\s+(?:patient|case)|patient\s+just\s+arrived|admit(?:ted)?\s+a?\s*new\s+patient|fresh\s+arrival)\b/i.test(text);
}

interface VoiceScribeChatViewProps {
  caseId?: string | null;
  caseData?: any;
  sessionId?: string | null;
  onSessionIdChange?: (sessionId: string | null) => void;
  onNewChat?: () => void;
  onBack: () => void;
  onOpenCaseSheet?: (caseId: string) => void;
  onOpenCaseSection?: (caseId: string, sectionId: string) => void;
  onNavigateToTab?: (tabId: string) => void;
  onCaseSheetUpdated?: (fields: any) => void;
  onSaveExtractedCase?: (extracted: any, options?: { autoNavigate?: boolean; existingCaseId?: string }) => Promise<string>;
  onPrepareDischarge?: (extractedData: any, messageId: string, caseId: string) => Promise<void>;
  onPreviewCaseSheet?: (extracted: any, options?: { existingCaseId?: string | null; msgId?: string; contributingMsgIds?: string[]; scribeSessionId?: string | null }) => void | Promise<void>;
  onPreviewDischargeSummary?: (extracted: any, options?: { existingCaseId?: string | null; msgId?: string; contributingMsgIds?: string[]; scribeSessionId?: string | null }) => void | Promise<void>;
  profile?: any;
  onSaveProfile?: (newProfile: any) => Promise<any>;
  messages?: any;
  onUpdateMessages?: any;
  // NEW — optional, defaults to "case" so every existing call site in
  // App.tsx keeps working unchanged. Only pass "discussion" from a new,
  // not-yet-built entry point that wants a standalone, non-patient chat.
  initialEntryMode?: "case" | "discussion";
  refreshTrigger?: number;
  onBusyChange?: (isBusy: boolean) => void;
  onRequestRoundsCase?: (unappliedExtraction?: any) => ClinicalCase | null;
  allCases?: ClinicalCase[];
  physicalBedCapacity?: number;
  onSwitchCase?: (caseId: string) => void;
  onEnsureDraftCase?: (sessionId: string, options?: { bedNo?: string }) => Promise<string>;
  isSidecar?: boolean;
}

const LENSES: { id: string; label: string }[] = [
  { id: "first-principles", label: "First Principles" },
  { id: "devils-advocate", label: "Devil's Advocate" },
  { id: "rare-but-real", label: "Rare but Real" },
  { id: "pathophysiology", label: "Pathophysiology" },
  { id: "guidelines", label: "Guidelines" },
  { id: "disease-snapshot", label: "Disease Snapshot" },
  { id: "full-debrief", label: "Full Debrief" },
];

/**
 * Detects whether an utterance contains clinical findings, updates, numbers, or interventions.
 * If true, the utterance is NOT a pure Rounds command and must not be intercepted by Rounds.
 */
function hasMixedClinicalContent(text: string): boolean {
  const lower = text.toLowerCase();
  // 1. Blood pressure readings: e.g. 90/60, 120/80
  if (/\b\d{2,3}\s*\/\s*\d{2,3}\b/.test(lower)) return true;
  // 2. Numerical vitals / lab values with units: e.g. 300 mg, 5 mcg, 98%, 110 bpm
  if (/\b\d+\s*(mg|mcg|ml|g|gm|iu|units?|cpm|bpm|%|mmol|meq)\b/.test(lower)) return true;
  // 3. Treatment administration / medication orders
  if (/\b(given|administered|started|infused|bolus|loading|prescribed|injected)\b/.test(lower)) return true;
  // 4. Lab / diagnostic findings
  if (/\b(troponin|ecg|ekg|lactate|abg|vbg|creatinine|potassium|hemoglobin|platelets?|cxr|pocus)\b/.test(lower)) return true;
  // 5. Patient status / acute clinical state changes
  if (/\b(bradycardic|tachycardic|hypotensive|hypertensive|hypoxic|desaturating|arrested|intubated|drowsy|lethargic)\b/.test(lower)) return true;
  if (/\bpatient\s+(is|was|became|presents?|presented|arrived|developed)\b/.test(lower)) return true;
  // 6. Multiple clauses / sentence boundaries combined with clinical indicators
  if (/[.;\n]/.test(text) && /\b(bp|hr|rr|spo2|temp|iv|po|gcs|sugar|grbs)\b/.test(lower)) return true;

  return false;
}

/**
 * Deterministic Rounds intent detector for patient-linked conversations (Patch R1C).
 * Only auto-routes natural language when the COMPLETE normalized utterance matches an approved
 * pure Rounds command pattern. Anything containing surrounding clinical narrative, multiple clauses,
 * or general medical queries returns null to preserve safe Scribe extraction and discussion.
 * Explicit individual lenses take priority over broad full-case debriefs.
 */
export function detectRoundsLensIntent(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  // Additional safety guard against mixed clinical content / vitals / updates
  if (hasMixedClinicalContent(text)) {
    return null;
  }

  const lower = text.trim().toLowerCase();
  // Strip only leading conversational polite wrappers (including repeated/comma-separated)
  const clean = lower
    .replace(
      /^(?:(?:please|can you|could you|would you|kindly|hey mate|mate)[,\s]+)+/i,
      ""
    )
    .replace(/[?.!]+$/, "")
    .trim();

  // 1. FIRST PRINCIPLES (beats broad review; exact whole-message whitelist)
  if (
    clean === "first principles" ||
    clean === "from first principles" ||
    clean === "take this from first principles" ||
    clean === "take this case back to first principles" ||
    clean === "take this case from first principles" ||
    clean === "explain this case from first principles" ||
    clean === "explain this patient from first principles" ||
    clean === "analyse this case from first principles" ||
    clean === "analyze this case from first principles" ||
    clean === "review this case from first principles" ||
    clean === "deconstruct this case from first principles" ||
    /^(explain|analyse|analyze|review|deconstruct)\s+(this\s+case|this\s+patient|this)\s+(back\s+to\s+|from\s+)first\s+principles$/.test(clean)
  ) {
    return "first-principles";
  }

  // 2. DEVIL'S ADVOCATE (exact whole-message whitelist)
  if (
    clean === "devil's advocate" ||
    clean === "devils advocate" ||
    clean === "play devil's advocate" ||
    clean === "play devils advocate" ||
    clean === "play devil's advocate on this case" ||
    clean === "play devils advocate on this case" ||
    clean === "play devil's advocate in this case" ||
    clean === "play devils advocate in this case" ||
    clean === "challenge my diagnosis" ||
    clean === "challenge this diagnosis" ||
    clean === "challenge my assumptions" ||
    clean === "challenge my assumptions in this case" ||
    clean === "challenge my assumptions on this case" ||
    /^(play\s+)?devils?\s+advocate\s+(on|in|for)\s+(this\s+case|this\s+patient)$/.test(clean) ||
    /^challenge\s+(my|this)\s+(diagnosis|assumptions)(\s+(in|on|for)\s+(this\s+case|this\s+patient))?$/.test(clean)
  ) {
    return "devils-advocate";
  }

  // 3. RARE BUT REAL (exact whole-message whitelist)
  if (
    clean === "rare but real" ||
    clean === "rare but dangerous" ||
    clean === "anything rare but dangerous here" ||
    clean === "anything rare but dangerous in this case" ||
    clean === "anything rare but dangerous on this case" ||
    clean === "anything rare but real here" ||
    clean === "anything rare but real in this case" ||
    clean === "what rare but dangerous diagnoses should i consider" ||
    clean === "what rare but dangerous diagnoses should i consider in this case" ||
    clean === "what rare but dangerous diagnoses should i consider here" ||
    clean === "show me the rare critical mimics in this case" ||
    clean === "show me rare critical mimics in this case" ||
    clean === "show me the rare critical mimics" ||
    clean === "rare critical mimics in this case" ||
    clean === "rare critical mimics" ||
    /^anything\s+rare\s+but\s+(dangerous|real)(\s+(here|in\s+this\s+case|on\s+this\s+case))?$/.test(clean) ||
    /^what\s+rare\s+but\s+dangerous\s+diagnoses\s+should\s+i\s+consider(\s+(here|in\s+this\s+case|on\s+this\s+case))?$/.test(clean) ||
    /^(show\s+me\s+)?(the\s+)?rare\s+critical\s+mimics(\s+(here|in\s+this\s+case|on\s+this\s+case))?$/.test(clean)
  ) {
    return "rare-but-real";
  }

  // 4. PATHOPHYSIOLOGY (case-specific whole-message whitelist; rejects general knowledge questions like DKA)
  if (
    clean === "explain the pathophysiology of this case" ||
    clean === "explain the pathophysiology in this patient" ||
    clean === "explain the pathophysiology of this patient" ||
    clean === "explain the pathophysiology in this case" ||
    clean === "explain the pathophysiology here" ||
    clean === "what is the pathophysiology in this case" ||
    clean === "what is the pathophysiology of this case" ||
    clean === "pathophysiology of this case" ||
    clean === "pathophysiology in this case" ||
    clean === "pathophysiology of this patient" ||
    clean === "pathophysiological explanation of this case" ||
    clean === "pathophysiological explanation in this case" ||
    /^(explain\s+(the\s+)?|what\s+is\s+the\s+)?pathophysiolog(y|ical\s+explanation)\s+(of|in|for)\s+(this\s+case|this\s+patient|this\s+presentation)$/.test(clean)
  ) {
    return "pathophysiology";
  }

  // 5. GUIDELINES (case-specific whole-message whitelist; rejects general dosing/guidelines questions)
  if (
    clean === "review this case against guidelines" ||
    clean === "review this case against current guidelines" ||
    clean === "guideline review of this case" ||
    clean === "guideline review on this case" ||
    clean === "guideline review for this case" ||
    clean === "what do the guidelines say about this case" ||
    clean === "check this case against guidelines" ||
    clean === "check this case against current guidelines" ||
    clean === "evaluate this case against guidelines" ||
    clean === "evaluate this case against current guidelines" ||
    /^(review|check|evaluate)\s+(this\s+case|this\s+patient)\s+against\s+(current\s+)?guidelines$/.test(clean) ||
    /^guideline\s+review\s+(of|on|for)\s+(this\s+case|this\s+patient)$/.test(clean) ||
    /^what\s+do\s+(the\s+)?guidelines\s+say\s+about\s+(this\s+case|this\s+patient)$/.test(clean)
  ) {
    return "guidelines";
  }

  // 6. DISEASE SNAPSHOT (exact whole-message whitelist)
  if (
    clean === "disease snapshot" ||
    clean === "give me a disease snapshot" ||
    clean === "case snapshot" ||
    clean === "give me a case snapshot" ||
    clean === "quick disease overview of this case" ||
    clean === "quick disease overview in this case" ||
    clean === "quick disease overview" ||
    /^(give\s+me\s+a\s+)?(disease|case)\s+snapshot$/.test(clean) ||
    /^quick\s+disease\s+overview(\s+(of|in|for)\s+(this\s+case|this\s+patient))?$/.test(clean)
  ) {
    return "disease-snapshot";
  }

  // 7. FULL DEBRIEF / ALL-LENS (evaluated AFTER individual lenses with anchored whole-message whitelist)
  if (
    clean === "full debrief" ||
    clean === "debrief this case" ||
    clean === "debrief the case" ||
    clean === "complete case analysis" ||
    clean === "teach me this case" ||
    clean === "explain this case" ||
    clean === "explain about this case" ||
    clean === "explain the case" ||
    clean === "explain the whole case" ||
    clean === "review this case" ||
    clean === "review the case" ||
    clean === "review the whole case" ||
    clean === "analyse this case" ||
    clean === "analyze this case" ||
    clean === "analyse the case" ||
    clean === "analyze the case" ||
    clean === "analyse the whole case" ||
    clean === "analyze the whole case" ||
    clean === "what do you think about this whole case" ||
    clean === "what do you think of this whole case" ||
    clean === "what do you think about this case" ||
    clean === "what do you think of this case" ||
    /^(explain|review|teach\s+me|debrief|analyse|analyze|give\s+me\s+a\s+full\s+debrief\s+on)\s+(about\s+)?(this\s+case|the\s+whole\s+case|this\s+patient|the\s+case)$/.test(clean) ||
    /^what\s+do\s+you\s+think\s+(about|of)\s+(this\s+whole\s+case|this\s+case|the\s+case)$/.test(clean)
  ) {
    return "full-debrief";
  }

  return null;
}

// ── UI-01 FIX (Sept 2026) ─────────────────────────────────────────────
// Previously, whether the "Captured from your update" card was shown at
// all was decided by `Object.keys(data).length > 0` (any key present),
// while what actually rendered inside the card used a stricter filter
// (drops isPediatric, empty strings, empty arrays/objects). Those two
// checks could disagree: a turn that only extracted e.g. `isPediatric`
// would pass the first check and render an empty card under the
// "Captured from your update" header — looking exactly like a silent
// extraction failure, when in fact nothing displayable was ever there.
// This single helper is now the ONLY place that decides "does this
// field belong on screen", used both to gate whether the card renders
// and to build the rows inside it, so the two can never disagree again.

function humanizeFieldLabel(key: string): string {
  if (key === "investigationImaging" || key === "imaging") return "Imaging";
  if (key === "investigationLabsOrdered" || key === "labs") return "Labs Ordered";
  if (key === "treatmentGiven" || key === "treatments") return "Treatments";
  if (key === "otherProcedures" || key === "proceduresChecked") return "Procedures";
  if (key === "fastFindings" || key === "efastNotes") return "eFAST / POCUS";
  if (key === "pastMedicalHistory" || key === "pmh" || key === "pastHistory") return "Past Medical History";
  if (key === "currentMedications" || key === "medications") return "Medications";
  if (key === "psychologicalAssessment" || key === "psychiatricFlags") return "Psychological Assessment";
  if (key === "clinicianUpdateText") return "Clinician Update Text";
  if (key === "events") return "Events";
  if (key === "lastMeal") return "Last Meal";
  if (key === "secondarySurvey") return "Secondary Survey";
  if (key === "bladder") return "Pelvis / Bladder";
  if (key === "pelvis") return "Pelvis";
  if (key === "abdomen") return "Abdomen";
  if (key === "heart") return "Heart / Subxiphoid";
  if (key === "lungs") return "Lungs / Pleura";
  if (key === "sampleHistory") return "SAMPLE History";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatExtractionEntryValue(key: string, val: any): string {
  if (key === "vbgAbg" && val && typeof val === "object") {
    const type = val.type ? `${val.type}: ` : "";
    const vals = Array.isArray(val.values)
      ? val.values
          .map((v: any) =>
            `${v.name ?? v.param ?? ""} ${v.value ?? ""}`.trim()
          )
          .filter(Boolean)
          .join(", ")
      : "";

    return `${type}${vals}`.trim() || "—";
  }

  if (key === "chronologicalNotes" && Array.isArray(val)) {
    return val
      .map((n: any) => n?.entry ?? n)
      .filter(Boolean)
      .join("; ");
  }

  if (
    (key === "secondarySurvey" || key === "fastFindings") &&
    val &&
    typeof val === "object"
  ) {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${humanizeFieldLabel(k)}: ${String(v)}`)
      .join(", ");
  }

  if (key === "sampleHistory" && val && typeof val === "object") {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${humanizeFieldLabel(k)}: ${String(v)}`)
      .join("; ");
  }

  if (key === "mlcDetails" && val && typeof val === "object") {
    return Object.entries(val)
      .filter(([k, v]) =>
        k !== "isMlc" &&
        v !== null &&
        v !== undefined &&
        v !== ""
      )
      .map(([k, v]) => `${humanizeFieldLabel(k)}: ${String(v)}`)
      .join(", ");
  }

  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (item && typeof item === "object") {
          return Object.values(item)
            .filter(v => v !== null && v !== undefined && v !== "")
            .join(" ");
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (val && typeof val === "object") {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${humanizeFieldLabel(k)}: ${String(v)}`)
      .join(", ");
  }

  return String(val);
}

function getDisplayableExtractionEntries(data: any): [string, any][] {
  if (!data || typeof data !== "object") return [];

  // Normalize and unpack sampleHistory if present so all fields show consistently
  const normalizedData = { ...data };
  if (normalizedData.sampleHistory && typeof normalizedData.sampleHistory === "object") {
    const sh = normalizedData.sampleHistory;
    if (sh.allergies && !normalizedData.allergies) normalizedData.allergies = sh.allergies;
    if (sh.pastHistory && !normalizedData.pastMedicalHistory) normalizedData.pastMedicalHistory = sh.pastHistory;
    if (sh.medications && !normalizedData.currentMedications) normalizedData.currentMedications = sh.medications;
    if (sh.psychiatricFlags && !normalizedData.psychologicalAssessment) normalizedData.psychologicalAssessment = sh.psychiatricFlags;
    if (sh.events && !normalizedData.events) normalizedData.events = sh.events;
    if (sh.lastMeal && !normalizedData.lastMeal) normalizedData.lastMeal = sh.lastMeal;
    if (sh.symptoms && !normalizedData.symptoms) normalizedData.symptoms = sh.symptoms;
    delete normalizedData.sampleHistory;
  }

  delete normalizedData.isPediatric;
  delete normalizedData.controlledPatches;
  delete normalizedData.userConfirmationSummary;
  delete normalizedData.intent;

  return Object.entries(normalizedData).filter(([key, val]) => {
    if (val === null || val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return false;
    return true;
  });
}

function hasDisplayableExtraction(data: any): boolean {
  return getDisplayableExtractionEntries(data).length > 0;
}

export function detectProcedureFromExtraction(data: any): ProcedureDefinition | null {
  if (!data) return null;
  const procTexts: string[] = [];
  if (Array.isArray(data.procedures)) {
    procTexts.push(...data.procedures.map(String));
  }
  if (typeof data.otherProcedures === "string") {
    procTexts.push(data.otherProcedures);
  }
  if (Array.isArray(data.proceduresChecked)) {
    procTexts.push(...data.proceduresChecked.map(String));
  }

  const combined = procTexts.join(" ").toLowerCase();
  if (!combined.trim()) return null;

  if (combined.includes("foley") || combined.includes("catheter") || combined.includes("urinary catheter")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "foley_catheter") || null;
  }
  if (combined.includes("ryle") || combined.includes("ng tube") || combined.includes("nasogastric")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "ryles_tube") || null;
  }
  if (combined.includes("intubat") || combined.includes("rsi") || combined.includes("endotracheal")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "rsi_intubation") || null;
  }
  if (combined.includes("central line") || combined.includes("cvc") || combined.includes("central venous") || combined.includes("ijv") || combined.includes("subclavian")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "central_line") || null;
  }
  if (combined.includes("arterial line") || combined.includes("art line") || combined.includes("radial artery") || combined.includes("a-line")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "arterial_line") || null;
  }
  if (combined.includes("short arm") || (combined.includes("slab") && (combined.includes("arm") || combined.includes("wrist") || combined.includes("colles") || combined.includes("radius")))) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "short_arm_slab") || null;
  }
  if (combined.includes("reduction") || combined.includes("manipulat")) {
    return PROCEDURE_DEFINITIONS.find(p => p.type === "closed_reduction") || null;
  }

  return null;
}

function resolveChecklistValue(id: string, data: any): any {
  if (!data) return undefined;
  switch (id) {
    case "patientName": return data.patientName;
    case "ageSex": return [data.age, data.gender].filter(Boolean).join(" / ") || undefined;
    case "chiefComplaint": return data.presentingComplaint;
    case "airway": return data.airway;
    case "breathing": return data.breathing;
    case "circulation": return data.circulation;
    case "disability": return data.disability;
    case "exposure": return data.exposure;
    case "vbgAbg": return data.vbgAbg;
    case "generalExam": return data.secondarySurvey?.general;
    case "cvsExam": return data.secondarySurvey?.cvs;
    case "chestExam": return data.secondarySurvey?.respiratory;
    case "abdomenExam": return data.secondarySurvey?.abdomen;
    case "cnsExam": return data.secondarySurvey?.cns;
    case "pmh": return data.pastMedicalHistory;
    case "allergies": return data.sampleHistory?.allergies ?? data.allergies;
    case "medications": return data.sampleHistory?.medications ?? (Array.isArray(data.currentMedications) ? data.currentMedications.join(", ") : data.currentMedications);
    case "differentialDiagnosis": return data.differentialDiagnosis;
    case "treatmentPlan": return data.treatmentGiven ?? data.treatments ?? data.plan;
    case "signsSymptoms": return data.symptoms;
    case "lastMeal": return data.sampleHistory?.lastMeal ?? data.lastMeal;
    case "events": return data.sampleHistory?.events ?? data.events;
    default: return undefined;
  }
}

function isValueCaptured(val: any): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === "object" && Object.keys(val).length === 0) return false;
  return true;
}

function formatChecklistValue(val: any): string {
  if (Array.isArray(val)) {
    return val.map(item => typeof item === "object" && item !== null
      ? Object.values(item).filter(v => v !== null && v !== "").join(" ")
      : String(item)
    ).join(", ");
  }
  if (typeof val === "object" && val !== null) {
    return Object.entries(val).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  return String(val);
}
// Deep-merges extraction data across every dictation turn up to and
// including targetId. A shallow merge (later turn's `vitals` object
// wholesale replacing an earlier turn's) would silently drop real
// dictated values whenever the same nested field (vitals,
// secondarySurvey, mlcDetails, fastFindings, vbgAbg) gets partially
// populated across two separate turns — e.g. HR/SpO2 in the initial
// dictation, then BP mentioned alongside an age-question reply. This
// combines nested objects key-by-key instead of replacing them wholesale.
export function deepMergeExtraction(base: any, incoming: any): any {
  if (!base || typeof base !== "object") return incoming ? { ...incoming } : {};
  if (!incoming || typeof incoming !== "object") return { ...base };

  const result = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === undefined || val === "") continue;
    const existing = result[key];
    if (key === "clinicianUpdates" && Array.isArray(val)) {
      const existingArr = Array.isArray(existing) ? existing : [];
      const combined = [...existingArr];
      for (const item of val) {
        if (!combined.some(c => c && c.text === item.text)) {
          combined.push(item);
        }
      }
      result[key] = combined;
    } else if (Array.isArray(val)) {
      if (Array.isArray(existing)) {
        const combined = [...existing];
        for (const item of val) {
          if (item && typeof item === "object") {
            const existingIdx = combined.findIndex(c => {
              if (!c || typeof c !== "object") return false;
              if (c.id && item.id && c.id === item.id) return true;
              if (c.param && item.param && c.param === item.param) return true;
              if (c.name && item.name && c.name.toLowerCase() === item.name.toLowerCase()) return true;
              if (c.diagnosis && item.diagnosis && c.diagnosis.toLowerCase() === item.diagnosis.toLowerCase()) return true;
              if (c.medication && item.medication && c.medication.toLowerCase() === item.medication.toLowerCase()) return true;
              if (c.drugName && item.drugName && c.drugName.toLowerCase() === item.drugName.toLowerCase()) return true;
              return false;
            });
            if (existingIdx >= 0) {
              if (item.param || item.value !== undefined) {
                combined[existingIdx] = { ...combined[existingIdx], ...item };
              }
            } else {
              combined.push(item);
            }
          } else if (!combined.includes(item)) {
            combined.push(item);
          }
        }
        result[key] = combined;
      } else {
        result[key] = [...val];
      }
    } else if (typeof val === "object") {
      result[key] = (existing && typeof existing === "object" && !Array.isArray(existing))
        ? deepMergeExtraction(existing, val)
        : { ...val };
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Canonical deep-merge helper for UNAPPLIED Scribe extraction turns.
 * Merges ONLY currently unapplied extraction turns (!msg.extractionApplied).
 * If targetId is provided, merges unapplied turns up to and including targetId.
 * Preserves nested objects (vitals, sampleHistory, secondarySurvey, fastFindings, mlcDetails, vbgAbg)
 * without shallow-replacing them.
 * Returns both the merged object and the array of contributing message IDs.
 */
export function getMergedUnappliedCaseExtraction(messages: Message[], targetId?: string): { merged: any; contributingMsgIds: string[] } {
  let merged: any = {};
  const contributingMsgIds: string[] = [];
  for (const msg of messages) {
    if (msg.extractionData && !msg.extractionApplied) {
      merged = deepMergeExtraction(merged, msg.extractionData);
      contributingMsgIds.push(msg.id);
    }
    if (targetId && msg.id === targetId) {
      break;
    }
  }
  return { merged, contributingMsgIds };
}

export function getMergedUnappliedExtraction(messages: Message[], targetId?: string): any {
  return getMergedUnappliedCaseExtraction(messages, targetId).merged;
}

/**
 * Destination-specific deep-merge helper for DISCHARGE SUMMARY.
 * Merges extraction data for all turns where dischargeApplied !== true up to targetId.
 * Does NOT care whether extractionApplied is true (Case Sheet and Discharge are independent).
 */
export function getMergedUnappliedDischargeExtraction(messages: Message[], targetId?: string): { merged: any; contributingMsgIds: string[] } {
  let merged: any = {};
  const contributingMsgIds: string[] = [];
  for (const msg of messages) {
    if (msg.extractionData && !msg.dischargeApplied) {
      merged = deepMergeExtraction(merged, msg.extractionData);
      contributingMsgIds.push(msg.id);
    }
    if (targetId && msg.id === targetId) {
      break;
    }
  }
  return { merged, contributingMsgIds };
}

export function mergeExtractionUpTo(messages: Message[], targetId: string): any {
  return getMergedUnappliedExtraction(messages, targetId);
}
export default function VoiceScribeChatView({
  caseId: propCaseId,
  caseData,
  sessionId: propSessionId,
  onSessionIdChange,
  onNewChat,
  onBack,
  onOpenCaseSheet,
  onOpenCaseSection,
  onNavigateToTab,
  onCaseSheetUpdated,
  onSaveExtractedCase,
  onPrepareDischarge,
  onPreviewCaseSheet,
  onPreviewDischargeSummary,
  profile,
  onSaveProfile,
  messages: propMessages,
  onUpdateMessages,
  initialEntryMode = "case",
  refreshTrigger,
  onBusyChange,
  onRequestRoundsCase,
  allCases,
  physicalBedCapacity = 30,
  onSwitchCase,
  onEnsureDraftCase,
  isSidecar = false,
}: VoiceScribeChatViewProps) {
  const processingActionRef = useRef(false);
  // Session context generation guard against stale late async responses
  const sessionContextGenerationRef = useRef<number>(0);

  // MATE Operational Context (remembers ONLY bed/case references; never clinical facts)
  const lastReferencedCaseIdRef = useRef<string | null>(null);
  const lastReferencedBedRef = useRef<string | null>(null);
  const pendingUtteranceAfterSwitchRef = useRef<{
    targetCaseId: string;
    utterance: string;
    generation: number;
  } | null>(null);

  // Pending new-patient handoff state
  const pendingNewPatientHandoffRef = useRef<{
    targetCaseId: string;
    targetBed: string;
    utterance: string;
    generation: number;
  } | null>(null);
  // A chat is "case-linked" if either a real caseId was passed in, OR
  // the caller didn't explicitly ask for a standalone discussion.
  const isDiscussionOnly = initialEntryMode === "discussion" && !propCaseId;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: isDiscussionOnly
        ? "ErMate Assistant is ready.\n\n💬 Paste or describe a case to discuss — differentials, next steps, or anything you're unsure about.\n🔍 Use the lenses (⋮ menu) for a deeper clinical breakdown."
        : "ErMate is ready.\n\n🎙️ Dictate the case in your native language and save it to the case sheet.\n💬 Or ask a clinical question — about this patient or any case.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState<{ type: "case" | "discharge" } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<{messageId: string, type: 'caseSheet' | 'discharge'} | null>(null);
  const [procedureModalState, setProcedureModalState] = useState<{
    isOpen: boolean;
    procDef: ProcedureDefinition;
    initialPrefill?: any;
    messageId?: string;
  } | null>(null);

  // Active case ID: starts null for new unlinked dictation chats, or populated if a case already exists
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
    if (isDiscussionOnly) return null;
    return propCaseId || caseData?.id || null;
  });

  useEffect(() => {
    const target = propCaseId || caseData?.id;
    if (target !== activeCaseId) {
      setActiveCaseId(target || null);
    }
  }, [propCaseId, caseData?.id]);

  // Scribe session state: ensures continuity across remounts and refresh
  const [activeSessionId, setActiveSessionId] = useState<string | null>(propSessionId || null);
  const [sessionAttachError, setSessionAttachError] = useState<string | null>(null);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<Map<string, { message: any; error: string }>>(new Map());
  // Pending message queue bound to session context generation
  const pendingMessageQueueRef = useRef<{ message: any; generation: number }[]>([]);

  // Advance generation whenever patient or session boundary shifts
  const prevActiveCaseIdRef = useRef<string | null>(activeCaseId);
  const prevActiveSessionIdRef = useRef<string | null>(activeSessionId);
  useEffect(() => {
    if (prevActiveCaseIdRef.current !== activeCaseId || prevActiveSessionIdRef.current !== activeSessionId) {
      // If this transition was initiated by a pending MATE switch or handoff, generation was already advanced
      const isExpectedSwitch =
        activeCaseId === pendingUtteranceAfterSwitchRef.current?.targetCaseId ||
        activeCaseId === pendingNewPatientHandoffRef.current?.targetCaseId;
      if (!isExpectedSwitch) {
        sessionContextGenerationRef.current += 1;
      }
      prevActiveCaseIdRef.current = activeCaseId;
      prevActiveSessionIdRef.current = activeSessionId;
    }
  }, [activeCaseId, activeSessionId]);

  const STANDARD_WELCOME_MESSAGE = {
    id: "welcome",
    sender: "ai" as const,
    text: "ErMate is ready.\n\n🎙️ Dictate the case in your native language and save it to the case sheet.\n💬 Or ask a clinical question — about this patient or any case.",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  // On EVERY activeSessionId change:
  // 1. Synchronously reset UI state to standard welcome-only state
  // 2. Clear any extraction/draft state derived from the previous session
  useEffect(() => {
    if (isDiscussionOnly) return;
    setMessages([STANDARD_WELCOME_MESSAGE]);
    setHistoryLoadError(null);
    setProcedureModalState(null);
    setProcessingAction(null);
    setSaveConfirmation(null);
  }, [activeSessionId, isDiscussionOnly]);

  // Flush messages written before session was ready (strictly matching current context generation)
  useEffect(() => {
    if (!activeSessionId || sessionAttachError) return;
    if (pendingMessageQueueRef.current.length === 0) return;

    const currentGen = sessionContextGenerationRef.current;
    const queue = pendingMessageQueueRef.current.filter(item => item.generation === currentGen);
    pendingMessageQueueRef.current = [];

    const flushQueue = async () => {
      for (const item of queue) {
        const msg = item.message;
        try {
          await appendChatMessage(activeSessionId, msg, { isSession: true });
          setFailedMessages(prev => {
            if (!prev.has(msg.id)) return prev;
            const next = new Map(prev);
            next.delete(msg.id);
            return next;
          });
        } catch (err: any) {
          console.error("[VoiceScribeChatView] Failed to flush queued message:", err);
          const reason = err?.message || "Storage write error";
          setFailedMessages(prev => new Map(prev).set(msg.id, { message: msg, error: reason }));
        }
      }
    };

    flushQueue();
  }, [activeSessionId, sessionAttachError]);

  const handleSaveDetectedProcedure = async (newNote: ProcedureNote) => {
    if (!activeCaseId) return;
    try {
      const caseRef = doc(db, "cases", activeCaseId);
      const caseSnap = await getDoc(caseRef);
      const existingData = caseSnap.exists() ? caseSnap.data() : null;
      const existingProcs: ProcedureNote[] = Array.isArray(existingData?.procedureNotes)
        ? existingData.procedureNotes
        : Array.isArray(caseData?.procedureNotes)
          ? caseData.procedureNotes
          : [];
      const updatedProcs = [...existingProcs.filter((p: ProcedureNote) => p.id !== newNote.id), newNote];
      await setDoc(caseRef, { procedureNotes: updatedProcs }, { merge: true });
      if (onCaseSheetUpdated) {
        onCaseSheetUpdated({ procedureNotes: updatedProcs });
      }
      setProcedureModalState(null);
    } catch (err) {
      console.error("Failed to save procedure note from Scribe:", err);
      setSaveError("Failed to save procedure note.");
    }
  };

  const [currentMode, setCurrentMode] = useState<ChatMode>(isDiscussionOnly ? "discuss" : "dictation");
  const [showLensMenu, setShowLensMenu] = useState(false);
  const [discussionId, setDiscussionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  useEffect(() => {
    const el = inputTextareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  // Lazily create the discussion id on mount for discussion-only chats.
  useEffect(() => {
    if (!isDiscussionOnly) return;
    let cancelled = false;
    const uid = auth.currentUser?.uid || "";
    generateNewDiscussionId(uid).then(id => {
      if (!cancelled) setDiscussionId(id);
    });
    return () => { cancelled = true; };
  }, [isDiscussionOnly]);

  // Session initialization / recovery effect
  useEffect(() => {
    let isMounted = true;
    if (isDiscussionOnly) return;

    async function initSession() {
      const user = auth.currentUser;
      if (!user) return;

      // Case A: Scribe opened on an EXISTING case
      const existingCaseItem = caseData || (propCaseId ? { id: propCaseId } : null);
      if (existingCaseItem?.id) {
        try {
          const workspace = await resolveWorkspaceForUser(user.uid);
          const res = await resolveSessionForExistingCase(existingCaseItem, user, workspace);
          if (isMounted) {
            setActiveSessionId(res.sessionId);
            onSessionIdChange?.(res.sessionId);
            setSessionAttachError(null);
            if (res.warning) {
              console.warn(res.warning);
            }
          }
        } catch (err: any) {
          console.error("[VoiceScribeChatView] Session resolve error for existing case:", err);
          if (isMounted) {
            setSessionAttachError(err?.message || "Unable to attach Scribe history to this case.");
          }
        }
        return;
      }

      // Case B: Unlinked Scribe session (pre-case dictation)
      let candidateId = propSessionId || activeSessionId;
      if (!candidateId && user.uid) {
        candidateId = localStorage.getItem(`ermate:scribeSession:${user.uid}`);
      }

      if (candidateId) {
        try {
          const snap = await getDoc(doc(db, "scribeSessions", candidateId));
          if (snap.exists() && isMounted) {
            const sData = snap.data();
            // ACTIVE DRAFT SESSION RULE: only reuse if genuinely unlinked
            if (sData?.linkedCaseId == null) {
              setActiveSessionId(candidateId);
              onSessionIdChange?.(candidateId);
              setSessionAttachError(null);
              return;
            } else {
              // Stale key pointing to already-linked session; remove from draft key
              localStorage.removeItem(`ermate:scribeSession:${user.uid}`);
            }
          }
        } catch (e) {
          console.warn("[VoiceScribeChatView] Candidate session verification check failed:", e);
        }
      }

      // Case C: Create a fresh unlinked session doc BEFORE the first message write
      try {
        const workspace = await resolveWorkspaceForUser(user.uid);
        const newSessionId = await createScribeSession({
          ownerUid: user.uid,
          workspaceType: workspace.workspaceType,
          hospitalId: workspace.hospitalId,
          mode: "case",
        });
        if (isMounted) {
          setActiveSessionId(newSessionId);
          onSessionIdChange?.(newSessionId);
          setSessionAttachError(null);
          localStorage.setItem(`ermate:scribeSession:${user.uid}`, newSessionId);
        }
      } catch (err: any) {
        console.error("[VoiceScribeChatView] Failed to create scribeSession doc:", err);
        if (isMounted) {
          setSessionAttachError(`Unable to initialize Scribe session: ${err?.message || "Storage error"}`);
        }
      }
    }

    initSession();
    return () => {
      isMounted = false;
    };
  }, [propCaseId, caseData?.id, propSessionId]);

  // Subscribe to real-time chat history
  useEffect(() => {
    if (isDiscussionOnly) {
      if (!discussionId) return;
      const unsubscribe = subscribeDiscussionHistory(discussionId, (history) => {
        if (history && history.length > 0) {
          setMessages(
            history.map((h: any) => ({
              id: h.id,
              sender: h.role === "user" ? "user" : "ai",
              text: h.content,
              timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            }))
          );
        }
      });
      return () => unsubscribe();
    } else {
      if (!activeSessionId) return;
      const legacyCaseId = propCaseId || caseData?.id || null;
      const unsubscribe = subscribeSessionAndLegacyHistory(
        activeSessionId,
        legacyCaseId,
        (history) => {
          setHistoryLoadError(null);
          if (history && history.length > 0) {
            setMessages(
              history.map((h: any) => ({
                id: h.id,
                sender: h.role === "user" ? "user" : "ai",
                text: h.content,
                timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                extractionData: h.unappliedExtraction !== undefined ? h.unappliedExtraction : undefined,
                extractionApplied: h.extractionApplied || false,
                dischargeDraft: h.dischargeDraft,
                dischargeApplied: h.dischargeApplied || false,
                dischargeIntent: h.dischargeIntent,
                mode: h.mode || (h.unappliedExtraction !== undefined ? "dictation" : undefined),
                clinicalReasoning: h.clinicalReasoning,
              }))
            );
          } else {
            setMessages([STANDARD_WELCOME_MESSAGE]);
          }
        },
        (err) => {
          console.error("[VoiceScribeChatView] Session history subscription error:", err);
          setHistoryLoadError("Unable to load Scribe history");
        }
      );
      return () => unsubscribe();
    }
  }, [isDiscussionOnly, discussionId, activeSessionId, propCaseId, caseData?.id]);

  // Report busy state to parent for refresh button safety
  useEffect(() => {
    onBusyChange?.(isSending);
  }, [isSending, onBusyChange]);

  // Handle explicit manual refresh trigger from Global Refresh button
  useEffect(() => {
    if (!refreshTrigger) return;
    let isMounted = true;

    async function loadFreshChat() {
      try {
        if (isDiscussionOnly && discussionId) {
          const history = await getDiscussionHistory(discussionId);
          if (isMounted && history && history.length > 0) {
            setMessages(
              history.map((h: any) => ({
                id: h.id,
                sender: h.role === "user" ? "user" : "ai",
                text: h.content,
                timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                mode: "discuss",
              }))
            );
          }
        } else if (activeSessionId) {
          const legacyCaseId = propCaseId || caseData?.id || null;
          const history = await getChatHistory(activeSessionId, legacyCaseId);
          if (isMounted && history && history.length > 0) {
            setMessages(
              history.map((h: any) => ({
                id: h.id,
                sender: h.role === "user" ? "user" : "ai",
                text: h.content,
                timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                extractionData: h.unappliedExtraction !== undefined ? h.unappliedExtraction : undefined,
                extractionApplied: h.extractionApplied || false,
                dischargeDraft: h.dischargeDraft,
                dischargeApplied: h.dischargeApplied || false,
                dischargeIntent: h.dischargeIntent,
                mode: h.mode || (h.unappliedExtraction !== undefined ? "dictation" : undefined),
                clinicalReasoning: h.clinicalReasoning,
              }))
            );
          }
        }
      } catch (err) {
        console.warn("[VoiceScribeChatView] Failed to manually refresh chat history:", err);
      }
    }

    loadFreshChat();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, isDiscussionOnly, discussionId, activeSessionId, propCaseId, caseData?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On unmount, if this was a discussion-only session with at least one
  // real exchange, generate and save a short AI summary so it can be
  // found later in a "My Discussions" list. Fire-and-forget — never
  // blocks navigation.
  useEffect(() => {
    return () => {
      if (isDiscussionOnly && discussionId && messages.length > 1) {
        const transcript = messages
          .filter(m => m.id !== "welcome")
          .map(m => `${m.sender === "user" ? "Doctor" : "ErMate"}: ${m.text}`)
          .join("\n");
        if (!transcript.trim()) return;
        fetch("/api/case-discussion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Summarize the above discussion in one short title (under 8 words) and a 2-3 sentence synopsis. Return ONLY JSON: {"title": "...", "synopsis": "..."}`,
            contextType: "general",
            contextData: {},
            history: [],
            messages: [{ sender: "user", text: `Conversation transcript:\n${transcript}` }],
          }),
        })
          .then(res => res.json())
          .then(data => {
            let parsed: { title?: string; synopsis?: string } = {};
            try {
              const clean = (data.response || "{}").replace(/```json\s*/i, "").replace(/```\s*$/i, "").trim();
              parsed = JSON.parse(clean);
            } catch {
              parsed = { title: "Clinical Discussion", synopsis: data.response?.slice(0, 200) || "" };
            }
            saveDiscussionSummary(discussionId, {
              title: parsed.title || "Clinical Discussion",
              synopsis: parsed.synopsis || "",
            });
          })
          .catch(err => console.warn("[VoiceScribeChatView] Discussion summary generation failed:", err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiscussionOnly, discussionId]);

  const handlePreviewExtraction = (msgId: string, extractionData: any) => {
    setSaveError(null);
    if (onPreviewCaseSheet) {
      const { merged: caseMerged, contributingMsgIds } = getMergedUnappliedCaseExtraction(messages, msgId);
      onPreviewCaseSheet(caseMerged || extractionData, {
        existingCaseId: activeCaseId || null,
        msgId,
        contributingMsgIds,
        scribeSessionId: activeSessionId || null,
      });
    } else if (onOpenCaseSheet && activeCaseId) {
      onOpenCaseSheet(activeCaseId);
    }
  };

  const handlePreviewDischarge = (msgId: string) => {
    setSaveError(null);
    if (onPreviewDischargeSummary) {
      const { merged: dischargeMerged, contributingMsgIds } = getMergedUnappliedDischargeExtraction(messages, msgId);
      onPreviewDischargeSummary(dischargeMerged, {
        existingCaseId: activeCaseId || null,
        msgId,
        contributingMsgIds,
        scribeSessionId: activeSessionId || null,
      });
    }
  };

  const handleApplyExtraction = async (msgId: string, extractionData: any) => {
    if (processingActionRef.current || processingAction) return;
    processingActionRef.current = true;
    setProcessingAction({ messageId: msgId, type: "caseSheet" });
    setSaveError(null);
    try {
      if (onSaveExtractedCase) {
        // Navigation occurs automatically upon successful persistence
        await onSaveExtractedCase(extractionData, { existingCaseId: activeCaseId || undefined, autoNavigate: true });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated(extractionData);
      }
      
      if (activeSessionId && msgId) {
        await updateChatMessage(activeSessionId, msgId, { extractionApplied: true }, { isSession: true }).catch(err => {
            console.warn("Could not save extractionApplied state to Firestore, but case was saved", err);
        });
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      
      const confirmationId = `${msgId}-case-sheet-prepared`;
      const confirmationMsg: Message = {
        id: confirmationId,
        sender: "ai",
        text: "✅ Case Sheet prepared successfully.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: "dictation",
      };
      
      setMessages(prev => {
        if (prev.some(m => m.id === confirmationId)) return prev;
        return [...prev, confirmationMsg];
      });
      persistMessage(confirmationMsg);

      // Note: we don't clear processingAction on success because we want the UI locked while navigating
    } catch (e) {
      console.warn("Failed to apply extraction", e);
      setSaveError("Unable to save the case. Please try again.");
      setProcessingAction(null);
      processingActionRef.current = false;
    }
  };

  const handleApplyDischarge = async (msgId: string, extractionData: any) => {
    if (processingActionRef.current || processingAction) return;
    processingActionRef.current = true;
    setProcessingAction({ messageId: msgId, type: "discharge" });
    setSaveError(null);
    try {
      if (onPrepareDischarge && activeCaseId) {
        await onPrepareDischarge(extractionData, msgId, activeCaseId);
      }
      
      if (activeSessionId && msgId) {
        await updateChatMessage(activeSessionId, msgId, { dischargeApplied: true }, { isSession: true }).catch(err => {
            console.warn("Could not save dischargeApplied state to Firestore, but case was saved", err);
        });
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, dischargeApplied: true } : m));
      
      const confirmationId = `${msgId}-discharge-prepared`;
      const confirmationMsg: Message = {
        id: confirmationId,
        sender: "ai",
        text: "✅ Discharge Summary prepared successfully.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: "dictation",
      };
      
      setMessages(prev => {
        if (prev.some(m => m.id === confirmationId)) return prev;
        return [...prev, confirmationMsg];
      });
      persistMessage(confirmationMsg);

      // Note: we don't clear processingAction on success because we want the UI locked while navigating
    } catch (e) {
      console.warn("Failed to apply discharge summary", e);
      setSaveError("Unable to prepare the discharge summary. Please try again.");
      setProcessingAction(null);
      processingActionRef.current = false;
    }
  };

  const persistMessage = async (message: any) => {
    if (isDiscussionOnly) {
      if (discussionId) {
        try {
          await appendDiscussionMessage(discussionId, message);
        } catch (err: any) {
          console.error("[VoiceScribeChatView] Failed to save discussion message:", err);
        }
      }
      return;
    }

    if (sessionAttachError) {
      console.warn("Cannot persist message while session attach failed:", sessionAttachError);
      setFailedMessages(prev => new Map(prev).set(message.id, { message, error: sessionAttachError }));
      return;
    }

    if (!activeSessionId) {
      console.log("[VoiceScribeChatView] Session ID not yet established, queueing message:", message.id);
      pendingMessageQueueRef.current.push({ message, generation: sessionContextGenerationRef.current });
      return;
    }

    try {
      await appendChatMessage(activeSessionId, message, { isSession: true });
      setFailedMessages(prev => {
        if (!prev.has(message.id)) return prev;
        const next = new Map(prev);
        next.delete(message.id);
        return next;
      });
    } catch (err: any) {
      console.error("[VoiceScribeChatView] Failed to save chat message:", err);
      const reason = err?.message || "Storage write error";
      setFailedMessages(prev => new Map(prev).set(message.id, { message, error: reason }));
    }
  };

  const handleRetryFailedMessage = async (msgId: string) => {
    const item = failedMessages.get(msgId);
    if (!item || !activeSessionId) return;
    try {
      await appendChatMessage(activeSessionId, item.message, { isSession: true });
      setFailedMessages(prev => {
        const next = new Map(prev);
        next.delete(msgId);
        return next;
      });
    } catch (err: any) {
      console.error("Retry failed for message", msgId, err);
      setFailedMessages(prev => new Map(prev).set(msgId, { message: item.message, error: err?.message || "Retry failed" }));
    }
  };

  const handleRetryAllFailed = async () => {
    for (const [msgId] of Array.from(failedMessages.entries())) {
      await handleRetryFailedMessage(msgId);
    }
  };

  const handleStartNewChat = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const workspace = await resolveWorkspaceForUser(user.uid);
      const newSessionId = await createScribeSession({
        ownerUid: user.uid,
        workspaceType: workspace.workspaceType,
        hospitalId: workspace.hospitalId,
        mode: isDiscussionOnly ? "discussion" : "case",
      });
      setActiveSessionId(newSessionId);
      onSessionIdChange?.(newSessionId);
      localStorage.setItem(`ermate:scribeSession:${user.uid}`, newSessionId);
      setActiveCaseId(null);
      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: "ErMate is ready.\n\n🎙️ Dictate the case in your native language and save it to the case sheet.\n💬 Or ask a clinical question — about this patient or any case.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setFailedMessages(new Map());
      setSessionAttachError(null);
      onNewChat?.();
    } catch (err: any) {
      console.error("Failed to start new chat session:", err);
      setSaveError(`Failed to start new chat: ${err?.message || "Error"}`);
    }
  };

  const runRoundsLens = async (lensId: string, doctorPromptText?: string) => {
    if (isSending) return;

    const matchedLens = LENSES.find(l => l.id === lensId);
    const lensLabel = matchedLens?.label || lensId;
    const promptText = (doctorPromptText || "").trim() || `Discuss this case through the ${lensLabel} lens.`;

    setInputText("");
    setIsSending(true);
    const requestGeneration = sessionContextGenerationRef.current;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mode: "discuss",
    };

    setMessages((prev) => [...prev, userMsg]);
    persistMessage({
      id: userMsg.id,
      role: "user",
      type: "text",
      content: promptText,
      timestamp: new Date().toISOString(),
    });

    try {
      // 1. Obtain current in-memory case (saved ClinicalCase + any unapplied Scribe extractions)
      const unappliedExtraction = getMergedUnappliedExtraction(messages);
      let targetCase: ClinicalCase | null = null;
      if (onRequestRoundsCase) {
        targetCase = onRequestRoundsCase(unappliedExtraction);
      } else if (caseData) {
        targetCase = caseData;
      }

      if (!targetCase && isDiscussionOnly) {
        const replyText = "Clinical Rounds lenses require patient case details. Dictate or describe the patient first, or ask a general clinical question.";
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "discuss",
        };
        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!targetCase) {
        const replyText = "No patient case information is available yet to debrief. Please dictate the case first.";
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "discuss",
        };
        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 2. Single Claude Sonnet rounds call via /api/rounds-debrief with exact canonical lensId
      const res = await fetch("/api/rounds-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: targetCase,
          lens: lensId,
          userMessage: promptText,
          chatHistory: messages.map((m) => ({
            sender: m.sender === "user" ? "user" : "ai",
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (sessionContextGenerationRef.current !== requestGeneration) {
        console.warn("[VoiceScribeChatView] Stale rounds debrief response dropped due to generation mismatch.");
        return;
      }
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.reply || "Clinical Rounds debrief unavailable");
      }

      const content = data.data?.content || data.reply || data.response || "No debrief analysis generated.";
      const keyTakeaway = data.data?.keyTakeaway;
      const fullReply = keyTakeaway ? `${content}\n\n**Key Takeaway:** ${keyTakeaway}` : content;

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: fullReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: "discuss",
      };

      setMessages((prev) => [...prev, aiMsg]);
      persistMessage({
        id: aiMsg.id,
        role: "assistant",
        type: "text",
        content: fullReply,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[VoiceScribeChatView] Rounds debrief failed:", err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ Could not reach clinical assistant (${err.message || "network error"}). Your message was saved.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

   const sendToChat = async (text: string, options?: { skipMatePatientResolution?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const requestGeneration = sessionContextGenerationRef.current;

    // Natural-language Rounds routing (patient-linked / case conversation)
    if (!isDiscussionOnly && !options?.skipMatePatientResolution) {
      const roundsLens = detectRoundsLensIntent(trimmed);
      if (roundsLens) {
        await runRoundsLens(roundsLens, trimmed);
        return;
      }
    }

    // ── MATE TRAFFIC-POLICE & CONVERSATIONAL CONTROLLER ─────────────
    if (!isDiscussionOnly && allCases && !options?.skipMatePatientResolution) {
      const activeCensusCases = allCases.filter(c => !(c as any).archivedAt);
      const matePlan = planMateConversation(trimmed);
      const activeCase = activeCaseId ? activeCensusCases.find(c => c.id === activeCaseId) || caseData || null : (caseData || null);
      const mateRoute = routeMateInput({ text: trimmed, activeCase });

      // 1. Social greetings lane (CONVERSATION) -> Respond friendly, zero DB write, zero LLM extraction
      if (mateRoute.primaryIntent === "CONVERSATION" && !matePlan.mayContainClinicalUpdate) {
        setInputText("");
        const userMsg: Message = {
          id: `u-${Date.now()}`,
          sender: "user",
          text: trimmed,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: currentMode,
        };
        const replyText = "Hello Doctor. ErMate is ready. Mention a bed number, ask about bed status, or dictate clinical notes.";
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "discuss",
        };
        setMessages(prev => [...prev, userMsg, aiMsg]);
        persistMessage(userMsg);
        persistMessage(aiMsg);
        return;
      }

      // 2. Patient / Bed context resolution
      const bedRef = extractMateBedReference(trimmed);
      const explicitNewCaseIntent = detectExplicitNewCaseIntent(trimmed);
      let targetCaseId: string | null = null;
      let targetCase: ClinicalCase | null = null;

      if (bedRef) {
        lastReferencedBedRef.current = bedRef;
        const resolution = resolveMateCaseReference({
          utterance: trimmed,
          cases: activeCensusCases,
          activeCaseId,
          physicalCapacity: physicalBedCapacity,
          newCaseIntent: explicitNewCaseIntent,
        });

        if (resolution.status === "INVALID_LOCATION") {
          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: `⚠️ Bed ${resolution.referenceValue} is outside the configured ER capacity (${physicalBedCapacity || 30} beds).`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        if (resolution.status === "AMBIGUOUS") {
          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: explicitNewCaseIntent
              ? `⚠️ Both Bed ${resolution.referenceValue}A and Bed ${resolution.referenceValue}B are currently occupied. Cannot assign a new patient to Bed ${resolution.referenceValue}.`
              : `⚠️ Bed ${resolution.referenceValue} has multiple active occupants (${resolution.candidateCaseIds.length} patients). Please specify the exact slot (e.g. Bed ${resolution.referenceValue}A or ${resolution.referenceValue}B).`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        if (resolution.status === "RESOLVED") {
          if (explicitNewCaseIntent) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const existingOccupant = activeCensusCases.find(c => c.id === resolution.caseId);
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: `⚠️ Bed ${resolution.referenceValue} is already occupied by ${existingOccupant?.patient?.name || 'an active patient'}. Please specify a vacant bed or discharge the current occupant first.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }
          targetCaseId = resolution.caseId;
          targetCase = activeCensusCases.find(c => c.id === targetCaseId) || null;
          lastReferencedCaseIdRef.current = targetCaseId;
        }

        if (resolution.status === "NOT_FOUND") {
          lastReferencedCaseIdRef.current = null;
          if (explicitNewCaseIntent && onEnsureDraftCase) {
            // Explicit new patient workflow on vacant bed -> Establish new draft ClinicalCase
            const assignedBed = resolution.referenceValue || bedRef;
            setInputText("");
            setIsSending(true);
            try {
              const user = auth.currentUser;
              if (!user) throw new Error("Not authenticated");
              const workspace = await resolveWorkspaceForUser(user.uid);
              const newSessionId = await createScribeSession({
                ownerUid: user.uid,
                workspaceType: workspace.workspaceType,
                hospitalId: workspace.hospitalId,
                mode: "case",
              });
              const newCaseId = await onEnsureDraftCase(newSessionId, { bedNo: assignedBed });
              sessionContextGenerationRef.current += 1;
              const currentGen = sessionContextGenerationRef.current;
              pendingNewPatientHandoffRef.current = {
                targetCaseId: newCaseId,
                targetBed: assignedBed,
                utterance: trimmed,
                generation: currentGen,
              };
              setActiveSessionId(newSessionId);
              onSessionIdChange?.(newSessionId);
              onSwitchCase?.(newCaseId);
            } catch (err: any) {
              console.error("[VoiceScribeChatView] Failed to ensure draft case for new patient:", err);
              const errMsg: Message = {
                id: `err-${Date.now()}`,
                sender: "ai",
                text: `⚠️ Could not establish new case for Bed ${assignedBed}: ${err?.message || "Storage error"}`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              };
              setMessages(prev => [...prev, errMsg]);
            } finally {
              setIsSending(false);
            }
            return;
          }

          // Bed is vacant / unoccupied (read-only query)
          if (matePlan.actions.includes("BED_STATUS") || (!matePlan.mayContainClinicalUpdate && (matePlan.actions.includes("PATIENT_OPEN") || matePlan.actions.includes("CASE_SUMMARY")))) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: `Bed ${resolution.referenceValue} is currently vacant (no active patient case).`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }
        }
      } else {
        const displayIdRef = extractMateDisplayIdReference(trimmed);
        if (displayIdRef) {
          const displayRes = resolveMateCaseByDisplayId(displayIdRef, activeCensusCases);
          if (displayRes.status === "RESOLVED") {
            targetCaseId = displayRes.caseId;
            targetCase = displayRes.matchedCase;
            lastReferencedCaseIdRef.current = targetCaseId;
            if (targetCase?.bedNo) {
              lastReferencedBedRef.current = targetCase.bedNo;
            }
          } else if (displayRes.status === "AMBIGUOUS") {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: `⚠️ Multiple cases match reference "${displayIdRef}". Please specify the exact full case ID.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          } else if (displayRes.status === "NOT_FOUND") {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: `Case "${displayIdRef}" was not found in active records.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }
        } else if (
          matePlan.refersToRecentPatient ||
          matePlan.actions.includes("SECTION_NAVIGATE") ||
          matePlan.actions.includes("CASE_COMPLETENESS") ||
          matePlan.actions.includes("DISCHARGE_PENDING") ||
          matePlan.actions.includes("EXPLAIN_CASE") ||
          matePlan.actions.includes("CASE_SUMMARY")
        ) {
          // Conversational pronoun / implicit patient reference: "Open it", "Summarise him", "Show his investigations", "What is incomplete?"
          if (lastReferencedCaseIdRef.current) {
            targetCaseId = lastReferencedCaseIdRef.current;
            targetCase = activeCensusCases.find(c => c.id === targetCaseId) || null;
          } else if (activeCaseId) {
            targetCaseId = activeCaseId;
            targetCase = activeCase;
          }
        }
      }

      // 3. CRITICAL SESSION SAFETY: When resolving a DIFFERENT existing patient
      if (targetCaseId && targetCaseId !== activeCaseId) {
        sessionContextGenerationRef.current += 1;
        const currentGen = sessionContextGenerationRef.current;
        // A. Store original clinician utterance as pending bound to target generation
        pendingUtteranceAfterSwitchRef.current = {
          targetCaseId,
          utterance: trimmed,
          generation: currentGen,
        };

        // B. Immediately request existing ErMate patient/case switch
        onSwitchCase?.(targetCaseId);

        // C. Stop processing immediately — wait for target case and session attachment
        setInputText("");
        return;
      }

      // If we reached here, the target case (if any) is ALREADY the active case!
      // 4. Handle Operational Non-Clinical Commands:
      if (!matePlan.mayContainClinicalUpdate) {
        // A. Pure Bed Status query ("Is 10B occupied?", "Who is on Bed 4?")
        if (matePlan.actions.includes("BED_STATUS") && !matePlan.actions.includes("CASE_SUMMARY") && !matePlan.actions.includes("CASE_SHEET_OPEN") && !matePlan.actions.includes("PATIENT_OPEN")) {
          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const aiText = targetCase
            ? `Bed ${targetCase.bedNo || bedRef} is occupied by ${targetCase.patient?.name || 'Patient'} (${targetCase.patient?.age !== null && targetCase.patient?.age !== undefined ? targetCase.patient.age + 'y/' : ''}${targetCase.patient?.gender || '—'}). Presenting complaint: ${targetCase.patient?.presentingComplaint || 'Under evaluation'}. Status: ${targetCase.status || 'Active'}.`
            : (activeCase
                ? `Bed ${activeCase.bedNo || '—'} is occupied by ${activeCase.patient?.name || 'Patient'} (${activeCase.patient?.age !== null && activeCase.patient?.age !== undefined ? activeCase.patient.age + 'y/' : ''}${activeCase.patient?.gender || '—'}). Presenting complaint: ${activeCase.patient?.presentingComplaint || 'Under evaluation'}. Status: ${activeCase.status || 'Active'}.`
                : `Bed ${bedRef || '—'} is currently vacant (no active patient).`);
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: aiText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        // B. Top-level App Tab Navigation ("Go back to Dashboard", "Open cases", "Show handover")
        if (matePlan.actions.includes("NAVIGATE_TAB") && matePlan.targetTab) {
          setInputText("");
          const tab = matePlan.targetTab;
          await dispatchMateAction(
            { capability: `navigate.${tab}`, targetTab: tab, utterance: trimmed },
            {
              navigateApp: (req, targetTab) => {
                onNavigateToTab?.(targetTab);
              }
            }
          );
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: `Navigating to ${tab.charAt(0).toUpperCase() + tab.slice(1)}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        // C. Section Navigation ("Show his investigations", "Open treatment", "Show disposition")
        if (matePlan.actions.includes("SECTION_NAVIGATE") && matePlan.targetSection) {
          const caseToNav = targetCase || activeCase;
          const caseToNavId = caseToNav?.id || targetCaseId || activeCaseId;
          if (caseToNavId) {
            setInputText("");
            const section = matePlan.targetSection;
            await dispatchMateAction(
              { capability: `case.section.${section}`, caseId: caseToNavId, sectionId: section, utterance: trimmed },
              {
                openCaseSection: (req, secId) => {
                  onOpenCaseSection?.(req.caseId!, secId);
                }
              }
            );
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const bedLabel = caseToNav?.bedNo ? `Bed ${caseToNav.bedNo}` : (caseToNav?.displayId || "patient");
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: `Opening ${bedLabel} ${section} section.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }
        }

        // D. Case Completeness Review ("What is incomplete in Bed 9?", "What is pending in this case?")
        if (matePlan.actions.includes("CASE_COMPLETENESS")) {
          const caseToReview = targetCase || activeCase;
          if (!caseToReview) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: "No active or recent patient context to check completeness for. Please specify a bed number (e.g. Bed 9).",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }

          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const pendingStatus = getCasePendingStatus(caseToReview);
          const bedLabel = caseToReview.bedNo ? `Bed ${caseToReview.bedNo}` : (caseToReview.displayId || "This case");
          let replyText = "";
          if (!pendingStatus.isPending || pendingStatus.pendingCount === 0) {
            replyText = `✓ ${bedLabel} documentation is complete. All clinical sections are filled.`;
          } else {
            replyText = `${bedLabel} has ${pendingStatus.pendingCount} incomplete section${pendingStatus.pendingCount > 1 ? "s" : ""}:\n` +
              pendingStatus.pendingSections.map(s => `• ${s}`).join("\n");
          }

          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        // E. Discharge Completeness ("What is pending in Bed 30 discharge?", "Bed 30 is for discharge. What is pending in the discharge summary?")
        if (matePlan.actions.includes("DISCHARGE_PENDING")) {
          const caseToReview = targetCase || activeCase;
          if (!caseToReview) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: "No active patient context to review discharge status. Please specify a bed number (e.g. Bed 30).",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }

          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const report = checkDischargeCompleteness(caseToReview);
          const bedLabel = caseToReview.bedNo ? `Bed ${caseToReview.bedNo}` : (caseToReview.displayId || "This case");
          let replyText = "";
          if (report.complete) {
            replyText = `✓ ${bedLabel} discharge documentation is complete. No pending items.`;
          } else {
            const lines: string[] = [];
            if (report.missing.length > 0) {
              lines.push(`• Missing: ${report.missing.join(", ")}`);
            }
            if (report.pendingReports.length > 0) {
              lines.push(`• Pending Reports: ${report.pendingReports.join(", ")}`);
            }
            replyText = `${bedLabel} has pending items before discharge:\n` + lines.join("\n");
          }

          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        // F. Whole-Case Explain ("Mate, explain Bed 14", "Use the whole case and explain")
        if (matePlan.actions.includes("EXPLAIN_CASE")) {
          const caseToExplain = targetCase || activeCase;
          if (!caseToExplain) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: "No active patient case to explain. Please specify a bed number (e.g. Bed 14).",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }

          await runRoundsLens("full-debrief", trimmed);
          return;
        }

        // G. Case Sheet Open ("open case sheet", "view case sheet", "open his case sheet", "open case 261006004")
        if (matePlan.actions.includes("CASE_SHEET_OPEN") || mateRoute.targetCapability === "case.open") {
          const caseToOpenId = targetCaseId || activeCaseId;
          if (caseToOpenId) {
            setInputText("");
            await dispatchMateAction(
              { capability: "case.open", caseId: caseToOpenId, utterance: trimmed },
              { openCase: (req) => onOpenCaseSheet?.(req.caseId!) }
            );
            return;
          }
        }

        // H. Case Summary ("Summarise him", "I think 10B is occupied, open Bed 10B and summarise the case")
        if (matePlan.actions.includes("CASE_SUMMARY")) {
          const caseToSummarize = targetCase || activeCase;
          if (!caseToSummarize) {
            setInputText("");
            const userMsg: Message = {
              id: `u-${Date.now()}`,
              sender: "user",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: currentMode,
            };
            const aiMsg: Message = {
              id: `ai-${Date.now()}`,
              sender: "ai",
              text: "No active or recent patient context to summarize. Please specify a bed number (e.g. Bed 10B).",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              mode: "discuss",
            };
            setMessages(prev => [...prev, userMsg, aiMsg]);
            persistMessage(userMsg);
            persistMessage(aiMsg);
            return;
          }

          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const p = caseToSummarize.patient;
          const v = caseToSummarize.vitals;
          const complaint = p?.presentingComplaint || "Under Evaluation";
          const vitalsStr = [
            v?.hr ? `HR ${v.hr} bpm` : null,
            v?.bp ? `BP ${v.bp}` : null,
            v?.spo2 ? `SpO2 ${v.spo2}%` : null,
            v?.rr ? `RR ${v.rr}` : null,
            v?.temp ? `Temp ${v.temp}°C` : null,
            v?.gcs ? `GCS ${v.gcs}` : null,
          ].filter(Boolean).join(", ") || "Vitals not recorded";
          const dx = caseToSummarize.dischargeInfo?.primaryDiagnosis || caseToSummarize.provisionalPrimaryDiagnosis || "Under evaluation";

          let summaryText = `📋 **Bed ${caseToSummarize.bedNo || '—'} Case Summary**\n` +
            `• **Patient:** ${p?.name || 'Unknown'}, ${p?.age !== null && p?.age !== undefined ? p.age + 'y/' : ''}${p?.gender || '—'}\n` +
            `• **Presenting Complaint:** ${complaint}\n` +
            `• **Arrival Vitals:** ${vitalsStr}\n` +
            `• **Working Diagnosis:** ${dx}\n` +
            `• **Current Status:** ${caseToSummarize.status || 'Active'}`;

          if (matePlan.actions.includes("BED_STATUS")) {
            summaryText = `✓ Bed ${caseToSummarize.bedNo || '—'} is occupied.\n\n` + summaryText;
          }

          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: summaryText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }

        // I. Pure Patient Open confirmation ("Open Bed 10B", "Open it")
        if (matePlan.actions.includes("PATIENT_OPEN") && targetCase) {
          setInputText("");
          const userMsg: Message = {
            id: `u-${Date.now()}`,
            sender: "user",
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: currentMode,
          };
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: `Patient context active: Bed ${targetCase.bedNo || '—'} (${targetCase.patient?.name || 'Patient'}, ${targetCase.patient?.age !== null && targetCase.patient?.age !== undefined ? targetCase.patient.age + 'y/' : ''}${targetCase.patient?.gender || '—'}). Ready for clinical dictation or debrief.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "discuss",
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          persistMessage(userMsg);
          persistMessage(aiMsg);
          return;
        }
      }
    }
    // ── END OF MATE TRAFFIC-POLICE INTERCEPTION ─────────────────────

    setInputText("");
    setIsSending(true);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mode: currentMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    persistMessage({
      id: userMsg.id,
      role: "user",
      type: "text",
      content: trimmed,
      timestamp: new Date().toISOString(),
    });

    try {
      if (currentMode === "discuss") {
        // ── DISCUSS MODE — Claude Sonnet only, read-only, via /api/case-discussion.
        // No AbortController/timeout — per explicit request, discuss-mode
        // (and dictation, below) now wait indefinitely for a response.
        // suggestedUpdate is deliberately ignored — discuss-mode conversations
        // never write to the real case sheet, regardless of what the model proposes.
        const res = await fetch("/api/case-discussion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            contextType: isDiscussionOnly ? "general" : "case",
            contextData: isDiscussionOnly ? {} : (caseData || {}),
            caseData: isDiscussionOnly ? {} : (caseData || {}),
            history: messages,
            messages: [...messages, userMsg].map((m) => ({
              sender: m.sender === "user" ? "user" : "ai",
              text: m.text,
            })),
          }),
        });
        const data = await res.json();
        if (sessionContextGenerationRef.current !== requestGeneration) {
          console.warn("[VoiceScribeChatView] Stale discuss response dropped due to generation mismatch.");
          return;
        }
        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.response || data.reply || "I've reviewed the case, but couldn't form a clear answer just now.";
        const dischargeIntent = data.dischargeIntent;
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "discuss",
        };
        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });
      } else {
        // ── DICTATION MODE — GPT-4o-mini extraction (parallel) + Claude
        // Sonnet reasoning, via /api/scribe-chat. No timeout, as above.
        const res = await fetch("/api/scribe-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userInput: trimmed,
            caseId: activeCaseId,
            caseData: caseData || {},
            patientAgeYears: caseData?.patient?.age ?? null,
            caseContext: caseData || {},
            messages: messages,
          }),
        });

        const data = await res.json();
        if (sessionContextGenerationRef.current !== requestGeneration) {
          console.warn("[VoiceScribeChatView] Stale scribe extraction response dropped due to generation mismatch.");
          return;
        }
        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.reply || data.aiReply || data.summary || "Processed case details.";
        const rawFieldsToExtract = data.unappliedExtraction || data.updatedCaseSheetFields || data.extractedFields;
        // Always keep the extraction object (even if empty) so the full
        // checklist card can render and honestly show 0/N captured, rather
        // than silently disappearing — the "Copy to Case Sheet" button itself
        // still only appears when hasDisplayableExtraction() is true (see render).
        const fieldsToExtract = rawFieldsToExtract ? { ...rawFieldsToExtract } : {};
        const isEstablishedCase = isEstablishedCaseSheet(caseData, messages);
        if (isEstablishedCase) {
          if (!fieldsToExtract.clinicianUpdateText && trimmed && !/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(trimmed)) {
            fieldsToExtract.clinicianUpdateText = trimmed;
          }
          if (!fieldsToExtract.clinicianUpdates && trimmed && !/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(trimmed)) {
            fieldsToExtract.clinicianUpdates = [
              { text: trimmed, timestamp: userMsg.timestamp }
            ];
          }
        } else {
          delete fieldsToExtract.clinicianUpdateText;
          delete fieldsToExtract.clinicianUpdates;
        }
        const dischargeIntent = data.dischargeIntent;
        const clinicalReasoning = data.reasoningMessage?.clinicalReasoning || data.clinicalReasoning;

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "dictation",
          extractionData: fieldsToExtract,
          extractionApplied: false,
          dischargeIntent: dischargeIntent,
          clinicalReasoning: clinicalReasoning,
        };

        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
          unappliedExtraction: fieldsToExtract ? JSON.parse(JSON.stringify(fieldsToExtract)) : undefined,
          extractionApplied: false,
          dischargeIntent: dischargeIntent,
          mode: "dictation",
          clinicalReasoning: clinicalReasoning,
        });
      }
    } catch (err: any) {
      if (sessionContextGenerationRef.current !== requestGeneration) {
        console.warn("[VoiceScribeChatView] Stale error dropped due to generation mismatch.");
        return;
      }
      console.error("[VoiceScribeChatView] Send failed:", err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ Could not reach clinical assistant (${err.message || "network error"}). Your message was saved.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      if (sessionContextGenerationRef.current === requestGeneration) {
        setIsSending(false);
      }
    }
  };

  // Replay pending utterance once target case AND canonical Scribe session are attached
  useEffect(() => {
    // 1. Explicit new patient handoff replay
    if (pendingNewPatientHandoffRef.current) {
      const pendingNew = pendingNewPatientHandoffRef.current;
      // Stale generation check: discard without replaying if generation shifted
      if (pendingNew.generation !== sessionContextGenerationRef.current) {
        pendingNewPatientHandoffRef.current = null;
        return;
      }
      if (
        activeCaseId === pendingNew.targetCaseId &&
        activeSessionId &&
        !sessionAttachError &&
        !isSending
      ) {
        pendingNewPatientHandoffRef.current = null;
        sendToChat(pendingNew.utterance, { skipMatePatientResolution: true });
        return;
      }
    }

    // 2. Existing patient switch replay
    if (pendingUtteranceAfterSwitchRef.current) {
      const pending = pendingUtteranceAfterSwitchRef.current;
      // Stale generation check: discard without replaying if generation shifted
      if (pending.generation !== sessionContextGenerationRef.current) {
        pendingUtteranceAfterSwitchRef.current = null;
        return;
      }
      if (
        activeCaseId === pending.targetCaseId &&
        activeSessionId &&
        !sessionAttachError &&
        !isSending
      ) {
        pendingUtteranceAfterSwitchRef.current = null;
        sendToChat(pending.utterance, { skipMatePatientResolution: true });
      }
    }
  }, [activeCaseId, activeSessionId, sessionAttachError, isSending]);

  const handleLensClick = (lensId: string) => {
    setShowLensMenu(false);
    runRoundsLens(lensId);
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      // Honest limitation — no PDF/Word text-extraction pipeline exists
      // anywhere in this codebase today. Do not fake success.
      setMessages(prev => [...prev, {
        id: `err-attach-${Date.now()}`,
        sender: "ai",
        text: "⚠️ PDF and Word attachments aren't supported yet — please paste the text directly, or attach a photo/screenshot instead.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/scribe-ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || "Could not read the attached image.");
      }

      const scanned = data.data;
      const scannedText = scanned.clinicalNarrative
        || [scanned.patientName, scanned.presentingComplaint, scanned.symptoms].filter(Boolean).join(". ")
        || "Attached document processed, but no readable clinical text was found.";

      // Feed the scanned text through the currently active mode, exactly
      // as if the doctor had typed or dictated it.
      await sendToChat(scannedText);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `err-attach-${Date.now()}`,
        sender: "ai",
        text: `⚠️ Could not process the attached image (${err.message || "unknown error"}). Please try again or paste the text manually.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const headerTitle = "ErMate Assistant";
  const headerSubtitle = isDiscussionOnly
    ? "Discuss any case — no patient record required"
    : caseData
      ? (caseData.bedNo || caseData.patient?.bed
          ? `Current context: Bed ${caseData.bedNo || caseData.patient?.bed} / ${caseData.patient?.name || "Patient"}`
          : `Current context: ${caseData.displayId || caseData.id} / ${caseData.patient?.age !== null && caseData.patient?.age !== undefined ? `${caseData.patient.age}${caseData.patient.gender?.charAt(0) || ""}` : (caseData.patient?.name || "Patient")} • Bed: Unassigned`)
      : "Dictate the case in your native language, or ask a clinical question";

  return (
    <div className={`flex flex-col h-full w-full bg-white dark:bg-slate-950 overflow-hidden ${isSidecar ? '' : 'h-[calc(100vh-140px)] min-h-[500px] max-w-5xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl'}`}>
      <div className={`bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 ${isSidecar ? 'px-3.5 py-2.5' : 'px-4 py-3'}`}>
        {isSidecar ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  MATE
                </h2>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                {caseData
                  ? (caseData.bedNo || caseData.patient?.bed
                      ? `Current context: Bed ${caseData.bedNo || caseData.patient?.bed} / ${caseData.patient?.name || "Patient"}`
                      : `Current context: ${caseData.displayId || caseData.id} / ${caseData.patient?.age !== null && caseData.patient?.age !== undefined ? `${caseData.patient.age}${caseData.patient.gender?.charAt(0) || ""}` : (caseData.patient?.name || "Patient")} • Bed: Unassigned`)
                  : "Current context: No patient selected"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 font-bold flex items-center gap-1 cursor-pointer">
              <ArrowLeft size={16} /> Back
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {headerTitle}
                </h2>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{headerSubtitle}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {(failedMessages.size > 0 || sessionAttachError || historyLoadError) && (
            <div className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded text-[10px] font-semibold flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate max-w-[80px]">{historyLoadError || `Failed (${failedMessages.size || 1})`}</span>
            </div>
          )}

          {!isDiscussionOnly && (
            <button
              type="button"
              onClick={handleStartNewChat}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer font-mono"
              title="Start a new Scribe session (clears patient context)"
            >
              <Plus size={13} />
              <span>New Chat</span>
            </button>
          )}

          {isSidecar ? (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
              title="Close MATE"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          ) : (
            onOpenCaseSheet && !isDiscussionOnly && (
              <button
                onClick={async () => {
                  const unappliedMessages = messages.filter(m => m.extractionData && !m.extractionApplied);
                  if (unappliedMessages.length > 0 && onPreviewCaseSheet) {
                    const { merged: mergedExtraction, contributingMsgIds } = getMergedUnappliedCaseExtraction(messages);
                    const latestMsg = unappliedMessages[unappliedMessages.length - 1];
                    onPreviewCaseSheet(mergedExtraction, {
                      existingCaseId: activeCaseId || null,
                      msgId: latestMsg?.id,
                      contributingMsgIds,
                      scribeSessionId: activeSessionId || null,
                    });
                    return;
                  }
                  if (onSaveExtractedCase) {
                    try {
                      if (unappliedMessages.length > 0) {
                        const mergedExtraction = getMergedUnappliedExtraction(messages);
                        await onSaveExtractedCase(mergedExtraction, { existingCaseId: activeCaseId || undefined, autoNavigate: true });
                        setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                      } else {
                        if (messages.filter(m => m.extractionData).length === 0) {
                          await onSaveExtractedCase({}, { existingCaseId: activeCaseId || undefined, autoNavigate: true });
                        }
                      }
                    } catch (e) {
                      console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                      setSaveError("Unable to save this case. Please try again.");
                      return;
                    }
                  }
                  if (activeCaseId) {
                    onOpenCaseSheet(activeCaseId);
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>📄 Open Case Sheet</span>
              </button>
            )
          )}
        </div>
      </div>

      {!isDiscussionOnly && caseData && !isSidecar && (
        <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
          <span className="truncate">
            {caseData.bedNo || caseData.patient?.bed ? `Bed ${caseData.bedNo || caseData.patient?.bed}` : `${caseData.displayId || caseData.id} • Bed: Unassigned`} • UHID {caseData?.patient?.uhid || "--"} • {caseData?.patient?.age ? `${caseData.patient.age}${caseData.patient.gender?.charAt(0) || caseData.patient.sex?.charAt(0) || ""}` : "--"}
          </span>
          <span className="shrink-0">{caseData?.status || "Active"}</span>
        </div>
      )}

      {/* Mode toggle strip — only shown when dictation is actually an option */}
      {!isDiscussionOnly && (
        <div className={`bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 ${isSidecar ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
          <button
            onClick={() => setCurrentMode("dictation")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === "dictation"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <MicIcon size={13} /> Dictation
          </button>
          <button
            onClick={() => setCurrentMode("discuss")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === "discuss"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <MessageSquare size={13} /> Discuss
          </button>
          {currentMode === "discuss" && !isSidecar && (
            <span className="text-[10px] text-slate-400 italic ml-1">Read-only — won't be saved to the case sheet</span>
          )}
        </div>
      )}

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-transparent min-w-0">
        {historyLoadError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-500 shrink-0" />
            <span>⚠️ {historyLoadError}</span>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] min-w-0 rounded-2xl p-3.5 text-xs leading-relaxed break-words ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none"
              }`}
            >
              {msg.mode === "discuss" && msg.sender === "ai" && (
                <div className="mb-1.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400">
                  <Sparkles size={10} /> Discuss
                </div>
              )}
              {msg.sender === "user" ? (
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                  <Markdown>{msg.text}</Markdown>
                </div>
              ) : (
                <ScribeReasoningRenderer
                  text={msg.text}
                  clinicalReasoning={msg.clinicalReasoning}
                />
              )}

                               {msg.mode === "dictation" &&
 msg.sender === "ai" &&
 msg.extractionData !== undefined &&
 (() => {

  const caseMerged = mergeExtractionUpTo(messages, msg.id);
  const { merged: dischargeMerged } = getMergedUnappliedDischargeExtraction(messages, msg.id);
  const merged = msg.extractionApplied ? dischargeMerged : caseMerged;
  const entries = getDisplayableExtractionEntries(merged);

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">

      <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
        CAPTURED FROM YOUR UPDATE
      </div>

      {merged?.mlcDetails?.possibleMlc && !merged?.mlcDetails?.isMlc && (
        <div className="mx-3 mt-3 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-orange-800 dark:text-orange-300">
            <span>⚠️</span>
            <span className="font-semibold">Possible MLC detected</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const newMessages = [...messages];
                const targetMsg = newMessages.find(m => m.id === msg.id);
                if (targetMsg?.extractionData?.mlcDetails) {
                  targetMsg.extractionData.mlcDetails.isMlc = true;
                  targetMsg.extractionData.mlcDetails.mlcConfirmedByClinician = true;
                  targetMsg.extractionData.mlcDetails.possibleMlc = false;
                  setMessages(newMessages);
                }
              }}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded shadow-sm"
            >
              Confirm
            </button>
            <button 
              onClick={() => {
                const newMessages = [...messages];
                const targetMsg = newMessages.find(m => m.id === msg.id);
                if (targetMsg?.extractionData?.mlcDetails) {
                  targetMsg.extractionData.mlcDetails.isMlc = false;
                  targetMsg.extractionData.mlcDetails.mlcConfirmedByClinician = true;
                  targetMsg.extractionData.mlcDetails.possibleMlc = false;
                  setMessages(newMessages);
                }
              }}
              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded shadow-sm"
            >
              Not MLC
            </button>
          </div>
        </div>
      )}

      {(() => {
        const detectedProc = detectProcedureFromExtraction(merged);
        if (!detectedProc) return null;
        return (
          <div className="mx-3 mt-3 p-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300">
              <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div>
                <span className="font-semibold block">Procedure Detected: {detectedProc.name}</span>
                <span className="text-[11px] text-sky-600 dark:text-sky-400">Structured guided form ready for clinician confirmation</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setProcedureModalState({
                  isOpen: true,
                  procDef: detectedProc,
                  initialPrefill: {
                    metadata: {
                      indication: detectedProc.defaultIndication || ""
                    }
                  },
                  messageId: msg.id
                });
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-md shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Fill Procedure Note</span>
            </button>
          </div>
        );
      })()}

      <div className="p-3 text-xs space-y-2 text-slate-600 dark:text-slate-400 max-h-[340px] overflow-y-auto">

        {entries.map(([key, val]) => (
          <div key={key}>
            <strong className="text-slate-800 dark:text-slate-200">
              {humanizeFieldLabel(key)}:
            </strong>{" "}
            {formatExtractionEntryValue(key, val)}
          </div>
        ))}

      </div>

      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2">
        {msg.extractionApplied === true ? (
          <button
            onClick={() => {
              if (onOpenCaseSheet && activeCaseId) {
                onOpenCaseSheet(activeCaseId);
              }
            }}
            className="flex-1 py-1.5 flex items-center justify-center gap-2 rounded text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <span>View Case Sheet</span>
          </button>
        ) : (
          <button
            onClick={() => handlePreviewExtraction(msg.id, caseMerged)}
            className="flex-1 py-1.5 flex items-center justify-center gap-2 rounded text-xs font-bold transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <span>Preview Case Sheet</span>
          </button>
        )}
        <button
          onClick={() => handlePreviewDischarge(msg.id)}
          className="flex-1 py-1.5 flex items-center justify-center gap-2 rounded text-xs font-bold transition-all cursor-pointer shadow-sm bg-purple-600 hover:bg-purple-700 text-white"
        >
          <span>Preview Discharge Summary</span>
        </button>
      </div>
    </div>
  );
})()}

              

              {failedMessages.has(msg.id) && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                    <span>⚠️ Not saved — {failedMessages.get(msg.id)?.error || "Storage write error"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRetryFailedMessage(msg.id)}
                    className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 rounded text-amber-800 dark:text-amber-200 text-[11px] font-semibold transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-2 text-[9px] font-mono opacity-60">
                <span>{failedMessages.has(msg.id) ? "⚠️ Unsaved" : ""}</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))}

        {(isSending || isUploadingAttachment) && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3 text-xs text-slate-500 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              {isUploadingAttachment ? "Reading attachment..." : "Analyzing with ErMate Clinical Engine..."}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {saveError && (
        <div className="border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-xs font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {saveError}
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="px-3 py-1.5 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Voice Recorder & Input Section */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 relative" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {showLensMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowLensMenu(false)} />
            <div className="absolute bottom-full left-3 mb-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden w-56">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                <Sparkles size={12} /> Discuss with a lens
              </div>
              {LENSES.map((lens) => (
                <button
                  key={lens.id}
                  onClick={() => handleLensClick(lens.id)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lens.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Left Controls */}
          <div className="flex items-center gap-1 order-2 sm:order-1">
            <button
              type="button"
              onClick={() => setShowLensMenu(v => !v)}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
              title="Clinical lenses"
            >
              <MoreVertical size={18} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 disabled:opacity-40"
              title="Attach an image (PDF/Word not yet supported)"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleAttachmentSelected}
              className="hidden"
            />
          </div>

          {/* Textarea */}
          <div className="flex-1 flex min-w-0 w-full order-1 sm:order-2 basis-full sm:basis-auto">
            <textarea
              ref={inputTextareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isSending) {
                    sendToChat(inputText);
                  }
                }
              }}
              placeholder={currentMode === "discuss" ? "Ask anything about this case..." : "Type clinical details / questions..."}
              disabled={isSending}
              rows={1}
              className="flex-1 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: "160px" }}
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center shrink-0 order-3 sm:order-3 ml-auto sm:ml-0">
            {inputText.trim() ? (
              <button
                onClick={() => sendToChat(inputText)}
                disabled={isSending}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full cursor-pointer shadow-md transition-all flex items-center justify-center shrink-0 w-10 h-10"
              >
                <Send size={16} className="mr-0.5" />
              </button>
            ) : (
              <VoiceRecorder
                renderMode="compact-button"
                onTranscript={sendToChat}
                disabled={isSending}
              />
            )}
          </div>
        </div>
      </div>

      {procedureModalState?.isOpen && procedureModalState.procDef && (
        <ProcedureNoteFormModal
          isOpen={procedureModalState.isOpen}
          onClose={() => setProcedureModalState(null)}
          caseId={activeCaseId || "NEW-CASE"}
          defaultDoctorName={profile?.doctorName || profile?.displayName || ""}
          procDef={procedureModalState.procDef}
          initialPrefill={procedureModalState.initialPrefill}
          onSave={handleSaveDetectedProcedure}
        />
      )}
    </div>
  );
}