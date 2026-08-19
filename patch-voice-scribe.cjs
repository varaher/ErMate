const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

// Ensure that unappliedExtraction is mapped back onto the component properly
code = code.replace(
  /unappliedExtraction: fieldsToExtract && Object\.keys\(fieldsToExtract\)\.length > 0 \? JSON\.parse\(JSON\.stringify\(fieldsToExtract\)\) : undefined,/,
  `unappliedExtraction: fieldsToExtract && Object.keys(fieldsToExtract).length > 0 ? JSON.parse(JSON.stringify(fieldsToExtract)) : undefined,`
);

// Actually, wait, let's look at how the app saves extraction messages in local state
code = code.replace(
  /extractionApplied: false,/,
  `extractionApplied: false,`
);

// The problem might be how setMessages is combining the two messages.
code = code.replace(
  /const aiMsg: Message = \{\n\s*id: \`ai-\$\{Date\.now\(\)\}\`,\n\s*sender: "ai",\n\s*text: data\.reply/,
  `const aiMsg: Message = {
        id: data.extractionMessage?.id || data.reasoningMessage?.id || \`ai-\${Date.now()}\`,
        sender: "ai",
        text: data.reply`
);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log("Patched VoiceScribeChatView.tsx!");
