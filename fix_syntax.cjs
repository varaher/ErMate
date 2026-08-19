const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const brokenBlock = `                });
              }
            }
          }
            }).catch(e => console.warn("Background invite check failed:", e));`;

const fixedBlock = `                });
              }
            }
          }).catch(e => console.warn("Background invite check failed:", e));`;

content = content.replace(brokenBlock, fixedBlock);
fs.writeFileSync('src/App.tsx', content);
