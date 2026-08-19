const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

code = code.replace(
  `const assistantMsg = {
            role: 'assistant',`,
  `const assistantMsg: ChatMessage = {
            role: 'assistant',`
);

fs.writeFileSync('src/hooks/useBoundChat.ts', code);
console.log("Patched type error");
