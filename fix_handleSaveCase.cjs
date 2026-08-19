const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// For handleTriageSubmit
content = content.replace(
`    try {
      await setDoc(doc(db, "cases", newCase.id), sanitizeForFirestore(newCase));
    } catch (err: any) {
      console.error("Error saving triaged case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    setCases(prev => [newCase, ...prev.filter(c => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setActiveFormMode(null);
    checkConsentOnCaseSaved();`,
`    setCases(prev => [newCase, ...prev.filter(c => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setActiveFormMode(null);
    checkConsentOnCaseSaved();

    try {
      await setDoc(doc(db, "cases", newCase.id), sanitizeForFirestore(newCase));
    } catch (err: any) {
      console.error("Error saving triaged case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }`
);

// For handleSaveCase
const oldSaveCase = `    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave));
      
      // Determine changed fields`;
const newSaveCase = `    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });

    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave));
      
      // Determine changed fields`;

content = content.replace(oldSaveCase, newSaveCase);

const oldSetCasesEnd = `      await setDoc(addendumRef, auditLog);
    } catch (err: any) {
      console.error("Error saving case or audit trail:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });
    checkConsentOnCaseSaved();`;
const newSetCasesEnd = `      await setDoc(addendumRef, auditLog);
    } catch (err: any) {
      console.error("Error saving case or audit trail:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    checkConsentOnCaseSaved();`;
content = content.replace(oldSetCasesEnd, newSetCasesEnd);

fs.writeFileSync('src/App.tsx', content);
