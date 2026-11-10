/**
 * ErMate — MATE Events Firestore layer. MATE Events Phase 1, Step 5.
 *
 * Glue only: every DECISION is made by the pure engine (src/utils/mateEventEngine.ts).
 * Path: users/{uid}/mateEvents/{eventId}  (individual workspace, owner-only — rules in Step 6).
 *
 * Safety properties:
 *  - syncCaseAlerts reads the CASE and the EVENTS inside one transaction. Transaction reads
 *    always come from the server (never the offline cache), so an offline device replaying an
 *    old reading is evaluated against the current saved case → no false reopen.
 *  - claimFiring is a transaction: when two devices are open, only one wins each firing.
 *    Only the winner shows the toast / speaks. Every device still shows blink + bell.
 *  - Presentation is BEST-EFFORT. A successful claim means "presentation attempted",
 *    never "the doctor heard it". Only a Seen / Reviewed tap is an acknowledgement.
 *  - Events are never deleted (audit trail). Closed events stay as history.
 */

import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ClinicalCase } from "../types";
import {
  alertEventId,
  buildReminder,
  cancelPatch,
  decideAlert,
  planFiring,
  reviewedPatch,
  seenPatch,
  snoozePatch,
  applyPatch,
  type EventPatch,
  type MateEvent,
} from "../utils/mateEventEngine";

const OPEN_STATES = ["pending", "due", "seen", "reviewed"];

function eventsCol(uid: string) {
  return collection(db, "users", uid, "mateEvents");
}
function eventRef(uid: string, id: string) {
  return doc(db, "users", uid, "mateEvents", id);
}

/** Firestore rejects `undefined`; a field set to undefined in a patch means "remove it". */
function toWrite(p: EventPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) out[k] = v === undefined ? deleteField() : v;
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Live list of open events (pending / due / seen / reviewed) for the bell and case cards. */
export function subscribeMateEvents(
  uid: string,
  cb: (events: MateEvent[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(eventsCol(uid), where("alertState", "in", OPEN_STATES));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as MateEvent), id: d.id }))),
    (err) => {
      console.warn("[MATE events] subscription error", err);
      onError?.(err);
    },
  );
}

/**
 * Re-evaluate the critical + abnormal alerts for ONE case, against the server's
 * current case document. Pass the case id only — never a cached case object.
 * Individual cases owned by uid only (Phase 1). Anything else → no write.
 * Returns the number of event docs written (0, 1 or 2).
 */
export async function syncCaseAlerts(uid: string, caseId: string): Promise<number> {
  if (!uid || !caseId) return 0;
  const caseRef = doc(db, "cases", caseId);
  const critRef = eventRef(uid, alertEventId("critical", caseId));
  const abnRef = eventRef(uid, alertEventId("abnormal", caseId));
  try {
    return await runTransaction(db, async (tx) => {
      const [caseSnap, critSnap, abnSnap] = await Promise.all([tx.get(caseRef), tx.get(critRef), tx.get(abnRef)]);
      if (!caseSnap.exists()) return 0;
      const raw: any = caseSnap.data();
      if (raw?.workspaceType !== "individual" || raw?.ownerUid !== uid) return 0;
      const c = { ...raw, id: caseSnap.id } as ClinicalCase;
      const now = nowIso();
      let writes = 0;
      const pairs: Array<["critical" | "abnormal", typeof critSnap, typeof critRef]> = [
        ["critical", critSnap, critRef],
        ["abnormal", abnSnap, abnRef],
      ];
      for (const [type, snap, ref] of pairs) {
        const existing = snap.exists() ? ({ ...(snap.data() as MateEvent), id: snap.id }) : null;
        const patch = decideAlert(c, existing, type, now);
        if (patch) {
          tx.set(ref, toWrite(patch), { merge: true });
          writes++;
        }
      }
      return writes;
    });
  } catch (err) {
    // Offline or permission problems must never break case saving. Next snapshot retries.
    console.warn("[MATE events] syncCaseAlerts skipped", caseId, err);
    return 0;
  }
}

/**
 * Atomically claim one firing of an event. Returns the updated event if THIS device won
 * (and should present it), or null if it isn't due or another device already claimed it.
 */
export async function claimFiring(uid: string, eventId: string): Promise<MateEvent | null> {
  const ref = eventRef(uid, eventId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const current = { ...(snap.data() as MateEvent), id: snap.id };
      const patch = planFiring(current, nowIso());
      if (!patch) return null;
      tx.set(ref, toWrite(patch), { merge: true });
      return applyPatch(current, patch);
    });
  } catch (err) {
    console.warn("[MATE events] claimFiring failed", eventId, err);
    return null;
  }
}

type PatchBuilder = (e: MateEvent, now: string) => EventPatch | null;

async function transition(uid: string, eventId: string, build: PatchBuilder): Promise<boolean> {
  const ref = eventRef(uid, eventId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const current = { ...(snap.data() as MateEvent), id: snap.id };
      const patch = build(current, nowIso());
      if (!patch) return false;
      tx.set(ref, toWrite(patch), { merge: true });
      return true;
    });
  } catch (err) {
    console.warn("[MATE events] action failed", eventId, err);
    return false;
  }
}

/** Critical alert "Seen" — stops repeats. Clinical red stays until values change. */
export function markSeen(uid: string, eventId: string): Promise<boolean> {
  return transition(uid, eventId, (e, now) => seenPatch(e, uid, now));
}

/** Abnormal "Reviewed" / reminder "Done". */
export function markReviewed(uid: string, eventId: string): Promise<boolean> {
  return transition(uid, eventId, (e, now) => reviewedPatch(e, uid, now));
}

export function snooze(uid: string, eventId: string, minutes: number): Promise<boolean> {
  return transition(uid, eventId, (e, now) => snoozePatch(e, minutes, now));
}

/** Cancel a reminder (End Duty "Cancel"). */
export function cancelReminder(uid: string, eventId: string): Promise<boolean> {
  return transition(uid, eventId, (e, now) => cancelPatch(e, now));
}

/**
 * Create a reminder for a CONFIRMED case. `openEvents` = current subscribed list (for dedupe).
 * Returns the created reminder, or null (no case / invalid minutes / duplicate / write failed).
 */
export async function createReminder(
  uid: string,
  input: { caseId: string; bedLabel: string; minutes: number; label?: string; source?: MateEvent["source"] },
  openEvents: MateEvent[],
): Promise<MateEvent | null> {
  const r = buildReminder(input, openEvents, nowIso());
  if (!r) return null;
  try {
    await setDoc(eventRef(uid, r.id), toWrite(r));
    return r;
  } catch (err) {
    console.warn("[MATE events] createReminder failed", err);
    return null;
  }
}