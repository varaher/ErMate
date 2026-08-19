const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetPrintView.tsx', 'utf8');

code = code.replace(
  '<p className="text-sm font-medium">{data.presentingComplaint || <EmptyLine />}</p>',
  '<div className="text-sm font-medium">{data.presentingComplaint || <EmptyLine />}</div>'
);

code = code.replace(
  '<p className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || <EmptyLine />}</p>',
  '<div className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || <EmptyLine />}</div>'
);

fs.writeFileSync('src/components/CaseSheetPrintView.tsx', code);
console.log("Patched CaseSheetPrintView successfully!");
