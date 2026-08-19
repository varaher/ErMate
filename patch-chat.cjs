const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

// Fix 1: Add .catch() to the updateDoc in sendMessage
code = code.replace(
  /updateDoc\(doc\(db, 'chatSessions', sessionId\), \{\s*messages: finalMessages,\s*lastMessageAt: serverTimestamp\(\),\s*pendingUpdates: suggestedUpdate \|\| null,\s*\}\);/,
  `updateDoc(doc(db, 'chatSessions', sessionId), {
            messages: finalMessages,
            lastMessageAt: serverTimestamp(),
            pendingUpdates: suggestedUpdate || null,
          }).catch(e => console.warn('[BoundChat] Firestore update doc promise rejection:', e));`
);

// Fix 2: Remove composite index requirement from query
const targetQuery = `        const q = query(
          collection(db, 'chatSessions'),
          where('contextType', '==', context.type),
          where('contextId', '==', context.id),
          where('createdBy', '==', currentUserUid),
          orderBy('lastMessageAt', 'desc'),
          limit(1)
        );`;

const replacementQuery = `        // Simplified query to bypass Firestore composite index requirements
        const q = query(
          collection(db, 'chatSessions'),
          where('contextId', '==', context.id)
        );`;

code = code.replace(targetQuery, replacementQuery);

// Fix 2 part B: Sort and filter client-side
const targetSnap = `        if (snap && !snap.empty) {
          const sessionDoc = snap.docs[0];
          setSessionId(sessionDoc.id);
          const data = sessionDoc.data();
          setMessages(data.messages || []);
          if (data.pendingUpdates) {
            setPendingUpdates(data.pendingUpdates);
          }
          setLoading(false);
          return;
        }`;

const replacementSnap = `        if (snap && !snap.empty) {
          // Filter and sort client-side to avoid needing a composite index
          const validDocs = snap.docs
            .filter(d => d.data().createdBy === currentUserUid && d.data().contextType === context.type)
            .sort((a, b) => {
              const timeA = a.data().lastMessageAt?.toMillis?.() || new Date(a.data().createdAt || 0).getTime();
              const timeB = b.data().lastMessageAt?.toMillis?.() || new Date(b.data().createdAt || 0).getTime();
              return timeB - timeA;
            });

          if (validDocs.length > 0) {
            const sessionDoc = validDocs[0];
            setSessionId(sessionDoc.id);
            const data = sessionDoc.data();
            setMessages(data.messages || []);
            if (data.pendingUpdates) {
              setPendingUpdates(data.pendingUpdates);
            }
            setLoading(false);
            return;
          }
        }`;

code = code.replace(targetSnap, replacementSnap);

fs.writeFileSync('src/hooks/useBoundChat.ts', code);
console.log("Patched BoundChat fixes");
