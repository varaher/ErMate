const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const target = `      aiResponse = await callClaudeSonnetOnly(
        fullPrompt,
        "You are an expert emergency medical scribe specializing in clinical shift handovers. Only return JSON matching the schema with key 'rows'.",
        true
      );
      modelUsed = "claude-3-5-sonnet";`;

const replacement = `      aiResponse = await callClaudeSonnetOnly(
        fullPrompt,
        "You are an expert emergency medical scribe specializing in clinical shift handovers. Only return JSON matching the schema with key 'rows'.",
        true
      );
      if (!aiResponse) throw new Error("Claude Sonnet returned null");
      modelUsed = "claude-3-5-sonnet";`;

const newContent = content.replace(target, replacement);
fs.writeFileSync('server.ts', newContent, 'utf8');
