const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

const regex = /\/\/ Trigger automatic AI summary generation asynchronously[\s\S]*?\}, 500\);/;
const timeoutBlock = code.match(regex)[0];

code = code.replace(regex, ''); // remove it from here

const insertionPoint = `      localStorage.setItem(
        \`ermate_chat_session_\${context.type}_\${context.id}\`,
        JSON.stringify({ id: newDocId, messages: [welcomeMsg] })
      );`;

code = code.replace(insertionPoint, insertionPoint + '\n\n' + timeoutBlock);

fs.writeFileSync('src/hooks/useBoundChat.ts', code);
console.log("Fixed setTimeout ordering");
