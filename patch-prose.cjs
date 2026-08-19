const fs = require('fs');
let code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

// Replace the buildUnifiedReplyProse function to not include the list
code = code.replace(
  /if \(extMsg && extMsg\.type === "extraction-confirmation".*?text \+= "\\n";\n  \}/s,
  `// Extracted details are rendered natively by the UI card, so we don't duplicate them in the markdown prose.`
);

fs.writeFileSync('server/scribeChatTurn.ts', code);
console.log("Patched scribeChatTurn.ts prose");
