const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const syncCode = `
      // Add audit log to addenda subcollection
      const addendumId = "add-" + Math.floor(100000 + Math.random() * 900000);
      const addendumRef = doc(db, "cases", caseToSave.id, "addenda", addendumId);
      const auditLog = {
        id: addendumId,
        type: "edit",
        editedBy: editUid,
        editedByName: editName,
        editedByRole: editRole,
        fieldsChanged: changedKeys.length > 0 ? changedKeys : ["caseData"],
        previousValues: prevVals,
        newValues: newValData,
        addedAt: new Date().toISOString(),
        addedBy: editUid // for rules create constraint
      };
      await setDoc(addendumRef, auditLog);

      // Phase 3A: Trusted Logbook Snapshot Service
      // Sync logbook for UID attribution
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          await fetch("/api/logbook/sync-case", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": \`Bearer \${idToken}\`
            },
            body: JSON.stringify({ caseId: caseToSave.id })
          }).catch(err => console.warn("Logbook sync failed silently", err));
        }
      } catch (syncErr) {
        console.warn("Logbook sync encountered error", syncErr);
      }
`;

content = content.replace(
  /\/\/ Add audit log to addenda subcollection([\s\S]*?)await setDoc\(addendumRef, auditLog\);/,
  syncCode
);

fs.writeFileSync('src/App.tsx', content);
