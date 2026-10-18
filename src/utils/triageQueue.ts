import type { ClinicalCase } from "../types";
import { getTriageDisplay } from "./triageScale";

export interface TriageQueueItem {
  id: string;
  case: ClinicalCase;
  code: string;
  levelSortKey: number;
  waitMinutes: number;
  /** true when the patient has waited longer than the target time for the level (P1 = 0 min, so always) */
  overTarget: boolean;
  targetMinutes: number | null;
}

/** Triaged patients nobody has taken yet: sickest first, then longest waiting. Pure; no clock access. */
export function buildTriageQueue(cases: ClinicalCase[], nowMs: number): TriageQueueItem[] {
  const items: TriageQueueItem[] = [];
  for (const c of cases || []) {
    if (!c || c.awaitingDoctor !== true || c.archivedAt || c.status === "Discharged") continue;
    const d = getTriageDisplay(c.patient);
    const digit = parseInt(d.code.replace(/\D/g, ""), 10);
    const levelSortKey = d.level ?? (Number.isFinite(digit) ? digit : 3);
    const t = Date.parse(c.triagedAt || c.createdAt || "");
    const waitMinutes = Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 60000)) : 0;
    const target = d.minutes;
    items.push({ id: c.id, case: c, code: d.code, levelSortKey, waitMinutes, targetMinutes: target, overTarget: target !== null && waitMinutes > target });
  }
  items.sort((a, b) => a.levelSortKey - b.levelSortKey || b.waitMinutes - a.waitMinutes);
  return items;
}
