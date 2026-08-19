const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8').split('\n');

const linesToFix = [5138, 5180, 6092, 6258, 6271, 6481, 6547, 6869];

for (let lineNum of linesToFix) {
  let idx = lineNum - 1;
  content[idx] = content[idx].replace(/\{([^}]+)\}/, '{/* $1 */}');
}

fs.writeFileSync('src/components/CaseSheetView.tsx', content.join('\n'), 'utf8');
