const fs = require('fs');
let code = fs.readFileSync('src/services/scribeChatStorage.ts', 'utf8');

code = code.replace(
  /export async function updateChatMessage/,
  `import { doc, updateDoc } from "firebase/firestore";\nexport async function updateChatMessage`
);
code = code.replace(
  /const { doc, updateDoc } = require\("firebase\/firestore"\);\n    /,
  ""
);

fs.writeFileSync('src/services/scribeChatStorage.ts', code);
console.log("Patched storage 2");
