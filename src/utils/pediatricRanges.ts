import { getAgeBand, type AgeBand, type PediatricVitalParam } from "../../server/pediatricClinicalRanges";

export { getAgeBand, type AgeBand, type PediatricVitalParam };

/**
 * Pediatric definition is LOCKED:
 * age <= 16 years -> pediatric
 * age >= 17 years -> adult
 * Null-safe: does not lose age 0 (neonate/infant).
 */
export function isPediatricPatient(ageYears: number | null | undefined): boolean {
  if (ageYears === null || ageYears === undefined) return false;
  const num = typeof ageYears === "number" ? ageYears : Number(ageYears);
  if (isNaN(num)) return false;
  return num >= 0 && num <= 16;
}

/**
 * Retrieve the validated AgeBand for a given age in years and optional months or days.
 * Returns null if age is unknown or not pediatric (age > 16).
 * 
 * Safety Rule for ageYears === 0:
 * - If ageYears === 0 and neither ageMonths nor ageDays is provided (> 0):
 *   do NOT automatically classify as Neonate. Returns null to prevent unsafe assumptions.
 * - If ageDays is provided (> 0): calculates age in months (days / 30.4375) or selects neonatal band if <= 30 days.
 * - If ageMonths is provided (> 0): selects appropriate age band.
 */
export function getPediatricAgeBand(
  ageYears: number | null | undefined,
  ageMonthsParam?: number | null,
  ageDaysParam?: number | null
): AgeBand | null {
  if (ageYears === null || ageYears === undefined) return null;
  const numYears = typeof ageYears === "number" ? ageYears : Number(ageYears);
  if (isNaN(numYears) || numYears < 0 || numYears > 16) return null;

  const hasMonths = ageMonthsParam !== null && ageMonthsParam !== undefined && !isNaN(Number(ageMonthsParam));
  const hasDays = ageDaysParam !== null && ageDaysParam !== undefined && !isNaN(Number(ageDaysParam));
  const monthsVal = hasMonths ? Number(ageMonthsParam) : 0;
  const daysVal = hasDays ? Number(ageDaysParam) : 0;

  // If ageYears === 0 and no precise months or days (> 0) are supplied:
  // do NOT automatically assume Neonate. Return null to prompt for months.
  if (numYears === 0 && (!hasMonths || monthsVal <= 0) && (!hasDays || daysVal <= 0)) {
    return null;
  }

  let totalMonths = numYears * 12 + monthsVal;
  if (daysVal > 0) {
    totalMonths += daysVal / 30.4375;
  }

  return getAgeBand(totalMonths);
}

export type VitalStatusType = "Normal" | "High" | "Low" | "Unknown";

export interface VitalInterpretation {
  isPediatric: boolean;
  requiresAgeInMonths?: boolean;
  ageBandLabel?: string;
  rangeLabel: string;
  low?: number;
  high?: number;
  status: VitalStatusType;
  statusText?: string;
  measuredNum: number | null;
}

/**
 * Determine age-appropriate reference range and status (Normal, High, Low)
 * for a measured vital sign.
 * 
 * IMPORTANT:
 * - Does NOT label a value abnormal unless the validated age-specific
 *   reference utility actually determines it.
 * - If ageYears === 0 without precise months/days: flags requiresAgeInMonths: true.
 * - Unknown age -> status: "Unknown", isPediatric: false.
 */
export function interpretPediatricVital(
  param: "hr" | "rr" | "sbp" | "spo2" | "temp",
  value: string | number | null | undefined,
  ageYears: number | null | undefined,
  ageMonthsParam?: number | null,
  ageDaysParam?: number | null
): VitalInterpretation {
  if (!isPediatricPatient(ageYears)) {
    return {
      isPediatric: false,
      rangeLabel: "",
      status: "Unknown",
      measuredNum: null,
    };
  }

  const numYears = typeof ageYears === "number" ? ageYears : Number(ageYears);
  const hasMonths = ageMonthsParam !== null && ageMonthsParam !== undefined && !isNaN(Number(ageMonthsParam));
  const hasDays = ageDaysParam !== null && ageDaysParam !== undefined && !isNaN(Number(ageDaysParam));
  const monthsVal = hasMonths ? Number(ageMonthsParam) : 0;
  const daysVal = hasDays ? Number(ageDaysParam) : 0;

  // Handle age 0 without precise months or days
  if (numYears === 0 && (!hasMonths || monthsVal <= 0) && (!hasDays || daysVal <= 0)) {
    return {
      isPediatric: true,
      requiresAgeInMonths: true,
      rangeLabel: "Age in months required for pediatric reference range",
      status: "Unknown",
      measuredNum: null,
    };
  }

  const band = getPediatricAgeBand(ageYears, ageMonthsParam, ageDaysParam);
  if (!band) {
    return {
      isPediatric: true,
      requiresAgeInMonths: true,
      rangeLabel: "Age in months required for pediatric reference range",
      status: "Unknown",
      measuredNum: null,
    };
  }

  const range = band.ranges[param];
  let rangeLabel = "";
  if (param === "hr") {
    rangeLabel = `${range.low}–${range.high} bpm`;
  } else if (param === "rr") {
    rangeLabel = `${range.low}–${range.high} /min`;
  } else if (param === "sbp") {
    rangeLabel = `${range.low}–${range.high} mmHg`;
  } else if (param === "spo2") {
    rangeLabel = `${range.low}–100%`;
  } else if (param === "temp") {
    rangeLabel = `36.5–37.5°C (97.7–99.5°F)`;
  }

  if (value === null || value === undefined || value === "") {
    return {
      isPediatric: true,
      ageBandLabel: band.label,
      rangeLabel,
      low: range.low,
      high: range.high,
      status: "Unknown",
      measuredNum: null,
    };
  }

  // Parse numeric measurement
  let measuredNum: number | null = null;
  const strVal = String(value).trim();

  if (param === "sbp") {
    // Handle "90/60" or "90"
    const match = strVal.match(/^(\d+)/);
    if (match) {
      measuredNum = parseInt(match[1], 10);
    }
  } else if (param === "temp") {
    const match = strVal.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const rawNum = parseFloat(match[1]);
      // Normalize Fahrenheit to Celsius for comparison against 36.5 - 37.5 range
      if (rawNum >= 85) {
        measuredNum = parseFloat((((rawNum - 32) * 5) / 9).toFixed(1));
      } else {
        measuredNum = rawNum;
      }
    }
  } else {
    const match = strVal.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      measuredNum = parseFloat(match[1]);
    }
  }

  if (measuredNum === null || isNaN(measuredNum)) {
    return {
      isPediatric: true,
      ageBandLabel: band.label,
      rangeLabel,
      low: range.low,
      high: range.high,
      status: "Unknown",
      measuredNum: null,
    };
  }

  let status: VitalStatusType = "Normal";
  let statusText = "Within age-expected range";

  if (measuredNum < range.low) {
    status = "Low";
    if (param === "hr") statusText = "HR below age reference";
    else if (param === "rr") statusText = "RR below age reference";
    else if (param === "sbp") statusText = "SBP below age reference";
    else if (param === "spo2") statusText = "SpO2 below age reference";
    else if (param === "temp") statusText = "Temp below age reference";
    else statusText = "Below age reference";
  } else if (measuredNum > range.high) {
    status = "High";
    if (param === "hr") statusText = "HR above age reference";
    else if (param === "rr") statusText = "RR above age reference";
    else if (param === "sbp") statusText = "SBP above age reference";
    else if (param === "temp") statusText = "Temp above age reference";
    else statusText = "Above age reference";
  }

  return {
    isPediatric: true,
    ageBandLabel: band.label,
    rangeLabel,
    low: range.low,
    high: range.high,
    status,
    statusText,
    measuredNum,
  };
}

export type PediatricVitalKey = keyof AgeBand["ranges"];

/**
 * Convenience helper to get the raw range object for a vital parameter.
 */
export function getPediatricVitalRange(
  param: PediatricVitalKey,
  ageYears: number | null | undefined,
  ageMonthsParam?: number | null,
  ageDaysParam?: number | null
) {
  const band = getPediatricAgeBand(ageYears, ageMonthsParam, ageDaysParam);
  return band ? band.ranges[param] : null;
}
