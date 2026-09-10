const fs = require('fs');
const content = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const target = `                            <div className="flex gap-4 text-[10px] text-slate-400 font-mono pt-1 flex-wrap">
                              <span>Age: {c.patient.age}y</span>`;

const replacement = `                            <div className="flex gap-4 text-[10px] text-slate-400 font-mono pt-1 flex-wrap">
                              <span>Captured: {c.createdAt ? new Date(c.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                              <span>Age: {c.patient.age}y</span>`;

const newContent = content.replace(target, replacement);
fs.writeFileSync('src/components/DashboardView.tsx', newContent, 'utf8');
