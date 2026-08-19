import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { subscribeChatHistory, appendChatMessage, generateNewCaseId, updateChatMessage } from "../services/scribeChatStorage";
import VoiceRecorder from "./shared/VoiceRecorder";
import Markdown from "react-markdown";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  extractionData?: any;
  extractionApplied?: boolean;
  dischargeDraft?: string;
  dischargeApplied?: boolean;
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
}: VoiceScribeChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "ErMate is ready.\n\n🎙️ Dictate your case, or type below.\n💬 Ask a clinical question anytime.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeCaseId] = useState(() => propCaseId || generateNewCaseId());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputTextareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const unsubscribe = subscribeChatHistory(activeCaseId, (history) => {
      if (history && history.length > 0) {
        setMessages(
          history.map((h: any) => ({
            id: h.id,
            sender: h.role === "user" ? "user" : "ai",
            text: h.content,
            timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            extractionData: h.unappliedExtraction,
            dischargeDraft: h.dischargeDraft
          }))
        );
      }
    });
    return () => unsubscribe();
  }, [activeCaseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleApplyExtraction = async (msgId: string, extractionData: any) => {
    try {
      if (onSaveExtractedCase) {
        await onSaveExtractedCase(extractionData, { existingCaseId: activeCaseId, autoNavigate: false });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated(extractionData);
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      // Show feedback toast
      const toast = document.createElement("div");
      toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4";
      toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied to Case Sheet`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (e) {
      console.warn("Failed to apply extraction", e);
    }
  };

  const handleApplyDischarge = async (msgId: string, dischargeDraft: string) => {
    try {
      if (onSaveExtractedCase) {
        await onSaveExtractedCase({ dischargeSummaryDraft: dischargeDraft }, { existingCaseId: activeCaseId, autoNavigate: false });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated({ dischargeSummaryDraft: dischargeDraft });
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, dischargeApplied: true } : m));
      // Show feedback toast
      const toast = document.createElement("div");
      toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4";
      toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Discharge Draft Saved`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (e) {
      console.warn("Failed to apply discharge summary", e);
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
    };

    setMessages((prev) => [...prev, userMsg]);
    appendChatMessage(activeCaseId, { 
      id: `u-${Date.now()}`,
      role: "user", 
      type: "text",
      content: trimmed, 
      timestamp: new Date().toISOString() 
    }).catch(err => {
      console.error("[VoiceScribeChatView] Failed to save user message:", err);
      setMessages(prev => [...prev, {
        id: `err-save-${Date.now()}`,
        sender: "ai",
        text: "⚠️ Failed to save your message to the database. It may disappear on refresh.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout

    try {
      const res = await fetch("/api/scribe-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ 
          userInput: trimmed, 
          caseId: activeCaseId,
          caseData: caseData || {},
          patientAgeYears: caseData?.patient?.age || null,
          caseContext: caseData || {},
          messages: messages
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      const replyText =
        data.reply ||
        data.aiReply ||
        data.summary ||
        "Processed case details.";

      const fieldsToExtract = data.unappliedExtraction || data.updatedCaseSheetFields || data.extractedFields;
      const dischargeDraft = data.dischargeDraft;

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        extractionData: fieldsToExtract && Object.keys(fieldsToExtract).length > 0 ? fieldsToExtract : undefined,
        extractionApplied: false,
        dischargeDraft: dischargeDraft,
        dischargeApplied: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
      appendChatMessage(activeCaseId, { 
        id: `ai-${Date.now()}`,
        role: "assistant", 
        type: "text",
        content: replyText, 
        timestamp: new Date().toISOString(),
        unappliedExtraction: fieldsToExtract && Object.keys(fieldsToExtract).length > 0 ? JSON.parse(JSON.stringify(fieldsToExtract)) : undefined,
        dischargeDraft: dischargeDraft
      } as any).catch(err => {
        console.error("[VoiceScribeChatView] Failed to save AI message:", err);
        setMessages(prev => [...prev, {
          id: `err-save-ai-${Date.now()}`,
          sender: "ai",
          text: "⚠️ Failed to save this AI response to the database. It may disappear on refresh.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
      });
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
                Smart Voice Scribe Desk
              </h2>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Dictate case details, vitals, or ask clinical questions</p>
          </div>
        </div>

        {onOpenCaseSheet && (
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
                          // Deep merge objects (like vitals)
                          acc[key] = { ...(acc[key] || {}), ...data[key] };
                        } else if (Array.isArray(data[key])) {
                          // Concatenate arrays (like treatments, investigations)
                          acc[key] = [...(acc[key] || []), ...data[key]];
                        } else if (typeof data[key] === 'string' && acc[key] && typeof acc[key] === 'string') {
                          // Smart merge strings: Append narrative text so nothing gets lost
                          if (key.match(/complaint|history|notes|symptoms|allergies|medications/i)) {
                            if (!acc[key].includes(data[key])) {
                              acc[key] = acc[key] + " \n" + data[key];
                            }
                          } else {
                            acc[key] = data[key]; // Overwrite simple strings (e.g., patientName, gender)
                          }
                        } else {
                          acc[key] = data[key];
                        }
                      }
                      return acc;
                    }, {});

                    await onSaveExtractedCase(mergedExtraction, { existingCaseId: activeCaseId, autoNavigate: false });
                    
                    // Mark them all as applied locally so they show the green checkmark if user comes back
                    setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                  } else {
                    // Initialize blank case if there is no data
                    await onSaveExtractedCase({}, { existingCaseId: activeCaseId, autoNavigate: false });
                  }
                } catch (e) {
                  console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                }
              }
              onOpenCaseSheet(activeCaseId);
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span>📄 Open Case Sheet</span>
          </button>
        )}
      </div>

      <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>
          Bed {caseData?.patient?.bed || "--"} • UHID {caseData?.patient?.uhid || "--"} • {caseData?.patient?.age ? `${caseData.patient.age}${caseData.patient.sex?.charAt(0) || ""}` : "--"}
        </span>
        <span>Case opened {new Date(caseData?.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

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
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                <Markdown>{msg.text}</Markdown>
              </div>
              
              {msg.extractionData && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                    Captured from your update
                  </div>
                  <div className="p-3 text-xs space-y-2 text-slate-600 dark:text-slate-400 max-h-[300px] overflow-y-auto">
                    {Object.entries(msg.extractionData)
                      .filter(([key, val]) => {
                        if (key === 'isPediatric') return false;
                        if (val === null || val === undefined || val === '') return false;
                        if (Array.isArray(val) && val.length === 0) return false;
                        if (typeof val === 'object' && Object.keys(val).length === 0) return false;
                        return true;
                      })
                      .map(([key, val]) => {
                        let displayVal = "";
                        if (Array.isArray(val)) {
                          displayVal = val.map(item => {
                            if (typeof item === 'object' && item !== null) {
                              return Object.values(item).filter(v => v !== null && v !== '').join(' ');
                            }
                            return String(item);
                          }).join(', ');
                        } else if (typeof val === 'object' && val !== null) {
                          displayVal = Object.entries(val)
                            .filter(([k, v]) => v !== null && v !== '')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                        } else {
                          displayVal = String(val);
                        }
                        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                          <div key={key}>
                            <strong className="text-slate-800 dark:text-slate-200">{displayKey}:</strong>{" "}
                            {displayVal}
                          </div>
                        );
                      })}
                  </div>
                  <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                      disabled={msg.extractionApplied}
                      onClick={() => handleApplyExtraction(msg.id, msg.extractionData)}
                      className={`w-full py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        msg.extractionApplied
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      }`}
                    >
                      {msg.extractionApplied ? "✅ Copied to Case Sheet" : "Copy to Case Sheet"}
                    </button>
                  </div>
                </div>
              )}

              {msg.dischargeDraft && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                    Discharge Summary Draft
                  </div>
                  <div className="p-3 text-xs space-y-2 text-slate-600 dark:text-slate-400 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                    {msg.dischargeDraft}
                  </div>
                  <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                      disabled={msg.dischargeApplied}
                      onClick={() => handleApplyDischarge(msg.id, msg.dischargeDraft!)}
                      className={`w-full py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        msg.dischargeApplied
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      }`}
                    >
                      {msg.dischargeApplied ? "✓ Applied to Discharge Summary" : "Copy to Discharge Summary"}
                    </button>
                  </div>
                </div>
              )}

              <span className="text-[9px] opacity-60 block text-right mt-2 font-mono">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3 text-xs text-slate-500 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Analyzing dictation with ErMate Clinical Engine...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Recorder & Input Section */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 relative">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-2">
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
              placeholder="Type clinical details / questions..."
              disabled={isSending}
              rows={1}
              className="flex-1 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: "160px" }}
            />
          </div>
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
  );
}
