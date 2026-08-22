const fs = require('fs');
let content = fs.readFileSync('server/handover.ts', 'utf8');

content = content.replace(
  'diagnosis: "Under evaluation",',
  'diagnosis: "",'
);

content = content.replace(
  /const diagnosis = parsed\.diagnosis \|\| parsed\.provisionalDiagnosis \|\| "Under evaluation";/g,
  'const diagnosis = parsed.diagnosis || parsed.provisionalDiagnosis || "";'
);

fs.writeFileSync('server/handover.ts', content, 'utf8');
