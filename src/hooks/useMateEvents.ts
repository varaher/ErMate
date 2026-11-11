/**
 * ErMate — MATE Events hook. MATE Events Phase 1, Steps 7–8.
 *
 * Connects the pure engine + Firestore service to the app (in-app only; push = Phase 2):
 *  - live list of open MATE events (for bell / case cards in the next steps)
 *  - re-checks alerts for cases that were added / changed (server-confirmed, see service)
 *  - fires due events: immediately when a new due event arrives, every 30 s, and when
 *    the app comes back to the foreground
 *  - only the device that WINS the claim shows the toast and speaks (two devices → one voice)
 *
 * Also publishes the events + actions to mateEventStore so case cards and the bell can
 * show them without props (Step 8).
 *
 * Presentation is best-effort. A toast or voice is never an acknowledgement;
 * only Seen / Reviewed taps are.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { speakMate } from "../mate/mateSpeech";
import { planFiring, type MateEvent } from "../utils/mateEventEngine";
import {
  claimFiring,
  markReviewed,
  markSeen,
  snooze,
  subscribeMateEvents,
  syncCaseAlerts,
} from "../services/mateEventService";
import { publishMateEvents } from "../mate/mateEventStore";

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;

const TICK_MS = 30_000;
const SYNC_DELAY_MS = 3_000;   // let the case save reach the server first
const SYNC_RECHECK_MS = 15_000; // second pass in case the save was still in flight

export function useMateEvents(notify: Notify) {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [mateEvents, setMateEvents] = useState<MateEvent[]>([]);
  const uidRef = useRef<string | null>(uid);
  const eventsRef = useRef<MateEvent[]>([]);
  const notifyRef = useRef<Notify>(notify);
  const claimingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());

  notifyRef.current = notify;

  // Follow sign-in / sign-out.
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      const next = u?.uid ?? null;
      uidRef.current = next;
      setUid(next);
    });
    return unsub;
  }, []);

  // Live open events for this user.
  useEffect(() => {
    eventsRef.current = [];
    setMateEvents([]);
    if (!uid) return;
    const unsub = subscribeMateEvents(uid, (list) => {
      eventsRef.current = list;
      setMateEvents(list);
    });
    return () => unsub();
  }, [uid]);

  // Clear pending sync timers on sign-out / unmount.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((ts) => ts.forEach(clearTimeout));
      timersRef.current.clear();
    };
  }, [uid]);

  /** Fire every event that is due now. Safe to call often; the claim is atomic. */
  const fireDue = useCallback(async () => {
    const u = uidRef.current;
    if (!u) return;
    const now = new Date().toISOString();
    const due = eventsRef.current.filter((e) => planFiring(e, now) !== null);
    for (const e of due) {
      if (claimingRef.current.has(e.id)) continue;
      claimingRef.current.add(e.id);
      try {
        const won = await claimFiring(u, e.id);
        if (!won) continue;
        const isCritical = won.type === "critical";
        try {
          notifyRef.current(won.title, `${won.bedLabel} · ${won.body}`, isCritical ? "warning" : "info");
        } catch { /* presentation must never throw */ }
        try {
          speakMate(`${won.bedLabel}. ${won.title}. ${won.body}`, { urgent: isCritical });
        } catch { /* best-effort */ }
      } finally {
        claimingRef.current.delete(e.id);
      }
    }
  }, []);

  // Fire immediately when the event list changes (a new red alert presents within seconds).
  useEffect(() => {
    void fireDue();
  }, [mateEvents, fireDue]);

  // Every 30 s, and when the app returns to the foreground.
  useEffect(() => {
    if (!uid) return;
    const id = setInterval(() => void fireDue(), TICK_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void fireDue();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [uid, fireDue]);

  /**
   * Ask MATE to re-check alerts for these cases (ids only). Debounced per case.
   * Absent cases are never passed — absence never closes an alert.
   */
  const queueCaseSync = useCallback((caseIds: string[]) => {
    const u = uidRef.current;
    if (!u) return;
    for (const id of caseIds) {
      if (!id) continue;
      (timersRef.current.get(id) || []).forEach(clearTimeout);
      const run = () => {
        const cur = uidRef.current;
        if (cur) void syncCaseAlerts(cur, id);
      };
      timersRef.current.set(id, [setTimeout(run, SYNC_DELAY_MS), setTimeout(run, SYNC_RECHECK_MS)]);
    }
  }, []);

  const onSeen = useCallback((eventId: string) => {
    const u = uidRef.current;
    return u ? markSeen(u, eventId) : Promise.resolve(false);
  }, []);

  const onReviewed = useCallback((eventId: string) => {
    const u = uidRef.current;
    return u ? markReviewed(u, eventId) : Promise.resolve(false);
  }, []);

  const onSnooze = useCallback((eventId: string, minutes: number) => {
    const u = uidRef.current;
    return u ? snooze(u, eventId, minutes) : Promise.resolve(false);
  }, []);

  // Share with case cards / bell (Step 8).
  useEffect(() => {
    publishMateEvents(mateEvents, uid ? { seen: onSeen, reviewed: onReviewed, snooze: onSnooze } : null);
  }, [mateEvents, uid, onSeen, onReviewed, onSnooze]);

  return { mateEvents, queueCaseSync, onSeen, onReviewed, onSnooze };
}