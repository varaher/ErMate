import type { ClinicalCase } from "../types";
import {
  normalizeMateBedId,
  isValidMateBedLocation,
} from "./mateBedModel";

/**
 * MATE Case Reference Resolver
 *
 * SINGLE SOURCE OF TRUTH for resolving clinician patient references
 * against existing ErMate cases.
 *
 * This module:
 * - does NOT read Firestore
 * - does NOT write Firestore
 * - does NOT create ClinicalCases
 * - does NOT invent patients
 * - does NOT change activeCaseId
 */

export type MateCaseReferenceStatus =
  | "RESOLVED"
  | "CURRENT_CASE"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "INVALID_LOCATION"
  | "NO_REFERENCE";

export interface MateCaseReferenceResult {
  status: MateCaseReferenceStatus;
  referenceType: "BED" | "CURRENT_CASE" | "NONE";
  referenceValue: string | null;
  caseId: string | null;
  candidateCaseIds: string[];
}

export interface ResolveMateCaseReferenceOptions {
  utterance: string;
  cases: ClinicalCase[];
  activeCaseId?: string | null;
  physicalCapacity?: number | null;
  newCaseIntent?: boolean;
}

/**
 * Extract a candidate bed reference from spoken or typed clinician input.
 *
 * Examples:
 *   "Bed 10"           -> "10"
 *   "Bed 10B"          -> "10B"
 *   "patient in 3"     -> "3"
 *   "3a bp is falling" -> "3A"
 */
export function extractMateBedReference(text: string): string | null {
  if (!text) return null;

  const patterns = [
    /\b(?:bed|bed\s*no\.?|bed\s*number|bed\s*#)\s*([0-9]{1,3}\s*[ab]?)\b/i,
    /\b(?:patient\s+in|pt\s+in)\s+([0-9]{1,3}\s*[ab]?)\b/i,
    /\b([0-9]{1,3}[ab])\b/i,
    /(?:^|\s)b([0-9]{1,3}[ab]?)(?:\s|$|[.,!?])/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const normalized = normalizeMateBedId(match[1]);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Resolve an utterance against existing ErMate cases.
 */
export function resolveMateCaseReference(
  options: ResolveMateCaseReferenceOptions
): MateCaseReferenceResult {
  const { utterance, cases, activeCaseId, physicalCapacity = 30 } = options;

  const bedRef = extractMateBedReference(utterance);

  if (!bedRef) {
    if (activeCaseId) {
      return {
        status: "CURRENT_CASE",
        referenceType: "CURRENT_CASE",
        referenceValue: null,
        caseId: activeCaseId,
        candidateCaseIds: [activeCaseId],
      };
    }

    return {
      status: "NO_REFERENCE",
      referenceType: "NONE",
      referenceValue: null,
      caseId: null,
      candidateCaseIds: [],
    };
  }

  // Bed reference extracted
  const safeCapacity = physicalCapacity || 30;
  if (!isValidMateBedLocation(bedRef, safeCapacity)) {
    return {
      status: "INVALID_LOCATION",
      referenceType: "BED",
      referenceValue: bedRef,
      caseId: null,
      candidateCaseIds: [],
    };
  }

  // Active non-discharged cases matching bed
  const activeCases = (cases || []).filter(
    (c) => c && c.status !== "Discharged"
  );

  const isBedSubdivided = /[AB]$/i.test(bedRef);

  if (isBedSubdivided) {
    // Exact slot: e.g. "10B"
    const exactMatches = activeCases.filter(
      (c) => normalizeMateBedId(c.bedNo) === bedRef
    );

    if (exactMatches.length === 1) {
      return {
        status: "RESOLVED",
        referenceType: "BED",
        referenceValue: bedRef,
        caseId: exactMatches[0].id,
        candidateCaseIds: [exactMatches[0].id],
      };
    }

    if (exactMatches.length > 1) {
      return {
        status: "AMBIGUOUS",
        referenceType: "BED",
        referenceValue: bedRef,
        caseId: null,
        candidateCaseIds: exactMatches.map((c) => c.id),
      };
    }

    return {
      status: "NOT_FOUND",
      referenceType: "BED",
      referenceValue: bedRef,
      caseId: null,
      candidateCaseIds: [],
    };
  }

  // Bare bed number: e.g. "10"
  const bareMatches = activeCases.filter((c) => {
    const norm = normalizeMateBedId(c.bedNo);
    if (!norm) return false;
    return norm === bedRef;
  });

  const slotAMatches = activeCases.filter(
    (c) => normalizeMateBedId(c.bedNo) === `${bedRef}A`
  );
  const slotBMatches = activeCases.filter(
    (c) => normalizeMateBedId(c.bedNo) === `${bedRef}B`
  );

  const allFamilyMatches = [
    ...bareMatches,
    ...slotAMatches,
    ...slotBMatches,
  ];

  if (options.newCaseIntent) {
    // Bed family allocation rules for explicit NEW cases
    const aOccupied = slotAMatches.length > 0;
    const bOccupied = slotBMatches.length > 0;

    if (aOccupied && bOccupied) {
      return {
        status: "AMBIGUOUS",
        referenceType: "BED",
        referenceValue: bedRef,
        caseId: null,
        candidateCaseIds: allFamilyMatches.map((c) => c.id),
      };
    }

    if (!aOccupied && !bOccupied) {
      return {
        status: "NOT_FOUND",
        referenceType: "BED",
        referenceValue: `${bedRef}A`,
        caseId: null,
        candidateCaseIds: [],
      };
    }

    if (aOccupied && !bOccupied) {
      return {
        status: "NOT_FOUND",
        referenceType: "BED",
        referenceValue: `${bedRef}B`,
        caseId: null,
        candidateCaseIds: [],
      };
    }

    if (!aOccupied && bOccupied) {
      return {
        status: "NOT_FOUND",
        referenceType: "BED",
        referenceValue: `${bedRef}A`,
        caseId: null,
        candidateCaseIds: [],
      };
    }
  }

  // Review / lookup for bare bed
  if (allFamilyMatches.length === 1) {
    return {
      status: "RESOLVED",
      referenceType: "BED",
      referenceValue: bedRef,
      caseId: allFamilyMatches[0].id,
      candidateCaseIds: [allFamilyMatches[0].id],
    };
  }

  if (allFamilyMatches.length > 1) {
    return {
      status: "AMBIGUOUS",
      referenceType: "BED",
      referenceValue: bedRef,
      caseId: null,
      candidateCaseIds: allFamilyMatches.map((c) => c.id),
    };
  }

  return {
    status: "NOT_FOUND",
    referenceType: "BED",
    referenceValue: bedRef,
    caseId: null,
    candidateCaseIds: [],
  };
}
