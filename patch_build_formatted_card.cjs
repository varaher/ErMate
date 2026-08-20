const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');

// I'll define a replacement for the `buildFormattedCard` logic.
// We need it to use `includeRawNotesInExport`.

const oldCardPattern = "return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n1. BED NO + NAME: ${r.bed} · ${r.name}   ${r.ageGender} · ${r.erNo || ''} · ${r.doctor || ''} · ${r.stayDuration || ''}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n2. INITIAL ASSESSMENT & CHRONOLOGICAL NOTES (Oldest → Newest):\\n${r.chronologicalNotes || 'No notes logged'}\\n\\n   PRESENTING COMPLAINT:\\n${r.complaints}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n3. PAST MEDICAL HISTORY:\\n${r.history}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n4. PROVISIONAL DIAGNOSIS & ASSESSMENT:\\n${r.assessment}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n5. MANAGEMENT PLAN:\\n   [DONE ✓]\\n${r.planDone}\\n\\n   [TO BE DONE □]\\n${r.planToBeDone}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n6. BYSTANDER UPDATE & VITALS:\\n   [Bystander]: ${r.bystander}\\n   [Vitals]: ${r.vitals || 'Logged'}\\n${r.alerts ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n⚠ CRITICAL ALERTS: ${r.alerts}\\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;";

const newCardPattern = `const chronoSection = includeRawNotesInExport ? \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n2. RAW CHRONOLOGICAL NOTES (Oldest → Newest):\\n\${r.chronologicalNotes || 'No notes logged'}\\n\` : '';
                  return \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n1. BED NO + NAME: \${r.bed} · \${r.name}   \${r.ageGender} · \${r.erNo || ''} · \${r.doctor || ''} · \${r.stayDuration || ''}\\n\${chronoSection}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n2. PRESENTING COMPLAINT:\\n\${r.complaints}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n3. PAST MEDICAL HISTORY:\\n\${r.history}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n4. PROVISIONAL DIAGNOSIS & ASSESSMENT:\\n\${r.assessment}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n5. MANAGEMENT PLAN:\\n   [DONE ✓]\\n\${r.planDone}\\n\\n   [TO BE DONE □]\\n\${r.planToBeDone}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n6. BYSTANDER UPDATE & VITALS:\\n   [Bystander]: \${r.bystander}\\n   [Vitals]: \${r.vitals || 'Logged'}\\n\${r.alerts ? \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n⚠ CRITICAL ALERTS: \${r.alerts}\\n\` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\`;`;

// Notice the newline handling might be slightly different in the source file. I will use regex to be safe.
const targetRegex = /const buildFormattedCard = \(r: HandoverTableRow, idx: number\) => {[\s\S]*?return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n1\. BED NO[\s\S]*?━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;\n\s*};/g;

const replacementBlock = `const buildFormattedCard = (r: HandoverTableRow, idx: number) => {
                  const chronoSection = includeRawNotesInExport ? \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n2. RAW CHRONOLOGICAL NOTES (Oldest → Newest):\\n\${r.chronologicalNotes || 'No notes logged'}\\n\` : '';
                  return \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n1. BED NO + NAME: \${r.bed} · \${r.name}   \${r.ageGender} · \${r.erNo || ''} · \${r.doctor || ''} · \${r.stayDuration || ''}\\n\${chronoSection}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n2. PRESENTING COMPLAINT:\\n\${r.complaints}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n3. PAST MEDICAL HISTORY:\\n\${r.history}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n4. PROVISIONAL DIAGNOSIS & ASSESSMENT:\\n\${r.assessment}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n5. MANAGEMENT PLAN:\\n   [DONE ✓]\\n\${r.planDone}\\n\\n   [TO BE DONE □]\\n\${r.planToBeDone}\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n6. BYSTANDER UPDATE & VITALS:\\n   [Bystander]: \${r.bystander}\\n   [Vitals]: \${r.vitals || 'Logged'}\\n\${r.alerts ? \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n⚠ CRITICAL ALERTS: \${r.alerts}\\n\` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\`;
                };`;

content = content.replace(targetRegex, replacementBlock);

fs.writeFileSync('src/components/HandoverView.tsx', content, 'utf8');
console.log('Update successful');
