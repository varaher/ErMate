const fs = require('fs');
let code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

// Replace the fallback assignment of extractionMessage to null
code = code.replace(
  /updatedCaseSheetFields = null;\n\s*extractionMessage = null as any;/,
  `updatedCaseSheetFields = null;
      extractionMessage = {
        id: "ext-err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "Could not extract structured data from this entry. You can add it manually to the Case Sheet.",
      };`
);

// We need to see why mapExtractionToCaseSheetFields returns {} for this input
// Let's modify runExtraction to log
code = code.replace(
  /const updatedFields = mapExtractionToCaseSheetFields\(cleaned, raw, existingCaseSheet\);/,
  `const updatedFields = mapExtractionToCaseSheetFields(cleaned, raw, existingCaseSheet);
  console.log("[scribeChatTurn] RAW:", JSON.stringify(raw));
  console.log("[scribeChatTurn] CLEANED:", JSON.stringify(cleaned));
  console.log("[scribeChatTurn] UPDATED FIELDS:", JSON.stringify(updatedFields));`
);

fs.writeFileSync('server/scribeChatTurn.ts', code);
console.log("Patched scribeChatTurn.ts");
