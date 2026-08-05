/**
 * extractionCleanup.ts
 *
 * Deterministic, rule-based cleanup pass applied AFTER the LLM (GPT-4o-mini
 * primary / Claude 3.5 Haiku fallback) returns structured JSON from
 * server/extraction.ts, and BEFORE the result is saved to Firestore.
 *
 * Purpose: entity-only fields (Signs & Symptoms, Events, Drugs, Plan, Labs)
 * must never carry narrative "sentence" phrasing. Even with a tightened
 * prompt, models occasionally leak carrier phrases — this scrubber is the
 * deterministic safety net, per ErMate's zero-hallucination / rule-based
 * post-processing philosophy (same pattern as clinicalRanges.ts).
 *
 * CRITICAL: This file must NEVER call an AI model. Regex only.
 */

// ── Carrier phrase patterns ──────────────────────────────────────────
// Ordered roughly by specificity. Matched at the START of a field value
// (after trim), case-insensitive. Extend this list as new leak patterns
// are observed in production output.

const CARRIER_PHRASES: RegExp[] = [
  // Presenting-complaint style openers
  /^(pt\.?|patient)\s+(presented|came|reports?)\s+(to\s+(the\s+)?(er|ed|emergency)\s+)?with\s+(complaints?\s+of\s+)?/i,
  /^(pt\.?|patient)\s+(gives?|has|had)\s+(a\s+)?history\s+of\s+/i,
  /^c\/o\.?\s+/i,
  /^complain(s|ed|t)?\s+of\s+/i,
  /^presenting\s+with\s+/i,
  /^presented\s+with\s+/i,

  // Drug / management openers
  /^(was|were)\s+(given|started\s+on|administered)\s+/i,
  /^(pt\.?|patient)\s+(was|were)\s+(given|started\s+on|administered)\s+/i,
  /^inj\.?\s+(?=.*given)/i, // rare double-marker case, leave "Inj." itself untouched normally
  /^as\s+(advised|per\s+(the\s+)?order)\s*[,:]?\s*/i,
  /^(doctor\s+)?advised\s+(to\s+)?/i,
  /^it\s+was\s+decided\s+(that\s+)?/i,
  /^decided\s+(that\s+)?/i,
  /^plan\s+is\s+to\s+/i,
  /^plan\s*[:\-]\s*/i,

  // Examination / event openers
  /^on\s+examination[,]?\s*/i,
  /^(pt\.?|patient)\s+(was\s+)?found\s+to\s+have\s+/i,
  /^it\s+was\s+noted\s+that\s+/i,
  /^noted\s+that\s+/i,
  /^observed\s+(that\s+)?/i,

  // Lab-result openers
  /^(the\s+)?(lab|test|report)s?\s+(came\s+back|showed|revealed)\s*[,:]?\s*/i,
  /^(came\s+back|showed|revealed)\s*[,:]?\s*/i,
];

// Trailing filler to strip from the END of a field value
const TRAILING_FILLER: RegExp[] = [
  /\s*\.\s*$/,                          // stray trailing period
  /\s+as\s+(advised|noted|ordered)\.?$/i,
  /\s+by\s+the\s+doctor\.?$/i,
];

/**
 * Strips known carrier phrases from a single field's string value.
 * Safe to call on already-clean strings (no-op).
 */
export function stripCarrierPhrases(rawValue: string | null | undefined): string | null {
  if (!rawValue || typeof rawValue !== "string") return null;

  let cleaned = rawValue.trim();

  // Strip leading carrier phrases (loop once — extraction sometimes has
  // two stacked, e.g. "Patient presented with c/o fever")
  for (let pass = 0; pass < 2; pass++) {
    for (const pattern of CARRIER_PHRASES) {
      cleaned = cleaned.replace(pattern, "");
    }
  }

  for (const pattern of TRAILING_FILLER) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.trim();

  // Capitalize first letter for consistent display (entity fields read
  // as fragments, not sentences, but should still look intentional)
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Applies stripCarrierPhrases across an array field (e.g. multiple
 * symptoms or drugs extracted as separate list items).
 */
export function cleanEntityList(values: (string | null | undefined)[] | null | undefined): string[] {
  if (!values || !Array.isArray(values)) return [];
  return values
    .map(stripCarrierPhrases)
    .filter((v): v is string => v !== null && v.length > 0);
}

// ── Field-shape types matching extraction.ts output ──────────────────

export interface RawExtractionFields {
  signsSymptoms?: string[] | string | null;
  symptoms?: string[] | string | null;
  signsAndSymptoms?: string[] | string | null;
  events?: { time?: string | null; description?: string | null }[] | string | null;
  drugs?: string[] | null;
  medications?: string[] | null;
  plan?: string[] | string | null;
  treatment?: string[] | string | null;
  labs?: { name: string; value: string | number | null }[] | Record<string, any> | null;
  investigationResults?: Record<string, any> | null;
  [key: string]: any;
}

export interface CleanedExtractionFields {
  signsSymptoms: string[];
  events: { time: string | null; description: string }[];
  drugs: string[];
  plan: string[];
  labs: { name: string; value: string | number | null }[];
}

/**
 * Main entry point — call this on the full extraction result object
 * immediately after the LLM call returns, before saving to Firestore.
 *
 * Usage in server/extraction.ts:
 *   const rawResult = await callExtractionModel(deidentifiedText);
 *   const cleaned = cleanExtractionOutput(rawResult);
 *   await saveToFirestore(cleaned);
 */
export function cleanExtractionOutput(raw: RawExtractionFields): CleanedExtractionFields {
  if (!raw || typeof raw !== "object") {
    return { signsSymptoms: [], events: [], drugs: [], plan: [], labs: [] };
  }

  // Signs & Symptoms — accept either array or single narrative string,
  // normalize to array of short entity fragments
  const rawSymptoms = raw.signsSymptoms ?? raw.signsAndSymptoms ?? raw.symptoms;
  const symptomsArray = Array.isArray(rawSymptoms)
    ? rawSymptoms
    : typeof rawSymptoms === "string" && rawSymptoms.trim()
    ? rawSymptoms.split(/;|\n|,/).map(s => s.trim())
    : [];

  const signsSymptoms = cleanEntityList(symptomsArray);

  // Events — keep timestamp, clean description only
  let rawEvents: { time?: string | null; description?: string | null }[] = [];
  if (typeof raw.events === "string") {
    if (raw.events.trim()) {
      rawEvents = [{ time: null, description: raw.events }];
    }
  } else if (Array.isArray(raw.events)) {
    rawEvents = raw.events.map(e =>
      typeof e === "string" ? { time: null, description: e } : e || {}
    );
  }

  const events = rawEvents
    .map(e => ({
      time: e.time?.trim() || null,
      description: stripCarrierPhrases(e.description) || "",
    }))
    .filter(e => e.description.length > 0);

  // Drugs / Medications — straightforward entity list
  const rawDrugs: any = raw.drugs ?? raw.medications;
  let drugsArray: string[] = [];
  if (Array.isArray(rawDrugs)) {
    drugsArray = rawDrugs.map(d => String(d));
  } else if (typeof rawDrugs === "string" && rawDrugs.trim().length > 0) {
    drugsArray = rawDrugs.split(/;|\n|,/).map(d => d.trim());
  }
  const drugs = cleanEntityList(drugsArray);

  // Plan / Treatment — accept array or single string, normalize
  const rawPlan: any = raw.plan ?? raw.treatment;
  let planArray: string[] = [];
  if (Array.isArray(rawPlan)) {
    planArray = rawPlan.map(p => String(p));
  } else if (typeof rawPlan === "string" && rawPlan.trim().length > 0) {
    planArray = rawPlan.split(/;|\n/).map(p => p.trim());
  }
  const plan = cleanEntityList(planArray);

  // Labs — clean name only; value is numeric/lab-native, left untouched
  let rawLabs: { name: string; value: string | number | null }[] = [];
  if (Array.isArray(raw.labs)) {
    rawLabs = raw.labs;
  } else if (raw.labs && typeof raw.labs === "object") {
    rawLabs = Object.entries(raw.labs).map(([name, value]) => ({
      name,
      value: value as any,
    }));
  } else if (raw.investigationResults && typeof raw.investigationResults === "object") {
    rawLabs = Object.entries(raw.investigationResults).map(([name, value]) => ({
      name,
      value: value as any,
    }));
  }

  const labs = rawLabs
    .map(l => ({
      name: stripCarrierPhrases(l.name) || l.name,
      value: l.value ?? null,
    }))
    .filter(l => l.name && l.name.length > 0);

  return { signsSymptoms, events, drugs, plan, labs };
}
