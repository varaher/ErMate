/**
 * clinicalRanges.ts
 *
 * Deterministic clinical reference ranges for adult ED patients.
 * Used by alertCompiler.ts and handover/discharge/mortality-audit JSON
 * post-processing to flag abnormal values with `isAbnormal: true`.
 *
 * CRITICAL: This file must NEVER be routed through an AI model.
 * All thresholds are rule-based lookups so abnormal-flagging stays
 * reliable even during Claude/GPT/Gemini fallback cascades, per
 * ErMate's temperature-0.0 / zero-hallucination convention.
 */

export type ClinicalParam =
  | "hr"
  | "rr"
  | "sbp"
  | "dbp"
  | "spo2"
  | "temp"
  | "grbs"
  | "ph"
  | "pco2"
  | "hco3"
  | "lactate"
  | "na"
  | "k"
  | "creatinine"
  | "urea"
  | "hb"
  | "wbc"
  | "platelets"
  | "crp"
  | "inr"
  | "gcs";

interface Range {
  low?: number;   // below this = abnormal
  high?: number;  // above this = abnormal
  criticalLow?: number;  // optional: for future "critical" vs "abnormal" tiering
  criticalHigh?: number;
}

export const CLINICAL_RANGES: Record<ClinicalParam, Range> = {
  // Vitals
  hr:        { low: 60,   high: 100 },              // bpm
  rr:        { low: 12,   high: 20 },                // breaths/min
  sbp:       { low: 90,   high: 140 },                // mmHg systolic
  dbp:       { low: 60,   high: 90 },                 // mmHg diastolic
  spo2:      { low: 94 },                             // % on room air
  temp:      { low: 36.1, high: 37.5 },               // °C
  grbs:      { low: 70,   high: 180 },                // mg/dL (random/ER context, not fasting)

  // ABG / VBG
  ph:        { low: 7.35, high: 7.45 },
  pco2:      { low: 35,   high: 45 },                 // mmHg
  hco3:      { low: 22,   high: 26 },                 // mmol/L
  lactate:   { high: 2.0 },                            // mmol/L

  // Electrolytes
  na:        { low: 135,  high: 145 },                // mmol/L
  k:         { low: 3.5,  high: 5.0 },                // mmol/L

  // Renal
  creatinine:{ low: 0.6,  high: 1.3 },                // mg/dL
  urea:      { low: 15,   high: 45 },                 // mg/dL

  // CBC
  hb:        { low: 12,   high: 17 },                 // g/dL
  wbc:       { low: 4.0,  high: 11.0 },               // x10^9/L
  platelets: { low: 150,  high: 450 },                // x10^9/L

  // Inflammatory / coagulation
  crp:       { high: 10 },                             // mg/L
  inr:       { high: 1.5 },

  // Neuro
  gcs:       { low: 15 },                              // any value <15 flagged
};

/**
 * Returns true if the given value for a clinical parameter falls
 * outside the normal reference range.
 */
export function isAbnormal(param: ClinicalParam, value: number | null | undefined): boolean {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return false;
  }

  const range = CLINICAL_RANGES[param];
  if (!range) return false;

  if (range.low !== undefined && value < range.low) return true;
  if (range.high !== undefined && value > range.high) return true;

  return false;
}

/**
 * Returns true if the given value is in a CRITICAL range.
 */
export function isCritical(param: ClinicalParam, value: number | null | undefined): boolean {
  if (value === null || value === undefined || Number.isNaN(value)) return false;

  const range = CLINICAL_RANGES[param];
  if (!range) return false;

  if (range.criticalLow !== undefined && value < range.criticalLow) return true;
  if (range.criticalHigh !== undefined && value > range.criticalHigh) return true;

  return false;
}

/**
 * Convenience formatter: given a param + value, returns the value with a flag suffix if abnormal.
 */
export function formatFlagged(param: ClinicalParam, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not documented";
  }
  return isAbnormal(param, value) ? `${value} ⚠️` : `${value}`;
}

/**
 * Special-case handler for blood/urine/other cultures.
 */
export function isCulturePositive(result: string | null | undefined): boolean {
  if (!result) return false;
  const normalized = result.toLowerCase();
  return (
    normalized.includes("positive") ||
    normalized.includes("growth") ||
    /\b(gnb|gpc|e\.?\s?coli|klebsiella|pseudomonas|staph|strep|candida|mrsa|esbl)\b/.test(normalized)
  );
}
