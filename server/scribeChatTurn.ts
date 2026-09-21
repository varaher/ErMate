/**
 * scribeChatTurn.ts
 *
 * Powers the "Scribe & Clinical Chat" screen as an actual two-way
 * chat: every user turn (typed OR voice-transcribed) triggers TWO
 * separate model calls, per the LOCKED model matrix — these must
 * never be merged into one call or one model:
 *
 *   1. EXTRACTION → updates the Case Sheet
 *      Model: GPT-4o-mini PRIMARY, Claude 3.5 Haiku FALLBACK
 *      Temperature: 0.0, entity-only (Rule 14)
 *
 *   2. CLINICAL REASONING → DDx, textbook references, red flags
 *      Model: Claude 3.5 Sonnet ONLY — NO FALLBACK (Rule 1: Clinical
 *      Q&A / Reference Chat is single-model; if unavailable, return a
 *      clear error, never degrade to another model, never Gemini)
 *
 * Both calls receive the SAME de-identified, PHI-stripped input
 * (Rule 4) but are otherwise fully independent — a failure in one
 * must not block the other. If extraction succeeds but clinical
 * reasoning fails, the case sheet still updates and the chat shows
 * a friendly "reference unavailable" message, not a wall failure.
 *
 * VOICE-02/VOICE-03 FIX (Sept 2026): mapExtractionToCaseSheetFields()
 * previously silently fabricated baseline vitals (FAB-18), a full
 * normal ABCDE + secondary-survey exam (FAB-19), and NKDA/PMH defaults
 * (FAB-20) any time ANY unrelated clinical content was dictated. This
 * has been removed. Normal-exam text is now applied ONLY when the
 * doctor explicitly says an ABCDE/systemic-exam normalcy phrase
 * ("ABCDE normal", "systemic exam unremarkable", etc — see
 * detectNormalcyPhrases in extraction.ts), and vitals/GCS are NEVER
 * defaulted under any circumstance — real dictated value or left
 * undocumented, always. Shared helpers imported from extraction.ts so
 * this pipeline and the voice-scribe pipeline can't silently diverge.
 *
 * VOICE-04 FIX (Sept 2026): mapExtractionToCaseSheetFields() read
 * raw.patientName, raw.vitals, raw.airway...raw.exposure, raw.allergies,
 * raw.pmh, raw.outpatientMedications — but never once read raw.vbg or
 * raw.differentials, even though both are defined in the extraction
 * schema (buildExtractionPrompt in extraction.ts) and are correctly
 * produced by the model. Fixed below by adding explicit raw.vbg /
 * raw.differentials branches, following the same real-value-only
 * pattern already used for vitals.
 *
 * GREETING FIX (Sept 2026): a bare "Hi"/"Thanks"/"Ok" was previously
 * sent through the full extraction pipeline, where GPT-4o-mini could
 * hallucinate a trivial field from a one-word message and trigger a
 * false "✅ Case sheet extracted and saved." isConversationalOnly()
 * below hard-short-circuits any greeting-shaped input before any
 * model call — no extraction, no reasoning, just a warm static reply.
 *
 * CHECKLIST-WIRING FIX (Sept 2026): mapExtractionToCaseSheetFields()
 * had no mapping at all for extremitiesExamination, fastFindings, or
 * mlcDetails — all three added to the extraction schema in
 * voiceExtraction.ts but silently dropped at this step, same pattern
 * as the original VOICE-04 gap. Fixed below with real-value-only
 * mapping for all three; no normal-default fallback for extremities
 * (it's frequently the one named exception in an otherwise-normal
 * secondary survey) or for identificationMark (previously contaminated
 * by baked-in docx example text).
 */

import {
  deidentifyText,
  protectInternalClinicians,
  isRedactedOrPlaceholderClinician,
  type ProtectedCliniciansResult,
} from "./deidentify";
import { cleanExtractionOutput, isGenericInvestigationPhrase, type RawExtractionFields } from "./extractionCleanup";
import type { CaseSheetData } from "./caseSheetTypes";
import { generateDischargeSummary } from "./dischargeSummary";
import { detectNormalcyPhrases, EXAM_DEFAULTS, processSampleMedicationsAndPmh } from "./extraction";

// ── Conversational-only detection ────────────────────────────────────
const GREETING_ONLY_REGEX = /^(hi+|hello+|hey+|yo|good morning|good afternoon|good evening|thanks|thank you|thanks a lot|thank you so much|ok|okay|cool|great|got it|sounds good|bye|goodbye)[.!\s]*$/i;

function isConversationalOnly(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/).length > 4) return false;
  return GREETING_ONLY_REGEX.test(trimmed);
}

const GREETING_REPLIES = [
  "Hey! Good to see you — dictate the case whenever you're ready, or ask me anything.",
  "Hi there! I'm here whenever you want to dictate a case or ask a clinical question.",
  "Hello! Ready when you are — go ahead and dictate, or fire away with a question.",
];

function pickGreetingReply(): string {
  return GREETING_REPLIES[Math.floor(Math.random() * GREETING_REPLIES.length)];
}

// ── Chat message shape ──────────────────────────────────────────────

export interface ScribeChatMessage {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  type: "text" | "extraction-confirmation" | "clinical-reasoning" | "error";
  content: string;
  extractionApplied?: boolean;
  dischargeApplied?: boolean;
  extractionSummary?: {
    fieldsUpdated: string[];
    abnormalFlags: string[];
  };
  clinicalReasoning?: {
    differentials: string[];
    references: { source: string; note: string }[];
    watchFor: string[];
  };
}

export interface ScribeTurnResponse {
  extractionMessage: ScribeChatMessage;
  reasoningMessage: ScribeChatMessage;
  updatedCaseSheetFields?: Partial<CaseSheetData> & Record<string, any>;
  unappliedExtraction?: Partial<CaseSheetData> & Record<string, any>;
  dischargeDraft?: string;
  reply?: string;
  ageQuestionNeeded?: boolean;
  dischargeIntent?: boolean;
}


function deepMergeExtraction(base: any, incoming: any): any {
  const result = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === undefined || val === "") continue;
    const existing = result[key];
    if (Array.isArray(val)) {
      result[key] = Array.isArray(existing) ? [...existing, ...val] : val;
    } else if (typeof val === "object") {
      result[key] = (existing && typeof existing === "object" && !Array.isArray(existing))
        ? deepMergeExtraction(existing, val)
        : val;
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getMergedPendingExtraction(chatHistory: any[], existingCaseSheet: any): any {
  let merged = { ...existingCaseSheet };
  for (const msg of chatHistory) {
    // Both extractionData and unappliedExtraction are preserved from frontend
    const ext = msg.extractionData || msg.unappliedExtraction;
    if (msg.sender === "ai" && ext) {
      // Defensive guard: never copy diagnoses or differentials from assistant clinical reasoning
      // or suggestions into merged extraction.
      const safeExt = { ...ext };
      delete safeExt.clinicalReasoning;
      delete safeExt.reasoningMessage;
      delete safeExt.differentials;
      delete safeExt.clinicalReasoningDifferentials;
      merged = deepMergeExtraction(merged, safeExt);
    }
  }
  return merged;
}

// ── Main orchestrator — call this on every chat turn ────────────────

export async function processScribeChatTurn(
  userInput: string,
  patientAgeYears: number | null,
  existingCaseSheet: Partial<CaseSheetData> | Record<string, any>,
  caseId: string,
  chatHistory: any[],
  helpers: {
    callExtractionModel: (params: {
      model: "gpt-4o-mini" | "claude-3.5-haiku";
      temperature: number;
      deidentifiedInput: string;
      patientAgeYears: number | null;
      pendingClarification?: string;
    }) => Promise<RawExtractionFields>;
    callClinicalReasoningModel: (params: {
      model: "claude-3.5-sonnet";
      deidentifiedInput: string;
      caseContext: Partial<CaseSheetData> | Record<string, any>;
      chatHistory: any[];
    }) => Promise<{
      summary: string;
      differentials: string[];
      references: { source: string; note: string }[];
      watchFor: string[];
    }>;
  }
): Promise<ScribeTurnResponse> {
  // Conversational-only turns skip extraction + reasoning entirely.
  if (isConversationalOnly(userInput)) {
    const greetingMessage: ScribeChatMessage = {
      id: "greet-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "text",
      content: pickGreetingReply(),
    };
    return {
      extractionMessage: greetingMessage,
      reasoningMessage: greetingMessage,
      reply: greetingMessage.content,
    };
  }

  // Protect role-attributed internal clinician names (EM Resident / EM Consultant)
  // using local reversible placeholders BEFORE general PHI de-identification runs
  const clinicianProtection = protectInternalClinicians(userInput);
  const phiResult = deidentifyText(clinicianProtection.protectedText);
  const deidentifiedInput = phiResult.deidentified;

  // Intent Detection: Is this a Discharge Summary request?
  const isDischargeReq =
    /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+(?:a\s+|the\s+)?discharge\s+(?:summary|note)\b/i.test(userInput) ||
    /^\s*discharge\s+(?:summary|note)\s*$/i.test(userInput) ||
    /\b(?:prepare|write|create|generate|draft|make|give|provide)\s+ds\b/i.test(userInput) ||
    /^\s*ds\s*$/i.test(userInput);

  if (isDischargeReq) {
    const dischargeMessage: ScribeChatMessage = {
      id: "ds-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "clinical-reasoning",
      content: "I'll open the Discharge Summary view with these details for you now.",
    };

    return {
      extractionMessage: dischargeMessage,
      reasoningMessage: dischargeMessage,
      dischargeIntent: true,
      reply: dischargeMessage.content,
    };
  }

  const mergedPendingExtraction = getMergedPendingExtraction(chatHistory, existingCaseSheet);
  const effectiveAgeYears = patientAgeYears || mergedPendingExtraction.age || mergedPendingExtraction?.patient?.age || null;

  let pendingClarification: string | undefined;
  const lastAiMessage = [...chatHistory].reverse().find(m => m.sender === "ai" || m.role === "assistant");
  const lastAiText = lastAiMessage?.content ?? lastAiMessage?.text ?? "";
  if (lastAiText && /what is the patient's age/i.test(lastAiText)) {
    if (!effectiveAgeYears) {
      pendingClarification = "age";
    }
  }

  // Run extraction and clinical reasoning IN PARALLEL — independent
  // failures, independent models, independent fallback chains.
  const [extractionResult, reasoningResult] = await Promise.allSettled([
    runExtraction(
      deidentifiedInput,
      effectiveAgeYears,
      pendingClarification,
      mergedPendingExtraction,
      helpers.callExtractionModel,
      clinicianProtection
    ),
    runClinicalReasoning(
      deidentifiedInput.replace(/__ERMATE_EM_(?:RESIDENT|CONSULTANT)_\d+__/g, "[DOCTOR]"),
      mergedPendingExtraction,
      chatHistory,
      helpers.callClinicalReasoningModel
    ),
  ]);

  // ── Handle extraction outcome ──
  let extractionMessage: ScribeChatMessage;
  let updatedCaseSheetFields: Partial<CaseSheetData> & Record<string, any> = {};
  let ageQuestionNeeded = false;


  if (extractionResult.status === "fulfilled") {
    const { cleaned, updatedFields } = extractionResult.value;
    if (Object.keys(updatedFields).length > 0) {
      updatedCaseSheetFields = updatedFields;
      extractionMessage = {
        id: "ext-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "extraction-confirmation",
        content: "✅ Details captured from your update.",
        extractionSummary: {
          fieldsUpdated: Object.keys(updatedFields).filter(k => k !== 'vitals'),
          abnormalFlags: extractAbnormalFlags(cleaned),
        },
      };

      // AGE-COMPULSORY FIX (Sept 2026): age determines adult vs
      // pediatric checklist/case-sheet shape, so it can't be optional.
      // If this turn extracted real clinical content but no age is
      // known anywhere — not this turn, not already saved on the case
      // — ask directly instead of guessing "adult" by default.
      const ageFromThisTurn = updatedFields.age;
      const ageAlreadyKnown =
        (mergedPendingExtraction as any)?.age ??
        (mergedPendingExtraction as any)?.patient?.age;
      const ageFromProp = patientAgeYears;
      const hasAge =
        (ageFromThisTurn !== undefined && ageFromThisTurn !== null && String(ageFromThisTurn).trim() !== "") ||
        (ageAlreadyKnown !== undefined && ageAlreadyKnown !== null && String(ageAlreadyKnown).trim() !== "") ||
        (ageFromProp !== undefined && ageFromProp !== null && String(ageFromProp).trim() !== "");
      if (!hasAge) ageQuestionNeeded = true;
    } else {
      updatedCaseSheetFields = null;
      extractionMessage = {
        id: "ext-err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "Could not extract structured data from this entry. You can add it manually to the Case Sheet.",
      };
    }
  } else {
    extractionMessage = {
      id: "ext-err-" + Date.now(),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "error",
      content: "Could not extract structured data from this entry. You can add it manually to the Case Sheet.",
    };
    console.error(`[scribeChatTurn] Extraction failed for case ${caseId}`, extractionResult.reason);
  }

  // ── Handle clinical reasoning outcome ──
  let reasoningMessage: ScribeChatMessage;

  if (reasoningResult.status === "fulfilled") {
    reasoningMessage = {
      id: "reason-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "clinical-reasoning",
      content: reasoningResult.value.summary,
      clinicalReasoning: {
        differentials: reasoningResult.value.differentials,
        references: reasoningResult.value.references,
        watchFor: reasoningResult.value.watchFor,
      },
    };
  } else {
    // Per Rule 1: Clinical Q&A has NO fallback model — if Claude
    // Sonnet is unavailable, show a clear error, never degrade.
    reasoningMessage = {
      id: "reason-err-" + Date.now(),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "error",
      content: "Clinical reference is temporarily unavailable. Your case sheet update was still saved.",
    };
    console.error(`[scribeChatTurn] Clinical reasoning failed for case ${caseId}`, reasoningResult.reason);
  }

   let replyText = buildUnifiedReplyProse(extractionMessage, reasoningMessage);
  if (ageQuestionNeeded) {
    replyText += "\n\n❓ **What is the patient's age?** I need this to apply the correct adult or pediatric assessment checklist.";
  }

   return {
    extractionMessage,
    reasoningMessage,
    unappliedExtraction: updatedCaseSheetFields,
    reply: replyText,
    ageQuestionNeeded
  };
}

const isValidStr = (s: any): boolean =>
  typeof s === "string" &&
  s.trim().length > 0 &&
  !["unknown", "not specified", "not documented", "n/a", "none"].includes(s.trim().toLowerCase());

// ── Stage A: Extraction (GPT-4o-mini primary / Claude Haiku fallback) ──

export async function runExtraction(
  deidentifiedInput: string,
  patientAgeYears: number | null,
  pendingClarification: string | undefined,
  existingCaseSheet: any,
  callExtractionModel: any,
  clinicianProtection?: ProtectedCliniciansResult
): Promise<{ cleaned: ReturnType<typeof cleanExtractionOutput>; updatedFields: Record<string, any> }> {
  let raw: RawExtractionFields;

  try {
    raw = await callExtractionModel({ model: "gpt-4o-mini", temperature: 0.0, deidentifiedInput, patientAgeYears, pendingClarification });
  } catch (err) {
    console.warn("[scribeChatTurn] GPT-4o-mini extraction failed, falling back to Claude 3.5 Haiku", err);
    raw = await callExtractionModel({ model: "claude-3.5-haiku", temperature: 0.0, deidentifiedInput, patientAgeYears, pendingClarification });
  }

  // Defensive guard: Ensure raw.differentials is accepted ONLY from the extraction branch
  // and strictly contains diagnoses explicitly stated by the clinician in deidentifiedInput.
  // Do NOT copy any diagnoses from reasoningMessage, clinical reasoning output, or assistant suggestions.
  if (raw) {
    const candidateDiffs = Array.isArray(raw.differentials)
      ? raw.differentials
      : isValidStr(raw.differentials)
      ? [String(raw.differentials).trim()]
      : [];
    raw.differentials = candidateDiffs.filter(
      (d: any) => isValidStr(d) && isClinicianStatedDifferential(String(d), deidentifiedInput)
    );
  }

  const cleaned = cleanExtractionOutput(raw);
  // VOICE-03: pass the de-identified input text through so field mapping
  // can detect explicit normalcy phrases — the ONLY trigger allowed for
  // normal-exam defaults. Never applied just because a field is empty.
  const updatedFields = mapExtractionToCaseSheetFields(
    cleaned,
    raw,
    existingCaseSheet,
    deidentifiedInput,
    clinicianProtection
  );

  return { cleaned, updatedFields };
}

// ── Stage B: Clinical reasoning (Claude Sonnet ONLY, no fallback) ────

async function runClinicalReasoning(
  deidentifiedInput: string,
  existingCaseSheet: Partial<CaseSheetData> | Record<string, any>,
  chatHistory: any[],
  callClinicalReasoningModel: any
): Promise<{
  summary: string;
  differentials: string[];
  references: { source: string; note: string }[];
  watchFor: string[];
}> {
  // Per Rule 1: Claude 3.5 Sonnet ONLY. No fallback. No Gemini, ever.
  return callClinicalReasoningModel({
    model: "claude-3.5-sonnet",
    deidentifiedInput,
    caseContext: existingCaseSheet,
    chatHistory,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function summarizeUpdatedFields(cleaned: ReturnType<typeof cleanExtractionOutput>): string[] {
  const summary: string[] = [];
  if (cleaned.symptoms.length > 0) summary.push(`Symptoms: ${cleaned.symptoms.join(", ")}`);
  if (cleaned.events.length > 0) summary.push(`Events: ${cleaned.events.length} logged`);
  if (cleaned.drugs.length > 0) summary.push(`Treatments: ${cleaned.drugs.map((d: any) => typeof d === 'string' ? d : d.drugName).join(", ")}`);
  if (cleaned.procedures && cleaned.procedures.length > 0) summary.push(`Procedures: ${cleaned.procedures.join(", ")}`);
  if (cleaned.labs.length > 0) summary.push(`Labs: ${cleaned.labs.map(l => l.name).join(", ")}`);
  if (cleaned.imaging && cleaned.imaging.length > 0) summary.push(`Imaging: ${cleaned.imaging.map(i => i.name).join(", ")}`);
  if (cleaned.plan.length > 0) summary.push(`Plan: ${cleaned.plan.join(", ")}`);
  return summary;
}

function extractAbnormalFlags(cleaned: ReturnType<typeof cleanExtractionOutput>): string[] {
  return cleaned.labs
    .filter(l => l.value !== null && l.value !== undefined)
    .map(l => `${l.name}: ${l.value}`)
    .filter(Boolean);
}


export function isExplicitPrecipitatingEvent(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();
  if (["unknown", "not specified", "not documented", "n/a", "none", "nil", "no", "no event", "no trauma"].includes(t)) {
    return false;
  }
  // Medical symptom duration or generic presentation is NOT an explicit precipitating event
  if (/^(?:fever|cough|cold|vomiting|loose stools?|diarrhoea|diarrhea|illness|febrile|symptoms?)\b/i.test(t)) {
    return false;
  }
  if (/\b(?:acute symptom onset|presented to (?:ed|er|hospital)|evaluation of fever|history of fever)\b/i.test(t)) {
    return false;
  }
  // Must match explicit precipitating trigger
  const hasTrigger = /\b(rta\b|road traffic accident|motor vehicle|accident|fall|fell|trauma|assault|hit\s+by|injury|injuries|fracture|burn|drowning|bite|sting|poison|ingestion|overdose|collapse|syncope|unconscious|electrocution|struck|wound|post-op|surgery)\b/i.test(t);
  return hasTrigger;
}

export function deriveExplicitEvents(raw: any, rawInputText: string): string | null {
  // 1. Explicit events array or string from model
  if (typeof raw.events === 'string' && raw.events.trim()) {
    const ev = raw.events.trim();
    if (isExplicitPrecipitatingEvent(ev)) {
      return ev;
    }
  }
  if (Array.isArray(raw.events) && raw.events.length > 0) {
    const descs = raw.events
      .map((e: any) => typeof e === 'string' ? e.trim() : (e?.description || ""))
      .filter((d: string) => isExplicitPrecipitatingEvent(d));
    if (descs.length > 0) return descs.join("; ");
  }

  // 2. Explicit mechanism from mlcDetails
  if (raw.mlcDetails && typeof raw.mlcDetails.mechanismOfInjury === 'string' && raw.mlcDetails.mechanismOfInjury.trim()) {
    const mech = raw.mlcDetails.mechanismOfInjury.trim();
    if (isExplicitPrecipitatingEvent(mech)) {
      if (/^rta\b/i.test(mech)) {
        return mech.replace(/^rta\b/i, "Road traffic accident involving");
      }
      return mech;
    }
  }

  // 3. Derive strictly from explicit preceding history or dictation text:
  // - explicit trauma/accident description
  // - explicit collapse/fall
  const candidateTexts = [
    raw.hpi,
    raw.presentingComplaint,
    raw.chiefComplaint,
    rawInputText
  ].filter(t => typeof t === 'string' && t.trim().length > 0) as string[];

  for (const text of candidateTexts) {
    // RTA / Traffic accident
    const rtaMatch = text.match(/\b(?:alleged\s+history\s+of\s+)?(rta\b[^\.\n;,]*|road\s+traffic\s+accident[^\.\n;,]*|motor\s+vehicle\s+accident[^\.\n;,]*|two-wheeler\s+vs\s+four-wheeler[^\.\n;,]*|hit\s+by[^\.\n;,]*|bike\s+skid[^\.\n;,]*)/i);
    if (rtaMatch) {
      let matched = rtaMatch[1].trim();
      if (/^rta\s+/i.test(matched)) {
        matched = matched.replace(/^rta\s+/i, "Road traffic accident involving ");
      } else if (/^rta$/i.test(matched)) {
        matched = "Road traffic accident";
      } else if (/^two-wheeler\s+vs/i.test(matched)) {
        matched = "Road traffic accident involving " + matched;
      }
      return matched;
    }

    // Fall / Collapse
    const fallMatch = text.match(/\b(?:alleged\s+history\s+of\s+)?(fall\s+from\s+[^\.\n;,]+|slip\s+and\s+fall[^\.\n;,]*|fall\s+at\s+[^\.\n;,]+|fall\s+in\s+[^\.\n;,]+|sudden\s+collapse[^\.\n;,]*|loss\s+of\s+consciousness[^\.\n;,]*)/i);
    if (fallMatch) {
      return fallMatch[1].trim();
    }

    // Assault / Trauma
    const traumaMatch = text.match(/\b(physical\s+assault[^\.\n;,]*|assaulted\s+by\s+[^\.\n;,]+|blunt\s+trauma[^\.\n;,]*|stab\s+injury[^\.\n;,]*|burn\s+injury[^\.\n;,]*)/i);
    if (traumaMatch) {
      return traumaMatch[1].trim();
    }
  }

  return null;
}

/**
 * Normalizes Primary Survey Exposure findings vs Secondary Survey findings:
 * 1. Re-routes Abdominal findings (e.g. "Abdomen soft and non-tender") to Secondary Survey Abdomen/PA.
 * 2. Re-routes Neurological findings (e.g. "No neck stiffness or focal neurological deficit") to Secondary Survey CNS.
 * 3. Re-routes Hydration / General findings (e.g. "Mild dehydration with dry oral mucosa") to Secondary Survey General.
 * 4. Re-routes Temperature (e.g. "38.8 C") to fields.vitals.temp.
 * 5. Guards against converting history negatives (e.g. "no rash") into an Exposure exam finding.
 * 6. Strips re-routed findings from Exposure, preventing duplicate text between Primary Survey and Secondary Survey.
 */
export function normalizeExposureAndSecondarySurvey(
  raw: any,
  fields: Record<string, any>,
  secSurvey: Record<string, any>,
  rawInputText: string
): { updatedSecSurvey: boolean } {
  let updatedSecSurvey = false;
  let exp = typeof raw.exposure === "string" ? raw.exposure.trim() : "";
  if (!exp) return { updatedSecSurvey: false };

  // 1. Temperature extraction from exposure
  const tempMatch = exp.match(/(?:temp(?:erature)?\s*[:=]?\s*)?(\b\d{2}(?:\.\d)?\s*(?:°?[cC]|°?[fF])\b)/i);
  if (tempMatch) {
    const extractedTemp = tempMatch[1].trim();
    fields.vitals = fields.vitals || {};
    if (!fields.vitals.temp) {
      fields.vitals.temp = extractedTemp;
    }
    exp = exp.replace(tempMatch[0], "").trim();
  }

  // 2. Abdomen extraction from exposure
  const abdRegex = /\b(?:abdomen\s+(?:is\s+)?soft(?:,\s*|\s+and\s+)non-tender|abdomen\s+soft|soft(?:,\s*|\s+and\s+)non-tender\s+abdomen|soft,?\s+non-tender|soft\s+and\s+non-tender|per\s+abdomen\s+[^\.\n;,]+)\b/gi;
  const abdMatch = exp.match(abdRegex);
  if (abdMatch) {
    const extractedAbd = abdMatch[0].trim();
    if (!secSurvey.abdomen) {
      secSurvey.abdomen = /soft/i.test(extractedAbd) ? "Soft, non-tender" : extractedAbd;
      updatedSecSurvey = true;
    }
    exp = exp.replace(abdRegex, "").trim();
  }

  // 3. CNS extraction from exposure
  const cnsRegex = /\b(?:no\s+neck\s+stiffness(?:,\s*|\s+and\s+|\s+or\s+)?(?:no\s+)?focal\s+neurological\s+deficit|no\s+neck\s+stiffness|no\s+focal\s+(?:neurological\s+)?deficit|neck\s+supple|no\s+meningeal\s+signs)\b/gi;
  const cnsMatch = exp.match(cnsRegex);
  if (cnsMatch) {
    const extractedCns = cnsMatch.join(", ").trim();
    if (!secSurvey.cns) {
      secSurvey.cns = extractedCns.includes("stiffness") && extractedCns.includes("deficit")
        ? "No neck stiffness, no focal neurological deficit"
        : extractedCns;
      updatedSecSurvey = true;
    }
    exp = exp.replace(cnsRegex, "").trim();
  }

  // 4. Hydration / General extraction from exposure
  const hydrationRegex = /\b(?:(?:mild|moderate|severe)?\s*dehydration(?:,\s*|\s+with\s+)?(?:slightly\s+)?dry\s+oral\s+mucosa|(?:slightly\s+)?dry\s+oral\s+mucosa|(?:mild|moderate|severe)\s+dehydration|sunken\s+eyes|decreased\s+skin\s+turgor)\b/gi;
  const hydMatch = exp.match(hydrationRegex);
  if (hydMatch) {
    const extractedHyd = hydMatch.join(", ").trim();
    if (!secSurvey.general) {
      secSurvey.general = /mild\s+dehydration/i.test(extractedHyd) && /dry\s+oral\s+mucosa/i.test(extractedHyd)
        ? "Mild dehydration, slightly dry oral mucosa"
        : extractedHyd;
      updatedSecSurvey = true;
    }
    exp = exp.replace(hydrationRegex, "").trim();
  }

  // 5. History negative guard: "no rash"
  // If "no rash" was only stated in the context of history or symptoms in rawInputText,
  // and the clinician did not explicitly dictate skin/exposure exam:
  if (/^no\s+rash(?:es)?[\.\s]*$/i.test(exp)) {
    const isHistoryNegativeOnly = /\b(?:history|fever|symptoms?)[^\.\n;]*no\s+rash\b/i.test(rawInputText) &&
      !/\b(?:skin|exposure|examined|examination)\s+shows?\s+no\s+rash\b/i.test(rawInputText);
    if (isHistoryNegativeOnly) {
      exp = "";
    }
  }

  // Clean residual exposure punctuation and spacing
  exp = exp
    .replace(/^[,\.\s;]+/, "")
    .replace(/[,\.\s;]+$/, "")
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*\./g, ".")
    .trim();

  // If only non-substantive words remain (e.g. "and", "with", "no"), clear it
  if (/^(?:and|with|no|nil|none)[\.\s]*$/i.test(exp)) {
    exp = "";
  }

  raw.exposure = exp.length > 0 ? exp : null;

  return { updatedSecSurvey };
}

/**
 * Defensive guard for clinician-stated differentials:
 * Ensures only diagnoses explicitly stated by the clinician in their input can enter ClinicalCase.
 * Rejects unstated, inferred, suggested, assistant-generated, or clinical reasoning differentials.
 */
export function isClinicianStatedDifferential(candidate: string, rawInputText: string): boolean {
  if (!candidate || typeof candidate !== "string" || !rawInputText || typeof rawInputText !== "string") {
    return false;
  }
  const cleanCand = candidate.trim().toLowerCase();
  const cleanInput = rawInputText.trim().toLowerCase();
  if (!cleanCand || !cleanInput) return false;

  // Direct phrase match
  if (cleanInput.includes(cleanCand)) return true;

  // Words that are purely clinical descriptors, syntax, or qualifiers rather than disease entities
  const stopWords = new Set([
    "with", "from", "that", "this", "have", "been", "were", "what", "when", "where",
    "left", "right", "bilateral", "acute", "chronic", "mild", "severe", "moderate",
    "pain", "type", "rule", "suspect", "possible", "probable", "likely", "diff",
    "differential", "diagnosis", "impression", "versus", "vs", "status", "post", "patient",
    "presents", "presented", "history", "underlying", "secondary", "primary"
  ]);

  // Extract substantive condition/disease tokens (length >= 3)
  const candTokens = cleanCand
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !stopWords.has(t));

  if (candTokens.length > 0) {
    // Check if any substantive disease token is present in the clinician's input
    if (candTokens.some(token => cleanInput.includes(token))) {
      return true;
    }
    // Check if acronym of the candidate appears in the clinician's input (e.g. ACS, DKA, PE, UTI)
    const acronym = candTokens.map(t => t[0]).join("");
    if (acronym.length >= 2 && new RegExp(`\\b${acronym}\\b`, "i").test(cleanInput)) {
      return true;
    }
  }

  return false;
}

export function mapExtractionToCaseSheetFields(
  cleaned: ReturnType<typeof cleanExtractionOutput>,
  raw: any,
  existingCaseSheet: any,
  rawInputText: string,
  clinicianProtection?: ProtectedCliniciansResult
): Record<string, any> {
  const fields: Record<string, any> = {};
  const isValidStr = (s: any) => typeof s === 'string' && s.trim().length > 0 && !["unknown", "not specified", "not documented", "n/a", "none"].includes(s.trim().toLowerCase());

  if (isValidStr(raw.patientName)) fields.patientName = raw.patientName;
  if (raw.age !== undefined && raw.age !== null && raw.age !== "") fields.age = raw.age;
  
  if (isValidStr(raw.sex)) fields.gender = raw.sex;
  else if (isValidStr(raw.gender)) fields.gender = raw.gender;

  if (isValidStr(raw.chiefComplaint)) fields.presentingComplaint = raw.chiefComplaint;
  else if (isValidStr(raw.presentingComplaint)) fields.presentingComplaint = raw.presentingComplaint;

  // ══════════════════════════════════════════════════════════════
  // VOICE-02/FAB-18 FIX: vitals are ONLY ever the real dictated value.
  // The previous "no vitals dictated but other clinical content was
  // present → inject baseline normal vitals" fallback has been removed
  // entirely. There is no scenario in which this function invents a
  // number for HR/BP/SpO2/RR/Temp/GRBS/GCS.
  // ══════════════════════════════════════════════════════════════
  if (raw.vitals && typeof raw.vitals === 'object') {
    const filteredVitals: any = {};
    let hasRealVitals = false;
    for (const [k, v] of Object.entries(raw.vitals)) {
      if (v !== null && v !== undefined && v !== "" && String(v).toLowerCase() !== "unknown" && String(v).toLowerCase() !== "n/a") {
        filteredVitals[k] = v;
        hasRealVitals = true;
      }
    }
    if (hasRealVitals) {
      fields.vitals = filteredVitals;
    }
    // No else branch. Missing vitals stay missing — the case sheet UI
    // is responsible for rendering "Not documented", never this function.
  }

  // ══════════════════════════════════════════════════════════════
  // VOICE-04 FIX (corrected): CaseSheetData has no generic `vbg` key —
  // the real field is `vbgAbg: { type, values: [{name, param, value}] }`
  // per caseSheetTypes.ts. `param` must be a ClinicalParam; po2/be are
  // not currently supported by that enum (clinicalRanges.ts) and are
  // intentionally dropped here rather than fabricating a param key —
  // extending ClinicalParam is a separate product decision.
  // ══════════════════════════════════════════════════════════════
  if (raw.vbg && typeof raw.vbg === 'object') {
      // CHLORIDE FIX (Sept 2026): "cl" was missing from this map entirely.
    // The extraction schema (extraction.ts / voiceExtraction.ts) has
    // correctly asked for and received chloride from the model since
    // this session's earlier fix, but this mapping step — which writes
    // the model's output into the actual case sheet field — was never
    // updated, so a dictated chloride value was silently dropped here
    // even though it was successfully extracted upstream.
    const VBG_PARAM_MAP: Record<string, string> = {
      ph: "pH", pco2: "pCO2", hco3: "HCO3", lactate: "Lactate", na: "Na", k: "K", cl: "Cl", po2: "PO2", hb: "Hb", be: "Base Excess", anionGap: "Anion Gap"
    };
        const values: { name: string; param: string; value: number | string | null }[] = [];
    for (const [key, name] of Object.entries(VBG_PARAM_MAP)) {
      const v = raw.vbg[key];
      if (v !== null && v !== undefined && v !== "" && String(v).toLowerCase() !== "unknown") {
        if (key === "anionGap") {
          values.push({ name, param: key, value: String(v) });
        } else {
          const num = parseFloat(String(v));
          if (!isNaN(num)) {
            values.push({ name, param: key, value: num });
          } else {
            values.push({ name, param: key, value: String(v) });
          }
        }
      }
    }
    if (values.length > 0) {
      fields.vbgAbg = {
        type: raw.vbg.type === "ABG" || raw.vbg.type === "VBG" ? raw.vbg.type : null,
        values,
      };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // VOICE-04 & LEAKAGE GUARD: differentials are accepted ONLY from
  // the extraction branch, and only when explicitly stated by the clinician.
  // Never copy any diagnoses from reasoningMessage, clinical reasoning output,
  // assistant suggestions, or previous assistant-generated differentials.
  // ══════════════════════════════════════════════════════════════
  const rawDiffs = Array.isArray(raw.differentials)
    ? raw.differentials
    : isValidStr(raw.differentials)
    ? [String(raw.differentials).trim()]
    : [];

  const verifiedDiffs = rawDiffs.filter(
    (d: any) => isValidStr(d) && isClinicianStatedDifferential(String(d), rawInputText)
  );

  if (verifiedDiffs.length > 0) {
    fields.differentialDiagnosis = verifiedDiffs.join("; ");
  }
  // ══════════════════════════════════════════════════════════════
  // CHECKLIST-WIRING FIX ROUND 2: these fields are correctly extracted
  // by the model (see extraction.ts schema) but were never read into
  // the case sheet mapping — same silent-drop pattern as VOICE-04/06.
  // Real-value-only, no defaults, per the standing isValidStr() rule.
  // ══════════════════════════════════════════════════════════════
  if (isValidStr(raw.hpi)) fields.hpi = raw.hpi;
  if (isValidStr(raw.surgicalHistory)) fields.surgicalHistory = raw.surgicalHistory;
  if (isValidStr(raw.familyHistory)) fields.familyHistory = raw.familyHistory;
  if (isValidStr(raw.lmp)) fields.lmp = raw.lmp;

  // Last Meal: map to sampleHistory.lastMeal and fields.lastMeal. If not stated / empty: leave blank. Do not infer.
  if (isValidStr(raw.lastMeal)) {
    fields.lastMeal = raw.lastMeal;
  } else if (isValidStr(cleaned.lastMeal)) {
    fields.lastMeal = cleaned.lastMeal;
  }
  if (fields.lastMeal) {
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      lastMeal: fields.lastMeal
    };
  }

  if (isValidStr(raw.psychologicalAssessment)) fields.psychologicalAssessment = raw.psychologicalAssessment;
  if (isValidStr(raw.ecg)) fields.ecg = raw.ecg;
  if (isValidStr(raw.echo)) fields.echo = raw.echo;
  if (isValidStr(raw.diagnosis)) fields.diagnosis = raw.diagnosis; // closes VOICE-06
  if (isValidStr(raw.disposition)) fields.disposition = raw.disposition;
  if (Array.isArray(raw.consultations) && raw.consultations.length > 0) fields.consultations = raw.consultations.filter(isValidStr);

  if (Array.isArray(raw.investigationsOrdered) && raw.investigationsOrdered.length > 0) {
    fields.investigationsOrdered = raw.investigationsOrdered.filter((i: any) => isValidStr(i));
  }
  if (raw.investigationResults && typeof raw.investigationResults === "object" && Object.keys(raw.investigationResults).length > 0) {
    fields.investigationResults = raw.investigationResults;
  }

  // ══════════════════════════════════════════════════════════════
  // CLINICIAN ATTRIBUTION & DEFENSIVE PLACEHOLDER GUARD
  // Restore explicitly role-attributed internal clinician names
  // (EM Resident / EM Consultant) while blocking redacted placeholders
  // like [DOCTOR], [NAME], [PERSON] from ever overwriting attribution.
  // ══════════════════════════════════════════════════════════════

  // Resolve candidate EM Resident
  let candidateResident: string | null = null;
  if (typeof raw.emResident === "string" && raw.emResident.trim().length > 0) {
    let resolved = raw.emResident.trim();
    if (clinicianProtection?.placeholders) {
      for (const [ph, name] of Object.entries(clinicianProtection.placeholders)) {
        if (resolved.includes(ph)) {
          resolved = resolved.replace(ph, name);
        }
      }
    }
    candidateResident = resolved;
  }
  if ((!candidateResident || isRedactedOrPlaceholderClinician(candidateResident)) && clinicianProtection?.clinicians?.emResident) {
    candidateResident = clinicianProtection.clinicians.emResident;
  }
  if ((!candidateResident || isRedactedOrPlaceholderClinician(candidateResident)) && !clinicianProtection) {
    const inlineProtection = protectInternalClinicians(rawInputText);
    if (inlineProtection.clinicians.emResident) {
      candidateResident = inlineProtection.clinicians.emResident;
    }
  }
  if (candidateResident && !isRedactedOrPlaceholderClinician(candidateResident)) {
    fields.emResident = candidateResident;
  }

  // Resolve candidate EM Consultant
  let candidateConsultant: string | null = null;
  if (typeof raw.emConsultant === "string" && raw.emConsultant.trim().length > 0) {
    let resolved = raw.emConsultant.trim();
    if (clinicianProtection?.placeholders) {
      for (const [ph, name] of Object.entries(clinicianProtection.placeholders)) {
        if (resolved.includes(ph)) {
          resolved = resolved.replace(ph, name);
        }
      }
    }
    candidateConsultant = resolved;
  }
  if ((!candidateConsultant || isRedactedOrPlaceholderClinician(candidateConsultant)) && clinicianProtection?.clinicians?.emConsultant) {
    candidateConsultant = clinicianProtection.clinicians.emConsultant;
  }
  if ((!candidateConsultant || isRedactedOrPlaceholderClinician(candidateConsultant)) && !clinicianProtection) {
    const inlineProtection = protectInternalClinicians(rawInputText);
    if (inlineProtection.clinicians.emConsultant) {
      candidateConsultant = inlineProtection.clinicians.emConsultant;
    }
  }
  if (candidateConsultant && !isRedactedOrPlaceholderClinician(candidateConsultant)) {
    fields.emConsultant = candidateConsultant;
  }
  // ══════════════════════════════════════════════════════════════
  // CHECKLIST-WIRING FIX: fastFindings had no mapping — extracted by
  // the model (voiceExtraction.ts) but silently dropped here, same
  // pattern as the original VBG/differentials gap (VOICE-04). Real
  // values only, per-organ — never fabricate a "negative" FAST.
  // ══════════════════════════════════════════════════════════════
  if (raw.fastFindings && typeof raw.fastFindings === 'object') {
    const fast: Record<string, string> = {};
    for (const organ of ['heart', 'abdomen', 'pelvis']) {
      if (isValidStr(raw.fastFindings[organ])) fast[organ] = raw.fastFindings[organ];
    }
    if (Object.keys(fast).length > 0) fields.fastFindings = fast;
  }

  // ══════════════════════════════════════════════════════════════
  // CHECKLIST-WIRING FIX: mlcDetails had no mapping — same gap.
  // isMlc is a real boolean from the model (true/false), always
  // applied when present. The text sub-fields are real-value-only;
  // identificationMark in particular must NEVER receive a default —
  // this is the exact field that was contaminated by the docx
  // template's "Black mole over" example text in the past.
  // ══════════════════════════════════════════════════════════════
  if (raw.mlcDetails && typeof raw.mlcDetails === 'object') {
    const mlc: Record<string, any> = {};
    if (typeof raw.mlcDetails.isMlc === 'boolean') mlc.isMlc = raw.mlcDetails.isMlc;
    if (typeof raw.mlcDetails.possibleMlc === 'boolean') mlc.possibleMlc = raw.mlcDetails.possibleMlc;
    for (const key of ['natureOfIncident', 'placeOfIncident', 'dateTimeOfIncident', 'mechanismOfInjury', 'broughtBy', 'informant', 'identificationMark']) {
      if (isValidStr(raw.mlcDetails[key])) mlc[key] = raw.mlcDetails[key];
    }
    if (Object.keys(mlc).length > 0) fields.mlcDetails = mlc;
  }

  // Treatments
  if (cleaned.drugs && cleaned.drugs.length > 0) {
    const validTreatments: any[] = [];
    for (const d of cleaned.drugs) {
      const drugStr = typeof d === "string" ? d : (d.drugName || d.name || "");
      const isFluidConcept = /\b(?:oral\s+or\s+iv\s+)?fluids?(?:\s+were\s+given)?(?:\s+depending\s+on\s+tolerance)?\b/i.test(drugStr) ||
        /\b(?:hydration|fluids?)\s+(?:as|depending|tolerated)\b/i.test(drugStr);

      if (isFluidConcept && !/\b(?:normal\s+saline|0\.9%|ringer|rl\b|ns\b|d5|isolyte)\b/i.test(drugStr)) {
        // Hydration statement: preserve in treatmentNotes and managementPlan, do NOT create an incorrect medication object
        const hydrationStmt = "Oral or IV fluids depending on tolerance";
        if (!fields.treatmentNotes) {
          fields.treatmentNotes = hydrationStmt;
        } else if (!fields.treatmentNotes.includes("fluids")) {
          fields.treatmentNotes = `${fields.treatmentNotes}; ${hydrationStmt}`;
        }
        if (!fields.managementPlan) {
          fields.managementPlan = hydrationStmt;
        } else if (!fields.managementPlan.includes("fluids")) {
          fields.managementPlan = `${fields.managementPlan}; ${hydrationStmt}`;
        }
        continue;
      }

      // Antipyretic concept
      if (/\bantipyretic\b/i.test(drugStr)) {
        const specificDrugMatch = rawInputText.match(/\b(paracetamol|pcm|calpol|dolo|crocin|acetaminophen|ibuprofen|brufen|combiflam)\b/i);
        if (specificDrugMatch) {
          validTreatments.push(typeof d === "object" ? d : {
            drugName: specificDrugMatch[0],
            dose: typeof d === "object" ? d.dose : "",
            route: typeof d === "object" ? d.route : "",
            instruction: typeof d === "object" ? d.instruction : "",
            timeGiven: typeof d === "object" ? d.timeGiven : ""
          });
        } else {
          // Generic antipyretic MUST remain generic. DO NOT invent Paracetamol, Ibuprofen, dose, route, fever threshold, or SOS frequency.
          validTreatments.push({
            drugName: "Weight-appropriate antipyretic",
            dose: "",
            route: "",
            instruction: "",
            timeGiven: ""
          });
        }
        continue;
      }

      validTreatments.push(d);
    }
    if (validTreatments.length > 0) {
      fields.treatmentGiven = validTreatments;
    }
  }

  // Procedures
  if (cleaned.procedures && cleaned.procedures.length > 0) {
    fields.procedures = cleaned.procedures;
    fields.otherProcedures = cleaned.procedures.join(", ");
    const procChecks: string[] = [];
    for (const p of cleaned.procedures) {
      const plower = p.toLowerCase();
      if (plower.includes("catheter") || plower.includes("foley")) procChecks.push("foleys");
      if (plower.includes("ng tube") || plower.includes("ryle")) procChecks.push("ng_tube");
      if (plower.includes("lavage")) procChecks.push("gastric_lavage");
      if (plower.includes("sutur") || plower.includes("stitch")) procChecks.push("suturing");
      if (plower.includes("irrigat")) procChecks.push("irrigation");
      if (plower.includes("splint")) procChecks.push("splinting");
      if (plower.includes("reduct")) procChecks.push("reduction");
    }
    if (procChecks.length > 0) fields.proceduresChecked = procChecks;
  }

  // Events: wire Events derivation into active Scribe mapping (derive from explicit history only)
  const derivedEvent = deriveExplicitEvents(raw, rawInputText);
  if (derivedEvent && isExplicitPrecipitatingEvent(derivedEvent)) {
    fields.events = derivedEvent;
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      events: derivedEvent
    };
  } else if (cleaned.events && cleaned.events.length > 0) {
    const validEvents = cleaned.events
      .map(e => e.description)
      .filter(desc => isExplicitPrecipitatingEvent(desc));
    if (validEvents.length > 0) {
      const evText = validEvents.join("; ");
      fields.events = evText;
      fields.sampleHistory = {
        ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
        events: evText
      };
    }
  }

  if (cleaned.symptoms && cleaned.symptoms.length > 0) {
    fields.symptoms = cleaned.symptoms;
  }
  if (cleaned.plan && cleaned.plan.length > 0) {
    fields.plan = cleaned.plan;
    fields.managementPlan = cleaned.plan.join("; ");
    fields.dispositionAndPlan = {
      ...(existingCaseSheet?.dispositionAndPlan || {}),
      consultsRequested: fields.consultations || existingCaseSheet?.dispositionAndPlan?.consultsRequested || [],
      managementPlan: fields.managementPlan
    };
  }
  
  // Investigations — strictly enforce no-invention rule
  // If the dictation contains only generic phrases like "Appropriate investigations were planned based on clinical assessment and duration of fever",
  // no actual test was named, so do NOT create CBC, CRP, urine routine, culture, X-ray, or any other test.
  const isGeneric = (name: string) => isGenericInvestigationPhrase(name);

  if (cleaned.labs && cleaned.labs.length > 0) {
    const validLabs = cleaned.labs.filter(l => !isGeneric(l.name));
    if (validLabs.length > 0) {
      fields.labs = validLabs;
      fields.investigationLabsOrdered = validLabs.map(l => l.value ? `${l.name}: ${l.value}` : l.name).join(", ");
    } else {
      fields.labs = [];
      fields.investigationLabsOrdered = "";
    }
  } else {
    fields.labs = [];
    fields.investigationLabsOrdered = "";
  }
  fields.investigations = (fields.labs || []).map((l: any, i: number) => ({
    id: `inv-${Date.now()}-${i}`,
    testName: l.name,
    result: l.value || "Ordered",
    isAbnormal: false
  }));

  if (cleaned.imaging && cleaned.imaging.length > 0) {
    const validImg = cleaned.imaging.filter(i => !isGeneric(i.name));
    if (validImg.length > 0) {
      fields.imaging = validImg;
      fields.investigationImaging = validImg.map(i => i.value ? `${i.name}: ${i.value}` : i.name).join(", ");
    } else {
      fields.imaging = [];
      fields.investigationImaging = "";
    }
  } else {
    fields.imaging = [];
    fields.investigationImaging = "";
  }

  if (raw.isPediatric !== undefined && raw.isPediatric !== null) fields.isPediatric = raw.isPediatric;
  if (raw.pediatricDetails && Object.keys(raw.pediatricDetails).length > 0) {
    const filteredPed: any = {};
    for (const [k, v] of Object.entries(raw.pediatricDetails)) { 
      if (isValidStr(v) || typeof v === 'boolean') {
        filteredPed[k] = v;
        // Also map to UI aliases
        if (k === 'breathingWob') {
          filteredPed['patWorkOfBreathing'] = v;
        }
        if (k === 'circulationCrt' || k === 'circulationSkinColorTemp') {
          filteredPed['patCirculation'] = [filteredPed['patCirculation'], v].filter(Boolean).join(", ");
        }
      }
    }
    if (Object.keys(filteredPed).length > 0) {
      fields.pediatricDetails = { ...(fields.pediatricDetails || {}), ...filteredPed };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // VOICE-03/FAB-19 FIX: ABCDE and secondary-survey normal-exam text
  // is applied ONLY when the doctor explicitly said an ABCDE or
  // systemic-exam normalcy phrase in THIS turn's dictation
  // (detectNormalcyPhrases, shared with extraction.ts). The previous
  // "hasSubstance" gate — which fired on the mere presence of ANY
  // unrelated clinical content — has been removed entirely.
  // ══════════════════════════════════════════════════════════════
  const { abcdeNormal, systemicNormal } = detectNormalcyPhrases(rawInputText);

  // ABCDE
  if (isValidStr(raw.airway)) fields.airway = raw.airway;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.airway) && !isValidStr(existingCaseSheet?.primaryAirway)) fields.airway = EXAM_DEFAULTS.airway;

  if (isValidStr(raw.breathing)) fields.breathing = raw.breathing;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.breathing) && !isValidStr(existingCaseSheet?.primaryBreathing)) fields.breathing = EXAM_DEFAULTS.respiratoryExamination;

  if (isValidStr(raw.circulation)) fields.circulation = raw.circulation;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.circulation) && !isValidStr(existingCaseSheet?.primaryCirculation)) fields.circulation = EXAM_DEFAULTS.cvsExamination;

  // Note: GCS is NEVER embedded here, even under abcdeNormal — it is a
  // vitals-equivalent number and must remain real-dictated-or-blank. Only
  // qualitative pupil/motor descriptive text is gated by the normalcy phrase.
  if (isValidStr(raw.disability)) fields.disability = raw.disability;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.disability) && !isValidStr(existingCaseSheet?.primaryDisability)) fields.disability = `Pupils equal & reactive. ${EXAM_DEFAULTS.cnsExamination}`;

  // Secondary Survey / General Exam initialization
  const secSurvey = { ...(existingCaseSheet?.secondarySurvey || {}) };
  let updatedSecSurvey = false;

  // Semantic separation: ensure abdominal, neurological, hydration, and temperature findings
  // bundled in exposure are cleanly re-routed to Secondary Survey and Vitals, and stripped from Exposure.
  const normExp = normalizeExposureAndSecondarySurvey(raw, fields, secSurvey, rawInputText);
  if (normExp.updatedSecSurvey) updatedSecSurvey = true;

  if (isValidStr(raw.cSpineExam) && isValidStr(raw.exposure)) {
    const cSpineFrag = raw.cSpineExam;
    const isGeneric = !/(c-spine|c spine|cervical|neck)/i.test(cSpineFrag);

    let e = raw.exposure;
    if (isGeneric) {
      const expCSpineRegex = /(c-spine|c spine|cervical spine|cervical midline|neck)\s*([a-z]+)?/gi;
      let m;
      let foundMatch = false;
      while ((m = expCSpineRegex.exec(e)) !== null) {
        if (m[0].toLowerCase().includes(cSpineFrag.toLowerCase())) {
          e = e.replace(m[0], "");
          foundMatch = true;
        }
      }
      if (foundMatch) {
        e = e.replace(/,\s*,/g, ",").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
        raw.exposure = e.length > 0 ? e : null;
      }
    } else {
      if (e.includes(cSpineFrag)) {
        e = e.replace(cSpineFrag, "");
        e = e.replace(/,\s*,/g, ",").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
        raw.exposure = e.length > 0 ? e : null;
      } else {
        const cSpineLower = cSpineFrag.toLowerCase().replace(/\.$/, "");
        if (e.toLowerCase().includes(cSpineLower)) {
          const regex = new RegExp(cSpineLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
          e = e.replace(regex, "");
          e = e.replace(/,\s*,/g, ",").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
          raw.exposure = e.length > 0 ? e : null;
        }
      }
    }
  }

  if (isValidStr(raw.exposure)) fields.exposure = raw.exposure;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.exposure) && !isValidStr(existingCaseSheet?.primaryExposure)) fields.exposure = "No obvious external injuries, rash, or deformities. Normothermic.";

  // ══════════════════════════════════════════════════════════════
  // CHECKLIST-WIRING FIX: extremitiesExamination had no mapping at
  // all — the schema field added in voiceExtraction.ts had nowhere
  // to land. Real dictated value only. Deliberately NO normal-default
  // fallback here (unlike CVS/resp/abdomen/CNS) — extremities is
  // frequently the ONE named exception inside an otherwise-normal
  // secondary survey ("everything normal except extremities"), so
  // auto-filling it with boilerplate text would risk overwriting
  // exactly the finding the doctor was calling out as abnormal.
  // ══════════════════════════════════════════════════════════════
  if (isValidStr(raw.extremitiesExamination)) {
    secSurvey.extremities = raw.extremitiesExamination;
    updatedSecSurvey = true;
  }

  if (isValidStr(raw.generalExamination)) { secSurvey.general = raw.generalExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(existingCaseSheet?.generalExamination) && !isValidStr(secSurvey.general)) { secSurvey.general = EXAM_DEFAULTS.generalExamination; updatedSecSurvey = true; }

  if (isValidStr(raw.cvsExamination)) { secSurvey.cvs = raw.cvsExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.cvs)) { secSurvey.cvs = EXAM_DEFAULTS.cvsExamination; updatedSecSurvey = true; }

  const respVal = isValidStr(raw.respiratoryExamination) ? raw.respiratoryExamination
    : isValidStr(raw.rsExamination) ? raw.rsExamination
    : isValidStr(raw.rs) ? raw.rs
    : isValidStr(raw.respiratory) ? raw.respiratory
    : null;
  if (respVal) { secSurvey.respiratory = respVal; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.respiratory)) { secSurvey.respiratory = EXAM_DEFAULTS.respiratoryExamination; updatedSecSurvey = true; }

  const abdVal = isValidStr(raw.abdomenExamination) ? raw.abdomenExamination
    : isValidStr(raw.paExamination) ? raw.paExamination
    : isValidStr(raw.pa) ? raw.pa
    : isValidStr(raw.abdomen) ? raw.abdomen
    : null;
  if (abdVal) { secSurvey.abdomen = abdVal; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.abdomen)) { secSurvey.abdomen = EXAM_DEFAULTS.abdomenExamination; updatedSecSurvey = true; }

  if (isValidStr(raw.cnsExamination)) { secSurvey.cns = raw.cnsExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.cns)) { secSurvey.cns = EXAM_DEFAULTS.cnsExamination; updatedSecSurvey = true; }

  if (isValidStr(raw.cSpineExam)) { secSurvey.cSpineExam = raw.cSpineExam; updatedSecSurvey = true; }

  if (updatedSecSurvey) fields.secondarySurvey = secSurvey;

  // ══════════════════════════════════════════════════════════════
  // VOICE-03/FAB-20 FIX: Allergies never silently default to "NKDA"
  // here (that remains an intentional, logged exception ONLY inside
  // DischargeSummaryView.tsx — see FAB-12). Past medical history and
  // current medications use the SAME explicit-denial-only logic as
  // extraction.ts's processSampleMedicationsAndPmh, so behavior is
  // identical across both extraction pipelines.
  // ══════════════════════════════════════════════════════════════
  if (isValidStr(raw.allergies)) {
    fields.allergies = raw.allergies;
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      allergies: raw.allergies
    };
  }

  const medPmh = processSampleMedicationsAndPmh(
    raw.pmh ?? raw.pastMedicalHistory ?? null,
    raw.outpatientMedications ?? null,
    null,
    rawInputText
  );

  if (isValidStr(raw.pmh)) fields.pastMedicalHistory = raw.pmh;
  else if (isValidStr(raw.pastMedicalHistory)) fields.pastMedicalHistory = raw.pastMedicalHistory;
  else if (medPmh.pastHistory === "No past medical history") {
    // Doctor explicitly denied a history this turn even though no
    // structured pmh field was populated by the extraction model.
    fields.pastMedicalHistory = medPmh.pastHistory;
  }
  // Otherwise: not mentioned, not denied — leave untouched, no fabrication.

  // SAMPLE Medications (outpatient regular medications)
  // - string[] → join with ", "
  // - string → preserve as-is
  // - null / undefined → ""
  // Populate sampleHistory.medications & fields.currentMedications. Do NOT route into acute ER treatments.
  let mappedMeds = "";
  const rawMeds = raw.outpatientMedications ?? raw.currentMedications ?? (raw.sampleHistory && raw.sampleHistory.medications);
  if (Array.isArray(rawMeds)) {
    mappedMeds = rawMeds.map((m: any) => typeof m === 'string' ? m.trim() : (m?.drugName || m?.name || "")).filter(Boolean).join(", ");
  } else if (typeof rawMeds === 'string') {
    mappedMeds = rawMeds.trim();
  }

  if (mappedMeds && !["unknown", "not specified", "not documented", "n/a", "none"].includes(mappedMeds.toLowerCase())) {
    fields.currentMedications = mappedMeds.includes(",") ? mappedMeds.split(",").map(m => m.trim()) : [mappedMeds];
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      medications: mappedMeds
    };
  } else if (medPmh.medications === "Nil regular medications") {
    fields.currentMedications = [];
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      medications: "Nil regular medications"
    };
  }
  // Otherwise: leave untouched. Empty currentMedications no longer
  // gets silently populated just because other content was dictated.

  // Ensure clinician names are never restored into free clinical narrative:
  // sanitize any residual internal placeholders in narrative strings or string arrays to [DOCTOR].
  for (const [key, val] of Object.entries(fields)) {
    if (key === "emResident" || key === "emConsultant") continue;
    if (typeof val === "string") {
      fields[key] = val.replace(/__ERMATE_EM_(?:RESIDENT|CONSULTANT)_\d+__/g, "[DOCTOR]");
    } else if (Array.isArray(val)) {
      fields[key] = val.map((item: any) =>
        typeof item === "string"
          ? item.replace(/__ERMATE_EM_(?:RESIDENT|CONSULTANT)_\d+__/g, "[DOCTOR]")
          : item
      );
    }
  }

  return fields;
}
function buildUnifiedReplyProse(
  extMsg: ScribeChatMessage,
  reasonMsg: ScribeChatMessage
): string {
  let text = "";

  // Extracted details are rendered natively by the UI card, so we don't duplicate them in the markdown prose.

  if (extMsg.type === "extraction-confirmation") {
    text += "Case details extracted for review.\n\n";
  }
  
  if (reasonMsg.type === "clinical-reasoning") {
    text += `${reasonMsg.content}\n\n`;
  } else if (reasonMsg.type === "error") {
    text += `\n*Note: ${reasonMsg.content}*`;
  }
  
  if (extMsg && extMsg.type === "error") {
    text += `\n\n*Note: ${extMsg.content}*`;
  }

  return text.trim();
}