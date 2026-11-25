/**
 * Discharge Summaries list (25 Nov 2026, Neeraj: "once prepared, where will it get saved ... display it like
 * case list and wait for 24 hrs"). Every prepared or saved discharge summary is listed for 24 hours from its
 * last save, newest first. After that it leaves this list but stays in the patient's case record.
 */
import type { ClinicalCase } from "../types";

export const DISCHARGE_LIST_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DischargeListStatus = "Not saved" | "Draft" | "Finalised";

export interface DischargeListItem {
  id: string;
  name: string;
  sub: string;
  diagnosis: string;
  status: DischargeListStatus;
  /** ISO time of the last save (or of preparation when never saved). */
  at: string;
  /** Whole hours left on the list (0 = under an hour). */
  hoursLeft: number;
}

const PLACEHOLDER_NAME = /^(emergency|unassigned|unknown)( patient)?$|^patient$/i;
const PLACEHOLDER_PC = /^quick discharge intake$/i;

const time = (v: unknown): number => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
};

/** The moment the summary was last touched: saved, finalised, prepared, or the quick-discharge intake. */
export function dischargeActivityTime(c: ClinicalCase): number {
  const d: any = c.dischargeInfo || {};
  return Math.max(time(d.savedAt), time(d.finalizedAt), time(d.preparedAt), time((c as any).quickDischargeAt));
}

export function hasDischargeSummary(c: ClinicalCase): boolean {
  return Boolean(c?.dischargeInfo?.summaryStatus || (c as any)?.quickDischargeAt);
}

export function dischargeListStatus(c: ClinicalCase): DischargeListStatus {
  const s = c.dischargeInfo?.summaryStatus;
  if (s === "FINALIZED") return "Finalised";
  if (s) return "Draft";
  return "Not saved";
}

export function dischargeListName(c: ClinicalCase): string {
  const n = String(c.patient?.name || "").trim();
  return n && !PLACEHOLDER_NAME.test(n) ? n : "Patient (name not recorded)";
}

export function recentDischargeSummaries(cases: ClinicalCase[], now: Date = new Date()): DischargeListItem[] {
  const nowMs = now.getTime();
  return (cases || [])
    .filter((c) => c && c.id && hasDischargeSummary(c) && !(c as any).deletedAt)
    .map((c) => ({ c, t: dischargeActivityTime(c) }))
    .filter(({ t }) => t > 0 && nowMs - t < DISCHARGE_LIST_WINDOW_MS && t - nowMs < 5 * 60 * 1000)
    .sort((a, b) => b.t - a.t)
    .map(({ c, t }) => {
      const p: any = c.patient || {};
      const uhid = String(c.dischargeInfo?.uhid || p.uhid || "").trim();
      const demo = [p.age !== null && p.age !== undefined && p.age !== "" ? `${p.age} y` : "", p.gender && p.gender !== "Other" ? p.gender : ""].filter(Boolean).join(" · ");
      const pc = String(p.presentingComplaint || "").trim();
      const diagnosis = String(c.dischargeInfo?.primaryDiagnosis || c.provisionalPrimaryDiagnosis || (PLACEHOLDER_PC.test(pc) ? "" : pc) || "").trim();
      return {
        id: c.id,
        name: c.bedNo ? `Bed ${c.bedNo} · ${dischargeListName(c)}` : dischargeListName(c),
        sub: [uhid ? `UHID ${uhid}` : "", demo].filter(Boolean).join(" · "),
        diagnosis,
        status: dischargeListStatus(c),
        at: new Date(t).toISOString(),
        hoursLeft: Math.max(0, Math.floor((DISCHARGE_LIST_WINDOW_MS - (nowMs - t)) / 3600000)),
      };
    });
}

/** "10:27 AM" today, "Yesterday 6:05 PM" otherwise. */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? hm : `Yesterday ${hm}`;
}