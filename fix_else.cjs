const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

const brokenIndex = lines.findIndex(l => l.includes('          }).catch(e => console.warn("Background invite check failed:", e));'));

if (brokenIndex !== -1) {
    // Insert '          }' right below it
    lines.splice(brokenIndex + 1, 0, '          }');
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
