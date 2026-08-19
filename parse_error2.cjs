const fs = require('fs');
let code = fs.readFileSync('server/sarvamClient.ts', 'utf8');
code = code.replace(/throw new Error\(\`ErMate document parse failed: \$\{response\.status\} - \$\{errorText\}\`\);/g, `
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(\`ErMate Document Parse failed: \${parsedMsg}\`);
`);
code = code.replace(/throw new Error\(\`ErMate translation failed: \$\{response\.status\} - \$\{errorText\}\`\);/g, `
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(\`ErMate Translation failed: \${parsedMsg}\`);
`);
fs.writeFileSync('server/sarvamClient.ts', code);
