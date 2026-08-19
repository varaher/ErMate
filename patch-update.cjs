const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

code = code.replace(
  /await updateDoc\(doc\(db, 'chatSessions', sessionId\), \{/g,
  "updateDoc(doc(db, 'chatSessions', sessionId), {"
);

code = code.replace(
  /await updateDoc\(parentRef, \{/g,
  "updateDoc(parentRef, {"
);

fs.writeFileSync('src/hooks/useBoundChat.ts', code);
console.log("Patched updateDoc awaits");
