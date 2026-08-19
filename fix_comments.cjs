const fs = require('fs');

const linesToFix = [
  5643, 5657, 5671, 5707, 5710, 5757, 5794, 5829, 5850, 5890, 5914, 5996, 6065, 6068, 6074, 6140, 6150, 6177, 6230, 6287, 6305, 6361, 6371, 6385, 6397, 6407, 6425, 6449, 6465, 6504, 6537, 6565, 6570, 6583, 6595, 6626, 6659, 6687, 6691, 6734, 6737, 6755, 6795, 6812, 6826, 6840
];

let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8').split('\n');

for (let lineNum of linesToFix) {
  let idx = lineNum - 1;
  if (content[idx] && content[idx].includes('{') && content[idx].includes('}')) {
    content[idx] = content[idx].replace(/\{([^}]+)\}/g, '{/* $1 */}');
  }
}

fs.writeFileSync('src/components/CaseSheetView.tsx', content.join('\n'), 'utf8');
