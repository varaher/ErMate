const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');
code = code.replace('\\n  const [activeTab', '\n  const [activeTab');
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
