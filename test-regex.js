const tests = [
  "Prepare discharge summary",
  "Generate a discharge summary",
  "Create discharge note",
  "Prepare DS",
  "DS",
  "Previous discharge summary showed pneumonia",
  "Old discharge note mentions CKD",
  "Reviewed outside hospital discharge summary"
];

tests.forEach(t => {
  const isDischargeReq =
    /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+(?:a\s+|the\s+)?discharge\s+(?:summary|note)\b/i.test(t) ||
    /^\s*discharge\s+(?:summary|note)\s*$/i.test(t) ||
    /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+ds\b/i.test(t) ||
    /^\s*ds\s*$/i.test(t);
  console.log(`"${t}": ${isDischargeReq}`);
});
