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
export function cleanEntityList(values: any[] | null | undefined): any[] {
  if (!values || !Array.isArray(values)) return [];
  return values
    .map(v => typeof v === 'string' ? stripCarrierPhrases(v) : v)
    .filter(v => v !== null && (typeof v !== 'string' || v.length > 0));
}

// ── Field-shape types matching extraction.ts output ──────────────────

export interface RawExtractionFields {
  symptoms?: string[] | string | null;
  events?: { time?: string | null; description?: string | null }[] | string | null;
  drugs?: string[] | string | null;
  medications?: string[] | string | null;
  plan?: string[] | string | null;
  treatment?: string[] | string | null;
  labs?: { name: string; value: string | number | null }[] | Record<string, any> | null;
  investigationResults?: Record<string, any> | null;
  [key: string]: any;
}

export interface CleanedExtractionFields {
  symptoms: string[];
  events: { time: string | null; description: string }[];
  drugs: any[];
  plan: string[];
  labs: { name: string; value: string | number | null }[];
  fastFindings?: {
    heart?: string | null;
    abdomen?: string | null;
    pelvis?: string | null;
  };
  extremitiesExamination?: string | null;
  lastMeal?: string | null;
  cSpineExam?: string | null;
  echo?: string | null;
  consultations?: string[];
  vbg?: {
    ph?: string | null;
    pco2?: string | null;
    po2?: string | null;
    hco3?: string | null;
    be?: string | null;
    lactate?: string | null;
    na?: string | null;
    k?: string | null;
    cl?: string | null;
    hb?: string | null;
    anionGap?: string | null;
    type?: string | null;
  };
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
    return { symptoms: [], events: [], drugs: [], plan: [], labs: [] };
  }

  // Symptoms — accept either array or single narrative string,
  // normalize to array of short entity fragments
  const rawSymptoms = raw.symptoms;
  const symptomsArray = Array.isArray(rawSymptoms)
    ? rawSymptoms
    : typeof rawSymptoms === "string" && rawSymptoms.trim()
    ? rawSymptoms.split(/;|\n|,/).map(s => s.trim())
    : [];

  const symptoms = cleanEntityList(symptomsArray);

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
  let drugsArray: any[] = [];
  if (Array.isArray(raw.treatment) && raw.treatment.length > 0) {
    drugsArray = raw.treatment;
  } else if (Array.isArray(raw.treatmentInER) && raw.treatmentInER.length > 0) {
    drugsArray = raw.treatmentInER;
  } else if (Array.isArray(raw.drugs) && raw.drugs.length > 0) {
    drugsArray = raw.drugs;
  } else if (Array.isArray(raw.medications) && raw.medications.length > 0) {
    drugsArray = raw.medications;
  } else if (typeof raw.treatment === "string" && raw.treatment.trim().length > 0) {
    drugsArray = raw.treatment.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.treatmentInER === "string" && raw.treatmentInER.trim().length > 0) {
    drugsArray = raw.treatmentInER.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.drugs === "string" && raw.drugs.trim().length > 0) {
    drugsArray = raw.drugs.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.medications === "string" && raw.medications.trim().length > 0) {
    drugsArray = raw.medications.split(/;|\n|,/).map((d: string) => d.trim());
  }
  
  const drugs = drugsArray.map(d => {
    if (typeof d === "string") return d.trim();
    if (typeof d === "object" && d !== null) {
      const obj: any = {};
      if (d.drugName) obj.drugName = String(d.drugName).trim();
      else if (d.name) obj.drugName = String(d.name).trim();

      if (d.dose) obj.dose = String(d.dose).trim();
      if (d.route) obj.route = String(d.route).trim();
      if (d.instruction) obj.instruction = String(d.instruction).trim();
      
      if (d.timeGiven) {
        const t = String(d.timeGiven).trim().toLowerCase();
        if (t === "stat" || t === "bd" || t === "tds" || t === "od" || t === "sos") {
          if (!obj.instruction) obj.instruction = String(d.timeGiven).trim();
          obj.timeGiven = "";
        } else {
          obj.timeGiven = String(d.timeGiven).trim();
        }
      } else {
        obj.timeGiven = "";
      }
      
      if (Object.keys(obj).length > 1 || obj.drugName) return obj;
    }
    return null;
  }).filter(Boolean);

  // Plan / Treatment — accept array or single string, normalize
  const rawPlan: any = raw.plan ?? raw.disposition ?? raw.dispositionAndPlan;
  let planArray: string[] = [];
  if (Array.isArray(rawPlan)) {
    planArray = rawPlan.map(p => typeof p === "string" ? p : JSON.stringify(p));
  } else if (typeof rawPlan === "string" && rawPlan.trim().length > 0) {
    planArray = rawPlan.split(/;|\n/).map(p => p.trim());
  } else if (rawPlan && typeof rawPlan === "object") {
    if (rawPlan.dispositionStatus) planArray.push(`Disposition: ${rawPlan.dispositionStatus}`);
    if (rawPlan.followUpAdvice) planArray.push(`Advice: ${rawPlan.followUpAdvice}`);
  }
  const plan = cleanEntityList(planArray);

  // Labs — clean name only; value is numeric/lab-native, left untouched
  let rawLabs: { name: string; value: string | number | null }[] = [];
  const labsField = raw.labs ?? raw.investigationResults ?? raw.investigations ?? raw.investigationFindings?.labs;
  if (Array.isArray(labsField)) {
    rawLabs = labsField.map(l => typeof l === 'string' ? { name: l, value: null } : l);
  } else if (labsField && typeof labsField === "object") {
    rawLabs = Object.entries(labsField).map(([name, value]) => ({
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

  const result: CleanedExtractionFields = { symptoms, events, drugs, plan, labs };

  // Preserve safe dictation fields strictly without guessing
  if (raw.fastFindings && typeof raw.fastFindings === 'object') {
    const fast: any = {};
    if (raw.fastFindings.heart !== undefined) fast.heart = raw.fastFindings.heart;
    if (raw.fastFindings.abdomen !== undefined) fast.abdomen = raw.fastFindings.abdomen;
    if (raw.fastFindings.pelvis !== undefined) fast.pelvis = raw.fastFindings.pelvis;
    if (Object.keys(fast).length > 0) result.fastFindings = fast;
  }

  if (typeof raw.extremitiesExamination === 'string' && raw.extremitiesExamination.trim()) {
    result.extremitiesExamination = raw.extremitiesExamination.trim();
  }
  
  if (typeof raw.lastMeal === 'string' && raw.lastMeal.trim()) {
    result.lastMeal = raw.lastMeal.trim();
  }
  
  if (typeof raw.cSpineExam === 'string' && raw.cSpineExam.trim()) {
    result.cSpineExam = raw.cSpineExam.trim();
  }
  
  if (typeof raw.echo === 'string' && raw.echo.trim()) {
    result.echo = raw.echo.trim();
  }
  
  if (Array.isArray(raw.consultations)) {
    const validConsults = raw.consultations.filter(c => typeof c === 'string' && c.trim().length > 0);
    if (validConsults.length > 0) result.consultations = validConsults;
  }

  if (raw.vbg && typeof raw.vbg === 'object') {
    const v: any = {};
    const validKeys = ['ph', 'pco2', 'po2', 'hco3', 'be', 'lactate', 'na', 'k', 'cl', 'hb', 'anionGap', 'type'];
    for (const k of validKeys) {
      if (raw.vbg[k] !== undefined && raw.vbg[k] !== null) {
        v[k] = raw.vbg[k];
      }
    }
    if (Object.keys(v).length > 0) result.vbg = v;
  }

  return result;
}
