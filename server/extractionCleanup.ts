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
  procedures?: string[];
  plan: string[];
  labs: { name: string; value: string | number | null }[];
  imaging?: { name: string; value: string | number | null }[];
  fastFindings?: {
    heart?: string | null;
    abdomen?: string | null;
    pelvis?: string | null;
  };
  generalExamination?: string | null;
  cvsExamination?: string | null;
  respiratoryExamination?: string | null;
  abdomenExamination?: string | null;
  cnsExamination?: string | null;
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

export function isImagingInvestigation(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return /\b(x-ray|xray|cxr|axr|pxr|radiograph|radiography|ct|cect|hrct|ncct|mri|mra|mrv|usg|ultrasound|sonography|sonogram|fast|efast|echo|echocardiogram|echocardiography|pet-ct|pet ct)\b/i.test(n);
}

export function isTentativeOrPlannedIntervention(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();

  // Planning keywords: plan, planned, plan for, plans for, planning
  if (/\b(plan\b|planned\b|planning\b|plan\s+for\b|plans\s+for\b)/i.test(t)) return true;

  // Tentative / consideration keywords: consider, considering, consideration, suggested, tentative
  if (/\b(consider\b|considering\b|consideration\b|suggested\b|tentative\b)/i.test(t)) return true;

  // Potential administration / performance: may give, may administer, may perform, may catheterize, etc.
  if (/\bmay\s+(?:give|administer|perform|catheterize|insert|apply|start|use)\b/i.test(t)) return true;

  // Conditional clauses: if required, if needed, if indicated, if necessary, if retention, if hypotensive, etc.
  if (/\bif\s+(?:required|needed|indicated|necessary|persists|worsens|fails|hypotensive|hypotension|retention|pain|fever|oliguria)\b/i.test(t)) return true;
  if (/\bif\s+[a-z0-9\s]{1,30}?\b(?:persists|worsens|develops|recurs|fails)\b/i.test(t)) return true;

  // As needed / PRN / standby
  if (/\b(prn\b|as\s+needed\b|sos\b|when\s+needed\b|on\s+demand\b)/i.test(t)) return true;

  // Prospective / not yet done phrasing
  if (/\bto\s+be\s+(?:given|done|started|administered|inserted|applied|performed|taken|considered)\b/i.test(t)) return true;

  // Prospective procedure orders: for catheterization, for procedure, etc.
  if (/\bfor\s+(?:catheterization|procedure|suturing|reduction|splinting|intubation)\b/i.test(t)) return true;

  // Standby / readiness
  if (/\b(standby|keep\s+ready|ready\s+for|awaiting|pending)\b/i.test(t)) return true;

  return false;
}

export function isProcedureIntervention(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  // Safety rule: Tentative or planned procedures must NOT be treated as completed
  if (isTentativeOrPlannedIntervention(text)) return false;

  const t = text.trim().toLowerCase();

  // Must match explicit procedure terminology
  const hasProcedureKeyword = /\b(catheterization|catheter|foley|foleys|ng\s+tube|ryles?\s+tube|sutur(?:ing|ed|e)?|irrigat(?:ion|ed)?|splint(?:ing|ed)?|reduction|dressing|intubat(?:ion|ed)|chest\s+tube|icd|cannulat(?:ion|ed))\b/i.test(t);
  if (!hasProcedureKeyword) return false;

  // Completion must be explicitly documented
  const hasExplicitCompletion = /\b(done|inserted|placed|sutured|applied|performed|completed|reduced|irrigated|intubated|cannulated|dressing\s+done)\b/i.test(t);
  return hasExplicitCompletion;
}

export function isAcuteMedicationIntervention(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  // Safety rule: Tentative or planned medications must NOT be treated as completed
  if (isTentativeOrPlannedIntervention(text)) return false;

  const t = text.trim().toLowerCase();

  // Exclude non-treatment clinical management advice
  if (/\b(keep npo|nil per oral|consult|review|opinion|admit|transfer|shift to|repeat|monitor|discharge|follow up|advice|prognosis)\b/i.test(t)) {
    return false;
  }

  // Must match known acute medication or fluid
  const hasDrugKeyword = /\b(pantoprazole|ondansetron|fluid|fluids|saline|ringers?|ns\b|rl\b|paracetamol|pcm\b|ceftriaxone|tramadol|fentanyl|morphine|midazolam|propofol|adrenaline|epinephrine|hydrocortisone|deriphyllin|lasix|furosemide|antibiotic|analgesic|antacid|antipyretic)\b/i.test(t);
  if (!hasDrugKeyword) return false;

  // Administration must be explicit (e.g. given, administered, started, infused, bolus given)
  // Do NOT infer administration merely because dose/route is present.
  const hasExplicitAdministration = /\b(given|administered|started|infused|bolus\s+given|injected|pushed)\b/i.test(t);
  return hasExplicitAdministration;
}

export function isGenericInvestigationPhrase(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();
  // Detect phrases like "Appropriate investigations were planned based on clinical assessment and duration of fever"
  // or "routine investigations planned", "investigations planned based on assessment", "appropriate labs planned"
  if (/\b(appropriate|routine|necessary|indicated|standard|baseline)\s+(investigations?|labs?|blood\s*work|workup|tests?)\b/i.test(t)) {
    return true;
  }
  if (/\b(investigations?|labs?|blood\s*work|workup|tests?)\s+(were\s+)?(planned|advised|deferred|recommended|considered)\s+based\s+on\b/i.test(t)) {
    return true;
  }
  if (/^appropriate\s+investigations\b/i.test(t)) return true;
  if (/^investigations\s+planned\b/i.test(t)) return true;
  return false;
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

  // Acute Procedures list
  let rawProcedures: any[] = [];
  if (Array.isArray(raw.procedures) && raw.procedures.length > 0) {
    rawProcedures = raw.procedures;
  } else if (typeof raw.procedures === "string" && raw.procedures.trim().length > 0) {
    rawProcedures = raw.procedures.split(/;|\n/).map((p: string) => p.trim());
  }
  rawProcedures = rawProcedures.filter(p => typeof p === "string" ? !isTentativeOrPlannedIntervention(p) : true);

  // Acute Drugs / Medications — straightforward entity list (ER acute treatments only)
  // NEVER include outpatient/SAMPLE medications here.
  let drugsArray: any[] = [];
  if (Array.isArray(raw.treatment) && raw.treatment.length > 0) {
    drugsArray = raw.treatment;
  } else if (Array.isArray(raw.treatmentInER) && raw.treatmentInER.length > 0) {
    drugsArray = raw.treatmentInER;
  } else if (Array.isArray(raw.acuteTreatment) && raw.acuteTreatment.length > 0) {
    drugsArray = raw.acuteTreatment;
  } else if (Array.isArray(raw.drugs) && raw.drugs.length > 0) {
    drugsArray = raw.drugs;
  } else if (typeof raw.treatment === "string" && raw.treatment.trim().length > 0) {
    drugsArray = raw.treatment.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.treatmentInER === "string" && raw.treatmentInER.trim().length > 0) {
    drugsArray = raw.treatmentInER.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.acuteTreatment === "string" && raw.acuteTreatment.trim().length > 0) {
    drugsArray = raw.acuteTreatment.split(/;|\n|,/).map((d: string) => d.trim());
  } else if (typeof raw.drugs === "string" && raw.drugs.trim().length > 0) {
    drugsArray = raw.drugs.split(/;|\n|,/).map((d: string) => d.trim());
  }

  // Plan / Disposition — accept array or single string, normalize
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

  // Scan planArray for acute interventions (procedures, acute medications, imaging, labs)
  // so they are not left buried solely under Plan, while preserving true narrative plan.
  const narrativePlanItems: string[] = [];
  const planInterventionDrugs: string[] = [];
  const planInterventionProcedures: string[] = [];
  const planInterventionImaging: string[] = [];
  const planInterventionLabs: string[] = [];

  for (const item of planArray) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (isProcedureIntervention(trimmed)) {
      planInterventionProcedures.push(trimmed);
    } else if (isAcuteMedicationIntervention(trimmed)) {
      planInterventionDrugs.push(trimmed);
    } else if (isImagingInvestigation(trimmed)) {
      planInterventionImaging.push(trimmed);
    } else if (/\b(cbc|rft|lft|abg|vbg|troponin|cardiac enzymes|serum electrolytes|blood sugar|rbs|urine routine)\b/i.test(trimmed) && /\b(sent|ordered|drawn|done|check)\b/i.test(trimmed)) {
      planInterventionLabs.push(trimmed.replace(/\b(sent|ordered|drawn|done|check)\b/gi, "").trim());
    } else {
      narrativePlanItems.push(trimmed);
    }
  }

  if (planInterventionProcedures.length > 0) {
    rawProcedures = [...rawProcedures, ...planInterventionProcedures];
  }
  if (planInterventionDrugs.length > 0) {
    drugsArray = [...drugsArray, ...planInterventionDrugs];
  }

  // Split compound treatments if present (e.g. fluids along with antipyretic)
  const expandedDrugsArray: any[] = [];
  for (const drug of drugsArray) {
    const str = typeof drug === "string" ? drug : (drug.drugName || drug.name || "");
    if (/\b(?:oral\s+or\s+iv\s+)?fluids?.*(?:\band\b|\balong\s+with\b|\bwith\b).*antipyretic/i.test(str)) {
      const fluidPart = str.replace(/(?:\band\b|\balong\s+with\b|\bwith\b).*antipyretic.*$/i, "").trim().replace(/\s+were\s+given\b/i, "");
      const antipyreticPart = str.replace(/^.*?(?:\band\b|\balong\s+with\b|\bwith\b)\s*/i, "").trim().replace(/\s+treatment\b/i, "");
      if (fluidPart) expandedDrugsArray.push(fluidPart);
      if (antipyreticPart) expandedDrugsArray.push(antipyreticPart);
    } else {
      expandedDrugsArray.push(drug);
    }
  }

  const procedures = cleanEntityList(rawProcedures);

  const drugs = expandedDrugsArray.map(d => {
    if (typeof d === "string") {
      if (isTentativeOrPlannedIntervention(d)) return null;
      return d.trim();
    }
    if (typeof d === "object" && d !== null) {
      if (isTentativeOrPlannedIntervention(d.drugName || d.name || "")) return null;
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

  // Labs & Imaging — strictly separate laboratory investigations from imaging
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

  // Also include raw.imaging if present
  let rawImaging: { name: string; value: string | number | null }[] = [];
  const imagingField = raw.imaging ?? raw.investigationImaging ?? raw.radiology;
  if (Array.isArray(imagingField)) {
    rawImaging = imagingField.map(i => typeof i === 'string' ? { name: i, value: null } : i);
  } else if (typeof imagingField === 'string' && imagingField.trim().length > 0) {
    rawImaging = imagingField.split(/;|\n|,/).map(i => ({ name: i.trim(), value: null }));
  }

  for (const labText of planInterventionLabs) {
    const splitLabs = labText.split(/;|,/).map(s => s.trim()).filter(Boolean);
    for (const sub of splitLabs) {
      rawLabs.push({ name: sub, value: null });
    }
  }

  for (const imgText of planInterventionImaging) {
    const cleanImg = imgText.replace(/\b(ordered|done|taken|sent)\b/gi, "").trim();
    if (cleanImg) rawImaging.push({ name: cleanImg, value: null });
  }

  const cleanedLabs: { name: string; value: string | number | null }[] = [];
  const cleanedImaging: { name: string; value: string | number | null }[] = [];

  for (const item of rawLabs) {
    const cleanedName = stripCarrierPhrases(item.name) || item.name;
    if (!cleanedName || cleanedName.trim().length === 0) continue;
    if (isGenericInvestigationPhrase(cleanedName)) {
      narrativePlanItems.push(cleanedName.trim());
      continue;
    }
    const entry = { name: cleanedName.trim(), value: item.value ?? null };
    if (isImagingInvestigation(entry.name)) {
      cleanedImaging.push(entry);
    } else {
      cleanedLabs.push(entry);
    }
  }

  for (const item of rawImaging) {
    const cleanedName = stripCarrierPhrases(item.name) || item.name;
    if (!cleanedName || cleanedName.trim().length === 0) continue;
    if (isGenericInvestigationPhrase(cleanedName)) {
      narrativePlanItems.push(cleanedName.trim());
      continue;
    }
    cleanedImaging.push({ name: cleanedName.trim(), value: item.value ?? null });
  }

  const plan = cleanEntityList(narrativePlanItems);

  // Deduplicate investigations by name
  const labs = cleanedLabs.filter((item, index, self) =>
    index === self.findIndex(t => t.name.toLowerCase() === item.name.toLowerCase())
  );
  const imaging = cleanedImaging.filter((item, index, self) =>
    index === self.findIndex(t => t.name.toLowerCase() === item.name.toLowerCase())
  );

  const result: CleanedExtractionFields = { symptoms, events, drugs, procedures, plan, labs, imaging };

  // Preserve safe dictation fields strictly without guessing
  if (raw.fastFindings && typeof raw.fastFindings === 'object') {
    const fast: any = {};
    if (raw.fastFindings.heart !== undefined) fast.heart = raw.fastFindings.heart;
    if (raw.fastFindings.abdomen !== undefined) fast.abdomen = raw.fastFindings.abdomen;
    if (raw.fastFindings.pelvis !== undefined) fast.pelvis = raw.fastFindings.pelvis;
    if (Object.keys(fast).length > 0) result.fastFindings = fast;
  }

  if (typeof raw.generalExamination === 'string' && raw.generalExamination.trim()) {
    result.generalExamination = raw.generalExamination.trim();
  }
  if (typeof raw.cvsExamination === 'string' && raw.cvsExamination.trim()) {
    result.cvsExamination = raw.cvsExamination.trim();
  }
  if (typeof raw.respiratoryExamination === 'string' && raw.respiratoryExamination.trim()) {
    result.respiratoryExamination = raw.respiratoryExamination.trim();
  }
  if (typeof raw.abdomenExamination === 'string' && raw.abdomenExamination.trim()) {
    result.abdomenExamination = raw.abdomenExamination.trim();
  }
  if (typeof raw.cnsExamination === 'string' && raw.cnsExamination.trim()) {
    result.cnsExamination = raw.cnsExamination.trim();
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
