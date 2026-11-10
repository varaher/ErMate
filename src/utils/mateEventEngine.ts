/**
 * ErMate — MATE Events decision engine. MATE Events Phase 1, Step 4.
 *
 * PURE: no Firestore, no React, no network, no AI. Every decision about when an
 * alert opens, fires, repeats or closes lives here so it can be tested without a device.
 *
 * Two separate things:
 *  - CLINICAL state (red / amber / none) is always computed live from the saved case
 *    (computeCriticalAlerts / computeAbnormalFlags). It is never stored in an event.
 *  - ALERT state (pending → due → seen / reviewed → closed) is what this engine manages.
 * Tapping Seen / Reviewed stops the alert. It never changes the clinical state.
 *
 * Locked decisions (Dr. Neeraj, 2026-11-09):
 *  D1  Critical: alert immediately, repeat every 15 min until Seen.
 *      Abnormal: alert once if no new observation within 60 min.
 *  D1a New observation normal → close. New observation still abnormal → new episode.
 *  D3  Bed label only — never patient name or diagnosis.
 */

import type { ClinicalCase } from "../types";
import { computeCriticalAlerts } from "./criticalAlerts";
import { computeAbnormalFlags, observationKey } from "./abnormalVitals";

export type MateEventType = "critical" | "abnormal" | "reminder";
export type AlertState = "pending" | "due" | "seen" | "reviewed" | "closed" | "cancelled";
export type CloseReason = "normalised" | "discharged" | "archived" | "cancelled";

export interface MateEvent {
  id: string;                 // crit_{caseId} | abn_{caseId} | rem_{caseId}_{ms}
  type: MateEventType;
  caseId: string;
  bedLabel: string;           // D3: bed only
  title: string;
  body: string;               // in-app snapshot only (e.g. "SBP 72 mmHg"); never on lock screen
  alertState: AlertState;
  episodeKey?: string;        // observationKey that opened this episode (alerts only)
  detectedAt: string;         // ISO — when ErMate detected it (NOT when a doctor saw it)
  dueAt: string;              // ISO — time shown to the doctor ("Recheck due 10:45")
  nextFireAt: string | null;  // ISO — firing guard. null = never fire automatically
  occurrence: number;         // +1 per presentation attempt; atomic-claim token
  lastPresentedAt?: string;   // last presentation ATTEMPT (best-effort, not "heard")
  seenAt?: string;
  seenByUid?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  closedAt?: string;
  closedReason?: CloseReason;
  source: "system" | "mate-voice" | "button";
  createdAt: string;
  updatedAt: string;
}

/** Partial update to apply to an event (or a full event when creating). */
export type EventPatch = Partial<MateEvent> & { id: string };

export const CRITICAL_REPEAT_MIN = 15;
export const ABNORMAL_RECHECK_MIN = 60;

const OPEN_STATES: AlertState[] = ["pending", "due", "seen", "reviewed"];

export function isOpen(e: Pick<MateEvent, "alertState"> | null | undefined): boolean {
  return !!e && OPEN_STATES.includes(e.alertState);
}

export function alertEventId(type: "critical" | "abnormal", caseId: string): string {
  return `${type === "critical" ? "crit" : "abn"}_${caseId}`;
}

export function reminderEventId(caseId: string, nowMs: number): string {
  return `rem_${caseId}_${nowMs}`;
}

function addMin(iso: string, min: number): string {
  return new Date(new Date(iso).getTime() + min * 60_000).toISOString();
}

/** "Bed 5" from bedNo; falls back to displayId. Never the patient's name (D3). */
export function bedLabelFor(c: Pick<ClinicalCase, "bedNo" | "displayId" | "id">): string {
  const bed = String(c.bedNo ?? "").trim();
  if (bed) return /^bed\b/i.test(bed) ? bed : `Bed ${bed}`;
  const disp = String(c.displayId ?? "").trim();
  return disp || "Patient";
}

function closeReasonFor(c: ClinicalCase): CloseReason | null {
  if ((c as any).archivedAt) return "archived";
  if (c.status === "Discharged") return "discharged";
  return null;
}

function closePatch(id: string, reason: CloseReason, nowIso: string): EventPatch {
  return { id, alertState: "closed", closedReason: reason, closedAt: nowIso, nextFireAt: null, updatedAt: nowIso };
}

/**
 * Decide what (if anything) to write for one case and one alert type.
 * `existing` must be the event doc as read inside the transaction — INCLUDING closed ones.
 * Only call this for cases that were explicitly loaded. A case missing from a list is
 * never passed in, so absence never closes an alert.
 * Returns null when nothing should change.
 */
export function decideAlert(
  c: ClinicalCase,
  existing: MateEvent | null,
  type: "critical" | "abnormal",
  nowIso: string,
): EventPatch | null {
  const id = alertEventId(type, c.id);

  const closing = closeReasonFor(c);
  if (closing) return isOpen(existing) ? closePatch(id, closing, nowIso) : null;

  const findings =
    type === "critical"
      ? computeCriticalAlerts(c).map((a) => a.display)
      : computeAbnormalFlags(c).map((a) => a.display);

  if (findings.length === 0) {
    return isOpen(existing) ? closePatch(id, "normalised", nowIso) : null;
  }

  const key = observationKey(c);
  // Same episode (whatever its state, including closed) → nothing to do.
  // A stale snapshot can never resurrect a closed episode.
  if (existing && existing.episodeKey === key) return null;

  // New or first episode.
  const due = type === "critical" ? nowIso : addMin(nowIso, ABNORMAL_RECHECK_MIN);
  const base: EventPatch = {
    id,
    type,
    caseId: c.id,
    bedLabel: bedLabelFor(c),
    title: type === "critical" ? "Critical value" : "Abnormal vitals — recheck due",
    body: findings.join(", ").slice(0, 160),
    alertState: type === "critical" ? "due" : "pending",
    episodeKey: key,
    detectedAt: nowIso,
    dueAt: due,
    nextFireAt: due,
    occurrence: 0,
    updatedAt: nowIso,
  };
  if (!existing) return { ...base, source: "system", createdAt: nowIso };
  // Reopen as a new episode: clear acknowledgements and closure of the old episode.
  return {
    ...base,
    seenAt: undefined, seenByUid: undefined,
    reviewedAt: undefined, reviewedByUid: undefined,
    closedAt: undefined, closedReason: undefined,
    lastPresentedAt: undefined,
  };
}

/**
 * Should this event be presented now? Returns the patch to write when it fires, else null.
 * Fires only when nextFireAt is set AND now >= nextFireAt AND state is pending/due.
 */
export function planFiring(e: MateEvent, nowIso: string): EventPatch | null {
  if (e.alertState !== "pending" && e.alertState !== "due") return null;
  if (!e.nextFireAt) return null;
  if (new Date(nowIso).getTime() < new Date(e.nextFireAt).getTime()) return null;
  return {
    id: e.id,
    alertState: "due",
    occurrence: e.occurrence + 1,
    lastPresentedAt: nowIso,
    // Critical repeats until Seen. Abnormal / reminder fire once (until snoozed).
    nextFireAt: e.type === "critical" ? addMin(nowIso, CRITICAL_REPEAT_MIN) : null,
    updatedAt: nowIso,
  };
}

/* ── Doctor actions ───────────────────────────────────────────── */

/** Critical "Seen": stops repeats. The red clinical badge stays until values change. */
export function seenPatch(e: MateEvent, uid: string, nowIso: string): EventPatch | null {
  if (e.type !== "critical" || (e.alertState !== "due" && e.alertState !== "pending")) return null;
  return { id: e.id, alertState: "seen", seenAt: nowIso, seenByUid: uid, nextFireAt: null, updatedAt: nowIso };
}

/** Abnormal "Reviewed" / reminder "Done": stops the alert. Clinical amber stays while abnormal. */
export function reviewedPatch(e: MateEvent, uid: string, nowIso: string): EventPatch | null {
  if (e.type === "critical" || (e.alertState !== "due" && e.alertState !== "pending")) return null;
  return { id: e.id, alertState: "reviewed", reviewedAt: nowIso, reviewedByUid: uid, nextFireAt: null, updatedAt: nowIso };
}

export function snoozePatch(e: MateEvent, minutes: number, nowIso: string): EventPatch | null {
  if (e.alertState !== "due" && e.alertState !== "pending") return null;
  const m = Math.max(1, Math.min(240, Math.round(minutes)));
  const t = addMin(nowIso, m);
  return { id: e.id, alertState: "pending", dueAt: t, nextFireAt: t, updatedAt: nowIso };
}

export function cancelPatch(e: MateEvent, nowIso: string): EventPatch | null {
  if (e.type !== "reminder" || !isOpen(e)) return null;
  return { id: e.id, alertState: "cancelled", closedReason: "cancelled", closedAt: nowIso, nextFireAt: null, updatedAt: nowIso };
}

/* ── Reminders ────────────────────────────────────────────────── */

export function buildReminder(
  input: { caseId: string; bedLabel: string; minutes: number; label?: string; source?: MateEvent["source"] },
  existing: MateEvent[],
  nowIso: string,
): MateEvent | null {
  if (!input.caseId || !input.bedLabel) return null; // never guess the patient
  const m = Math.round(input.minutes);
  if (!Number.isFinite(m) || m < 1 || m > 24 * 60) return null;
  const due = addMin(nowIso, m);
  // Dedupe: an open reminder for the same case due within ±60 s already covers this.
  const dup = existing.find(
    (e) => e.type === "reminder" && e.caseId === input.caseId && isOpen(e) &&
      Math.abs(new Date(e.dueAt).getTime() - new Date(due).getTime()) <= 60_000,
  );
  if (dup) return null;
  const nowMs = new Date(nowIso).getTime();
  return {
    id: reminderEventId(input.caseId, nowMs),
    type: "reminder",
    caseId: input.caseId,
    bedLabel: input.bedLabel,
    title: input.label || "Reassess",
    body: `${input.label || "Reassess"} ${input.bedLabel}`.slice(0, 160),
    alertState: "pending",
    detectedAt: nowIso,
    dueAt: due,
    nextFireAt: due,
    occurrence: 0,
    source: input.source || "mate-voice",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Apply a patch to an event in memory (undefined fields are removed). */
export function applyPatch(e: MateEvent | null, p: EventPatch): MateEvent {
  const merged: any = { ...(e || {}), ...p };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  return merged as MateEvent;
}