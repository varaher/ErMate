const fs = require('fs');
let code = fs.readFileSync('src/utils/caseHelper.ts', 'utf8');
code = code.replace(/export function generateUHID[\s\S]*?}/, 
`export function generateUHID(dailyCaseCount?: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const count = String(dailyCaseCount !== undefined ? dailyCaseCount + 1 : Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  return \`\${yy}\${mm}\${dd}\${count}\`;
}`);
fs.writeFileSync('src/utils/caseHelper.ts', code);
