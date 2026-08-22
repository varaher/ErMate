const fs = require('fs');
let content = fs.readFileSync("src/components/HandoverView.tsx", "utf8");

const pattern_onrecord = /setEditableRows\(prev => prev\.map\(r => \{\s*if \(r\.id !== row\.id\) return r;\s*return \{\s*\.\.\.r,\s*\.\.\.\(updatedFields\.diagnosis \? \{ assessment: updatedFields\.diagnosis \} : \{\}\),\s*\.\.\.\(updatedFields\.toBeDone \? \{ planToBeDone: Array\.isArray\(updatedFields\.toBeDone\) \? updatedFields\.toBeDone\.join\('\\n'\) : updatedFields\.toBeDone \} : \{\}\),\s*\.\.\.\(updatedFields\.done \? \{ planDone: Array\.isArray\(updatedFields\.done\) \? updatedFields\.done\.join\('\\n'\) : updatedFields\.done \} : \{\}\),\s*\.\.\.\(updatedFields\.alertRow \? \{ alerts: updatedFields\.alertRow \} : \{\}\)\s*\};\s*\}\)\);/;

const new_onrecord = `setEditableRows(prev => {
          const updated = prev.map(r => {
            if (r.id !== row.id) return r;
            return {
              ...r,
              ...(updatedFields.diagnosis ? { assessment: updatedFields.diagnosis } : {}),
              ...(updatedFields.toBeDone ? { planToBeDone: Array.isArray(updatedFields.toBeDone) ? updatedFields.toBeDone.join('\\n') : updatedFields.toBeDone } : {}),
              ...(updatedFields.done ? { planDone: Array.isArray(updatedFields.done) ? updatedFields.done.join('\\n') : updatedFields.done } : {}),
              ...(updatedFields.alertRow ? { alerts: updatedFields.alertRow } : {})
            };
          });
          const modifiedRow = updated.find(r => r.id === row.id);
          if (modifiedRow) {
            const activeDocRef = doc(db, "handover_sheets", "active_shift");
            updateDoc(activeDocRef, {
              [\`rows.\${row.id}\`]: modifiedRow,
              updatedAt: new Date().toISOString()
            }).catch(e => console.warn("Row update failed:", e));
          }
          return updated;
        });`;

content = content.replace(pattern_onrecord, new_onrecord);

fs.writeFileSync("src/components/HandoverView.tsx", content);
