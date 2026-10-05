import type { ClinicalCase } from "../types";
import {
  normalizeMateBedId,
  isValidMateBedLocation,
} from "./mateBedModel";

/**
 * MATE Case Reference Resolver
 *
 * SINGLE SOURCE OF TRUTH for resolving clinician patient references
 * against ErMate's EXISTING ClinicalCases.
 *
 * This is part of MATE's traffic-police layer.
 *
 * This module does NOT:
 * - create a ClinicalCase
 * - mutate a ClinicalCase
 * - write to Firestore
 * - navigate the UI
 * - perform clinical extraction
 *
 * It only resolves patient context.
 */

export type MateCaseReferenceType =
  | "BED"
  | "CURRENT_CASE"
  | "NONE";

export type MateCaseResolution =
  | {
      status: "RESOLVED";
      referenceType: "BED";
      referenceValue: string;
      caseId: string;
    }
  | {
      status: "CURRENT_CASE";
      referenceType: "CURRENT_CASE";
      referenceValue: null;
      caseId: string;
    }
  | {
      /**
       * Explicit, valid ER location with no active ClinicalCase.
       *
       * IMPORTANT:
       * This does NOT create a patient.
       * The caller may decide whether the clinician's command means
       * "start a new patient/case at this location".
       */
      status: "NOT_FOUND";
      referenceType: "BED";
      referenceValue: string;
      caseId: null;
    }
  | {
      status: "AMBIGUOUS";
      referenceType: "BED";
      referenceValue: string;
      caseId: null;
      candidateCaseIds: string[];
    }
  | {
      status: "INVALID_LOCATION";
      referenceType: "BED";
      referenceValue: string;
      caseId: null;
    }
  | {
      status: "NO_REFERENCE";
      referenceType: "NONE";
      referenceValue: null;
      caseId: null;
    };

export interface MateCaseResolverInput {
  utterance: string;
  cases: ClinicalCase[];
  activeCaseId?: string | null;

  /**
   * True only when the clinician explicitly asked to establish a
   * new patient/case. This changes how a bare physical bed number
   * such as "Bed 11" is interpreted:
   *
   * - ordinary reference -> resolve existing 11A/11B occupant
   * - new case reference -> allocate the first safe free slot
   */
  newCaseIntent?: boolean;

  /**
   * Hospital's configured physical ER bed capacity.
   *
   * When supplied, an explicit bed reference must belong to the
   * canonical MATE bed/location model.
   */
  physicalCapacity?: number | null;
}

/**
 * Extract an EXPLICIT bed reference.
 *
 * Examples:
 *   "bed 3"             -> "3"
 *   "bed 3a"            -> "3A"
 *   "bed no 4"          -> "4"
 *   "bed number 15b"    -> "15B"
 *
 * Deliberately conservative:
 * age numbers, BP values, dates, GCS, doses and times must never
 * become bed references merely because a number appeared.
 */
export function extractMateBedReference(
  utterance: string
): string | null {
  if (!utterance) return null;

  const text = utterance.trim();

  const explicitBedMatch = text.match(
    /\bbed(?:\s*(?:number|no\.?|#))?\s*[-:]?\s*0*(\d+)\s*([ab])?\b/i
  );

  if (explicitBedMatch) {
    const subdivision =
      (explicitBedMatch[2] || "").toUpperCase();

    return normalizeMateBedId(
      `${Number(explicitBedMatch[1])}${subdivision}`
    );
  }

  /*
   * Safe shorthand for explicit subdivided ER locations.
   *
   * Accepted:
   *   10B
   *   10b
   *   10 B
   *   10 b
   *   "is 10B occupied?"
   *
   * A bare number without A/B is deliberately NOT accepted.
   * This protects ages, BP values, dates, doses, GCS values, etc.
   */
  const bareSubdivisionMatch = text.match(
    /\b0*(\d+)\s*([ab])\b/i
  );

  if (!bareSubdivisionMatch) return null;

  return normalizeMateBedId(
    `${Number(bareSubdivisionMatch[1])}${bareSubdivisionMatch[2].toUpperCase()}`
  );
}

/**
 * Resolve an explicit patient/case reference against existing ErMate cases.
 *
 * Safety rules:
 *
 * 1. Explicit bed reference takes priority over conversational context.
 * 2. When physical capacity is known, invalid locations fail closed.
 * 3. Discharged cases are not ordinary active-bed candidates.
 * 4. Exactly one active match -> RESOLVED.
 * 5. Multiple active matches -> AMBIGUOUS. Never guess.
 * 6. Explicit valid bed but no active case -> NOT_FOUND.
 * 7. No explicit reference + valid activeCaseId -> CURRENT_CASE.
 * 8. Otherwise -> NO_REFERENCE.
 *
 * NOT_FOUND is intentionally NOT case creation.
 * Creation remains owned by ErMate's existing case workflow.
 */
export function resolveMateCaseReference(
  input: MateCaseResolverInput
): MateCaseResolution {
  const bedReference =
    extractMateBedReference(input.utterance);

  if (bedReference) {
    const capacity =
      input.physicalCapacity !== null &&
      input.physicalCapacity !== undefined
        ? Number(input.physicalCapacity)
        : null;

    if (
      capacity !== null &&
      Number.isFinite(capacity) &&
      capacity > 0 &&
      !isValidMateBedLocation(
        bedReference,
        capacity
      )
    ) {
      return {
        status: "INVALID_LOCATION",
        referenceType: "BED",
        referenceValue: bedReference,
        caseId: null,
      };
    }

    const explicitSubdivision = /[AB]$/i.test(bedReference);
    const baseBedReference = bedReference.replace(/[AB]$/i, "");

    const activeCases = input.cases.filter(
      (clinicalCase) => clinicalCase.status !== "Discharged"
    );

    const normalizedActiveCases = activeCases
      .map((clinicalCase) => ({
        clinicalCase,
        bed: normalizeMateBedId(clinicalCase.bedNo),
      }))
      .filter(
        (
          item
        ): item is {
          clinicalCase: ClinicalCase;
          bed: string;
        } => Boolean(item.bed)
      );

    /*
     * NEW PATIENT + BARE BED
     *
     * "Bed 11" means physical bed-family 11.
     *
     * Canonical new occupancy slots are:
     *   11A
     *   11B
     *
     * Legacy plain "11" cases are preserved and treated as occupying
     * the A-side for allocation purposes. We never rename them here.
     */
    if (input.newCaseIntent && !explicitSubdivision) {
      const aOccupied = normalizedActiveCases.some(
        ({ bed }) =>
          bed === baseBedReference ||
          bed === `${baseBedReference}A`
      );

      const bOccupied = normalizedActiveCases.some(
        ({ bed }) => bed === `${baseBedReference}B`
      );

      if (!aOccupied) {
        return {
          status: "NOT_FOUND",
          referenceType: "BED",
          referenceValue: `${baseBedReference}A`,
          caseId: null,
        };
      }

      if (!bOccupied) {
        return {
          status: "NOT_FOUND",
          referenceType: "BED",
          referenceValue: `${baseBedReference}B`,
          caseId: null,
        };
      }

      return {
        status: "AMBIGUOUS",
        referenceType: "BED",
        referenceValue: baseBedReference,
        caseId: null,
        candidateCaseIds: normalizedActiveCases
          .filter(
            ({ bed }) =>
              bed === baseBedReference ||
              bed === `${baseBedReference}A` ||
              bed === `${baseBedReference}B`
          )
          .map(({ clinicalCase }) => clinicalCase.id),
      };
    }

    /*
     * Existing-patient lookup:
     *
     * Explicit "11A" / "11B" stays exact.
     * Bare "11" searches the complete physical bed-family.
     */
    const candidates = normalizedActiveCases
      .filter(({ bed }) => {
        if (explicitSubdivision) {
          return bed === bedReference;
        }

        return (
          bed === baseBedReference ||
          bed === `${baseBedReference}A` ||
          bed === `${baseBedReference}B`
        );
      })
      .map(({ clinicalCase }) => clinicalCase);

    /*
     * NEW PATIENT + EXPLICIT SLOT
     *
     * If the doctor explicitly said "Bed 11B", never silently switch
     * to another slot.
     *
     * Free explicit slot -> NOT_FOUND so the caller may create there.
     * Occupied explicit slot -> AMBIGUOUS/fail closed so the existing
     * patient can never be selected as the new patient's context.
     */
    if (input.newCaseIntent && explicitSubdivision) {
      if (candidates.length === 0) {
        return {
          status: "NOT_FOUND",
          referenceType: "BED",
          referenceValue: bedReference,
          caseId: null,
        };
      }

      return {
        status: "AMBIGUOUS",
        referenceType: "BED",
        referenceValue: bedReference,
        caseId: null,
        candidateCaseIds: candidates.map((c) => c.id),
      };
    }

    if (candidates.length === 1) {
      return {
        status: "RESOLVED",
        referenceType: "BED",
        referenceValue: bedReference,
        caseId: candidates[0].id,
      };
    }

    if (candidates.length > 1) {
      return {
        status: "AMBIGUOUS",
        referenceType: "BED",
        referenceValue: bedReference,
        caseId: null,
        candidateCaseIds:
          candidates.map((c) => c.id),
      };
    }

    return {
      status: "NOT_FOUND",
      referenceType: "BED",
      referenceValue: bedReference,
      caseId: null,
    };
  }

  if (
    input.activeCaseId &&
    input.cases.some(
      (clinicalCase) =>
        clinicalCase.id === input.activeCaseId &&
        clinicalCase.status !== "Discharged"
    )
  ) {
    return {
      status: "CURRENT_CASE",
      referenceType: "CURRENT_CASE",
      referenceValue: null,
      caseId: input.activeCaseId,
    };
  }

  return {
    status: "NO_REFERENCE",
    referenceType: "NONE",
    referenceValue: null,
    caseId: null,
  };
}
