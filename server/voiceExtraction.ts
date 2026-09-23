import OpenAI from 'openai';

import Anthropic from '@anthropic-ai/sdk';

import { deidentifyText } from './deidentify.ts';

import { buildChecklistPromptSection } from './caseSheetChecklist.ts';

import { detectClinicalNormalcy, NORMAL_EXAM_TEMPLATES, isNormalOnlySectionValue } from './clinicalLanguageNormalizer.ts';

 

export const VOICE_EXTRACTION_PROMPT = `

You are a clinical data extraction engine for Indian Emergency Departments.

 

CRITICAL — READ FIRST:

The doctor will dictate patient details in this typical pattern:

"Patient name is [NAME], [AGE] year old [male/female], presented with [COMPLAINT]"

OR in Malayalam/Hindi/Tamil/Telugu/Kannada mixed:

"[NAME] chekkan/chechi, [AGE] vayassu, [COMPLAINT] aanu"

OR just clinical details without a name:

"57 year old female, fever since 3 days" (name not mentioned → patientName = null)

 

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIELD EXTRACTION — EXACT RULES

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 

patientName:

  A proper noun ONLY — the patient's name.

  Examples: "Selvarani", "Mini Unnikrishnan", "Mohammed", "Siya", "Varghese KC", "Sreejith"

  

  NEVER put symptoms or complaints here.

  NEVER put age or vitals here.

  NEVER put "fever cough cold" or "breathlessness" or "acute onset" here.

  If name is not explicitly mentioned as a person's proper name → null.

  

  Indian names to recognise:

  Male: Rajesh, Suresh, Mohammed, Arun, Krishnan, Thomas, Jacob, Sreejith,

        Varghese, Manoj, Sanjay, Rajan, Vinod, Rahul, Anoop, Gokul, Jose

  Female: Selvarani, Mini, Siya, Meena, Saramma, Anitha, Priya, Rekha, Latha,

          Beena, Sheela, Mary, Elizabeth, Fathima, Divya, Lakshmi, Reshma

 

age:

  A NUMBER only (or number string).

  Format: "57" or "38" or "5"

  Extract from "57 year old female" → age: "57"

  

  NEVER put patient name here.

  NEVER put symptoms here.

  If not explicitly mentioned → null.

 

sex:

  "Male" | "Female" | "Unknown"

  From "male/female/M/F/chekkan/chechi/man/woman"

 

chiefComplaint:

  The medical reason for coming.

  Symptoms + duration.

  Example: "Fever, cough, cold × 3 days" or "Breathlessness × 4 days, pedal edema"

  

  NEVER put patient name here.

  NEVER put age here.

  This is SYMPTOMS ONLY.

 

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIELD SEPARATION IS CRITICAL:

  patientName    = person's name (proper noun only)

  age            = number (years)

  sex            = Male/Female (Extract strictly from: male, female, boy, girl, male child, female child, man, woman. Do NOT infer from name or ambiguous pronouns alone).

  chiefComplaint = main symptoms / duration

  

  These are FOUR DIFFERENT fields.

  NEVER merge them.

  NEVER put symptoms in name.

  NEVER put name in complaint.

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 

symptoms (History of Present Illness):

  Genuine patient symptoms/complaints ONLY (e.g. pain, nausea, breathlessness).

  Clinical narrative paragraph. Expand what doctor said into a proper HPI.

  Use ONLY what was dictated.

  

  NEVER put vitals, airway, breathing, circulation, GCS, or physical examination findings here.

  If objective findings are dictated, put them in their respective ABCDE, vitals, or examination fields.

  NEVER generate:

  "Acute symptom onset prior to arrival"

  "Patient presented to ED for evaluation"

  "Events Leading Up to Presentation"

  "Progressive discomfort"

  Any text doctor did not say.

  If not dictated → ""

 

events (Preceding Events / Precipitating Event):

  ONLY for explicit precipitating events:

  Road traffic accidents, falls, physical trauma/injuries, assault, burns, drowning,

  snake bite, animal bite, insect sting, poisoning, ingestion, overdose, exertional onset,

  or recent surgical procedure when clearly stated.

  

  For medical cases (e.g. fever, pediatric fever, cough, cold, viral illness, non-traumatic chest/abdominal pain)

  with NO explicit precipitating event:

  events MUST BE "" (empty string) or null.

  NEVER invent an Event.

  Do NOT put fever duration, symptoms, or presentation details into events.

 

pastMedicalHistory:

  Conditions mentioned by doctor (e.g. "Diabetes, Hypertension").

  If none mentioned → null.

  NEVER assume NKDA or no PMH unless stated.

 

medications:

  Map Indian brand → generic:

  Ecosprin → Aspirin

  Brilinta → Ticagrelor

  Glycomet → Metformin

  Duolin → Ipratropium+Salbutamol

  Budecort → Budesonide

  Calpol → Paracetamol

  Ompras/Pan → Omeprazole/Pantoprazole

  Aug → Amoxicillin-Clavulanate

  Levipil → Levetiracetam

  Tonact → Atorvastatin

  Prolomet → Metoprolol

  Combiflam → Ibuprofen+Paracetamol

  [] if none mentioned.

 

  ROUTE VALIDATION RULES:

  - If medication starts with "Tab." or "Cap." or "Syr." → route MUST BE "Oral", NEVER "IV".

  - If medication starts with "Inj." → route MUST BE "IV" or "IM".

  - Do NOT create duplicate medication entries for generic vs brand names (e.g., deduplicate Omeprazole & Inj. Omeprazole).

 

vitals:

  ONLY if doctor mentioned specific values.

  NEVER assume or default vitals.

  null for any not mentioned.

  TEMPERATURE UNIT RULES:

  - If value is 35.0-38.5 → unit is °C (e.g., 37.0°C).

  - If value is 95.0-104.0 → unit is °F (e.g., 98.6°F).

  - If value is 37 without unit → assume 37.0°C (98.6°F). NEVER write 37.0°F.

VBG / ABG EXTRACTION:

  If the doctor dictates blood gas values (pH, PCO2, PO2, HCO3, base excess,

  lactate, sodium, potassium), extract each component that was actually

  stated. Say explicitly whether it was called a "VBG" or "ABG" if the

  doctor names it; otherwise null.

  NEVER invent or estimate a value not stated.

  Return null for the whole vbg object if no blood gas values were dictated at all.

 

   Return as:

  "vbg": {

    "type": "VBG" | "ABG" | null,

    "ph": string | null,

    "pco2": string | null,

    "po2": string | null,

    "hco3": string | null,

    "be": string | null,

    "lactate": string | null,

    "na": string | null,

    "k": string | null,

    "cl": string | null

  }

  or null if not done. Include "cl" (chloride) whenever stated.

CLINICAL LANGUAGE / SHORTHAND NORMALIZATION:

  Doctors may use Indian-ED shorthand or casual/slang wording. Interpret the clinical intent, not only exact textbook phrases.

  Examples of equivalent explicit NORMAL statements:

  - General: "general normal", "GE normal", "general NAD", "general fine"

  - CVS: "CVS normal", "cardio okay", "cardiac exam fine", "CVS NAD"

  - Respiratory: "RS normal", "resp normal", "respiratory system fine", "chest clear", "lungs okay"

  - Abdomen: "PA normal", "P/A normal", "per abdomen normal", "abd exam fine"

  - CNS: "CNS normal", "neuro normal", "neurological exam okay", "CNS NAD"

  - Extremities: "extremities normal", "limbs fine", "peripheries okay"

  - Whole primary survey: "ABCDE okay", "primary all good"

  - Whole secondary/systemic exam: "secondary all good", "systemic normal", "all systems fine"

  IMPORTANT: Do NOT treat generic phrases like "patient fine", "stable", or "doing okay" as an examination-normal statement.

  IMPORTANT: A specific finding such as "abdomen soft" or "conscious oriented" is NOT permission to fill the rest of that system as normal.

  When a section is explicitly stated normal, you may return that section as "normal"; the SERVER expands it to the approved deterministic template.

 

EXAMINATION FINDINGS — NEVER INVENT:

  airway, breathing, circulation, disability, exposure, generalExamination,

  cvsExamination, respiratoryExamination, abdomenExamination, cnsExamination,

  extremitiesExamination, fastFindings — ALL of these must be null unless

  the doctor explicitly described that specific system. Do NOT write

  plausible-sounding normal exam prose for any system not explicitly

  examined. Silence about a system means null, never "normal".

 

PRIMARY SURVEY EXTRACTION:

  These are FLAT STRING fields in the JSON schema below — "airway",

  "breathing", "circulation", "disability", "exposure" — NOT nested

  objects. Numeric vitals (RR, SpO2, HR, BP, GCS, GRBS) ALWAYS go in

  the separate "vitals" object, never inside these text fields.

 

  airway: qualitative status/findings only (e.g. "Patent, no stridor").

  breathing: qualitative findings only — air entry, added sounds, chest

    wall movement. NEVER put RR/SpO2 numbers here — those go in vitals.

  circulation: qualitative findings only — pulses, CRT, JVD, perfusion.

    NEVER put HR/BP numbers here — those go in vitals.

  disability: qualitative findings only — pupils, motor response.

    NEVER put GCS here — that goes in vitals.gcs.

  exposure: qualitative findings ONLY for the Primary Survey Exposure domain:

    - visible injury, wound, deformity

    - skin examination finding (explicit rash observed, mottling, lesions, burns)

    - trauma exposure finding, log-roll finding

    - temperature status where appropriate.

    THIS FIELD MUST CAPTURE ANY DICTATED DEFORMITY, WOUND, OR VISIBLE

    INJURY — never return null if the doctor described one.

 

    CRITICAL EXPOSURE BOUNDARIES — DO NOT BUNDLE OTHER SYSTEMS INTO EXPOSURE:

    - Abdominal findings (e.g. "Abdomen soft and non-tender", distension, bowel sounds)

      MUST go to abdomenExamination. NEVER put abdominal findings in exposure.

    - Neurological findings including neck stiffness, focal deficit, neurological deficit,

      cranial nerves, or motor/sensory MUST go to cnsExamination. NEVER put neurological findings in exposure.

    - Hydration and general findings including dry oral mucosa, dehydration, sunken eyes,

      skin turgor, pallor, icterus, cyanosis, clubbing, or edema MUST go to generalExamination.

      NEVER bundle hydration or general findings into exposure.

    - Temperature numbers (e.g. 38.8 C, 101.8 F) ALWAYS go to vitals.temp.

    - History statement: "No rash", "no vomiting", or other negatives mentioned as part of

      history or presenting complaints must remain in symptoms/HPI as a HISTORY negative.

      Do NOT convert history "no rash" into an examination finding automatically unless the

      clinician explicitly states a skin examination / exposure finding.

 

  CERVICAL SPINE / NECK:

    Any dictated cervical-spine or neck examination finding including tenderness,

    non-tenderness, step deformity, midline tenderness, restriction, or similar

    exam findings must be placed in cSpineExam.

    Do NOT place cervical-spine findings in exposure.

    Do NOT duplicate the same C-spine fact into exposure.

 

  DO NOT put vitals in these free text fields.

ECG FINDINGS:
  Return verbatim what was dictated for ECG.
  If only "ECG" or "ECG done" is stated, return "ECG done".
  NEVER infer rhythm, ischemia, STEMI, or any interpretation not explicitly dictated.
  If not dictated, return null.

HPI (History of Present Illness):
  Clinical narrative paragraph of symptoms and illness course using ONLY what was dictated.
  Do NOT add filler text. If not dictated, return null.

FAST/EFAST FINDINGS:

  If the doctor dictates FAST/EFAST results (heart/pericardial, abdomen/

  hepatorenal/splenorenal/pelvic, lungs, extremities), extract each organ

  mentioned as positive or negative. NEVER invent a finding not stated.

  Return null for the whole object if FAST was not mentioned at all.

 

  Return as:

  "fastFindings": {

    "heart": string | null,

    "abdomen": string | null,

    "pelvis": string | null

  } | null

 

MLC DETAILS:

  Set "possibleMlc": true whenever the case involves trauma, assault, RTA/road

  traffic accident, poisoning, burns, or any legally reportable incident

  — even if the doctor never says "MLC" explicitly. Extract

  natureOfIncident, placeOfIncident, dateTimeOfIncident, mechanismOfInjury,

  broughtBy, and informant from what was dictated. identificationMark

  stays null unless a doctor explicitly describes a specific mark — never

  default to any example text. If not trauma/legally-reportable, set

  "possibleMlc": false and leave the rest of mlcDetails null.

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION LABELS — use EXACTLY:

  "Chief Complaint"

  "History of Present Illness"

  "Past Medical History"

  NOT "Patient History & Presentation"

  NOT "Events Leading Up to Presentation"

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 

PRIORITY INFERENCE:

  STEMI/NSTEMI/Severe sepsis → P1

  Chest pain/Altered GCS/Stroke → P2

  Moderate pain/Stable vitals → P3

  Never P4 for cardiac/neuro

 

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No markdown. No explanation. No preamble.

NO ASSUMPTIONS - CRITICAL RULE:

You MUST NOT invent, assume, or infer any patient information.

If the doctor does not explicitly state "Male", do NOT output "Male (assumed)".

If the doctor does not explicitly state "Normal examination", do NOT output "Normal".

If the doctor does not explicitly state an allergy status, do NOT output "NKDA".

Output ONLY what is literally said.

 

EXTRACTION SAFETY RULES:

SpO2:

→ vitals.spo2

ABG pO2:

→ blood gas po2 only if explicitly dictated

NEVER derive pO2 from SpO2.

 

If allergy is not mentioned: do not generate NKDA.

If BP is not mentioned: do not generate BP.

If temperature is not mentioned: do not generate temperature.

If pO2 is not mentioned: do not generate pO2.

If consultations are not mentioned: do not invent consultations.

If plan is not mentioned: do not invent a plan.

 

"differentials":

Only include diagnoses explicitly stated by the clinician.

Do NOT generate, infer, suggest, or complete differentials.

If none were stated, return [].

 

TREATMENT EXTRACTION:

You can output legacy strings in the array OR structured objects.

Use object form for detailed medications: { "drugName": string, "dose": string, "route": string, "instruction": string, "timeGiven": string }

timeGiven ONLY if an actual clock administration time was dictated. Do not put "stat", "BD", "TDS" into timeGiven (put those in "instruction").

 

CRITICAL TREATMENT SEMANTICS & NO-INVENTION RULES:

- SEPARATE MULTIPLE CLINICAL CONCEPTS:

  If the clinician dictates both hydration/fluids and antipyretics (e.g. "Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment"):

  treat them as TWO separate clinical concepts:

  A. Hydration / fluids: "Oral or IV fluids depending on tolerance"

  B. Antipyretic: "Weight-appropriate antipyretic"

- DO NOT INVENT SPECIFIC DRUGS OR DOSES:

  * DO NOT invent "Paracetamol", "Ibuprofen", or any specific drug when the doctor only dictated "antipyretic" or "weight-appropriate antipyretic". The generic antipyretic MUST remain generic if no specific drug was named!

  * DO NOT invent drug doses (e.g. do not invent 15 mg/kg, 250 mg). Leave dose "" if not dictated.

  * DO NOT invent fever thresholds (e.g. do not invent "> 100°F").

  * DO NOT invent frequencies or SOS instructions unless explicitly dictated.

  * DO NOT invent routes (e.g. do not invent Oral or IV) unless explicitly dictated.

- FLUIDS / HYDRATION:

  * If unspecified or conditional fluids (e.g. "Oral or IV fluids depending on tolerance") are dictated without a specific formulated product / fixed rate, preserve the hydration statement in treatmentNotes and/or plan rather than creating an incorrect medication object.

 

INVESTIGATIONS EXTRACTION — STRICT NO-INVENTION RULE:

- ONLY include specific named laboratory or diagnostic tests explicitly dictated by the clinician (e.g., "CBC", "CRP", "Chest X-ray", "Urine routine").

- DO NOT invent, infer, or assume investigations.

- If the clinician dictates general statements like "Appropriate investigations were planned based on clinical assessment and duration of fever", "investigations planned based on assessment", or "routine bloods advised" without naming specific tests:

  * DO NOT create CBC, CRP, urine routine, culture, X-ray, or any other investigation.

  * Return "investigations": [] (empty array).

  * Put the general statement in "plan".

 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 

{

  "patientName": string | null,

  "age": string | null,

  "sex": "Male" | "Female" | "Unknown",

  "priority": "P1" | "P2" | "P3" | "P4" | "P5",

  "chiefComplaint": string,

  "symptoms": string,

  "events": string,

  "vitals": {

    "hr": string | null,

    "bp": string | null,

    "spo2": string | null,

    "rr": string | null,

    "temp": string | null,

    "gcs": string | null,

    "gcs_e": string | null,

    "gcs_v": string | null,

    "gcs_m": string | null,

    "grbs": string | null

  },

    "airway": string | null,

  "breathing": string | null,

  "circulation": string | null,

  "disability": string | null,

  "exposure": string | null,

  "vbg": {

    "type": "VBG" | "ABG" | null,

    "ph": string | null,

    "pco2": string | null,

    "po2": string | null,

    "hco3": string | null,

    "be": string | null,

    "lactate": string | null,

    "na": string | null,

    "k": string | null,

    "cl": string | null,

    "hb": string | null,

    "anionGap": string | null

  } | null,

  "pastMedicalHistory": string | null,

  "lastMeal": string | null,

  "medications": string[],

  "allergies": string | null,

  "surgicalHistory": string | null,

  "familyHistory": string | null,

  "lmp": string | null,

  "generalExamination": string | null,

  "cSpineExam": string | null,

  "cvsExamination": string | null,

  "respiratoryExamination": string | null,

  "abdomenExamination": string | null,

  "cnsExamination": string | null,

  "extremitiesExamination": string | null,

  "echo": string | null,

  "fastFindings": {

    "heart": string | null,

    "abdomen": string | null,

    "pelvis": string | null

  } | null,

  "mlcDetails": {

    "possibleMlc": boolean,

    "natureOfIncident": string | null,

    "placeOfIncident": string | null,

    "dateTimeOfIncident": string | null,

    "mechanismOfInjury": string | null,

    "broughtBy": string | null,

    "informant": string | null,

    "identificationMark": string | null

  },

  "investigations": string[],

  "consultations": string[],

  "ecg": string | null,

  "hpi": string | null,

  "plan": string | null,

  "treatment": Array<string | {

    "drugName": string,

    "dose": string,

    "route": string,

    "instruction": string,

    "timeGiven": string

  }>,

  "diagnosis": string | null,

  "differentials": string[],

  "disposition": string | null,

  "emResident": string | null,

  "emConsultant": string | null,

  "isPediatric": boolean,

  "pediatricDetails": {

    "weight": string | null,

    "broughtBy": string | null,

    "informant": string | null,

    "patAppearanceTone": string | null,

    "patAppearanceInteractivity": string | null,

    "patAppearanceConsolability": string | null,

    "patAppearanceLookGaze": string | null,

    "patAppearanceSpeechCry": string | null,

    "airwayCry": string | null,

    "airwayStatus": string | null,

    "breathingWob": string | null,

    "breathingAbnormalPositioning": string | null,

    "circulationCrt": string | null,

    "circulationSkinColorTemp": string | null,

    "birthHistory": string | null,

    "immunizationHistory": string | null,

    "developmentalHistory": string | null,

      "feedingHistory": string | null

  }

}

`;

 


// ── Fail-loud Canonical Extraction Shape Assertion ──────────────────
export const KNOWN_SECTIONED_KEYS = new Set([
  "Identity",
  "MLC",
  "Chief",
  "Primary",
  "Adjunct",
  "History",
  "Exam",
  "Psych",
  "Disposition",
  "Signature"
]);

export const KNOWN_CANONICAL_KEYS = new Set([
  "patientName",
  "name",
  "age",
  "sex",
  "gender",
  "priority",
  "triage",
  "chiefComplaint",
  "presentingComplaint",
  "symptoms",
  "events",
  "vitals",
  "airway",
  "breathing",
  "circulation",
  "disability",
  "exposure",
  "vbg",
  "hpi",
  "pmh",
  "pastMedicalHistory",
  "pastHistory",
  "allergies",
  "medications",
  "outpatientMedications",
  "currentMedications",
  "lastMeal",
  "surgicalHistory",
  "familyHistory",
  "lmp",
  "generalExamination",
  "cSpineExam",
  "cvsExamination",
  "respiratoryExamination",
  "abdomenExamination",
  "cnsExamination",
  "extremitiesExamination",
  "ecg",
  "echo",
  "fastFindings",
  "investigations",
  "investigationsOrdered",
  "investigationResults",
  "treatment",
  "drugs",
  "plan",
  "diagnosis",
  "differentials",
  "disposition",
  "mlcDetails",
  "consultations",
  "emResident",
  "emConsultant",
  "isPediatric",
  "pediatricDetails"
]);

export function assertCanonicalExtractionShape(raw: any): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    console.error("[EXTRACTION-SHAPE-UNRECOGNISED]", []);
    throw new Error("Extraction result is empty or not an object");
  }

  const keys = Object.keys(raw);
  if (keys.length === 0) {
    console.error("[EXTRACTION-SHAPE-UNRECOGNISED]", []);
    throw new Error("Extraction result is empty object");
  }

  // 1. If any known SECTIONED key exists -> FAIL
  const hasSectionedKey = keys.some(k => KNOWN_SECTIONED_KEYS.has(k));
  if (hasSectionedKey) {
    console.error("[EXTRACTION-SHAPE-UNRECOGNISED]", keys);
    throw new Error(`Extraction model returned sectioned shape: ${keys.filter(k => KNOWN_SECTIONED_KEYS.has(k)).join(", ")}`);
  }

  // 2. If at least one KNOWN_CANONICAL_KEY exists -> PASS
  const hasCanonicalKey = keys.some(k => KNOWN_CANONICAL_KEYS.has(k));
  if (hasCanonicalKey) {
    return;
  }

  // 3. Else -> FAIL
  console.error("[EXTRACTION-SHAPE-UNRECOGNISED]", keys);
  throw new Error(`Extraction shape unrecognised. Top-level keys: ${keys.join(", ")}`);
}

export function sanitizeExtracted(raw: Record<string, any>): Record<string, any> {

  if (!raw || typeof raw !== 'object') return raw;

  const result = { ...raw };

 

  const medicalTerms = [

    'fever', 'cough', 'cold', 'pain', 'breathless', 'dyspnea', 'shortness',

    'vomiting', 'diarrhea', 'headache', 'chest', 'abdomen', 'patient', 'complaint',

    'since', 'days', 'weeks', 'months', 'hours', 'history', 'presents', 'presented',

    'rhinorrhea', 'sore', 'throat', 'nausea', 'dizziness', 'weakness', 'swelling',

    'distension', 'edema', 'oedema', 'fall', 'injury', 'trauma', 'accident', 'crying',

    'seizure', 'fainting', 'syncope', 'altered', 'sensorium', 'giddiness', 'c/o',

    'evaluati', 'onset', 'discomfort'

  ];

 

  // 1. Guard against symptoms/complaints in patientName

  if (result.patientName && typeof result.patientName === 'string') {

    const nameLower = result.patientName.toLowerCase();

    const hasMedicalTerm = medicalTerms.some(term => nameLower.includes(term));

    const isTooLong = result.patientName.length > 35;

    const containsDigit = /\d/.test(result.patientName);

 

    if (hasMedicalTerm || isTooLong || containsDigit) {

      if (!result.chiefComplaint || typeof result.chiefComplaint !== 'string' || !result.chiefComplaint.trim()) {

        result.chiefComplaint = result.patientName;

      }

      result.patientName = null;

    }

  }

 

  // 2. Guard Age (must be a realistic integer)

  if (result.age !== undefined && result.age !== null) {

    const ageStr = String(result.age).trim();

    const ageNum = parseInt(ageStr, 10);

    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {

      result.age = null;

    } else {

      result.age = String(ageNum);

    }

  }

 

  // 3. Ensure chiefComplaint is not empty if symptoms exist

  if (!result.chiefComplaint || typeof result.chiefComplaint !== 'string' || !result.chiefComplaint.trim()) {

    if (result.symptoms && typeof result.symptoms === 'string' && result.symptoms.trim()) {

      result.chiefComplaint = result.symptoms.split('.')[0].slice(0, 150);

    }

  }

 

  // 4. Pediatric auto-detection and details preservation

  const parsedAge = result.age ? parseInt(String(result.age), 10) : null;

  if (parsedAge !== null && !isNaN(parsedAge) && parsedAge <= 16) {

    result.isPediatric = true;

  }

  if (result.isPediatric && (!result.pediatricDetails || typeof result.pediatricDetails !== 'object')) {

    result.pediatricDetails = {};

  }

 

  return result;

}

 

// FIX (Sept 2026): this function previously filled EVERY empty exam field

// with standard "normal" text unconditionally, on every successful

// extraction — the exact FAB-21/VOICE-03 bug already fixed in the

// equivalent function in extraction.ts (applyExaminationDefaults), but

// left unfixed here on the PRIMARY extraction path (GPT-4o-mini / Claude

// Haiku, Tiers 1-3). A doctor who never mentioned CVS, respiratory,

// abdomen, or CNS exam at all would get those systems silently marked as

// examined-and-normal on every successful call. Now gated exactly like

// extraction.ts: only applies when the doctor explicitly said the

// primary survey (ABCDE) or systemic/secondary exam was normal.

// Duplicated here (rather than imported) to avoid a circular dependency

// with extraction.ts, which already imports from this file.

function applyExamDefaults(extracted: Record<string, any>, rawText: string = ''): Record<string, any> {

  const result = { ...extracted };

  const { abcdeNormal, systemicNormal, sectionNormals } = detectClinicalNormalcy(rawText);

 

  // "airway" is the only field gated by abcdeNormal; the rest are

  // systemic/secondary-exam fields gated by systemicNormal.

  const EXAM_DEFAULTS: Record<string, string> = {

    generalExamination: NORMAL_EXAM_TEMPLATES.generalExamination,

    cvsExamination: NORMAL_EXAM_TEMPLATES.cvsExamination,

    respiratoryExamination: NORMAL_EXAM_TEMPLATES.respiratoryExamination,

    abdomenExamination: NORMAL_EXAM_TEMPLATES.abdomenExamination,

    cnsExamination: NORMAL_EXAM_TEMPLATES.cnsExamination,

    extremitiesExamination: NORMAL_EXAM_TEMPLATES.extremitiesExamination,

  };

 

  const FIELD_TO_SECTION: Record<string, keyof typeof sectionNormals> = {

    generalExamination: 'general',

    cvsExamination: 'cvs',

    respiratoryExamination: 'respiratory',

    abdomenExamination: 'abdomen',

    cnsExamination: 'cns',

    extremitiesExamination: 'extremities',

  };

 

  for (const [field, defaultVal] of Object.entries(EXAM_DEFAULTS)) {

    const isEmpty = !result[field] || typeof result[field] !== 'string' || result[field].trim() === '';

    if (!isEmpty) {

      if (isNormalOnlySectionValue(result[field])) {

        result[field] = defaultVal;

        result[`${field}_isDefault`] = true;

      } else {

        result[`${field}_isDefault`] = false;

      }

      continue;

    }

    const section = FIELD_TO_SECTION[field];

    if (systemicNormal || (section ? sectionNormals[section] : false)) {

      result[field] = defaultVal;

      result[`${field}_isDefault`] = true;

    } else {

      result[field] = null;

      result[`${field}_isDefault`] = false;

    }

  }

 

  const airwayEmpty = !result.airway || typeof result.airway !== 'string' || result.airway.trim() === '';

  if (airwayEmpty) {

    if (abcdeNormal) {

      result.airway = NORMAL_EXAM_TEMPLATES.airway;

      result.airway_isDefault = true;

    } else {

      result.airway = null;

      result.airway_isDefault = false;

    }

  } else {

    result.airway_isDefault = false;

  }

 

  if (!result.events || typeof result.events !== 'string' || result.events.trim() === '') {

    result.events = '';

  }

 

  return result;

}

 

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {

  if (!openaiClient && process.env.OPENAI_API_KEY) {

    openaiClient = new OpenAI({

      apiKey: process.env.OPENAI_API_KEY,

    });

  }

  return openaiClient;

}

 

export async function extractFromTranscript(

  transcript: string

): Promise<{

  success: boolean;

  extracted?: Record<string, any>;

  error?: string;

  engine?: string;

}> {

  const cleanTranscript = transcript

    .replace(/Based on your clinical (?:query|dictation):\s*["']?/gi, '')

    .replace(/["']?\s*$/, '')

    .trim();

 

  // DPDP Act 2023 Server-Side De-identification (Rule 4)

  const phiResult = deidentifyText(cleanTranscript);

  const deidentifiedTranscript = phiResult.deidentified;

  if (phiResult.phiCount > 0) {

    console.log(`[VoiceExtract] DPDP Protection Active: Stripped ${phiResult.phiCount} PHI item(s) prior to model extraction`);

  }

 

  const openai = getOpenAI();

 

  if (openai) {

    try {

      const response = await openai.chat.completions.create({

        model: 'gpt-4o-mini',

        temperature: 0.0,

        response_format: { type: 'json_object' },

        messages: [

          {

            role: 'system',

            content: VOICE_EXTRACTION_PROMPT,

          },

          {

            role: 'user',

            content: `Transcript:\n"""\n${deidentifiedTranscript}\n"""`,

          },

        ],

      });

 

           const raw = response.choices[0]?.message?.content || '{}';

      const parsed = JSON.parse(raw);
      assertCanonicalExtractionShape(parsed);

      const sanitized = sanitizeExtracted(parsed);

      const withDefaults = applyExamDefaults(sanitized, deidentifiedTranscript);

 

      console.log(`[VoiceExtract] OpenAI GPT-4o-mini succeeded · tokens: ${response.usage?.total_tokens}`);

      return { success: true, extracted: withDefaults, engine: 'gpt-4o-mini' };

    } catch (err: any) {

      console.error('[VoiceExtract] OpenAI GPT failed, attempting fallback:', err?.message);

    }

  } else {

    console.log('[VoiceExtract] OPENAI_API_KEY not set, using Claude Haiku fallback engine');

  }

 

  // Fallback to Claude Haiku API if OpenAI key is missing or fails

  let anthropicClient: Anthropic | null = null;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey && anthropicKey.trim() !== '' && anthropicKey !== 'MY_ANTHROPIC_API_KEY') {

    anthropicClient = new Anthropic({ apiKey: anthropicKey });

  }

 

  if (anthropicClient) {

    try {

      const msg = await anthropicClient.messages.create({

        model: 'claude-haiku-4-5-20251001',

        max_tokens: 2048,

        temperature: 0.0,

        system: VOICE_EXTRACTION_PROMPT,

        messages: [

          {

            role: 'user',

            content: `Transcript:\n"""\n${deidentifiedTranscript}\n"""`,

          },

        ],

      });

 

      const rawText = (msg.content[0] as any)?.text || '{}';

      const cleanedJSON = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/s, '').trim();

           const parsed = JSON.parse(cleanedJSON);
      assertCanonicalExtractionShape(parsed);

      const sanitized = sanitizeExtracted(parsed);

      const withDefaults = applyExamDefaults(sanitized, deidentifiedTranscript);

 

      console.log(`[VoiceExtract] Claude Haiku fallback succeeded`);

      return { success: true, extracted: withDefaults, engine: 'claude-haiku-4-5-20251001' };

    } catch (haikuErr: any) {

      console.warn('[VoiceExtract] Claude Haiku fallback unavailable, attempting retry:', haikuErr?.message || haikuErr);

    }

  }

 

  // TIER 3: Secondary retry — Claude 3.5 Haiku (transient-failure recovery)

  //

  // This is NOT a different model — it's one retry of the same

  // authorized fallback model from Tier 2, in case that failure was a

  // transient network/timeout issue rather than a real outage. This

  // keeps the cascade entirely within GPT-4o-mini / Claude 3.5 Haiku,

  // per the locked Voice & Case Extraction model matrix. No Gemini.

  if (anthropicClient) {

    try {

      console.log('[VoiceExtract] Retrying Claude 3.5 Haiku after transient failure...');

      const msg = await anthropicClient.messages.create({

        model: 'claude-haiku-4-5-20251001',

        max_tokens: 2048,

        temperature: 0.0,

        system: VOICE_EXTRACTION_PROMPT,

        messages: [{ role: 'user', content: `Transcript:\n"""\n${deidentifiedTranscript}\n"""` }],

      });

 

      const rawText = (msg.content[0] as any)?.text || '{}';

      const cleanedJSON = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/s, '').trim();

           const parsed = JSON.parse(cleanedJSON);
      assertCanonicalExtractionShape(parsed);

      const sanitized = sanitizeExtracted(parsed);

      const withDefaults = applyExamDefaults(sanitized, deidentifiedTranscript);

 

      console.log('[VoiceExtract] Claude Haiku retry succeeded');

      return { success: true, extracted: withDefaults, engine: 'claude-haiku-4-5-20251001-retry' };

    } catch (retryErr: any) {

      console.warn('[VoiceExtract] Claude Haiku retry also failed, falling through to manual-entry fallback:', retryErr?.message || retryErr);

    }

  }

 

  // TIER 4: Ultimate Local Deterministic Heuristic Fallback Engine

  //

  // CRITICAL: This tier must NEVER fabricate clinical findings. When all

  // AI models fail, the safe behavior is to preserve whatever raw text

  // the doctor dictated (so nothing is lost) and leave every structured

  // clinical field EMPTY — never populate exam findings, vitals, or

  // diagnoses with invented "normal" defaults. A doctor must not be able

  // to mistake a fallback failure for a real completed extraction.

  console.warn('[VoiceExtract] All AI models failed or rate limited. Returning manual-entry fallback.');

 

  const heuristicExtracted = {

    patientLabel: { name: '', ageSex: '', erNumber: '', bed: '', treatingERPhysician: '' },

    // Do NOT force the raw transcript into presentingComplaint/HPI —

    // that's still an unverified guess at structure. Preserve it

    // separately instead, verbatim, for the doctor to read and enter

    // manually.

    presentingComplaint: '',

    historyOfPresentIllness: '',

    rawDictationText: cleanTranscript, // NEW FIELD — full transcript preserved for manual review

    pastMedicalHistory: { comorbidities: [], homeMedications: [], allergies: '' },

    primaryAssessmentVitals: { bp: '', hr: '', spo2: '', rr: '', temp: '', grbs: '', gcs: '' },

    // NEVER auto-fill exam findings here — leave genuinely empty, not "normal"

    systemicExamination: { cvs: '', rs: '', abdomen: '', cns: '', extremity: '' },

    investigationFindings: { labs: [], imaging: [], ecgVbg: [] },

    provisionalDiagnosis: '',

    differentialDiagnoses: [],

    treatmentInER: [],

    dispositionAndPlan: { dispositionStatus: '', destinationUnit: '', consultsRequested: [], pendingInvestigations: [], followUpAdvice: '' },

    requiresManualEntry: true, // NEW FIELD — frontend MUST check this and show a visible banner

  };

 

  // NOTE: applyExamDefaults() is intentionally NOT called here — that

  // function is for filling gaps in a SUCCESSFUL extraction (normal

  // defaults only for exam fields omitted from dictation), not for

  // fabricating an entire exam when extraction never happened at all.

  return {

    success: false, // CHANGED from true — this was NOT a successful extraction

    extracted: heuristicExtracted,

    engine: 'heuristic-fallback',

    error: 'AI extraction unavailable. Transcript preserved — please complete the case sheet manually.',

  };

}

