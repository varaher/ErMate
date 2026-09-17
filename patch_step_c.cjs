const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Remove "Export + Finalize Actions Toolbar" completely
// It starts at: {/* Export + Finalize Actions Toolbar (End of Workflow)  */}
// And ends at the closing div before {/* 2. Document Scanning Modal Simulation  */} or the end of that block.
const toolbarStart = `{/* Export + Finalize Actions Toolbar (End of Workflow)  */}`;
const startIndex = code.indexOf(toolbarStart);

if (startIndex !== -1) {
  // Find the end of this block
  // The block is:
  // <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 no-print mb-4">
  // It ends before `{/* 2. Document Scanning Modal Simulation  */}`
  const nextSectionIndex = code.indexOf(`{/* 2. Document Scanning Modal Simulation  */}`, startIndex);
  if (nextSectionIndex !== -1) {
    code = code.substring(0, startIndex) + code.substring(nextSectionIndex);
  }
}

// 2. Replace the dropdown menu in the header
const originalDropdownRegex = /<div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1\.5 text-xs">[\s\S]*?<\/details>/;

const newDropdown = `<div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 text-xs">
                  <button onClick={() => onNavigateToDischarge(currentCase.id)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-3.5 h-3.5" /> Discharge Summary
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export</div>
                  <button onClick={handleCopyCaseSheet} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" /> Copy to EMR
                  </button>
                  <button onClick={() => onViewPrintSheet ? onViewPrintSheet(currentCase.id) : setShowPdfModal(true)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5" /> View PDF
                  </button>
                  <button onClick={handleDownloadCaseSheet} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button onClick={() => triggerPrintWithTip()} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Case Actions</div>
                  <button onClick={async () => { await handleSave(); onBack(); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" /> Finish & Return to Cases
                  </button>
                </div>
              </details>`;

code = code.replace(originalDropdownRegex, newDropdown);

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
