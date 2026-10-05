import type { ClinicalCase } from "../types";
import type { MateIntent, MatePreviewResult } from "./mateContracts";
import { matePediatricRoute } from "./mateContracts";

export interface MateRouterInput {
  text: string;
  activeCase?: ClinicalCase | null;
  patientAgeYears?: number | null;
}

export interface MateRoute {
  intents: MateIntent[];
  primaryIntent: MateIntent;
  requiresActiveCase: boolean;
  targetCapability?: string;
  shouldDocument: boolean;
  reason: string;
}

const containsAny = (text: string, phrases: string[]) =>
  phrases.some((phrase) => text.includes(phrase));

/**
 * V1 routing is deliberately deterministic and conservative.
 * It decides the lane; it does NOT extract or mutate clinical facts.
 */
export function routeMateInput(input: MateRouterInput): MateRoute {
  const raw = input.text.trim();
  const text = raw.toLowerCase();

  if (!raw) {
    return {
      intents: ["QUESTION"],
      primaryIntent: "QUESTION",
      requiresActiveCase: false,
      shouldDocument: false,
      reason: "Empty input has no documentable clinical content.",
    };
  }

  // --------------------------------------------------------
  // SOCIAL / CONVERSATIONAL LANE
  //
  // Bare greetings and acknowledgements are not clinical
  // narratives and must never create/update a patient record.
  //
  // Keep this deliberately narrow. Clinical content must still
  // fall through to the existing safe Scribe extraction path.
  // --------------------------------------------------------
  const normalizedConversation = text
    .replace(/[!?.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const conversationalOnlyPhrases = new Set([
    "hi",
    "hello",
    "hey",
    "hi mate",
    "hello mate",
    "hey mate",
    "good morning",
    "good morning mate",
    "good afternoon",
    "good afternoon mate",
    "good evening",
    "good evening mate",
    "thanks",
    "thank you",
    "thanks mate",
    "thank you mate",
    "ok",
    "okay",
    "ok mate",
    "okay mate",
  ]);

  if (conversationalOnlyPhrases.has(normalizedConversation)) {
    return {
      intents: ["CONVERSATION"],
      primaryIntent: "CONVERSATION",
      requiresActiveCase: false,
      shouldDocument: false,
      reason:
        "Matched a social/conversational turn; do not treat it as clinical documentation.",
    };
  }

  const isRounds = containsAny(text, [
    "review this patient",
    "review the patient",
    "full round",
    "full rounds",
    "quick round",
    "quick rounds",
    "do a round",
    "do rounds",
    "use rounds",
    "7 lens",
    "7-lens",
    "seven lens",
    "what needs attention",
    "important gaps",
  ]);

  if (isRounds) {
    return {
      intents: ["ROUNDS"],
      primaryIntent: "ROUNDS",
      requiresActiveCase: true,
      targetCapability: "case.rounds.review",
      shouldDocument: false,
      reason: "Matched an explicit Clinical Rounds / 7-Lens review request.",
    };
  }

  const isCorrection = containsAny(text, [
    "correction",
    "correct that",
    "change that",
    "i meant",
  ]);

  const isReassessment = containsAny(text, [
    "repeat vitals",
    "repeat bp",
    "repeat blood pressure",
    "now bp",
    "bp is now",
    "now pulse",
    "pulse is now",
    "now saturation",
    "spo2 is now",
    "on reassessment",
    "on re-assessment",
    "reassessment shows",
    "reassessment reveals",
    "reassessment is",
    "reassessment:",
  ]);

  const isExplicitDocument = containsAny(text, [
    "document",
    "add to case sheet",
    "add this to case sheet",
    "add this",
    "record this",
    "note this",
  ]);

  // MATE TRAFFIC-POLICE CAPABILITY RESOLUTION
  //
  // case.open is the first executable vertical slice.
  // It does NOT create a second Case Sheet workflow. The frontend bridge
  // delegates to ErMate's existing Open/Preview Case Sheet behavior.
  const isCaseOpenAction = containsAny(text, [
    "show case sheet",
    "show the case sheet",
    "view case sheet",
    "view the case sheet",
    "open case sheet",
    "open the case sheet",
  ]);

  const isAppAction =
    isCaseOpenAction ||
    containsAny(text, [
      "show investigations",
      "open investigations",
      "show treatment",
      "open treatment",
      "prepare discharge",
      "show discharge",
    ]);

  if (isAppAction && !isExplicitDocument) {
    return {
      intents: ["APP_ACTION"],
      primaryIntent: "APP_ACTION",
      requiresActiveCase: true,
      targetCapability: isCaseOpenAction ? "case.open" : undefined,
      shouldDocument: false,
      reason: isCaseOpenAction
        ? "Matched the existing ErMate Case Sheet open workflow."
        : "Matched an ErMate navigation/workflow action without a documentation request.",
    };
  }

  if (isCorrection) {
    return {
      intents: ["CORRECTION"],
      primaryIntent: "CORRECTION",
      requiresActiveCase: true,
      shouldDocument: true,
      reason: "Matched a correction to the active clinical record.",
    };
  }

  if (isReassessment) {
    return {
      intents: ["REASSESSMENT"],
      primaryIntent: "REASSESSMENT",
      requiresActiveCase: true,
      shouldDocument: true,
      reason: "Matched a repeat/reassessment statement; chronology must be preserved.",
    };
  }

  if (isExplicitDocument) {
    return {
      intents: ["DOCUMENT_FACT"],
      primaryIntent: "DOCUMENT_FACT",
      requiresActiveCase: true,
      shouldDocument: true,
      reason: "Clinician explicitly requested documentation.",
    };
  }

  const looksLikeQuestion = /\?$/.test(raw) || /^(why|what|when|where|which|how|can|could|should|would|is|are|do|does)\b/i.test(raw);
  if (looksLikeQuestion) {
    return {
      intents: ["QUESTION"],
      primaryIntent: "QUESTION",
      requiresActiveCase: false,
      shouldDocument: false,
      reason: "Clinical discussion/question lane; answers are not documentation by default.",
    };
  }

  return {
    intents: ["CLINICAL_NARRATIVE"],
    primaryIntent: "CLINICAL_NARRATIVE",
    requiresActiveCase: false,
    shouldDocument: true,
    reason: "Free-flowing clinical narrative; send to the safe extraction preview pipeline.",
  };
}

/**
 * Produces the empty PREVIEW envelope used before clinical extraction is wired.
 * No ClinicalCase mutation occurs here.
 */
export function createMatePreview(input: MateRouterInput): MatePreviewResult {
  const route = routeMateInput(input);
  const caseId = input.activeCase?.id ?? null;

  return {
    executionMode: "PREVIEW",
    caseId,
    isPediatric: matePediatricRoute(input.patientAgeYears),
    intents: route.intents,
    proposedFacts: [],
    blockedFacts: [],
    questions:
      route.requiresActiveCase && !caseId
        ? ["Please open or start the patient case first."]
        : [],
    appActions: route.targetCapability ? [route.targetCapability] : [],
  };
}
