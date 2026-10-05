import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, MoreVertical, Paperclip, Sparkles, MessageSquare, Mic as MicIcon, Activity, AlertTriangle, Plus } from "lucide-react";
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
import type { ClinicalCase } from "../types";
import { ProcedureNote } from "../types/procedureNotes";
import { ProcedureNoteFormModal } from "./ProcedureNoteFormModal";
import { routeMateInput } from "../mate/mateRouter";
import {
  extractMateBedReference,
  resolveMateCaseReference,
} from "../mate/mateCaseResolver";
import { dispatchMateAction } from "../mate/mateActionDispatcher";
import { planMateConversation } from "../mate/mateConversationPlanner";

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

interface VoiceScribeChatViewProps {
  caseId?: string | null;
  caseData?: any;
  sessionId?: string | null;
  onSessionIdChange?: (sessionId: string | null) => void;
  onNewChat?: () => void;
  onBack: () => void;
  onOpenCaseSheet?: (caseId: string) => void;
  onCaseSheetUpdated?: (fields: any) => void;
  onSaveExtractedCase?: (extracted: any, options?: { autoNavigate?: boolean; existingCaseId?: string }) => Promise<string>;
  onPrepareDischarge?: (extractedData: any, messageId: string, caseId: string) => Promise<void>;
  onPreviewCaseSheet?: (
    extracted: any,
    options?: {
      existingCaseId?: string | null;
      msgId?: string;
      sessionId?: string | null;
    }
  ) => void | Promise<void>;
  onEnsureDraftCase?: (
    sessionId: string,
    options?: { bedNo?: string }
  ) => Promise<string>;

  /**
   * Existing ErMate patient census used only for deterministic
   * MATE patient-context resolution.
   */
  cases?: ClinicalCase[];

  /**
   * Canonical configured physical ER capacity.
   */
  erPhysicalBedCapacity?: number | null;

  /**
   * Parent-owned bridge for switching MATE to an EXISTING case.
   * This must not create or mutate a ClinicalCase.
   */
  onSelectMateCase?: (caseId: string) => void;
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

  // MATE V1 SAFETY:
  // Classifier-only negative MLC metadata must not count as a
  // meaningful clinical extraction or create a ghost draft case.
  //
  // Positive MLC classification and explicitly extracted MLC text
  // remain displayable. This changes display/draft eligibility only;
  // it does not invent, remove, or apply patient clinical facts.
  if (
    normalizedData.mlcDetails &&
    typeof normalizedData.mlcDetails === "object" &&
    !Array.isArray(normalizedData.mlcDetails)
  ) {
    const meaningfulMlcEntries = Object.entries(
      normalizedData.mlcDetails
    ).filter(([key, val]) => {
      if (
        (key === "possibleMlc" || key === "isMlc") &&
        val === false
      ) {
        return false;
      }

      if (val === null || val === undefined || val === "") {
        return false;
      }

      return true;
    });

    if (meaningfulMlcEntries.length === 0) {
      delete normalizedData.mlcDetails;
    } else {
      normalizedData.mlcDetails =
        Object.fromEntries(meaningfulMlcEntries);
    }
  }

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
            const isDup = combined.some(c => {
              if (!c || typeof c !== "object") return false;
              if (c.id && item.id && c.id === item.id) return true;
              if (c.name && item.name && c.name.toLowerCase() === item.name.toLowerCase()) return true;
              if (c.diagnosis && item.diagnosis && c.diagnosis.toLowerCase() === item.diagnosis.toLowerCase()) return true;
              if (c.medication && item.medication && c.medication.toLowerCase() === item.medication.toLowerCase()) return true;
              if (c.drugName && item.drugName && c.drugName.toLowerCase() === item.drugName.toLowerCase()) return true;
              return false;
            });
            if (!isDup) combined.push(item);
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
 */
export function getMergedUnappliedExtraction(messages: Message[], targetId?: string): any {
  let merged: any = {};
  for (const msg of messages) {
    if (msg.extractionData && !msg.extractionApplied) {
      merged = deepMergeExtraction(merged, msg.extractionData);
    }
    if (targetId && msg.id === targetId) {
      break;
    }
  }
  return merged;
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
  onCaseSheetUpdated,
  onSaveExtractedCase,
  onPrepareDischarge,
  onPreviewCaseSheet,
  onEnsureDraftCase,
  cases = [],
  erPhysicalBedCapacity = null,
  onSelectMateCase,
  profile,
  onSaveProfile,
  messages: propMessages,
  onUpdateMessages,
  initialEntryMode = "case",
  refreshTrigger,
  onBusyChange,
}: VoiceScribeChatViewProps) {
  const processingActionRef = useRef(false);
  // A chat is "case-linked" if either a real caseId was passed in, OR
  // the caller didn't explicitly ask for a standalone discussion.
  const isDiscussionOnly = initialEntryMode === "discussion" && !propCaseId;

  // MATE opens silently.
  // Opening MATE is not itself a conversation turn.
  // The clinician's first actual input becomes the first visible message.
  const [messages, setMessages] = useState<Message[]>([]);
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

  type FailedMessageRecord = {
    message: any;
    error: string;
    targetSessionId: string | null;
  };

  type PendingMessageRecord = {
    message: any;
    contextGeneration: number;
  };

  // Scribe session state: ensures continuity across remounts and refresh
  // Fail closed until session initialization/recovery has verified the
  // session that belongs to the current Scribe context.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionAttachError, setSessionAttachError] = useState<string | null>(null);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<Map<string, FailedMessageRecord>>(new Map());
  const pendingMessageQueueRef = useRef<PendingMessageRecord[]>([]);
  const sessionContextGenerationRef = useRef(0);

  /**
   * MATE new-patient handoff.
   *
   * A spoken "new patient" command must never reuse the previous
   * patient's Scribe session.
   *
   * MATE therefore:
   * 1. crosses the existing ErMate New Chat/session boundary,
   * 2. waits until that unlinked session is active,
   * 3. establishes the new ClinicalCase/bed,
   * 4. waits until that case-bound session is active,
   * 5. replays the ORIGINAL clinician utterance into the existing Scribe.
   *
   * This is orchestration only. No clinical extraction happens here.
   */
  const pendingMateNewPatientRef = useRef<{
    text: string;
    stage: "AWAIT_UNLINKED_SESSION" | "AWAIT_BOUND_CASE";
    expectedCaseId?: string;
    notice?: string;
  } | null>(null);

  /**
   * Existing-patient MATE handoff.
   *
   * When MATE resolves a DIFFERENT existing patient, React state updates
   * do not rewrite the current render closure immediately.
   *
   * Therefore we stop processing, allow ErMate to attach the canonical
   * case + Scribe session, then replay the ORIGINAL utterance once.
   *
   * No ClinicalCase creation or clinical extraction occurs here.
   */
  const pendingMateExistingPatientRef = useRef<{
    text: string;
    expectedCaseId: string;
  } | null>(null);

  /**
   * MATE operational conversation context.
   *
   * This is NOT clinical memory.
   * It stores only the last safely resolved ErMate patient reference so
   * later conversational commands can eventually support phrases such as
   * "open it" or "summarise him" without guessing.
   */
  const mateConversationContextRef = useRef<{
    lastReferencedCaseId: string | null;
    lastReferencedBed: string | null;
  }>({
    lastReferencedCaseId: null,
    lastReferencedBed: null,
  });

  React.useLayoutEffect(() => {
    const target = propCaseId || caseData?.id;
    if (target !== activeCaseId) {
      // A patient/case boundary invalidates the previous session immediately.
      // No message may use the old session while the new case is resolving.
      sessionContextGenerationRef.current += 1;
      pendingMessageQueueRef.current = [];
      setFailedMessages(new Map());
      setSessionAttachError(null);
      setActiveSessionId(null);
      setIsSending(false);
      setIsUploadingAttachment(false);
      setActiveCaseId(target || null);
    }
  }, [propCaseId, caseData?.id]);

  // On EVERY activeSessionId change:
  // 1. Synchronously reset UI state to an empty conversation
  // 2. Clear any extraction/draft state derived from the previous session
  useEffect(() => {
    if (isDiscussionOnly) return;
    setMessages([]);
    setHistoryLoadError(null);
    setProcedureModalState(null);
    setProcessingAction(null);
    setSaveConfirmation(null);
  }, [activeSessionId, isDiscussionOnly]);

  // Flush messages written before session was ready.
  // A queued message may flush only inside the same Scribe context in which
  // it was created. The resolved session ID is captured before the write.
  useEffect(() => {
    if (!activeSessionId || sessionAttachError) return;
    if (pendingMessageQueueRef.current.length === 0) return;

    const queue = [...pendingMessageQueueRef.current];
    pendingMessageQueueRef.current = [];
    const targetSessionId = activeSessionId;

    const flushQueue = async () => {
      for (const queued of queue) {
        const msg = queued.message;

        if (queued.contextGeneration !== sessionContextGenerationRef.current) {
          console.warn(
            "[VoiceScribeChatView] Dropped stale queued message from a previous Scribe context:",
            msg.id
          );
          continue;
        }

        try {
          await appendChatMessage(targetSessionId, msg, { isSession: true });
          setFailedMessages(prev => {
            if (!prev.has(msg.id)) return prev;
            const next = new Map(prev);
            next.delete(msg.id);
            return next;
          });
        } catch (err: any) {
          console.error("[VoiceScribeChatView] Failed to flush queued message:", err);
          const reason = err?.message || "Storage write error";
          setFailedMessages(prev =>
            new Map(prev).set(msg.id, {
              message: msg,
              error: reason,
              targetSessionId,
            })
          );
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
            setMessages([]);
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
      onPreviewCaseSheet(extractionData, {
        existingCaseId: activeCaseId || null,
        msgId,
        sessionId: activeSessionId,
      });
    } else if (onOpenCaseSheet && activeCaseId) {
      onOpenCaseSheet(activeCaseId);
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
      setFailedMessages(prev =>
        new Map(prev).set(message.id, {
          message,
          error: sessionAttachError,
          targetSessionId: null,
        })
      );
      return;
    }

    if (!activeSessionId) {
      console.log("[VoiceScribeChatView] Session ID not yet established, queueing message:", message.id);
      pendingMessageQueueRef.current.push({
        message,
        contextGeneration: sessionContextGenerationRef.current,
      });
      return;
    }

    // Capture the destination at message creation/write time.
    // Never substitute a later activeSessionId for this write.
    const targetSessionId = activeSessionId;

    try {
      await appendChatMessage(targetSessionId, message, { isSession: true });
      setFailedMessages(prev => {
        if (!prev.has(message.id)) return prev;
        const next = new Map(prev);
        next.delete(message.id);
        return next;
      });
    } catch (err: any) {
      console.error("[VoiceScribeChatView] Failed to save chat message:", err);
      const reason = err?.message || "Storage write error";
      setFailedMessages(prev =>
        new Map(prev).set(message.id, {
          message,
          error: reason,
          targetSessionId,
        })
      );
    }
  };

  const handleRetryFailedMessage = async (msgId: string) => {
    const item = failedMessages.get(msgId);
    if (!item) return;

    if (!item.targetSessionId) {
      setFailedMessages(prev =>
        new Map(prev).set(msgId, {
          ...item,
          error: "Original Scribe session was not established. Message was not written.",
        })
      );
      return;
    }

    if (!activeSessionId || activeSessionId !== item.targetSessionId) {
      setFailedMessages(prev =>
        new Map(prev).set(msgId, {
          ...item,
          error: "This message belongs to a different Scribe session and was not written here.",
        })
      );
      return;
    }

    try {
      await appendChatMessage(item.targetSessionId, item.message, { isSession: true });
      setFailedMessages(prev => {
        const next = new Map(prev);
        next.delete(msgId);
        return next;
      });
    } catch (err: any) {
      console.error("Retry failed for message", msgId, err);
      setFailedMessages(prev =>
        new Map(prev).set(msgId, {
          message: item.message,
          error: err?.message || "Retry failed",
          targetSessionId: item.targetSessionId,
        })
      );
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

    // Explicit Scribe context boundary: no message from the previous
    // chat may be written while the new session is being created.
    sessionContextGenerationRef.current += 1;
    const newChatContextGeneration = sessionContextGenerationRef.current;
    pendingMessageQueueRef.current = [];
    setSessionAttachError(null);
    setActiveSessionId(null);
    setIsSending(false);
    setIsUploadingAttachment(false);

    try {
      const workspace = await resolveWorkspaceForUser(user.uid);
      const newSessionId = await createScribeSession({
        ownerUid: user.uid,
        workspaceType: workspace.workspaceType,
        hospitalId: workspace.hospitalId,
        mode: isDiscussionOnly ? "discussion" : "case",
      });

      if (newChatContextGeneration !== sessionContextGenerationRef.current) {
        console.warn("[VoiceScribeChatView] Ignored stale New Chat session result.");
        return;
      }

      setActiveSessionId(newSessionId);
      onSessionIdChange?.(newSessionId);
      localStorage.setItem(`ermate:scribeSession:${user.uid}`, newSessionId);
      setActiveCaseId(null);
      // A new MATE conversation begins silently.
      // The clinician's first actual input establishes the conversation.
      setMessages([]);
      setFailedMessages(new Map());
      setSessionAttachError(null);
      onNewChat?.();
    } catch (err: any) {
      if (newChatContextGeneration !== sessionContextGenerationRef.current) {
        console.warn("[VoiceScribeChatView] Ignored stale New Chat error.");
        return;
      }

      console.error("Failed to start new chat session:", err);
      setSaveError(`Failed to start new chat: ${err?.message || "Error"}`);
    }
  };

   /*
   * STEP 2B — Draft ClinicalCase lifecycle.
   *
   * A shell is created only when ALL are true:
   * 1. this is a patient/case Scribe, not discussion-only mode
   * 2. there is no active ClinicalCase yet
   * 3. the Scribe session has been successfully established
   * 4. at least one unapplied assistant extraction contains a real,
   *    displayable/documentable clinical fact
   *
   * Greetings and question-only turns therefore create NO ClinicalCase.
   *
   * IMPORTANT:
   * We pass ONLY activeSessionId to App. The extraction itself stays inside
   * the Scribe message and remains unapplied until Preview -> Apply.
   */
  const draftCaseEnsureInFlightRef = useRef(false);

  useEffect(() => {
    if (isDiscussionOnly) return;
    if (activeCaseId) return;
    if (!activeSessionId) return;
    if (!onEnsureDraftCase) return;
    if (draftCaseEnsureInFlightRef.current) return;

    const hasMeaningfulUnappliedExtraction = messages.some(
      (message: Message) =>
        !message.extractionApplied &&
        hasDisplayableExtraction(message.extractionData)
    );

    if (!hasMeaningfulUnappliedExtraction) return;

    const targetSessionId = activeSessionId;
    const targetGeneration = sessionContextGenerationRef.current;

    draftCaseEnsureInFlightRef.current = true;

    void (async () => {
      try {
        await onEnsureDraftCase(targetSessionId);
      } catch (err) {
        /*
         * Do not destroy or re-route the Scribe session because shell
         * persistence failed. Chat persistence and clinical extraction are
         * separate safety boundaries.
         */
        if (
          sessionContextGenerationRef.current === targetGeneration
        ) {
          console.error(
            "[VoiceScribeChatView] Draft ClinicalCase shell creation failed:",
            err
          );
        }
      } finally {
        draftCaseEnsureInFlightRef.current = false;
      }
    })();
  }, [
    messages,
    activeCaseId,
    activeSessionId,
    isDiscussionOnly,
    onEnsureDraftCase,
  ]);

  const sendToChat = async (
    text: string,
    options?: { skipMatePatientResolution?: boolean }
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    // Bind every async MATE/Scribe request to the exact context
    // that created it. This must be established BEFORE routing because
    // the general-conversation lane also performs an async request.
    const requestContextGeneration = sessionContextGenerationRef.current;
    const requestIsCurrent = () =>
      requestContextGeneration === sessionContextGenerationRef.current;

    // ========================================================
    // MATE TRAFFIC-POLICE — VERTICAL SLICE 1
    // Capability: case.open
    //
    // Important:
    // - This does not extract clinical data.
    // - This does not write directly to Firestore.
    // - This reuses the existing ErMate Case Sheet workflow.
    // - Pending unapplied dictation is PREVIEWED before any commit.
    // ========================================================
    /**
     * MATE UNIVERSAL PATIENT CONTEXT
     *
     * Resolve an explicit ER bed reference BEFORE intent routing.
     *
     * This is traffic-police logic only:
     * - no clinical extraction
     * - no case creation
     * - no Firestore write
     * - no mutation of clinical facts
     *
     * The original utterance continues unchanged into the existing
     * MATE/Scribe pipeline after a successful context switch.
     */
    /*
     * MATE NEW-PATIENT INTENT
     *
     * IMPORTANT:
     * "open case sheet" is an EXISTING-patient action and must NEVER,
     * by itself, create a new ClinicalCase.
     *
     * New-patient creation requires an explicit patient introduction
     * or explicit new/create/start language.
     *
     * Examples that ARE new-patient intent:
     * - "I have a patient in Bed 11..."
     * - "I have a new patient in Bed 11..."
     * - "Another patient in Bed 11..."
     * - "Create a new case for Bed 11"
     *
     * Examples that are NOT new-patient intent:
     * - "Open the case sheet"
     * - "Open Bed 11 case sheet"
     * - "Bed 11 BP is falling, open the case sheet"
     * - "Review Bed 11"
     */
    const explicitNewCaseIntent =
      /\b(?:new|another)\s+(?:patient|pt|case)\b/i.test(trimmed) ||
      /\b(?:i|we)\s+(?:have|got)\s+(?:a\s+)?(?:new\s+)?(?:patient|pt)\b/i.test(trimmed) ||
      /\b(?:start|create|begin)\s+(?:a\s+)?(?:new\s+)?(?:case\s*sheet|patient\s+case|case)\b/i.test(trimmed);

    const mateConversationPlan =
      planMateConversation(trimmed);

    const requestedMateBedReference =
      extractMateBedReference(text);

    const recentReferencedCase =
      !requestedMateBedReference &&
      mateConversationPlan.refersToRecentPatient &&
      mateConversationContextRef.current.lastReferencedCaseId
        ? cases.find(
            (clinicalCase) =>
              clinicalCase.id ===
                mateConversationContextRef.current.lastReferencedCaseId &&
              clinicalCase.status !== "Discharged"
          ) || null
        : null;

    const mateCaseResolution =
      options?.skipMatePatientResolution && activeCaseId
        ? {
            status: "CURRENT_CASE" as const,
            referenceType: "CURRENT_CASE" as const,
            referenceValue: null,
            caseId: activeCaseId,
          }
        : recentReferencedCase
          ? {
              status: "RESOLVED" as const,
              referenceType: "BED" as const,
              referenceValue:
                recentReferencedCase.bedNo ||
                mateConversationContextRef.current.lastReferencedBed ||
                "CURRENT",
              caseId: recentReferencedCase.id,
            }
          : resolveMateCaseReference({
              utterance: text,
              cases,
              activeCaseId,
              physicalCapacity: erPhysicalBedCapacity,
              newCaseIntent: explicitNewCaseIntent,
            });

    if (mateCaseResolution.status === "AMBIGUOUS") {
      const bed = mateCaseResolution.referenceValue;

      setMessages((prev) => [
        ...prev,
        {
          id: `mate-context-${Date.now()}`,
          sender: "ai",
          text:
            explicitNewCaseIntent &&
            requestedMateBedReference &&
            /[AB]$/i.test(requestedMateBedReference)
              ? `Bed ${bed} is already occupied. Please give me another bed.`
              : explicitNewCaseIntent &&
                  requestedMateBedReference &&
                  !/[AB]$/i.test(requestedMateBedReference)
                ? `Both Bed ${bed}A and Bed ${bed}B are occupied. Please give me another bed.`
                : `I found more than one active patient in Bed ${bed}. ` +
                  `Please specify the exact bed slot.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      return;
    }

    if (mateCaseResolution.status === "INVALID_LOCATION") {
      const bed = mateCaseResolution.referenceValue;

      setMessages((prev) => [
        ...prev,
        {
          id: `mate-context-${Date.now()}`,
          sender: "ai",
          text:
            `Bed ${bed} is outside the configured ER bed/location range. ` +
            `Please check the bed number.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      return;
    }

    if (mateCaseResolution.status === "NOT_FOUND") {
      const bed = mateCaseResolution.referenceValue;

      /*
       * NOT_FOUND means the referenced physical bed is valid but no active
       * ClinicalCase currently occupies it.
       *
       * That is not, by itself, permission to create a patient.
       * Creation is allowed only when the clinician explicitly asks to
       * start/create/prepare a case or case sheet for the patient.
       */
      if (!explicitNewCaseIntent) {
        const isBedStatusQuestion =
          mateConversationPlan.actions.includes("BED_STATUS");

        setMessages((prev) => [
          ...prev,
          {
            id: `mate-context-${Date.now()}`,
            sender: "ai",
            text: isBedStatusQuestion
              ? `No. Bed ${bed} is currently vacant in ErMate.`
              : `I don't currently have an active ErMate case assigned to Bed ${bed}. ` +
                `I won't create or choose a patient automatically.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);

        if (isBedStatusQuestion) {
          mateConversationContextRef.current.lastReferencedCaseId = null;
          mateConversationContextRef.current.lastReferencedBed = bed;
        }

        return;
      }

      /*
       * NEW PATIENT while MATE is currently bound to another patient:
       *
       * Never give the previous patient's Scribe session to the new case.
       * Reuse ErMate's existing New Chat/session-boundary implementation,
       * then automatically replay this exact utterance once the fresh,
       * unlinked session has settled.
       */
      if (
        activeCaseId ||
        propCaseId ||
        caseData?.id
      ) {
        pendingMateNewPatientRef.current = {
          text: trimmed,
          stage: "AWAIT_UNLINKED_SESSION",
        };

        await handleStartNewChat();
        return;
      }

      if (!activeSessionId || !onEnsureDraftCase) {
        setMessages((prev) => [
          ...prev,
          {
            id: `mate-context-${Date.now()}`,
            sender: "ai",
            text:
              `Bed ${bed} is currently unassigned in ErMate, but I couldn't establish the new case safely yet. ` +
              `Please try the case-sheet request again.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);

        return;
      }

      const targetSessionId = activeSessionId;
      const targetGeneration = requestContextGeneration;

      try {
        const newCaseId = await onEnsureDraftCase(targetSessionId, {
          bedNo: bed,
        });

        if (
          targetGeneration !== sessionContextGenerationRef.current
        ) {
          return;
        }

        const allocationNotice =
          requestedMateBedReference &&
          !/[AB]$/i.test(requestedMateBedReference) &&
          bed === `${requestedMateBedReference}B`
            ? `Bed ${requestedMateBedReference}A is occupied. I'll assign this patient to Bed ${bed}.`
            : undefined;

        /*
         * onEnsureDraftCase has now safely created/linked the new ErMate case.
         *
         * Do NOT continue clinical processing inside this render closure:
         * activeCaseId / activeSessionId still belong to the pre-bound render.
         *
         * Wait for the normal ErMate case/session boundary to settle, then
         * replay the original utterance exactly once into the existing Scribe.
         */
        pendingMateNewPatientRef.current = {
          text: trimmed,
          stage: "AWAIT_BOUND_CASE",
          expectedCaseId: newCaseId,
          notice: allocationNotice,
        };

        setActiveCaseId(newCaseId);

        if (onSelectMateCase) {
          onSelectMateCase(newCaseId);
        }

        return;
      } catch (err) {
        if (targetGeneration !== sessionContextGenerationRef.current) {
          return;
        }

        console.error(
          "[MATE] Unable to establish vacant-bed draft case:",
          err
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `mate-context-${Date.now()}`,
            sender: "ai",
            text:
              `Bed ${bed} appears to be unassigned, but I couldn't safely establish the new patient case. ` +
              `No existing patient was changed.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);

        return;
      }

    }

    /*
     * PURE BED STATUS
     *
     * Occupancy checks are read-only.
     *
     * Do not switch active patient.
     * Do not invoke Scribe.
     * Do not create a ClinicalCase.
     *
     * We only remember the safely resolved patient so a later conversational
     * follow-up can explicitly refer back to that patient.
     */
    if (
      mateCaseResolution.status === "RESOLVED" &&
      mateConversationPlan.actions.includes("BED_STATUS") &&
      !mateConversationPlan.actions.includes("PATIENT_OPEN") &&
      !mateConversationPlan.actions.includes("CASE_SUMMARY") &&
      !mateConversationPlan.actions.includes("CASE_SHEET_OPEN") &&
      !mateConversationPlan.mayContainClinicalUpdate
    ) {
      const referencedCase = cases.find(
        (clinicalCase) =>
          clinicalCase.id === mateCaseResolution.caseId
      );

      const referencedBed =
        referencedCase?.bedNo ||
        mateCaseResolution.referenceValue;

      mateConversationContextRef.current.lastReferencedCaseId =
        mateCaseResolution.caseId;

      mateConversationContextRef.current.lastReferencedBed =
        referencedBed || null;

      setMessages((prev) => [
        ...prev,
        {
          id: `mate-bed-status-${Date.now()}`,
          sender: "ai",
          text: `Yes. Bed ${referencedBed} is occupied.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      return;
    }

    if (
      mateCaseResolution.status === "RESOLVED" &&
      mateCaseResolution.caseId !== activeCaseId
    ) {
      /**
       * EXISTING-PATIENT CONTEXT BOUNDARY
       *
       * setActiveCaseId() does not rewrite values captured by this render.
       * Continuing below could therefore execute against the previous
       * patient's caseData/messages/session.
       *
       * Store the ORIGINAL utterance, switch context, stop here, and replay
       * only after ErMate has attached the resolved case's canonical session.
       */
      pendingMateExistingPatientRef.current = {
        text: trimmed,
        expectedCaseId: mateCaseResolution.caseId,
      };

      sessionContextGenerationRef.current += 1;

      setActiveCaseId(mateCaseResolution.caseId);

      if (onSelectMateCase) {
        onSelectMateCase(mateCaseResolution.caseId);
      }

      return;
    }

    const wantsCaseSummary =
      mateConversationPlan.actions.includes("CASE_SUMMARY");

    if (
      wantsCaseSummary &&
      !mateConversationPlan.mayContainClinicalUpdate
    ) {
      const summaryCaseId =
        mateCaseResolution.status === "RESOLVED" ||
        mateCaseResolution.status === "CURRENT_CASE"
          ? mateCaseResolution.caseId
          : activeCaseId;

      const summaryCase =
        summaryCaseId
          ? cases.find(
              (clinicalCase) =>
                clinicalCase.id === summaryCaseId &&
                clinicalCase.status !== "Discharged"
            ) || null
          : null;

      if (!summaryCase) {
        setMessages((prev) => [
          ...prev,
          {
            id: `mate-summary-context-${Date.now()}`,
            sender: "ai",
            text:
              "I don't have an active patient to summarise yet. Please tell me the bed.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);

        return;
      }

      const summaryBed =
        summaryCase.bedNo ||
        mateConversationContextRef.current.lastReferencedBed ||
        null;

      mateConversationContextRef.current.lastReferencedCaseId =
        summaryCase.id;

      mateConversationContextRef.current.lastReferencedBed =
        summaryBed;

      setInputText("");
      setIsSending(true);

      const summaryGeneration =
        sessionContextGenerationRef.current;

      const userMsg: Message = {
        id: `u-${Date.now()}-mate-summary`,
        sender: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
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
        const res = await fetch("/api/case-discussion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Summarise this documented emergency case concisely for the treating emergency physician. " +
              "Use only information present in the supplied case. " +
              "Do not invent missing history, examination findings, investigations, diagnosis, treatment or disposition.",
            contextType: "case",
            contextData: summaryCase,
            caseData: summaryCase,
            history: [],
            messages: [
              {
                sender: "user",
                text:
                  "Give me a concise summary of the currently documented case only.",
              },
            ],
          }),
        });

        const data = await res.json();

        if (
          summaryGeneration !==
          sessionContextGenerationRef.current
        ) {
          console.warn(
            "[MATE] Ignored stale case-summary response from a previous patient context."
          );
          return;
        }

        if (!res.ok || data?.success === false) {
          throw new Error(
            data?.error ||
              "MATE case summary request failed"
          );
        }

        const summaryText =
          typeof data?.response === "string" &&
          data.response.trim()
            ? data.response.trim()
            : typeof data?.reply === "string" &&
                data.reply.trim()
              ? data.reply.trim()
              : "I couldn't form a reliable summary from the documented case.";

        const statusRequested =
          mateConversationPlan.actions.includes(
            "BED_STATUS"
          );

        const openRequested =
          mateConversationPlan.actions.includes(
            "PATIENT_OPEN"
          );

        const operationalPrefixParts: string[] = [];

        if (statusRequested && summaryBed) {
          operationalPrefixParts.push(
            `Yes. Bed ${summaryBed} is occupied.`
          );
        }

        if (openRequested && summaryBed) {
          operationalPrefixParts.push(
            `I've opened Bed ${summaryBed} in MATE.`
          );
        }

        const operationalPrefix =
          operationalPrefixParts.length > 0
            ? `${operationalPrefixParts.join(" ")}

`
            : "";

        const aiMsg: Message = {
          id: `ai-${Date.now()}-mate-summary`,
          sender: "ai",
          text: `${operationalPrefix}${summaryText}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mode: currentMode,
        };

        setMessages((prev) => [...prev, aiMsg]);

        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: aiMsg.text,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        if (
          summaryGeneration !==
          sessionContextGenerationRef.current
        ) {
          return;
        }

        console.error(
          "[MATE] Case summary failed:",
          err
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}-mate-summary-error`,
            sender: "ai",
            text:
              "I've got the correct patient, but I couldn't generate the case summary just now.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      } finally {
        if (
          summaryGeneration ===
          sessionContextGenerationRef.current
        ) {
          setIsSending(false);
        }
      }

      return;
    }

    const pureReferentialPatientOpen =
      mateConversationPlan.actions.includes("PATIENT_OPEN") &&
      mateConversationPlan.refersToRecentPatient &&
      !mateConversationPlan.actions.includes("CASE_SUMMARY") &&
      !mateConversationPlan.actions.includes("CASE_SHEET_OPEN") &&
      !mateConversationPlan.mayContainClinicalUpdate;

    if (pureReferentialPatientOpen) {
      const referencedCase =
        mateCaseResolution.status === "RESOLVED" ||
        mateCaseResolution.status === "CURRENT_CASE"
          ? cases.find(
              (clinicalCase) =>
                clinicalCase.id === mateCaseResolution.caseId
            ) || null
          : null;

      if (!referencedCase) {
        setMessages((prev) => [
          ...prev,
          {
            id: `mate-recent-context-${Date.now()}`,
            sender: "ai",
            text:
              "I don't have a recent active patient to open yet. Please tell me the bed.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);

        return;
      }

      const bed =
        referencedCase.bedNo ||
        mateConversationContextRef.current.lastReferencedBed;

      setMessages((prev) => [
        ...prev,
        {
          id: `mate-patient-open-${Date.now()}`,
          sender: "ai",
          text: bed
            ? `I've opened Bed ${bed} in MATE.`
            : "I've opened that patient in MATE.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      return;
    }

    const mateRoute = routeMateInput({
      text: trimmed,
      patientAgeYears: caseData?.patient?.age ?? null,
    });

    // ========================================================
    // MATE CONVERSATION LANE
    //
    // Social/general conversation is READ-ONLY.
    //
    // It uses the existing /api/case-discussion endpoint with
    // contextType "general", which has no patient context and
    // cannot enter the clinical extraction path.
    // ========================================================
    if (mateRoute.primaryIntent === "CONVERSATION") {
      setInputText("");

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        sender: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
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
        const conversationMessages = [...messages, userMsg].map((m) => ({
          sender: m.sender === "user" ? "user" : "ai",
          text: m.text,
        }));

        const res = await fetch("/api/case-discussion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contextType: "general",
            contextData: {},
            message: trimmed,
            messages: conversationMessages,
          }),
        });

        const data = await res.json();

        if (!requestIsCurrent()) {
          console.warn(
            "[MATE] Ignored stale general conversation response."
          );
          return;
        }

        if (!res.ok || data?.success === false) {
          throw new Error(
            data?.error || "MATE general conversation request failed"
          );
        }

        const replyText =
          typeof data?.response === "string" && data.response.trim()
            ? data.response.trim()
            : typeof data?.reply === "string" && data.reply.trim()
              ? data.reply.trim()
              : "I'm here. What are we working on?";

        const aiMsg: Message = {
          id: `ai-${Date.now()}-conversation`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mode: currentMode,
        };

        setMessages((prev) => [...prev, aiMsg]);

        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[MATE general conversation] failed:", error);

        const fallbackText =
          "I'm here. What are we working on?";

        const fallbackMsg: Message = {
          id: `ai-${Date.now()}-conversation-fallback`,
          sender: "ai",
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mode: currentMode,
        };

        setMessages((prev) => [...prev, fallbackMsg]);

        persistMessage({
          id: fallbackMsg.id,
          role: "assistant",
          type: "text",
          content: fallbackText,
          timestamp: new Date().toISOString(),
        });
      }

      return;
    }

    if (
      mateRoute.primaryIntent === "APP_ACTION" &&
      mateRoute.targetCapability
    ) {
      const actionResult = await dispatchMateAction(
        {
          capability: mateRoute.targetCapability,
          caseId: activeCaseId || null,
          sessionId: activeSessionId || null,
          utterance: trimmed,
        },
        {
          openCase: async () => {
            const unappliedMessages = messages.filter(
              (m: Message) => m.extractionData && !m.extractionApplied
            );

            // Preserve the existing ErMate safety contract:
            // pending Scribe information must go through Preview Case Sheet.
            if (unappliedMessages.length > 0 && onPreviewCaseSheet) {
              const mergedExtraction = getMergedUnappliedExtraction(messages);

              console.log("[MATE PEDIATRIC TRACE] case.open", {
                activeCaseId,
                activeSessionId,
                unappliedMessageCount: unappliedMessages.length,
                mergedExtraction,
                mergedAge:
                  mergedExtraction?.age ??
                  mergedExtraction?.patient?.age ??
                  null,
                expectedPediatric:
                  mergedExtraction?.age !== undefined &&
                  mergedExtraction?.age !== null
                    ? Number(mergedExtraction.age) <= 16
                    : null,
              });

              const latestMsg = unappliedMessages[unappliedMessages.length - 1];

              await onPreviewCaseSheet(mergedExtraction, {
                existingCaseId: activeCaseId || null,
                msgId: latestMsg?.id,
              });

              return;
            }

            const extractionMessages = messages.filter(
              (m: Message) => m.extractionData
            );

            // Preserve the existing new/empty-case initialization path.
            if (extractionMessages.length === 0 && onSaveExtractedCase) {
              await onSaveExtractedCase(
                {},
                {
                  existingCaseId: activeCaseId || undefined,
                  autoNavigate: true,
                }
              );

              return;
            }

            // Existing established case with nothing pending:
            // simply open the canonical ErMate Case Sheet.
            if (activeCaseId && onOpenCaseSheet) {
              onOpenCaseSheet(activeCaseId);
              return;
            }
          },
        }
      );

      if (actionResult.handled) {
        return;
      }
    }

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

        if (!requestIsCurrent()) {
          console.warn("[VoiceScribeChatView] Ignored stale response from a previous Scribe context.");
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

        if (!requestIsCurrent()) {
          console.warn("[VoiceScribeChatView] Ignored stale response from a previous Scribe context.");
          return;
        }

        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.reply || data.aiReply || data.summary || "Processed case details.";
        console.log("[MATE PEDIATRIC TRACE] scribe response", {
          unappliedExtraction: data.unappliedExtraction ?? null,
          updatedCaseSheetFields: data.updatedCaseSheetFields ?? null,
          extractedFields: data.extractedFields ?? null,
          returnedAge:
            data.unappliedExtraction?.age ??
            data.updatedCaseSheetFields?.age ??
            data.extractedFields?.age ??
            null,
        });

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
      if (!requestIsCurrent()) {
        console.warn("[VoiceScribeChatView] Ignored stale request error from a previous Scribe context.");
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
      if (requestIsCurrent()) {
        setIsSending(false);
      }
    }
  };

  /**
   * Resume a MATE EXISTING-patient command only after ErMate has crossed
   * the case/session boundary.
   *
   * Requirements:
   * - local activeCaseId == expected case
   * - parent case context == expected case
   * - canonical Scribe session is attached
   *
   * Then replay the exact original utterance once, while skipping patient
   * resolution because that resolution has already been safely completed.
   */
  useEffect(() => {
    if (isDiscussionOnly) return;

    const pending =
      pendingMateExistingPatientRef.current;

    if (!pending) return;

    const parentCaseId =
      propCaseId ||
      caseData?.id ||
      null;

    if (
      activeCaseId !== pending.expectedCaseId ||
      parentCaseId !== pending.expectedCaseId ||
      !activeSessionId
    ) {
      return;
    }

    pendingMateExistingPatientRef.current = null;

    void sendToChat(pending.text, {
      skipMatePatientResolution: true,
    });

    // sendToChat intentionally omitted: this effect is driven only by
    // verified patient/session boundary state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSessionId,
    activeCaseId,
    propCaseId,
    caseData?.id,
    isDiscussionOnly,
  ]);

  /**
   * Resume a MATE new-patient command only after ErMate has crossed the
   * required Scribe/case boundary.
   *
   * The original clinician utterance is never reconstructed or altered.
   * It is replayed exactly once into the normal existing Scribe pipeline.
   */
  useEffect(() => {
    if (isDiscussionOnly) return;

    const pending = pendingMateNewPatientRef.current;
    if (!pending) return;

    if (pending.stage === "AWAIT_UNLINKED_SESSION") {
      const stillBoundToCase =
        Boolean(activeCaseId) ||
        Boolean(propCaseId) ||
        Boolean(caseData?.id);

      if (!activeSessionId || stillBoundToCase) {
        return;
      }

      pendingMateNewPatientRef.current = null;

      void sendToChat(pending.text);
      return;
    }

    if (pending.stage === "AWAIT_BOUND_CASE") {
      const expectedCaseId = pending.expectedCaseId;

      if (!expectedCaseId) {
        pendingMateNewPatientRef.current = null;
        return;
      }

      const parentCaseId =
        propCaseId ||
        caseData?.id ||
        null;

      if (
        activeCaseId !== expectedCaseId ||
        parentCaseId !== expectedCaseId ||
        !activeSessionId
      ) {
        return;
      }

      pendingMateNewPatientRef.current = null;

      if (pending.notice) {
        setMessages((prev) => [
          ...prev,
          {
            id: `mate-bed-allocation-${Date.now()}`,
            sender: "ai",
            text: pending.notice!,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }

      void sendToChat(pending.text, {
        skipMatePatientResolution: true,
      });
    }

    // sendToChat intentionally omitted: this effect is driven only by
    // ErMate patient/session boundary state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSessionId,
    activeCaseId,
    propCaseId,
    caseData?.id,
    isDiscussionOnly,
  ]);

  const handleLensClick = (lensLabel: string) => {
    setShowLensMenu(false);
    setCurrentMode("discuss");
    sendToChat(`Please apply the "${lensLabel}" clinical lens to this case. Challenge clinical heuristics, investigate underlying physiology, and provide an expert debrief.`);
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const attachmentContextGeneration = sessionContextGenerationRef.current;
    const attachmentIsCurrent = () =>
      attachmentContextGeneration === sessionContextGenerationRef.current;

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

      if (!attachmentIsCurrent()) {
        console.warn("[VoiceScribeChatView] Ignored stale attachment from a previous Scribe context.");
        return;
      }

      const res = await fetch("/api/scribe-ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });
      const data = await res.json();

      if (!attachmentIsCurrent()) {
        console.warn("[VoiceScribeChatView] Ignored stale OCR response from a previous Scribe context.");
        return;
      }

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
      if (!attachmentIsCurrent()) {
        console.warn("[VoiceScribeChatView] Ignored stale attachment error from a previous Scribe context.");
        return;
      }

      setMessages(prev => [...prev, {
        id: `err-attach-${Date.now()}`,
        sender: "ai",
        text: `⚠️ Could not process the attached image (${err.message || "unknown error"}). Please try again or paste the text manually.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      if (attachmentIsCurrent()) {
        setIsUploadingAttachment(false);
      }
    }
  };

  const headerTitle = "ErMate Assistant";
  const headerSubtitle = isDiscussionOnly
    ? "Discuss any case — no patient record required"
    : "Dictate the case in your native language, or ask a clinical question";

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] w-full max-w-5xl mx-auto bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-2.5">
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

        <div className="flex items-center gap-2">
          {(failedMessages.size > 0 || sessionAttachError || historyLoadError) && (
            <div className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{historyLoadError || `Chat not saved (${failedMessages.size || 1})`}</span>
              {failedMessages.size > 0 && !historyLoadError && (
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  className="ml-1 px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800/60 hover:bg-amber-300 rounded text-[10px] font-bold cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!isDiscussionOnly && (
            <button
              type="button"
              onClick={handleStartNewChat}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Start a new Scribe session"
            >
              <Plus size={14} />
              <span>New Chat</span>
            </button>
          )}

          {onOpenCaseSheet && !isDiscussionOnly && (
            <button
              onClick={async () => {
                const unappliedMessages = messages.filter(m => m.extractionData && !m.extractionApplied);
                if (unappliedMessages.length > 0 && onPreviewCaseSheet) {
                  const mergedExtraction = getMergedUnappliedExtraction(messages);
                  const latestMsg = unappliedMessages[unappliedMessages.length - 1];
                  onPreviewCaseSheet(mergedExtraction, {
                    existingCaseId: activeCaseId || null,
                    msgId: latestMsg?.id,
                    sessionId: activeSessionId,
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
          )}
        </div>
      </div>

      {!isDiscussionOnly && (
        <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            Bed {caseData?.patient?.bed || "--"} • UHID {caseData?.patient?.uhid || "--"} • {caseData?.patient?.age ? `${caseData.patient.age}${caseData.patient.sex?.charAt(0) || ""}` : "--"}
          </span>
          <span>Case opened {new Date(caseData?.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}

      {/* Mode toggle strip — only shown when dictation is actually an option */}
      {!isDiscussionOnly && (
        <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2">
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
          {currentMode === "discuss" && (
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

  const merged = mergeExtractionUpTo(messages, msg.id);
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
            onClick={() => handlePreviewExtraction(msg.id, merged)}
            className="flex-1 py-1.5 flex items-center justify-center gap-2 rounded text-xs font-bold transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <span>Preview Case Sheet</span>
          </button>
        )}
        <button
          disabled={msg.dischargeApplied || !!processingAction}
          onClick={() => handleApplyDischarge(msg.id, merged)}
          className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded text-xs font-bold transition-all cursor-pointer shadow-sm ${
            msg.dischargeApplied
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
              : processingAction?.messageId === msg.id && processingAction?.type === "discharge"
                ? "bg-purple-400 cursor-not-allowed text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {msg.dischargeApplied
            ? "Discharge Summary Prepared ✓"
            : processingAction?.messageId === msg.id && processingAction?.type === "discharge"
              ? "Preparing Discharge Summary…"
              : "Prepare Discharge Summary"}
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
                  onClick={() => handleLensClick(lens.label)}
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