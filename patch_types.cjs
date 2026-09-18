const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

const regex = /  ownerUid\?: string \| null;/;

const newContent = `  ownerUid?: string | null;
  createdByUid?: string;`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/types.ts', content);
