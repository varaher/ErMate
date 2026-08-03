import React, { useState } from "react";
import { 
  BookOpen, Trophy, HelpCircle, Sparkles, Search, Library, FileText, 
  ChevronRight, Download, ChevronLeft, GraduationCap, Bot, User, Send, 
  Mic, MicOff, RefreshCw 
} from "lucide-react";
import { auth } from "../firebase";
import { useBoundChat } from "../hooks/useBoundChat";
import SimulationsView from "./SimulationsView";
import TriviaView from "./TriviaView";
import GoogleClassroomModal from "./GoogleClassroomModal";

interface LearnViewProps {
  onNavigateToTab?: (tabId: string) => void;
  isDarkMode?: boolean;
}

function EMReferenceChatPanel() {
  const currentUserUid = auth.currentUser?.uid || "guest_user";
  const { messages, loading, sending, sendMessage } = useBoundChat({
    type: "reference",
    id: `${currentUserUid}_reference`,
    data: {}
  });

  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  const quickQuestions = [
    "How do I use Ketofol in AF?",
    "RSI drug doses paediatric",
    "STEMI equivalents on ECG",
    "Severe Sepsis ER resuscitation",
    "Hyperkalemia acute shift protocol"
  ];

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[75vh]">
      {/* Reference Banner Header */}
      <div className="p-4 bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border font-mono bg-purple-500/20 text-purple-300 border-purple-400/30">
                EM Reference
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Claude Sonnet Engine
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-0.5">
              Emergency Medicine Standalone Clinical Reference
            </h3>
          </div>
        </div>
        <div className="text-[11px] text-purple-200/80 font-mono flex items-center gap-2 shrink-0">
          <span>Tintinalli's · Rosen's · UpToDate · WikEM</span>
        </div>
      </div>

      {/* Quick Question Chips */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold uppercase shrink-0">
          Recent / Sample Questions:
        </span>
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => sendMessage(q)}
            disabled={sending}
            className="text-[11px] font-medium bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 transition-all shrink-0 hover:border-purple-300 cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs font-mono gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
            <span>Loading reference chat session...</span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-none shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans font-normal leading-relaxed">
                  {msg.content}
                </div>
                <div
                  className={`text-[9px] font-mono mt-2 text-right ${
                    msg.role === 'user' ? 'text-purple-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-none p-3 px-4 text-xs text-purple-600 dark:text-purple-400 font-mono flex items-center gap-2 shadow-xs">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Consulting Tintinalli's, Rosen's & UpToDate via Claude Sonnet...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={toggleListening}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            isListening
              ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
          }`}
          title={isListening ? 'Stop Listening' : 'Dictate Question (Voice)'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask any clinical question (e.g., 'How do I use Ketofol in AF?')..."
          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-sans"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function LearnView({ onNavigateToTab, isDarkMode = false }: LearnViewProps) {
  const [activeTab, setActiveTab] = useState<"library" | "simulations" | "trivia" | "memory">("library");
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);

  // Clinical memories log state
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [tempReflections, setTempReflections] = useState("");
  const [pendingDeleteMemId, setPendingDeleteMemId] = useState<string | null>(null);

  const loadMemories = () => {
    try {
      const stored = localStorage.getItem("clinical_memory_log") || "[]";
      setMemories(JSON.parse(stored));
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    loadMemories();
  }, [activeTab]);

  const handleDeleteMemory = (id: string) => {
    try {
      const stored = localStorage.getItem("clinical_memory_log") || "[]";
      const parsed = JSON.parse(stored);
      const filtered = parsed.filter((m: any) => m.id !== id);
      localStorage.setItem("clinical_memory_log", JSON.stringify(filtered));
      setMemories(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateReflections = (id: string) => {
    try {
      const stored = localStorage.getItem("clinical_memory_log") || "[]";
      const parsed = JSON.parse(stored);
      const updated = parsed.map((m: any) => {
        if (m.id === id) {
          return { ...m, physicianReflections: tempReflections };
        }
        return m;
      });
      localStorage.setItem("clinical_memory_log", JSON.stringify(updated));
      setMemories(updated);
      setEditingMemId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportMemories = () => {
    try {
      const dataStr = memories.map((m, idx) => {
        return `==========================================
ENTRY #${idx + 1} - LOGGED ON ${new Date(m.savedAt).toLocaleDateString()}
==========================================
Patient: ${m.patientName || "Anonymous"} (${m.age || "N/A"}y, ${m.gender || "N/A"})
Presenting Complaint: ${m.presentingComplaint || "N/A"}
Final Diagnosis: ${m.diagnosis || "N/A"}
------------------------------------------
CLINICAL MEMORY PEARL:
"${m.memoryPearl}"

PHYSICIAN REFLECTIONS:
${m.physicianReflections || "No reflections logged."}
`;
      }).join("\n\n");

      const blob = new Blob([dataStr], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `lifelong_clinical_memory_log_${new Date().toISOString().split("T")[0]}.txt`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="learn-main-container">
      {onNavigateToTab && (
        <button
          type="button"
          onClick={() => onNavigateToTab("dashboard")}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-emerald-500" /> Back to Dashboard
        </button>
      )}
      
      {/* Tab Navigation header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4 no-print">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            EM Reference & Learn Suite
          </h1>
          <p className="text-xs text-slate-400">
            Ask generic evidence-based emergency medicine questions or hone skills with clinical simulators and MCQ quizzes.
          </p>
        </div>

        {/* Learn Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "library"
                ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            EM Reference
          </button>

          <button
            onClick={() => setActiveTab("simulations")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "simulations"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Simulations
          </button>

          <button
            onClick={() => setActiveTab("trivia")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "trivia"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Trivia Time
          </button>

          <button
            onClick={() => setActiveTab("memory")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "memory"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Clinical Memory Log
          </button>

          <button
            onClick={() => setIsClassroomModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ml-1"
            title="Open Google Classroom Residency Portal"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Google Classroom</span>
          </button>
        </div>
      </div>

      {/* Render active sub-view */}
      <div className="transition-all duration-300">
        
        {/* Sub-view: Standalone EM Reference Chat */}
        {activeTab === "library" && (
          <div className="animate-fade-in max-w-5xl mx-auto space-y-4">
            <EMReferenceChatPanel />
          </div>
        )}

        {/* Sub-view: Branched clinical simulations */}
        {activeTab === "simulations" && (
          <div className="animate-fade-in space-y-4">
            <SimulationsView />
          </div>
        )}

        {/* Sub-view: Trivia time */}
        {activeTab === "trivia" && (
          <div className="animate-fade-in space-y-4">
            
            {/* Streak indicator banner */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl p-4 flex items-center justify-between shadow-xs max-w-3xl mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-100 font-mono">Streak Achieved!</h4>
                  <p className="text-sm font-bold font-display">Weekly Streak Badge: 5 Days Active</p>
                </div>
              </div>
              <span className="text-[10px] bg-white/20 text-white border border-white/20 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wide shrink-0">
                +120 XP
              </span>
            </div>

            <TriviaView />
          </div>
        )}

        {/* Sub-view: Clinical Memory Lifelong Log */}
        {activeTab === "memory" && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Lifelong Clinical Memory Bank</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Review anonymized learning pearls auto-captured from resolved ER cases.</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search memory pearls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleExportMemories}
                  disabled={memories.length === 0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Export Log
                </button>
              </div>
            </div>

            {memories.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Clinical Memories Logged Yet</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  When you complete cases in ErMate, high-yield diagnostic and therapeutic learning pearls will be recorded here for lifelong review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {memories
                  .filter((m: any) => 
                    !searchQuery.trim() || 
                    m.memoryPearl?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((m: any) => (
                    <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                          {m.diagnosis || "Clinical Case"} · Logged {new Date(m.savedAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingMemId(m.id);
                              setTempReflections(m.physicianReflections || "");
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Edit Reflection
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(m.id)}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-150 dark:border-slate-800 font-sans leading-relaxed text-slate-800 dark:text-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">Clinical Pearl:</span>
                        "{m.memoryPearl}"
                      </div>

                      {editingMemId === m.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={tempReflections}
                            onChange={(e) => setTempReflections(e.target.value)}
                            placeholder="Add your personal clinical reflections or follow-up notes..."
                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingMemId(null)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateReflections(m.id)}
                              className="px-3 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded-lg"
                            >
                              Save Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        m.physicianReflections && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                            <span className="font-bold not-italic">Reflections:</span> {m.physicianReflections}
                          </div>
                        )
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Google Classroom Residency Modal */}
      <GoogleClassroomModal
        isOpen={isClassroomModalOpen}
        onClose={() => setIsClassroomModalOpen(false)}
      />
    </div>
  );
}
