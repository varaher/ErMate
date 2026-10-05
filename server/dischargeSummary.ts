// ============================================================
// // ============================================================
// ErMate — Discharge Summary System
// Matches standard Indian hospital discharge format
// File: server/dischargeSummary.ts
// ============================================================
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { preprocessEMR, reverseEMREntries } from './handover.ts';
import { deidentifyText } from './deidentify.ts';

// ── Lazy Client Initializers (to prevent missing key crashes at startup) ──
let anthropicClient: Anthropic | null = null;
let anthropicDisabledUntilInDischarge = 0; // epoch ms; 0 = not disabled

function getAnthropic(): Anthropic | null {
  if (Date.now() < anthropicDisabledUntilInDischarge) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_ANTHROPIC_API_KEY') return null;
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
  Write a CONCISE, STRUCTURED, CHRONOLOGICAL CLINICAL NARRATIVE under the heading "COURSE IN EMERGENCY DEPARTMENT".
  Follow this strict 9-section ordered structure using short headings:

  Presentation:
    Briefly describe the presentation using ONLY documented presenting complaint and HPI.
    Do NOT invent symptoms or clinical details not stated. If no presenting complaint was documented, OMIT THIS SECTION ENTIRELY (do NOT substitute generic terms like "acute presentation", "unspecified complaint", or "patient presented for evaluation").

  Events Leading to Presentation:
    ONLY IF EXPLICITLY DOCUMENTED.
    Must contain ONLY an explicit precipitating or preceding event related to the presentation (e.g. road traffic accident, fall, assault, burn, snake/animal bite, insect sting, poisoning/ingestion/overdose, exertional onset, witnessed seizure before arrival, collapse/syncope, recent surgery/procedure, environmental exposure).
    Preserve time, mechanism, place, circumstances, and uncertainty qualifiers (reportedly, allegedly, approximately) when documented.
    CRITICAL: Must NEVER be populated from ordinary symptom duration (e.g., "Fever for 2 days", "Cough for 3 days", "Abdominal pain since morning" are symptoms, NOT events).
    Do NOT create this section for explicit negative history ("No history of trauma").
    If no explicit precipitating event occurred or none was documented, OMIT THIS SECTION ENTIRELY.

  Initial Assessment:
    ONLY IF DOCUMENTED.
    Summarize documented ABCDE, PAT/TICLS (for pediatric cases), vitals (HR, BP, RR, SpO2, Temp), GCS, and focused examination findings.
    If explicitly documented as normal ("ABCDE normal" / "Systemic examination normal"), include approved normal findings.
    Do NOT assume normal if clinician simply wrote "Patient stable".
    If no primary survey / assessment findings were documented, OMIT THIS SECTION ENTIRELY.

  Investigations:
    ONLY IF DOCUMENTED.
    Include only investigations actually ordered, performed, or resulted. Separate orders from results.
    Do NOT say "Baseline investigations were not ordered" or "No investigations sent".
    If no investigations were documented, OMIT THIS SECTION ENTIRELY.

  Treatment Given:
    ONLY IF ADMINISTERED.
    Include only medications, IV fluids, and acute interventions actually administered/given in ER with dose and route.
    Do NOT convert planned orders into administered treatments ("Plan ceftriaxone" is NOT "administered").
    If no treatments were administered or documented, OMIT THIS SECTION ENTIRELY.

  Procedures:
    ONLY IF PERFORMED.
    Include only explicitly performed procedures (e.g., IV cannulation, catheterization, intubation, suturing, splinting, etc.).
    If none performed, OMIT THIS SECTION ENTIRELY.

  Consultations:
    ONLY IF DONE.
    Include specialty consultations actually requested or conducted and their recommendations.
    Do NOT say "No specialist consultation was documented".
    If none done, OMIT THIS SECTION ENTIRELY.

  Clinical Course:
    ONLY IF DOCUMENTED.
    Summarize documented reassessments, serial vitals, response to treatment, or condition changes during ER stay.
    Do NOT manufacture statements like "Patient remained stable" or "Condition improved" unless explicitly documented.
    If no progress or reassessment data exist, OMIT THIS SECTION ENTIRELY.

  Disposition:
    ONLY IF DOCUMENTED.
    Documented final ER disposition (e.g. discharged with follow-up advice, admitted to ward/ICU under specialty, transferred, LAMA).
    Do NOT invent return precautions, hydration counseling, or red-flag warnings in the factual Course (those belong in patientAdvice/patientInstructions).
    If no disposition documented, OMIT THIS SECTION ENTIRELY.

  LOCKED MANDATES FOR COURSE IN HOSPITAL:
  - Do not generate paragraphs describing the absence of documentation.
  - Omit sections that have no supported source facts.
  - Do not infer that an investigation, medication, consultation, reassessment or procedure did not occur merely because it is absent from the available record.
  - Events Leading to Presentation must only contain an explicit precipitating event and must never be populated from ordinary symptom duration.
  - Use formal medical English, past tense, passive voice where appropriate.
  - Keep Course in Hospital purely FACTUAL. Patient advice and warning instructions belong in patientAdvice / patientInstructions, NOT inside Course in Hospital.

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
  Array of strings if patient sent home with an EXPLICIT discharge prescription.
  Format: ["Tab Name Dose Frequency × Duration"]
  CRITICAL: Must come ONLY from an explicit discharge prescription / discharge advice / medication-on-discharge statement in the source record.
  Medications administered in the ER (e.g. "Given Inj Ceftriaxone 2 g IV stat", IV fluids, nebulizations, stat analgesics) are treatments given in hospital and must NEVER automatically become discharge medications.
  If no explicit outpatient discharge prescription is present, or if patient is admitted to ward/ICU/deceased/referred, return null.
  Do NOT recommend medications. Do NOT infer continuation.

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

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse valid JSON from AI response');
    }
  }

  // Handle courseInHospital if returned as an object
  if (parsed && typeof parsed === 'object' && parsed.courseInHospital && typeof parsed.courseInHospital === 'object') {
    const courseObj = parsed.courseInHospital;
    const parts = ["COURSE IN EMERGENCY DEPARTMENT"];
    if (courseObj.presentation && !/\b(?:acute\s+presentation|unspecified\s+complaint|presented\s+for\s+evaluation)\b/i.test(courseObj.presentation)) {
      parts.push(`Presentation:\n${courseObj.presentation}`);
    }
    if (courseObj.eventsLeadingToPresentation || courseObj.events) parts.push(`Events Leading to Presentation:\n${courseObj.eventsLeadingToPresentation || courseObj.events}`);
    if (courseObj.initialAssessment || courseObj.arrivalAndPrimarySurvey) parts.push(`Initial Assessment:\n${courseObj.initialAssessment || courseObj.arrivalAndPrimarySurvey}`);
    if (courseObj.investigations) parts.push(`Investigations:\n${courseObj.investigations}`);
    if (courseObj.treatmentGiven || courseObj.treatment) parts.push(`Treatment Given:\n${courseObj.treatmentGiven || courseObj.treatment}`);
    if (courseObj.procedures) parts.push(`Procedures:\n${courseObj.procedures}`);
    if (courseObj.consultations) parts.push(`Consultations:\n${courseObj.consultations}`);
    if (courseObj.clinicalCourse) parts.push(`Clinical Course:\n${courseObj.clinicalCourse}`);
    if (courseObj.disposition) parts.push(`Disposition:\n${courseObj.disposition}`);
    
    // If we matched any known keys, join them. Otherwise stringify the whole thing.
    if (parts.length > 1) {
      parsed.courseInHospital = parts.join("\n\n");
    } else {
      // Fallback
      parsed.courseInHospital = Object.values(courseObj).join("\n\n");
    }
  }

  return parsed;
}

// Fallback heuristic generator when AI APIs are unavailable
// CRITICAL: This function fires only when BOTH Claude Sonnet and GPT-4o
// are unreachable. There is no AI available to determine clinical values,
// so every field either comes from a direct regex match on the actual
// text, or is explicitly marked as not documented. NEVER invent a
// plausible clinical default here — a wrong value in a heuristic fallback
// is exactly the "wrong AI output is worse than no output" failure mode.
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
  const extractedName = nameM ? nameM[1].trim() : null;

  const ageM = rawText.match(/(\d{1,3})\s*-?\s*(?:year|y\.?o\.?|yo|f|m)/i);
  const genderM = rawText.match(/\b(male|female|m|f)\b/i);

  const complaintM = rawText.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of|reason\ for\ visit)\s*[:=-]?\s*([^\n]+)/i);
  const allergyM = rawText.match(/allerg(?:y|ies)\s*[:=]?\s*([^\n]+)/i);
  const pastHistM = rawText.match(/(?:past|history|pmh|k\/c\/o)\s*[:=]?\s*([^\n]+)/i);

  return {
    // Top-level flag: frontend MUST visually distinguish this document
    // (banner/border/watermark) and block it from being finalized or
    // printed without a doctor completing the flagged fields.
    requiresManualReview: true,
    generatedBy: "heuristic_fallback_no_ai_available",

    patientName: extractedName,
    age: ageM ? `${ageM[1]}y` : null,
    gender: genderM ? (genderM[1].toUpperCase().startsWith("F") ? "Female" : "Male") : null,
    uhid: rawText.match(/(?:uhid|mrn|er\s*no|bed)\s*[:=-]?\s*(\w+)/i)?.[1] || null,
    mlc: rawText.match(/mlc\s*no?\b[:.\s]*(\w+)/i)?.[1] || null,
    allergy: allergyM ? allergyM[1].trim() : null,
    vitalsOnArrival: {
      hr: hrM ? hrM[1] : null,
      bp: bpM ? bpM[1] : null,
      rr: rrM ? rrM[1] : null,
      spo2: spo2M ? spo2M[1] : null,
      gcs: gcsM ? gcsM[1] : null,
      grbs: grbsM ? grbsM[1] : null,
      temp: null,
      painScore: null
    },
    presentingComplaints: complaintM ? complaintM[1].trim() : "Not documented — automated fallback used, AI extraction unavailable.",
    hpi: rawText.substring(0, 500) || "Not documented — automated fallback used, AI extraction unavailable.",
    pastHistory: pastHistM ? pastHistM[1].trim() : null,
    familyGynaeHistory: null,
    lmp: null,
    generalAndSystemicExam: null,
    primarySurvey: {
      airway: { status: "Not documented", intervention: null },
      breathing: { rr: rrM ? rrM[1] : null, spo2: spo2M ? spo2M[1] : null, o2delivery: null, workOfBreathing: null, airEntry: null, addedSounds: null, efast: null, intervention: null },
      circulation: { hr: hrM ? hrM[1] : null, bp: bpM ? bpM[1] : null, crt: null, fast: null, intervention: null },
      disability: { gcs: gcsM ? gcsM[1] : null, pupils: null, grbs: grbsM ? grbsM[1] : null },
      exposure: { temp: null, logRoll: null }
    },
    courseInHospital: (() => {
      const parts = ["COURSE IN EMERGENCY DEPARTMENT"];
      if (complaintM && complaintM[1].trim()) {
        parts.push(`Presentation:\nThe patient presented to the Emergency Department with ${complaintM[1].trim()}.`);
      }
      return parts.join("\n\n");
    })(),
    investigations: {
      cbc: null, lft: null, rft: null, electrolytes: null, coagulation: null, urine: null, cardiac: null, vbg: null, ecg: null, imaging: null, other: null
    },
    diagnosisAtDischarge: dxM ? [dxM[1].trim()] : ["Not documented"],
    dischargeMedications: null,
    disposition: "NOT DOCUMENTED — MANUAL ENTRY REQUIRED",
    conditionAtDischarge: "NOT DOCUMENTED — MANUAL ENTRY REQUIRED",
    vitalsAtDischarge: null,
    followUpAdvice: null,
    edResident: null,
    edConsultant: null,
    dateTime: new Date().toLocaleDateString('en-GB')
  };
}

// ── Main extraction function ──────────────────────────────────
export async function generateDischargeSummary(
  rawText: string
): Promise<{
  success: boolean;
  summary?: Record<string, any>;
  phiProtected?: { count: number; phiFound: string[]; details: Record<string, number> };
  error?: string;
}> {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      error: 'No EMR text provided',
    };
  }

  // DPDP Act 2023 On-The-Fly PHI De-identification (Local India Cloud Run)
  const phiResult = deidentifyText(rawText);
  if (phiResult.phiCount > 0) {
    console.log(`[Discharge] DPDP Protection Active: Stripped ${phiResult.phiCount} PHI item(s)`);
  }

  const cleaned = preprocessEMR(phiResult.deidentified);
  const reversed = reverseEMREntries(cleaned);
  const prompt = DISCHARGE_PROMPT.replace('${processedText}', reversed);

  const phiProtected = {
    count: phiResult.phiCount,
    phiFound: phiResult.phiFound,
    details: phiResult.details
  };

  // 1. Try Anthropic (Claude Sonnet) — Primary AI engine for Discharge Summaries
  const runOpenAIFallback = async () => {
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
        return { success: true, summary: parsed, phiProtected };
      } catch (err: any) {
        console.warn('[Discharge] OpenAI GPT-4o attempt failed:', err?.message || err);
      }
    }
    
    return null;
  };

  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      console.log('[Discharge] Requesting Claude Sonnet (Primary)...');
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.0,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = ((msg.content[0] as any).text as string);
      const parsed = cleanAndParseJSON(raw);
      const sanitized = sanitizeSummaryDischargeMeds(parsed, rawText);
      return { success: true, summary: sanitized, phiProtected };
    } catch (err: any) {
      console.warn('[Discharge] Claude Sonnet attempt failed, falling back:', err?.message || err);
            if (err?.status === 400 || err?.status === 401 || err?.status === 402 || String(err?.message || "").includes("credit balance")) {
        anthropicDisabledUntilInDischarge = Date.now() + 5 * 60 * 1000; // 5-minute circuit breaker, matches ROUTE-07
      }
      const openaiRes = await runOpenAIFallback();
      if (openaiRes) {
        if (openaiRes.summary) {
          openaiRes.summary = sanitizeSummaryDischargeMeds(openaiRes.summary, rawText);
        }
        return openaiRes;
      }
    }
  } else {
    const openaiRes = await runOpenAIFallback();
    if (openaiRes) {
      if (openaiRes.summary) {
        openaiRes.summary = sanitizeSummaryDischargeMeds(openaiRes.summary, rawText);
      }
      return openaiRes;
    }
  }

  // 3. Heuristic Fallback
  console.warn('[Discharge] AI models failed or no API keys available. Using heuristic fallback.');
  const fallbackSummary = buildHeuristicDischargeSummary(phiResult.deidentified);
  return { success: true, summary: sanitizeSummaryDischargeMeds(fallbackSummary, rawText), phiProtected };
}

/**
 * Patch C3A: Extract explicit discharge prescription contexts from clinical narrative.
 * Positively isolates sections/sentences introduced by explicit discharge triggers.
 */
export function extractExplicitDischargeContext(sourceText: string): string {
  if (!sourceText || typeof sourceText !== "string") return "";

  const triggerRegex = /\b(?:discharge\s+(?:on|with|medications?|meds?|advice|prescription|prescriptions?|rx)|discharged\s+(?:on|with)|home\s+medications?|take-home(?:\s+medications?|\s+meds?)?|to\s+take\s+home|outpatient\s+medications?|prescribed\s+on\s+discharge|prescriptions?\s+on\s+discharge|on\s+discharge|medications?\s+on\s+discharge|rx\s+on\s+discharge)\b/gi;

  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = triggerRegex.exec(sourceText)) !== null) {
    matches.push(m);
  }

  if (matches.length === 0) {
    return "";
  }

  const contexts: string[] = [];

  for (const match of matches) {
    const startIdx = match.index;
    const remainder = sourceText.slice(startIdx);

    const stopRegex = /(?:\n\s*(?:follow[- ]?up|opd\b|review\b|return\s+to\s+(?:er|ed|hospital)|red\s*flags?|warning\s*signs?|when\s+to\s+return|emergency\s+instructions?|course\s+(?:in\s+hospital|of\s+stay)?|er\s+treatments?|treatments?\s+(?:given|administered)|vitals?\b|investigations?\b|labs?\b|primary\s+survey|secondary\s+survey|disposition\b|condition\s+(?:at|on)\s+discharge|impression\b|diagnosis\b|history\b|complaint\b))/i;
    
    const stopMatch = stopRegex.exec(remainder);
    let segment = stopMatch ? remainder.slice(0, stopMatch.index) : remainder;

    const narrativeStopRegex = /(?:\.\s+(?:review\b|follow[- ]?up\b|return\b|patient\s+advised\b|sos\s+review\b|advise\b|consult\b|warning\b|red\s*flag))/i;
    const narrativeStopMatch = narrativeStopRegex.exec(segment);
    if (narrativeStopMatch) {
      segment = segment.slice(0, narrativeStopMatch.index + 1);
    }

    contexts.push(segment.trim());
  }

  return contexts.join("\n");
}

/**
 * Extract identifiable medication name for conservative positive-provenance matching.
 * Normalizes lowercase, strips common formulation prefixes (Tab, Inj, Cap, Syr, etc.),
 * and removes trailing dosages/instructions.
 */
export function extractIdentifiableDrugName(medStr: string): string {
  if (!medStr || typeof medStr !== "string") return "";

  // 1. Remove leading bullets, numbers, dashes, punctuation
  let clean = medStr.trim()
    .replace(/^[-*•\d.)\]\s]+/, "")
    .trim();

  // 2. Remove common formulation prefixes (Tab, Tablet, Inj, Cap, etc.)
  clean = clean.replace(/^(?:tab(?:let)?s?|inj(?:ection)?s?|cap(?:sule)?s?|syr(?:up)?s?|syp|susp(?:ension)?|oint(?:ment)?|cream|gel|drops?|respules?|nebulizer|nebulization|iv|im|po|oral)\b[\s.:-]*/i, "").trim();

  // 3. Extract identifiable drug name before dosage/strength or frequency/route/instructions
  const match = clean.match(/^([a-z\s/-]+?)(?:\s+\d|\s*\d|\s+(?:od|bd|tds|qid|sos|hs|stat|given|iv|im|po|oral)\b|$)/i);
  let candidate = (match ? match[1] : clean).trim().toLowerCase();
  candidate = candidate.replace(/[,;:]+$/, "").trim();

  return candidate;
}

/**
 * Checks if a proposed medication item is positively evidenced within an explicit discharge context.
 */
export function isMedicationSupportedInContext(medicationItem: string, dischargeContext: string): boolean {
  if (!medicationItem || !dischargeContext) return false;

  const drugName = extractIdentifiableDrugName(medicationItem);
  if (!drugName || drugName.length < 3) return false;

  const normalizedContext = dischargeContext.toLowerCase();

  // 1. Exact drug name phrase match as whole word
  const escaped = drugName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRegex = new RegExp(`\\b${escaped}\\b`, "i");
  if (wordRegex.test(normalizedContext)) {
    return true;
  }

  // 2. If compound name (e.g. "amoxicillin clavulanate"), check primary distinctive word (length >= 4)
  const words = drugName.split(/[\s/-]+/).filter(w => w.length >= 4);
  for (const w of words) {
    const wEscaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${wEscaped}\\b`, "i").test(normalizedContext)) {
      return true;
    }
  }

  return false;
}

export function sanitizeSummaryDischargeMeds(summary: any, sourceText: string) {
  if (!summary || typeof summary !== "object") return summary;
  const disp = String(summary.disposition || "");
  const isAdmittedOrDeceased = /\b(?:admitted|ward|icu|deceased|death|referred)\b/i.test(disp);
  if (isAdmittedOrDeceased) {
    summary.dischargeMedications = null;
    return summary;
  }

  const explicitContext = extractExplicitDischargeContext(sourceText);
  if (!explicitContext) {
    summary.dischargeMedications = null;
    return summary;
  }

  const secondaryBlacklist = /\b(?:noradrenaline|norepinephrine|dopamine|dobutamine|vasopressin|infusion|iv\s+stat|iv\s+bolus|500\s*ml|1000\s*ml)\b/i;

  if (Array.isArray(summary.dischargeMedications)) {
    summary.dischargeMedications = summary.dischargeMedications.filter((m: string) => {
      if (!m || typeof m !== "string") return false;
      if (secondaryBlacklist.test(m)) return false;
      return isMedicationSupportedInContext(m, explicitContext);
    });
    if (summary.dischargeMedications.length === 0) {
      summary.dischargeMedications = null;
    }
  } else if (typeof summary.dischargeMedications === "string" && summary.dischargeMedications.trim()) {
    const lines = summary.dischargeMedications.split("\n").filter((l: string) => {
      const trimmed = l.trim();
      if (!trimmed) return false;
      if (secondaryBlacklist.test(trimmed)) return false;
      return isMedicationSupportedInContext(trimmed, explicitContext);
    });
    summary.dischargeMedications = lines.length > 0 ? lines : null;
  } else {
    summary.dischargeMedications = null;
  }

  return summary;
}
