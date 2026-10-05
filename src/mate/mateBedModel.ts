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

  const match = text.match(/^0*(\d+)([AB])?$/i);

  if (!match) return null;

  const bedNumber = Number(match[1]);

  if (!Number.isInteger(bedNumber) || bedNumber <= 0) {
    return null;
  }

  const subdivision = (match[2] || "").toUpperCase();

  return `${bedNumber}${subdivision}`;
}

/**
 * Generate the complete valid ER location namespace.
 *
 * Capacity 3 produces:
 *
 * 1, 1A, 1B,
 * 2, 2A, 2B,
 * 3, 3A, 3B
 */
export function generateMateBedLocations(
  physicalCapacity: number
): MateBedLocation[] {
  if (
    !Number.isInteger(physicalCapacity) ||
    physicalCapacity <= 0
  ) {
    return [];
  }

  const locations: MateBedLocation[] = [];

  for (let bed = 1; bed <= physicalCapacity; bed += 1) {
    const subdivisions: MateBedSubdivision[] = ["", "A", "B"];

    for (const subdivision of subdivisions) {
      const id = `${bed}${subdivision}`;

      locations.push({
        id,
        baseBedNumber: bed,
        subdivision,
        label: `Bed ${id}`,
      });
    }
  }

  return locations;
}

/**
 * Determine whether a requested bed/location belongs to the
 * configured ER namespace.
 */
export function isValidMateBedLocation(
  value: string | number | null | undefined,
  physicalCapacity: number
): boolean {
  const normalized = normalizeMateBedId(value);

  if (!normalized) return false;

  const match = normalized.match(/^(\d+)([AB])?$/);

  if (!match) return false;

  const baseBedNumber = Number(match[1]);

  return (
    Number.isInteger(physicalCapacity) &&
    physicalCapacity > 0 &&
    baseBedNumber >= 1 &&
    baseBedNumber <= physicalCapacity
  );
}
