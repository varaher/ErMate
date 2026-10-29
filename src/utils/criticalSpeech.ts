/**
 * ErMate — hands-free (MATE) wording for critical alerts.
 *
 * Pure functions only: no UI, no network, no saving. MATE (voice) can call these to
 * answer "who is critical?" or to announce a critical value after an update is applied.
 * Uses exactly the same rules as the red badge (computeCriticalAlerts), so voice and screen never disagree.
 * "Nobody critical" means "nothing critical recorded on saved case sheets" — never "everyone is safe".
 */

import type { ClinicalCase } from "../types";
import { computeCriticalAlerts, type CriticalAlert } from "./criticalAlerts";

export interface CriticalCaseSummary {
  caseId: string;
  label: string; // "Bed 5" or patient name
  alerts: CriticalAlert[];
}

function caseLabel(c: any): string {
  const bed = c?.bedNo ?? c?.bed;
  if (bed !== undefined && bed !== null && String(bed).trim() !== "") return `Bed ${String(bed).trim()}`;
  const name = c?.patient?.name;
  return name && String(name).trim() ? String(name).trim() : "Unidentified patient";
}

/** All active cases that currently have at least one critical value, most alerts first. */
export function findCriticalCases(cases: ClinicalCase[] | null | undefined): CriticalCaseSummary[] {
  if (!Array.isArray(cases)) return [];
  return cases
    .map((c) => ({ caseId: c.id, label: caseLabel(c), alerts: computeCriticalAlerts(c) }))
    .filter((s) => s.alerts.length > 0)
    .sort((a, b) => b.alerts.length - a.alerts.length);
}

/** One short spoken sentence for a single case, e.g. "Bed 5: Hypotension, SBP 72 mmHg; Hypoxia, SpO2 85%." */
export function speakCaseAlerts(label: string, alerts: CriticalAlert[]): string {
  if (!alerts.length) return `${label}: nothing critical recorded.`;
  const parts = alerts.map((a) => `${a.label}, ${a.display.replace(/₂/g, "2")}`);
  return `${label}: ${parts.join("; ")}.`;
}

/** Answer for "who is critical?" across the list MATE is given. */
export function speakCriticalOverview(cases: ClinicalCase[] | null | undefined): string {
  const list = findCriticalCases(cases);
  if (!list.length) return "No critical values recorded on saved case sheets. This does not mean every patient is stable. Please check the patients.";
  const head = list.length === 1 ? "1 patient has critical values." : `${list.length} patients have critical values.`;
  return `${head} ${list.map((s) => speakCaseAlerts(s.label, s.alerts)).join(" ")}`;
}
/**
 * After a doctor APPLIES an update: which critical values did that update newly cause (or change)?
 * Reads only the vitals inside the applied extraction, merged over the case as it was before.
 * Returns null when nothing new is critical — silence never means "safe", it only means "nothing new".
 */
export function describeNewCriticalAfterUpdate(
  before: ClinicalCase | null | undefined,
  extraction: any
): { label: string; newAlerts: CriticalAlert[]; text: string } | null {
  const ev = extraction && typeof extraction === "object" ? extraction.vitals : null;
  if (!ev || typeof ev !== "object") return null;

  const base: any = before || {};
  const merged: Record<string, any> = { ...(base.vitals || {}) };
  for (const [k, v] of Object.entries(ev)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") merged[k] = v;
  }
  if ((ev as any).pulse && !(ev as any).hr) merged.hr = (ev as any).pulse;

  const after: any = { ...base, id: base.id ?? "pending", status: base.status ?? "Active", isPediatric: base.isPediatric ?? extraction.isPediatric ?? false, vitals: merged };
  const beforeAlerts = before ? computeCriticalAlerts(before) : [];
  const afterAlerts = computeCriticalAlerts(after);
  const prior = new Map(beforeAlerts.map((a) => [a.key, a.display]));
  const newAlerts = afterAlerts.filter((a) => prior.get(a.key) !== a.display);
  if (!newAlerts.length) return null;

  const label = caseLabel(before && (before as any).bedNo ? before : { bedNo: extraction.bedNo ?? extraction.bed, patient: { name: extraction.name ?? (before as any)?.patient?.name } });
  return { label, newAlerts, text: speakCaseAlerts(label, newAlerts).replace(/^([^:]+):/, "$1 now critical:") };
}