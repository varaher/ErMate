const fs = require('fs');

const file = 'src/components/CaseSheetView.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const profileStart = lines.findIndex(l => l.includes('Patient Profile Brief Card'));
const saveBannerStart = lines.findIndex(l => l.includes('Save Confirmed Banner'));

if (profileStart === -1 || saveBannerStart === -1) {
  console.log("Could not find boundaries", { profileStart, saveBannerStart });
  process.exit(1);
}

// Find where to insert it. Inside `activeTab === "triage" && (`
const triageTabStart = lines.findIndex(l => l.includes('{activeTab === "triage" && ('));

if (triageTabStart === -1) {
  console.log("Could not find triage tab");
  process.exit(1);
}

// Extract
const extracted = lines.splice(profileStart, saveBannerStart - profileStart);

// Now the triageTabStart index will have shifted!
const newTriageInsertIdx = lines.findIndex(l => l.includes('{activeTab === "triage" && (')) + 2;

lines.splice(newTriageInsertIdx, 0, ...extracted);

fs.writeFileSync(file, lines.join('\n'));
console.log("Moved Demographics & Vitals to Triage tab successfully.");
