const fs = require('fs');
let code = fs.readFileSync('server/sarvamClient.ts', 'utf8');
code = code.replace(/throw new Error\(\`ErMate Voice failed: \$\{response\.status\} - \$\{errorText\}\`\);/g, `
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      }
    } catch(e) {}
    throw new Error(\`ErMate Voice failed: \${parsedMsg}\`);
`);
code = code.replace(/throw new Error\(\`ErMate Voice translate failed: \$\{response\.status\} - \$\{errorText\}\`\);/g, `
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      }
    } catch(e) {}
    throw new Error(\`ErMate Voice Translate failed: \${parsedMsg}\`);
`);
fs.writeFileSync('server/sarvamClient.ts', code);
