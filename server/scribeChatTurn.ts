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

import { deidentifyText } from "./deidentify";
import { cleanExtractionOutput, type RawExtractionFields } from "./extractionCleanup";
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

  // PHI de-identification runs ONCE, output shared by both calls (Rule 4)
  const phiResult = deidentifyText(userInput);
  const deidentifiedInput = phiResult.deidentified;

  // Intent Detection: Is this a Discharge Summary request?
  const isDischargeReq = /(prepare|write|create|generate|draft|make|give|provide).*(discharge summary|discharge note|ds)|(discharge summary|discharge note)/i.test(userInput);

  if (isDischargeReq) {
    try {
      const draftResult = await generateDischargeSummary(existingCaseSheet as any);
      
      const dischargeMessage: ScribeChatMessage = {
        id: "ds-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "clinical-reasoning",
        content: "I have prepared a draft of the discharge summary based on the current case sheet. You can review it and copy it to the Discharge Summary tab.",
      };

      const rawSummary = draftResult.summary as Record<string, any> || {};
      let draftText = "";
      if (rawSummary.hospitalCourse) draftText += `**Hospital Course:**\n${rawSummary.hospitalCourse}\n\n`;
      if (rawSummary.dischargeAdvice) draftText += `**Discharge Advice:**\n${rawSummary.dischargeAdvice}\n\n`;
      if (rawSummary.followUpPlan) draftText += `**Follow-up Plan:**\n${rawSummary.followUpPlan}\n\n`;
      if (rawSummary.medicationsOnDischarge) draftText += `**Medications on Discharge:**\n${rawSummary.medicationsOnDischarge}`;
      
      return {
        extractionMessage: dischargeMessage,
        reasoningMessage: dischargeMessage,
        dischargeDraft: draftText.trim() || JSON.stringify(rawSummary),
        reply: dischargeMessage.content,
      };
    } catch (err: any) {
      console.error("[scribeChatTurn] Failed to generate discharge summary", err);
      const errMsg: ScribeChatMessage = {
        id: "ds-err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "I couldn't generate the discharge summary at this time. Please try again.",
      };
      return {
        extractionMessage: errMsg,
        reasoningMessage: errMsg,
        reply: errMsg.content,
      };
    }
  }

  // Run extraction and clinical reasoning IN PARALLEL — independent
  // failures, independent models, independent fallback chains.
  const [extractionResult, reasoningResult] = await Promise.allSettled([
    runExtraction(deidentifiedInput, patientAgeYears, existingCaseSheet, helpers.callExtractionModel),
    runClinicalReasoning(deidentifiedInput, existingCaseSheet, chatHistory, helpers.callClinicalReasoningModel),
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
        content: "Saved to Case Sheet.",
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
        (existingCaseSheet as any)?.age ??
        (existingCaseSheet as any)?.patient?.age;
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

// ── Stage A: Extraction (GPT-4o-mini primary / Claude Haiku fallback) ──

async function runExtraction(
  deidentifiedInput: string,
  patientAgeYears: number | null,
  existingCaseSheet: any,
  callExtractionModel: any
): Promise<{ cleaned: ReturnType<typeof cleanExtractionOutput>; updatedFields: Record<string, any> }> {
  let raw: RawExtractionFields;

  try {
    raw = await callExtractionModel({ model: "gpt-4o-mini", temperature: 0.0, deidentifiedInput, patientAgeYears });
  } catch (err) {
    console.warn("[scribeChatTurn] GPT-4o-mini extraction failed, falling back to Claude 3.5 Haiku", err);
    raw = await callExtractionModel({ model: "claude-3.5-haiku", temperature: 0.0, deidentifiedInput, patientAgeYears });
  }

  const cleaned = cleanExtractionOutput(raw);
  // VOICE-03: pass the de-identified input text through so field mapping
  // can detect explicit normalcy phrases — the ONLY trigger allowed for
  // normal-exam defaults. Never applied just because a field is empty.
  const updatedFields = mapExtractionToCaseSheetFields(cleaned, raw, existingCaseSheet, deidentifiedInput);

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
  if (cleaned.signsSymptoms.length > 0) summary.push(`Symptoms: ${cleaned.signsSymptoms.join(", ")}`);
  if (cleaned.events.length > 0) summary.push(`Events: ${cleaned.events.length} logged`);
  if (cleaned.drugs.length > 0) summary.push(`Drugs: ${cleaned.drugs.join(", ")}`);
  if (cleaned.plan.length > 0) summary.push(`Plan: ${cleaned.plan.join(", ")}`);
  if (cleaned.labs.length > 0) summary.push(`Labs: ${cleaned.labs.map(l => l.name).join(", ")}`);
  return summary;
}

function extractAbnormalFlags(cleaned: ReturnType<typeof cleanExtractionOutput>): string[] {
  return cleaned.labs
    .filter(l => l.value !== null && l.value !== undefined)
    .map(l => `${l.name}: ${l.value}`)
    .filter(Boolean);
}


function mapExtractionToCaseSheetFields(
  cleaned: ReturnType<typeof cleanExtractionOutput>,
  raw: any,
  existingCaseSheet: any,
  rawInputText: string
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
      ph: "ph", pco2: "pco2", hco3: "hco3", lactate: "lactate", na: "na", k: "k", cl: "cl",
    };
    const values: { name: string; param: string; value: number | null }[] = [];
    for (const [key, mappedParam] of Object.entries(VBG_PARAM_MAP)) {
      const v = raw.vbg[key];
      if (v !== null && v !== undefined && v !== "" && String(v).toLowerCase() !== "unknown") {
        const num = parseFloat(String(v));
        if (!isNaN(num)) {
          values.push({ name: key.toUpperCase(), param: mappedParam, value: num });
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
  // VOICE-04 FIX: same silent drop for differentials — the model
  // returns raw.differentials per the extraction schema, but it was
  // never read into the case sheet mapping at all.
  // ══════════════════════════════════════════════════════════════
  if (Array.isArray(raw.differentials) && raw.differentials.length > 0) {
    const cleanedDiffs = raw.differentials.filter((d: any) => isValidStr(d));
    if (cleanedDiffs.length > 0) fields.differentialDiagnosis = cleanedDiffs.join("; ");
  } else if (isValidStr(raw.differentials)) {
    fields.differentialDiagnosis = raw.differentials;
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
  if (isValidStr(raw.psychologicalAssessment)) fields.psychologicalAssessment = raw.psychologicalAssessment;
  if (isValidStr(raw.ecg)) fields.ecg = raw.ecg;
  if (isValidStr(raw.echo)) fields.echo = raw.echo;
  if (isValidStr(raw.diagnosis)) fields.diagnosis = raw.diagnosis; // closes VOICE-06
  if (isValidStr(raw.disposition)) fields.disposition = raw.disposition;

  if (Array.isArray(raw.investigationsOrdered) && raw.investigationsOrdered.length > 0) {
    fields.investigationsOrdered = raw.investigationsOrdered.filter((i: any) => isValidStr(i));
  }
  if (raw.investigationResults && typeof raw.investigationResults === "object" && Object.keys(raw.investigationResults).length > 0) {
    fields.investigationResults = raw.investigationResults;
  }

  // EM Resident / EM Consultant: dictation is an explicit OVERRIDE only.
  // The default-to-logged-in-doctor behavior lives on the frontend
  // (VoiceScribeChatView.tsx), not here — this function has no access
  // to the logged-in profile. If the doctor dictates a name (e.g.
  // naming the supervising consultant, or correcting the resident of
  // record), that always wins over the default.
  if (isValidStr(raw.emResident)) fields.emResident = raw.emResident;
  if (isValidStr(raw.emConsultant)) fields.emConsultant = raw.emConsultant;
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
    for (const key of ['natureOfIncident', 'placeOfIncident', 'dateTimeOfIncident', 'mechanismOfInjury', 'broughtBy', 'informant', 'identificationMark']) {
      if (isValidStr(raw.mlcDetails[key])) mlc[key] = raw.mlcDetails[key];
    }
    if (Object.keys(mlc).length > 0) fields.mlcDetails = mlc;
  }

  if (cleaned.drugs.length > 0) fields.treatmentGiven = cleaned.drugs;
  if (cleaned.events.length > 0) {
    fields.chronologicalNotes = cleaned.events.map(e => ({
      timestamp: e.time || new Date().toISOString(),
      entry: e.description,
    }));
  }

  if (cleaned.signsSymptoms.length > 0) fields.symptoms = cleaned.signsSymptoms;
  if (cleaned.plan.length > 0) fields.plan = cleaned.plan;
  if (cleaned.labs.length > 0) fields.labs = cleaned.labs;

  if (raw.isPediatric !== undefined && raw.isPediatric !== null) fields.isPediatric = raw.isPediatric;
  if (raw.pediatricDetails && Object.keys(raw.pediatricDetails).length > 0) {
    const filteredPed: any = {};
    for (const [k, v] of Object.entries(raw.pediatricDetails)) { 
      if (isValidStr(v) || typeof v === 'boolean') filteredPed[k] = v;
    }
    if (Object.keys(filteredPed).length > 0) fields.pediatricDetails = filteredPed;
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

  if (isValidStr(raw.exposure)) fields.exposure = raw.exposure;
  else if (abcdeNormal && !isValidStr(existingCaseSheet?.exposure) && !isValidStr(existingCaseSheet?.primaryExposure)) fields.exposure = "No obvious external injuries, rash, or deformities. Normothermic.";

  // Secondary Survey / General Exam
  const secSurvey = existingCaseSheet?.secondarySurvey || {};
  let updatedSecSurvey = false;

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

  if (isValidStr(raw.respiratoryExamination)) { secSurvey.respiratory = raw.respiratoryExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.respiratory)) { secSurvey.respiratory = EXAM_DEFAULTS.respiratoryExamination; updatedSecSurvey = true; }

  if (isValidStr(raw.abdomenExamination)) { secSurvey.abdomen = raw.abdomenExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.abdomen)) { secSurvey.abdomen = EXAM_DEFAULTS.abdomenExamination; updatedSecSurvey = true; }

  if (isValidStr(raw.cnsExamination)) { secSurvey.cns = raw.cnsExamination; updatedSecSurvey = true; }
  else if (systemicNormal && !isValidStr(secSurvey.cns)) { secSurvey.cns = EXAM_DEFAULTS.cnsExamination; updatedSecSurvey = true; }

  if (updatedSecSurvey) fields.secondarySurvey = secSurvey;

  // ══════════════════════════════════════════════════════════════
  // VOICE-03/FAB-20 FIX: Allergies never silently default to "NKDA"
  // here (that remains an intentional, logged exception ONLY inside
  // DischargeSummaryView.tsx — see FAB-12). Past medical history and
  // current medications use the SAME explicit-denial-only logic as
  // extraction.ts's processSampleMedicationsAndPmh, so behavior is
  // identical across both extraction pipelines.
  // ══════════════════════════════════════════════════════════════
  if (isValidStr(raw.allergies)) fields.allergies = raw.allergies;

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

  if (isValidStr(raw.outpatientMedications)) {
    fields.currentMedications = Array.isArray(raw.outpatientMedications) ? raw.outpatientMedications : [raw.outpatientMedications];
  } else if (medPmh.medications === "Nil regular medications") {
    fields.currentMedications = [];
  }
  // Otherwise: leave untouched. Empty currentMedications no longer
  // gets silently populated just because other content was dictated.

  return fields;
}
function buildUnifiedReplyProse(
  extMsg: ScribeChatMessage,
  reasonMsg: ScribeChatMessage
): string {
  let text = "";

  // Extracted details are rendered natively by the UI card, so we don't duplicate them in the markdown prose.

  if (extMsg.type === "extraction-confirmation") {
    text += "✅ Case sheet extracted and saved.\n\n";
  }
  
  if (reasonMsg.type === "clinical-reasoning") {
    text += `${reasonMsg.content}\n\n`;
    if (reasonMsg.clinicalReasoning?.differentials?.length) {
      text += "### 🎯 Differentials to Consider\n" + reasonMsg.clinicalReasoning.differentials.map(d => `* ${d}`).join("\n") + "\n\n";
    }
    if (reasonMsg.clinicalReasoning?.watchFor?.length) {
      text += "### ⚠️ Watch For (Red Flags)\n" + reasonMsg.clinicalReasoning.watchFor.map(w => `* ${w}`).join("\n") + "\n\n";
    }
    if (reasonMsg.clinicalReasoning?.references?.length) {
      text += "### 📚 Reference Citations\n" + reasonMsg.clinicalReasoning.references.map(r => `* **${r.source}**: ${r.note}`).join("\n");
    }
  } else if (reasonMsg.type === "error") {
    text += `\n*Note: ${reasonMsg.content}*`;
  }
  
  if (extMsg && extMsg.type === "error") {
    text += `\n\n*Note: ${extMsg.content}*`;
  }

  return text.trim();
}