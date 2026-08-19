const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

const target = `      let newDocId = \`session_\${Date.now()}\`;
      if (db) {
        try {
          const docRef = await addDoc(collection(db, 'chatSessions'), {
            ...newSessionData,
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          });
          newDocId = docRef.id;
        } catch (err) {
          console.warn('[BoundChat] Firestore session creation fallback:', err);
        }
      }`;

const replacement = `      let newDocId = \`session_\${Date.now()}\`;
      if (db) {
        try {
          const docRef = doc(collection(db, 'chatSessions'));
          newDocId = docRef.id;
          setDoc(docRef, {
            ...newSessionData,
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          }).catch(err => {
            console.warn('[BoundChat] Firestore session creation fallback:', err);
          });
        } catch (err) {
          console.warn('[BoundChat] Firestore session creation fallback:', err);
        }
      }`;

if (code.includes(target)) {
  fs.writeFileSync('src/hooks/useBoundChat.ts', code.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Target not found!");
}
