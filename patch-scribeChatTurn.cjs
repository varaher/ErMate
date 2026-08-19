const fs = require('fs');
let code = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');

// 1. Update runExtraction call to pass existingCaseSheet
code = code.replace(
  /runExtraction\(deidentifiedInput, patientAgeYears, helpers\.callExtractionModel\),/,
  'runExtraction(deidentifiedInput, patientAgeYears, existingCaseSheet, helpers.callExtractionModel),'
);

// 2. Update runExtraction signature
code = code.replace(
  /async function runExtraction\(\n  deidentifiedInput: string,\n  patientAgeYears: number \| null,\n  callExtractionModel: any\)/,
  `async function runExtraction(
  deidentifiedInput: string,
  patientAgeYears: number | null,
  existingCaseSheet: any,
  callExtractionModel: any)`
);

// 3. Pass existingCaseSheet to mapExtractionToCaseSheetFields
code = code.replace(
  /const updatedFields = mapExtractionToCaseSheetFields\(cleaned, raw\);/,
  'const updatedFields = mapExtractionToCaseSheetFields(cleaned, raw, existingCaseSheet);'
);

// 4. Update mapExtractionToCaseSheetFields signature
code = code.replace(
  /function mapExtractionToCaseSheetFields\(\n  cleaned: ReturnType<typeof cleanExtractionOutput>,\n  raw: any\): Record<string, any> \{/,
  `function mapExtractionToCaseSheetFields(
  cleaned: ReturnType<typeof cleanExtractionOutput>,
  raw: any,
  existingCaseSheet: any
): Record<string, any> {`
);

// 5. Update mapExtractionToCaseSheetFields implementation
const newMapLogic = `
function mapExtractionToCaseSheetFields(
  cleaned: ReturnType<typeof cleanExtractionOutput>,
  raw: any,
  existingCaseSheet: any
): Record<string, any> {
  const fields: Record<string, any> = {};
  const isValidStr = (s: any) => typeof s === 'string' && s.trim().length > 0 && !["unknown", "not specified", "not documented", "n/a", "none"].includes(s.trim().toLowerCase());

  if (isValidStr(raw.patientName)) fields.patientName = raw.patientName;
  if (raw.age !== undefined && raw.age !== null && raw.age !== "") fields.age = raw.age;
  
  if (isValidStr(raw.sex)) fields.gender = raw.sex;
  else if (isValidStr(raw.gender)) fields.gender = raw.gender;

  if (isValidStr(raw.chiefComplaint)) fields.presentingComplaint = raw.chiefComplaint;
  else if (isValidStr(raw.presentingComplaint)) fields.presentingComplaint = raw.presentingComplaint;

  if (raw.vitals && typeof raw.vitals === 'object') {
    const filteredVitals: any = {};
    let hasRealVitals = false;
    for (const [k, v] of Object.entries(raw.vitals)) {
      if (v !== null && v !== undefined && v !== "" && String(v).toLowerCase() !== "unknown" && String(v).toLowerCase() !== "n/a") {
        filteredVitals[k] = v;
        hasRealVitals = true;
      }
    }
    
    if (hasRealVitals) {
      fields.vitals = filteredVitals;
    } else if (cleaned.signsSymptoms.length > 0 || cleaned.events.length > 0 || cleaned.drugs.length > 0 || isValidStr(raw.patientName)) {
      // If no vitals were dictated, but there is real clinical content (symptoms, drugs, events, or a new patient name),
      // we provide normal baseline vitals so that clicking "Copy" defaults to normal vitals.
      fields.vitals = { hr: 75, bp: "120/80", spo2: 98, rr: 16, temp: 98.6, gcs: 15 };
    }
  }

  if (cleaned.drugs.length > 0) fields.treatmentGiven = cleaned.drugs;
  if (cleaned.events.length > 0) {
    fields.chronologicalNotes = cleaned.events.map(e => ({
      timestamp: e.time || new Date().toISOString(),
      entry: e.description,
    }));
  }

  if (cleaned.signsSymptoms.length > 0) fields.symptoms = cleaned.signsSymptoms;
  if (cleaned.plan.length > 0) fields.plan = cleaned.plan;
  if (cleaned.labs.length > 0) fields.labs = cleaned.labs;

  if (raw.isPediatric !== undefined && raw.isPediatric !== null) fields.isPediatric = raw.isPediatric;
  if (raw.pediatricDetails && Object.keys(raw.pediatricDetails).length > 0) {
    const filteredPed: any = {};
    for (const [k, v] of Object.entries(raw.pediatricDetails)) { 
      if (isValidStr(v) || typeof v === 'boolean') filteredPed[k] = v;
    }
    if (Object.keys(filteredPed).length > 0) fields.pediatricDetails = filteredPed;
  }

  // --- Normal Findings / Exam Defaults Logic ---
  // Only apply defaults if this is a substantial clinical update
  const hasSubstance = isValidStr(raw.chiefComplaint) || isValidStr(raw.presentingComplaint) || 
                       isValidStr(raw.hpi) || cleaned.signsSymptoms.length > 0 || 
                       cleaned.events.length > 0 || cleaned.drugs.length > 0 || isValidStr(raw.patientName);

  // ABCDE
  if (isValidStr(raw.airway)) fields.airway = raw.airway;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.airway) && !isValidStr(existingCaseSheet?.primaryAirway)) fields.airway = "Patent and self-maintained.";

  if (isValidStr(raw.breathing)) fields.breathing = raw.breathing;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.breathing) && !isValidStr(existingCaseSheet?.primaryBreathing)) fields.breathing = "Bilateral air entry equal, no increased work of breathing. RR normal.";

  if (isValidStr(raw.circulation)) fields.circulation = raw.circulation;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.circulation) && !isValidStr(existingCaseSheet?.primaryCirculation)) fields.circulation = "Peripheral pulses palpable, CRT < 2 secs. No active bleeding.";

  if (isValidStr(raw.disability)) fields.disability = raw.disability;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.disability) && !isValidStr(existingCaseSheet?.primaryDisability)) fields.disability = "GCS 15/15. Pupils bilaterally equal and reactive to light.";

  if (isValidStr(raw.exposure)) fields.exposure = raw.exposure;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.exposure) && !isValidStr(existingCaseSheet?.primaryExposure)) fields.exposure = "No obvious external injuries, rash, or deformities. Normothermic.";

  // Secondary Survey / General Exam
  const secSurvey = existingCaseSheet?.secondarySurvey || {};
  let updatedSecSurvey = false;

  if (isValidStr(raw.generalExamination)) { secSurvey.general = raw.generalExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(existingCaseSheet?.generalExamination) && !isValidStr(secSurvey.general)) { secSurvey.general = "Conscious, oriented. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."; updatedSecSurvey = true; }

  if (isValidStr(raw.cvsExamination)) { secSurvey.cvs = raw.cvsExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.cvs)) { secSurvey.cvs = "S1 S2 heard. No murmurs."; updatedSecSurvey = true; }

  if (isValidStr(raw.respiratoryExamination)) { secSurvey.respiratory = raw.respiratoryExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.respiratory)) { secSurvey.respiratory = "Bilateral air entry equal. No added sounds."; updatedSecSurvey = true; }

  if (isValidStr(raw.abdomenExamination)) { secSurvey.abdomen = raw.abdomenExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.abdomen)) { secSurvey.abdomen = "Soft, non-tender. No organomegaly. Normal bowel sounds."; updatedSecSurvey = true; }

  if (isValidStr(raw.cnsExamination)) { secSurvey.cns = raw.cnsExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.cns)) { secSurvey.cns = "Moving all four limbs. No focal neurological deficit."; updatedSecSurvey = true; }

  if (updatedSecSurvey) fields.secondarySurvey = secSurvey;

  // Allergies & PMH
  if (isValidStr(raw.allergies)) fields.allergies = raw.allergies;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.allergies)) fields.allergies = "No Known Drug Allergies (NKDA)";

  if (isValidStr(raw.pmh)) fields.pastMedicalHistory = raw.pmh;
  else if (isValidStr(raw.pastMedicalHistory)) fields.pastMedicalHistory = raw.pastMedicalHistory;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.pastMedicalHistory)) fields.pastMedicalHistory = "No significant past medical history reported.";
  
  if (isValidStr(raw.outpatientMedications)) fields.currentMedications = Array.isArray(raw.outpatientMedications) ? raw.outpatientMedications : [raw.outpatientMedications];
  else if (hasSubstance && (!existingCaseSheet?.currentMedications || existingCaseSheet?.currentMedications?.length === 0)) fields.currentMedications = [];

  return fields;
}
`;

// Replace the entire function
const fnStart = code.indexOf('function mapExtractionToCaseSheetFields');
const fnEnd = code.indexOf('function buildUnifiedReplyProse');
code = code.substring(0, fnStart) + newMapLogic + code.substring(fnEnd);

fs.writeFileSync('server/scribeChatTurn.ts', code);
console.log("Patched scribeChatTurn.ts mapExtractionToCaseSheetFields!");
