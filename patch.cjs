const fs = require('fs');
let code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

code = code.replace(
  /async function runExtraction\(\s*deidentifiedInput: string,\s*patientAgeYears: number \| null,\s*callExtractionModel: any\s*\)/,
  `async function runExtraction(
  deidentifiedInput: string,
  patientAgeYears: number | null,
  existingCaseSheet: any,
  callExtractionModel: any
)`
);

fs.writeFileSync('server/scribeChatTurn.ts', code);
console.log("Patched!");
