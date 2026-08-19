import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, BookOpen, AlertTriangle, CheckCircle2, Sparkles, RefreshCw, ArrowLeft, BookmarkCheck, Trash2 } from "lucide-react";
import type { ScribeChatMessage } from "../../server/scribeChatTurn";
import { subscribeChatHistory, appendChatMessage, generateNewCaseId } from "../services/scribeChatStorage";
import VoiceRecorder from "./shared/VoiceRecorder";

/**
 * ScribeClinicalChat.tsx
 *
 * Turns the "Scribe & Clinical Chat" screen into an actual two-way
 * chat: user types OR dictates (mic → speech translation / transcription).
 * Each turn produces TWO assistant bubbles:
 *   1. Extraction confirmation — "Saved to Case Sheet" + what changed
 *   2. Clinical reasoning — differentials, references, red flags
 *
 * PERSISTENCE / CASE SCOPING (critical behavior):
 *   - This component is keyed by `caseId`. On mount, and whenever
 *     `caseId` changes, it loads THAT case's full chat history from
 *     Firestore (subscribeChatHistory) — reopening a case ALWAYS
 *     shows its own continuation, never a blank thread.
 *   - Clicking "Finish & Start New Case" calls `onFinalizeCase`,
 *     which the PARENT screen uses to navigate to a freshly
 *     generated caseId (generateNewCaseId()). This component does
 *     NOT clear the old case's messages — they stay permanently
 *     attached to their own caseId in Firestore. The blank screen
 *     the user sees next is a genuinely new case, not a wipe.
 */

interface Props {
  caseId: string;               // changing this prop = switching cases; history reloads automatically
  patientAgeYears: number | null;
  patientName?: string;
  onBack?: () => void;
  onCaseSheetUpdate: (fields: Record<string, unknown>) => void; // wire to case sheet save handler
  onSendTurn: (userInput: string) => Promise<{
    extractionMessage: ScribeChatMessage;
    reasoningMessage: ScribeChatMessage;
    updatedCaseSheetFields: Record<string, unknown>;
  }>;
  onFinalizeCase: (newCaseId: string) => void; // parent navigates to this new caseId after finalize
}

function ExtractionBubble({ message }: { message: ScribeChatMessage }) {
  if (message.type === "error") {
    return (
      <div className="flex items-start gap-2 max-w-[85%] animate-fade-in">
        <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-amber-200">{message.content}</p>
        </div>
      </div>
    );
  }

  const { fieldsUpdated = [], abnormalFlags = [] } = message.extractionSummary || {};

  return (
    <div className="flex items-start gap-2 max-w-[85%] animate-fade-in">
      <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
      <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-1.5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
          <Sparkles size={13} className="text-emerald-300" /> Saved to Case Sheet
        </p>
        {fieldsUpdated.length > 0 && (
          <ul className="text-xs text-emerald-200/90 space-y-0.5">
            {fieldsUpdated.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        )}
        {abnormalFlags.length > 0 && (
          <p className="text-xs text-amber-300 font-semibold pt-1 border-t border-emerald-800/40">
            ⚠️ {abnormalFlags.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function ReasoningBubble({ message }: { message: ScribeChatMessage }) {
  if (message.type === "error") {
    return (
      <div className="flex items-start gap-2 max-w-[85%] animate-fade-in">
        <AlertTriangle size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
          <p className="text-sm text-slate-300">{message.content}</p>
        </div>
      </div>
    );
  }

  const { differentials = [], references = [], watchFor = [] } = message.clinicalReasoning || {};

  return (
    <div className="flex items-start gap-2 max-w-[90%] animate-fade-in">
      <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 space-y-3 shadow-md">
        {message.content && <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">{message.content}</p>}

        {differentials.length > 0 && (
          <div className="bg-indigo-50/60 dark:bg-slate-950/60 border border-indigo-100 dark:border-slate-800/80 rounded-xl p-2.5">
            <p className="text-[10px] font-black tracking-widest text-indigo-700 dark:text-indigo-400 uppercase mb-1.5 flex items-center gap-1">
              🎯 Differentials to Consider
            </p>
            <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1">
              {differentials.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {watchFor.length > 0 && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-2.5">
            <p className="text-[10px] font-black tracking-widest text-red-400 uppercase mb-1 flex items-center gap-1">
              ⚠️ Watch For (Red Flags)
            </p>
            <ul className="text-xs text-red-200 space-y-1">
              {watchFor.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span>⚠️</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {references.length > 0 && (
          <div className="border-t border-slate-800 pt-2">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1 flex items-center gap-1">
              📚 Reference Citations
            </p>
            <ul className="text-[11px] text-slate-300 space-y-1">
              {references.map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="font-bold text-indigo-300">{r.source}:</span>
                  <span className="text-slate-300">{r.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScribeClinicalChat({
  caseId,
  patientAgeYears,
  patientName,
  onBack,
  onCaseSheetUpdate,
  onSendTurn,
  onFinalizeCase
}: Props) {
  const [messages, setMessages] = useState<ScribeChatMessage[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reload chat history whenever caseId changes.
  // Reopening an existing case shows its own continuation.
  useEffect(() => {
    setIsHistoryLoading(true);
    const unsubscribe = subscribeChatHistory(caseId, history => {
      setMessages(history);
      setIsHistoryLoading(false);
    });
    return () => unsubscribe();
  }, [caseId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMessage: ScribeChatMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      timestamp: new Date().toISOString(),
      type: "text",
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    await appendChatMessage(caseId, userMessage);
    setInputText("");
    setIsSending(true);

    try {
      const { extractionMessage, reasoningMessage, updatedCaseSheetFields } = await onSendTurn(text);
      setMessages(prev => [...prev, extractionMessage, reasoningMessage]);
      await Promise.all([
        appendChatMessage(caseId, extractionMessage),
        appendChatMessage(caseId, reasoningMessage),
      ]);
      if (updatedCaseSheetFields && Object.keys(updatedCaseSheetFields).length > 0) {
        onCaseSheetUpdate(updatedCaseSheetFields);
      }
    } catch (err) {
      console.error("[ScribeClinicalChat] Error during turn execution:", err);
      const errorMessage: ScribeChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "Something went wrong processing this entry. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
      await appendChatMessage(caseId, errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleFinalizeAndStartNew = () => {
    const newCaseId = generateNewCaseId();
    onFinalizeCase(newCaseId);
  };

  if (isHistoryLoading) {
    return (
      <div className="flex flex-col h-[75vh] bg-white dark:bg-slate-950 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading patient chat history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[75vh] bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl animate-fade-in">
      {/* Header Bar */}
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-display">
                Scribe & Clinical Chat — {patientName || `Case ${caseId}`}
              </h2>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Interactive Voice Scribe · Auto Case Sheet Extraction · Textbook DDx
            </p>
          </div>
        </div>

        <button
          onClick={handleFinalizeAndStartNew}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={14} className="text-amber-300" />
          <span>Save & Start New Case →</span>
        </button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-slate-50/50 dark:bg-transparent">
        {messages.length === 0 && (
          <div className="text-center py-12 px-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl my-4 shadow-sm">
            <Sparkles className="w-8 h-8 text-indigo-500 dark:text-indigo-400 mx-auto mb-2 opacity-80" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">ErMate Scribe & Chat Ready</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Dictate or type your clinical encounter notes below. ErMate will automatically format the details into the patient's Case Sheet and provide textbook differentials & watch-for red flags.
            </p>
          </div>
        )}

        {messages.map(msg =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end animate-fade-in">
              <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-md">
                <p className="text-xs leading-relaxed">{msg.content}</p>
                <p className="text-[9px] text-indigo-200/70 text-right mt-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ) : msg.type === "extraction-confirmation" || (msg.type === "error" && msg.content.includes("extract")) ? (
            <div key={msg.id}>
              <ExtractionBubble message={msg} />
            </div>
          ) : (
            <div key={msg.id}>
              <ReasoningBubble message={msg} />
            </div>
          )
        )}

        {isSending && (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs py-2 px-3 bg-indigo-50 dark:bg-slate-900/80 border border-indigo-200 dark:border-slate-800 rounded-xl w-fit">
            <RefreshCw size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
            <span>Analyzing dictation & querying ER reference textbooks...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-3 flex items-center gap-2">
        <input
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend(inputText)}
          placeholder="Dictate, type notes, or ask a clinical question..."
          className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-full px-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          disabled={isSending}
        />

        <VoiceRecorder
          renderMode="compact-button"
          onTranscript={(text) => handleSend(text)}
          disabled={isSending}
        />

        {inputText.trim() && (
          <button
            onClick={() => handleSend(inputText)}
            disabled={isSending}
            className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
