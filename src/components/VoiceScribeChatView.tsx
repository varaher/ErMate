import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, MoreVertical, Paperclip, Sparkles, MessageSquare, Mic as MicIcon } from "lucide-react";
import {
  subscribeChatHistory,
  appendChatMessage,
  generateNewCaseId,
  updateChatMessage,
  generateNewDiscussionId,
  subscribeDiscussionHistory,
  appendDiscussionMessage,
  saveDiscussionSummary,
} from "../services/scribeChatStorage";
import VoiceRecorder from "./shared/VoiceRecorder";
import Markdown from "react-markdown";
import { getChecklistForKind, type CaseSheetKind } from "../../server/caseSheetChecklist";

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
}

interface VoiceScribeChatViewProps {
  caseId?: string | null;
  caseData?: any;
  onBack: () => void;
  onOpenCaseSheet?: (caseId: string) => void;
  onCaseSheetUpdated?: (fields: any) => void;
  onSaveExtractedCase?: (extracted: any, options?: { autoNavigate?: boolean; existingCaseId?: string }) => Promise<string>;
  profile?: any;
  onSaveProfile?: (newProfile: any) => Promise<any>;
  messages?: any;
  onUpdateMessages?: any;
  // NEW — optional, defaults to "case" so every existing call site in
  // App.tsx keeps working unchanged. Only pass "discussion" from a new,
  // not-yet-built entry point that wants a standalone, non-patient chat.
  initialEntryMode?: "case" | "discussion";
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
  return Object.entries(data).filter(([key, val]) => {
    if (key === "isPediatric") return false;
    if (val === null || val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return false;
    return true;
  });
}

function hasDisplayableExtraction(data: any): boolean {
  return getDisplayableExtractionEntries(data).length > 0;
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
    case "allergies": return data.allergies;
    case "medications": return data.currentMedications;
         case "differentialDiagnosis": return data.differentialDiagnosis;
    case "treatmentPlan": return data.treatmentGiven;
    case "signsSymptoms": return data.symptoms;
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
function deepMergeExtraction(base: any, incoming: any): any {
  const result = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === undefined || val === "") continue;
    const existing = result[key];
    if (Array.isArray(val)) {
      result[key] = Array.isArray(existing) ? [...existing, ...val] : val;
    } else if (typeof val === "object") {
      result[key] = (existing && typeof existing === "object" && !Array.isArray(existing))
        ? deepMergeExtraction(existing, val)
        : val;
    } else {
      result[key] = val;
    }
  }
  return result;
}

function mergeExtractionUpTo(messages: Message[], targetId: string): any {
  let merged: any = {};
  for (const msg of messages) {
    if (msg.extractionData) {
      merged = deepMergeExtraction(merged, msg.extractionData);
    }
    if (msg.id === targetId) {
      break;
    }
  }
  return merged;
}
export default function VoiceScribeChatView({
  caseId: propCaseId,
  caseData,
  onBack,
  onOpenCaseSheet,
  onCaseSheetUpdated,
  onSaveExtractedCase,
  profile,
  onSaveProfile,
  messages: propMessages,
  onUpdateMessages,
  initialEntryMode = "case",
}: VoiceScribeChatViewProps) {
  // A chat is "case-linked" if either a real caseId was passed in, OR
  // the caller didn't explicitly ask for a standalone discussion — this
  // preserves the original "no caseId = create a new patient case"
  // behavior for every existing call site.
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

  // Mode: dictation is only meaningful when there's a real case to write
  // into. A discussion-only session (no linked patient) has nothing to
  // dictate into, so it's locked to "discuss" from the start.
  const [currentMode, setCurrentMode] = useState<ChatMode>(isDiscussionOnly ? "discuss" : "dictation");
  const [showLensMenu, setShowLensMenu] = useState(false);

  // activeCaseId: for case-linked chats this is the real C-#### id
  // (existing behavior, unchanged). For discussion-only chats, this
  // starts null and is lazily filled in with a Dis-YYYYMMDD-### id
  // once generated (async, since it involves a Firestore transaction).
  const [activeCaseId] = useState<string | null>(() => {
    if (isDiscussionOnly) return null;
    return propCaseId || generateNewCaseId();
  });
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
    generateNewDiscussionId().then(id => {
      if (!cancelled) setDiscussionId(id);
    });
    return () => { cancelled = true; };
  }, [isDiscussionOnly]);

  // Subscribe to whichever history source applies.
  useEffect(() => {
    if (isDiscussionOnly) {
      if (!discussionId) return; // wait for the id to be generated first
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
      if (!activeCaseId) return;
      const unsubscribe = subscribeChatHistory(activeCaseId, (history) => {
        if (history && history.length > 0) {
          setMessages(
            history.map((h: any) => ({
              id: h.id,
              sender: h.role === "user" ? "user" : "ai",
              text: h.content,
              timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              // UI-01 FIX: preserve ALL extraction data, even if it only has non-displayable fields (like isPediatric)
              // so that it merges correctly with previous history in mergeExtractionUpTo.
              extractionData: h.unappliedExtraction !== undefined ? h.unappliedExtraction : undefined,
              extractionApplied: h.extractionApplied || false,
              dischargeDraft: h.dischargeDraft,
            }))
          );
        }
      });
      return () => unsubscribe();
    }
  }, [isDiscussionOnly, discussionId, activeCaseId]);

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

  const handleApplyExtraction = async (msgId: string, extractionData: any) => {
    try {
      if (onSaveExtractedCase) {
        // autoNavigate: false — deliberate. If this navigates immediately, the
        // component unmounts before the confirmation banner below can ever
        // render. Navigation is now a separate, explicit user choice instead.
        await onSaveExtractedCase(extractionData, { existingCaseId: activeCaseId!, autoNavigate: false });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated(extractionData);
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      setSaveConfirmation({ type: "case" });
    } catch (e) {
      console.warn("Failed to apply extraction", e);
    }
  };

  const handleApplyDischarge = async (msgId: string, dischargeDraft: string) => {
    try {
      if (onSaveExtractedCase) {
        await onSaveExtractedCase({ dischargeSummaryDraft: dischargeDraft }, { existingCaseId: activeCaseId!, autoNavigate: false });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated({ dischargeSummaryDraft: dischargeDraft });
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, dischargeApplied: true } : m));
      setSaveConfirmation({ type: "discharge" });
    } catch (e) {
      console.warn("Failed to apply discharge summary", e);
    }
  };

  const persistMessage = (message: any) => {
    if (isDiscussionOnly) {
      if (discussionId) appendDiscussionMessage(discussionId, message).catch(err =>
        console.error("[VoiceScribeChatView] Failed to save discussion message:", err)
      );
    } else if (activeCaseId) {
      appendChatMessage(activeCaseId, message).catch(err => {
        console.error("[VoiceScribeChatView] Failed to save chat message:", err);
        setMessages(prev => [...prev, {
          id: `err-save-${Date.now()}`,
          sender: "ai",
          text: "⚠️ Failed to save this message to the database. It may disappear on refresh.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
      });
    }
  };

   const sendToChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

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
            patientAgeYears: caseData?.patient?.age || null,
            caseContext: caseData || {},
            messages: messages,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.reply || data.aiReply || data.summary || "Processed case details.";
        const rawFieldsToExtract = data.unappliedExtraction || data.updatedCaseSheetFields || data.extractedFields;
// Always keep the extraction object (even if empty) so the full
// checklist card can render and honestly show 0/N captured, rather
// than silently disappearing — the "Copy to Case Sheet" button itself
// still only appears when hasDisplayableExtraction() is true (see render).
const fieldsToExtract = rawFieldsToExtract || undefined;
        const dischargeIntent = data.dischargeIntent;

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "dictation",
          extractionData: fieldsToExtract,
          extractionApplied: false,
          dischargeIntent: dischargeIntent,
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
        });
      }
    } catch (err: any) {
      console.error("[VoiceScribeChatView] Send failed:", err);
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

  const handleLensClick = (lensLabel: string) => {
    setShowLensMenu(false);
    setCurrentMode("discuss");
    sendToChat(`Please apply the "${lensLabel}" clinical lens to this case. Challenge clinical heuristics, investigate underlying physiology, and provide an expert debrief.`);
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

        {onOpenCaseSheet && !isDiscussionOnly && (
          <button
            onClick={async () => {
              if (onSaveExtractedCase) {
                try {
                  const unappliedMessages = messages.filter(m => m.extractionData && !m.extractionApplied);

                  if (unappliedMessages.length > 0) {
                    const mergedExtraction = unappliedMessages.reduce((acc, m) => {
                      const data = m.extractionData;
                      for (const key in data) {
                        if (data[key] === null || data[key] === undefined || data[key] === "") continue;

                        if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
                          acc[key] = { ...(acc[key] || {}), ...data[key] };
                        } else if (Array.isArray(data[key])) {
                          acc[key] = [...(acc[key] || []), ...data[key]];
                        } else if (typeof data[key] === 'string' && acc[key] && typeof acc[key] === 'string') {
                          if (key.match(/complaint|history|notes|symptoms|allergies|medications/i)) {
                            if (!acc[key].includes(data[key])) {
                              acc[key] = acc[key] + " \n" + data[key];
                            }
                          } else {
                            acc[key] = data[key];
                          }
                        } else {
                          acc[key] = data[key];
                        }
                      }
                      return acc;
                    }, {});

                    await onSaveExtractedCase(mergedExtraction, { existingCaseId: activeCaseId!, autoNavigate: true });
                    setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                  } else {
                    if (messages.filter(m => m.extractionData).length === 0) {
                      await onSaveExtractedCase({}, { existingCaseId: activeCaseId!, autoNavigate: true });
                    }
                  }
                } catch (e) {
                  console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                }
              }
              onOpenCaseSheet(activeCaseId!);
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span>📄 Open Case Sheet</span>
          </button>
        )}
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
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                <Markdown>{msg.text}</Markdown>
              </div>

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
        <button
          disabled={msg.extractionApplied}
          onClick={() => handleApplyExtraction(msg.id, merged)}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
            msg.extractionApplied
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          }`}
        >
          {msg.extractionApplied
            ? "✅ Copied to Case Sheet"
            : "Prepare Case Sheet"}
        </button>
        <button
          onClick={() => onPrepareDischarge?.(merged, msg.id, activeCaseId!)}
          className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          Prepare Discharge Summary
        </button>
      </div>
    </div>
  );
})()}

              

              <span className="text-[9px] opacity-60 block text-right mt-2 font-mono">{msg.timestamp}</span>
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

      {saveConfirmation && (
        <div className="border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {saveConfirmation.type === "case" ? "Saved to Case Sheet." : "Discharge draft saved."}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSaveConfirmation(null)}
              className="px-3 py-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
            >
              Stay Here
            </button>
            <button
              onClick={() => {
                setSaveConfirmation(null);
                if (onOpenCaseSheet && activeCaseId) onOpenCaseSheet(activeCaseId);
                else onBack();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Go to Case Sheet →
            </button>
          </div>
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
    </div>
  );
}