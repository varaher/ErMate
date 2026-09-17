const fs = require('fs');
const lines = fs.readFileSync('src/components/DashboardView.tsx', 'utf8').split('\n');

// 1039 is <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono"> (my replacement)
// 1391 is <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono"> (original)

const newLines = [...lines.slice(0, 1038), ...lines.slice(1390)];
fs.writeFileSync('src/components/DashboardView.tsx', newLines.join('\n'));
console.log("Reverted to original.");
