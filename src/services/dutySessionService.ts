/**
 * Duty Session Service (ErMate — Patch D2)
 *
 * Persisted Duty Session Architecture:
 * - PLANNED DUTY: Shared roster / team shift (suggestion only)
 * - ACTUAL DUTY: Doctor confirms/selects shift -> persisted duty session (cross-device source of truth)
 * - HOME: Uses active duty session for visibility & duty metrics
 *
 * Stored under `users/{uid}/meta/activeDutySession` (governed by Firestore user-owner rules).
 */

import { doc, setDoc, onSnapshot, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { resolveDutyWindow, DutyShiftLike, DutyWindow } from "../utils/dutyWindow";

export interface DutySessionRecord {
  id: string;
  uid: string;
  shiftId: string;
  shiftName: string;
  shiftTime: string;
  dutyDateKey: string;
  start: string; // ISO string
  end: string;   // ISO string
  crossesMidnight: boolean;
  startedAt: string; // ISO string
  endedAt: string | null;
  status: "active" | "ended";
  hospital?: string;
  hospitalId?: string;
  updatedAt?: any;
}

/**
 * Canonical Duty Validity Helper (Patch D2B)
 * Determines whether a duty session record is currently active based on:
 * - session exists and status === "active"
 * - now >= session.start
 * - now < session.end
 */
export function isActiveDutySessionNow(
  session: DutySessionRecord | null | undefined,
  now?: Date
): boolean {
  if (!session || session.status !== "active") return false;
  const ref = now ? new Date(now) : new Date();
  if (isNaN(ref.getTime())) return false;
  const startMs = new Date(session.start).getTime();
  const endMs = new Date(session.end).getTime();
  if (isNaN(startMs) || isNaN(endMs)) return false;
  return ref.getTime() >= startMs && ref.getTime() < endMs;
}

/**
 * Starts a new persistent duty session for the doctor.
 * Stores in users/{uid}/meta/activeDutySession as the cross-device source of truth.
 *
 * Enforces Patch D2B invariant: The shift must be active at the current clock time!
 */
export async function startDutySession(
  uid: string,
  shift: DutyShiftLike,
  options?: {
    now?: Date;
    hospital?: string;
    hospitalId?: string;
  }
): Promise<DutySessionRecord | null> {
  if (!uid || !shift || !shift.time) return null;

  const now = options?.now || new Date();
  const window: DutyWindow | null = resolveDutyWindow(shift, now);
  if (!window) return null;

  // Strict invariant: Cannot start a future or ended shift as an active duty session
  if (!window.isActive) {
    return null;
  }

  const sessionId = `duty-${uid}-${window.dutyDateKey}-${Date.now()}`;
  const record: DutySessionRecord = {
    id: sessionId,
    uid,
    shiftId: shift.id || "custom",
    shiftName: shift.name || "Emergency Shift",
    shiftTime: shift.time,
    dutyDateKey: window.dutyDateKey,
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    crossesMidnight: window.crossesMidnight,
    startedAt: now.toISOString(),
    endedAt: null,
    status: "active",
    hospital: options?.hospital || "",
    hospitalId: options?.hospitalId || "",
  };

  try {
    const metaRef = doc(db, "users", uid, "meta", "activeDutySession");
    await setDoc(metaRef, {
      ...record,
      updatedAt: serverTimestamp(),
    });

    // Also cache locally for offline/instant resume
    try {
      localStorage.setItem("ermate_activeDutySession", JSON.stringify(record));
      localStorage.setItem("ermate_isOnShift", "true");
      localStorage.setItem("ermate_shiftDate", window.dutyDateKey);
    } catch (e) {}

    return record;
  } catch (err) {
    console.error("[dutySessionService] Failed to start duty session:", err);
    // Offline fallback
    try {
      localStorage.setItem("ermate_activeDutySession", JSON.stringify(record));
      localStorage.setItem("ermate_isOnShift", "true");
      localStorage.setItem("ermate_shiftDate", window.dutyDateKey);
    } catch (e) {}
    return record;
  }
}

/**
 * Ends the active duty session for the doctor across all devices.
 * Session-safe & atomic: ensures a caller can end ONLY the exact session it observed.
 * Prevents an expiry callback from an old duty session from terminating a newer duty session.
 */
export async function endDutySession(
  uid: string,
  expectedSessionId: string
): Promise<boolean> {
  if (!uid || !expectedSessionId) return false;

  let didEnd = false;
  try {
    const metaRef = doc(db, "users", uid, "meta", "activeDutySession");
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(metaRef);
      if (!snap.exists()) {
        return;
      }
      const current = snap.data() as DutySessionRecord;
      if (current.id !== expectedSessionId) {
        // Current session is different from the one caller intended to end; do not touch!
        return;
      }
      if (current.status !== "active") {
        // Already ended or inactive; idempotent return
        return;
      }

      transaction.update(metaRef, {
        status: "ended",
        endedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      didEnd = true;
    });
  } catch (err) {
    console.error("[dutySessionService] Failed to end duty session in transaction:", err);
  }

  // Session-safe local storage cleanup: remove or update ONLY if cached ID matches expectedSessionId
  try {
    const saved = localStorage.getItem("ermate_activeDutySession");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id === expectedSessionId) {
        parsed.status = "ended";
        parsed.endedAt = new Date().toISOString();
        localStorage.setItem("ermate_activeDutySession", JSON.stringify(parsed));
        localStorage.setItem("ermate_isOnShift", "false");
      }
    }
  } catch (e) {}

  return didEnd;
}

/**
 * Real-time listener for the user's active duty session.
 * Syncs automatically across tabs and devices.
 */
export function subscribeActiveDutySession(
  uid: string,
  onUpdate: (session: DutySessionRecord | null) => void
): () => void {
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  const metaRef = doc(db, "users", uid, "meta", "activeDutySession");
  const unsubscribe = onSnapshot(
    metaRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data() as DutySessionRecord;
      if (data && data.status === "active") {
        if (isActiveDutySessionNow(data, new Date())) {
          onUpdate(data);
        } else {
          // Stale active record: end time has passed while offline / app was closed
          onUpdate(null);
          // Safely and idempotently close stale active session in Firestore using its exact ID
          endDutySession(uid, data.id).catch(() => {});
        }
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn("[dutySessionService] Realtime session listener fallback:", err);
      // Fallback to localStorage if offline
      try {
        const saved = localStorage.getItem("ermate_activeDutySession");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.status === "active" && isActiveDutySessionNow(parsed, new Date())) {
            onUpdate(parsed);
            return;
          }
        }
      } catch (e) {}
      onUpdate(null);
    }
  );

  return unsubscribe;
}
