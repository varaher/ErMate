/**
 * ErMate — MATE Display ID Case Resolver
 *
 * Deterministically resolves spoken or typed case number references:
 * - 9-digit monotonic daily displayId (YYMMDD###, e.g. "261006004")
 * - Legacy case numbers (e.g. "C-2976")
 *
 * Invariants:
 * 1. Strictly isolated from bed parsing: does NOT alter mateBedModel.ts or mateCaseResolver.ts.
 * 2. Never matches internal UUIDs approximately.
 * 3. Never chooses between multiple matches silently (fails closed with AMBIGUOUS).
 */

import { ClinicalCase } from "../types";

export interface MateDisplayIdResolution {
  status: "RESOLVED" | "NOT_FOUND" | "AMBIGUOUS";
  caseId: string | null;
  matchedCase: ClinicalCase | null;
  referenceValue: string | null;
}

/**
 * Extracts a candidate displayId or legacy case number from clinician input.
 *
 * Examples:
 *   "case 261006004"          -> "261006004"
 *   "case number 261006004"   -> "261006004"
 *   "open 261006004"          -> "261006004"
 *   "case C-2976"             -> "C-2976"
 *   "C-2976"                  -> "C-2976"
 */
export function extractMateDisplayIdReference(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Matches 9-digit daily sequence: YYMMDD### (e.g. 261006004)
  const displayIdMatch =
    trimmed.match(/\b(?:case|case\s*(?:no\.?|number|id|#)?|open)\s*([0-9]{9})\b/i) ||
    trimmed.match(/\b([0-9]{9})\b/);

  if (displayIdMatch && displayIdMatch[1]) {
    return displayIdMatch[1];
  }

  // 2. Matches legacy case ID: C-xxxx
  const legacyMatch = trimmed.match(
    /\b(?:case|case\s*(?:no\.?|number|id|#)?|open)?\s*(C-[0-9]{4,6})\b/i
  );
  if (legacyMatch && legacyMatch[1]) {
    return legacyMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Resolves an extracted case reference against the active census / allCases.
 */
export function resolveMateCaseByDisplayId(
  reference: string | null,
  cases: ClinicalCase[]
): MateDisplayIdResolution {
  if (!reference || !cases || cases.length === 0) {
    return { status: "NOT_FOUND", caseId: null, matchedCase: null, referenceValue: reference };
  }

  const normalized = reference.trim().toUpperCase();

  // Exact match against displayId or legacy C-xxxx id
  const matches = cases.filter(
    (c) =>
      c &&
      ((c.displayId && c.displayId.trim() === normalized) ||
        (c.id && c.id.toUpperCase().trim() === normalized))
  );

  if (matches.length === 1) {
    return {
      status: "RESOLVED",
      caseId: matches[0].id,
      matchedCase: matches[0],
      referenceValue: normalized,
    };
  }

  if (matches.length > 1) {
    return {
      status: "AMBIGUOUS",
      caseId: null,
      matchedCase: null,
      referenceValue: normalized,
    };
  }

  return {
    status: "NOT_FOUND",
    caseId: null,
    matchedCase: null,
    referenceValue: normalized,
  };
}
