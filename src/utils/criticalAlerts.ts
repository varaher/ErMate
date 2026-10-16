/**
 * ErMate — deterministic CRITICAL (red) vital-sign alerts.
 *
 * Rule-based only: never routed through an AI model. These are CRITICAL limits
 * (immediate-attention values), deliberately much narrower than the "abnormal"
 * reference ranges in clinicalRanges.ts, so the red dot stays meaningful.
 *
 * THRESHOLDS ARE A CLINICAL DECISION: reviewed/owned by the treating physician.
 * Edit CRITICAL_LIMITS below; nothing else needs to change.
 *
 * Evaluates only values saved on the case sheet (unapplied dictation is not included).
 * "No alert" means "nothing critical recorded" — it is NOT a statement that the patient is safe.
 */

import type { ClinicalCase } from "../types";

export interface CriticalLimit {
  low?: number;
  high?: number;
}

/** Adult critical limits. Temperature limits are in °C. */
export const CRITICAL_LIMITS = {
  sbp: { low: 80 } as CriticalLimit,
  hr: { low: 40, high: 150 } as CriticalLimit,
  rr: { low: 8, high: 30 } as CriticalLimit,
  spo2: { low: 88 } as CriticalLimit,
  tempC: { low: 35.0, high: 40.0 } as CriticalLimit,
  grbs: { low: 54, high: 400 } as CriticalLimit,
  gcs: { low: 9 } as CriticalLimit, // GCS <= 8
};

export interface CriticalAlert {
  key: "sbp" | "hr" | "rr" | "spo2" | "temp" | "grbs" | "gcs";
  label: string;
  /** Human readable, e.g. "SBP 72 mmHg" or "Temp 104.9°F (40.5°C)". */
  display: string;
  direction: "low" | "high";
}

/** °F values are stored by the case sheet; the clinical tables use °C. Values >= 50 are treated as °F. */
export function tempToCelsius(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const c = raw >= 50 ? ((raw - 32) * 5) / 9 : raw;
  return c >= 25 && c <= 45 ? c : null; // outside human range = data-entry error, ignore
}

export function formatTempBoth(raw: number): string | null {
  const c = tempToCelsius(raw);
  if (c === null) return null;
  const f = (c * 9) / 5 + 32;
  return `${f.toFixed(1)}°F (${c.toFixed(1)}°C)`;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseSbp(bp: unknown): number | null {
  const m = String(bp ?? "").match(/^\s*(\d{2,3})\s*\/\s*\d{2,3}/);
  return m ? Number(m[1]) : null;
}

function gcsTotal(v: any): number | null {
  const total = num(v?.gcs);
  if (total !== null && total >= 3 && total <= 15) return total;
  const e = num(v?.gcs_e), vb = num(v?.gcs_v), m = num(v?.gcs_m);
  if (e !== null && vb !== null && m !== null) return e + vb + m;
  return null;
}

/** Latest saved reading per field: current vitals first, then the most recent history record. */
function latestReadings(c: ClinicalCase) {
  const v: any = c.vitals || {};
  const hist: any[] = Array.isArray((c as any).vitalsHistory) ? (c as any).vitalsHistory : [];
  const last = hist.length ? hist[hist.length - 1] : null;
  return {
    sbp: parseSbp(v.bp) ?? num(last?.systolic) ?? parseSbp(last?.bp),
    hr: num(v.hr) ?? num(last?.hr),
    rr: num(v.rr) ?? num(last?.rr),
    spo2: num(v.spo2) ?? num(last?.spo2),
    temp: num(v.temp) ?? num(last?.temp),
    grbs: num(v.grbs),
    gcs: gcsTotal(v),
  };
}

function outside(value: number, lim: CriticalLimit): "low" | "high" | null {
  if (lim.low !== undefined && value < lim.low) return "low";
  if (lim.high !== undefined && value > lim.high) return "high";
  return null;
}

export function computeCriticalAlerts(c: ClinicalCase | null | undefined): CriticalAlert[] {
  if (!c || c.status === "Discharged" || (c as any).archivedAt) return [];
  const r = latestReadings(c);
  const out: CriticalAlert[] = [];
  const push = (key: CriticalAlert["key"], label: string, display: string, direction: "low" | "high") =>
    out.push({ key, label, display, direction });

  // Paediatric HR / RR / BP limits are age-banded and not evaluated here yet.
  if (!c.isPediatric) {
    if (r.sbp !== null) { const d = outside(r.sbp, CRITICAL_LIMITS.sbp); if (d) push("sbp", "Hypotension", `SBP ${r.sbp} mmHg`, d); }
    if (r.hr !== null) { const d = outside(r.hr, CRITICAL_LIMITS.hr); if (d) push("hr", d === "low" ? "Bradycardia" : "Tachycardia", `HR ${r.hr}/min`, d); }
    if (r.rr !== null) { const d = outside(r.rr, CRITICAL_LIMITS.rr); if (d) push("rr", d === "low" ? "Bradypnoea" : "Tachypnoea", `RR ${r.rr}/min`, d); }
  }
  if (r.spo2 !== null) { const d = outside(r.spo2, CRITICAL_LIMITS.spo2); if (d) push("spo2", "Hypoxia", `SpO₂ ${r.spo2}%`, d); }
  if (r.temp !== null) {
    const tc = tempToCelsius(r.temp);
    if (tc !== null) {
      const d = outside(tc, CRITICAL_LIMITS.tempC);
      if (d) push("temp", d === "high" ? "Hyperpyrexia" : "Hypothermia", `Temp ${formatTempBoth(r.temp)}`, d);
    }
  }
  if (r.grbs !== null) { const d = outside(r.grbs, CRITICAL_LIMITS.grbs); if (d) push("grbs", d === "low" ? "Hypoglycaemia" : "Severe hyperglycaemia", `GRBS ${r.grbs} mg/dL`, d); }
  if (r.gcs !== null) { const d = outside(r.gcs, CRITICAL_LIMITS.gcs); if (d) push("gcs", "Depressed consciousness", `GCS ${r.gcs}`, d); }
  return out;
}
