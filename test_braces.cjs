const fs = require('fs');
const file = 'src/components/CaseSheetView.tsx';
let content = fs.readFileSync(file, 'utf8');

let depth = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') depth++;
  if (content[i] === '}') depth--;
}
console.log("Brace depth:", depth);

let pDepth = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '(') pDepth++;
  if (content[i] === ')') pDepth--;
}
console.log("Paren depth:", pDepth);
