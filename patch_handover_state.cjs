const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');

if (!content.includes('const [includeRawNotesInExport, setIncludeRawNotesInExport]')) {
  content = content.replace(
    'const [hospitalName, setHospitalName] = useState',
    'const [includeRawNotesInExport, setIncludeRawNotesInExport] = useState(false);\n  const [hospitalName, setHospitalName] = useState'
  );
}

const toggleHtml = `
            <label className="flex items-center gap-2 cursor-pointer no-print ml-4">
              <input 
                type="checkbox" 
                checked={includeRawNotesInExport} 
                onChange={(e) => setIncludeRawNotesInExport(e.target.checked)} 
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Include Raw EMR Notes in Print/Export</span>
            </label>
`;

const actionWrapperTarget = `<div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">`;
const actionWrapperTargetRegex = /<div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">[\s\S]*?<div className="flex flex-wrap items-center gap-2">/;

// I'll just inject the label next to the export buttons.
const exportButtonsDiv = `<div className="flex flex-wrap items-center gap-2">`;
if (content.includes(exportButtonsDiv) && !content.includes('Include Raw EMR Notes')) {
  content = content.replace(
    exportButtonsDiv,
    exportButtonsDiv + toggleHtml
  );
}

// Ensure chronologicalNotes has conditional print:hidden based on state!
// Right now it is hardcoded to "print-section print:hidden".
const chronoDivTarget = `<div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 print-section print:hidden">`;
if (content.includes(chronoDivTarget)) {
  content = content.replace(
    chronoDivTarget,
    `<div className={\`p-3 bg-slate-50/50 dark:bg-slate-900/30 print-section \${!includeRawNotesInExport ? 'print:hidden' : ''}\`}>`
  );
} else {
  console.log("Could not find hardcoded print:hidden div");
}

fs.writeFileSync('src/components/HandoverView.tsx', content, 'utf8');
console.log('Update successful');
