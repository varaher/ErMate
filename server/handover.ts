// ============================================================
// ErMate — Complete Handover System
// File: server/handover.ts
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

// ── Models ────────────────────────────────────────────────────
export const MODELS = {
  CLAUDE_SONNET:  'claude-3-5-sonnet-20241022',
  CLAUDE_HAIKU:   'claude-3-5-haiku-20241022',
  GEMINI_FLASH:   'gemini-3.6-flash',
  GEMINI_PRO:     'gemini-3.1-pro-preview',
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
  // "DD-MM-YYYY HH:MM AM/PM / Author Name" or timestamp boundaries
  const ENTRY_HEADER_PATTERN =
    /^(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(\d{1,2}:\d{2})\s*(AM|PM)?\s*\/\s*(.+)$/gim;

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
    const fallbackBoundary = /\n(?=(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4}|\d{1,2}:\d{2}\s*(?:AM|PM|hrs)?|Doctor Note|Nursing Note|Consultant Review|Primary Assessment)\b)/i;
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

// ── Step 3: Route to correct model ───────────────────────────
export function selectModel(charCount: number): {
  model: string;
  provider: 'claude' | 'gemini';
} {
  if (charCount > 24000) {
    return { model: MODELS.CLAUDE_SONNET, provider: 'claude' };
  }
  if (charCount > 8000) {
    return { model: MODELS.CLAUDE_HAIKU, provider: 'claude' };
  }
  return { model: MODELS.GEMINI_FLASH, provider: 'gemini' };
}

// ── Step 4: The extraction prompt ────────────────────────────
export function buildHandoverPrompt(processedText: string): string {
  return `
You are generating a CONCISE clinical handover for an
Indian Emergency Department shift change.

The EMR text below has been REVERSED chronologically.
The OLDEST entry is at the TOP.
The NEWEST entry is at the BOTTOM.
Read TOP to BOTTOM.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD EXTRACTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PATIENT LABEL:
  name: from any entry header or consultant note
  ageSex: "52M" or "38F" format
  bed: bed number from header
  erNumber: ER# or registration number
  admittingConsultant: admitting specialty + doctor
  inERSince: earliest timestamp in the text
  status: critical/unstable/stable/discharge

PRESENTING COMPLAINT:
  From the FIRST (top) entry — look for
  "Presenting Complaint:" or "Chief Complaint:"
  or the earliest nursing arrival note.
  2-3 lines maximum. Original complaint only.
  NOT current status.

STORY (2-3 sentences ONLY):
  Write the clinical narrative a consultant
  would use at ward rounds.
  WHO (age/sex/key PMH) + WHY they came +
  WHAT happened in ER + CURRENT STATUS +
  MAIN CONCERN.
  
  NEVER include:
  Nursing routine notes
  "Vitals checked and recorded"
  Document handover lines
  Administrative details
  
  Example:
  "52M with known CAD presented with chest pain.
   ECG showed NSTEMI. Post-PCI with rising
   creatinine (AKI). Main concern: renal function."

PAST MEDICAL HISTORY:
  Look in ALL entries for:
  "Past Medical History:" / "K/C/O" / "Known case of"
  Maximum 5 key conditions.
  Abbreviate: DM, HTN, CAD, CKD, OSA etc.
  One line format: "DM × 6y · HTN · CAD"
  NEVER say "not documented" if PMH exists anywhere.

DIAGNOSIS:
  Primary source: "IMP:" in any consultant entry
  Secondary: "Impression:" in imaging/USG/CT reports
  Tertiary: "Differential Diagnosis:" in case record
  Use most specific diagnosis found.
  Include key supporting finding.
  1-3 lines only.
  NEVER use nursing handover lines as diagnosis.
  Nursing lines start with "PATIENT HANDOVER RECEIVED"
  — these are NEVER diagnoses.

DONE LIST (short phrases only):
  Past tense actions from ALL entries:
  "given" / "done" / "taken" / "sent" / "started"
  / "inserted" / "administered" / "completed"
  / "catheterised" / "shifted to" / "allocated"
  
  Maximum 8 items.
  SHORT phrases — no timestamps, no context.
  Examples: "IV access" "VBG taken" "USG done"
  "Kabimol 1g IV" "Urology called" "Room A215"

TO DO LIST (action items only):
  Future actions from "Adv:" / "Advice:" / "Plan:"
  / "pending" / "awaited" / "monitor" / "to be done"
  
  Maximum 6 items. Most urgent first.
  SHORT phrases.
  Flag urgent ones with ⚠.
  Examples: "Urology review ⚠" "URE pending"
  "Monitor HR — was 171" "Final USG report"

VITALS NOW (most recent values only):
  From most recent entry.
  Format: "BP: 130/90 · HR: 171 ⚠ · SpO₂: 97%"
  Flag abnormals with ⚠.
  One line only.

BYSTANDER:
  One line. Was family informed?
  What were they told? Consent status?
  If nothing documented: null

CRITICAL ALERTS (abnormal values only):
  List only if outside normal range:
  HR > 100 or < 50 → include with number
  SpO₂ < 95% → include with number
  Temp > 100.4°F → include with number
  SBP < 90 or > 160 → include
  GRBS > 250 or < 70 → include
  Troponin elevated → include
  Lactate > 2 → include with number
  K abnormal → include
  Creatinine elevated → include
  Any urgent pending → include

ALERT ROW (the most critical line — read in 5 seconds):
  This is the LAST LINE of the handover card.
  Red background. White text. Bold.
  One line that tells the receiving doctor
  what NOT TO MISS.
  
  Format:
  "⚠  [critical values] · [follow-up not done] · [? probable dx]"
  
  Separate items with " · "
  Start with actual numbers: "HR 171" not "tachycardia"
  
  Examples:
  "⚠  HR 171 · Temp 102°F · Urology not reviewed · ? Infected PCN"
  "⚠  GRBS 415 · PAC not done (biopsy Thu) · Urine C&S pending · Glioma"
  "⚠  SpO₂ on O₂ only · AKI Cr 1.3 · MICU shift pending · Cushing's"
  
  If stable: "✓  Stable · For discharge · [diagnosis]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — NEVER VIOLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER use placeholder text:
  ✗ "Comorbidities not explicitly documented"
  ✗ "Vitals not documented"
  ✗ "See raw notes for..."
  ✗ "Evaluation of patient with acute symptoms"
  ✗ "Complete active tasks"
  ✗ "Parsed Notes Review Complete"
  ✗ "Bystanders counselled" (too generic)
  If genuinely absent → null

NEVER include SBAR labels in output:
  ✗ "Situation (S):"
  ✗ "Assessment (A):"
  ✗ "Background (B):"
  ✗ "Recommendation (R):"
  Extract CONTENT only. No structural labels.

NEVER use nursing handover lines as:
  Presenting complaint
  Diagnosis
  Clinical assessment

ALWAYS read ALL entries before extracting.
ALWAYS use IMP: as diagnosis source.
ALWAYS use most recent vitals.
ALWAYS include actual numbers in alert row.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return strict JSON only. No markdown. No explanation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "patientLabel": {
    "name": "string",
    "ageSex": "string",
    "bed": "string | null",
    "erNumber": "string | null",
    "admittingConsultant": "string | null",
    "inERSince": "string | null",
    "status": "critical | unstable | stable | discharge"
  },
  "presentingComplaint": "string",
  "story": "string",
  "pmh": "string | null",
  "diagnosis": "string",
  "done": ["string"],
  "toBeDone": ["string"],
  "vitalsNow": "string | null",
  "criticalAlerts": ["string"],
  "bystander": "string | null",
  "alertRow": "string"
}

EMR TEXT (oldest entry at top):
"""
${processedText}
"""
`;
}

// ── Claude caller ─────────────────────────────────────────────
async function callClaude(
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is missing.');
  }

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
}

// ── Gemini caller ─────────────────────────────────────────────
async function callGemini(
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
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

// ── Heuristic Fallback Handover Data ──────────────────────────
function buildHeuristicFallback(rawText: string): any {
  let name = "Bed Patient";
  let ageSex = "Unknown";
  let presentingComplaint = "Presenting complaint recorded in notes.";

  if (rawText) {
    const complaintMatch = rawText.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of)\s*[:=-]?\s*([^\n\r]+)/i);
    if (complaintMatch && complaintMatch[1]) {
      presentingComplaint = complaintMatch[1].trim();
    }

    const nameMatch = rawText.match(/(?:patient|mr\.|ms\.|mrs\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) name = nameMatch[1];

    const ageMatch = rawText.match(/(\d{1,3})\s*-?(?:year|y\.?o\.?|yo|f|m)/i);
    const genderMatch = rawText.match(/\b(female|male|f|m)\b/i);
    if (ageMatch) {
      ageSex = `${ageMatch[1]}${genderMatch && genderMatch[1].toUpperCase().startsWith("F") ? "F" : "M"}`;
    }
  }

  return {
    patientLabel: {
      name,
      ageSex,
      bed: null,
      erNumber: null,
      admittingConsultant: null,
      inERSince: null,
      status: 'unstable'
    },
    presentingComplaint,
    story: `Patient ${name} (${ageSex}) presenting for emergency care. Refer to raw notes for complete narrative.`,
    pmh: null,
    diagnosis: "Under evaluation",
    done: ["Triage evaluation done", "Vitals recorded"],
    toBeDone: ["Doctor assessment pending", "Review investigation results"],
    vitalsNow: "Vitals documented in raw notes",
    criticalAlerts: [],
    bystander: null,
    alertRow: "⚠  Patient under active evaluation in ER",
    rawNotes: rawText
  };
}

// ── Main extraction function ──────────────────────────────────
export async function extractHandover(
  rawText: string
): Promise<{
  success: boolean;
  data?: any;
  extracted?: any;
  error?: string;
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

  // STEP 1 — Preprocess
  const cleaned = preprocessEMR(rawText);
  console.log(
    `[Handover] Preprocessed: ${rawText.length} → ${cleaned.length} chars ` +
    `(${Math.round((1 - cleaned.length / Math.max(1, rawText.length)) * 100)}% reduction)`
  );

  // STEP 2 — Reverse entries
  const reversed = reverseEMREntries(cleaned);

  // Count entries
  const entriesFound = (reversed.match(/───────────────────/g) || []).length + 1;
  console.log(`[Handover] Entries found: ${entriesFound}`);

  // STEP 3 — Select model
  const { model, provider } = selectModel(reversed.length);
  console.log(`[Handover] Model selected: ${model} (${reversed.length} chars)`);

  // STEP 4 — Extract
  const prompt = buildHandoverPrompt(reversed);

  const tryExtract = async (
    m: string, p: 'claude' | 'gemini'
  ): Promise<string> => {
    if (p === 'claude') return callClaude(prompt, m);
    return callGemini(prompt, m);
  };

  // Fallback chain
  const attempts: Array<{ model: string; provider: 'claude' | 'gemini' }> = [
    { model, provider },
    // Fallbacks
    ...(provider === 'gemini' ? [
      { model: MODELS.CLAUDE_HAIKU, provider: 'claude' as const },
      { model: MODELS.CLAUDE_SONNET, provider: 'claude' as const },
      { model: MODELS.GEMINI_PRO, provider: 'gemini' as const },
    ] : [
      { model: MODELS.CLAUDE_SONNET, provider: 'claude' as const },
      { model: MODELS.GEMINI_FLASH, provider: 'gemini' as const },
      { model: MODELS.GEMINI_PRO, provider: 'gemini' as const },
    ]),
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
      const diagnosis = parsed.diagnosis || parsed.provisionalDiagnosis || "Under evaluation";
      const done = Array.isArray(parsed.done) ? parsed.done : [];
      const toBeDone = Array.isArray(parsed.toBeDone) ? parsed.toBeDone : [];
      const vitalsNow = parsed.vitalsNow || parsed.vitals || null;
      const criticalAlerts = Array.isArray(parsed.criticalAlerts) ? parsed.criticalAlerts : [];
      const pmh = parsed.pmh || parsed.pastMedicalHistory || null;
      const story = parsed.story || "";
      const alertRow = parsed.alertRow || (diagnosis ? `⚠  ${diagnosis}` : "✓  Stable");

      const normalizedExtracted = {
        patientLabel: {
          name,
          ageSex,
          bed: pl.bed || null,
          erNumber: pl.erNumber || null,
          admittingConsultant: pl.admittingConsultant || null,
          inERSince: pl.inERSince || null,
          status
        },
        presentingComplaint: parsed.presentingComplaint || "Presenting complaint recorded.",
        story,
        pmh,
        diagnosis,
        done,
        toBeDone,
        vitalsNow,
        criticalAlerts,
        bystander: parsed.bystander || parsed.bystanderUpdate || null,
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

      return {
        success: true,
        extracted: normalizedExtracted,
        data: normalizedExtracted,
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
