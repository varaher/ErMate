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
 */

import { deidentifyText } from "./deidentify";
import { cleanExtractionOutput, type RawExtractionFields } from "./extractionCleanup";
import type { CaseSheetData } from "./caseSheetTypes";
import { generateDischargeSummary } from "./dischargeSummary";

// ── Chat message shape ──────────────────────────────────────────────

export interface ScribeChatMessage {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  type: "text" | "extraction-confirmation" | "clinical-reasoning" | "error";
  content: string;              // raw text for user turns / assistant prose
  extractionSummary?: {         // populated on type: "extraction-confirmation"
    fieldsUpdated: string[];    // e.g. ["Presenting Complaint", "Vitals: HR, BP"]
    abnormalFlags: string[];    // e.g. ["HR 128 ⚠️"]
  };
  clinicalReasoning?: {         // populated on type: "clinical-reasoning"
    differentials: string[];
    references: { source: string; note: string }[]; // e.g. { source: "Tintinalli's", note: "Ch. 12 — ACS workup" }
    watchFor: string[];         // red flags / things not to miss
  };
}

export interface ScribeTurnResponse {
  extractionMessage: ScribeChatMessage;
  reasoningMessage: ScribeChatMessage;
  updatedCaseSheetFields?: Partial<CaseSheetData> & Record<string, any>;
  unappliedExtraction?: Partial<CaseSheetData> & Record<string, any>;
  dischargeDraft?: string;
  reply?: string;
}

// ── Main orchestrator — call this on every chat turn ────────────────

export async function processScribeChatTurn(
  userInput: string,           // typed text OR Sarvam-translated voice transcript
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

  const replyText = buildUnifiedReplyProse(extractionMessage, reasoningMessage);

  return {
    extractionMessage,
    reasoningMessage,
    unappliedExtraction: updatedCaseSheetFields,
    reply: replyText
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

  console.log("[scribeChatTurn] raw extraction result:", JSON.stringify(raw));
  const cleaned = cleanExtractionOutput(raw);
  console.log("[scribeChatTurn] cleaned extraction result:", JSON.stringify(cleaned));
  const updatedFields = mapExtractionToCaseSheetFields(cleaned, raw, existingCaseSheet);
  console.log("[scribeChatTurn] RAW:", JSON.stringify(raw));
  console.log("[scribeChatTurn] CLEANED:", JSON.stringify(cleaned));
  console.log("[scribeChatTurn] UPDATED FIELDS:", JSON.stringify(updatedFields));

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
  existingCaseSheet: any
): Record<string, any> {
  const fields: Record<string, any> = {};
  const isValidStr = (s: any) => typeof s === 'string' && s.trim().length > 0 && !["unknown", "not specified", "not documented", "n/a", "none"].includes(s.trim().toLowerCase());

  if (isValidStr(raw.patientName)) fields.patientName = raw.patientName;
  if (raw.age !== undefined && raw.age !== null && raw.age !== "") fields.age = raw.age;
  
  if (isValidStr(raw.sex)) fields.gender = raw.sex;
  else if (isValidStr(raw.gender)) fields.gender = raw.gender;

  if (isValidStr(raw.chiefComplaint)) fields.presentingComplaint = raw.chiefComplaint;
  else if (isValidStr(raw.presentingComplaint)) fields.presentingComplaint = raw.presentingComplaint;

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
    } else if (cleaned.signsSymptoms.length > 0 || cleaned.events.length > 0 || cleaned.drugs.length > 0 || isValidStr(raw.patientName)) {
      // If no vitals were dictated, but there is real clinical content (symptoms, drugs, events, or a new patient name),
      // we provide normal baseline vitals so that clicking "Copy" defaults to normal vitals.
      fields.vitals = { hr: 75, bp: "120/80", spo2: 98, rr: 16, temp: 98.6, gcs: 15 };
    }
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

  // --- Normal Findings / Exam Defaults Logic ---
  // Only apply defaults if this is a substantial clinical update
  const hasSubstance = isValidStr(raw.chiefComplaint) || isValidStr(raw.presentingComplaint) || 
                       isValidStr(raw.hpi) || cleaned.signsSymptoms.length > 0 || 
                       cleaned.events.length > 0 || cleaned.drugs.length > 0 || isValidStr(raw.patientName);

  // ABCDE
  if (isValidStr(raw.airway)) fields.airway = raw.airway;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.airway) && !isValidStr(existingCaseSheet?.primaryAirway)) fields.airway = "Patent and self-maintained.";

  if (isValidStr(raw.breathing)) fields.breathing = raw.breathing;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.breathing) && !isValidStr(existingCaseSheet?.primaryBreathing)) fields.breathing = "Bilateral air entry equal, no increased work of breathing. RR normal.";

  if (isValidStr(raw.circulation)) fields.circulation = raw.circulation;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.circulation) && !isValidStr(existingCaseSheet?.primaryCirculation)) fields.circulation = "Peripheral pulses palpable, CRT < 2 secs. No active bleeding.";

  if (isValidStr(raw.disability)) fields.disability = raw.disability;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.disability) && !isValidStr(existingCaseSheet?.primaryDisability)) fields.disability = "GCS 15/15. Pupils bilaterally equal and reactive to light.";

  if (isValidStr(raw.exposure)) fields.exposure = raw.exposure;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.exposure) && !isValidStr(existingCaseSheet?.primaryExposure)) fields.exposure = "No obvious external injuries, rash, or deformities. Normothermic.";

  // Secondary Survey / General Exam
  const secSurvey = existingCaseSheet?.secondarySurvey || {};
  let updatedSecSurvey = false;

  if (isValidStr(raw.generalExamination)) { secSurvey.general = raw.generalExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(existingCaseSheet?.generalExamination) && !isValidStr(secSurvey.general)) { secSurvey.general = "Conscious, oriented. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."; updatedSecSurvey = true; }

  if (isValidStr(raw.cvsExamination)) { secSurvey.cvs = raw.cvsExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.cvs)) { secSurvey.cvs = "S1 S2 heard. No murmurs."; updatedSecSurvey = true; }

  if (isValidStr(raw.respiratoryExamination)) { secSurvey.respiratory = raw.respiratoryExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.respiratory)) { secSurvey.respiratory = "Bilateral air entry equal. No added sounds."; updatedSecSurvey = true; }

  if (isValidStr(raw.abdomenExamination)) { secSurvey.abdomen = raw.abdomenExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.abdomen)) { secSurvey.abdomen = "Soft, non-tender. No organomegaly. Normal bowel sounds."; updatedSecSurvey = true; }

  if (isValidStr(raw.cnsExamination)) { secSurvey.cns = raw.cnsExamination; updatedSecSurvey = true; }
  else if (hasSubstance && !isValidStr(secSurvey.cns)) { secSurvey.cns = "Moving all four limbs. No focal neurological deficit."; updatedSecSurvey = true; }

  if (updatedSecSurvey) fields.secondarySurvey = secSurvey;

  // Allergies & PMH
  if (isValidStr(raw.allergies)) fields.allergies = raw.allergies;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.allergies)) fields.allergies = "No Known Drug Allergies (NKDA)";

  if (isValidStr(raw.pmh)) fields.pastMedicalHistory = raw.pmh;
  else if (isValidStr(raw.pastMedicalHistory)) fields.pastMedicalHistory = raw.pastMedicalHistory;
  else if (hasSubstance && !isValidStr(existingCaseSheet?.pastMedicalHistory)) fields.pastMedicalHistory = "No significant past medical history reported.";
  
  if (isValidStr(raw.outpatientMedications)) fields.currentMedications = Array.isArray(raw.outpatientMedications) ? raw.outpatientMedications : [raw.outpatientMedications];
  else if (hasSubstance && (!existingCaseSheet?.currentMedications || existingCaseSheet?.currentMedications?.length === 0)) fields.currentMedications = [];

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
