import type { ClinicalCase } from "../src/types";
import {
  type MateEvidenceState,
  type MatePreviewResult,
  type MateProposedFact,
  matePediatricRoute,
} from "../src/mate/mateContracts";
import { routeMateInput } from "../src/mate/mateRouter";
import { extractFromTranscript } from "./voiceExtraction.ts";
import { cleanExtractionOutput } from "./extractionCleanup.ts";
import { mapExtractionToCaseSheetFields } from "./scribeChatTurn.ts";

export interface MatePreviewInterpreterInput {
  transcript: string;
  activeCase?: ClinicalCase | null;
  patientAgeYears?: number | null;
}

export interface MateExtractionPreview extends MatePreviewResult {
  extracted: Record<string, unknown>;
  mappedFields: Record<string, unknown>;
  warnings: string[];
}

const isMeaningful = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isMeaningful);
  return true;
};

function flattenMappedFields(
  value: unknown,
  path = "",
  out: Array<{ path: string; value: unknown }> = [],
): Array<{ path: string; value: unknown }> {
  if (!isMeaningful(value)) return out;

  if (Array.isArray(value)) {
    if (value.length) out.push({ path, value });
    return out;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flattenMappedFields(child, path ? `${path}.${key}` : key, out);
    }
    return out;
  }

  out.push({ path, value });
  return out;
}

function evidenceStateFor(value: unknown): MateEvidenceState {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^(unknown|not known|not available|not identified|undetermined)$/i.test(text)) {
    return "EXPLICIT_UNKNOWN";
  }
  if (/^(no|none|negative|absent|denied)$/i.test(text) || /^no\s+/i.test(text)) {
    return "EXPLICIT_NEGATIVE";
  }
  return "EXPLICIT_POSITIVE";
}

function buildPreviewFacts(mappedFields: Record<string, unknown>): MateProposedFact[] {
  return flattenMappedFields(mappedFields).map(({ path, value }, index) => ({
    id: `mate-preview-${index + 1}`,
    state: evidenceStateFor(value),
    destination: path,
    value,
    // V1 deliberately attributes model-mapped fields to the clinician's source
    // transcript as a whole. Exact-span evidence will be added before WRITE mode.
    evidence: {
      text: "[source transcript]",
      speakerRole: "doctor",
      informationSource: "clinician_dictation",
    },
    requiresClarification: false,
  }));
}

function detectPreviewWarnings(
  transcript: string,
  mappedFields: Record<string, unknown>,
): string[] {
  const warnings: string[] = [];
  const lower = transcript.toLowerCase();

  // Partial GCS protection. The existing mapper may expose components; PREVIEW
  // must warn whenever the source does not support a complete E/V/M set.
  const hasE = /\be\s*[1-4]\b/i.test(transcript);
  const hasV = /\bv\s*[1-5]\b/i.test(transcript);
  const hasM = /\bm\s*[1-6]\b/i.test(transcript);
  const mentionsGcs = /\bgcs\b/i.test(transcript);
  if (mentionsGcs && !(hasE && hasV && hasM)) {
    warnings.push("GCS is incomplete in the source transcript; missing components/total must not be inferred.");
  }

  // A deliberately narrow contradiction detector for a common high-risk class.
  // It does not resolve the conflict; it only blocks silent normalization later.
  const tempMatch = lower.match(/(?:temperature|temp)\s*(?:is|of|:)??\s*(\d+(?:\.\d+)?)/i);
  if (tempMatch && /\b(pyrexia|febrile|fever)\b/i.test(lower)) {
    const numeric = Number(tempMatch[1]);
    const fahrenheitLikely = numeric > 60;
    const afebrileMeasurement = fahrenheitLikely ? numeric < 100.4 : numeric < 38;
    if (afebrileMeasurement) {
      warnings.push("Possible temperature conflict: an afebrile numeric temperature and fever/pyrexia were both dictated. Clarify before WRITE mode.");
    }
  }

  // Preserve unknowns. This warning makes the preview visibly auditable when a
  // narrative says an agent/quantity/etc. is unknown.
  if (/\b(?:unknown|not known|not identified|undetermined)\b/i.test(lower)) {
    warnings.push("Source contains explicit unknown/undetermined information; MATE must preserve it and must not infer a value.");
  }

  // Defensive sanity check: PREVIEW should expose what the existing mapper
  // actually proposes, never silently claim success with an empty map.
  if (!isMeaningful(mappedFields)) {
    warnings.push("Existing ErMate extraction produced no mapped Case Sheet fields for this turn.");
  }

  return warnings;
}

/**
 * MATE V1 PREVIEW interpreter.
 *
 * Reuses ErMate's canonical extraction + cleanup + Scribe mapping pipeline.
 * It DOES NOT save, patch, mutate, or persist ClinicalCase data.
 */
export async function interpretMatePreview(
  input: MatePreviewInterpreterInput,
): Promise<MateExtractionPreview> {
  const route = routeMateInput({
    text: input.transcript,
    activeCase: input.activeCase,
    patientAgeYears: input.patientAgeYears,
  });

  const caseId = input.activeCase?.id ?? null;
  const initialRoute = matePediatricRoute(input.patientAgeYears);

  // Non-document lanes never invoke clinical extraction here.
  if (!route.shouldDocument) {
    return {
      executionMode: "PREVIEW",
      caseId,
      isPediatric: initialRoute,
      intents: route.intents,
      proposedFacts: [],
      blockedFacts: [],
      questions: route.requiresActiveCase && !caseId ? ["Please open or start the patient case first."] : [],
      appActions: route.targetCapability ? [route.targetCapability] : [],
      extracted: {},
      mappedFields: {},
      warnings: [],
    };
  }

  const raw = await extractFromTranscript(input.transcript);
  const cleaned = cleanExtractionOutput(raw as any);
  const existingCaseSheet = (input.activeCase as any)?.caseSheet ?? input.activeCase ?? {};
  const mapped = mapExtractionToCaseSheetFields(
    cleaned as any,
    raw as any,
    existingCaseSheet,
    input.transcript,
  ) as Record<string, unknown>;

  const extractedAgeRaw = (raw as any)?.age ?? (cleaned as any)?.age;
  const extractedAge = extractedAgeRaw !== null && extractedAgeRaw !== undefined && extractedAgeRaw !== ""
    ? Number(extractedAgeRaw)
    : null;
  const resolvedAge = Number.isFinite(extractedAge as number)
    ? (extractedAge as number)
    : input.patientAgeYears;

  const warnings = detectPreviewWarnings(input.transcript, mapped);
  const proposedFacts = buildPreviewFacts(mapped);

  // Until exact evidence spans are implemented, warnings are surfaced but facts
  // are not auto-blocked solely by heuristic text matching. WRITE mode remains
  // disabled, so no patient record can be changed from this preview.
  return {
    executionMode: "PREVIEW",
    caseId,
    isPediatric: matePediatricRoute(resolvedAge),
    intents: route.intents,
    proposedFacts,
    blockedFacts: [],
    questions: warnings.map((warning) => warning),
    appActions: route.targetCapability ? [route.targetCapability] : [],
    extracted: (raw ?? {}) as Record<string, unknown>,
    mappedFields: mapped ?? {},
    warnings,
  };
}
