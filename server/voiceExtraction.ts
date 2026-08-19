import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { deidentifyText } from './deidentify.ts';

export const VOICE_EXTRACTION_PROMPT = `
You are a clinical data extraction engine for Indian Emergency Departments.

CRITICAL — READ FIRST:
The doctor will dictate patient details in this typical pattern:
"Patient name is [NAME], [AGE] year old [male/female], presented with [COMPLAINT]"
OR in Malayalam/Hindi/Tamil/Telugu/Kannada mixed:
"[NAME] chekkan/chechi, [AGE] vayassu, [COMPLAINT] aanu"
OR just clinical details without a name:
"57 year old female, fever since 3 days" (name not mentioned → patientName = null)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD EXTRACTION — EXACT RULES
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD SEPARATION IS CRITICAL:
  patientName    = person's name (proper noun only)
  age            = number (years)
  sex            = Male/Female
  chiefComplaint = main symptoms / duration
  
  These are FOUR DIFFERENT fields.
  NEVER merge them.
  NEVER put symptoms in name.
  NEVER put name in complaint.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

symptoms (History of Present Illness):
  Clinical narrative paragraph.
  Expand what doctor said into a proper HPI.
  Use ONLY what was dictated.
  
  NEVER generate:
  "Acute symptom onset prior to arrival"
  "Patient presented to ED for evaluation"
  "Events Leading Up to Presentation"
  "Progressive discomfort"
  Any text doctor did not say.
  If not dictated → ""

signsAndSymptoms:
  Physical examination findings ONLY.
  What the doctor found on physical examination (e.g. "Pallor present, throat congestion, chest clear").
  NOT the history. NOT the chief complaint.
  If doctor didn't state physical exam findings → return "" (empty string).
  NEVER fill with history or complaint text.

events (Preceding Events / Trauma):
  ONLY for:
  Road traffic accidents, falls from height, assault/injuries, burns, drowning, poisoning, specific mechanism of injury.
  
  If NOT a trauma case → return ""
  NEVER generate generic text here.
  Medical cases (fever, chest pain, breathlessness, abdominal pain) → events = ""

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

PRIMARY SURVEY EXTRACTION:
  Map vitals to the correct ABCDE field:
  
  B — Breathing:
    RR → breathing.rr
    SpO₂ → breathing.spo2
    O₂ delivery method → breathing.o2Delivery
    "Air entry bilaterally equal" → breathing.airEntry
    
  C — Circulation:
    HR → circulation.hr
    BP → circulation.sbp / circulation.dbp
    CRT → circulation.crt
    EFAST findings → circulation.efast.*
    ECG → circulation.ecg
    
  D — Disability:
    GCS → disability.gcsE / gcsV / gcsM
    Pupils → disability.pupilSizeR/L + reaction
    GRBS → disability.grbs
    
  E — Exposure:
    Temperature → exposure.temp
    Skin findings → exposure.skin
    Log roll (trauma only) → exposure.logRoll

  DO NOT put vitals in free text fields.
  Map each vital to its exact ABCDE location.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION LABELS — use EXACTLY:
  "Chief Complaint"
  "History of Present Illness"
  "Signs and Symptoms"
  "Past Medical History"
  NOT "Patient History & Presentation"
  NOT "Events Leading Up to Presentation"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIORITY INFERENCE:
  STEMI/NSTEMI/Severe sepsis → P1
  Chest pain/Altered GCS/Stroke → P2
  Moderate pain/Stable vitals → P3
  Never P4 for cardiac/neuro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid JSON. No markdown. No explanation. No preamble.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "patientName": string | null,
  "age": string | null,
  "sex": "Male" | "Female" | "Unknown",
  "priority": "P1" | "P2" | "P3" | "P4" | "P5",
  "chiefComplaint": string,
  "symptoms": string,
  "signsAndSymptoms": string,
  "events": string,
  "vitals": {
    "hr": string | null,
    "bp": string | null,
    "spo2": string | null,
    "rr": string | null,
    "temp": string | null,
    "gcs": string | null,
    "grbs": string | null
  },
  "airway": string | null,
  "breathing": string | null,
  "circulation": string | null,
  "disability": string | null,
  "pastMedicalHistory": string | null,
  "medications": string[],
  "allergies": string | null,
  "surgicalHistory": string | null,
  "familyHistory": string | null,
  "lmp": string | null,
  "generalExamination": string | null,
  "cvsExamination": string | null,
  "respiratoryExam": string | null,
  "abdomenExamination": string | null,
  "cnsExamination": string | null,
  "investigations": string[],
  "treatment": string[],
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

function applyExamDefaults(extracted: Record<string, any>): Record<string, any> {
  const result = { ...extracted };

  const EXAM_DEFAULTS: Record<string, string> = {
    generalExamination: 'No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.',
    cvsExamination: 'S1 S2 heard. No murmurs.',
    respiratoryExam: 'Air entry bilaterally equal. No added sounds.',
    abdomenExamination: 'Soft, non-tender. No organomegaly. Bowel sounds present.',
    cnsExamination: 'Moving all four limbs. No focal neurological deficit.',
  };

  for (const [field, defaultVal] of Object.entries(EXAM_DEFAULTS)) {
    if (!result[field] || typeof result[field] !== 'string' || result[field].trim() === '') {
      result[field] = defaultVal;
      result[`${field}_isDefault`] = true;
    } else {
      result[`${field}_isDefault`] = false;
    }
  }

  if (!result.airway) {
    result.airway = 'Patent';
    result.airway_isDefault = true;
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
      const sanitized = sanitizeExtracted(parsed);
      const withDefaults = applyExamDefaults(sanitized);

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
        model: 'claude-3-5-haiku-20241022',
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
      const sanitized = sanitizeExtracted(parsed);
      const withDefaults = applyExamDefaults(sanitized);

      console.log(`[VoiceExtract] Claude Haiku fallback succeeded`);
      return { success: true, extracted: withDefaults, engine: 'claude-3-5-haiku-20241022' };
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
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        temperature: 0.0,
        system: VOICE_EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: `Transcript:\n"""\n${deidentifiedTranscript}\n"""` }],
      });

      const rawText = (msg.content[0] as any)?.text || '{}';
      const cleanedJSON = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/s, '').trim();
      const parsed = JSON.parse(cleanedJSON);
      const sanitized = sanitizeExtracted(parsed);
      const withDefaults = applyExamDefaults(sanitized);

      console.log('[VoiceExtract] Claude Haiku retry succeeded');
      return { success: true, extracted: withDefaults, engine: 'claude-3-5-haiku-20241022-retry' };
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
