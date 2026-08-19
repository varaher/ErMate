const fs = require('fs');
const content = fs.readFileSync('src/data/guide.ts', 'utf8');

// Quick and dirty parser
const regex = /title:\s*"(.*?)",\s*badge:\s*"(.*?)",\s*content:\s*\`([\s\S]*?)\`/g;
let match;
let md = "# ErMate User Guide\n\n";

while ((match = regex.exec(content)) !== null) {
  const title = match[1];
  const badge = match[2];
  const body = match[3];
  
  md += `## ${title}\n`;
  if (badge) {
    md += `*Category: ${badge}*\n\n`;
  }
  md += `${body.trim()}\n\n---\n\n`;
}

console.log(md);
