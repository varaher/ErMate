const fs = require('fs');
let content = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");

const topMatch = `<button
                type="button"
                onClick={() => setShowScanModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                Scan Document
              </button>`;

const topReplacement = topMatch + `
              {onDeleteCase && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(\`Are you sure you want to delete the case for "\${currentCase.patient.name}"? This action cannot be undone.\`)) {
                      onDeleteCase(currentCase.id);
                      onBack();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  title="Delete Case"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Case
                </button>
              )}`;

content = content.replace(topMatch, topReplacement);

const bottomMatch = `<button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Save Draft</span>
              </button>`;

const bottomReplacement = bottomMatch + `
              {onDeleteCase && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(\`Are you sure you want to delete the case for "\${currentCase.patient.name}"? This action cannot be undone.\`)) {
                      onDeleteCase(currentCase.id);
                      onBack();
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Case</span>
                </button>
              )}`;

content = content.replace(bottomMatch, bottomReplacement);

fs.writeFileSync("src/components/CaseSheetView.tsx", content);
console.log("Patched CaseSheetView");
