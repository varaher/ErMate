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
  updatedCaseSheetFields: Partial<CaseSheetData> & Record<string, any>;
  reply?: string;
}

// ── Main orchestrator — call this on every chat turn ────────────────

export async function processScribeChatTurn(
  userInput: string,           // typed text OR Sarvam-translated voice transcript
  patientAgeYears: number | null,
  existingCaseSheet: Partial<CaseSheetData> | Record<string, any>,
  caseId: string,
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

  // Run extraction and clinical reasoning IN PARALLEL — independent
  // failures, independent models, independent fallback chains.
  const [extractionResult, reasoningResult] = await Promise.allSettled([
    runExtraction(deidentifiedInput, patientAgeYears, helpers.callExtractionModel),
    runClinicalReasoning(deidentifiedInput, existingCaseSheet, helpers.callClinicalReasoningModel),
  ]);

  // ── Handle extraction outcome ──
  let extractionMessage: ScribeChatMessage;
  let updatedCaseSheetFields: Partial<CaseSheetData> & Record<string, any> = {};

  if (extractionResult.status === "fulfilled") {
    const { cleaned, updatedFields } = extractionResult.value;
    updatedCaseSheetFields = updatedFields;
    extractionMessage = {
      id: "ext-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "extraction-confirmation",
      content: "Saved to Case Sheet.",
      extractionSummary: {
        fieldsUpdated: summarizeUpdatedFields(cleaned),
        abnormalFlags: extractAbnormalFlags(cleaned),
      },
    };
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
    updatedCaseSheetFields,
    reply: replyText
  };
}

// ── Stage A: Extraction (GPT-4o-mini primary / Claude Haiku fallback) ──

async function runExtraction(
  deidentifiedInput: string,
  patientAgeYears: number | null,
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
  const updatedFields = mapExtractionToCaseSheetFields(cleaned, raw);

  return { cleaned, updatedFields };
}

// ── Stage B: Clinical reasoning (Claude Sonnet ONLY, no fallback) ────

async function runClinicalReasoning(
  deidentifiedInput: string,
  existingCaseSheet: Partial<CaseSheetData> | Record<string, any>,
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
  raw: any
): Record<string, any> {
  const fields: Record<string, any> = {};

  if (raw.patientName) fields.patientName = raw.patientName;
  if (raw.age !== undefined && raw.age !== null) fields.age = raw.age;
  if (raw.gender) fields.gender = raw.gender;
  if (raw.presentingComplaint) fields.presentingComplaint = raw.presentingComplaint;
  if (raw.vitals) fields.vitals = raw.vitals;

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

  return fields;
}

function buildUnifiedReplyProse(
  extMsg: ScribeChatMessage,
  reasonMsg: ScribeChatMessage
): string {
  let text = "";
  if (extMsg.type === "extraction-confirmation") {
    text += "📋 **Saved to Case Sheet**\n";
    if (extMsg.extractionSummary?.fieldsUpdated?.length) {
      text += extMsg.extractionSummary.fieldsUpdated.map(f => `* ${f}`).join("\n") + "\n\n";
    }
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

  return text.trim();
}
