const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');

// Add the state variable
content = content.replace(
  'const [hospitalName, setHospitalName] = useState',
  'const [includeRawNotesInExport, setIncludeRawNotesInExport] = useState(false);\n  const [hospitalName, setHospitalName] = useState'
);

// Add the toggle switch to the UI Action Bar
const actionBarStr = `<div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">`;
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
// Let's find a good place for the toggle. There's a div with buttons for print/export.
// I'll search for the print button block.
