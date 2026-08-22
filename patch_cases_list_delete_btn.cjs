const fs = require('fs');
let content = fs.readFileSync("src/components/CasesListView.tsx", "utf8");

const pattern = /<button\s*onClick=\{\(\) => onStartQuickCase\(\)\}[\s\S]*?>\s*Quick Case\s*<\/button>/;
const replacement = `<button
            onClick={() => onStartQuickCase()}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all"
          >
            Quick Case
          </button>
          {onDeleteAllCases && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to delete ALL cases in ErMate? This action cannot be undone.")) {
                  onDeleteAllCases();
                }
              }}
              className="px-4 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-sm"
              title="Delete All Cases"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}`;

content = content.replace(pattern, replacement);
fs.writeFileSync("src/components/CasesListView.tsx", content);
