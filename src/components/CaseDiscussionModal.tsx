import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, X, Send, Bot, User, Sparkles, Activity, FileText, 
  HelpCircle, ChevronRight, BookOpen, AlertCircle, RefreshCw, Layers
} from "lucide-react";
import { ClinicalCase } from "../types";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

interface CaseDiscussionModalProps {
  patientCase: ClinicalCase | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDiscussionHistory?: (caseId: string, messages: Message[]) => void;
}

export const CaseDiscussionModal: React.FC<CaseDiscussionModalProps> = ({
  patientCase,
  isOpen,
  onClose,
  onSaveDiscussionHistory
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing discussion or initialize with welcome message
  useEffect(() => {
    if (!patientCase || !isOpen) return;

    if (patientCase.discussionMessages && patientCase.discussionMessages.length > 0) {
      setMessages(patientCase.discussionMessages);
    } else {
      const initialWelcomeMsg: Message = {
        id: "welcome-" + Date.now(),
        sender: "ai",
        text: `Hello Doctor. I have loaded **${patientCase.patient?.name || "Patient"}** (${patientCase.patient?.age || "N/A"} y/o ${patientCase.patient?.gender || ""}) into clinical discussion mode.

**Case Highlights Loaded:**
- **Chief Complaint**: ${patientCase.patient?.presentingComplaint || "Emergency presentation"}
- **Triage**: ${patientCase.patient?.triageCategory || "P2"} | **Vitals**: BP ${patientCase.vitals?.bp || "N/A"}, HR ${patientCase.vitals?.hr || "N/A"}, SpO2 ${patientCase.vitals?.spo2 || "N/A"}%
- **PMH**: ${patientCase.sampleHistory?.pastHistory || "None documented"}

You can ask me any diagnostic, therapeutic, or learning curve questions specific to this patient. How would you like to proceed?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages([initialWelcomeMsg]);
    }
  }, [patientCase, isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  if (!isOpen || !patientCase) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    const userMsg: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInputText("");
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/case-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: patientCase,
          messages: updatedMessages
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reach AI clinical consult.");
      }

      const resData = await response.json();
      if (resData.success && resData.reply) {
        const aiMsg: Message = {
          id: "ai-" + Date.now(),
          sender: "ai",
          text: resData.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);
        if (onSaveDiscussionHistory && patientCase.id) {
          onSaveDiscussionHistory(patientCase.id, finalMessages);
        }
      } else {
        throw new Error(resData.error || "No response received.");
      }
    } catch (err: any) {
      console.error("[CaseDiscussion] Error:", err);
      setError("Unable to connect to AI clinical consult. Showing guideline fallback.");
      const fallbackMsg: Message = {
        id: "ai-fallback-" + Date.now(),
        sender: "ai",
        text: `### Clinical Analysis for ${patientCase.patient?.name || "Patient"}

**Inquiry**: "${text}"

**Key Clinical Considerations**:
- Assess acute vs chronic organ dysfunction (evaluate renal parameters Creatinine, Urea, Urine Protein).
- Review volume status and hemoconcentration flags (Hb/Hct elevations).
- Consider secondary systemic etiologies (such as Amyloidosis, Endocrine disorders, Nephrotic state).

### 📚 Reference Citations
* **Tintinalli's Emergency Medicine**: Chapter 195: Renal and Endocrine Emergencies.
* **Harrison's Principles of Internal Medicine**: Section 301: Plasma Cell Dyscrasias and Amyloidosis.
* **UpToDate**: Approach to suspected secondary amyloidosis in complex medical patients.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      const finalMessages = [...updatedMessages, fallbackMsg];
      setMessages(finalMessages);
      if (onSaveDiscussionHistory && patientCase.id) {
        onSaveDiscussionHistory(patientCase.id, finalMessages);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPrompts = [
    "🧬 Could this presentation be Amyloidosis?",
    "🩸 Analyze all lab & urine routine findings",
    "💊 Review medication & fluid management plan",
    "🎓 Rounds Debrief: Case learning summary"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  Case Discussion: {patientCase.patient?.name || "Emergency Patient"}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-300 border border-blue-700 font-semibold">
                  {patientCase.patient?.triageCategory || "P2"}
                </span>
                {patientCase.bedNo && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    Bed {patientCase.bedNo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{patientCase.patient?.age || "N/A"} y/o {patientCase.patient?.gender || ""}</span>
                <span>•</span>
                <span className="truncate max-w-xs">{patientCase.patient?.presentingComplaint || "Emergency case"}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Close discussion"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Vitals & Clinical Context Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-700 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1 font-semibold text-slate-800">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              BP: <span className="font-mono text-slate-900">{patientCase.vitals?.bp || "N/A"}</span>
            </span>
            <span>
              HR: <span className="font-mono text-slate-900">{patientCase.vitals?.hr || "N/A"}</span>
            </span>
            <span>
              SpO2: <span className="font-mono text-slate-900">{patientCase.vitals?.spo2 || "N/A"}%</span>
            </span>
            <span>
              RR: <span className="font-mono text-slate-900">{patientCase.vitals?.rr || "N/A"}</span>
            </span>
            {patientCase.sampleHistory?.pastHistory && (
              <span className="truncate max-w-md text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                <strong className="text-slate-800">PMH:</strong> {patientCase.sampleHistory.pastHistory}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Patient context bound to Gemini AI
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.sender === "ai" && (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[82%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
                m.sender === "user" 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
              }`}>
                <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75 pb-1 border-b border-current/10">
                  <span className="font-semibold">{m.sender === "user" ? "Dr. Physician" : "ErMate AI Senior Consultant"}</span>
                  <span className="font-mono">{m.timestamp}</span>
                </div>

                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap font-sans">
                  {m.text}
                </div>
              </div>

              {m.sender === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start items-center text-slate-500 text-xs italic pl-2 py-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <span>Analyzing patient case context & reviewing textbook citations...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Chips */}
        <div className="bg-white px-4 py-2 border-t border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Quick Prompts:
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              disabled={isProcessing}
              onClick={() => handleSendMessage(prompt.replace(/^[\u1F300-\u1F9FF\u2600-\u26FF]\s*/, ""))}
              className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs rounded-full border border-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="bg-white p-4 border-t border-slate-200 shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask clinical questions about ${patientCase.patient?.name || "this patient"}...`}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
