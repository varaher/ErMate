const fs = require('fs');

let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

content = content.replace(
  'setActiveTab(initialCase.isPediatric ? "pediatrics-sheet" : "history");',
  'setActiveTab(initialCase.isPediatric ? "pediatrics-sheet" : "complaints");'
);

fs.writeFileSync('src/components/CaseSheetView.tsx', content, 'utf8');
console.log("Fixed activeTab initialization");
