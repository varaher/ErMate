const fs = require('fs');
const content = fs.readFileSync('src/components/CaseSheetPrintView.tsx', 'utf8');

const target = `          <div className="text-right text-xs font-mono">
            <div className="font-bold">Case ID: {data.caseId}</div>
            <div className="text-[10px] text-slate-500 print:text-black">Confidential Medical Record</div>
          </div>`;

const replacement = `          <div className="text-right text-xs font-mono">
            <div className="font-bold">Case ID: {data.caseId}</div>
            <div className="text-[10px] text-slate-500 print:text-black mt-0.5">Captured: {data.arrival.date || "N/A"} {data.arrival.time || ""}</div>
            <div className="text-[10px] text-slate-500 print:text-black">Confidential Medical Record</div>
          </div>`;

const newContent = content.replace(target, replacement);
fs.writeFileSync('src/components/CaseSheetPrintView.tsx', newContent, 'utf8');
