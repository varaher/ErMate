const fs = require('fs');
let code = fs.readFileSync('src/services/scribeChatStorage.ts', 'utf8');

code = code.replace(
  /await addDoc\(messagesRef, \{\n\s*\.\.\.message,\n\s*serverTimestamp: serverTimestamp\(\), \/\/ for reliable ordering even with clock skew\n\s*\}\);/,
  `// Firestore addDoc throws on undefined values. Strip them out.
    const cleanMessage = JSON.parse(JSON.stringify(message));
    
    await addDoc(messagesRef, {
      ...cleanMessage,
      serverTimestamp: serverTimestamp(),
    });`
);

fs.writeFileSync('src/services/scribeChatStorage.ts', code);
console.log("Patched scribeChatStorage.ts!");
