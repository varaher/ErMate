/**
 * ErMate / MATE — Canonical ER Bed Model
 *
 * PURPOSE
 * -------
 * Defines the valid ER location namespace for a hospital.
 *
 * A configured physical capacity of N creates:
 *
 *   1, 1A, 1B
 *   2, 2A, 2B
 *   ...
 *   N, NA, NB
 *
 * IMPORTANT
 * ---------
 * These are valid ER LOCATIONS, not occupied beds.
 *
 * Occupancy remains derived from active ClinicalCase.bedNo values.
 *
 * This module:
 * - does NOT read Firestore
 * - does NOT write Firestore
 * - does NOT create ClinicalCases
 * - does NOT assign patients
 * - does NOT change navigation
 */

export type MateBedSubdivision = "" | "A" | "B";

export interface MateBedLocation {
  /**
   * Canonical identifier stored in ClinicalCase.bedNo.
   *
   * Examples:
   * 3
   * 3A
   * 3B
   */
  id: string;

  /**
   * Physical numbered ER bed / position.
   */
  baseBedNumber: number;

  /**
   * Empty string = normal/base location.
   * A/B = subdivision.
   */
  subdivision: MateBedSubdivision;

  /**
   * Human-readable display value.
   */
  label: string;
}

/**
 * Normalize a clinician-entered/spoken bed identifier.
 *
 * Examples:
 *   "03"       -> "3"
 *   "3"        -> "3"
 *   "3 a"      -> "3A"
 *   "3A"       -> "3A"
 *   "bed 3a"   -> "3A"
 *   "Bed No 3B"-> "3B"
 *
 * Returns null when the value cannot safely be interpreted.
 */
export function normalizeMateBedId(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined) return null;

  let text = String(value)
    .trim()
    .toUpperCase();

  if (!text) return null;

  text = text
    .replace(/^BED\s*(?:NO\.?|NUMBER|#)?\s*/i, "")
    .replace(/[\s_-]+/g, "");

  const match = text.match(/^0*(\d+)([AB])?$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (Number.isNaN(num) || num <= 0) return null;

  const subdivision = (match[2] || "") as MateBedSubdivision;
  return `${num}${subdivision}`;
}

/**
 * Generate the canonical set of all physical and subdivided ER bed locations
 * for an emergency department with physical capacity N.
 *
 * Default fallback is 30 beds (1..30, 1A/1B..30A/30B).
 */
export function generateMateBedLocations(
  physicalCapacity: number = 30
): MateBedLocation[] {
  const safeCapacity = Math.max(1, Math.min(200, physicalCapacity || 30));
  const locations: MateBedLocation[] = [];

  for (let bedNum = 1; bedNum <= safeCapacity; bedNum++) {
    // 1. Base physical bed location (e.g. "3")
    locations.push({
      id: String(bedNum),
      baseBedNumber: bedNum,
      subdivision: "",
      label: `Bed ${bedNum}`,
    });

    // 2. Subdivision A (e.g. "3A")
    locations.push({
      id: `${bedNum}A`,
      baseBedNumber: bedNum,
      subdivision: "A",
      label: `Bed ${bedNum}A`,
    });

    // 3. Subdivision B (e.g. "3B")
    locations.push({
      id: `${bedNum}B`,
      baseBedNumber: bedNum,
      subdivision: "B",
      label: `Bed ${bedNum}B`,
    });
  }

  return locations;
}

/**
 * Validate whether a bed location string is within the hospital's capacity.
 */
export function isValidMateBedLocation(
  value: string | number | null | undefined,
  physicalCapacity: number = 30
): boolean {
  const normalized = normalizeMateBedId(value);
  if (!normalized) return false;

  const match = normalized.match(/^(\d+)[AB]?$/);
  if (!match) return false;

  const num = parseInt(match[1], 10);
  const safeCapacity = Math.max(1, Math.min(200, physicalCapacity || 30));
  return num >= 1 && num <= safeCapacity;
}
