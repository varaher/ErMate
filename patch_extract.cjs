const fs = require('fs');
let content = fs.readFileSync('server/extraction.ts', 'utf8');
content = content.replace(
  'const complaintStr = structuredComplaint || text.slice(0, 180) + (text.length > 180 ? "..." : "");',
  'const complaintStr = structuredComplaint || text;'
);
fs.writeFileSync('server/extraction.ts', content, 'utf8');
