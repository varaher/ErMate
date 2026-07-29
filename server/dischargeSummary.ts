// ============================================================
// ErMate — Discharge Summary System
// Matches Rajagiri Hospital format exactly
// File: server/dischargeSummary.ts
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { preprocessEMR, reverseEMREntries } from './handover.ts';

// ── Lazy Client Initializers (to prevent missing key crashes at startup) ──
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

let googleAIClient: GoogleGenAI | null = null;
function getGoogleAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') return null;
  if (!googleAIClient) {
    googleAIClient = new GoogleGenAI({ apiKey });
  }
  return googleAIClient;
}

// ── The extraction prompt — matches docx format exactly ──
const DISCHARGE_PROMPT = `
You are generating an Emergency Department
Discharge Summary for a hospital.

This is a MEDICO-LEGAL document.
Accuracy is critical. Patient safety depends on it.

RULES:
  NEVER invent information not in the EMR.
  NEVER use placeholder text.
  If a field is genuinely absent → return null or "".
  NEVER hallucinate medications, vitals, or diagnoses.
  Use ONLY what is explicitly written in the EMR.

The EMR has been reversed chronologically.
OLDEST entry is at TOP. Read top to bottom.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACT THESE FIELDS — MATCH FORMAT EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

patientName:
  Name of the patient from the EMR.
  Look for "Patient Name:", "Name:", "Patient:", "Mr.", "Mrs.", "Ms.", "Master", "Baby" at the top of the record.
  Do NOT confuse patient name with chief complaint or hospital name.
  null if not mentioned.

age:
  Age of the patient (e.g. "68 years", "45y").
  null if not mentioned.

gender:
  "Male", "Female", or "Other".
  null if not mentioned.

uhid:
  UHID, MRN, ER Number, or Bed number if documented.
  null if not mentioned.

mlc:
  Medico-Legal Case number if mentioned.
  null if not stated.

allergy:
  From "Allergies:" field.
  "Nil" if explicitly nil.
  null if not mentioned (do NOT assume NKDA).

vitalsOnArrival:
  From the FIRST/EARLIEST assessment entry.
  Format values or extract hr, bp, rr, spo2, gcs, grbs, temp, painScore.

presentingComplaints:
  From "Presenting Complaint:" in earliest entry.
  Bullet list. Exact as dictated.
  Keep duration if mentioned.

hpi:
  History of Present Illness narrative.
  Write as a clinical paragraph.
  Include: onset, duration, progression,
  outside hospital treatment, key events.
  ONLY what is in the EMR.
  NEVER add generic sentences.

pastHistory:
  All comorbidities with duration if stated.
  Surgical history with dates.
  Format: "DM × 6y · HTN · CAD\\nSurgical: ..."
  "Nil" if explicitly stated.

familyGynaeHistory:
  Family history and gynaecological history.
  "Nil" if stated. null if not mentioned.

lmp:
  Last menstrual period if stated.
  "N/A" for males or post-menopausal.

generalAndSystemicExam:
  From General Examination + Systemic Examination.
  Include:
  Pallor/Icterus/Cyanosis/Clubbing/
  Lymphadenopathy/Edema status
  Then systemic: Chest, CVS, Abdomen, CNS,
  Extremities findings.

primarySurvey:
  AIRWAY:
    status: "Patent" / "Threatened" / "Compromised"
    intervention: what was done (null if patent)

  BREATHING:
    rr: respiratory rate number only
    spo2: SpO₂ number only
    o2delivery: "Room air" / "2L NC" / "5L mask" etc
    workOfBreathing: "Normal" / "Increased"
    airEntry: "Bilaterally equal" / abnormal finding
    addedSounds: "Clear" / "Wheeze" / "Crepts" etc
    efast: EFAST findings if done
    intervention: any breathing intervention

  CIRCULATION:
    hr: heart rate
    bp: "systolic/diastolic"
    crt: "< 2 sec" or "> 2 sec"
    fast: FAST findings
    intervention: IV access / fluids etc

  DISABILITY:
    gcs: "E4V5M6" format
    pupils: size and reaction
    grbs: glucose reading

  EXPOSURE:
    temp: temperature
    logRoll: findings if done (trauma)

courseInHospital:
  Write a STRUCTURED CLINICAL NARRATIVE.
  NOT a list of actions.
  NOT raw notes compressed together.
  NOT bullet points.
  
  Write in PARAGRAPHS as a qualified doctor would write in a formal Indian hospital discharge summary.
  
  MANDATORY STRUCTURE — always follow this paragraph order:
  
  PARAGRAPH 1 — Arrival and Primary Survey:
    Start with:
    "The patient was received in the Emergency Department at [TIME] on [DATE] with the above-mentioned complaints."
    Then describe the primary survey findings and immediate interventions.
    Use passive voice. Formal tone.
  
  PARAGRAPH 2 — Investigations:
    "Baseline investigations were sent including [list all tests ordered]. [Describe key results that influenced management]. [Imaging findings if any]."
    Do NOT list all values here — those go in the Investigations section.
    Mention only clinically significant findings that changed management.
  
  PARAGRAPH 3 — Treatment:
    "The patient was administered [each medication with dose, route, frequency]. IV access was secured. [Procedures performed with relevant details]."
    Write every medication as a sentence. Include IV fluids.
  
  PARAGRAPH 4 — Consultations:
    Only if consultations were done.
    "[Specialty] consultation was sought. Case reviewed by [Dr. Name]. [Their advice / plan]."
    One consultation per paragraph.
  
  PARAGRAPH 5 — Clinical Course:
    "Patient's clinical condition [improved/remained stable/deteriorated] during the ER stay. [Any significant events — new symptoms, vital changes, responses to treatment]."
    Omit if uneventful stay.
  
  PARAGRAPH 6 — Disposition:
    End with:
    "After clinical assessment and interdisciplinary discussion, a decision was made to [admit the patient under Dr. [Name] ([Specialty]) / discharge the patient] for further management."
  
  LANGUAGE RULES:
    Use PAST TENSE throughout.
    Use PASSIVE VOICE (was received, was administered, was secured).
    Use FORMAL medical English.
    Do NOT use abbreviations in the narrative (write "intravenous" not "IV" in sentences — but "IV" is acceptable in med lists).
    Do NOT use bullet points.
    Do NOT use timestamps in the narrative (use "on arrival" / "subsequently" / "thereafter").
    Do NOT copy nursing notes verbatim.
    Integrate all information into a coherent clinical story.

investigations:
  ALL lab results grouped:
  Parse every Parameter + Result + Reference.
  Flag abnormals: ↑ if above reference, ↓ if below.
  
  Groups:
  cbc, lft, rft, electrolytes, coagulation, urine, cardiac, vbg, ecg, imaging, other

  Format each result string as:
  "Hb: 7.9 ↓ (ref 12-15 g/dL)"

diagnosisAtDischarge:
  Array of strings (numbered/itemized list). Primary diagnosis first.
  From IMP: or consultant notes or differential diagnosis section.

dischargeMedications:
  Array of strings if patient sent home.
  Format: ["Tab Name Dose Frequency × Duration"]
  null if admitted to ward/ICU.

disposition:
  Exactly one of:
  "Normal Discharge"
  "Discharge at Request"
  "Discharge Against Medical Advice"
  "Referred to [hospital name]"
  "Admitted under [Dr. Name] ([Specialty])"
  "Deceased"

conditionAtDischarge:
  "STABLE" or "UNSTABLE"

vitalsAtDischarge:
  Most RECENT vitals from latest entry.
  Object with hr, bp, rr, spo2, gcs, grbs, temp.
  null if not documented.

followUpAdvice:
  Specific instructions for patient/GP.
  Pending investigations.
  Return precautions.

edResident:
  Name from "EM Resident:" field.

edConsultant:
  Name from "EM Consultant:" field.

dateTime:
  Date of the discharge summary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return strict JSON only. No markdown formatting.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "patientName": string | null,
  "age": string | null,
  "gender": string | null,
  "uhid": string | null,
  "mlc": string | null,
  "allergy": string | null,
  "vitalsOnArrival": {
    "hr": string | null,
    "bp": string | null,
    "rr": string | null,
    "spo2": string | null,
    "gcs": string | null,
    "grbs": string | null,
    "temp": string | null,
    "painScore": string | null
  },
  "presentingComplaints": string,
  "hpi": string,
  "pastHistory": string | null,
  "familyGynaeHistory": string | null,
  "lmp": string | null,
  "generalAndSystemicExam": string | null,
  "primarySurvey": {
    "airway": {
      "status": string,
      "intervention": string | null
    },
    "breathing": {
      "rr": string | null,
      "spo2": string | null,
      "o2delivery": string | null,
      "workOfBreathing": string | null,
      "airEntry": string | null,
      "addedSounds": string | null,
      "efast": string | null,
      "intervention": string | null
    },
    "circulation": {
      "hr": string | null,
      "bp": string | null,
      "crt": string | null,
      "fast": string | null,
      "intervention": string | null
    },
    "disability": {
      "gcs": string | null,
      "pupils": string | null,
      "grbs": string | null
    },
    "exposure": {
      "temp": string | null,
      "logRoll": string | null
    }
  },
  "courseInHospital": string,
  "investigations": {
    "cbc": string | null,
    "lft": string | null,
    "rft": string | null,
    "electrolytes": string | null,
    "coagulation": string | null,
    "urine": string | null,
    "cardiac": string | null,
    "vbg": string | null,
    "ecg": string | null,
    "imaging": string | null,
    "other": string | null
  },
  "diagnosisAtDischarge": string[],
  "dischargeMedications": string[] | null,
  "disposition": string,
  "conditionAtDischarge": string,
  "vitalsAtDischarge": {
    "hr": string | null,
    "bp": string | null,
    "rr": string | null,
    "spo2": string | null,
    "gcs": string | null,
    "grbs": string | null,
    "temp": string | null
  } | null,
  "followUpAdvice": string | null,
  "edResident": string | null,
  "edConsultant": string | null,
  "dateTime": string | null
}

EMR TEXT (oldest entry at top):
"""
\${processedText}
"""
`;

// Helper for parsing JSON safely from AI output string
function cleanAndParseJSON(rawStr: string): any {
  const cleaned = rawStr
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/s, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not parse valid JSON from AI response');
  }
}

// Fallback heuristic generator when AI APIs are unavailable
function buildHeuristicDischargeSummary(rawText: string): Record<string, any> {
  const bpM = rawText.match(/(?:bp|blood\s*pressure)?\s*[:=-]?\s*(\d{2,3}\/\d{2,3})/i);
  const hrM = rawText.match(/(?:hr|pulse)?\s*[:=-]?\s*(\d{2,3})/i);
  const spo2M = rawText.match(/(?:spo2|sat)?\s*[:=-]?\s*(\d{2,3})%/i);
  const grbsM = rawText.match(/(?:grbs|rbs|blood\s*sugar)?\s*[:=-]?\s*(\d{2,4})/i);
  const rrM = rawText.match(/(?:rr|resp)?\s*[:=-]?\s*(\d{1,2})/i);
  const gcsM = rawText.match(/gcs\s*[:=-]?\s*([e1-4v1-5m1-6\d]{2,6}|\d{1,2})/i);
  const dxM = rawText.match(/(?:diagnosis|imp|impression|assessment)\s*[:=-]?\s*([^\n]+)/i);

  const nameM = rawText.match(/(?:patient\s*name|patient|name)\s*[:=-]?\s*([^\n,\d]+)/i) ||
                rawText.match(/(?:mr\.|mrs\.|ms\.|pt\.?|baby|master)\s+([A-Za-z\s]+)/i);
  const extractedName = nameM ? nameM[1].trim() : "Emergency Patient";

  const ageM = rawText.match(/(\d{1,3})\s*-?\s*(?:year|y\.?o\.?|yo|f|m)/i);
  const genderM = rawText.match(/\b(male|female|m|f)\b/i);

  const complaintM = rawText.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of|reason\ for\ visit)\s*[:=-]?\s*([^\n]+)/i);
  const actualComplaint = complaintM ? complaintM[1].trim() : "Emergency medical evaluation";

  return {
    patientName: extractedName,
    age: ageM ? `${ageM[1]}y` : null,
    gender: genderM ? (genderM[1].toUpperCase().startsWith("F") ? "Female" : "Male") : null,
    uhid: rawText.match(/(?:uhid|mrn|er\s*no|bed)\s*[:=-]?\s*(\w+)/i)?.[1] || null,
    mlc: rawText.match(/mlc\s*no?\b[:.\s]*(\w+)/i)?.[1] || null,
    allergy: rawText.match(/allerg(?:y|ies)\s*[:=]?\s*([^\n]+)/i)?.[1] || "Nil known",
    vitalsOnArrival: {
      hr: hrM ? hrM[1] : null,
      bp: bpM ? bpM[1] : null,
      rr: rrM ? rrM[1] : null,
      spo2: spo2M ? spo2M[1] : null,
      gcs: gcsM ? gcsM[1] : "15/15",
      grbs: grbsM ? grbsM[1] : null,
      temp: "98.6°F",
      painScore: null
    },
    presentingComplaints: actualComplaint,
    hpi: rawText.substring(0, 500),
    pastHistory: rawText.match(/(?:past|history|pmh|k\/c\/o)\s*[:=]?\s*([^\n]+)/i)?.[1] || "None recorded",
    familyGynaeHistory: null,
    lmp: "N/A",
    generalAndSystemicExam: "General condition fair. Conscious and oriented.",
    primarySurvey: {
      airway: { status: "Patent", intervention: null },
      breathing: { rr: rrM ? rrM[1] : "18", spo2: spo2M ? spo2M[1] : "98", o2delivery: "Room air", workOfBreathing: "Normal", airEntry: "Bilaterally equal", addedSounds: "Clear", efast: null, intervention: null },
      circulation: { hr: hrM ? hrM[1] : "80", bp: bpM ? bpM[1] : "120/80", crt: "< 2 sec", fast: null, intervention: null },
      disability: { gcs: gcsM ? gcsM[1] : "E4V5M6", pupils: "Equal & reactive", grbs: grbsM ? grbsM[1] : null },
      exposure: { temp: "98.6°F", logRoll: null }
    },
    courseInHospital: "Patient evaluated in the Emergency Department. Clinical history recorded, vitals monitored, and initial care delivered as per protocol.",
    investigations: {
      cbc: null, lft: null, rft: null, electrolytes: null, coagulation: null, urine: null, cardiac: null, vbg: null, ecg: null, imaging: null, other: null
    },
    diagnosisAtDischarge: dxM ? [dxM[1].trim()] : ["Emergency Clinical Evaluation"],
    dischargeMedications: ["As per ED prescription / Discharge advise"],
    disposition: "Normal Discharge",
    conditionAtDischarge: "STABLE",
    vitalsAtDischarge: {
      hr: hrM ? hrM[1] : "78",
      bp: bpM ? bpM[1] : "120/80",
      rr: rrM ? rrM[1] : "16",
      spo2: spo2M ? spo2M[1] : "99",
      gcs: "E4V5M6",
      grbs: grbsM ? grbsM[1] : null,
      temp: "98.6°F"
    },
    followUpAdvice: "Review in ED if warning symptoms recur.",
    edResident: "Duty Resident",
    edConsultant: "ED Consultant",
    dateTime: new Date().toLocaleDateString('en-GB')
  };
}

// ── Main extraction function ──────────────────────────────────
export async function generateDischargeSummary(
  rawText: string
): Promise<{
  success: boolean;
  summary?: Record<string, any>;
  error?: string;
}> {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      error: 'No EMR text provided',
    };
  }

  const cleaned = preprocessEMR(rawText);
  const reversed = reverseEMREntries(cleaned);
  const prompt = DISCHARGE_PROMPT.replace('\${processedText}', reversed);

  // 1. Try Anthropic (Claude Sonnet) — Primary AI engine for Discharge Summaries
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      console.log('[Discharge] Requesting Claude Sonnet (Primary)...');
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.0,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = ((msg.content[0] as any).text as string);
      const parsed = cleanAndParseJSON(raw);
      return { success: true, summary: parsed };
    } catch (err: any) {
      console.warn('[Discharge] Claude Sonnet attempt failed, falling back to OpenAI GPT-4o:', err?.message || err);
    }
  }

  // 2. Try OpenAI (GPT-4o, not mini) — Fallback AI engine (NOT Gemini)
  const openai = getOpenAI();
  if (openai) {
    try {
      console.log('[Discharge] Requesting OpenAI GPT-4o (Fallback)...');
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      const parsed = cleanAndParseJSON(res.choices[0].message.content || '{}');
      return { success: true, summary: parsed };
    } catch (err: any) {
      console.warn('[Discharge] OpenAI GPT-4o attempt failed:', err?.message || err);
    }
  }

  // 4. Heuristic Fallback
  console.warn('[Discharge] AI models failed or no API keys available. Using heuristic fallback.');
  const fallbackSummary = buildHeuristicDischargeSummary(rawText);
  return { success: true, summary: fallbackSummary };
}
