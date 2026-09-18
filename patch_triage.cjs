const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /      createdBy: createdByUid,\n      createdByName:/;

const newContent = `      createdBy: createdByUid,
      createdByUid: auth.currentUser?.uid || createdByUid,
      createdByName:`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/App.tsx', content);
