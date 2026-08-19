const fs = require('fs');
let code = fs.readFileSync('src/services/scribeChatStorage.ts', 'utf8');

code = code.replace(
  /id: data\.id \|\| doc\.id,/,
  `id: data.id || doc.id,\n        docId: doc.id,`
);

fs.writeFileSync('src/services/scribeChatStorage.ts', code);
console.log("Patched storage");
