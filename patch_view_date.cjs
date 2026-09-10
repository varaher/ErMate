const fs = require('fs');
const content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const target = `                  <p className="text-[10px] text-slate-400 font-mono">
                    {currentCase.patient.name} · UHID: {currentCase.patient.uhid || "N/A"} · Case ID: {currentCase.id}
                  </p>`;

const replacement = `                  <p className="text-[10px] text-slate-400 font-mono">
                    {currentCase.patient.name} · UHID: {currentCase.patient.uhid || "N/A"} · Case ID: {currentCase.id}
                    <br />Captured: {currentCase.createdAt ? new Date(currentCase.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                  </p>`;

const newContent = content.replace(target, replacement);
fs.writeFileSync('src/components/CaseSheetView.tsx', newContent, 'utf8');
