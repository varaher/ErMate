const fs = require('fs');
let content = fs.readFileSync("src/components/HandoverView.tsx", "utf8");

// 1. Remove Patient Card
const pattern_remove = /onClick=\{\(\) => setEditableRows\(prev => prev\.filter\(r => r\.id !== row\.id\)\)\}/;
const new_remove = `onClick={() => {
                        setEditableRows(prev => prev.filter(r => r.id !== row.id));
                        const activeDocRef = doc(db, "handover_sheets", "active_shift");
                        updateDoc(activeDocRef, {
                          [\`rows.\${row.id}\`]: deleteField(),
                          rowOrder: arrayRemove(row.id),
                          updatedAt: new Date().toISOString()
                        }).catch(e => console.warn("Row removal failed:", e));
                      }}`;
content = content.replace(pattern_remove, new_remove);

fs.writeFileSync("src/components/HandoverView.tsx", content);
