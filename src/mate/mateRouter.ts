import type { ClinicalCase } from "../types";
import type { MateIntent, MatePreviewResult } from "./mateContracts";
import { matePediatricRoute } from "./mateContracts";

export interface MateRouterInput {
  text: string;
  activeCase?: ClinicalCase | null;
  patientAgeYears?: number | null;
}

export interface MateRoute {
  primaryIntent: MateIntent;
  requiresActiveCase: boolean;
  shouldDocument: boolean;
  isPediatric: boolean;
  targetCapability?: string;
  notes: string[];
}

const SOCIAL_PHRASES = [
  /^hi\b/i,
  /^hello\b/i,
  /^hey\b/i,
  /^good\s+(morning|afternoon|evening)\b/i,
  /^thanks?\b/i,
  /^thank\s+you\b/i,
  /^ok\b/i,
  /^okay\b/i,
  /^cool\b/i,
];

const QUESTION_WORDS = [
  /\bwhat\b/i,
  /\bhow\b/i,
  /\bwhy\b/i,
  /\bwhen\b/i,
  /\bwhere\b/i,
  /\bwhich\b/i,
  /\bwho\b/i,
  /\bcan\s+you\b/i,
  /\bcould\s+you\b/i,
];

const ROUNDS_WORDS = [
  /\brounds\b/i,
  /\bdebrief\b/i,
  /\bdevil'?s?\s+advocate\b/i,
  /\bfirst\s+principles\b/i,
  /\brare\s+but\s+real\b/i,
  /\bpathophysiology\b/i,
  /\bguidelines?\b/i,
  /\bdisease\s+snapshot\b/i,
];

const EXPLICIT_DOCUMENT_TRIGGERS = [
  /\bdocument\b/i,
  /\brecord\b/i,
  /\bnote\b/i,
  /\bwrite\s+down\b/i,
  /\badd\s+to\s+chart\b/i,
  /\badd\s+to\s+case\s*sheet\b/i,
  /\bupdate\s+case\s*sheet\b/i,
  /\bput\s+in\s+notes\b/i,
];

const REASSESSMENT_TRIGGERS = [
  /\bnow\b/i,
  /\brepeat\b/i,
  /\breassessed\b/i,
  /\breassessment\b/i,
  /\bimproved\b/i,
  /\bworsened\b/i,
  /\bpost-?\s*medication\b/i,
  /\bpost-?\s*treatment\b/i,
  /\bpost-?\s*nebulization\b/i,
  /\bpost-?\s*procedure\b/i,
];

const CORRECTION_TRIGGERS = [
  /\bcorrection\b/i,
  /\bmistake\b/i,
  /\bactually\b/i,
  /\bnot\s+[a-z0-9]+\s*,\s*it'?s?\b/i,
  /\bchange\s+[a-z\s]+\s+to\b/i,
  /\berror\b/i,
];

const ACTION_TRIGGERS = [
  /\bopen\s+case\s*sheet\b/i,
  /\bview\s+case\s*sheet\b/i,
  /\bopen\s+chart\b/i,
  /\bdischarge\s+summary\b/i,
];

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Route a clinician utterance into the appropriate MATE lane.
 */
export function routeMateInput(input: MateRouterInput): MateRoute {
  const { text, activeCase, patientAgeYears } = input;
  const trimmed = text.trim();
  const notes: string[] = [];

  const effectiveAge =
    patientAgeYears ?? activeCase?.patient?.age ?? null;
  const pediatricCheck = matePediatricRoute(effectiveAge);
  notes.push(pediatricCheck.reason);

  // 1. Social lane
  if (containsAny(trimmed, SOCIAL_PHRASES) && trimmed.split(/\s+/).length <= 4) {
    return {
      primaryIntent: "CONVERSATION",
      requiresActiveCase: false,
      shouldDocument: false,
      isPediatric: pediatricCheck.isPediatric,
      notes: [...notes, "Social / greeting lane: read-only"],
    };
  }

  // 2. Explicit action commands
  if (containsAny(trimmed, ACTION_TRIGGERS)) {
    let capability = "case.open";
    if (/rounds/i.test(trimmed)) capability = "case.rounds.review";
    return {
      primaryIntent: "APP_ACTION",
      requiresActiveCase: true,
      shouldDocument: false,
      isPediatric: pediatricCheck.isPediatric,
      targetCapability: capability,
      notes: [...notes, `Action trigger: dispatching ${capability}`],
    };
  }

  // 3. Rounds review lane
  if (containsAny(trimmed, ROUNDS_WORDS)) {
    return {
      primaryIntent: "ROUNDS",
      requiresActiveCase: true,
      shouldDocument: false,
      isPediatric: pediatricCheck.isPediatric,
      targetCapability: "case.rounds.review",
      notes: [...notes, "Rounds review lane: read-only, non-destructive"],
    };
  }

  // 4. Corrections lane
  if (containsAny(trimmed, CORRECTION_TRIGGERS) && activeCase) {
    return {
      primaryIntent: "CORRECTION",
      requiresActiveCase: true,
      shouldDocument: true,
      isPediatric: pediatricCheck.isPediatric,
      notes: [...notes, "Correction to active case sheet: requires confirmation"],
    };
  }

  // 5. Reassessment lane
  if (containsAny(trimmed, REASSESSMENT_TRIGGERS) && activeCase) {
    return {
      primaryIntent: "REASSESSMENT",
      requiresActiveCase: true,
      shouldDocument: true,
      isPediatric: pediatricCheck.isPediatric,
      notes: [...notes, "Reassessment timeline update"],
    };
  }

  // 6. Explicit documentation request
  if (containsAny(trimmed, EXPLICIT_DOCUMENT_TRIGGERS)) {
    return {
      primaryIntent: "DOCUMENT_FACT",
      requiresActiveCase: false,
      shouldDocument: true,
      isPediatric: pediatricCheck.isPediatric,
      notes: [...notes, "Explicit documentation requested"],
    };
  }

  // 7. Clinical Question / Discussion lane
  if (containsAny(trimmed, QUESTION_WORDS) || trimmed.endsWith("?")) {
    return {
      primaryIntent: "QUESTION",
      requiresActiveCase: false,
      shouldDocument: false,
      isPediatric: pediatricCheck.isPediatric,
      notes: [...notes, "Clinical consultation question: read-only"],
    };
  }

  // 8. Default: Clinical narrative
  return {
    primaryIntent: "CLINICAL_NARRATIVE",
    requiresActiveCase: false,
    shouldDocument: true,
    isPediatric: pediatricCheck.isPediatric,
    notes: [...notes, "Clinical dictation narrative for Scribe extraction"],
  };
}

/**
 * Generate a non-destructive PREVIEW envelope for an utterance.
 */
export function createMatePreview(
  input: MateRouterInput,
  route: MateRoute
): MatePreviewResult {
  const envelope = {
    mode: "PREVIEW" as const,
    intent: route.primaryIntent,
    caseId: input.activeCase?.id || null,
    bedNo: input.activeCase?.bedNo || null,
    pediatric: route.isPediatric,
    unappliedExtraction: {},
    provenance: {},
    requiresConfirmation:
      route.primaryIntent === "CORRECTION" ||
      route.primaryIntent === "DOCUMENT_FACT",
    notes: route.notes,
  };

  const reasonsBlocked: string[] = [];
  if (route.requiresActiveCase && !input.activeCase) {
    reasonsBlocked.push("Capability requires an active patient case context.");
  }

  return {
    envelope,
    canApply: reasonsBlocked.length === 0 && route.shouldDocument,
    reasonsBlocked,
  };
}
