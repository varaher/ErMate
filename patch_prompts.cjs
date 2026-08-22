const fs = require('fs');

// Patch dischargeSummary.ts
let content = fs.readFileSync('server/dischargeSummary.ts', 'utf8');
content = content.replace(
  'Format: "DM × 6y · HTN · CAD\\nSurgical: ..."',
  'Format: "DM × 6y · HTN · CAD\\nSurgical: Appendectomy 2010"'
);
fs.writeFileSync('server/dischargeSummary.ts', content, 'utf8');

// Patch aiDiagnosis.ts
let aiContent = fs.readFileSync('server/aiDiagnosis.ts', 'utf8');
aiContent = aiContent.replace(
  '"course_in_hospital": "Detailed chronological narrative...",',
  '"course_in_hospital": "Detailed chronological narrative of the stay. Include all full details without truncation.",'
);
fs.writeFileSync('server/aiDiagnosis.ts', aiContent, 'utf8');
