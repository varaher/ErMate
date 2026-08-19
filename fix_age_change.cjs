const fs = require('fs');

let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// The replacement logic:
const oldStr = `                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : 0;
                          setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, age: val }, isPediatric: recomputeIsPediatric(val) }));
                        }}`;
                        
const newStr = `                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : 0;
                          const newIsPeds = recomputeIsPediatric(val);
                          setCurrentCase(prev => {
                            if (newIsPeds && !prev.isPediatric) {
                              setTimeout(() => setActiveTab("pediatrics-sheet"), 0);
                            } else if (!newIsPeds && prev.isPediatric && activeTab === "pediatrics-sheet") {
                              setTimeout(() => setActiveTab("complaints"), 0);
                            }
                            return { ...prev, patient: { ...prev.patient, age: val }, isPediatric: newIsPeds };
                          });
                        }}`;

content = content.replace(oldStr, newStr);

// There's another one at 2324:
const oldStr2 = `                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : 0;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, age: val }, isPediatric: recomputeIsPediatric(val) }));
                      }}`;
                      
const newStr2 = `                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : 0;
                        const newIsPeds = recomputeIsPediatric(val);
                        setCurrentCase(prev => {
                          if (newIsPeds && !prev.isPediatric) {
                            setTimeout(() => setActiveTab("pediatrics-sheet"), 0);
                          }
                          return { ...prev, patient: { ...prev.patient, age: val }, isPediatric: newIsPeds };
                        });
                      }}`;
                      
content = content.replace(oldStr2, newStr2);

fs.writeFileSync('src/components/CaseSheetView.tsx', content, 'utf8');
