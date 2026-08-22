const fs = require('fs');
let content = fs.readFileSync("src/components/CasesListView.tsx", "utf8");

const replacement = `<button
                      onClick={() => {
                        if (window.confirm(\`Are you sure you want to delete the case for "\${c.patient.name}"? This action cannot be undone.\`)) {
                          onDeleteCase(c.id);
                        }
                      }}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                      title="Archived/Delete"
                    >`;

const match = `<button
                      onClick={() => onDeleteCase(c.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                      title="Archived/Delete"
                    >`;

if (content.includes(match)) {
  content = content.replace(match, replacement);
  fs.writeFileSync("src/components/CasesListView.tsx", content);
  console.log("Replaced successfully in CasesListView");
} else {
  console.log("Could not find match in CasesListView");
}
