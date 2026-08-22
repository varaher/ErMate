const fs = require('fs');
let content = fs.readFileSync("src/components/HandoverView.tsx", "utf8");

const pattern_restore = /setEditableRows\(prev => \{\s*const exists = prev\.some\(r => r\.id === restoredTableRow\.id\);\s*if \(exists\) return prev\.map\(r => r\.id === restoredTableRow\.id \? \{ \.\.\.r, \.\.\.restoredTableRow \} : r\);\s*return \[restoredTableRow, \.\.\.prev\];\s*\}\);/;
const new_restore = `setEditableRows(prev => {
                                        const exists = prev.some(r => r.id === restoredTableRow.id);
                                        const updated = exists ? prev.map(r => r.id === restoredTableRow.id ? { ...r, ...restoredTableRow } : r) : [restoredTableRow, ...prev];
                                        
                                        const activeDocRef = doc(db, "handover_sheets", "active_shift");
                                        if (exists) {
                                          updateDoc(activeDocRef, {
                                            [\`rows.\${restoredTableRow.id}\`]: restoredTableRow,
                                            updatedAt: new Date().toISOString()
                                          }).catch(e => console.warn("Row update failed:", e));
                                        } else {
                                          const updatedOrder = [restoredTableRow.id, ...prev.map(r => r.id)];
                                          setDoc(activeDocRef, {
                                            rows: { [restoredTableRow.id]: restoredTableRow },
                                            rowOrder: updatedOrder,
                                            updatedAt: new Date().toISOString()
                                          }, { merge: true }).catch(e => console.warn("Row add failed:", e));
                                        }
                                        return updated;
                                      });`;

content = content.replace(pattern_restore, new_restore);

fs.writeFileSync("src/components/HandoverView.tsx", content);
