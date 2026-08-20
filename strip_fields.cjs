const fs = require('fs');

const file = 'src/components/CaseSheetView.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const complaintsStart = lines.findIndex(l => l.includes('{activeTab === "complaints" && ('));
const fieldsStart = lines.findIndex((l, i) => i > complaintsStart && l.includes('<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">'));
const fieldsEnd = lines.findIndex((l, i) => i > fieldsStart && l.includes('<div className="pt-2">') && lines[i+2].includes('Presenting Chief Complaint'));

if (fieldsStart === -1 || fieldsEnd === -1) {
  console.log("Could not find fields to strip", { fieldsStart, fieldsEnd });
  process.exit(1);
}

lines.splice(fieldsStart, fieldsEnd - fieldsStart);

fs.writeFileSync(file, lines.join('\n'));
console.log("Stripped demographic fields from complaints tab successfully.");
