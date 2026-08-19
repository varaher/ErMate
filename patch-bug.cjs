const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

code = code.replace(
  /const assistantMsg: ChatMessage = \{[\s\S]*?timestamp: new Date\(\)\.toISOString\(\)[\s\S]*?\};/,
  `const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
          };`
);

fs.writeFileSync('src/hooks/useBoundChat.ts', code);
console.log("Patched potential syntax error");
