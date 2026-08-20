const fs = require('fs');
const file = 'src/components/CaseSheetView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add currentCase.patient.name after back button
const backBtnMatch = 'Resume Dictation\n              </button>\n            )}';
if (content.includes(backBtnMatch)) {
  const insertText = `\n            <div className="flex items-center gap-2">\n              <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate max-w-[200px]">\n                {currentCase.patient.name || "UNNAMED PATIENT"}\n              </span>\n              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">\n                {currentCase.patient.age || "N/A"}y • {currentCase.patient.gender?.charAt(0) || "U"}\n              </span>\n            </div>`;
  // check if not already inserted
  if (!content.includes('UNNAMED PATIENT')) {
    content = content.replace(backBtnMatch, backBtnMatch + insertText);
  }
}

// 2. Move MLC Warning Card to triage tab
const mlcStartStr = '{/* MLC WARNING CARD (From user screenshot: Yellow Medico-Legal Warning Header) */}';
const saveBannerStr = '{/* Save Confirmed Banner */}';

const mlcStartIdx = content.indexOf(mlcStartStr);
const mlcEndIdx = content.indexOf(saveBannerStr);

if (mlcStartIdx !== -1 && mlcEndIdx !== -1) {
  // Check if it's already in triage tab.
  // Wait, the triage tab marker is `{activeTab === "triage" && (\n            <div className="space-y-6 animate-fade-in">`
  const triageTabMarker = '{activeTab === "triage" && (\\n            <div className="space-y-6 animate-fade-in">';
  // Let's just find the index of triage tab
  const triageIdx = content.indexOf('activeTab === "triage"');
  
  if (mlcStartIdx < triageIdx) { // It is BEFORE the tabs, meaning it needs to be moved!
    const mlcCode = content.slice(mlcStartIdx, mlcEndIdx).trim();
    content = content.slice(0, mlcStartIdx) + content.slice(mlcEndIdx);
    
    const insertTriageMarker = '{activeTab === "triage" && (\\n            <div className="space-y-6 animate-fade-in">';
    // Let's find exactly
    const insertTargetStr = '{activeTab === "triage" && (\n            <div className="space-y-6 animate-fade-in">';
    const insertIdx = content.indexOf(insertTargetStr);
    
    if (insertIdx !== -1) {
      const insertionPoint = insertIdx + insertTargetStr.length;
      content = content.slice(0, insertionPoint) + '\n              ' + mlcCode + '\n' + content.slice(insertionPoint);
    }
  }
}

// 3. Remove Demographics & Registration Details from disposition tab
const demoStartStr = '              <div>\n                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">\n                  <User className="w-4 h-4 text-blue-500" />\n                  Demographics & Registration Details\n                </h3>';
const demoStartIdx = content.indexOf(demoStartStr);
const nabhStartStr = '{/* NABH Mandated Disposition & Log Panel */}';
const demoEndIdx = content.indexOf(nabhStartStr);

if (demoStartIdx !== -1 && demoEndIdx !== -1) {
  content = content.slice(0, demoStartIdx) + content.slice(demoEndIdx);
}

fs.writeFileSync(file, content);
console.log("Fixes applied.");
