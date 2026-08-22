const fs = require('fs');
let content = fs.readFileSync("src/components/HandoverView.tsx", "utf8");

// We need to patch the one around line 2138
const pattern_2138 = /setEditableRows\(prev => \{\s*const exists = prev\.some\(r => r\.id === newTableRow\.id\);\s*if \(exists\) return prev\.map\(r => r\.id === newTableRow\.id \? \{ \.\.\.r, \.\.\.newTableRow \} : r\);\s*return \[newTableRow, \.\.\.prev\];\s*\}\);/;
const new_2138 = `setEditableRows(prev => {
          const exists = prev.some(r => r.id === newTableRow.id);
          const updated = exists ? prev.map(r => r.id === newTableRow.id ? { ...r, ...newTableRow } : r) : [newTableRow, ...prev];
          
          const activeDocRef = doc(db, "handover_sheets", "active_shift");
          if (exists) {
            updateDoc(activeDocRef, {
              [\`rows.\${newTableRow.id}\`]: newTableRow,
              updatedAt: new Date().toISOString()
            }).catch(e => console.warn("Row update failed:", e));
          } else {
            const updatedOrder = [newTableRow.id, ...prev.map(r => r.id)];
            setDoc(activeDocRef, {
              rows: { [newTableRow.id]: newTableRow },
              rowOrder: updatedOrder,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(e => console.warn("Row add failed:", e));
          }
          return updated;
        });`;

content = content.replace(pattern_2138, new_2138);

fs.writeFileSync("src/components/HandoverView.tsx", content);
