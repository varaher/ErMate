const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const dispSearchStart = `              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  Demographics & Registration Details
                </h3>`;
const dispSearchEnd = `              {/* NABH Mandated Disposition & Log Panel  */}`;

let startIdx = code.indexOf(dispSearchStart);
let endIdx = code.indexOf(dispSearchEnd);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + code.substring(endIdx);
  fs.writeFileSync('src/components/CaseSheetView.tsx', code);
  console.log("Successfully removed Demographics from Disposition.");
} else {
  console.log("Still could not find it. startIdx:", startIdx, "endIdx:", endIdx);
}
