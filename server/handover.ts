// ============================================================
// ErMate — Complete Handover System
// File: server/handover.ts
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { getRelevantLearnedRules, formatLearnedRulesPromptBlock } from './learningService.ts';
import { deidentifyText } from './deidentify.ts';
import { compileAlerts, HandoverOutput } from './alertCompiler.ts';
import { extractCrossConsultations, shouldRenderConsultSection } from './crossConsultParser.ts';
import { isAbnormal } from './clinicalRanges.ts';

// ── Models ────────────────────────────────────────────────────
export const MODELS = {
  CLAUDE_SONNET:  'claude-3-5-sonnet-20241022',
  CLAUDE_HAIKU:   'claude-3-5-haiku-20241022',
  GEMINI_FLASH:   'gemini-2.0-flash',   // whitelisted ONLY for vision/OCR — never call from here
  GEMINI_PRO:     'gemini-1.5-pro',     // ⚠ VERIFY against your current Google AI Studio available-models list before deploying — model IDs change. This must resolve to an actual Pro-tier model, not any string containing "flash".
};

// ── Step 1: Preprocess — strip noise ─────────────────────────
export function preprocessEMR(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    // Remove acknowledgement lines
    .replace(/Acknowledged By\s*:.*$/gim, '')
    .replace(/Acknowledged Date\s*Time\s*:.*$/gim, '')
    // Remove VIP / Waterlow scores
    .replace(/.*VIP\s*SCORE.*$/gim, '')
    .replace(/.*WATERLOW.*$/gim, '')
    // Remove nursing document handover lines
    .replace(/.*DOCUMENTS?\s*HANDED?\s*OVER.*$/gim, '')
    .replace(/.*WITHOUT\s*ANY\s*(PHYSICAL\s*)?DAMAGE.*$/gim, '')
    .replace(/.*HANDOVERED?\s*WITHOUT.*$/gim, '')
    .replace(/.*ALL\s*FILES?\s*HANDED?\s*OVER.*$/gim, '')
    // Remove supply/inventory lists
    .replace(/.*NEB\s*MASK\s*\d.*$/gim, '')
    .replace(/.*NASAL\s*PRONGS\s*\d.*$/gim, '')
    .replace(/.*O2\s*MASK\s*\d.*$/gim, '')
    .replace(/VBG-\d+.*$/gim, '')
    .replace(/ECG-\d+.*$/gim, '')
    .replace(/CHEST\s*X\s*RAY-\d+.*$/gim, '')
    // Remove personal care entries
    .replace(/.*BRUSHED.*TEETH.*$/gim, '')
    .replace(/.*DRESS\s*CHANGED.*$/gim, '')
    .replace(/.*HAD\s*FOOD.*$/gim, '')
    .replace(/.*PATIENT\s*SLEEP\s*WELL.*$/gim, '')
    .replace(/.*PATIENT\s*BRUSHED.*$/gim, '')
    // Remove empty lab table rows (tab-only lines)
    .replace(/^\s*\t+\s*$/gm, '')
    // Remove IPSG verification lines
    .replace(/.*IPSG\s*\d.*$/gim, '')
    // Collapse duplicate NO FRESH COMPLAINTS
    .replace(
      /(NO\s*FRESH\s*COMPLAINTS\s*\n?)(?=[\s\S]*NO\s*FRESH\s*COMPLAINTS)/gi,
      ''
    )
    // Remove purely logistical nursing lines
    .replace(/.*EMPLOYEE\s*ID\s*:.*$/gim, '')
    .replace(/.*EXT\s*:\s*\d+.*$/gim, '')
    // Remove extra blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Step 2: Reverse entries so oldest is first ───────────────
export function reverseEMREntries(cleanedText: string): string {
  if (!cleanedText || typeof cleanedText !== 'string') return '';

  // Full entry header pattern:
  // "DD-MM-YYYY HH:MM AM/PM / Author Name" or "[Day X] HH:MM AM/PM / Author Name"
  const ENTRY_HEADER_PATTERN =
    /^(?:\[?Day\s*-?\d+\]?|\d{2}[-\/]\d{2}[-\/]\d{4}|\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+(\d{1,2}:\d{2})\s*(AM|PM)?\s*\/\s*(.+)$/gim;

  // Split text into entries
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset lastIndex
  ENTRY_HEADER_PATTERN.lastIndex = 0;

  while ((match = ENTRY_HEADER_PATTERN.exec(cleanedText)) !== null) {
    // Save everything before this header as previous entry
    if (match.index > lastIndex) {
      const prev = cleanedText
        .slice(lastIndex, match.index)
        .trim();
      if (prev.length > 20) {
        parts.push(prev);
      }
    }
    lastIndex = match.index;
  }

  // Add the last segment
  const last = cleanedText.slice(lastIndex).trim();
  if (last.length > 20) parts.push(last);

  // Fallback splitting if no regex header matches
  if (parts.length <= 1) {
    const fallbackBoundary = /\n(?=(?:\[?Day\s*-?\d+\]?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4}|\d{1,2}:\d{2}\s*(?:AM|PM|hrs)?|Doctor Note|Nursing Note|Consultant Review|Primary Assessment)\b)/i;
    const fallbackParts = cleanedText.split(fallbackBoundary).map(c => c.trim()).filter(c => c.length > 20);
    if (fallbackParts.length > 1) {
      console.log(`[Handover] Reversed ${fallbackParts.length} entries using fallback pattern`);
      return fallbackParts.reverse().join('\n\n───────────────────\n\n');
    }
    console.log('[Handover] Could not split entries — using original order');
    return cleanedText;
  }

  // Reverse so oldest (bottom) is now at top
  const reversed = [...parts].reverse();

  console.log(`[Handover] Reversed ${parts.length} entries`);

  return reversed.join('\n\n───────────────────\n\n');
}

// ── Step 3: Route to correct model (Claude Primary, Gemini Fallback for Handover) ──────
export function selectModel(charCount: number): {
  model: string;
  provider: 'claude' | 'gemini';
  fallbackModel: string;
  fallbackProvider: 'claude' | 'gemini';
} {
  if (charCount > 8000) {
    return {
      model: MODELS.CLAUDE_SONNET,
      provider: 'claude',
      fallbackModel: MODELS.CLAUDE_HAIKU,
      fallbackProvider: 'claude'
    };
  }
  return {
    model: MODELS.CLAUDE_HAIKU,
    provider: 'claude',
    fallbackModel: MODELS.CLAUDE_SONNET,
    fallbackProvider: 'claude'
  };
}

// ── Step 4: The extraction prompt ────────────────────────────
export function buildHandoverPrompt(processedText: string): string {
  const relevantRules = getRelevantLearnedRules(processedText, "handover_synthesis", 8);
  const rulesBlock = formatLearnedRulesPromptBlock(relevantRules);
  return `
You are ErMate's handover synthesis engine for Indian Emergency Departments & Hospital Wards.

You generate concise, clinically complete shift-to-shift handover cards for patients, including ER boarders and ward admissions.

CORE PRINCIPLES:
1. Section 3 (Initial Presentation at Arrival) is WRITE-ONCE and extracted ONLY from the EARLIEST entry (at top of reversed text).
2. Section 10/11 (Adjuncts / Lines / Devices NOW) is MUTABLE and updated for the current shift.
3. Conciseness is achieved by removing repetition and stable/normal data.
4. NEVER remove abnormal, trending, or pending-critical data to save space.
${rulesBlock}

The EMR text below has been REVERSED chronologically.
The OLDEST entry is at the TOP.
The NEWEST entry is at the BOTTOM.
Read TOP to BOTTOM.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT STRUCTURE — STRICT JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "patientLabel": {
    "name": "string (PROPER NAME only e.g. Selvarani, Varghese KC, or Bed X)",
    "ageSex": "string (e.g. 57F, 48M)",
    "bed": "string | null",
    "currentLocation": "string | null (e.g. ER Bay 3, OT, SICU Bed 2, Ward 4B - track physical location NOW)",
    "erNumber": "string | null",
    "admittingConsultant": "string | null",
    "admittingDepartment": "string | null",
    "admissionDecisionDate": "string | null",
    "daysInERSinceAdmission": "number | null",
    "erBoarder": "boolean (true if admission order exists but patient remains physically in ER)",
    "inERSince": "string | null (earliest timestamp or arrival time)",
    "status": "critical | unstable | stable | discharge",
    "treatingERPhysician": "string | null"
  },

  "alertBanner": {
    "criticalAllergies": "string | null",
    "codeStatus": "string | null",
    "criticalValues": ["string"],
    "pendingCritical": ["string"],
    "isolationPrecautions": "string | null",
    "fallRisk": "boolean",
    "summary": "string (A physician skimming ONLY this line should be safe. State 'No critical alerts flagged' if nothing qualifies)"
  },

  "initialPresentation": {
    "chiefComplaint": "string (ONE LINE original chief complaint from EARLIEST entry)",
    "initialVitals": "string | null (Vitals documented at initial presentation)",
    "abcdeArrival": "string | null (Airway, Breathing, Circulation, Disability, Exposure findings on arrival)",
    "initialImpression": "string | null (Initial clinical impression on arrival)",
    "adjunctsAtArrival": {
      "ecg": "string | null (e.g. Done · NSR rate 78 or ST elevation V1-V4 ⚠)",
      "vbg": "string | null (Extract ALL values e.g. pH 7.2 · pCO2 58.6 · pO2 43.1 · HCO3 25.8 · Lac 6.7 · Glu 428 · Na 136 · K 4.6)",
      "abg": "string | null (Formal ABG if done for intubated/respiratory cases)",
      "grbs": "string | null (e.g. 204 mg/dL)",
      "lactate": "string | null (e.g. 6.7 mmol/L)",
      "troponinPOC": "string | null (e.g. Positive / Negative)",
      "bedsideEcho": "string | null (e.g. Good LV · IVC collapsing · No pericardial effusion · No B-lines)",
      "efast": "string | null (e.g. Pericardial: Negative · RUQ: Negative · LUQ: Negative · Suprapubic: Negative · Lungs: No pneumothorax)",
      "outsideReports": "string | null (e.g. MRI Brain outside 19-07-2026 reviewed · CT Head outside Normal)",
      "physicalOnArrival": "string | null (What patient physically came in with e.g. 18G IV cannula outside · O2 mask 5L)"
    }
  },

  "presentingComplaint": "string (ONE LINE original chief complaint from EARLIEST entry)",

  "adjunctsAtArrival": {
    "ecg": "string | null",
    "vbg": "string | null",
    "abg": "string | null",
    "grbs": "string | null",
    "lactate": "string | null",
    "troponinPOC": "string | null",
    "bedsideEcho": "string | null",
    "efast": "string | null",
    "outsideReports": "string | null",
    "physicalOnArrival": "string | null"
  },

  "courseInERDayWise": [
    {
      "date": "string (e.g. [Day 1] or 25/07/2026)",
      "summary": "string (SYNTHESISE — ONE condensed clinical sentence per calendar day. DO NOT copy raw entry lines or nursing logs!)"
    }
  ],

  "activeProblemList": [
    {
      "problem": "string",
      "status": "Resolved | Ongoing | Pending workup",
      "note": "string | null"
    }
  ],

  "pastMedicalHistory": "string | null (Extract ALL past medical history, comorbidities, and surgical history. If buried in the presenting complaint, extract it here. NEVER return null if PMH exists.)",

  "crossConsultations": [
    {
      "department": "string",
      "consultant": "string (SPECIALTY NAME ONLY e.g. 'General Medicine' or 'Cardiology' — NEVER DOCTOR NAMES like 'Dr. Salini' or 'Dr. Dawn')",
      "dateSeen": "string",
      "recommendation": "string",
      "status": "Completed | Awaiting review | Awaiting re-consult | Not actioned",
      "flagged": "boolean (true if recommendation not yet actioned)"
    }
  ],

  "investigations": {
    "trends": [
      {
        "parameter": "string (e.g. Creatinine, Hb, CRP)",
        "values": "string (Show TREND: e.g. 1.0 → 1.3 → 2.9 ↑↑ or 7.9 → 8.4 → 8.8 ↑ improving)"
      }
    ],
    "normalSummary": "string | null (e.g. Routine bloods otherwise unremarkable throughout)",
    "imaging": "string | null",
    "ecg": "string | null",
    "echo": "string | null",
    "vbg": "string | null",
    "cultures": "string | null",
    "other": "string | null"
  },

  "currentMedications": ["string (Current active orders, flag changes e.g. Inj Ceftriaxone 1g BD [NEW])"],

  "adjunctsNow": {
    "ivAccess": "string | null (e.g. 18G right AC · 16G left forearm)",
    "centralLine": "string | null (e.g. Right IJV · Day 3 of insertion)",
    "arterialLine": "string | null (e.g. Right radial for continuous BP)",
    "catheter": "string | null (e.g. Foley 14F in situ · UO 35ml/hr)",
    "oxygenDelivery": "string | null (e.g. 5L nasal prongs → SpO2 97% or ETT 7.5 depth 22cm CMV mode)",
    "drains": "string | null (e.g. Right PCN tube in situ · Lumbar drain Day 2 · JP drain 50ml/day)",
    "monitoring": "string | null (e.g. Cardiac monitor · SpO2 continuous · NIBP q1h)",
    "ngt": "string | null (e.g. NGT in situ · feeds ongoing)",
    "other": "string | null"
  },

  "adjuncts": {
    "ivAccess": "string | null",
    "centralLine": "string | null",
    "arterialLine": "string | null",
    "catheter": "string | null",
    "oxygenDelivery": "string | null",
    "drains": "string | null",
    "monitoring": "string | null",
    "ngt": "string | null",
    "other": "string | null"
  },

  "managementPlan": {
    "done": ["string (Past tense actions completed)"],
    "pending": ["string (Action items pending with target date/time)"]
  },

  "erBoardingStatus": {
    "reasonForERRetention": "string | null (e.g. No MICU bed available)",
    "whoTrackingBed": "string | null",
    "durationInERPostAdmission": "string | null",
    "riskOfProlongedStay": "string | null (e.g. Fall risk from prolonged ER stay)"
  },

  "bystanderConsent": "string | null",

  "latestVitals": {
    "timestamp": "string | null (e.g. 08:30 AM)",
    "hr": "string | null",
    "bp": "string | null",
    "spo2": "string | null",
    "rr": "string | null",
    "temp": "string | null",
    "gcs": "string | null",
    "grbs": "string | null",
    "trend": "string | null (↑, ↓, → against prior reading)"
  },

  "story": "string (Clinical narrative summary, 2-3 sentences)",
  "pmh": "string | null (Extract ALL past medical history, comorbidities, and surgical history. NEVER return null if PMH exists anywhere in the text)",
  "diagnosis": "string (Extract the FULL primary provisional diagnosis or assessment. DO NOT output generic placeholders like \"Under evaluation\" if clinical details or angiogram findings exist)",
  "done": ["string (List of completed actions)"],
  "toBeDone": ["string (List of pending items)"],
  "vitalsNow": "string | null (Formatted string of latest vitals with timestamp)",
  "criticalAlerts": ["string (Array of abnormal values)"],
  "bystander": "string | null (Bystander update)",
  "alertRow": "string (LAST LINE of handover card: ⚠ [critical values] · [pending] · [diagnosis] OR ✓ Stable · For discharge · [diagnosis])"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — NEVER VIOLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Section 3 (chief complaint & arrival findings) MUST come strictly from the earliest entry at the top.
2. Never silently drop an abnormal or pending value.
3. Flag anything new since last handover explicitly.
4. Do NOT repeat 'vitals stable' across multiple days — say 'Stable Day 1-3' once.
5. If a field is absent write null or empty array.
6. Never use nursing handover lines as clinical diagnoses.
7. courseInERDayWise Rules:
   SYNTHESISE — do not copy raw entry lines or nursing logs.
   WRONG (what you must NOT do):
   "08:30: PATIENT VITALS EVALUATED. 09:00: HANDOVER GIVEN TO RN ABILA. 10:15: DR. PRINCE REVIEWED PATIENT."
   RIGHT (what you must produce):
   "[Day 1]: Arrived with breathlessness. SpO₂ 80%→97% on O₂. CT confirmed pericardial effusion. Gen Med reviewed. ICU referral made."

   RULES FOR courseInERDayWise:
   - One line per calendar day maximum.
   - Synthesise all entries for that day into ONE clinical summary sentence.
   - Include ONLY events that changed the clinical picture.
   - EXCLUDE completely: Nursing handover lines, "Vitals checked and recorded", "No fresh complaints", "Handover given to RN [name]", "Documents handed over", staff/doctor names.
   - INCLUDE only: New clinical findings, new investigations + results, new medications started, significant vital changes, consultation outcomes, procedures performed, disposition decisions.

8. Doctor Names & Identities:
   - NEVER output real doctor or consultant names in JSON fields.
   - For consultations: use specialty/department name only ('General Medicine reviewed' NOT 'Dr. Salini reviewed').
   - For treatingERPhysician: output null or '[DOCTOR]'.

9. Return STRICT VALID JSON ONLY. No markdown wrapper, no extra explanations.

EMR TEXT (oldest entry at top):
"""
${processedText}
"""
`;
}

let anthropicDisabledUntil = 0; // epoch ms; 0 = not disabled
const ANTHROPIC_DISABLE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isAnthropicCurrentlyDisabled(): boolean {
  return Date.now() < anthropicDisabledUntil;
}

// ── Claude caller ─────────────────────────────────────────────
async function callClaude(
  prompt: string,
  model: string
): Promise<string> {
    if (isAnthropicCurrentlyDisabled()) {
    throw new Error('ErMate is disabled due to previous credit/auth issue.');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_ANTHROPIC_API_KEY') {
      anthropicDisabledUntil = Date.now() + ANTHROPIC_DISABLE_COOLDOWN_MS;
    throw new Error('ANTHROPIC_API_KEY environment variable is missing.');
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.0,
      messages: [{ role: 'user', content: prompt }],
    });
    return ((msg.content[0] as any).text as string)
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  } catch (err: any) {
    if (err?.status === 400 || err?.status === 401 || err?.status === 402 || String(err?.message || "").includes("credit balance")) {
            console.warn('[Handover] Anthropic credit balance low or key issue. Routing handover tasks to Gemini.');
      anthropicDisabledUntil = Date.now() + ANTHROPIC_DISABLE_COOLDOWN_MS;
    }
    throw err;
  }
}

// ── Gemini caller ─────────────────────────────────────────────
async function callGemini(
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  const ai = new GoogleGenAI({ apiKey });

  // Do NOT include any Flash-tier model here. If the requested Pro model
  // fails, that failure must propagate up to the caller (which falls
  // through to the heuristic fallback) — never silently substitute Flash.
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: 'application/json',
      },
    });
    return (response.text || '')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  } catch (err: any) {
    console.warn(`[Handover] Gemini Pro (${model}) failed:`, err?.message || err);
    throw err;
  }
}

// ── Safe JSON parse ───────────────────────────────────────────
function safeJSON(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Try extracting JSON from response
    const match = raw.match(/\{[\s\S]+\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

// ── Alert severity ────────────────────────────────────────────
export function getAlertSeverity(
  alertRow: string
): 'critical' | 'warning' | 'stable' {

  if (!alertRow || alertRow.startsWith('✓')) {
    return 'stable';
  }

  const criticalSignals = [
    'HR >1', 'HR 1', 'HR 2',      // tachycardia
    'SpO₂', 'Temp 10',             // hypoxia/fever
    'BP <', 'pH 7.1', 'pH 7.2',   // acidosis
    'Lactate', 'AKI', 'MICU',      // organ dysfunction
    'not reviewed', 'not done',    // missed actions
    'Trop', 'GRBS >3', 'K <',     // critical labs
    'Urology', 'PAC', 'pending ⚠', // urgent pending
  ];

  if (criticalSignals.some(s =>
    alertRow.toLowerCase().includes(s.toLowerCase())
  )) {
    return 'critical';
  }

  return 'warning';
}

// ── Robust Name & Timestamp Extraction Utility ────────────────
export function extractPatientNameAndTimestamp(rawText: string): {
  name: string;
  ageGender: string;
  time: string;
  bed: string | null;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { name: "Bed Patient", ageGender: "Unknown", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), bed: null };
  }

  let name = "";
  let ageGender = "";
  let time = "";
  let bed: string | null = null;

  // 1. Bed Extraction
  const bedMatch = rawText.match(/(?:bed|bay|room)\s*#?\s*:?\s*([a-z0-9\-]+)/i);
  if (bedMatch) {
    bed = bedMatch[1].trim();
  }

  // 2. Name Extraction
  // Pattern A: Explicit label "PATIENT: ...", "Patient Name: ...", "Pt Name: ...", "Name: ..."
  const labelMatch = rawText.match(/(?:patient(?:\s*name)?|pt(?:\s*name)?|name)\s*[:=-]\s*([A-Za-z\s\.']+?)(?=[,\n\r\t\d\/\(\);]|UHID|MLC|Age|Bed|Allergies|$)/i);
  if (labelMatch && labelMatch[1].trim().length > 1) {
    const candidate = labelMatch[1].trim();
    if (!/^(?:unknown|bed|patient|male|female|adult|na|nil)$/i.test(candidate) && candidate.length < 35) {
      name = candidate;
    }
  }

  // Pattern B: Name before age/gender (e.g. "Raman Pillai, 58/M" or "Selvarani, 57F" or "Varghese KC / 48M")
  if (!name) {
    const ageSexNameMatch = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[\/,-]?\s*(\d{1,3}\s*[\/,-]?\s*[MFmf])\b/);
    if (ageSexNameMatch) {
      name = ageSexNameMatch[1].trim();
      ageGender = ageSexNameMatch[2].replace(/\s+/g, '').toUpperCase();
    }
  }

  // Pattern C: "Mr. Raman Pillai" or "Mrs. Selvarani" or "Pt. Varghese KC"
  if (!name) {
    const titleMatch = rawText.match(/(?:mr\.|mrs\.|ms\.|pt\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
    if (titleMatch) {
      name = titleMatch[1].trim();
    }
  }

  // Pattern D: Header pattern: "DD-MM-YYYY HH:MM AM/PM / Author / Name"
  if (!name) {
    const headerMatch = rawText.match(/\d{2}[-\/]\d{2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*\/\s*(?:[^\/]+\/)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (headerMatch) {
      name = headerMatch[1].trim();
    }
  }

  // Fallback Name
  if (!name) {
    name = bed ? `Bed ${bed}` : "Bed Patient";
  }

  // 3. Age & Gender Extraction (if not matched yet)
  if (!ageGender || ageGender === "Unknown") {
    const ageMatch = rawText.match(/(\d{1,3})\s*(?:year|y\.?o\.?|yo|f|m|\/f|\/m)/i) || rawText.match(/(?:age)\s*[:=-]?\s*(\d{1,3})/i);
    const genderMatch = rawText.match(/\b(female|male|f|m)\b/i);
    if (ageMatch) {
      const ageNum = ageMatch[1];
      const genderLetter = genderMatch ? genderMatch[1].toUpperCase().charAt(0) : "";
      ageGender = genderLetter ? `${ageNum}${genderLetter}` : `${ageNum}y`;
    } else {
      ageGender = "Unknown";
    }
  }

  // 4. Time / Timestamp Extraction
  // Pattern A: "ARRIVING VITALS (08:30 AM):" or "ARRIVING VITALS 08:30 AM"
  const arrivingVitalsMatch = rawText.match(/(?:arriving\s+vitals|arrival\s+vitals|arrival|arrived)\s*\(?\s*([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)\s*\)?/i);
  if (arrivingVitalsMatch) {
    time = arrivingVitalsMatch[1].trim();
  }

  // Pattern B: "@ 08:30 AM" or "Time: 08:30 AM" or "Arrived at: 08:30 AM"
  if (!time) {
    const explicitTimeMatch = rawText.match(/(?:@|time|arrived\s+at)\s*[:=-]?\s*([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)/i);
    if (explicitTimeMatch) {
      time = explicitTimeMatch[1].trim();
    }
  }

  // Pattern C: Full date-time "28-07-2026 08:30 AM" or "28/07/2026 10:15 AM"
  if (!time) {
    const dateTimeMatch = rawText.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s+([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)\b/i);
    if (dateTimeMatch) {
      time = dateTimeMatch[1].trim();
    }
  }

  // Pattern D: Any standalone time "08:30 AM" or "10:15 PM" or "14:30"
  if (!time) {
    const timeMatch = rawText.match(/\b([0-2]?\d:[0-5]\d(?:\s*[AP]M))\b/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }

  // Fallback Time
  if (!time) {
    time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { name, ageGender, time, bed };
}

// ── Heuristic Fallback Handover Data ──────────────────────────
function buildHeuristicFallback(rawText: string): any {
  const extracted = extractPatientNameAndTimestamp(rawText);
  let presentingComplaint = "Presenting complaint recorded in notes.";

  if (rawText) {
    const complaintMatch = rawText.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of)\s*[:=-]?\s*([^\n\r]+)/i);
    if (complaintMatch && complaintMatch[1]) {
      presentingComplaint = complaintMatch[1].trim();
    }
  }

  const phiResult = deidentifyText(rawText);
  const crossConsults = extractCrossConsultations(phiResult.deidentified);

  const fallbackData: any = {
    patientLabel: {
      name: extracted.name,
      ageSex: extracted.ageGender,
      bed: extracted.bed,
      erNumber: null,
      admittingConsultant: null,
      admittingDepartment: null,
      admissionDecisionDate: null,
      daysInERSinceAdmission: null,
      erBoarder: false,
      inERSince: extracted.time,
      status: 'unstable',
      treatingERPhysician: null,
    },
    alertBanner: {
      criticalAllergies: null,
      codeStatus: null,
      criticalValues: [],
      pendingCritical: [],
      isolationPrecautions: null,
      fallRisk: false,
      summary: "No critical alerts flagged"
    },
    presentingComplaint,
    courseInERDayWise: [],
    activeProblemList: [],
    story: `Patient ${extracted.name} (${extracted.ageGender}) presenting for emergency care. Refer to raw notes for complete narrative.`,
    pmh: null,
    pastMedicalHistory: null,
    diagnosis: "",
    crossConsultations: crossConsults,
    investigations: {
      trends: [],
      normalSummary: null,
      imaging: null,
      ecg: null,
      echo: null,
      vbg: null,
      cultures: null,
      other: null
    },
    currentMedications: [],
    adjuncts: {
      ivAccess: null,
      catheter: null,
      oxygenDelivery: null,
      monitoring: null,
      other: null
    },
    managementPlan: {
  done: [],
  pending: ["ErMate extraction failed — review raw notes manually before handover"]
},
done: [],
toBeDone: ["Ermate extraction failed — review raw notes manually before handover"],
    erBoardingStatus: {
      reasonForERRetention: null,
      whoTrackingBed: null,
      durationInERPostAdmission: null,
      riskOfProlongedStay: null
    },
    bystanderConsent: null,
    latestVitals: {
      timestamp: extracted.time,
      hr: null,
      bp: null,
      spo2: null,
      rr: null,
      temp: null,
      gcs: null,
      grbs: null,
      trend: "→"
    },
      vitalsNow: null,
    criticalAlerts: [],
    bystander: null,
    alertRow: "⚠ ErMate extraction failed — vitals and status not verified. Review raw notes.",
    rawNotes: rawText
  };

   const compiledAlerts = compileAlerts({
    patientHeader: { name: extracted.name, bed: extracted.bed },
    labs: [],
    crossConsultations: crossConsults,
    latestVitals: { timestamp: extracted.time, bp: null, hr: null, rr: null, spo2: null, temp: null, grbs: null, gcs: null }
  });
  if (compiledAlerts) {
    fallbackData.alertBanner.summary = compiledAlerts;
    fallbackData.alertBanner.criticalValues = compiledAlerts.split(" | ");
  }

  return fallbackData;
}

function sanitizeHandoverPatient(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  const pl = { ...(result.patientLabel || {}) };

  const medTerms = [
    'fever', 'cough', 'cold', 'pain', 'complaint', 'breathless', 'vomiting',
    'distension', 'displacement', 'pcn', 'presented', 'patient', 'history',
    'since', 'edema', 'oedema', 'evaluati', 'c/o', 'dizziness', 'weakness',
    'rhinorrhea', 'sore', 'throat', 'nausea', 'seizure', 'syncope'
  ];

  let rawName = pl.name || result.name;
  if (rawName && typeof rawName === 'string') {
    const lower = rawName.toLowerCase();
    const hasMedTerm = medTerms.some(t => lower.includes(t));
    const isTooLong = rawName.length > 35;
    const hasDigit = /\d/.test(rawName) && !/^Bed\s+\d+$/i.test(rawName);

    if (hasMedTerm || isTooLong || hasDigit) {
      if (!result.presentingComplaint || result.presentingComplaint === 'Presenting complaint recorded.') {
        result.presentingComplaint = rawName;
      }
      rawName = pl.bed ? `Bed ${pl.bed}` : 'Bed Patient';
    }
  } else {
    rawName = pl.bed ? `Bed ${pl.bed}` : 'Bed Patient';
  }

  let cleanAgeSex = pl.ageSex || result.ageGender || 'Unknown';
  if (cleanAgeSex && typeof cleanAgeSex === 'string' && cleanAgeSex !== 'Unknown') {
    const match = cleanAgeSex.match(/(\d{1,3})\s*([MF])/i);
    if (match) {
      cleanAgeSex = `${match[1]}${match[2].toUpperCase()}`;
    } else {
      const ageOnly = cleanAgeSex.match(/\b\d{1,3}\b/);
      if (ageOnly) {
        cleanAgeSex = `${ageOnly[0]}y`;
      } else if (cleanAgeSex.length > 10) {
        cleanAgeSex = 'Unknown';
      }
    }
  }

  // Ensure inERSince is captured if missing
  if (!pl.inERSince && result.rawNotes) {
    const extractedTime = extractPatientNameAndTimestamp(result.rawNotes).time;
    pl.inERSince = extractedTime;
  }

  pl.name = rawName;
  pl.ageSex = cleanAgeSex;
  result.patientLabel = pl;
  result.name = rawName;
  result.ageGender = cleanAgeSex;

  return result;
}

// ── Main extraction function ──────────────────────────────────
export async function extractHandover(
  rawText: string,
  doctorName?: string,
  patientName?: string
): Promise<{
  success: boolean;
  data?: any;
  extracted?: any;
  error?: string;
  phiProtected?: { count: number; phiFound: string[]; details: Record<string, number> };
  meta?: {
    originalChars: number;
    cleanedChars: number;
    modelUsed: string;
    entriesFound: number;
  };
}> {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      error: 'No text provided for handover extraction'
    };
  }

  // STEP 1 — Preprocess (strip noise)
  const cleaned = preprocessEMR(rawText);
  console.log('[1] After preprocess:', cleaned.slice(0, 200));

  // STEP 2 — De-identify (strip PHI)
  const phiResult = deidentifyText(cleaned);
  console.log('[2] After deidentify:', phiResult.deidentified.slice(0, 200));
  if (phiResult.phiCount > 0) {
    console.log(`[Handover] DPDP Protection Active: Stripped ${phiResult.phiCount} PHI item(s) (${phiResult.phiFound.slice(0, 3).join(', ')})`);
  }

  // STEP 3 — Reverse (oldest first)
  let deidentifiedText = phiResult.deidentified;
  if (patientName && patientName !== "Bed Patient") {
    const nameParts = patientName.split(/\s+/).filter(p => p.length > 2);
    for (const part of nameParts) {
      const escapedName = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePattern = new RegExp(`\\b${escapedName}\\b`, "gi");
      const countBefore = (deidentifiedText.match(namePattern) || []).length;
      if (countBefore > 0) {
        deidentifiedText = deidentifiedText.replace(namePattern, "[PATIENT]");
        phiResult.phiCount += countBefore;
        phiResult.phiFound.push("Patient Name (Explicit)");
      }
    }
  }
  const reversed = reverseEMREntries(deidentifiedText);
  console.log('[3] After reverse:', reversed.slice(0, 200));

  // Count entries
  const entriesFound = (reversed.match(/───────────────────/g) || []).length + 1;
  console.log(`[Handover] Entries found: ${entriesFound}`);

  // STEP 3 — Select model
  const { model, provider, fallbackModel, fallbackProvider } = selectModel(reversed.length);
  console.log(`[Handover] Model selected: ${model} (${reversed.length} chars)`);

  // STEP 4 — Extract
  const prompt = buildHandoverPrompt(reversed);

  const tryExtract = async (
    m: string, p: 'claude' | 'gemini'
  ): Promise<string> => {
       if (p === 'claude' && !isAnthropicCurrentlyDisabled()) {
      return await callClaude(prompt, m);
    }
    return callGemini(prompt, m === MODELS.GEMINI_PRO ? MODELS.GEMINI_PRO : MODELS.GEMINI_FLASH);
  };

  // Fallback chain per Rule 1: Primary Claude -> Secondary Claude -> Gemini Pro (never Gemini Flash)
  const attempts: Array<{ model: string; provider: 'claude' | 'gemini' }> = [
    { model, provider },
    { model: fallbackModel, provider: fallbackProvider },
    { model: MODELS.GEMINI_PRO, provider: 'gemini' },
  ];

  for (const attempt of attempts) {
    try {
      const raw = await tryExtract(attempt.model, attempt.provider);
      const parsed = safeJSON(raw);

      if (!parsed) {
        console.warn(`[Handover] JSON parse failed for ${attempt.model}`);
        continue;
      }

      // Normalise parsed result
      const pl = parsed.patientLabel || {};
      const name = pl.name || parsed.name || "Bed Patient";
      const ageSex = pl.ageSex || parsed.ageGender || "Unknown";
      const status = pl.status || "unstable";
      const diagnosis = parsed.diagnosis || parsed.provisionalDiagnosis || "";
      
      const mgmtPlan = parsed.managementPlan || {};
      const done = Array.isArray(parsed.done) ? parsed.done : (Array.isArray(mgmtPlan.done) ? mgmtPlan.done : []);
      const toBeDone = Array.isArray(parsed.toBeDone) ? parsed.toBeDone : (Array.isArray(mgmtPlan.pending) ? mgmtPlan.pending : []);
      const vitalsNow = parsed.vitalsNow || parsed.vitals || null;
      const criticalAlerts = Array.isArray(parsed.criticalAlerts) ? parsed.criticalAlerts : [];
      const pmh = parsed.pmh || parsed.pastMedicalHistory || null;
      const story = parsed.story || "";
     const alertRow = parsed.alertRow || "⚠ Alert status not determined by ErMate — review full notes before handover";

const alertBanner = parsed.alertBanner || {
  criticalAllergies: null,
  codeStatus: null,
  criticalValues: criticalAlerts,
  pendingCritical: [],
  isolationPrecautions: null,
  fallRisk: false,
  summary: criticalAlerts.length > 0
    ? criticalAlerts.join(" · ")
    : "⚠ Alert status not determined by ErMate — review full notes before handover"
};
      const courseInERDayWise = Array.isArray(parsed.courseInERDayWise) ? parsed.courseInERDayWise : [];
      const activeProblemList = Array.isArray(parsed.activeProblemList) ? parsed.activeProblemList : [];
      let crossConsultations = Array.isArray(parsed.crossConsultations) ? parsed.crossConsultations : [];
      const currentMedications = Array.isArray(parsed.currentMedications) ? parsed.currentMedications : [];

      // Deterministic cross consultation parsing fallback/enhancement
      const deterministicConsults = extractCrossConsultations(phiResult.deidentified);
      if (crossConsultations.length === 0 && deterministicConsults.length > 0) {
        crossConsultations = deterministicConsults;
      }

      const investigations = parsed.investigations || {
        trends: [],
        normalSummary: null,
        imaging: null,
        ecg: null,
        echo: null,
        vbg: null,
        cultures: null,
        other: null
      };

      const adjunctsNow = parsed.adjunctsNow || parsed.adjuncts || {
        ivAccess: null,
        centralLine: null,
        arterialLine: null,
        catheter: null,
        oxygenDelivery: null,
        drains: null,
        monitoring: null,
        ngt: null,
        other: null
      };

      const adjunctsAtArrival = parsed.adjunctsAtArrival || parsed.initialPresentation?.adjunctsAtArrival || {
        ecg: null,
        vbg: null,
        abg: null,
        grbs: null,
        lactate: null,
        troponinPOC: null,
        bedsideEcho: null,
        efast: null,
        outsideReports: null,
        physicalOnArrival: null
      };

      const initialPresentation = parsed.initialPresentation || {
        chiefComplaint: parsed.presentingComplaint || "Presenting complaint recorded.",
        initialVitals: parsed.vitalsNow || null,
        abcdeArrival: null,
        initialImpression: parsed.diagnosis || null,
        adjunctsAtArrival
      };

      const erBoardingStatus = parsed.erBoardingStatus || {
        reasonForERRetention: null,
        whoTrackingBed: null,
        durationInERPostAdmission: null,
        riskOfProlongedStay: null
      };

      const latestVitals = parsed.latestVitals || {
        timestamp: pl.inERSince || null,
        hr: null,
        bp: null,
        spo2: null,
        rr: null,
        temp: null,
        gcs: null,
        grbs: null,
        trend: "→"
      };

      // Post-synthesis Rule-based Alert Compilation
         // Post-synthesis Rule-based Alert Compilation
      const handoverOutputShape: HandoverOutput = {
        patientHeader: {
          name,
          bed: pl.bed || null,
        },
        criticalAllergies: alertBanner.criticalAllergies || null,
        initialPresentation: {
          vitals: {
            hr: latestVitals.hr,
            spo2: latestVitals.spo2,
            rr: latestVitals.rr,
            bp: latestVitals.bp,
            temp: latestVitals.temp,
            grbs: latestVitals.grbs,
          },
          // adjunctsAtArrival.vbg is a free-text STRING per the AI schema,
          // not an object — pass it through as-is, compileAlerts()
          // handles the string-vs-object parsing internally.
          vbgAbg: adjunctsAtArrival.vbg as any,
          troponinPOC: adjunctsAtArrival.troponinPOC || null,
        },
        labs: Array.isArray(investigations.trends) ? investigations.trends.map((t: any) => ({
          panel: t.testName || "Lab Test",
          values: Array.isArray(t.values) ? t.values.map((v: any) => ({
            name: t.testName,
            value: v.val || v.value,
            isAbnormal: Boolean(v.isAbnormal || isAbnormal(t.testName?.toLowerCase() as any, parseFloat(v.val || v.value)))
          })) : []
        })) : [],
        managementPlan: {
          pending: Array.isArray(toBeDone) ? toBeDone : []
        },
        crossConsultations: Array.isArray(crossConsultations) ? crossConsultations : [],
        latestVitals: {
          timestamp: latestVitals.timestamp || null,
          bp: latestVitals.bp || null,
          hr: typeof latestVitals.hr === 'number' ? latestVitals.hr : parseFloat(latestVitals.hr) || null,
          rr: typeof latestVitals.rr === 'number' ? latestVitals.rr : parseFloat(latestVitals.rr) || null,
          spo2: typeof latestVitals.spo2 === 'number' ? latestVitals.spo2 : parseFloat(latestVitals.spo2) || null,
          temp: typeof latestVitals.temp === 'number' ? latestVitals.temp : parseFloat(latestVitals.temp) || null,
          grbs: typeof latestVitals.grbs === 'number' ? latestVitals.grbs : parseFloat(latestVitals.grbs) || null,
          gcs: latestVitals.gcs || null,
        }
      };

      const compiledAlertsString = compileAlerts(handoverOutputShape);
      if (compiledAlertsString) {
        alertBanner.summary = compiledAlertsString;
        alertBanner.criticalValues = compiledAlertsString.split(" | ");
      }

      const normalizedExtracted = {
        patientLabel: {
          name,
          ageSex,
          bed: pl.bed || null,
          currentLocation: pl.currentLocation || (pl.bed ? `Bed ${pl.bed}` : null),
          erNumber: pl.erNumber || null,
          admittingConsultant: pl.admittingConsultant || null,
          admittingDepartment: pl.admittingDepartment || null,
          admissionDecisionDate: pl.admissionDecisionDate || null,
          daysInERSinceAdmission: typeof pl.daysInERSinceAdmission === 'number' ? pl.daysInERSinceAdmission : null,
          erBoarder: Boolean(pl.erBoarder),
          inERSince: pl.inERSince || null,
          status,
          treatingERPhysician: doctorName || null,
        },
        alertBanner,
        initialPresentation,
        adjunctsAtArrival,
        presentingComplaint: initialPresentation.chiefComplaint || parsed.presentingComplaint || "Presenting complaint recorded.",
        courseInERDayWise,
        activeProblemList,
        story,
        pmh,
        pastMedicalHistory: pmh,
        diagnosis,
        crossConsultations,
        investigations,
        currentMedications,
        adjunctsNow,
        adjuncts: adjunctsNow,
        managementPlan: {
          done,
          pending: toBeDone
        },
        done,
        toBeDone,
        erBoardingStatus,
        bystanderConsent: parsed.bystanderConsent || parsed.bystander || parsed.bystanderUpdate || null,
        latestVitals,
        vitalsNow,
        criticalAlerts,
        bystander: parsed.bystander || parsed.bystanderUpdate || parsed.bystanderConsent || null,
        alertRow,

        // Compatibility fields for QuickPastePatient & SBAR
        id: `qp-pat-${Date.now()}`,
        name,
        ageGender: ageSex,
        triage: status === "critical" ? "P1 (Immediate)" : status === "stable" ? "P3 (Non-Urgent)" : "P2 (Urgent)",
        vitals: vitalsNow || "Vitals documented in notes",
        rawNotes: parsed.rawNotes || reversed,
        structuredSBAR: parsed.structuredSBAR || {
          situation: story ? `${story} (Dx: ${diagnosis})` : `Patient ${name} (${ageSex}). Dx: ${diagnosis}`,
          background: pmh ? `Past Medical History: ${pmh}` : "See raw notes for past medical history.",
          assessment: vitalsNow ? `Vitals: ${vitalsNow}. Critical: ${criticalAlerts.join("; ")}` : "See raw notes for clinical assessment.",
          recommendation: `Done ✓: ${done.join(", ")} | To Do □: ${toBeDone.join(", ")}`
        }
      };

      const sanitizedHandover = sanitizeHandoverPatient(normalizedExtracted);

      return {
        success: true,
        extracted: sanitizedHandover,
        data: sanitizedHandover,
        phiProtected: {
          count: phiResult.phiCount,
          phiFound: phiResult.phiFound,
          details: phiResult.details
        },
        meta: {
          originalChars: rawText.length,
          cleanedChars: cleaned.length,
          modelUsed: attempt.model,
          entriesFound,
        },
      };
    } catch (err: any) {
      console.warn(`[Handover] ${attempt.model} failed:`, err?.message || err);
    }
  }

  console.warn('[Handover] All model attempts failed. Using heuristic fallback.');
  const fallback = buildHeuristicFallback(rawText);
  return {
    success: true,
    extracted: fallback,
    data: fallback,
    meta: {
      originalChars: rawText.length,
      cleanedChars: cleaned.length,
      modelUsed: 'heuristic-fallback',
      entriesFound,
    }
  };
}

/**
 * saveHandoverPatient
 * Implements write-once logic for Section 3 (Initial Presentation at Arrival).
 * First write locks initialPresentation with a timestamp.
 * Subsequent writes preserve initialPresentation and update mutable current shift fields.
 */
export function saveHandoverPatient(existing: any | null, incoming: any): any {
  const isLocked = Boolean(existing?.initialPresentation_lockedAt || existing?.initialPresentation?.lockedAt);
  const now = new Date().toISOString();

  if (isLocked && existing) {
    return {
      ...incoming,
      initialPresentation_lockedAt: existing.initialPresentation_lockedAt || existing.initialPresentation?.lockedAt || now,
      initialPresentation: existing.initialPresentation,
      adjunctsAtArrival: existing.adjunctsAtArrival || existing.initialPresentation?.adjunctsAtArrival,
      presentingComplaint: existing.presentingComplaint || incoming.presentingComplaint,
      adjunctsNow: incoming.adjunctsNow || incoming.adjuncts,
      adjuncts: incoming.adjunctsNow || incoming.adjuncts,
    };
  } else {
    const lockedAt = incoming.initialPresentation_lockedAt || now;
    const initialPres = incoming.initialPresentation || {
      chiefComplaint: incoming.presentingComplaint || "Presenting complaint recorded.",
      initialVitals: incoming.latestVitals?.bp ? `BP ${incoming.latestVitals.bp}, HR ${incoming.latestVitals.hr}` : undefined,
      adjunctsAtArrival: typeof incoming.adjunctsAtArrival === 'string' 
        ? incoming.adjunctsAtArrival 
        : (incoming.adjunctsAtArrival ? Object.values(incoming.adjunctsAtArrival).filter(Boolean).join(' · ') : undefined),
      lockedAt,
    };

    return {
      ...incoming,
      initialPresentation_lockedAt: lockedAt,
      initialPresentation: {
        ...initialPres,
        lockedAt,
      },
      adjunctsAtArrival: incoming.adjunctsAtArrival || incoming.adjuncts,
      adjunctsNow: incoming.adjunctsNow || incoming.adjuncts,
      adjuncts: incoming.adjunctsNow || incoming.adjuncts,
    };
  }
}
