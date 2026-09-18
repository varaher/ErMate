const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /      createdBy: \(updatedCase as any\)\.createdBy \|\| auth\.currentUser\?\.uid,/;

const newContent = `      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      createdByUid: previousCase ? previousCase.createdByUid : (auth.currentUser?.uid || undefined),`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/App.tsx', content);
