const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldVoiceSave = `    try {
      const cleanCase = sanitizeForFirestore(newCase);
      await setDoc(doc(db, "cases", newCase.id), cleanCase, { merge: true });
      if (newCase.departmentId) {
        await setDoc(doc(db, "departments", newCase.departmentId, "cases", newCase.id), cleanCase, { merge: true });
      }
    } catch (err: any) {
      console.error("Error saving extracted voice case:", err);
      if (!err?.message?.includes("offline") && !err?.message?.includes("unavailable")) {
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
    }

    setCases(prev => {
      const idx = prev.findIndex(c => c.id === newCase.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newCase;
        return copy;
      }
      return [newCase, ...prev];
    });`;

const newVoiceSave = `    setCases(prev => {
      const idx = prev.findIndex(c => c.id === newCase.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newCase;
        return copy;
      }
      return [newCase, ...prev];
    });

    try {
      const cleanCase = sanitizeForFirestore(newCase);
      await setDoc(doc(db, "cases", newCase.id), cleanCase, { merge: true });
      if (newCase.departmentId) {
        await setDoc(doc(db, "departments", newCase.departmentId, "cases", newCase.id), cleanCase, { merge: true });
      }
    } catch (err: any) {
      console.error("Error saving extracted voice case:", err);
      if (!err?.message?.includes("offline") && !err?.message?.includes("unavailable")) {
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
    }`;

content = content.replace(oldVoiceSave, newVoiceSave);
fs.writeFileSync('src/App.tsx', content);
