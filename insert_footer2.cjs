const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const tabsArr = `["complaints", "primary-survey", "history", "secondary-survey", "investigations", "treatment", "notes", "disposition", "trends", "rounds"]`;
const tabsLabels = `{
  "complaints": "Complaints",
  "primary-survey": "Primary",
  "history": "SAMPLE",
  "secondary-survey": "Secondary",
  "investigations": "Investigations",
  "treatment": "Treatment",
  "notes": "Notes",
  "disposition": "Disposition",
  "trends": "Trends",
  "rounds": "Rounds"
}`;

const footerCode = `
      {/* Sticky Mobile Footer  */}
      <div className="sticky bottom-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 mt-auto flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] no-print">
        <button onClick={handleSave} className="px-4 py-2 sm:px-5 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors active:scale-[0.98]">
          <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Save Changes
        </button>
        {(() => {
          const order = ${tabsArr};
          const curr = order.indexOf(activeTab);
          const nextId = (curr !== -1 && curr < order.length - 1) ? order[curr + 1] : null;
          const labels: Record<string, string> = ${tabsLabels};
          if (!nextId) return null;
          return (
            <button onClick={() => setActiveTab(nextId as any)} className="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] sm:text-xs rounded-xl flex items-center gap-2 transition-colors active:scale-[0.98]">
              Next: {labels[nextId]} <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          );
        })()}
      </div>

      {/* Interactive UI Screen Close  */}
`;

code = code.replace('{/* Interactive UI Screen Close  */}', footerCode);

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
console.log("Inserted footer!");
