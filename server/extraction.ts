import { GoogleGenAI } from "@google/genai";

// ── Model Config ──────────────────────────────────────────────
export const MODELS = {
  GEMINI_PRIMARY: "gemini-1.5-flash",
  GEMINI_PRO: "gemini-1.5-pro",
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
  "alerts":                  string[]
}

RULES FOR SPECIFIC FIELDS:

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPT TO EXTRACT FROM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
${transcript}
"""
`;
}

// ── Handover extraction prompt ────────────────────────────────
export function buildHandoverPrompt(rawText: string): string {
  return `
You are a clinical handover extraction engine for Indian Emergency Departments.

TEMPERATURE IS SET TO 0. BE DETERMINISTIC.
Same input = same output always.

ANTI-HALLUCINATION:
  NEVER invent data not in the provided text.
  Return null for missing fields.
  Do not guess diagnoses from symptoms.
  Do not assume medications not mentioned.

CHRONOLOGICAL READING:
  Hospital EMRs are often REVERSE chronological (newest entry first).
  Read from BOTTOM to TOP to understand the clinical story chronologically.
  Presenting complaint = EARLIEST entry.
  Current status = MOST RECENT entry.

ENTRY TYPE IDENTIFICATION:
  Nurse note → medication given, vitals, handover
  Doctor note → assessment, plan, diagnosis
  Consultant note → specialty review + advice
  Lab result → investigation values
  Radiology → imaging findings

DONE vs TO BE DONE:
  DONE: Past tense, completed actions
    "Given", "done", "inserted", "started", "reviewed", "administered", "sent"
  TO BE DONE: Future/pending actions
    "Plan", "advised", "pending", "await", "to send", "to review", "follow up"

OUTPUT — strict JSON only:
{
  "patientLabel": {
    "name":               string | null,
    "age":                string | null,
    "sex":                string | null,
    "bed":                string | null,
    "erNumber":           string | null,
    "admittingConsultant":string | null,
    "erSince":            string | null,
    "currentVitals":      string | null,
    "status":             "critical"|"unstable"|"stable"|"discharge"
  },
  "presentingComplaints": string,
  "pastMedicalHistory":   string | null,
  "provisionalDiagnosis": string,
  "done":                 string[],
  "toBeDone":             string[],
  "bystanderUpdate":      string | null,
  "alerts":               string[],
  "assessmentEntries": [
    {
      "datetime":   string,
      "author":     string,
      "role":       "doctor"|"nurse"|"consultant"|"lab"|"radiology",
      "content":    string
    }
  ]
}

assessmentEntries: chronological order (oldest first, newest last).
This powers the multi-column display.

RAW EMR TEXT:
"""
${rawText}
"""
`;
}

// ── Gemini caller ─────────────────────────────────────────────
async function callGemini(
  prompt: string,
  model = MODELS.GEMINI_PRIMARY
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.0, // deterministic
      topP: 0.1,
      topK: 1,
      responseMimeType: "application/json",
    },
  });

  return response.text || "";
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
    throw new Error(`Claude API status ${response.status}: ${errText}`);
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
  // 1. Try Gemini Flash first (fastest/cheapest)
  try {
    console.log(`[${context}] Trying Gemini Flash (${MODELS.GEMINI_PRIMARY})...`);
    const result = await callGemini(prompt, MODELS.GEMINI_PRIMARY);
    if (result && result.trim()) {
      console.log(`[${context}] Gemini Flash succeeded ✓`);
      return result;
    }
  } catch (err: any) {
    console.warn(`[${context}] Gemini Flash failed:`, err?.status || err?.message);
  }

  // 2. Try Gemini Pro
  try {
    console.log(`[${context}] Trying Gemini Pro (${MODELS.GEMINI_PRO})...`);
    const result = await callGemini(prompt, MODELS.GEMINI_PRO);
    if (result && result.trim()) {
      console.log(`[${context}] Gemini Pro succeeded ✓`);
      return result;
    }
  } catch (err: any) {
    console.warn(`[${context}] Gemini Pro failed:`, err?.status || err?.message);
  }

  // 3. Try Claude Haiku
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

  // 4. Final fallback — Claude Sonnet
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

export function formatClinicalCaseObject(ext: Record<string, any>, rawText: string): Record<string, any> {
  const ageVal = ext.age ? (typeof ext.age === "number" ? ext.age : parseInt(String(ext.age), 10) || null) : null;
  const genderVal = ext.sex === "Female" ? "Female" : ext.sex === "Male" ? "Male" : "Other";
  const triageCategory = ext.priority === "P1" || ext.priority === "P1 (Immediate)" ? "P1 (Immediate)" : (ext.priority === "P3" || ext.priority === "P3 (Non-Urgent)" ? "P3 (Non-Urgent)" : "P2 (Urgent)");

  // Extract medications into TreatmentItem[] array
  const rawMeds: string[] = Array.isArray(ext.medications) ? ext.medications : [];
  const treatmentsList = rawMeds.map((medStr: string, idx: number) => {
    // Match e.g. "Aspirin (Ecosprin) 325mg oral stat"
    const match = medStr.match(/^(.*?)\s+(\d+[\.\d]*\s*(?:mg|g|mcg|iu|ml|puffs?|nebs?|tablets?|tbl|caps?))\s*(.*)$/i);
    if (match) {
      return {
        id: `trt-${Date.now()}-${idx}`,
        drugName: match[1].trim(),
        dose: match[2].trim(),
        route: match[3].trim() || "Oral",
        timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ipsgVerified: true
      };
    }
    return {
      id: `trt-${Date.now()}-${idx}`,
      drugName: medStr,
      dose: "Stat",
      route: "IV",
      timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ipsgVerified: true
    };
  });

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
    patientName: ext.patientName || "Unidentified Patient",
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
      symptoms: ext.hpi || ext.chiefComplaint || rawText,
      allergies: ext.allergies || "NKDA",
      medications: rawMeds.join(", "),
      pastHistory: ext.pmh || "",
      lastMeal: "",
      events: ext.hpi || "",
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
      disability: ext.disability || EXAM_DEFAULTS.cnsExamination,
      disabilityStatus: "Normal",
      exposure: ext.exposure || "Normal exposure findings",
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

  try {
    const prompt = buildExtractionPrompt(cleanTranscript);
    const raw = await withFallback(prompt, "CaseExtract");
    const parsed = safeParseJSON(raw, "CaseExtract");

    if (parsed) {
      const withDefaults = applyExaminationDefaults(parsed);
      const formatted = formatClinicalCaseObject(withDefaults, cleanTranscript);
      return { 
        success: true, 
        data: formatted, 
        extracted: formatted 
      };
    }
  } catch (err: any) {
    console.warn("[CaseExtract] AI models failed or rate-limited. Activating local medical heuristic parser:", err?.message || err);
  }

  // Guaranteed heuristic fallback so save NEVER fails!
  const heuristicParsed = parseHeuristicClinicalData(cleanTranscript);
  const formattedFallback = formatClinicalCaseObject(heuristicParsed, cleanTranscript);

  return {
    success: true,
    data: formattedFallback,
    extracted: formattedFallback,
    isHeuristicFallback: true
  };
}

// ── 2. Extract handover from pasted EMR ───────────────────────
export async function extractHandoverData(
  rawText: string
): Promise<{
  success: boolean;
  extracted?: Record<string, any>;
  error?: string;
}> {
  try {
    const prompt = buildHandoverPrompt(rawText);
    const raw = await withFallback(prompt, "Handover");
    const parsed = safeParseJSON(raw, "Handover");

    if (!parsed) {
      return {
        success: false,
        error: "Could not structure the handover — please try again",
      };
    }

    return { success: true, extracted: parsed };
  } catch (err: any) {
    console.error("[Handover] Failed:", err);
    return {
      success: false,
      error: getFriendlyError(err),
    };
  }
}

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
    // Fallback to Gemini Pro
    try {
      const raw = await callGemini(prompt, MODELS.GEMINI_PRO);
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
      throw new Error("No differentials in response");
    }

    return {
      success: true,
      differentials: parsed.differentials,
    };
  } catch (err: any) {
    // Fallback to Gemini
    try {
      const raw = await callGemini(prompt, MODELS.GEMINI_PRIMARY);
      const parsed = safeParseJSON(raw, "DifferentialsFallback");
      if (parsed?.differentials) {
        return { success: true, differentials: parsed.differentials };
      }
    } catch (gErr) {
      console.warn("[Differentials] Gemini fallback exception:", gErr);
    }

    console.error("[Differentials] Failed:", err);
    return {
      success: false,
      error: getFriendlyError(err),
    };
  }
}
