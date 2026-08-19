const fs = require('fs');
let code = fs.readFileSync('src/components/BoundChatModal.tsx', 'utf-8');

const quickPromptsSection = `        {/* Quick Suggestion Chips */}`;
const replacement = `        {/* Clinical Lenses */}
        {context.type === 'case' && (
          <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
            <span className="text-[10px] font-extrabold uppercase font-mono text-indigo-500 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              7 Lenses:
            </span>
            {[
              { id: "first-principles", label: "First Principles" },
              { id: "devils-advocate", label: "Devil's Advocate" },
              { id: "rare-but-real", label: "Rare but Real" },
              { id: "pathophysiology", label: "Pathophysiology" },
              { id: "guidelines", label: "Guidelines" },
              { id: "disease-snapshot", label: "Disease Snapshot" },
              { id: "full-debrief", label: "Full Debrief" }
            ].map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => {
                  sendMessage(\`Please apply the "\${lens.label}" clinical lens to this case. Challenge clinical heuristics, investigate underlying physiology, and provide an expert debrief.\`);
                }}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium rounded-lg shrink-0 transition-colors cursor-pointer whitespace-nowrap"
              >
                {lens.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick Suggestion Chips */}`;

code = code.replace(quickPromptsSection, replacement);
fs.writeFileSync('src/components/BoundChatModal.tsx', code);
