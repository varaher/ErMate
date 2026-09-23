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
 *
 * PATCH-OVERWRITE FIX (Sept 2026): deterministic task patches from
 * clinicalTaskApplier.ts were merged AFTER extraction and overwrote
 * clean extracted values (secondary survey, psych, eFAST). Patches now
 * only fill fields extraction left empty in this turn. Also fixed:
 * the "adjuncts.efastNotes" patch path was split into an organ key
 * ("efastNotes"), producing a duplicated "eFAST / POCUS" row.
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
import { isNormalOnlySectionValue } from "./clinicalLanguageNormalizer";
import {
  resolveNaturalLanguageClinicalTask,
  classifyClinicalTaskIntent,
  applyClinicalPatchesToCase,
  type ClinicalPatch,
  type ClinicalTaskResolution
} from "./clinicalTaskApplier";
import { deduplicateConsultations } from "./consultationNormalization";
import { isEstablishedCaseSheet } from "./establishedCaseCheck";
import { assertCanonicalExtractionShape } from "./voiceExtraction";

console.log(
  "[scribeChatTurn] module loaded: SCRIBE-RUNTIME-2026-09-23-B"
);

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
  extractionMessage: ScribeChatMessage | null;
  reasoningMessage: ScribeChatMessage;
  updatedCaseSheetFields?: Partial<CaseSheetData> & Record<string, any>;
  unappliedExtraction?: Partial<CaseSheetData> & Record<string, any>;
  dischargeDraft?: string;
  reply?: string;
  ageQuestionNeeded?: boolean;
  dischargeIntent?: boolean;
  intent?: string;
  patches?: any[];
  runtimeDebug?: {
    build: string;
    inputWords: number;
    intent: string;
    patchCount: number;
    patchPaths: string[];
  };
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
  const isPediatric = effectiveAgeYears !== null && Number(effectiveAgeYears) <= 16;

  // Resolve natural language clinical task intent and deterministic patches
  const taskResolution = resolveNaturalLanguageClinicalTask(userInput, mergedPendingExtraction, isPediatric);

  // 1. QUESTION Intent: Pure clinical reference / decision support — do NOT modify case sheet
  if (taskResolution.intent === "QUESTION") {
    let reasoningMessage: ScribeChatMessage;
    try {
      const reasoning = await runClinicalReasoning(
        deidentifiedInput.replace(/__ERMATE_EM_(?:RESIDENT|CONSULTANT)_\d+__/g, "[DOCTOR]"),
        mergedPendingExtraction,
        chatHistory,
        helpers.callClinicalReasoningModel
      );
      reasoningMessage = {
        id: "reason-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "clinical-reasoning",
        content: reasoning.summary,
        clinicalReasoning: {
          differentials: reasoning.differentials,
          references: reasoning.references,
          watchFor: reasoning.watchFor,
        },
      };
    } catch (err) {
      reasoningMessage = {
        id: "reason-err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "Clinical reference is temporarily unavailable.",
      };
    }

    return {
      extractionMessage: null,
      reasoningMessage,
      unappliedExtraction: null,
      reply: reasoningMessage.content,
      intent: "QUESTION"
    };
  }

  // 2. Ambiguity in clinical command
  if (taskResolution.ambiguityQuestion) {
    return {
      extractionMessage: null,
      reasoningMessage: {
        id: "clarify-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "text",
        content: taskResolution.ambiguityQuestion,
      },
      unappliedExtraction: null,
      reply: taskResolution.ambiguityQuestion,
    };
  }

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
  let extractionMessage: ScribeChatMessage | null = null;
  let updatedCaseSheetFields: Partial<CaseSheetData> & Record<string, any> = {};
  let ageQuestionNeeded = false;

  if (extractionResult.status === "fulfilled") {
    const { cleaned, updatedFields } = extractionResult.value;
    if (Object.keys(updatedFields).length > 0) {
      updatedCaseSheetFields = { ...updatedFields };
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
    }
  } else {
    console.error(`[scribeChatTurn] Extraction failed for case ${caseId}`, extractionResult.reason);
  }

  // Merge deterministic task patches into updatedCaseSheetFields.
  // PATCH-OVERWRITE FIX: extraction from THIS turn always wins. A patch only
  // fills a field that extraction left empty — it never overwrites it.
  if (taskResolution.patches && taskResolution.patches.length > 0) {
    if (!updatedCaseSheetFields) updatedCaseSheetFields = {};
    for (const patch of taskResolution.patches) {
      if (patch.path.startsWith("adjuncts.efastNotes") || patch.path.startsWith("fastFindings")) {
        if (patch.path.startsWith("fastFindings.")) {
          // Real organ key only — never treat "adjuncts.efastNotes" as an organ
          const organ = patch.path.split(".")[1];
          if (!updatedCaseSheetFields.fastFindings) updatedCaseSheetFields.fastFindings = {};
          if (!isValidStr(updatedCaseSheetFields.fastFindings[organ])) {
            updatedCaseSheetFields.fastFindings[organ] = patch.value;
          }
        } else if (patch.path === "fastFindings" && patch.value && typeof patch.value === "object") {
          // Extraction values win over deterministic patch values
          updatedCaseSheetFields.fastFindings = {
            ...patch.value,
            ...(updatedCaseSheetFields.fastFindings || {}),
          };
        } else if (typeof patch.value === "string" && !isValidStr(updatedCaseSheetFields.efastNotes)) {
          updatedCaseSheetFields.efastNotes = patch.value;
        }
      } else if (patch.path.startsWith("sampleHistory.")) {
        const sub = patch.path.split(".")[1];
        if (
          sub === "psychiatricFlags" &&
          (isValidStr(updatedCaseSheetFields.psychologicalAssessment) ||
            isValidStr(updatedCaseSheetFields.sampleHistory?.psychiatricFlags))
        ) {
          // Extraction already captured the explicitly dictated psych assessment
          continue;
        }
        if (!updatedCaseSheetFields.sampleHistory) updatedCaseSheetFields.sampleHistory = {};
        updatedCaseSheetFields.sampleHistory[sub] = patch.value;
        if (sub === "pastHistory") updatedCaseSheetFields.pastMedicalHistory = patch.value;
        if (sub === "allergies") updatedCaseSheetFields.allergies = patch.value;
        if (sub === "events") updatedCaseSheetFields.events = patch.value;
        if (sub === "medications") {
          updatedCaseSheetFields.currentMedications = Array.isArray(patch.value) ? patch.value : [patch.value];
        }
        if (sub === "psychiatricFlags") updatedCaseSheetFields.psychologicalAssessment = patch.value;
      } else if (patch.path === "events") {
        if (!updatedCaseSheetFields.sampleHistory) updatedCaseSheetFields.sampleHistory = {};
        updatedCaseSheetFields.sampleHistory.events = patch.value;
        updatedCaseSheetFields.events = patch.value;
      } else if (patch.path.startsWith("secondarySurvey.")) {
        const system = patch.path.split(".")[1];
        if (!updatedCaseSheetFields.secondarySurvey) updatedCaseSheetFields.secondarySurvey = {};
        if (!isValidStr(updatedCaseSheetFields.secondarySurvey[system])) {
          updatedCaseSheetFields.secondarySurvey[system] = patch.value;
        }
        const sec = updatedCaseSheetFields.secondarySurvey;
        const secParts: string[] = [];
        if (sec.general) secParts.push(`General: ${sec.general}`);
        if (sec.cvs) secParts.push(`CVS: ${sec.cvs}`);
        if (sec.respiratory) secParts.push(`RS: ${sec.respiratory}`);
        if (sec.abdomen) secParts.push(`PA: ${sec.abdomen}`);
        if (sec.cns) secParts.push(`CNS: ${sec.cns}`);
        if (sec.extremities) secParts.push(`Extremities: ${sec.extremities}`);
        if (secParts.length > 0) {
          updatedCaseSheetFields.secondaryAssessment = secParts.join("\n");
        }
      } else if (patch.path === "secondaryAssessment") {
        updatedCaseSheetFields.secondaryAssessment = patch.value;
      } else if (patch.path === "pastMedicalHistory") {
        updatedCaseSheetFields.pastMedicalHistory = patch.value;
        if (!updatedCaseSheetFields.sampleHistory) updatedCaseSheetFields.sampleHistory = {};
        updatedCaseSheetFields.sampleHistory.pastHistory = patch.value;
      } else if (patch.path === "currentMedications") {
        updatedCaseSheetFields.currentMedications = Array.isArray(patch.value) ? patch.value : [patch.value];
        if (!updatedCaseSheetFields.sampleHistory) updatedCaseSheetFields.sampleHistory = {};
        updatedCaseSheetFields.sampleHistory.medications = Array.isArray(patch.value) ? patch.value.join(", ") : patch.value;
      } else if (patch.path === "psychologicalAssessment") {
        if (!isValidStr(updatedCaseSheetFields.psychologicalAssessment)) {
          updatedCaseSheetFields.psychologicalAssessment = patch.value;
          if (!updatedCaseSheetFields.sampleHistory) updatedCaseSheetFields.sampleHistory = {};
          updatedCaseSheetFields.sampleHistory.psychiatricFlags = patch.value;
        }
      } else if (patch.path === "treatmentGiven") {
        const arr = Array.isArray(updatedCaseSheetFields.treatmentGiven) ? [...updatedCaseSheetFields.treatmentGiven] : [];
        if (!arr.some((t: any) => (t.drugName || t.name) === (patch.value.drugName || patch.value.name))) {
          arr.push(patch.value);
        }
        updatedCaseSheetFields.treatmentGiven = arr;
      } else if (patch.path === "investigationLabsOrdered") {
        const arr = Array.isArray(updatedCaseSheetFields.investigationLabsOrdered) ? [...updatedCaseSheetFields.investigationLabsOrdered] : [];
        if (!arr.includes(patch.value)) arr.push(patch.value);
        updatedCaseSheetFields.investigationLabsOrdered = arr;
      } else if (patch.path === "investigationImaging") {
        const arr = Array.isArray(updatedCaseSheetFields.investigationImaging) ? [...updatedCaseSheetFields.investigationImaging] : [];
        if (!arr.includes(patch.value)) arr.push(patch.value);
        updatedCaseSheetFields.investigationImaging = arr;
      } else if (patch.path === "otherProcedures") {
        const existing = updatedCaseSheetFields.otherProcedures || "";
        updatedCaseSheetFields.otherProcedures = existing ? `${existing}; ${patch.value}` : String(patch.value);
      } else if (patch.path === "consultsRequested" || patch.path === "dispositionAndPlan.consultsRequested") {
        const arr = Array.isArray(updatedCaseSheetFields.consultsRequested) ? [...updatedCaseSheetFields.consultsRequested] : [];
        if (!arr.includes(patch.value)) arr.push(patch.value);
        updatedCaseSheetFields.consultsRequested = arr;
        if (!updatedCaseSheetFields.dispositionAndPlan) updatedCaseSheetFields.dispositionAndPlan = {};
        updatedCaseSheetFields.dispositionAndPlan.consultsRequested = arr;
      } else if (patch.path === "disposition") {
        updatedCaseSheetFields.disposition = patch.value;
      } else if (patch.path === "managementPlan") {
        const existing = updatedCaseSheetFields.managementPlan || "";
        updatedCaseSheetFields.managementPlan = existing ? `${existing}; ${patch.value}` : String(patch.value);
      }
    }

    // Include userConfirmationSummary
    if (taskResolution.userConfirmationSummary) {
      if (!extractionMessage) {
        extractionMessage = {
          id: "ext-" + Date.now(),
          role: "assistant",
          timestamp: new Date().toISOString(),
          type: "extraction-confirmation",
          content: taskResolution.userConfirmationSummary,
          extractionSummary: {
            fieldsUpdated: Object.keys(updatedCaseSheetFields).filter(k => k !== 'vitals'),
            abnormalFlags: [],
          },
        };
      } else {
        extractionMessage.content = taskResolution.userConfirmationSummary;
        extractionMessage.extractionSummary = {
          fieldsUpdated: Object.keys(updatedCaseSheetFields).filter(k => k !== 'vitals'),
          abnormalFlags: extractionMessage.extractionSummary?.abnormalFlags || [],
        };
      }
    }
  }

  if (!extractionMessage) {
    if (Object.keys(updatedCaseSheetFields).length === 0) {
      updatedCaseSheetFields = null;
      extractionMessage = {
        id: "ext-err-" + Date.now(),
        role: "assistant",
        timestamp: new Date().toISOString(),
        type: "error",
        content: "Could not extract structured data from this entry. You can add it manually to the Case Sheet.",
      };
    }
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
    ageQuestionNeeded,
    runtimeDebug: {
      build: "SCRIBE-RUNTIME-2026-09-23-B",
      inputWords: userInput.trim().split(/\s+/).filter(Boolean).length,
      intent: taskResolution.intent,
      patchCount: taskResolution.patches?.length ?? 0,
      patchPaths: (taskResolution.patches || []).map((p: any) => p.path)
    }
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
    assertCanonicalExtractionShape(raw);
  } catch (err) {
    console.warn("[scribeChatTurn] GPT-4o-mini extraction failed or non-canonical shape, falling back to Claude 3.5 Haiku", err);
    raw = await callExtractionModel({ model: "claude-3.5-haiku", temperature: 0.0, deidentifiedInput, patientAgeYears, pendingClarification });
    assertCanonicalExtractionShape(raw);
  }

  console.log(
    "[SCRIBE-RAW-CORE-TRACE]",
    JSON.stringify({
      chiefComplaint: (raw as any)?.chiefComplaint ?? null,
      presentingComplaint: (raw as any)?.presentingComplaint ?? null,
      symptoms: (raw as any)?.symptoms ?? null,
      hpi: (raw as any)?.hpi ?? null,

      allergies: (raw as any)?.allergies ?? null,
      pmh: (raw as any)?.pmh ?? null,
      pastMedicalHistory: (raw as any)?.pastMedicalHistory ?? null,
      outpatientMedications: (raw as any)?.outpatientMedications ?? null,
      lastMeal: (raw as any)?.lastMeal ?? null,
      events: (raw as any)?.events ?? null,

      vitals: (raw as any)?.vitals ?? null,

      airway: (raw as any)?.airway ?? null,
      breathing: (raw as any)?.breathing ?? null,
      circulation: (raw as any)?.circulation ?? null,
      disability: (raw as any)?.disability ?? null,
      exposure: (raw as any)?.exposure ?? null,

      priority: (raw as any)?.priority ?? null,
      ecg: (raw as any)?.ecg ?? null,
      vbg: (raw as any)?.vbg ?? null,
      echo: (raw as any)?.echo ?? null,
      fastFindings: (raw as any)?.fastFindings ?? null,

      generalExamination: (raw as any)?.generalExamination ?? null,
      cvsExamination: (raw as any)?.cvsExamination ?? null,
      respiratoryExamination: (raw as any)?.respiratoryExamination ?? null,
      abdomenExamination: (raw as any)?.abdomenExamination ?? null,
      cnsExamination: (raw as any)?.cnsExamination ?? null,
      extremitiesExamination: (raw as any)?.extremitiesExamination ?? null,

      psychologicalAssessment: (raw as any)?.psychologicalAssessment ?? null,
      investigationsOrdered: (raw as any)?.investigationsOrdered ?? null,
      treatment: (raw as any)?.treatment ?? null,
      plan: (raw as any)?.plan ?? null,
      differentials: (raw as any)?.differentials ?? null,
      diagnosis: (raw as any)?.diagnosis ?? null,

      mlcDetails: (raw as any)?.mlcDetails ?? null
    })
  );

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

  console.log(
    "[TRACE-RAW-BEFORE-CLEAN]",
    JSON.stringify({
      keys: Object.keys(raw || {}),
      vitals: (raw as any)?.vitals ?? null,
      chiefComplaint: (raw as any)?.chiefComplaint ?? null,
      pastMedicalHistory: (raw as any)?.pastMedicalHistory ?? null,
      airway: (raw as any)?.airway ?? null,
      breathing: (raw as any)?.breathing ?? null,
      circulation: (raw as any)?.circulation ?? null,
      disability: (raw as any)?.disability ?? null,
      exposure: (raw as any)?.exposure ?? null,
      vbg: (raw as any)?.vbg ?? null,
      plan: (raw as any)?.plan ?? null,
      differentials: (raw as any)?.differentials ?? null,
      mlcDetails: (raw as any)?.mlcDetails ?? null
    })
  );

  const cleaned = cleanExtractionOutput(raw);

  console.log(
    "[TRACE-RAW-AFTER-CLEAN]",
    JSON.stringify({
      keys: Object.keys(raw || {}),
      vitals: (raw as any)?.vitals ?? null,
      chiefComplaint: (raw as any)?.chiefComplaint ?? null,
      pastMedicalHistory: (raw as any)?.pastMedicalHistory ?? null,
      airway: (raw as any)?.airway ?? null,
      breathing: (raw as any)?.breathing ?? null,
      circulation: (raw as any)?.circulation ?? null,
      disability: (raw as any)?.disability ?? null,
      exposure: (raw as any)?.exposure ?? null,
      vbg: (raw as any)?.vbg ?? null,
      plan: (raw as any)?.plan ?? null,
      differentials: (raw as any)?.differentials ?? null,
      mlcDetails: (raw as any)?.mlcDetails ?? null
    })
  );

  console.log(
    "[SCRIBE-CLEANED-CORE-TRACE]",
    JSON.stringify(cleaned)
  );
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
  const hasTrigger = /\b(rta\b|road traffic accident|motor vehicle|accident|fall|fell|trauma|assault|hit\s+by|injury|injuries|fracture|burn|drowning|bite|sting|poison|ingestion|overdose|collapse|syncope|unconscious|found\s+(?:lying|collapsed|unconscious)|electrocution|struck|wound|post-op|surgery)\b/i.test(t);
  return hasTrigger;
}

export function deriveExplicitEvents(raw: any, rawInputText?: string): string | null {
  const actualRaw = (raw && typeof raw === 'object') ? raw : {};
  const actualInputText = typeof raw === 'string' ? raw : (rawInputText || "");

  const normalizeEventText = (ev: string): string => {
    let t = ev.trim();
    if (/^rta[\s:\-]+/i.test(t)) {
      t = t.replace(/^rta[\s:\-]+/i, "Road traffic accident involving ");
    } else if (/^rta$/i.test(t)) {
      t = "Road traffic accident";
    } else if (/^two-wheeler\s+vs/i.test(t)) {
      t = "Road traffic accident involving " + t;
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  // 1. Explicit events string or array from model / sampleHistory
  if (typeof actualRaw.events === 'string' && actualRaw.events.trim()) {
    const ev = actualRaw.events.trim();
    if (isExplicitPrecipitatingEvent(ev)) {
      return normalizeEventText(ev);
    }
  }
  if (actualRaw.sampleHistory && typeof actualRaw.sampleHistory === 'object' && typeof actualRaw.sampleHistory.events === 'string' && actualRaw.sampleHistory.events.trim()) {
    const ev = actualRaw.sampleHistory.events.trim();
    if (isExplicitPrecipitatingEvent(ev)) {
      return normalizeEventText(ev);
    }
  }
  if (Array.isArray(actualRaw.events) && actualRaw.events.length > 0) {
    const descs = actualRaw.events
      .map((e: any) => typeof e === 'string' ? e.trim() : (e?.description || ""))
      .filter((d: string) => isExplicitPrecipitatingEvent(d));
    if (descs.length > 0) return normalizeEventText(descs.join("; "));
  }

  // 2. Explicit mechanism from mlcDetails
  if (actualRaw.mlcDetails && typeof actualRaw.mlcDetails.mechanismOfInjury === 'string' && actualRaw.mlcDetails.mechanismOfInjury.trim()) {
    const mech = actualRaw.mlcDetails.mechanismOfInjury.trim();
    if (isExplicitPrecipitatingEvent(mech)) {
      return normalizeEventText(mech);
    }
  }

  // 3. "Found lying / found collapsed / found unconscious" is a valid explicit pre-arrival event.
  // Prefer the first occurrence in the original clinician transcript so a later HPI paraphrase
  // cannot overwrite the incident description. Append place/time only when those values were
  // explicitly extracted from the same dictation.
  const foundEventMatch = actualInputText.match(
    /\b(found\s+(?:lying|collapsed|unconscious)[^,\n;]*)/i
  );

  if (foundEventMatch) {
    let eventText = normalizeEventText(foundEventMatch[1].trim());

    const incidentPlace = actualRaw?.mlcDetails?.placeOfIncident;
    if (typeof incidentPlace === "string" && incidentPlace.trim()) {
      const cleanPlace = incidentPlace.trim().replace(/^(?:at|in)\s+/i, "");
      if (cleanPlace && !eventText.toLowerCase().includes(cleanPlace.toLowerCase())) {
        eventText += ` at ${cleanPlace}`;
      }
    }

    const incidentTime = actualRaw?.mlcDetails?.dateTimeOfIncident;
    if (typeof incidentTime === "string" && incidentTime.trim()) {
      const cleanTime = incidentTime.trim();
      if (cleanTime && !eventText.toLowerCase().includes(cleanTime.toLowerCase())) {
        eventText += ` (${cleanTime})`;
      }
    }

    return eventText;
  }

  // 4. Derive strictly from explicit preceding history or dictation text:
  const candidateTexts = [
    actualRaw.hpi,
    actualRaw.presentingComplaint,
    actualRaw.chiefComplaint,
    actualInputText
  ].filter(t => typeof t === 'string' && t.trim().length > 0) as string[];

  for (const text of candidateTexts) {
    // Bites and Stings (e.g. "Snake bite while working in field")
    const biteMatch = text.match(/\b(?:alleged\s+history\s+of\s+|history\s+of\s+)?(snake\s+bite[^\.\n;,]*|scorpion\s+sting[^\.\n;,]*|dog\s+bite[^\.\n;,]*|animal\s+bite[^\.\n;,]*|insect\s+bite[^\.\n;,]*|monkey\s+bite[^\.\n;,]*)/i);
    if (biteMatch) {
      let matched = biteMatch[1].trim();
      return normalizeEventText(matched);
    }

    // RTA / Traffic accident (e.g. "RTA two-wheeler vs four-wheeler")
    const rtaMatch = text.match(/\b(?:alleged\s+history\s+of\s+|history\s+of\s+)?(rta\b[^\.\n;,]*|road\s+traffic\s+accident[^\.\n;,]*|motor\s+vehicle\s+accident[^\.\n;,]*|two-wheeler\s+vs\s+four-wheeler[^\.\n;,]*|hit\s+by[^\.\n;,]*|bike\s+skid[^\.\n;,]*)/i);
    if (rtaMatch) {
      let matched = rtaMatch[1].trim();
      return normalizeEventText(matched);
    }

    // Poisoning / Ingestion / Chemical / Overdose
    const poisonMatch = text.match(/\b(?:alleged\s+history\s+of\s+|history\s+of\s+)?(organophosphate\s+poisoning[^\.\n;,]*|consumption\s+of\s+[^\.\n;,]+|accidental\s+ingestion\s+of\s+[^\.\n;,]+|overdose\s+of\s+[^\.\n;,]+|drug\s+overdose[^\.\n;,]*|chemical\s+ingestion[^\.\n;,]*|rat\s+poison[^\.\n;,]*|kerosene\s+ingestion[^\.\n;,]*|acid\s+ingestion[^\.\n;,]*)/i);
    if (poisonMatch) {
      let matched = poisonMatch[1].trim();
      return normalizeEventText(matched);
    }

    // Fall / Collapse
    const fallMatch = text.match(/\b(?:alleged\s+history\s+of\s+|history\s+of\s+)?(fall\s+from\s+[^\.\n;,]+|slip\s+and\s+fall[^\.\n;,]*|fall\s+at\s+[^\.\n;,]+|fall\s+in\s+[^\.\n;,]+|sudden\s+collapse[^\.\n;,]*|loss\s+of\s+consciousness[^\.\n;,]*)/i);
    if (fallMatch) {
      return normalizeEventText(fallMatch[1].trim());
    }

    // Assault / Trauma / Burn / Electrocution / Drowning
    const traumaMatch = text.match(/\b(physical\s+assault[^\.\n;,]*|assaulted\s+by\s+[^\.\n;,]+|blunt\s+trauma[^\.\n;,]*|stab\s+injury[^\.\n;,]*|burn\s+injury[^\.\n;,]*|electrocution[^\.\n;,]*|electric\s+shock[^\.\n;,]*|near\s+drowning[^\.\n;,]*|drowning[^\.\n;,]*)/i);
    if (traumaMatch) {
      return normalizeEventText(traumaMatch[1].trim());
    }
  }

  return null;
}

export function extractExplicitSecondarySurveySections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  if (!text || typeof text !== "string") return sections;

  const normalizeKey = (k: string): string | null => {
    const lower = k.trim().toLowerCase();
    if (lower.startsWith("rs") || lower.includes("respiratory") || lower.includes("chest") || lower.includes("lung")) return "respiratory";
    if (lower.startsWith("pa") || lower.includes("abdomen") || lower.includes("abdominal")) return "abdomen";
    if (lower.includes("cvs") || lower.includes("cardiovascular") || lower.includes("heart")) return "cvs";
    if (lower.includes("cns") || lower.includes("neurological") || lower.includes("neuro")) return "cns";
    if (lower.includes("general")) return "general";
    if (lower.includes("extremit") || lower.includes("local") || lower.includes("trauma") || lower.includes("musculoskeletal") || lower.includes("msk")) return "extremities";
    return null;
  };

  const headerPattern = "(?:general(?:\\s+examination|\\s+exam)?|cvs(?:\\s+examination|\\s+exam)?|cardiovascular(?:\\s+examination|\\s+exam)?|respiratory(?:\\s+system|\\s+examination|\\s+exam)?|rs(?:\\s+examination|\\s+exam)?|chest(?:\\s+examination|\\s+exam)?|per\\s+abdomen(?:\\s+examination|\\s+exam)?|pa(?:\\s+examination|\\s+exam)?|abdomen(?:\\s+examination|\\s+exam)?|abdominal(?:\\s+examination|\\s+exam)?|cns(?:\\s+examination|\\s+exam)?|neurological(?:\\s+examination|\\s+exam)?|extremities(?:\\s+examination|\\s+exam)?|extremity(?:\\s+examination|\\s+exam)?|musculoskeletal(?:\\s+examination|\\s+exam)?|msk)";

  const regex = new RegExp(`(?:^|[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(${headerPattern})\\s*[:\\-]\\s*([\\s\\S]*?)(?=(?:[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(?:${headerPattern})\\s*[:\\-]|$)`, "gi");

  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = normalizeKey(match[1]);
    let val = (match[2] || "").trim();
    val = val.replace(/^[,\.\s;:\-]+/, "").replace(/[,\.\s;:\-]+$/, "").trim();
    if (key && val) {
      sections[key] = sections[key] ? `${sections[key]}\n${val}` : val;
    }
  }
  return sections;
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

function transcriptHasExplicitGcsComponent(text: string, component: "e" | "v" | "m"): boolean {
  if (!text) return false;
  switch (component) {
    case "e":
      return /\be\s*[:=-]?\s*([1-4])(?=\D|$)/i.test(text) || /e([1-4])(?=[vm\D]|$)/i.test(text) || /\beye(?:s)?\s*(?:opening|response)?\s*[:=-]?\s*([1-4])\b/i.test(text);
    case "v":
      return /\bv\s*[:=-]?\s*([1-5])(?=\D|$)/i.test(text) || /v([1-5])(?=[em\D]|$)/i.test(text) || /\bverbal\s*(?:response)?\s*[:=-]?\s*([1-5])\b/i.test(text);
    case "m":
      return /\bm\s*[:=-]?\s*([1-6])(?=\D|$)/i.test(text) || /m([1-6])(?=[ev\D]|$)/i.test(text) || /\bmotor\s*(?:response)?\s*[:=-]?\s*([1-6])\b/i.test(text);
  }
}

function isGcsComponentAllowed(k: string, rawInputText: string): boolean {
  const key = k.toLowerCase();
  if (key === "gcs") {
    return transcriptHasExplicitTotalGcs(rawInputText);
  }
  if (key === "gcs_e") {
    return transcriptHasExplicitGcsComponent(rawInputText, "e");
  }
  if (key === "gcs_v") {
    return transcriptHasExplicitGcsComponent(rawInputText, "v");
  }
  if (key === "gcs_m") {
    return transcriptHasExplicitGcsComponent(rawInputText, "m");
  }
  return true;
}

function transcriptHasExplicitTotalGcs(text: string): boolean {
  if (!text) return false;

  // ErMate documentation policy: Total GCS is retained ONLY when an explicit total was dictated.
  // Must be tied syntactically to GCS / Glasgow / total wording.
  // Numbers belonging to limb power (e.g. 5/5, 0/5), BP (160/90), RR (18), age (14yo),
  // glucose, or component-only strings (E3V4M5) must NEVER validate a GCS total.
  return /\b(?:total\s+gcs|gcs\s+total|gcs\s+score|glasgow\s+(?:coma\s+)?(?:scale|score)|gcs)\s*(?:is|of|[:=-])?\s*(?:total\s*)?(?:[3-9]|1[0-5])\b/i.test(text) ||
    /\b(?:gcs\s+)?total\s+(?:[3-9]|1[0-5])\s*(?:out\s+of|\/)\s*15\b/i.test(text);
}

function transcriptGcsEyeOnly(text: string): string | null {
  if (!text) return null;

  const match = text.match(/\bgcs\s*[:=-]?\s*e\s*([1-4])\b/i);
  return match ? `E${match[1]}` : null;
}

function normalizeClinicalText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[,;:\s]+|[,;:\s]+$/g, "")
    .replace(/^then\s+/i, "")
    .trim();
}

type SecondarySection =
  | "general"
  | "cvs"
  | "respiratory"
  | "abdomen"
  | "cns"
  | "extremities";

function getExaminationWindow(text: string): string {
  if (!text) return "";

  const generalIndex = text.search(/\bgeneral\s+examination\b/i);

  if (generalIndex >= 0) {
    return text.slice(generalIndex);
  }

  const systemicIndex = text.search(/\bsystemic\s+examination\b/i);

  if (systemicIndex >= 0) {
    return text.slice(systemicIndex);
  }

  return text;
}

function extractExplicitSecondarySection(
  rawInputText: string,
  section: SecondarySection
): string | null {
  const text = getExaminationWindow(rawInputText);

  if (!text) return null;

  const patterns: Record<SecondarySection, RegExp> = {
    general:
      /\bgeneral\s+examination\s*[:,-]?\s*([\s\S]*?)(?=\bsystemic\s+examination\b|\bcvs\b|\bcardiovascular\b)/i,

    cvs:
      /\b(?:cvs|cardiovascular(?:\s+examination)?)\s*[:,-]?\s*([\s\S]*?)(?=\b(?:chest|respiratory|rs|abdomen|per\s+abdomen|p\/a|cns|neurological|extremities|psychological\s+assessment|investigations)\b)/i,

    respiratory:
      /\b(?:chest|respiratory(?:\s+examination)?|rs)\s*[:,-]?\s*([\s\S]*?)(?=\b(?:abdomen|per\s+abdomen|p\/a|cns|neurological|extremities|psychological\s+assessment|investigations)\b)/i,

    abdomen:
      /\b(?:abdomen(?:\s+examination)?|per\s+abdomen|p\/a)\s*[:,-]?\s*([\s\S]*?)(?=\b(?:then\s+)?(?:cns|neurological|extremities|psychological\s+assessment|investigations)\b)/i,

    cns:
      /\b(?:cns|neurological(?:\s+examination)?)\s*[:,-]?\s*([\s\S]*?)(?=\b(?:then\s+)?(?:extremities|psychological\s+assessment|investigations)\b)/i,

    extremities:
      /\bextremities(?:\s+examination)?\s*[:,-]?\s*([\s\S]*?)(?=\b(?:psychological\s+assessment|investigations|treatment\s+plan|differential\s+diagnosis)\b|$)/i,
  };

  const match = text.match(patterns[section]);

  if (!match?.[1]) return null;

  const cleaned = normalizeClinicalText(match[1]);

  return cleaned.length > 0 ? cleaned : null;
}

function isContaminatedExamValue(value: any): boolean {
  if (typeof value !== "string") return false;

  const text = value.trim();

  if (text.length > 350) return true;

  return /\b(presenting\s+complaint|primary\s+assessment|informant|identification\s+mark|brought\s+by|date\s+and\s+time\s+of\s+incident|adjuvant\s+primary|vbg|abg|grbs|treatment\s+plan|differential\s+diagnosis)\b/i.test(
    text
  );
}

/**
 * Psychological assessment must come from explicit clinician speech only.
 * This intentionally does NOT trust a model-generated generic "Normal" unless
 * the clinician explicitly dictated that within the psychological section.
 */
function extractExplicitPsychologicalAssessment(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  const labelled = text.match(
    /\bpsychological\s+assessment\s*[:,-]?\s*([\s\S]*?)(?=\b(?:investigations?|treatment\s+plan|differential\s+diagnosis|disposition|doctor\s+[A-Za-z]|em\s+consultant)\b|$)/i
  );

  if (labelled?.[1]) {
    const cleaned = normalizeClinicalText(labelled[1]);
    if (cleaned) return cleaned;
  }

  // Narrow fallback for individually dictated psychiatric negatives outside a labelled section.
  const explicitNegatives = text.match(
    /\bno\s+(?:features?\s+of\s+)?(?:depression|anxiety|psychosis|agitation|suicidal\s+ideation|substance\s+(?:use|abuse)|self[-\s]?harm(?:\s+history)?|intent\s+to\s+harm\s+others|psychiatric\s+history)\b/gi
  );

  if (explicitNegatives && explicitNegatives.length > 0) {
    return Array.from(new Set(explicitNegatives.map(v => normalizeClinicalText(v)))).join(", ");
  }

  return null;
}

export function mapExtractionToCaseSheetFields(
  cleaned: ReturnType<typeof cleanExtractionOutput>,
  raw: any,
  existingCaseSheet: any,
  rawInputText: string,
  clinicianProtection?: ProtectedCliniciansResult
): Record<string, any> {
  console.log(
    "[TRACE-MAPPER-ENTRY]",
    JSON.stringify({
      keys: Object.keys(raw || {}),
      vitals: raw?.vitals ?? null,
      chiefComplaint: raw?.chiefComplaint ?? null,
      pastMedicalHistory: raw?.pastMedicalHistory ?? null,
      airway: raw?.airway ?? null,
      breathing: raw?.breathing ?? null,
      circulation: raw?.circulation ?? null,
      disability: raw?.disability ?? null,
      exposure: raw?.exposure ?? null,
      vbg: raw?.vbg ?? null,
      plan: raw?.plan ?? null,
      differentials: raw?.differentials ?? null,
      mlcDetails: raw?.mlcDetails ?? null
    })
  );

  const fields: Record<string, any> = {};
  const isValidStr = (s: any) => typeof s === 'string' && s.trim().length > 0 && !["unknown", "not specified", "not documented", "n/a", "none"].includes(s.trim().toLowerCase());

  if (isValidStr(raw.patientName)) fields.patientName = raw.patientName;
  if (raw.age !== undefined && raw.age !== null && raw.age !== "") fields.age = raw.age;

  if (isValidStr(raw.sex)) fields.gender = raw.sex;
  else if (isValidStr(raw.gender)) fields.gender = raw.gender;

  if (isValidStr(raw.chiefComplaint)) {
    fields.presentingComplaint = raw.chiefComplaint;
  } else if (isValidStr(raw.presentingComplaint)) {
    fields.presentingComplaint = raw.presentingComplaint;
  } else if (cleaned.symptoms && cleaned.symptoms.length > 0) {
    // Safe fallback: only clinician-stated symptoms already accepted by cleanup.
    fields.presentingComplaint = cleaned.symptoms.join(", ");
  } else if (isValidStr(raw.hpi)) {
    // Final fallback is explicit HPI text from the clinician extraction; never invent a complaint.
    fields.presentingComplaint = raw.hpi;
  }

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
        // SAFETY: deterministic GCS guard.
        // Never accept an inferred total GCS or unstated subcomponents.
        // Example: transcript says only "GCS E4" -> gcs, gcs_v, gcs_m are dropped, only gcs_e survives.
        if (!isGcsComponentAllowed(k, rawInputText)) {
          continue;
        }

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

  if (isValidStr(raw.ecg)) fields.ecg = raw.ecg;
  if (isValidStr(raw.echo)) fields.echo = raw.echo;
  if (isValidStr(raw.diagnosis)) fields.diagnosis = raw.diagnosis; // closes VOICE-06
  if (isValidStr(raw.disposition)) fields.disposition = raw.disposition;
  if (Array.isArray(raw.consultations) && raw.consultations.length > 0) {
    fields.consultations = deduplicateConsultations(raw.consultations.filter(isValidStr));
  }

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
    for (const organ of ['heart', 'abdomen', 'pelvis', 'bladder', 'suprapubic', 'lungs']) {
      if (isValidStr(raw.fastFindings[organ])) fast[organ] = raw.fastFindings[organ];
    }
    if (Object.keys(fast).length > 0) {
      fields.fastFindings = fast;
      const parts: string[] = [];
      if (fast.heart) parts.push(`Heart: ${fast.heart}`);
      if (fast.abdomen) parts.push(`Abdomen: ${fast.abdomen}`);
      if (fast.pelvis || fast.bladder || fast.suprapubic) {
        const pStr = [fast.pelvis, fast.bladder, fast.suprapubic].filter(Boolean).join(" / ");
        parts.push(`Pelvis/Bladder: ${pStr}`);
      }
      if (fast.lungs) parts.push(`Lungs: ${fast.lungs}`);
      fields.efastNotes = parts.join(" | ");
    }
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

  // Procedures: keep for detection & template prefill ONLY.
  // Do NOT write into legacy completed procedure fields (otherProcedures, proceduresChecked).
  if (cleaned.procedures && cleaned.procedures.length > 0) {
    fields.procedures = cleaned.procedures;
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
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      symptoms: cleaned.symptoms.join(", ")
    };
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

  const eyeOnlyGcs = transcriptGcsEyeOnly(rawInputText);

  if (eyeOnlyGcs && !transcriptHasExplicitTotalGcs(rawInputText)) {
    const eyeStatement =
      `GCS eye response ${eyeOnlyGcs}; total GCS not fully documented.`;

    if (isValidStr(fields.disability)) {
      if (!fields.disability.toLowerCase().includes("total gcs not fully documented")) {
        fields.disability =
          `${fields.disability}. ${eyeStatement}`.replace(/\.\s*\./g, ".");
      }
    } else {
      fields.disability = eyeStatement;
    }
  }

  // Secondary Survey / General Exam
  const secSurvey = {
    ...(existingCaseSheet?.secondarySurvey || {})
  };

  let updatedSecSurvey = false;

  const explicitGeneral =
    extractExplicitSecondarySection(rawInputText, "general");

  const explicitCvs =
    extractExplicitSecondarySection(rawInputText, "cvs");

  const explicitRespiratory =
    extractExplicitSecondarySection(rawInputText, "respiratory");

  const explicitAbdomen =
    extractExplicitSecondarySection(rawInputText, "abdomen");

  const explicitCns =
    extractExplicitSecondarySection(rawInputText, "cns");

  const explicitExtremities =
    extractExplicitSecondarySection(rawInputText, "extremities");

  console.log(
    "[SCRIBE-SECONDARY-TRACE]",
    JSON.stringify({
      general: explicitGeneral,
      cvs: explicitCvs,
      respiratory: explicitRespiratory,
      abdomen: explicitAbdomen,
      cns: explicitCns,
      extremities: explicitExtremities,

      rawGeneral: raw.generalExamination ?? null,
      rawCvs: raw.cvsExamination ?? null,
      rawRespiratory: raw.respiratoryExamination ?? null,
      rawAbdomen: raw.abdomenExamination ?? null,
      rawCns: raw.cnsExamination ?? null,
      rawExtremities: raw.extremitiesExamination ?? null
    })
  );

  // GENERAL
  if (explicitGeneral) {
    secSurvey.general = explicitGeneral;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.generalExamination) &&
    !isContaminatedExamValue(raw.generalExamination)
  ) {
    secSurvey.general = raw.generalExamination;
    updatedSecSurvey = true;
  } else if (
    systemicNormal &&
    !isValidStr(secSurvey.general)
  ) {
    secSurvey.general = EXAM_DEFAULTS.generalExamination;
    updatedSecSurvey = true;
  }

  // CVS
  if (explicitCvs) {
    secSurvey.cvs = explicitCvs;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.cvsExamination) &&
    !isContaminatedExamValue(raw.cvsExamination)
  ) {
    secSurvey.cvs = raw.cvsExamination;
    updatedSecSurvey = true;
  } else if (
    systemicNormal &&
    !isValidStr(secSurvey.cvs)
  ) {
    secSurvey.cvs = EXAM_DEFAULTS.cvsExamination;
    updatedSecSurvey = true;
  }

  // RESPIRATORY
  if (explicitRespiratory) {
    secSurvey.respiratory = explicitRespiratory;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.respiratoryExamination) &&
    !isContaminatedExamValue(raw.respiratoryExamination)
  ) {
    secSurvey.respiratory = raw.respiratoryExamination;
    updatedSecSurvey = true;
  } else if (
    systemicNormal &&
    !isValidStr(secSurvey.respiratory)
  ) {
    secSurvey.respiratory = EXAM_DEFAULTS.respiratoryExamination;
    updatedSecSurvey = true;
  }

  // ABDOMEN
  if (explicitAbdomen) {
    secSurvey.abdomen = explicitAbdomen;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.abdomenExamination) &&
    !isContaminatedExamValue(raw.abdomenExamination)
  ) {
    secSurvey.abdomen = raw.abdomenExamination;
    updatedSecSurvey = true;
  } else if (
    systemicNormal &&
    !isValidStr(secSurvey.abdomen)
  ) {
    secSurvey.abdomen = EXAM_DEFAULTS.abdomenExamination;
    updatedSecSurvey = true;
  }

  // CNS
  if (explicitCns) {
    secSurvey.cns = explicitCns;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.cnsExamination) &&
    !isContaminatedExamValue(raw.cnsExamination)
  ) {
    secSurvey.cns = raw.cnsExamination;
    updatedSecSurvey = true;
  } else if (
    systemicNormal &&
    !isValidStr(secSurvey.cns)
  ) {
    secSurvey.cns = EXAM_DEFAULTS.cnsExamination;
    updatedSecSurvey = true;
  }

  // EXTREMITIES
  if (explicitExtremities) {
    secSurvey.extremities = explicitExtremities;
    updatedSecSurvey = true;
  } else if (
    isValidStr(raw.extremitiesExamination) &&
    !isContaminatedExamValue(raw.extremitiesExamination)
  ) {
    secSurvey.extremities = raw.extremitiesExamination;
    updatedSecSurvey = true;
  }

  // Normalize any model-routed Exposure text before committing it. This helper can
  // move abdomen/CNS/general findings out of Exposure without inventing anything.
  const exposureNormalization = normalizeExposureAndSecondarySurvey(
    raw,
    fields,
    secSurvey,
    rawInputText
  );

  if (exposureNormalization.updatedSecSurvey) {
    updatedSecSurvey = true;
  }

  if (isValidStr(raw.exposure)) {
    fields.exposure = raw.exposure;
  } else if (
    abcdeNormal &&
    !isValidStr(existingCaseSheet?.exposure) &&
    !isValidStr(existingCaseSheet?.primaryExposure)
  ) {
    fields.exposure = "No obvious external injuries, rash, or deformities. Normothermic.";
  }

  if (updatedSecSurvey) {
    fields.secondarySurvey = secSurvey;
    console.log(
      "[SCRIBE-SECONDARY-FINAL]",
      JSON.stringify(fields.secondarySurvey)
    );
  }

  const secParts: string[] = [];
  if (secSurvey.general) secParts.push(`General: ${secSurvey.general}`);
  if (secSurvey.cvs) secParts.push(`CVS: ${secSurvey.cvs}`);
  if (secSurvey.respiratory) secParts.push(`RS: ${secSurvey.respiratory}`);
  if (secSurvey.abdomen) secParts.push(`PA: ${secSurvey.abdomen}`);
  if (secSurvey.cns) secParts.push(`CNS: ${secSurvey.cns}`);
  if (secSurvey.extremities) secParts.push(`Extremities: ${secSurvey.extremities}`);
  if (secParts.length > 0) {
    fields.secondaryAssessment = secParts.join("\n");
  }

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
  else if (medPmh.pastHistory === "No past medical history" || medPmh.pastHistory === "Nil") {
    fields.pastMedicalHistory = medPmh.pastHistory;
  }
  if (fields.pastMedicalHistory) {
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      pastHistory: fields.pastMedicalHistory
    };
  }

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
  } else if (medPmh.medications === "Nil regular medications" || medPmh.medications === "Nil") {
    fields.currentMedications = ["Nil regular medications"];
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      medications: "Nil regular medications"
    };
  }

  // Psychological Assessment / Psychiatric Flags
  // Explicit clinician speech only — never accept a model-generated generic "Normal".
  const explicitPsychologicalAssessment = extractExplicitPsychologicalAssessment(rawInputText);

  if (explicitPsychologicalAssessment) {
    fields.psychologicalAssessment = explicitPsychologicalAssessment;
    fields.sampleHistory = {
      ...(fields.sampleHistory || existingCaseSheet?.sampleHistory || {}),
      psychiatricFlags: explicitPsychologicalAssessment
    };
  }

  console.log(
    "[SCRIBE-EXPLICIT-TRACE]",
    JSON.stringify({
      psychologicalAssessment:
        fields.psychologicalAssessment ?? null,

      events:
        fields.sampleHistory?.events ??
        fields.events ??
        null,

      presentingComplaint:
        fields.presentingComplaint ?? null,

      vitals:
        fields.vitals ?? null
    })
  );

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

  // Map clinician factual progress updates & chronological notes
  if (isValidStr(raw.progressNotes)) {
    fields.progressNotes = raw.progressNotes;
  }
  if (Array.isArray(raw.chronologicalNotes) && raw.chronologicalNotes.length > 0) {
    fields.chronologicalNotes = raw.chronologicalNotes;
  }

  // Factual updates are captured as clinicianUpdates ONLY when updating an established case sheet.
  // During initial intake (when there is no established case sheet), the initial transcript goes
  // strictly into the structured case sheet fields, NEVER into progressNotes / clinicianUpdates.
  const hasExistingCase = isEstablishedCaseSheet(existingCaseSheet, Array.isArray(raw?.messages) ? raw.messages : undefined);

  if (hasExistingCase && typeof rawInputText === "string" && rawInputText.trim().length > 0) {
    const trimmedInput = rawInputText.trim();
    if (!/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(trimmedInput)) {
      fields.clinicianUpdateText = trimmedInput;
      fields.clinicianUpdates = [
        {
          text: trimmedInput,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ];
    }
  }

  return fields;
}

function buildUnifiedReplyProse(
  extMsg: ScribeChatMessage | null,
  reasonMsg: ScribeChatMessage
): string {
  let text = "";

  // Extracted details are rendered natively by the UI card, so we don't duplicate them in the markdown prose.

  if (extMsg && extMsg.type === "extraction-confirmation") {
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