import fs from 'fs';
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');
content = content.replace('ArrowLeft, Save, Sparkles', 'ArrowLeft, ArrowRight, MoreVertical, Save, Sparkles');
fs.writeFileSync('src/components/CaseSheetView.tsx', content);
console.log("Fixed imports");
