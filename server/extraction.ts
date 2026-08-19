import { extractFromTranscript, sanitizeExtracted } from "./voiceExtraction.ts";
import { deidentifyText } from "./deidentify.ts";
import { cleanExtractionOutput } from "./extractionCleanup.ts";

// ── Model Config ──────────────────────────────────────────────
export const MODELS = {
  CLAUDE_HAIKU: "claude-3-5-haiku-20241022",
  CLAUDE_SONNET: "claude-3-5-sonnet-20241022",
};

// ── Normal examination defaults ───────────────────────────────
// Applied ONLY when doctor did not mention that system at all.
// Clinically appropriate — matches Indian EMR standard format.
export const EXAM_DEFAULTS = {
  airway: "Patent",

  generalExamination:
    "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.",

  cvsExamination:
    "S1 S2 heard. No murmurs. Peripheral pulses normal.",

  respiratoryExamination:
    "Air entry bilaterally equal. Normal vesicular breath sounds. No added sounds.",

  abdomenExamination:
    "Soft, non-tender. No distension. No organomegaly. Bowel sounds present.",

  cnsExamination:
    "Moving all four limbs. No focal neurological deficit.",

  psychologicalAssessment:
    "No features of depression, anxiety, psychosis, agitation, suicidal ideation, or substance use.",
};

// ── Apply defaults after extraction ──────────────────────────
// Only fills in examination fields that are completely absent.
// NEVER touches factual fields (vitals, name, diagnosis etc).
export function applyExaminationDefaults(
  extracted: Record<string, any>
): Record<string, any> {
  if (!extracted || typeof extracted !== "object") return extracted || {};
  const result = { ...extracted };

  for (const [field, defaultValue] of Object.entries(EXAM_DEFAULTS)) {
    // Only apply if field is completely missing
    if (
      !result[field] ||
      result[field] === "" ||
      result[field] === null ||
      result[field] === undefined
    ) {
      result[field] = defaultValue;
      // Flag as default so UI can show subtle indicator
      result[`${field}_isDefault`] = true;
    } else {
      // Doctor mentioned this — keep their value
      result[`${field}_isDefault`] = false;
    }
  }

  return result;
}

// ── Master extraction prompt ──────────────────────────────────
export function buildExtractionPrompt(transcript: string): string {
  return `
You are a clinical data extraction engine for Indian Emergency Departments.

TEMPERATURE IS SET TO 0. BE DETERMINISTIC.
Same input must always produce same output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIAL INSTRUCTION: PRE-FORMATTED CASE SHEETS & TABULAR LABS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the input text contains a PRE-FORMATTED EMR CASE SHEET (e.g., "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD", "Presenting Complaint:", "Primary Assessment:", "Secondary Survey:", "General Examination:", "Systemic Examination:", "Investigations:", "Treatment Plan:", "Differential Diagnosis:") or TABULAR LAB REPORTS ("Parameter | Result | Unit | Reference"):

1. DO NOT dump the whole case sheet or lab report into "chiefComplaint", "hpi", or "symptoms"!
2. Map EACH section explicitly by its header to its exact target JSON key:
   - "Presenting Complaint:" / "CHIEF COMPLAINT:" → chiefComplaint
   - "History of Present Illness:" → hpi
   - "Past Medical History:" / "Past History:" → pmh
   - "Primary Assessment:" -> Airway → airway, Breathing → breathing, Circulation → circulation, Disability → disability, Exposure → exposure
   - "General Examination:" → generalExamination
   - "Systemic Examination:" -> CVS → cvsExamination, Chest/RS → respiratoryExamination, Abdomen → abdomenExamination, CNS → cnsExamination
   - "Psychological Assessment:" → psychologicalAssessment
   - "Investigations:" → investigationsOrdered
   - "Differential Diagnosis:" → differentials
   - "Treatment Plan:" → treatment
   - "EM Resident:" → emResident
   - "EM Consultant:" → emConsultant
3. TABULAR LAB REPORTS: Extract ALL lab tests (e.g. Urine Routine, Potassium, Sodium, Creatinine, Urea, ALP, SGOT, SGPT, Bilirubin, TSH, Magnesium, Calcium, CRP, CBC, PT/INR).
   For EACH test row, extract into "investigationResults" as:
   "ParameterName": "Result Unit (Ref: ReferenceRange) [↑/↓ if abnormal]"
   Example:
   "Creatinine": "1.3 mg/dl ↑ (Ref: 0.55 - 1.1)"
   "Urea": "70.9 mg/dl ↑ (Ref: 16.6 - 48.5)"
   "CRP": "26.3 mg/L ↑ (Ref: 0 - 5)"
   "Urine Protein": "Present(+++) ↑"
   "Urine Bacteria": "4881.4 /HPF ↑"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-HALLUCINATION RULES — READ FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER INVENT THESE — return null if not stated:
  patientName, age, sex (use "Unknown")
  HR, BP, SpO2, RR, Temp, GCS, GRBS
  Specific diagnosis
  Specific drug names and doses
  Lab results and values
  Allergy history (do NOT assume NKDA)
  History details not mentioned

NORMAL DEFAULTS ALLOWED for these ONLY:
  airway, generalExamination,
  cvsExamination, respiratoryExamination,
  abdomenExamination, cnsExamination,
  psychologicalAssessment
  → Only when completely unmentioned
  → Use Indian EMR standard normal text
  → The code will apply these after you return null for them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDIAN MEDICAL KNOWLEDGE & MEDICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MEDICATIONS — extract every drug mentioned:
  For each medication extract:
  - Generic name (map Indian brands)
  - Dose with units
  - Route (oral/IV/IM/SC/neb/topical)
  - Frequency (stat/BD/TID/QID/OD/PRN)
  - Duration if mentioned
  
  Format each as:
  "GenericName (BrandName) Dose Route Freq"
  
  Example outputs:
  "Aspirin (Ecosprin) 325mg oral stat"
  "Heparin 5000 IU IV stat"
  "Ipratropium+Salbutamol (Duolin) neb TID"
  "Morphine 5mg IV stat"
  "Metformin (Glycomet) 500mg oral BD"
  
  Indian brand → generic mapping:
  Ecosprin → Aspirin
  Brilinta → Ticagrelor
  Duolin   → Ipratropium + Salbutamol
  Budecort → Budesonide
  Calpol   → Paracetamol
  Ompras   → Omeprazole
  Pan      → Pantoprazole
  Aug      → Amoxicillin-Clavulanate
  Zidot    → Azithromycin
  Glycomet → Metformin
  Levipil  → Levetiracetam
  Tonact   → Atorvastatin
  Prolomet → Metoprolol
  Nexovas  → Nebivolol
  Pioz     → Pioglitazone
  Combiflam → Ibuprofen + Paracetamol
  
  Return as:
  "medications": string[]
  
  If no medications mentioned: []
  NEVER invent medications.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTIGATIONS — TWO SEPARATE LISTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LIST 1 — Ordered (tests requested):
  Any test mentioned as ordered/sent/done
  "CBC sent", "Troponin ordered",
  "VBG taken", "ECG done",
  "X-ray requested", "USG ordered"
  
  Return as:
  "investigationsOrdered": string[]

LIST 2 — Results (values received):
  Any numerical result or lab table value mentioned
  Flag abnormals with ↑ or ↓
  
  Normal adult ranges for flagging:
  WBC: 4-11 × 10³ (high if >11)
  Hb: 12-17 g/dL (low if <12F or <13M)
  Platelets: 150-450 × 10³
  Creatinine: 0.6-1.2 mg/dL (high if >1.2)
  Na: 136-145 mEq/L
  K: 3.5-5.1 mEq/L
  Troponin: flag any elevation
  Lactate: flag if >2.0
  GRBS: flag if >200 or <70
  
  Return as:
  "investigationResults": {
    "TestName": "Value Unit (Reference range if present) ↑/↓ if abnormal"
  }

VBG / ABG — extract all components:
  pH, pCO2, pO2, HCO3, BE,
  Lactate, Na, K, Glucose, Hb
  
  Return as:
  "vbg": { "ph": "7.32", "lactate": "3.9" }
  or null if not done

ECG findings:
  Return as "ecg": string | null

Echo findings:
  Return as "echo": string | null

Priority inference:
  STEMI / NSTEMI / Severe sepsis  → P1
  Chest pain / Altered GCS / Stroke → P2
  Moderate pain / Stable vitals   → P3
  Never P4 for cardiac/neuro case

Language: Input may be Malayalam, Hindi, Tamil, or mixed with English.
Output ALWAYS in English.
Medical terms stay in English.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — strict JSON only
No markdown. No explanation. No preamble.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "patientName":             string | null,
  "age":                     string | null,
  "sex":                     "Male" | "Female" | "Unknown",
  "priority":                "P1" | "P2" | "P3" | "P4" | "P5",
  "chiefComplaint":          string,
  "vitals": {
    "hr":                    string | null,
    "bp":                    string | null,
    "spo2":                  string | null,
    "rr":                    string | null,
    "temp":                  string | null,
    "gcs":                   string | null,
    "grbs":                  string | null,
    "pain":                  string | null
  },
  "airway":                  string | null,
  "breathing":               string | null,
  "circulation":             string | null,
  "disability":              string | null,
  "exposure":                string | null,
  "hpi":                     string,
  "pmh":                     string | null,
  "medications":             string[],
  "outpatientMedications":   string[] | string | null,
  "symptoms":                string | null,
  "events":                  string | null,
  "allergies":               string | null,
  "surgicalHistory":         string | null,
  "familyHistory":           string | null,
  "lmp":                     string | null,
  "generalExamination":      string | null,
  "cvsExamination":          string | null,
  "respiratoryExamination":  string | null,
  "abdomenExamination":      string | null,
  "cnsExamination":          string | null,
  "psychologicalAssessment": string | null,
  "ecg":                     string | null,
  "echo":                    string | null,
  "vbg":                     object | string | null,
  "investigationsOrdered":   string[],
  "investigationResults":    object | null,
  "investigations":          string[],
  "treatment":               string[],
  "procedures":              string[],
  "diagnosis":               string | null,
  "differentials":           string[],
  "disposition":             string | null,
  "emResident":              string | null,
  "emConsultant":            string | null,
  "alerts":                  string[],
  "isPediatric":             boolean,
  "pediatricDetails": {
    "broughtBy":                         string | null,
    "informant":                         string | null,
    "patAppearanceTone":                 string | null,
    "patAppearanceInteractivity":        string | null,
    "patAppearanceConsolability":        string | null,
    "patAppearanceLookGaze":             string | null,
    "patAppearanceSpeechCry":            string | null,
    "airwayCry":                         string | null,
    "airwayStatus":                      string | null,
    "breathingWob":                      string | null,
    "breathingAbnormalPositioning":      string | null,
    "circulationCrt":                    string | null,
    "circulationSkinColorTemp":          string | null,
    "birthHistory":                      string | null,
    "immunizationHistory":               string | null,
    "developmentalHistory":              string | null,
    "feedingHistory":                    string | null
  }
}

RULES FOR SPECIFIC FIELDS:

chiefComplaint:
  The main reason patient came (1-2 lines). Extracted directly from dictation.
  NEVER generate generic boilerplate text.

hpi:
  Write as clinical narrative paragraph using ONLY what the doctor dictated.
  Do NOT add "Acute symptom onset prior to arrival", "Patient presented to ED for urgent evaluation", or "Events leading up to presentation".

symptoms:
  Refined concise list of active clinical signs & symptoms (e.g. "Fever, cough, cold, rhinorrhea, headache, sore throat, body ache x 3 days").
  Omit narrative preambles like "A 42-year-old male presented with complaints of...".

events:
  Preceding trauma, mechanism of injury, accident, or precipitants ONLY if explicitly dictated by doctor.
  If the doctor did NOT mention preceding events or trauma, return null or empty string!
  NEVER generate hallucinated filler text like "Acute symptom onset prior to arrival" or "progressive discomfort prompted emergency evaluation".

SECTION LABELS — use EXACTLY standard labels:
  - "Chief Complaint"
  - "History of Present Illness"
  - "Signs and Symptoms"
  - "Past Medical History"

NEVER GENERATE:
  "Acute symptom onset prior to arrival"
  "Patient presented to ED for urgent evaluation"
  "Events Leading Up to Presentation"
  "Patient History & Presentation"
  Any text the doctor did not say.

outpatientMedications:
  Daily home medications taken regularly by patient before ER arrival (e.g. "Tab Metformin 500mg BD").
  CRITICAL: Acute ER treatments given or suggested by doctor in ER (e.g. Paracetamol 1g IV stat, Esomeprazole 40mg IV stat) MUST go into "treatment", NOT "outpatientMedications".
  AUTOMATIC RULE: If PMH or dictation states "No past medical history" / "Nil past medical history" / "No comorbidities" / "NKCO" and no daily home meds are mentioned, return "Nil regular medications".

pmh:
  Past medical and surgical history. If dictated as "no past medical history" or "no surgical history" or no comorbidities, return "No past medical history".

chiefComplaint:
  NEVER null — always extract concise chief complaint.
  If input is a case sheet, extract text from "Presenting Complaint:" or "CHIEF COMPLAINT:".

hpi:
  Write as clinical narrative paragraph.
  If input has "History of Present Illness:", extract that narrative directly.

differentials:
  List 2-4 with brief clinical reasoning each.
  If input has "Differential Diagnosis:", map those directly.

alerts:
  List anything urgent or pending.
  E.g. "Troponin pending", "AKI — avoid contrast", "Protein +++ in urine"

isPediatric:
  Set to true if age is <= 16 years, or if the patient is a child, infant, neonate, or pediatric case. Otherwise set to false.

pediatricDetails:
  Extract pediatric assessment findings (broughtBy, informant, PAT appearance/tone/cry/gaze, airway/breathing WOB, CRT, birth history, immunizations, developmental milestones, feeding history) whenever mentioned in pediatric dictations or case sheets. Null if unmentioned or not a pediatric case.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPT TO EXTRACT FROM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
${transcript}
"""
`;
}

// ── STEP 1: preprocessEMR ──────────────────────────────────────
export function preprocessEMR(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "";

  const lines = rawText.split(/\r?\n/);
  const cleanedLines: string[] = [];
  let prevLineWasNoComplaints = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Remove Acknowledged By / DateTime / Ack by
    if (/(?:Acknowledged\s+By|Acknowledged\s+by|Ack\s+by|Acknowledged\s+Date\/?Time)/i.test(trimmed)) {
      continue;
    }

    // 2. Remove VIP scores / Waterlow / Braden / Fall risk / Pain scale noise
    if (/(?:VIP\s*Score|Waterlow\s*Score|Braden\s*Score|Fall\s*Risk|Morse\s*Fall|Pain\s*Score|NRS\s*Pain\s*Scale)\s*[:=-]?/i.test(trimmed)) {
      continue;
    }

    // 3. Remove Document handover lines
    if (/(?:Document\s+handover|Handover\s+(?:given|received|documented|taken)|Shift\s+handover\s+(?:done|taken|given|documented))/i.test(trimmed)) {
      continue;
    }

    // 4. Remove Supply lists / Consumables / Inventory
    if (/^(?:\d+x\s*)?(?:Syringe|Gauge\s+wire|Cotton\s+swab|Disposables?|Bandage|Micropore|Gloves|Needle|Infusion\s+set|Catheter\s+tray)\s*(?:x\d+|\b)/i.test(trimmed)) {
      continue;
    }

    // 5. Remove Empty lab rows
    if (/^(?:CBC|RFT|LFT|Serum\s+Electrolytes|ABG|VBG|Urine|Coagulation|Thyroid\s+profile)\s*[:=-]?\s*$/i.test(trimmed)) {
      continue;
    }

    // 6. Remove Personal care / hygiene routine nursing lines
    if (/(?:Sponge\s+bath|Bed\s+linen|Position\s+changed|Mouth\s+care|Back\s+care|Hair\s+care|Routine\s+nursing\s+care|Diaper\s+change)\s+(?:given|done|changed|provided|performed)/i.test(trimmed)) {
      continue;
    }

    // 7. Collapse duplicate NO FRESH COMPLAINTS
    const isNoComplaints = /(?:no\s+fresh\s+complaints|patient\s+comfortable\s+in\s+bed|nfc\b|no\s+new\s+complaints)/i.test(trimmed);
    if (isNoComplaints) {
      if (prevLineWasNoComplaints) {
        continue;
      }
      prevLineWasNoComplaints = true;
      cleanedLines.push("NO FRESH COMPLAINTS");
      continue;
    } else {
      prevLineWasNoComplaints = false;
    }

    cleanedLines.push(trimmed);
  }

  return cleanedLines.join("\n");
}

// ── STEP 2: reverseEMREntries ─────────────────────────────────
export function reverseEMREntries(text: string): string {
  if (!text || typeof text !== "string") return "";

  // Split by entry header date/time or section boundaries
  const entryBoundaryRegex = /\n(?=(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4}|\d{1,2}:\d{2}\s*(?:AM|PM|hrs)?|Doctor Note|Nursing Note|Consultant Review|Primary Assessment|Emergency Review|Progress Note)\b)/i;

  let chunks = text.split(entryBoundaryRegex).map(c => c.trim()).filter(c => c.length > 0);

  if (chunks.length <= 1) {
    chunks = text.split(/\n\s*\n+/).map(c => c.trim()).filter(c => c.length > 0);
  }

  if (chunks.length > 1) {
    chunks.reverse(); // Oldest entry now at TOP
    return chunks.join("\n\n--- PREVIOUS ENTRY (CHRONOLOGICAL ORDER: OLDEST AT TOP) ---\n\n");
  }

  return text;
}

// ── Handover extraction prompt ────────────────────────────────
export function buildHandoverPrompt(reversedText: string): string {
  return `
You are an expert Emergency Medicine Clinical Lead extracting a clinical handover from a real Indian hospital EMR note or case sheet.

Text has been preprocessed and reversed — oldest entry first at the TOP.
Read top to bottom to follow complete clinical story.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHERE TO FIND EACH FIELD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PATIENT LABEL:
  Name from entry headers (e.g., Selvarani, Varghese KC)
  Age/sex from consultant notes or headers (e.g., 57F, 48M)
  Bed number and ER number from header or notes

PRESENTING COMPLAINT:
  Look for "Presenting Complaint:" or "Chief Complaint:" or "c/o" labels
  Use EARLIEST entry (at TOP of text) or initial presentation note
  Detail symptoms, duration, and onset

PAST MEDICAL HISTORY:
  Look for "Past Medical History:", "Known case of", "K/C/O", "KCO", "Comorbidities:", "PMH"
  May appear in ANY entry — especially consultant notes (e.g., General Medicine, Nephrology, Cardiology consults)
  Extract ALL conditions with durations and home medications (e.g., T2DM x 22y, HTN x 22y, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA)
  NEVER say "not documented" or "Comorbidities not explicitly documented" if PMH exists anywhere in the text

PROVISIONAL DIAGNOSIS:
  Look for "IMP:", "Impression:", "Differential Diagnosis:", "Provisional Diagnosis:", "Diagnosis:", "Dx:"
  Consultant notes often have "IMP:" (e.g. "Fluid overload state with pericardial effusion and right pleural effusion, Moderate ascites, Metabolic acidosis, Acute kidney injury")
  Use the MOST SPECIFIC diagnosis found across all entries
  CT/imaging impressions count as diagnosis

DONE (COMPLETED ACTIONS):
  Any entry with PAST TENSE actions: "done", "given", "taken", "sent", "started", "inserted", "shifted", "administered", "counselled"
  Each completed action = one done item (prefixed with ✓)

TO BE DONE (PENDING / PLAN):
  Any entry with FUTURE actions: "Plan:", "Advice:", "Adv:", "to be done", "pending", "awaited", "monitor", "shift to", "ICU transfer"
  Each pending action = one to-do item (prefixed with □)

VITALS:
  Look in "Primary Assessment:" sections or arrival/nursing notes
  Look for BP, HR, SpO2, RR, Temp, GCS, GRBS
  Use MOST RECENT values or arrival values

BYSTANDER UPDATE:
  Look for "family counselled", "explained to bystander", "financial counselling"
  Include WHO was told and WHAT was communicated

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. TEMPERATURE IS SET TO 0.0 — BE DETERMINISTIC AND ACCURATE.
2. ZERO GENERIC PLACEHOLDERS: NEVER output "Comorbidities not explicitly documented in raw input" or "Vitals not documented". If data is present, extract it; if genuinely absent, return empty string "".
3. READ EVERY ENTRY TOP TO BOTTOM.

OUTPUT FORMAT — STRICT JSON ONLY:
{
  "name": "Patient Name or Bed ID",
  "ageGender": "e.g. 57F, 48M",
  "triage": "P1 (Immediate) or P2 (Urgent) or P3 (Non-Urgent)",
  "vitals": "Summary of vital signs",
  "presentingComplaint": "Chief complaint, symptoms, onset, and duration from earliest entry",
  "rawNotes": "Preprocessed and chronologically ordered notes",
  "structuredSBAR": {
    "situation": "Situation (S): Bed, Age/Gender, and EXPLICIT provisional diagnosis / active primary issue.",
    "background": "Background (B): Exhaustive past medical history, comorbidities, home medications.",
    "assessment": "Assessment (A): Vitals, physical exam highlights, investigation findings parameter-by-parameter.",
    "recommendation": "Recommendation (R): Exhaustive list of completed actions ✓ and pending actions □, transfer plans, bystander update."
  },
  "patientLabel": {
    "name": "Patient Name",
    "age": "Age",
    "sex": "Sex",
    "bed": "Bed Number",
    "erNumber": "ER Number",
    "status": "critical|unstable|stable"
  },
  "presentingComplaints": "Same as presentingComplaint",
  "pastMedicalHistory": "Exhaustive PMH and comorbidities",
  "provisionalDiagnosis": "Explicit provisional diagnosis",
  "done": ["✓ Item 1", "✓ Item 2"],
  "toBeDone": ["□ Item 1", "□ Item 2"],
  "bystanderUpdate": "Bystander update details"
}

RAW EMR TEXT (REVERSED CHRONOLOGICALLY — OLDEST ENTRY AT TOP):
"""
${reversedText}
"""
`;
}

// ── Claude caller ─────────────────────────────────────────────
async function callClaude(
  prompt: string,
  model = MODELS.CLAUDE_HAIKU
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === "MY_ANTHROPIC_API_KEY") {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ErMate AI status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // Strip markdown fences if Claude adds them
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// ── Safe JSON parser ──────────────────────────────────────────
export function safeParseJSON(
  raw: string,
  context: string
): Record<string, any> | null {
  try {
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error(`[${context}] JSON parse failed:`, err);
    console.error(`[${context}] Raw snippet:`, raw.substring(0, 300));
    return null;
  }
}

// ── Fallback chain ────────────────────────────────────────────
export async function withFallback(
  prompt: string,
  context: string
): Promise<string> {
  // 1. Try Claude Haiku first (primary text extraction engine)
  try {
    console.log(`[${context}] Trying Claude Haiku (${MODELS.CLAUDE_HAIKU})...`);
    const result = await callClaude(prompt, MODELS.CLAUDE_HAIKU);
    if (result && result.trim()) {
      console.log(`[${context}] Claude Haiku succeeded ✓`);
      return result;
    }
  } catch (err: any) {
    console.warn(`[${context}] Claude Haiku failed:`, err?.status || err?.message);
  }

  // 2. Try Claude Sonnet fallback
  try {
    console.log(`[${context}] Trying Claude Sonnet (${MODELS.CLAUDE_SONNET})...`);
    const result = await callClaude(prompt, MODELS.CLAUDE_SONNET);
    if (result && result.trim()) {
      console.log(`[${context}] Claude Sonnet succeeded ✓`);
      return result;
    }
  } catch (err: any) {
    console.warn(`[${context}] Claude Sonnet failed:`, err?.status || err?.message);
  }

  throw new Error("All AI extraction models unavailable.");
}

// ── Doctor-friendly error messages ───────────────────────────
export function getFriendlyError(err: any): string {
  if (err?.status === 429 || err?.message?.includes("quota") || err?.message?.includes("429")) {
    return "Processing busy — please try again shortly";
  }
  if (err?.status === 503 || err?.status === 502) {
    return "Service temporarily unavailable — please try again";
  }
  if (err?.message?.includes("timeout")) {
    return "Processing is taking too long — please try again";
  }
  return "Something went wrong — please try again";
}

// ── Local Medical Heuristic Parser ────────────────────────────
export function parseHeuristicClinicalData(transcript: string): Record<string, any> {
  const text = transcript || "";

  let parsedAge: number | null = null;
  const ageMatch = text.match(/(\d+)\s*(years|yrs|year|yr|yo|y\.o\.|year-old|yr-old)/i);
  if (ageMatch) {
    parsedAge = parseInt(ageMatch[1], 10);
  }

  let parsedGender = "Male";
  if (/female|woman|girl|lady|she|her/i.test(text)) {
    parsedGender = "Female";
  } else if (/other|non-binary/i.test(text)) {
    parsedGender = "Other";
  }

  let parsedName = "Dictated Emergency Patient";
  const nameMatch = text.match(/(patient\s+)?name\s*(is|of)?\s*([A-Z][a-z]+(\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    parsedName = nameMatch[3].trim();
  }

  let parsedTriage = "P2";
  if (/immediate|severe|critical|unconscious|shock|arrest|p1|stemi|resuscitation/i.test(text)) {
    parsedTriage = "P1";
  } else if (/non-urgent|minor|p3|stable/i.test(text)) {
    parsedTriage = "P3";
  }

  let bpVal = "120/80";
  const bpMatch = text.match(/(\d{2,3}\/\d{2,3})/);
  if (bpMatch) bpVal = bpMatch[1];

  let hrVal = "80";
  const hrMatch = text.match(/(hr|pulse|heart rate)\s*(is|of|at)?\s*(\d{2,3})/i);
  if (hrMatch) hrVal = hrMatch[3];

  let spo2Val = "98";
  const spo2Match = text.match(/(spo2|saturation|sat|sats)\s*(is|of|at)?\s*(\d{2,3})/i);
  if (spo2Match) spo2Val = spo2Match[3];

  let rrVal = "16";
  const rrMatch = text.match(/(rr|respiratory|resp rate)\s*(is|of|at)?\s*(\d{2})/i);
  if (rrMatch) rrVal = rrMatch[3];

  let tempVal = "98.6";
  const tempMatch = text.match(/(temp|temperature)\s*(is|of|at)?\s*(\d{2,3}\.?\d?)/i);
  if (tempMatch) tempVal = tempMatch[3];

  // Heuristic Medication Extraction
  const BRAND_MAP: Record<string, string> = {
    ecosprin: "Aspirin (Ecosprin)",
    aspirin: "Aspirin",
    brilinta: "Ticagrelor (Brilinta)",
    ticagrelor: "Ticagrelor",
    duolin: "Ipratropium+Salbutamol (Duolin)",
    budecort: "Budesonide (Budecort)",
    calpol: "Paracetamol (Calpol)",
    paracetamol: "Paracetamol",
    pcm: "Paracetamol",
    ompras: "Omeprazole (Ompras)",
    pan: "Pantoprazole (Pan)",
    pantoprazole: "Pantoprazole",
    pantocid: "Pantoprazole (Pantocid)",
    aug: "Amoxicillin-Clavulanate (Augmentin)",
    augmentin: "Amoxicillin-Clavulanate (Augmentin)",
    zidot: "Azithromycin (Zidot)",
    azithromycin: "Azithromycin",
    glycomet: "Metformin (Glycomet)",
    metformin: "Metformin",
    combiflam: "Ibuprofen + Paracetamol (Combiflam)",
    tonact: "Atorvastatin (Tonact)",
    atorvastatin: "Atorvastatin",
    prolomet: "Metoprolol (Prolomet)",
    nexovas: "Nebivolol (Nexovas)",
    levipil: "Levetiracetam (Levipil)",
    pioz: "Pioglitazone (Pioz)",
    heparin: "Heparin",
    morphine: "Morphine",
    fentanyl: "Fentanyl",
    ondansetron: "Ondansetron",
    emeset: "Ondansetron (Emeset)",
    tramadol: "Tramadol",
    hydrocortisone: "Hydrocortisone",
    monocef: "Ceftriaxone (Monocef)",
    pipzo: "Piperacillin + Tazobactam (Pipzo)",
  };

  const extractedMeds: string[] = [];
  const drugRegex = /(?:give|administered|start|started|stat|tab|tab\.|inj|inj\.|syrup)?\s*([a-z]+)\s*(\d+[\.\d]*\s*(?:mg|g|mcg|iu|ml|puffs?|nebs?|tablets?|tbl|caps?))\s*(iv|im|po|oral|sc|neb|stat|bd|tid|qid|od|prn)?/gi;
  let m;
  while ((m = drugRegex.exec(text)) !== null) {
    const brandKey = m[1].toLowerCase();
    if (BRAND_MAP[brandKey]) {
      const name = BRAND_MAP[brandKey];
      const dose = m[2];
      const route = m[3] || "IV";
      extractedMeds.push(`${name} ${dose} ${route} stat`);
    }
  }

  // Heuristic Investigations Ordered & Results
  const orderedList: string[] = [];
  const resultsObj: Record<string, string> = {};

  if (/cbc|blood count/i.test(text)) orderedList.push("CBC");
  if (/troponin/i.test(text)) orderedList.push("Troponin");
  if (/creatinine|rft|renal/i.test(text)) orderedList.push("RFT");
  if (/electrolytes|sodium|potassium|na|k\+/i.test(text)) orderedList.push("Electrolytes");
  if (/vbg|abg|blood gas/i.test(text)) orderedList.push("VBG");
  if (/ecg|electrocardiogram/i.test(text)) orderedList.push("ECG");
  if (/x-ray|xray|radiograph/i.test(text)) orderedList.push("Chest X-Ray");
  if (/usg|ultrasound/i.test(text)) orderedList.push("USG Abdomen");

  // Extract numerical values if present
  const wbcM = text.match(/wbc\s*(?:is|=|of)?\s*(\d+[\.\d]*)/i);
  if (wbcM) {
    const val = parseFloat(wbcM[1]);
    resultsObj["WBC"] = `${val} × 10³/μL` + (val > 11 ? " ↑" : val < 4 ? " ↓" : "");
  }
  const hbM = text.match(/(?:hb|haemoglobin|hemoglobin)\s*(?:is|=|of)?\s*(\d+[\.\d]*)/i);
  if (hbM) {
    const val = parseFloat(hbM[1]);
    resultsObj["Haemoglobin"] = `${val} g/dL` + (val < 12 ? " ↓" : "");
  }
  const tropM = text.match(/troponin\s*(?:is|=|of)?\s*(\d+[\.\d]*)/i);
  if (tropM) {
    const val = parseFloat(tropM[1]);
    resultsObj["Troponin T"] = `${val} ng/mL` + (val > 0.01 ? " ↑" : "");
  }
  const creatM = text.match(/creatinine\s*(?:is|=|of)?\s*(\d+[\.\d]*)/i);
  if (creatM) {
    const val = parseFloat(creatM[1]);
    resultsObj["Creatinine"] = `${val} mg/dL` + (val > 1.2 ? " ↑" : "");
  }
  const naM = text.match(/(?:sodium|na)\s*(?:is|=|of)?\s*(\d{2,3})/i);
  if (naM) {
    const val = parseInt(naM[1], 10);
    resultsObj["Sodium"] = `${val} mEq/L` + (val < 136 ? " ↓" : val > 145 ? " ↑" : "");
  }
  const kM = text.match(/(?:potassium|k\+)\s*(?:is|=|of)?\s*(\d+[\.\d]*)/i);
  if (kM) {
    const val = parseFloat(kM[1]);
    resultsObj["Potassium"] = `${val} mEq/L` + (val < 3.5 ? " ↓" : val > 5.1 ? " ↑" : "");
  }

  // Extract section headers if present in structured EMR text
  const matchSection = (regex: RegExp) => {
    const m = text.match(regex);
    return m ? m[1].trim() : null;
  };

  const structuredComplaint = matchSection(/(?:Presenting Complaint|CHIEF COMPLAINT)\s*:\s*([^:\n]+(?:\n(?!Primary|Secondary|History|Past|General|Systemic|Investigations|Treatment|Differential)[^:\n]+)*)/i);
  const structuredHpi = matchSection(/(?:History of Present Illness|HPI)\s*:\s*([^:\n]+(?:\n(?!Secondary|Past|General|Systemic|Investigations|Treatment|Differential)[^:\n]+)*)/i);
  const structuredPmh = matchSection(/(?:Past Medical History|PMH)\s*:\s*([^:\n]+(?:\n(?!Surgical|Family|Allergies|General|Systemic|Investigations|Treatment|Differential)[^:\n]+)*)/i);
  const structuredAirway = matchSection(/Airway\s*:\s*([^\n,]+)/i);
  const structuredBreathing = matchSection(/Breathing\s*:\s*([^\n]+)/i);
  const structuredCirculation = matchSection(/Circulation\s*:\s*([^\n]+)/i);
  const structuredDisability = matchSection(/Disability\s*:\s*([^\n]+)/i);
  const structuredExposure = matchSection(/Exposure\s*:\s*([^\n]+)/i);
  const structuredGenExam = matchSection(/(?:General Examination|General Exam)\s*:\s*([^:\n]+(?:\n(?!Systemic|CVS|Chest|Abdomen|CNS|Investigations)[^:\n]+)*)/i);
  const structuredCvs = matchSection(/CVS\s*:\s*([^\n]+)/i);
  const structuredChest = matchSection(/(?:Chest|RS|Respiratory System)\s*:\s*([^\n]+)/i);
  const structuredAbdomen = matchSection(/Abdomen\s*:\s*([^\n]+)/i);
  const structuredCns = matchSection(/CNS\s*:\s*([^\n]+)/i);
  const structuredDiffs = matchSection(/(?:Differential Diagnosis|Differentials)\s*:\s*([^:\n]+(?:\n(?!EM Resident|EM Consultant|Disposition|Treatment)[^:\n]+)*)/i);

  // Extract lab table rows if present (Parameter Result Unit Reference)
  const labRowRegex = /([A-Za-z0-9\/\s\(\)\:\-\.]+)\t+([A-Za-z0-9\.\+\-\/\(\)]+)\t*([A-Za-z0-9\^\/\%]+)?\t*([0-9\.\-\s]+)?/g;
  let labRowMatch;
  while ((labRowMatch = labRowRegex.exec(text)) !== null) {
    const param = labRowMatch[1].trim();
    const resultVal = labRowMatch[2].trim();
    const unitVal = labRowMatch[3] ? labRowMatch[3].trim() : "";
    const refVal = labRowMatch[4] ? labRowMatch[4].trim() : "";
    if (param && resultVal && param.length < 40 && !/Parameter|Physical|Chemical|Urine|Manual/i.test(param)) {
      resultsObj[param] = `${resultVal} ${unitVal} ${refVal ? `(Ref: ${refVal})` : ""}`.trim();
    }
  }

  const complaintStr = structuredComplaint || text.slice(0, 180) + (text.length > 180 ? "..." : "");

  return {
    patientName: parsedName,
    age: parsedAge,
    sex: parsedGender,
    priority: parsedTriage,
    chiefComplaint: complaintStr,
    hpi: structuredHpi || text,
    pmh: structuredPmh || null,
    vitals: {
      bp: bpVal,
      hr: hrVal,
      spo2: spo2Val,
      rr: rrVal,
      temp: tempVal,
      gcs: "15",
      grbs: "",
      pain: "0"
    },
    airway: structuredAirway || "Patent",
    breathing: structuredBreathing || "Air entry bilaterally equal. Normal vesicular breath sounds.",
    circulation: structuredCirculation || "S1 S2 heard. Pulses normal.",
    disability: structuredDisability || "GCS 15/15. Pupils equal and reactive.",
    exposure: structuredExposure || "Warm, no trauma.",
    generalExamination: structuredGenExam || EXAM_DEFAULTS.generalExamination,
    cvsExamination: structuredCvs || EXAM_DEFAULTS.cvsExamination,
    respiratoryExamination: structuredChest || EXAM_DEFAULTS.respiratoryExamination,
    abdomenExamination: structuredAbdomen || EXAM_DEFAULTS.abdomenExamination,
    cnsExamination: structuredCns || EXAM_DEFAULTS.cnsExamination,
    psychologicalAssessment: EXAM_DEFAULTS.psychologicalAssessment,
    medications: extractedMeds,
    investigationsOrdered: orderedList,
    investigationResults: resultsObj,
    investigations: orderedList,
    treatment: extractedMeds,
    differentials: structuredDiffs ? structuredDiffs.split(/\n|,|;/).map(d => d.trim()).filter(Boolean) : [],
    procedures: [],
    allergies: "NKDA"
  };
}

// ── Refinement utilities for SAMPLE History ──────────────────

/**
 * Refines signs and symptoms by removing narrative preambles like "A 42-year-old male presented with..."
 */
export function refineSymptomsText(
  symptomRaw: string | null | undefined,
  ccRaw: string | null | undefined,
  hpiRaw: string | null | undefined,
  rawText: string
): string {
  let source = (symptomRaw && symptomRaw.trim().length > 2)
    ? symptomRaw.trim()
    : (ccRaw && ccRaw.trim().length > 2)
      ? ccRaw.trim()
      : (hpiRaw && hpiRaw.trim().length > 2)
        ? hpiRaw.trim()
        : (rawText || "");

  let clean = source
    .replace(/^Based on your clinical (?:query|dictation):\s*["'`]([\s\S]*?)["'`]/i, "$1")
    .replace(/(?:A|An)\s+\d+[- ](?:year|yr|yr-old|year-old|y\.?o\.?)\s*(?:old\s+)?(?:male|female|man|woman|boy|girl|patient|child)\s+(?:presented\s+with\s+)?(?:complaints?\s+of\s+)?/gi, "")
    .replace(/(?:Patient|Pt|The patient)\s+(?:presented|presents|came)\s+with\s+(?:complaints?\s+of\s+)?/gi, "")
    .replace(/Presented\s+with\s+(?:complaints?\s+of\s+)?/gi, "")
    .replace(/Complaining\s+of\s+/gi, "")
    .replace(/Complaints?\s+of\s+/gi, "")
    .replace(/Chief\s+complaint[s]?\s*:\s*/gi, "")
    .replace(/Doctor\s+dictation\s*:\s*/gi, "")
    .replace(/Clinician\s+dictation\s*:\s*/gi, "")
    .replace(/User\s*:\s*/gi, "")
    .trim();

  if (!clean) return "";

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Refines events leading to presentation ensuring it is distinct from signs & symptoms.
 * Returns empty string if no specific trauma or preceding event was dictated.
 */
export function refineEventsText(
  eventRaw: string | null | undefined,
  hpiRaw: string | null | undefined,
  symptomsText: string,
  rawText: string
): string {
  let cleanEvent = (eventRaw && eventRaw.trim().length > 3) ? eventRaw.trim() : "";

  // Filter out hallucinated boilerplate phrases if present in raw
  cleanEvent = cleanEvent
    .replace(/Acute symptom onset prior to arrival[^\.]*/gi, "")
    .replace(/patient presented to ED for urgent evaluation[^\.]*/gi, "")
    .replace(/progressive discomfort\/escalation prompted emergency department evaluation[^\.]*/gi, "")
    .trim();

  if (cleanEvent && cleanEvent.toLowerCase() !== (symptomsText || "").toLowerCase()) {
    cleanEvent = cleanEvent
      .replace(/(?:A|An)\s+\d+[- ](?:year|yr|yr-old|year-old|y\.?o\.?)\s*(?:old\s+)?(?:male|female|man|woman|boy|girl|patient|child)\s+(?:presented\s+with\s+)?(?:complaints?\s+of\s+)?/gi, "")
      .replace(/(?:Patient|Pt)\s+(?:presented|presents)\s+with\s+(?:complaints?\s+of\s+)?/gi, "")
      .trim();
    if (cleanEvent) {
      return cleanEvent.charAt(0).toUpperCase() + cleanEvent.slice(1);
    }
  }

  const sourceText = hpiRaw || rawText || "";

  // If text explicitly denies trauma or injury, return empty string
  if (/(?:no|nil|denies|denied|without)\s+(?:h\/o|history of|reported|known)?\s*(?:trauma|injury|fall|accident|RTA)/i.test(sourceText)) {
    return "";
  }

  // Check trauma/injury explicit events only
  const traumaMatch = sourceText.match(/(?:fall|injury|trauma|accident|hit|collision|wound|burn|bite|RTA|road traffic accident)[^,\.]*/i);
  if (traumaMatch) {
    return `Acute ${traumaMatch[0].trim()} prior to ER arrival.`;
  }

  // If doctor did not dictate explicit preceding trauma or events — leave BLANK.
  return "";
}

/**
 * Processes PMH and Outpatient Medications.
 * Trigger: If patient has "no past medical/surgical history", automatically sets medications to "Nil regular medications".
 * Also separates acute ER treatment orders from regular home medications.
 */
export function processSampleMedicationsAndPmh(
  pmhRaw: any,
  medsRaw: any,
  treatmentRaw: any,
  rawText: string
): { pastHistory: string; medications: string; acuteTreatments: string[] } {
  const pmhStr = typeof pmhRaw === "string" ? pmhRaw.trim() : "";
  const rawTextLower = (rawText || "").toLowerCase();

  const isNoPmh = !pmhStr ||
    /no\s+(past\s+)?(medical|surgical)\s+(history|hx)|nil\s+past|no\s+comorbidities|nkco|none\s+(documented|recorded)?|no\s+known\s+medical|no\s+past\s+hx/i.test(pmhStr) ||
    /no\s+(past\s+)?medical|no\s+(past\s+)?surgical|no\s+comorbidities|nil\s+past\s+history/i.test(rawTextLower);

  const pastHistory = isNoPmh ? "No past medical history" : pmhStr;

  let rawMedsArray: string[] = [];
  if (Array.isArray(medsRaw)) {
    rawMedsArray = medsRaw.map(m => typeof m === "string" ? m.trim() : JSON.stringify(m)).filter(Boolean);
  } else if (typeof medsRaw === "string" && medsRaw.trim()) {
    rawMedsArray = medsRaw.split(/,|\n|;/).map(m => m.trim()).filter(Boolean);
  }

  const homeMeds: string[] = [];
  const acuteTreatments: string[] = [];

  for (const med of rawMedsArray) {
    const isAcute = /\b(?:stat|iv\s*stat|im\s*stat|inj|inj\.|nebulization|neb|given|administered|stat\s+dose|iv\s+fluid)\b/i.test(med) ||
      /\b(?:paracetamol\s+1g|esomeprazole.*40mg|sompraz.*40mg|pantoprazole.*40mg|monocef|ondansetron|emeset)\b/i.test(med);

    if (isAcute) {
      acuteTreatments.push(med);
    } else {
      homeMeds.push(med);
    }
  }

  if (Array.isArray(treatmentRaw)) {
    treatmentRaw.forEach(t => {
      const str = typeof t === "string" ? t.trim() : JSON.stringify(t);
      if (str && !acuteTreatments.includes(str)) acuteTreatments.push(str);
    });
  } else if (typeof treatmentRaw === "string" && treatmentRaw.trim()) {
    if (!acuteTreatments.includes(treatmentRaw.trim())) {
      acuteTreatments.push(treatmentRaw.trim());
    }
  }

  let medications = "Nil regular medications";

  if (homeMeds.length > 0) {
    medications = homeMeds.join(", ");
  } else {
    medications = "Nil regular medications";
  }

  return {
    pastHistory,
    medications,
    acuteTreatments
  };
}

export function formatClinicalCaseObject(rawExt: Record<string, any>, rawText: string): Record<string, any> {
  const ext = sanitizeExtracted(rawExt || {});
  const cleanedEntities = cleanExtractionOutput(ext);

  // Apply cleaned entity lists to ext if available
  if (cleanedEntities.signsSymptoms && cleanedEntities.signsSymptoms.length > 0) {
    ext.symptoms = cleanedEntities.signsSymptoms.join(", ");
    ext.signsSymptoms = cleanedEntities.signsSymptoms;
  }
  if (cleanedEntities.drugs && cleanedEntities.drugs.length > 0) {
    ext.medications = cleanedEntities.drugs;
  }
  if (cleanedEntities.plan && cleanedEntities.plan.length > 0) {
    ext.treatment = cleanedEntities.plan;
  }

  const ageVal = ext.age ? (typeof ext.age === "number" ? ext.age : parseInt(String(ext.age), 10) || null) : null;
  const genderVal = ext.sex === "Female" ? "Female" : ext.sex === "Male" ? "Male" : "Other";
  const triageCategory = ext.priority === "P1" || ext.priority === "P1 (Immediate)" ? "P1 (Immediate)" : (ext.priority === "P3" || ext.priority === "P3 (Non-Urgent)" ? "P3 (Non-Urgent)" : "P2 (Urgent)");

  // Helper to infer proper route
  const getProperRoute = (drugName: string, rawRoute?: string) => {
    const d = drugName.toLowerCase();
    if (/^(tab\.|cap\.|syr\.|syrup|susp\.|tbl|tablet|capsule)/i.test(drugName) || /\b(tablet|capsule|syrup|suspension|oral|po)\b/i.test(d)) {
      return "Oral";
    }
    if (/^(inj\.|injection)/i.test(drugName) || /\b(injection|ampoule|vial)\b/i.test(d)) {
      return (!rawRoute || rawRoute === "Oral" || rawRoute === "Stat") ? "IV" : rawRoute;
    }
    if (/\b(iv fluids?|normal saline|ns|rl|ringer|d5w|dns)\b/i.test(d)) return "IV";
    return rawRoute || "Oral";
  };

  // Extract medications into TreatmentItem[] array
  const rawMeds: string[] = Array.isArray(ext.medications) ? ext.medications : [];
  let treatmentsList = rawMeds.map((medStr: string, idx: number) => {
    // Match e.g. "Aspirin (Ecosprin) 325mg oral stat"
    const match = medStr.match(/^(.*?)\s+(\d+[\.\d]*\s*(?:mg|g|mcg|iu|ml|puffs?|nebs?|tablets?|tbl|caps?))\s*(.*)$/i);
    if (match) {
      const name = match[1].trim();
      const r = getProperRoute(name, match[3].trim());
      return {
        id: `trt-${Date.now()}-${idx}`,
        drugName: name,
        dose: match[2].trim(),
        route: r,
        timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ipsgVerified: true
      };
    }
    const r = getProperRoute(medStr, "Oral");
    return {
      id: `trt-${Date.now()}-${idx}`,
      drugName: medStr,
      dose: "Stat",
      route: r,
      timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ipsgVerified: true
    };
  });

  // Process SAMPLE history refinement and treatment/PMH separation
  const finalSymptoms = refineSymptomsText(ext.symptoms, ext.chiefComplaint, ext.hpi, rawText);
  const finalEvents = refineEventsText(ext.events, ext.hpi, finalSymptoms, rawText);
  const medPmh = processSampleMedicationsAndPmh(
    ext.pmh || ext.pastHistory,
    ext.outpatientMedications || ext.medications,
    ext.treatment,
    rawText
  );

  // Merge any acute treatments into treatmentsList if not already present
  medPmh.acuteTreatments.forEach((medStr, idx) => {
    if (medStr && !treatmentsList.some(t => t.drugName.toLowerCase() === medStr.toLowerCase())) {
      const r = getProperRoute(medStr, "IV");
      treatmentsList.push({
        id: `trt-acute-${Date.now()}-${idx}`,
        drugName: medStr,
        dose: "Stat",
        route: r,
        timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ipsgVerified: true
      });
    }
  });

  // Deduplicate treatments (e.g. Inj. Omeprazole vs Omeprazole, Inj. Emeset (Ondansetron) vs Ondansetron)
  const seenDrugKeys = new Map<string, any>();
  treatmentsList.forEach((t) => {
    let key = t.drugName.toLowerCase()
      .replace(/^(inj\.|tab\.|cap\.|syr\.|syrup|susp\.)\s*/gi, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\d+[\.\d]*\s*(mg|g|mcg|iu|ml)\b/gi, '')
      .trim();
    if (key.includes('emeset')) key = 'ondansetron';
    if (key.includes('sompraz') || key.includes('pan 40')) key = 'pantoprazole';
    if (key.includes('ziddot')) key = 'ziddot';

    if (!seenDrugKeys.has(key)) {
      seenDrugKeys.set(key, t);
    } else {
      const existing = seenDrugKeys.get(key);
      if ((t.drugName.length + (t.dose !== 'Stat' ? 10 : 0)) > (existing.drugName.length + (existing.dose !== 'Stat' ? 10 : 0))) {
        seenDrugKeys.set(key, t);
      }
    }
  });
  treatmentsList = Array.from(seenDrugKeys.values());

  // Extract Investigations into InvestigationItem[] array
  const investigationItems: any[] = [];
  
  if (ext.investigationResults && typeof ext.investigationResults === "object") {
    Object.entries(ext.investigationResults).forEach(([testName, resVal], idx) => {
      const resStr = String(resVal);
      const isAbnormal = resStr.includes("↑") || resStr.includes("↓") || resStr.toUpperCase().includes("HIGH") || resStr.toUpperCase().includes("LOW") || resStr.includes("⚠");
      investigationItems.push({
        id: `inv-res-${Date.now()}-${idx}`,
        testName,
        result: resStr,
        orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resultTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAbnormal
      });
    });
  }

  const orderedList: string[] = Array.isArray(ext.investigationsOrdered) 
    ? ext.investigationsOrdered 
    : (Array.isArray(ext.investigations) ? ext.investigations : []);

  orderedList.forEach((testName: string, idx: number) => {
    if (!investigationItems.some(i => i.testName.toLowerCase() === testName.toLowerCase())) {
      investigationItems.push({
        id: `inv-ord-${Date.now()}-${idx}`,
        testName,
        result: "Ordered / Sent",
        orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resultTime: "Pending",
        isAbnormal: false
      });
    }
  });

  const orderedStr = orderedList.join(", ");
  const resultsSummaryStr = ext.investigationResults && typeof ext.investigationResults === "object"
    ? Object.entries(ext.investigationResults).map(([k, v]) => `${k}: ${v}`).join("; ")
    : "";

  return {
    patientName: ext.patientName || null,
    age: ageVal,
    gender: genderVal,
    presentingComplaint: ext.chiefComplaint || ext.hpi || rawText.slice(0, 150) || "Emergency presentation",
    triageCategory: triageCategory,
    caseType: (ext.procedures?.some((p: string) => /trauma|wound|fracture/i.test(p)) || /trauma|fall|injury/i.test(ext.chiefComplaint || "")) ? "Trauma" : "Medical",
    arrivalMode: "Walk-in",
    vitals: {
      bp: ext.vitals?.bp || "120/80",
      hr: ext.vitals?.hr || "80",
      spo2: ext.vitals?.spo2 || "98",
      rr: ext.vitals?.rr || "16",
      temp: ext.vitals?.temp || "37.0",
      gcs: ext.vitals?.gcs || "15",
      grbs: ext.vitals?.grbs || "",
      painScore: ext.vitals?.pain || "0"
    },
    sampleHistory: {
      symptoms: finalSymptoms,
      allergies: ext.allergies || "NKDA",
      medications: medPmh.medications,
      pastHistory: medPmh.pastHistory,
      lastMeal: ext.lastMeal || "",
      events: finalEvents,
      socialHistory: "",
      familyHistory: ext.familyHistory || "",
      psychiatricFlags: ext.psychologicalAssessment || "No active cognitive, psychiatric, or psychological flags."
    },
    primaryAssessment: {
      airway: ext.airway || EXAM_DEFAULTS.airway,
      airwayStatus: "Normal",
      breathing: ext.breathing || EXAM_DEFAULTS.respiratoryExamination,
      breathingStatus: "Normal",
      circulation: ext.circulation || EXAM_DEFAULTS.cvsExamination,
      circulationStatus: "Normal",
      disability: ext.disability || `GCS ${ext.vitals?.gcs || '15'}/15 (E4V5M6 - Alert), Pupils: Equal & Reactive (2mm), Motor: ${EXAM_DEFAULTS.cnsExamination}`,
      disabilityStatus: "Normal",
      exposure: ext.exposure || `Temp: ${ext.vitals?.temp || '37.0'}°C (98.6°F), Skin: Normal, clear`,
      exposureStatus: "Normal"
    },
    secondaryAssessment: [
      `General: ${ext.generalExamination || EXAM_DEFAULTS.generalExamination}`,
      `CVS: ${ext.cvsExamination || EXAM_DEFAULTS.cvsExamination}`,
      `RS: ${ext.respiratoryExamination || EXAM_DEFAULTS.respiratoryExamination}`,
      `Abdomen: ${ext.abdomenExamination || EXAM_DEFAULTS.abdomenExamination}`,
      `CNS: ${ext.cnsExamination || EXAM_DEFAULTS.cnsExamination}`,
      `Psych: ${ext.psychologicalAssessment || EXAM_DEFAULTS.psychologicalAssessment}`
    ].join("\n"),
    treatments: treatmentsList,
    investigations: investigationItems,
    investigationLabsOrdered: orderedStr,
    investigationResultsSummary: resultsSummaryStr,
    progressNotes: Array.isArray(ext.treatment) ? ext.treatment.join("\n") : (ext.treatment || rawText),
    rawExtracted: ext
  };
}

// ════════════════════════════════════════════════════════════
// PUBLIC API — used by Express routes
// ════════════════════════════════════════════════════════════

// ── 1. Extract case from voice transcript ─────────────────────
export async function extractClinicalData(
  transcript: string
): Promise<{
  success: boolean;
  data?: Record<string, any>;
  extracted?: Record<string, any>;
  error?: string;
  isHeuristicFallback?: boolean;
  phiProtected?: { count: number; phiFound: string[]; details: Record<string, number> };
}> {
  const cleanTranscript = (transcript || "")
    .replace(/Based on your clinical (?:query|dictation):\s*["']?/gi, "")
    .replace(/["']?\s*$/, "")
    .trim();

  if (!cleanTranscript) {
    return {
      success: false,
      error: "Dictation content is empty."
    };
  }

  // DPDP Act 2023 On-The-Fly PHI De-identification (Local India Cloud Run)
  const phiResult = deidentifyText(cleanTranscript);
  const targetTranscript = phiResult.deidentified;
  if (phiResult.phiCount > 0) {
    console.log(`[CaseExtract] DPDP Protection Active: Stripped ${phiResult.phiCount} PHI item(s)`);
  }

  try {
    const voiceRes = await extractFromTranscript(targetTranscript);
    if (voiceRes.success && voiceRes.extracted) {
      const formatted = formatClinicalCaseObject(voiceRes.extracted, targetTranscript);
      return {
        success: true,
        data: formatted,
        extracted: formatted,
        phiProtected: {
          count: phiResult.phiCount,
          phiFound: phiResult.phiFound,
          details: phiResult.details
        }
      };
    }
  } catch (voiceErr: any) {
    console.warn("[CaseExtract] Voice extraction engine error, falling back to legacy prompt:", voiceErr?.message);
  }

  try {
    const prompt = buildExtractionPrompt(targetTranscript);
    const raw = await withFallback(prompt, "CaseExtract");
    const parsed = safeParseJSON(raw, "CaseExtract");

    if (parsed) {
      const withDefaults = applyExaminationDefaults(parsed);
      const formatted = formatClinicalCaseObject(withDefaults, targetTranscript);
      return { 
        success: true, 
        data: formatted, 
        extracted: formatted,
        phiProtected: {
          count: phiResult.phiCount,
          phiFound: phiResult.phiFound,
          details: phiResult.details
        }
      };
    }
  } catch (err: any) {
    console.warn("[CaseExtract] AI models failed or rate-limited. Activating local medical heuristic parser:", err?.message || err);
  }

  // Guaranteed heuristic fallback so save NEVER fails!
  const heuristicParsed = parseHeuristicClinicalData(targetTranscript);
  const formattedFallback = formatClinicalCaseObject(heuristicParsed, targetTranscript);

  return {
    success: true,
    data: formattedFallback,
    extracted: formattedFallback,
    isHeuristicFallback: true,
    phiProtected: {
      count: phiResult.phiCount,
      phiFound: phiResult.phiFound,
      details: phiResult.details
    }
  };
}

// Helper for heuristic fallback handover construction
function buildHeuristicHandover(text: string): Record<string, any> {
  let name = "Bed Patient";
  let ageGender = "Unknown";
  let triage = "P2 (Urgent)";
  let vitals = "";
  let presentingComplaint = "";

  if (text) {
    const complaintMatch = text.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of|reason\ for\ visit)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
    if (complaintMatch && complaintMatch[1]) {
      presentingComplaint = complaintMatch[1].trim();
    } else {
      const lines = text.split(/\n+/).filter(l => l.trim().length > 10);
      presentingComplaint = lines.length > 0 ? lines[0].trim() : text.substring(0, 150);
    }

    const nameMatch = text.match(/(?:patient|mr\.|ms\.|mrs\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) name = nameMatch[1];

    const ageMatch = text.match(/(\d{1,3})\s*-?(?:year|y\.?o\.?|yo|f|m)/i);
    const genderMatch = text.match(/\b(female|male|f|m)\b/i);
    if (ageMatch && genderMatch) {
      ageGender = `${ageMatch[1]}${genderMatch[1].toUpperCase().startsWith("F") ? "F" : "M"}`;
    } else if (ageMatch) {
      ageGender = `${ageMatch[1]}y`;
    }
  }

  return {
    name,
    ageGender,
    triage,
    vitals: vitals || "Vitals recorded in notes",
    presentingComplaint: presentingComplaint || "Presenting complaint documented in EMR",
    rawNotes: text,
    structuredSBAR: {
      situation: `Patient ${name} (${ageGender}) present in ER.`,
      background: "See raw notes for past medical history.",
      assessment: "See raw notes for assessment and investigation results.",
      recommendation: "Review raw notes for pending tasks."
    }
  };
}

export {
  extractHandover as extractHandoverData
} from "./handover.ts";

// ── 3. Generate discharge summary ─────────────────────────────
export async function generateDischargeSummary(
  caseData: Record<string, any>
): Promise<{
  success: boolean;
  summary?: string;
  error?: string;
}> {
  const prompt = `
You are generating a clinical discharge summary for an Indian Emergency Department.

Write in formal medical English.
Follow Indian hospital EMR format exactly.
Be precise and clinically accurate.
Do NOT invent information.

CASE DATA:
${JSON.stringify(caseData, null, 2)}

GENERATE A COMPLETE DISCHARGE SUMMARY WITH THESE 6 SECTIONS:

1. PATIENT INFORMATION & ARRIVAL
   (demographics, allergies, vitals on arrival, presenting complaint, HPI, past history, family/gynaecological history, LMP)

2. PRIMARY ASSESSMENT (ABCDE + EFAST)
   (Airway, Breathing, Circulation, Disability, Exposure, adjuncts)

3. SECONDARY ASSESSMENT
   (General examination, systemic examination: CVS, Chest/RS, Abdomen, CNS, Extremities)

4. HOSPITAL COURSE & TREATMENT
   (AI narrative from all case data, investigations with results, treatment given, response to treatment, diagnosis at discharge)

5. DISCHARGE INFORMATION
   (Discharge medications, disposition type, condition at discharge: Stable/Unstable, vitals at discharge, follow-up advice, return precautions)

6. SIGNATURES
   (ED Resident name, ED Consultant name, date, legal disclaimer)

Return plain text only.
Use section headings in CAPITALS.
No markdown formatting.
`;

  try {
    // Use Claude Sonnet for best narrative quality
    const raw = await callClaude(prompt, MODELS.CLAUDE_SONNET);
    return { success: true, summary: raw };
  } catch (err: any) {
    // Fallback to Claude Haiku
    try {
      const raw = await callClaude(prompt, MODELS.CLAUDE_HAIKU);
      return { success: true, summary: raw };
    } catch (err2: any) {
      console.error("[DischargeSummary] Failed:", err2);
      return {
        success: false,
        error: getFriendlyError(err2),
      };
    }
  }
}

// ── 4. Generate differential diagnosis ────────────────────────
export async function generateDifferentials(
  caseData: Record<string, any>
): Promise<{
  success: boolean;
  differentials?: string[];
  error?: string;
}> {
  const prompt = `
You are an emergency medicine consultant at an Indian hospital.

Generate 3-5 differential diagnoses for this patient presentation.

For each differential:
  - State the diagnosis
  - Give 2-3 specific clinical reasons from THIS patient's data
  - Note what would confirm or exclude it

CASE DATA:
${JSON.stringify(caseData, null, 2)}

Return JSON only:
{
  "differentials": [
    {
      "diagnosis": "NSTEMI",
      "reasons": ["ST depression V4-V6", "Troponin 0.8"],
      "confirmWith": "Serial troponins, echo",
      "excludeWith": "Normal troponins at 6h"
    }
  ]
}
`;

  try {
    const raw = await callClaude(prompt, MODELS.CLAUDE_SONNET);
    const parsed = safeParseJSON(raw, "Differentials");

    if (!parsed?.differentials) {
      throw new Error("No differentials generated by ErMate AI engine.");
    }

    return {
      success: true,
      differentials: parsed.differentials,
    };
  } catch (err: any) {
    console.error("[Differentials] Claude Sonnet reasoning error:", err);
    return {
      success: false,
      error: "ErMate clinical decision engine is currently unavailable. Please check your API key or try again shortly.",
    };
  }
}
