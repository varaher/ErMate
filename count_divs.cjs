const fs = require('fs');
const code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');
const codeClean = code.replace(/<div[^>]*\/>/g, match => match.replace(/[^\n]/g, ' '));
let depth = 0;
let currentLine = 1;
for (let i = 0; i < codeClean.length; i++) {
  if (codeClean[i] === '\n') currentLine++;
  if (codeClean.substr(i, 4) === '<div' && (codeClean[i+4] === ' ' || codeClean[i+4] === '>' || codeClean[i+4] === '\n' || codeClean[i+4] === '\r')) {
    depth++;
  } else if (codeClean.substr(i, 6) === '</div>') {
    depth--;
  }
  if (currentLine === 5277 && codeClean[i] === '\n') {
      console.log("DEPTH AT 5277:", depth);
  }
  if (currentLine === 5547 && codeClean[i] === '\n') {
      console.log("DEPTH AT 5547:", depth);
  }
}
