/**
 * pediatricClinicalRanges.ts
 *
 * Age-banded normal vital sign ranges for pediatric ED patients.
 * SEPARATE from clinicalRanges.ts because adult fixed thresholds are
 * clinically unsafe for children — e.g. HR 130 is abnormal in an
 * adult but normal in a toddler. Using adult ranges on a pediatric
 * patient would generate false-positive AND false-negative alerts.
 *
 * Age bands follow standard PALS (Pediatric Advanced Life Support)
 * reference ranges. CONFIRM these bands/cutoffs against your
 * hospital's actual pediatric protocol before pilot go-live — some
 * institutions use slightly different band boundaries.
 *
 * CRITICAL: Like clinicalRanges.ts, this file must NEVER be routed
 * through an AI model. Deterministic lookup only.
 *
 * Labs (electrolytes, renal, CBC, etc.) for pediatric patients are
 * NOT covered here — this file is vitals-only. Pediatric lab normals
 * also vary by age and are commonly ordered/interpreted individually
 * rather than via fixed adult panels; do not reuse adult lab ranges
 * from clinicalRanges.ts for pediatric CBC/RFT/LFT interpretation.
 */

export type PediatricVitalParam = "hr" | "rr" | "sbp" | "spo2" | "temp";

export interface AgeBand {
  label: string;         // e.g. "Infant (1-12 months)"
  minAgeMonths: number;  // inclusive
  maxAgeMonths: number;  // exclusive (use Infinity for open-ended top band)
  ranges: Partial<Record<PediatricVitalParam, { low?: number; high?: number }>>;
}

/**
 * PALS-aligned age bands. Ages expressed in months for precision at
 * the low end (neonate/infant), since a few months makes a large
 * difference in normal HR/RR at that stage.
 */
export const PEDIATRIC_AGE_BANDS: AgeBand[] = [
  {
    label: "Neonate (0-1 month)",
    minAgeMonths: 0,
    maxAgeMonths: 1,
    ranges: {
      hr:   { low: 100, high: 180 },
      rr:   { low: 30,  high: 60 },
      sbp:  { low: 60,  high: 90 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
  {
    label: "Infant (1-12 months)",
    minAgeMonths: 1,
    maxAgeMonths: 12,
    ranges: {
      hr:   { low: 100, high: 160 },
      rr:   { low: 25,  high: 50 },
      sbp:  { low: 70,  high: 100 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
  {
    label: "Toddler (1-3 years)",
    minAgeMonths: 12,
    maxAgeMonths: 36,
    ranges: {
      hr:   { low: 90,  high: 150 },
      rr:   { low: 20,  high: 40 },
      sbp:  { low: 80,  high: 110 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
  {
    label: "Preschool (3-6 years)",
    minAgeMonths: 36,
    maxAgeMonths: 72,
    ranges: {
      hr:   { low: 80,  high: 140 },
      rr:   { low: 20,  high: 34 },
      sbp:  { low: 80,  high: 110 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
  {
    label: "School age (6-12 years)",
    minAgeMonths: 72,
    maxAgeMonths: 144,
    ranges: {
      hr:   { low: 70,  high: 120 },
      rr:   { low: 18,  high: 30 },
      sbp:  { low: 85,  high: 120 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
  {
    label: "Adolescent (12-18 years)",
    minAgeMonths: 144,
    maxAgeMonths: 216, // 18 years
    ranges: {
      hr:   { low: 60,  high: 100 },
      rr:   { low: 12,  high: 20 },
      sbp:  { low: 90,  high: 130 },
      spo2: { low: 95 },
      temp: { low: 36.5, high: 37.5 },
    },
  },
];

/**
 * Returns the applicable age band for a given age in months.
 * Returns null if age is out of pediatric range (>= 18 years) —
 * caller should fall back to adult clinicalRanges.ts in that case.
 */
export function getAgeBand(ageMonths: number): AgeBand | null {
  return PEDIATRIC_AGE_BANDS.find(
    band => ageMonths >= band.minAgeMonths && ageMonths < band.maxAgeMonths
  ) || null;
}

/**
 * Convenience: convert years + months into total months, since case
 * sheets often capture age as "3y 4m" or similar for young children.
 */
export function ageToMonths(years: number, months: number = 0): number {
  return years * 12 + months;
}

/**
 * Returns true if the given vital value is outside the normal range
 * for the patient's age band. Mirrors isAbnormal() from
 * clinicalRanges.ts but is age-aware.
 */
export function isAbnormalForAge(
  param: PediatricVitalParam,
  value: number | null | undefined,
  ageMonths: number
): boolean {
  if (value === null || value === undefined || Number.isNaN(value)) return false;

  const band = getAgeBand(ageMonths);
  if (!band) return false; // out of pediatric range — caller should use adult ranges instead

  const range = band.ranges[param];
  if (!range) return false;

  if (range.low !== undefined && value < range.low) return true;
  if (range.high !== undefined && value > range.high) return true;

  return false;
}

/**
 * Formats a vital value with an age-aware abnormality flag, mirroring
 * formatFlagged() from clinicalRanges.ts.
 *
 * e.g. formatFlaggedForAge("hr", 165, 8) -> "165 ⚠️" (8 months, HR high for infant band)
 *      formatFlaggedForAge("hr", 120, 8) -> "120" (normal for infant band)
 */
export function formatFlaggedForAge(
  param: PediatricVitalParam,
  value: number | null | undefined,
  ageMonths: number
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not documented";
  }
  return isAbnormalForAge(param, value, ageMonths) ? `${value} ⚠️` : `${value}`;
}
