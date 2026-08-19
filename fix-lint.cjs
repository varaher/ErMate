const fs = require('fs');

let secCode = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');
secCode = secCode.replace(
  'const key = match[1] as keyof typeof fields;',
  'const key = match[1] as string;'
);
secCode = secCode.replace(
  'for (const [k, v] of Object.entries(updated)) {',
  'for (const [k, v] of Object.entries(updated) as [string, string][]) {'
);
fs.writeFileSync('src/components/SecondarySurveySection.tsx', secCode);

let dsCode = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf8');
dsCode = dsCode.replace(
  'currentUser.displayName',
  'currentUser.name'
);
fs.writeFileSync('src/components/DischargeSummaryView.tsx', dsCode);
