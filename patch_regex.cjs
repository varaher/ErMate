const fs = require('fs');

const code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

const oldRegex = 'const isDischargeReq = /(prepare|write|create|generate|draft|make|give|provide).*(discharge summary|discharge note|ds)|(discharge summary|discharge note)/i.test(userInput);';

const newRegex = `const isDischargeReq =
    /\\b(?:prepare|write|create|generate|draft|make|give|provide)\\s+(?:a\\s+|the\\s+)?discharge\\s+(?:summary|note)\\b/i.test(userInput) ||
    /\\bdischarge\\s+(?:summary|note)\\b/i.test(userInput) ||
    /\\b(?:prepare|write|create|generate|draft|make|give|provide)\\s+ds\\b/i.test(userInput) ||
    /^\\s*ds\\s*$/i.test(userInput);`;

if (code.includes(oldRegex)) {
    fs.writeFileSync('server/scribeChatTurn.ts', code.replace(oldRegex, newRegex));
    console.log("Patched successfully");
} else {
    console.log("Old regex not found");
}

// Run tests
const testCasesFalse = [
  "Ultrasound needs to be done.",
  "The child lives with his kids.",
  "Review old records.",
  "Patient has vaginal discharge.",
  "There is purulent ear discharge.",
  "Nasal discharge for 3 days.",
  "Discharge is noted from the wound."
];

const testCasesTrue = [
  "Prepare discharge summary",
  "Generate a discharge summary",
  "Create discharge note",
  "Prepare DS",
  "DS",
  "ds "
];

const testFn = (userInput) => {
    return /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+(?:a\s+|the\s+)?discharge\s+(?:summary|note)\b/i.test(userInput) ||
      /\bdischarge\s+(?:summary|note)\b/i.test(userInput) ||
      /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+ds\b/i.test(userInput) ||
      /^\s*ds\s*$/i.test(userInput);
};

console.log("--- FALSE POSITIVE TESTS ---");
testCasesFalse.forEach(t => console.log(`"${t}" -> ${testFn(t)}`));

console.log("--- TRUE POSITIVE TESTS ---");
testCasesTrue.forEach(t => console.log(`"${t}" -> ${testFn(t)}`));
