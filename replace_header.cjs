const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const startMarker = '{/* Persistent "Not Yet Triaged" Warning Chip  */}';
const endMarker = '{/* Tab content area  */}';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find markers!");
    process.exit(1);
}

const replacement = `{/* COMPACT MOBILE HEADER & NAV RAIL */}
      <div className="flex flex-col gap-4 max-w-7xl mx-auto no-print" id="case-sheet-container">
        
        <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pt-3 pb-0 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-xs">
          {/* Header Row 1 */}
          <div className="px-4 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <button onClick={onBack} className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase">
              <ArrowLeft className="w-3.5 h-3.5" />
              Cases
            </button>
            <div className="flex items-center gap-3">
              <span>{currentCase.patient.caseType || "Medical"} · {!isTriageCategoryPending(currentCase.patient.triageCategory) ? currentCase.patient.triageCategory?.split(" ")[0] || "P2" : "P2"}</span>
            </div>
          </div>

          {/* Header Row 2 */}
          <div className="px-4 flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-lg font-black text-slate-900 dark:text-white truncate">
                {currentCase.patient.name} <span className="font-normal text-slate-400">· {currentCase.patient.age || "N/A"}y/{currentCase.patient.gender?.charAt(0) || "U"}</span>
              </div>
              {currentCase.patient.uhid && (
                <div className="text-[10px] font-mono text-slate-500 truncate">UHID {currentCase.patient.uhid}</div>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 pb-1">
              {onReturnToScribe ? (
                <button onClick={onReturnToScribe} className={\`flex items-center gap-1.5 px-3 py-1.5 \${hasActiveScribeSession ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-purple-600 text-white'} text-[10px] font-bold rounded-lg transition-colors\`}>
                  <Mic className={\`w-3 h-3 \${hasActiveScribeSession ? 'animate-pulse text-purple-400' : ''}\`} />
                  {hasActiveScribeSession ? "Resume Scribe" : "Open Scribe"}
                </button>
              ) : null}
              
              <details className="relative group">
                <summary className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer list-none transition-colors [&::-webkit-details-marker]:hidden">
                  <MoreVertical className="w-4.5 h-4.5" />
                </summary>
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export</div>
                  <button className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" /> Copy to EMR
                  </button>
                  <button onClick={() => onViewPrintSheet?.(currentCase.id)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5" /> View PDF
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Case Actions</div>
                  <button onClick={() => { handleSave(); onBack(); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" /> Finish & Return
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Case
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Triage Pending Strip */}
          {isTriageCategoryPending(currentCase.patient.triageCategory) && (
            <div className="mx-4 flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2 animate-pulse-slow">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-500 uppercase flex items-center gap-1.5 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
                Triage pending
              </span>
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                {[
                  { label: "P1", cat: "P1 (Resuscitative)" },
                  { label: "P2", cat: "P2 (Emergent)" },
                  { label: "P3", cat: "P3 (Urgent)" },
                  { label: "P4", cat: "P4 (Non-Urgent)" }
                ].map((item) => (
                  <button
                    key={item.cat}
                    onClick={() => {
                      setCurrentCase(prev => ({
                        ...prev,
                        patient: { ...prev.patient, triageCategory: item.cat as any }
                      }));
                    }}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] shadow-sm whitespace-nowrap"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Horizontal Nav Rail */}
          <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: "complaints", label: "Complaints" },
              { id: "primary-survey", label: "Primary" },
              { id: "history", label: "SAMPLE" },
              { id: "secondary-survey", label: "Secondary" },
              { id: "investigations", label: "Investigations" },
              { id: "treatment", label: "Treatment" },
              { id: "notes", label: "Notes" },
              { id: "disposition", label: "Disposition" },
              { id: "trends", label: "Trends" },
              { id: "rounds", label: "Rounds" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={\`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors shrink-0 whitespace-nowrap \${
                    isActive 
                      ? "bg-blue-600 text-white" 
                      : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }\`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content area  */}
        <div className="p-4 space-y-6">
`;

const endOfTabContent = code.indexOf('<div className="bg-white dark:bg-slate-950 border border-slate-200', endIndex);
const finalCode = code.slice(0, startIndex) + replacement + code.slice(endOfTabContent > -1 ? endOfTabContent + 104 : endIndex + endMarker.length);

fs.writeFileSync('src/components/CaseSheetView.tsx', finalCode);
console.log("Replacement successful!");
