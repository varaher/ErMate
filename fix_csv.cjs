const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

code = code.replace(
  '<td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>', 
  '<td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{item.testName}</td>'
);

code = code.replace(/handleRemoveInvestigation/g, 'handleDeleteInvestigation');

if (!code.includes('Droplets,')) {
  code = code.replace('Activity,', 'Activity, Droplets,');
}

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
