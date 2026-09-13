const fs = require('fs');
let code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

const helpers = `
function deepMergeExtraction(base: any, incoming: any): any {
  const result = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === undefined || val === "") continue;
    const existing = result[key];
    if (Array.isArray(val)) {
      result[key] = Array.isArray(existing) ? [...existing, ...val] : val;
    } else if (typeof val === "object") {
      result[key] = (existing && typeof existing === "object" && !Array.isArray(existing))
        ? deepMergeExtraction(existing, val)
        : val;
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getMergedPendingExtraction(chatHistory: any[], existingCaseSheet: any): any {
  let merged = { ...existingCaseSheet };
  for (const msg of chatHistory) {
    // Both extractionData and unappliedExtraction are preserved from frontend
    const ext = msg.extractionData || msg.unappliedExtraction;
    if (msg.sender === "ai" && ext) {
      merged = deepMergeExtraction(merged, ext);
    }
  }
  return merged;
}

// ── Main orchestrator — call this on every chat turn ────────────────`;

code = code.replace('// ── Main orchestrator — call this on every chat turn ────────────────', helpers);

// Now update `processScribeChatTurn` to use `mergedPendingExtraction`
const oldCall = `  // Run extraction and clinical reasoning IN PARALLEL — independent
  // failures, independent models, independent fallback chains.
  const [extractionResult, reasoningResult] = await Promise.allSettled([
    runExtraction(deidentifiedInput, patientAgeYears, existingCaseSheet, helpers.callExtractionModel),
    runClinicalReasoning(deidentifiedInput, existingCaseSheet, chatHistory, helpers.callClinicalReasoningModel),
  ]);`;

const newCall = `  const mergedPendingExtraction = getMergedPendingExtraction(chatHistory, existingCaseSheet);
  const effectiveAgeYears = patientAgeYears || mergedPendingExtraction.age || mergedPendingExtraction?.patient?.age || null;

  // Run extraction and clinical reasoning IN PARALLEL — independent
  // failures, independent models, independent fallback chains.
  const [extractionResult, reasoningResult] = await Promise.allSettled([
    runExtraction(deidentifiedInput, effectiveAgeYears, mergedPendingExtraction, helpers.callExtractionModel),
    runClinicalReasoning(deidentifiedInput, mergedPendingExtraction, chatHistory, helpers.callClinicalReasoningModel),
  ]);`;

code = code.replace(oldCall, newCall);

const oldHasAge = `      const ageAlreadyKnown =
        (existingCaseSheet as any)?.age ??
        (existingCaseSheet as any)?.patient?.age;
      const ageFromProp = patientAgeYears;
      const hasAge =
        (ageFromThisTurn !== undefined && ageFromThisTurn !== null && String(ageFromThisTurn).trim() !== "") ||
        (ageAlreadyKnown !== undefined && ageAlreadyKnown !== null && String(ageAlreadyKnown).trim() !== "") ||
        (ageFromProp !== undefined && ageFromProp !== null && String(ageFromProp).trim() !== "");
      if (!hasAge) ageQuestionNeeded = true;`;

const newHasAge = `      const ageAlreadyKnown =
        (mergedPendingExtraction as any)?.age ??
        (mergedPendingExtraction as any)?.patient?.age;
      const ageFromProp = patientAgeYears;
      const hasAge =
        (ageFromThisTurn !== undefined && ageFromThisTurn !== null && String(ageFromThisTurn).trim() !== "") ||
        (ageAlreadyKnown !== undefined && ageAlreadyKnown !== null && String(ageAlreadyKnown).trim() !== "") ||
        (ageFromProp !== undefined && ageFromProp !== null && String(ageFromProp).trim() !== "");
      if (!hasAge) ageQuestionNeeded = true;`;

code = code.replace(oldHasAge, newHasAge);

fs.writeFileSync('server/scribeChatTurn.ts', code);
console.log('Patched scribeChatTurn.ts');
