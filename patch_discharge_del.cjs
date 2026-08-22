const fs = require('fs');
let content = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");

const match = `        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsDiscussModalOpen(true)}`;

const replacement = `        <div className="flex gap-2">
          {onDeleteCase && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(\`Are you sure you want to delete the case for "\${currentCase.patient.name}"? This action cannot be undone.\`)) {
                  onDeleteCase(currentCase.id);
                  onBack();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold rounded-lg transition-all cursor-pointer"
              title="Delete Case"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDiscussModalOpen(true)}`;

content = content.replace(match, replacement);

fs.writeFileSync("src/components/DischargeSummaryView.tsx", content);
console.log("Patched DischargeSummaryView delete top button");
