/**
 * ErMate — AMBER (abnormal, not critical) vital-sign flags. MATE Events Phase 1, Step 3.
 *
 * Rule-based only: never routed through an AI model.
 * THRESHOLDS ARE A CLINICAL DECISION — owned by the treating physician.
 * Edit ABNORMAL_LIMITS only; nothing else needs to change.
 *
 * - Evaluates only values SAVED on the case sheet (unapplied dictation is never included).
 * - Critical wins: a parameter already in the red (criticalAlerts.ts) is not also flagged amber.
 * - Paediatric HR / RR / SBP are age-banded and NOT evaluated here (same as criticalAlerts.ts).
 * - "No flag" means "nothing abnormal recorded" — it is NOT a statement that the patient is safe.
 */

import type { ClinicalCase } from "../types";
import {
  computeCriticalAlerts,
  formatTempBoth,
  latestReadings,
  tempToCelsius,
  type CriticalAlert,
} from "./criticalAlerts";

export interface AbnormalLimit {
  low?: number;
  high?: number;
}

/** Adult abnormal (amber) limits. Temperature in °C. GCS: total below 15 is amber, ≤8 is red. */
export const ABNORMAL_LIMITS = {
  sbp: { low: 90, high: 140 } as AbnormalLimit,
  hr: { low: 60, high: 100 } as AbnormalLimit,
  rr: { low: 12, high: 20 } as AbnormalLimit,
  spo2: { low: 94 } as AbnormalLimit,
  tempC: { low: 36.1, high: 37.5 } as AbnormalLimit,
  grbs: { low: 70, high: 180 } as AbnormalLimit,
  gcs: { low: 15 } as AbnormalLimit,
};

export interface AbnormalFlag {
  key: CriticalAlert["key"];
  label: string;
  /** Human readable, e.g. "HR 110/min". */
  display: string;
  direction: "low" | "high";
}

function outside(value: number, lim: AbnormalLimit): "low" | "high" | null {
  if (lim.low !== undefined && value < lim.low) return "low";
  if (lim.high !== undefined && value > lim.high) return "high";
  return null;
}

function isClosed(c: ClinicalCase): boolean {
  return c.status === "Discharged" || Boolean((c as any).archivedAt);
}

/** Amber flags for the latest saved readings. Critical parameters are excluded (critical wins). */
export function computeAbnormalFlags(c: ClinicalCase | null | undefined): AbnormalFlag[] {
  if (!c || isClosed(c)) return [];
  const r = latestReadings(c);
  const critical = new Set(computeCriticalAlerts(c).map((a) => a.key));
  const out: AbnormalFlag[] = [];
  const push = (key: AbnormalFlag["key"], label: string, display: string, direction: "low" | "high") => {
    if (!critical.has(key)) out.push({ key, label, display, direction });
  };

  if (!c.isPediatric) {
    if (r.sbp !== null) { const d = outside(r.sbp, ABNORMAL_LIMITS.sbp); if (d) push("sbp", d === "low" ? "Low BP" : "High BP", `SBP ${r.sbp} mmHg`, d); }
    if (r.hr !== null) { const d = outside(r.hr, ABNORMAL_LIMITS.hr); if (d) push("hr", d === "low" ? "Bradycardia" : "Tachycardia", `HR ${r.hr}/min`, d); }
    if (r.rr !== null) { const d = outside(r.rr, ABNORMAL_LIMITS.rr); if (d) push("rr", d === "low" ? "Low RR" : "Tachypnoea", `RR ${r.rr}/min`, d); }
  }
  if (r.spo2 !== null) { const d = outside(r.spo2, ABNORMAL_LIMITS.spo2); if (d) push("spo2", "Low SpO₂", `SpO₂ ${r.spo2}%`, d); }
  if (r.temp !== null) {
    const tc = tempToCelsius(r.temp);
    if (tc !== null) {
      const d = outside(tc, ABNORMAL_LIMITS.tempC);
      if (d) push("temp", d === "high" ? "Fever" : "Low temperature", `Temp ${formatTempBoth(r.temp)}`, d);
    }
  }
  if (r.grbs !== null) { const d = outside(r.grbs, ABNORMAL_LIMITS.grbs); if (d) push("grbs", d === "low" ? "Low GRBS" : "High GRBS", `GRBS ${r.grbs} mg/dL`, d); }
  if (r.gcs !== null) { const d = outside(r.gcs, ABNORMAL_LIMITS.gcs); if (d) push("gcs", "Reduced GCS", `GCS ${r.gcs}`, d); }
  return out;
}

/** Latest saved values as one stable string (nulls as "-"). Detects a change in values. */
export function valueSignature(c: ClinicalCase): string {
  const r = latestReadings(c);
  return [r.sbp, r.hr, r.rr, r.spo2, r.temp, r.grbs, r.gcs].map((v) => (v === null ? "-" : String(v))).join("|");
}

/**
 * Identity of the latest saved observation, used to decide "is this a new reading?".
 * - A newly logged reading (even with the same values) has a new obsId → new key.
 * - A direct field edit that CHANGES a value → signature changes → new key.
 * - Note/plan edits, or re-typing the same value → key unchanged.
 * Readings saved before Step 2 have no obsId; the history length stands in for it.
 */
export function observationKey(c: ClinicalCase): string {
  const hist: any[] = Array.isArray((c as any).vitalsHistory) ? (c as any).vitalsHistory : [];
  const last = hist.length ? hist[hist.length - 1] : null;
  const id = last && typeof last.obsId === "string" && last.obsId ? last.obsId : `n${hist.length}`;
  return `${id}|${valueSignature(c)}`;
}