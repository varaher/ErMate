const fs = require('fs');
const linesStr = fs.readFileSync('lines_to_fix.txt', 'utf8');
const linesToFix = linesStr.split('\n').filter(Boolean).map(Number);
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8').split('\n');

for (let lineNum of linesToFix) {
  let idx = lineNum - 1;
  if (content[idx] && content[idx].includes('{') && content[idx].includes('}')) {
    // Only wrap the first matching { ... } with {/* ... */}
    content[idx] = content[idx].replace(/\{([^}]+)\}/, '{/* $1 */}');
  }
}

fs.writeFileSync('src/components/CaseSheetView.tsx', content.join('\n'), 'utf8');
