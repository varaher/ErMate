const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /      createdByUid: previousCase \? previousCase\.createdByUid : \(auth\.currentUser\?\.uid \|\| undefined\),\n      createdByUid: previousCase\?\.createdByUid \|\| updatedCase\.createdByUid \|\| auth\.currentUser\?\.uid,/;

const newContent = `      createdByUid: previousCase ? previousCase.createdByUid : (auth.currentUser?.uid || undefined),`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/App.tsx', content);
