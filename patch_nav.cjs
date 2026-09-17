const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

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
                  className={\`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors shrink-0 whitespace-nowrap \${
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
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
