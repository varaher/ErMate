const fs = require('fs');
let content = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

const target = `  if (reasonMsg.type === "clinical-reasoning") {
    text += \`\${reasonMsg.content}\\n\\n\`;
    if (reasonMsg.clinicalReasoning?.differentials?.length) {`;

const replacement = `  if (extMsg.type === "voice-extraction") {
    text += "✅ Case sheet extracted and saved.\\n\\n";
  }
  
  if (reasonMsg.type === "clinical-reasoning") {
    text += \`\${reasonMsg.content}\\n\\n\`;
    if (reasonMsg.clinicalReasoning?.differentials?.length) {`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log("Updated AI reply prose");
} else {
  console.log("Failed to find target");
}

fs.writeFileSync('server/scribeChatTurn.ts', content, 'utf8');
