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
    "not ",
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
    "reassessment",
    "on reassessment",
  ]);

  const isExplicitDocument = containsAny(text, [
    "document",
    "add to case sheet",
    "add this to case sheet",
    "add this",
    "record this",
    "note this",
  ]);

  const isAppAction = containsAny(text, [
    "show case sheet",
    "view case sheet",
    "open case sheet",
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
      shouldDocument: false,
      reason: "Matched an ErMate navigation/workflow action without a documentation request.",
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
