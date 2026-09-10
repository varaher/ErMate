const fs = require('fs');
const content = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const target = `const timeoutId = setTimeout(() => controller.abort(), 35000);`;
const replacement = `const timeoutId = setTimeout(() => controller.abort(), 120000);`; // increase to 2 minutes

const newContent = content.replace(target, replacement);
fs.writeFileSync('src/components/VoiceScribeChatView.tsx', newContent, 'utf8');
