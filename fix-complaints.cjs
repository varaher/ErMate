const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const regex = /<div className="bg-slate-50 dark:bg-slate-900\/50 p-5 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">[\s\S]*?<div className="pt-2">/;

code = code.replace(regex, `<div className="bg-slate-50 dark:bg-slate-900/50 p-5 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">
                <div className="pt-2">`);
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
