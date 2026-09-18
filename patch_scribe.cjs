const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /      createdBy: existingMatch\?\.createdBy \|\| createdByUid,/;

const newContent = `      createdBy: existingMatch?.createdBy || createdByUid,
      createdByUid: existingMatch ? existingMatch.createdByUid : auth.currentUser?.uid,`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/App.tsx', content);
