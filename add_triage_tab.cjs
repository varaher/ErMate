const fs = require('fs');
const file = 'src/components/CaseSheetView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '{\n              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },',
  '{\n              { id: "triage", label: "Triage & Vitals", icon: Activity },\n              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },'
);

fs.writeFileSync(file, content);
console.log("Added Triage tab back");
