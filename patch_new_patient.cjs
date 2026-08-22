const fs = require('fs');
let content = fs.readFileSync("src/components/HandoverView.tsx", "utf8");

const pattern_new_patient = /onClick=\{\(\) => \{\s*const newId = `custom-\$\{Date\.now\(\)\}`;[\s\S]*?\}\]\);\s*\}\}/;
const new_new_patient = `onClick={() => {
              const newId = \`custom-\${Date.now()}\`;
              setEditableRows(prev => {
                const newRow = {
                  id: newId,
                  bed: \`Bed \${prev.length + 1}\`,
                  name: "New Patient",
                  ageGender: "Age/Sex",
                  complaints: "Presenting complaints details...",
                  history: "Nil documented",
                  assessment: "Provisional diagnosis...",
                  planDone: "Vitals logged.\\nLabs/Imaging done.",
                  planToBeDone: "Pending orders...",
                  bystander: "Counselled."
                };
                
                const activeDocRef = doc(db, "handover_sheets", "active_shift");
                // Here we need to append newId to rowOrder. Since we don't read rowOrder first, we can do setDoc with arrayUnion if we only had rowOrder, but we need to set the map too.
                // We'll just do updateDoc. Wait, updateDoc allows adding a new field to a map. But how to append to rowOrder array without reading it?
                // Wait! We can use arrayUnion from firestore! We don't have arrayUnion imported. Let's add it.
                // Wait, I can just use setDoc with merge: true for the whole thing, using prev state.
                const updatedOrder = [...prev.map(r => r.id), newId];
                setDoc(activeDocRef, {
                  rows: { [newId]: newRow },
                  rowOrder: updatedOrder,
                  updatedAt: new Date().toISOString()
                }, { merge: true }).catch(e => console.warn("Row add failed:", e));

                return [...prev, newRow];
              });
            }}`;

content = content.replace(pattern_new_patient, new_new_patient);
fs.writeFileSync("src/components/HandoverView.tsx", content);
