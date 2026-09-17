const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Add navContainerRef and scroll logic to CaseSheetView
const viewStart = `>("complaints");`;
const scrollLogic = `
  const navContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (navContainerRef.current) {
      const activeEl = navContainerRef.current.querySelector(\`[data-tab-id="\${activeTab}"]\`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeTab]);`;

if (!code.includes('navContainerRef.current')) {
  code = code.replace(viewStart, viewStart + scrollLogic);
}

// 2. Horizontal Nav Rail
const oldNav = `{/* Horizontal Nav Rail */}
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
          </div>`;

const newNav = `{/* Horizontal Nav Rail */}
          <div ref={navContainerRef} className="flex items-center gap-1.5 px-4 overflow-x-auto no-scrollbar pb-2 pt-1 border-t border-slate-100 dark:border-slate-800/50">
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
                  data-tab-id={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={\`text-[11px] font-bold px-4 py-2 rounded-full transition-colors shrink-0 whitespace-nowrap \${
                    isActive 
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20" 
                      : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }\`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>`;

code = code.replace(oldNav, newNav);


// 3. Normal Presets
const oldPresetsFull = `<div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wide">
                      Quick Normal Presets (Adult Normal & Trauma Case Sheet Format)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Click a preset to instantly append standard JCI/NABH-compliant normal findings to the clinical review of systems:
                    </p>`;
const newPresetsFull = `<details className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs group">
                    <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
                      Normal Presets ▾
                    </summary>
                    <div className="pt-2 space-y-2">
                      <p className="text-[10px] text-slate-500">
                        Click a preset to instantly append normal findings:
                      </p>`;

if(code.includes(oldPresetsFull)) {
  code = code.replace(oldPresetsFull, newPresetsFull);
  code = code.replace(
`                        🚀 Fill All Normal Findings
                      </button>
                    </div>
                  </div>`, 
`                        🚀 Fill All Normal Findings
                      </button>
                    </div>
                  </div>
                  </details>`
  );
}


// 4. Investigations Presets
const oldInvestFull = `<div className="flex items-center gap-1.5 border-b pb-2 border-slate-150 dark:border-slate-800">
                  <ClipboardCheck className="w-4.5 h-4.5 text-blue-600" />
                  <span className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Standard JCI/NABH Investigation Panels (Auto-Order Sets)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">`;

const newInvestFull = `<details className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs group mb-4">
                  <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-blue-600" /> Quick Order Sets ▾</div>
                  </summary>
                  <div className="pt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">`;

if(code.includes(oldInvestFull)) {
  code = code.replace(oldInvestFull, newInvestFull);
  
  const endInvestOriginal = `                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigations Ordered Checklist (Extracted from Voice Scribe)  */}`;
  const endInvestReplacement = `                      </span>
                    </button>
                  ))}
                </div>
                </details>
              </div>

              {/* Investigations Ordered Checklist (Extracted from Voice Scribe)  */}`;
              
  code = code.replace(endInvestOriginal, endInvestReplacement);
}


// 5. Sticky Footer
const startFooter = code.indexOf('{/* Sticky Mobile Footer  */}');
if (startFooter > -1) {
  const endFooter = code.indexOf('    </div>\n  );\n}');
  if (endFooter > -1) {
    const newFooter = `{/* Sticky Mobile Footer  */}
      <div className="sticky bottom-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 mt-auto flex items-center justify-between no-print">
        {(() => {
          const order = ["complaints", "primary-survey", "history", "secondary-survey", "investigations", "treatment", "notes", "disposition", "trends", "rounds"];
          const curr = order.indexOf(activeTab);
          const nextId = (curr !== -1 && curr < order.length - 1) ? order[curr + 1] : null;
          const labels: Record<string, string> = {  "complaints": "Complaints",  "primary-survey": "Primary",  "history": "SAMPLE",  "secondary-survey": "Secondary",  "investigations": "Investigations",  "treatment": "Treatment",  "notes": "Notes",  "disposition": "Disposition",  "trends": "Trends",  "rounds": "Rounds"};
          
          return (
            <div className="flex-1 flex justify-start">
              {nextId && (
                <button onClick={() => setActiveTab(nextId as any)} className="px-4 py-2.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold text-[11px] rounded-lg flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                  Next: {labels[nextId]} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })()}
        
        <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs rounded-lg shadow-sm flex items-center gap-2 transition-colors active:scale-[0.98] shrink-0 ml-2">
          <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Save Changes
        </button>
      </div>`;
      
    code = code.substring(0, startFooter) + newFooter + '\n' + code.substring(endFooter);
  }
}

// 6. Generic safe padding & gap replacements across the whole file
// (only target standard tailwind classes, with boundaries)
code = code.replace(/\bp-6\b/g, 'p-4');
code = code.replace(/\bp-8\b/g, 'p-4');
code = code.replace(/\bp-5\b/g, 'p-4');
code = code.replace(/\bgap-6\b/g, 'gap-4');
code = code.replace(/\bspace-y-6\b/g, 'space-y-4');
code = code.replace(/\bspace-y-5\b/g, 'space-y-4');
// Sample History gap-4 -> gap-3
code = code.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-4"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-3"');
code = code.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"');

// 7. Textarea rows 4 and 5 -> 3
code = code.replace(/rows={4}/g, 'rows={3}');
code = code.replace(/rows={5}/g, 'rows={3}');

// 8. Empty States improvements
code = code.replace(/className="p-4 text-center text-slate-400 font-medium"/g, 'className="p-3 text-center text-slate-400 font-medium text-[11px] bg-slate-50/50 dark:bg-slate-900/50"');
code = code.replace(/className="p-3 text-center text-slate-400 font-mono text-\[11px\] bg-white dark:bg-slate-950"/g, 'className="p-3 text-center text-slate-400 font-mono text-[11px] bg-slate-50/50 dark:bg-slate-900/50"');

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
