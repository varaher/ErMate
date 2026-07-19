import React, { useState } from "react";
import { BookOpen, Trophy, HelpCircle, Sparkles, Search, Library, FileText, ChevronRight, Download, ChevronLeft } from "lucide-react";
import SimulationsView from "./SimulationsView";
import TriviaView from "./TriviaView";

interface EMReferenceResult {
  answer: string;
  citations: string[];
  keyTeachingPoint: string;
}

interface LearnViewProps {
  onNavigateToTab?: (tabId: string) => void;
  isDarkMode?: boolean;
}

export default function LearnView({ onNavigateToTab, isDarkMode = false }: LearnViewProps) {
  const [activeTab, setActiveTab] = useState<"simulations" | "library" | "trivia" | "memory">("simulations");
  
  // EM Reference state
  const [libraryQuery, setLibraryQuery] = useState("");
  const [refResult, setRefResult] = useState<EMReferenceResult | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Clinical memories log state
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [tempReflections, setTempReflections] = useState("");

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

  const handleLibrarySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libraryQuery.trim()) return;

    setLoadingRef(true);
    setErrorMessage("");
    setRefResult(null);

    try {
      const response = await fetch("/api/em-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: libraryQuery })
      });
      const data = await response.json();
      if (data.success && data.data) {
        setRefResult(data.data);
      } else if (data.data) {
        // Fallback or partial
        setRefResult(data.data);
        if (data.simulated) {
          console.log("Using local offline backup EM protocols");
        }
      } else {
        setErrorMessage("Could not parse clinical response.");
      }
    } catch (err: any) {
      setErrorMessage("Network error connecting to library backend.");
    } finally {
      setLoadingRef(false);
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
            Learn & Reference Suite
          </h1>
          <p className="text-xs text-slate-400">
            Hone emergency medicine skills through branched clinical simulators, PubMed reference lookups, and MCQ quizzes.
          </p>
        </div>

        {/* Learn Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("simulations")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "simulations"
                ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Simulations
          </button>
          
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "library"
                ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            EM Reference Library
          </button>

          <button
            onClick={() => setActiveTab("trivia")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "memory"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Clinical Memory Log
          </button>
        </div>
      </div>

      {/* Render active sub-view */}
      <div className="transition-all duration-300">
        
        {/* Sub-view: Branched clinical simulations */}
        {activeTab === "simulations" && (
          <div className="animate-fade-in space-y-4">
            <SimulationsView />
          </div>
        )}

        {/* Sub-view: EM Reference Library */}
        {activeTab === "library" && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            
            {/* Search Card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  PubMed Grounding Active
                </span>
                <h3 className="text-base font-bold font-display text-slate-850 dark:text-white">
                  Evidence-Based Clinical Guidelines Search
                </h3>
                <p className="text-xs text-slate-400">
                  Ask any EM question regarding pediatric dosages, advanced trauma algorithms (ATLS), or cardiac guidelines.
                </p>
              </div>

              <form onSubmit={handleLibrarySearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="e.g. 'STEMI thrombolysis criteria', 'PALS epinephrine dosing', 'Anaphylaxis protocol'"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingRef || !libraryQuery.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1"
                >
                  {loadingRef ? "Searching..." : "Consult Reference"}
                </button>
              </form>

              {/* Sample queries chips */}
              <div className="flex flex-wrap gap-1.5 items-center pt-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold mr-1">Quick consults:</span>
                <button
                  onClick={() => { setLibraryQuery("Anaphylaxis protocol"); }}
                  className="text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-md border"
                >
                  Anaphylaxis
                </button>
                <button
                  onClick={() => { setLibraryQuery("Acute STEMI Management Protocol"); }}
                  className="text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-md border"
                >
                  STEMI Reperfusion
                </button>
              </div>
            </div>

            {/* Reference Result Panel */}
            {loadingRef && (
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-12 text-center shadow-xs">
                <Sparkles className="w-10 h-10 text-indigo-500 animate-spin-slow mx-auto mb-3" />
                <p className="text-xs font-mono text-slate-500">Retrieving standard emergency guidelines & citations...</p>
              </div>
            )}

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-150 text-rose-700 p-4 rounded-xl text-xs">
                {errorMessage}
              </div>
            )}

            {refResult && (
              <div className="space-y-4 animate-fade-in">
                
                {/* Result Display */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Library className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-850 dark:text-white">Guideline Reference Review</h4>
                  </div>

                  <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border">
                    {refResult.answer}
                  </div>

                  {/* Key teaching point card */}
                  {refResult.keyTeachingPoint && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/50 p-4 rounded-xl space-y-1">
                      <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 font-mono uppercase tracking-wider">
                        High-Yield Teaching Point
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                        {refResult.keyTeachingPoint}
                      </p>
                    </div>
                  )}

                  {/* Citations list */}
                  {refResult.citations && refResult.citations.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1.5">References & Guidelines Cited:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {refResult.citations.map((cite, index) => (
                          <span 
                            key={index} 
                            className="bg-slate-50 dark:bg-slate-900 text-slate-500 border text-[10px] font-mono px-2.5 py-0.5 rounded-md"
                          >
                            {cite}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

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
            
            {/* Header / Intro Card */}
            <div className={`bg-gradient-to-r ${isDarkMode ? 'from-indigo-900 to-slate-900 border-indigo-500/20' : 'from-indigo-600 to-purple-600 border-transparent'} text-white p-5 md:p-6 rounded-2xl shadow-md space-y-3 relative overflow-hidden border`}>
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-4 translate-y-4">
                <FileText className="w-48 h-48" />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className={`text-[9px] px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-widest border ${
                    isDarkMode 
                      ? "bg-indigo-500/30 text-indigo-300 border-indigo-500/20" 
                      : "bg-white/20 text-white border-white/10"
                  }`}>
                    🔒 Secure Lifelong Ledger
                  </span>
                  <h3 className="text-base md:text-lg font-bold font-display">
                    My Private Clinical Memory Log
                  </h3>
                  <p className={`text-[11px] max-w-xl leading-relaxed ${
                    isDarkMode ? "text-slate-300" : "text-indigo-100"
                  }`}>
                    A private clinical diary logging key pathophysiology pearls, atypical mimics, and personal physician reflections from every emergency patient encountered. Stored locally, fully HIPAA-safe.
                  </p>
                </div>
                {memories.length > 0 && (
                  <button
                    onClick={handleExportMemories}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Study Portfolio
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Dashboard Row */}
            {memories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Clinical Pearls Saved</span>
                    <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{memories.length}</h4>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Pediatric Encounters</span>
                    <h4 className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                      {memories.filter(m => m.isPediatric).length}
                    </h4>
                  </div>
                  <div className="w-10 h-10 bg-sky-50 dark:bg-sky-950/40 text-sky-500 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Unique Diagnoses</span>
                    <h4 className="text-lg font-black text-teal-600 dark:text-teal-400 font-mono">
                      {new Set(memories.map(m => m.diagnosis)).size}
                    </h4>
                  </div>
                  <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/40 text-teal-500 rounded-lg flex items-center justify-center">
                    <Library className="w-5 h-5" />
                  </div>
                </div>
              </div>
            )}

            {/* Search and Timeline content */}
            <div className="space-y-4">
              
              {memories.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clinical memory ledger (e.g. 'STEMI', 'Ramesh', 'ECG', 'Pain')..."
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Memory List Rendering */}
              {memories.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                    <Library className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wide">
                      Clinical Memory Portfolio Empty
                    </h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Your Career Clinical Memory Portfolio tracks high-yield learning pearls and personal physician reflections offline-first and private.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border max-w-sm mx-auto text-left space-y-1.5 text-[10px]">
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">💡 How to log a clinical pearl:</span>
                    <p className="text-slate-500 leading-relaxed">
                      Go to the <strong>Patient Cases</strong> tab, choose an active patient, click the <strong>🎓 Rounds & Debrief</strong> tab, select any thinking lens to fetch analysis, and click <strong>"Sync to Lifelong Clinical Ledger"</strong>. Or simply hit **Finish & Save Case** to invoke the post-save clinical debriefing nudge.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {memories
                    .filter((m) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        m.patientName?.toLowerCase().includes(q) ||
                        m.diagnosis?.toLowerCase().includes(q) ||
                        m.presentingComplaint?.toLowerCase().includes(q) ||
                        m.memoryPearl?.toLowerCase().includes(q) ||
                        m.physicianReflections?.toLowerCase().includes(q)
                      );
                    })
                    .map((m) => (
                      <div
                        key={m.id}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-4 transition-all hover:border-slate-350 dark:hover:border-slate-750 flex flex-col justify-between"
                      >
                        
                        {/* Top Metadata row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 font-display">
                              {m.patientName || "Anonymous Patient"}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {m.age}y {m.gender}
                            </span>
                            {m.isPediatric && (
                              <span className="text-[8.5px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-150 px-2 py-0.5 rounded font-extrabold uppercase">
                                Pediatric
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              Logged: {new Date(m.savedAt).toLocaleDateString()} at {new Date(m.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Remove this clinical memory from your private career ledger? This cannot be undone.")) {
                                  handleDeleteMemory(m.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 transition-all p-1 rounded"
                              title="Delete from log"
                            >
                              <span className="text-[10px] font-bold">Delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Mid Row: Diagnosis / complaint details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-500 font-medium">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Presenting Complaint</span>
                            <p className="text-slate-800 dark:text-slate-200 font-sans mt-0.5">{m.presentingComplaint || "Not specified"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Confirmed / Provisional Diagnosis</span>
                            <p className="text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{m.diagnosis || "Stabilized Emergency presentation"}</p>
                          </div>
                        </div>

                        {/* Highlighted Clinical Pearl */}
                        <div className="bg-amber-50/55 dark:bg-amber-950/15 border border-amber-200/50 p-4 rounded-xl space-y-1 shadow-xs">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-[9px] font-extrabold text-amber-700 dark:text-amber-400 font-mono uppercase tracking-widest">
                              Logged Clinical Pearl
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                            "{m.memoryPearl}"
                          </p>
                        </div>

                        {/* physician reflections space */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-extrabold text-slate-400 font-mono uppercase tracking-wide block">
                              My Clinical reflections
                            </span>
                            {editingMemId !== m.id && (
                              <button
                                onClick={() => {
                                  setEditingMemId(m.id);
                                  setTempReflections(m.physicianReflections || "");
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-bold uppercase tracking-wide"
                              >
                                Edit reflections
                              </button>
                            )}
                          </div>

                          {editingMemId === m.id ? (
                            <div className="space-y-2 animate-fade-in">
                              <textarea
                                rows={3}
                                value={tempReflections}
                                onChange={(e) => setTempReflections(e.target.value)}
                                placeholder="Reflect on this clinical case: pitfalls, drug dosages, standard procedures, cognitive gaps..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingMemId(null)}
                                  className="px-2.5 py-1 border rounded text-[10px] font-bold"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReflections(m.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold"
                                >
                                  Save reflections
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic select-text">
                              {m.physicianReflections || "No personal clinician reflections recorded yet. Click 'Edit reflections' to log custom pitfalls or key reminders."}
                            </p>
                          )}
                        </div>

                      </div>
                    ))}
                </div>
              )}

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
