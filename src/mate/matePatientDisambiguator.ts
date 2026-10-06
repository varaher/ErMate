/**
 * ErMate — Deterministic Patient Reference Disambiguation & Resolution
 *
 * Resolves patient references from:
 * - BED (e.g. "15", "10B", "Bed 9")
 * - DISPLAY_ID (e.g. "261006004", "C-2976")
 * - CURRENT (activeCaseId)
 * - RECENT (lastReferencedCaseId)
 * - LIST_INDEX (e.g. 2 -> second case from lastPresentedCaseIds)
 * - NONE
 *
 * Invariants:
 * 1. Model output is UNTRUSTED: never trusts arbitrary UUIDs or model-supplied identities.
 * 2. Ambiguity fails closed: if Bed 11 is queried and 11A and 11B are both active,
 *    returns AMBIGUOUS with candidate cases and a clean clarification prompt.
 * 3. Never writes to Firestore or mutates ClinicalCase.
 */

import type { ClinicalCase } from "../types";
import type { MatePatientReference } from "./mateInterpretationTypes";
import { resolveMateCaseReference } from "./mateCaseResolver";
import { resolveMateCaseByDisplayId } from "./mateCaseDisplayResolver";

export interface ResolvedPatientResult {
  status: "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND" | "NO_REFERENCE";
  matchedCase: ClinicalCase | null;
  caseId: string | null;
  bedNo: string | null;
  candidateCases: ClinicalCase[];
  clarificationMessage?: string;
}

export function resolveInterpretedPatient(params: {
  reference?: MatePatientReference | null;
  activeCase?: ClinicalCase | null;
  recentCase?: ClinicalCase | null;
  censusCases: ClinicalCase[];
  lastPresentedCaseIds?: string[];
  physicalCapacity?: number;
}): ResolvedPatientResult {
  const {
    reference,
    activeCase,
    recentCase,
    censusCases,
    lastPresentedCaseIds = [],
    physicalCapacity = 30,
  } = params;

  if (!reference || reference.type === "NONE") {
    // If clinician utterance had no explicit reference, fall back to active or recent case if present
    if (activeCase) {
      return {
        status: "RESOLVED",
        matchedCase: activeCase,
        caseId: activeCase.id,
        bedNo: activeCase.bedNo || null,
        candidateCases: [activeCase],
      };
    }
    if (recentCase) {
      return {
        status: "RESOLVED",
        matchedCase: recentCase,
        caseId: recentCase.id,
        bedNo: recentCase.bedNo || null,
        candidateCases: [recentCase],
      };
    }
    return {
      status: "NO_REFERENCE",
      matchedCase: null,
      caseId: null,
      bedNo: null,
      candidateCases: [],
    };
  }

  // 1. LIST_INDEX reference ("Open the second one", index = 2 or relativeIndex = 2)
  if (reference.type === "LIST_INDEX") {
    const rawVal = Number(reference.value);
    const index = !isNaN(rawVal) ? rawVal - 1 : -1; // 1-indexed to 0-indexed
    if (index >= 0 && index < lastPresentedCaseIds.length) {
      const targetId = lastPresentedCaseIds[index];
      const found = censusCases.find((c) => c.id === targetId);
      if (found) {
        return {
          status: "RESOLVED",
          matchedCase: found,
          caseId: found.id,
          bedNo: found.bedNo || null,
          candidateCases: [found],
        };
      }
    }
    return {
      status: "NOT_FOUND",
      matchedCase: null,
      caseId: null,
      bedNo: null,
      candidateCases: [],
      clarificationMessage: "The numbered patient from the recent list was not found. Please specify the bed number.",
    };
  }

  // 2. DISPLAY_ID reference
  if (reference.type === "DISPLAY_ID") {
    const displayVal = String(reference.value || "").trim();
    const res = resolveMateCaseByDisplayId(displayVal, censusCases);
    if (res.status === "RESOLVED" && res.matchedCase) {
      return {
        status: "RESOLVED",
        matchedCase: res.matchedCase,
        caseId: res.matchedCase.id,
        bedNo: res.matchedCase.bedNo || null,
        candidateCases: [res.matchedCase],
      };
    }
    if (res.status === "AMBIGUOUS") {
      return {
        status: "AMBIGUOUS",
        matchedCase: null,
        caseId: null,
        bedNo: null,
        candidateCases: [],
        clarificationMessage: `Multiple cases match reference "${displayVal}". Please specify the exact bed or full case number.`,
      };
    }
    return {
      status: "NOT_FOUND",
      matchedCase: null,
      caseId: null,
      bedNo: null,
      candidateCases: [],
      clarificationMessage: `Case "${displayVal}" was not found in active records.`,
    };
  }

  // 3. BED reference
  if (reference.type === "BED") {
    const bedVal = String(reference.value || "").trim();
    const res = resolveMateCaseReference({
      utterance: `Bed ${bedVal}`,
      cases: censusCases,
      activeCaseId: activeCase?.id || null,
      physicalCapacity,
    });

    if (res.status === "RESOLVED" && res.caseId) {
      const matched = censusCases.find((c) => c.id === res.caseId) || null;
      return {
        status: "RESOLVED",
        matchedCase: matched,
        caseId: res.caseId,
        bedNo: matched?.bedNo || bedVal,
        candidateCases: matched ? [matched] : [],
      };
    }

    if (res.status === "AMBIGUOUS") {
      const candidates = censusCases.filter((c) => res.candidateCaseIds.includes(c.id));
      const bedNames = candidates.map((c) => c.bedNo || "Slot").join(" or ");
      return {
        status: "AMBIGUOUS",
        matchedCase: null,
        caseId: null,
        bedNo: bedVal,
        candidateCases: candidates,
        clarificationMessage: `Do you mean Bed ${bedNames}?`,
      };
    }

    return {
      status: "NOT_FOUND",
      matchedCase: null,
      caseId: null,
      bedNo: bedVal,
      candidateCases: [],
      clarificationMessage: `Bed ${bedVal} is currently vacant (no active patient record).`,
    };
  }

  // 4. CURRENT reference
  if (reference.type === "CURRENT") {
    if (activeCase) {
      return {
        status: "RESOLVED",
        matchedCase: activeCase,
        caseId: activeCase.id,
        bedNo: activeCase.bedNo || null,
        candidateCases: [activeCase],
      };
    }
  }

  // 5. RECENT reference
  if (reference.type === "RECENT" || !reference.type) {
    const target = recentCase || activeCase;
    if (target) {
      return {
        status: "RESOLVED",
        matchedCase: target,
        caseId: target.id,
        bedNo: target.bedNo || null,
        candidateCases: [target],
      };
    }
  }

  return {
    status: "NO_REFERENCE",
    matchedCase: null,
    caseId: null,
    bedNo: null,
    candidateCases: [],
  };
}
