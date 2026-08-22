const fs = require('fs');
let content = fs.readFileSync("src/components/DashboardView.tsx", "utf8");

const pattern = /<\/div>\s*\}\)\s*<\/div>\s*\{\(\(\) => \{/;
const replacement = `</div>
              )}
              
              {onDeleteAllCases && (
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete ALL cases in ErMate? This action cannot be undone.")) {
                      onDeleteAllCases();
                    }
                  }}
                  className="ml-auto px-3 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm shrink-0"
                  title="Clear All Shift Cases"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Cases
                </button>
              )}
            </div>

            {(() => {`;

content = content.replace(pattern, replacement);
fs.writeFileSync("src/components/DashboardView.tsx", content);
