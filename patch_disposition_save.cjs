const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// Find the disposition save block and remove it
const dispositionSaveStart = '<div className="bg-blue-50/60 dark:bg-slate-900/60 border border-blue-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">';
const dispositionSaveEnd = 'View Case Sheet PDF\n                    </button>\n                  </div>';

const startIndex = code.indexOf(dispositionSaveStart);
const endIndex = code.indexOf(dispositionSaveEnd);

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex + dispositionSaveEnd.length);
}

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
