import { useEffect, useRef } from "react";
import { fetchMyShifts, MyShift } from "../services/rotashifts";
import { pingDue, shiftNoticeText } from "../lib/rotasync";

type Notify = (title: string, message: string, type?: "info" | "success" | "warning", linkView?: string, actionKey?: string) => void;

const PINGED_KEY = "ermate_rota_pinged";
const SEEN_KEY = "ermate_rota_seen_publish";
const REFRESH_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;

function readPinged(): string[] {
  try { const a = JSON.parse(localStorage.getItem(PINGED_KEY) || "[]"); return Array.isArray(a) ? a.slice(-200) : []; } catch { return []; }
}

/**
 * While ErMate is open: tells the doctor when the rota was sent or updated, and pings 30 minutes before each shift.
 * Does nothing for doctors with no shifts. It cannot ring a phone while the app is closed (that needs push).
 */
export function useRotaShiftAlerts(signedIn: boolean, notify: Notify) {
  const shiftsRef = useRef<MyShift[]>([]);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const { shifts, latestPublishedAt } = await fetchMyShifts();
        if (cancelled) return;
        shiftsRef.current = shifts;
        if (latestPublishedAt && shifts.length > 0) {
          let seen = "";
          try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch { /* ignore */ }
          if (latestPublishedAt > seen) {
            const next = shifts.find((s) => Date.parse(s.startIso) > Date.now());
            const when = next ? new Date(next.startIso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";
            notifyRef.current("Your rota is updated", next ? `Next shift: ${next.shiftType}, ${when}.` : "Open Team to see your shifts.", "info", "more");
            try { localStorage.setItem(SEEN_KEY, latestPublishedAt); } catch { /* ignore */ }
          }
        }
      } catch { /* offline or not in a team: stay quiet */ }
    };

    const tick = () => {
      const now = Date.now();
      const pinged = readPinged();
      let changed = false;
      for (const s of shiftsRef.current) {
        const start = Date.parse(s.startIso);
        if (pingDue(start, now) && !pinged.includes(s.id + "|" + s.startIso)) {
          const t = shiftNoticeText(s.shiftType, start, now);
          notifyRef.current(t.title, t.message, "warning", "more");
          pinged.push(s.id + "|" + s.startIso);
          changed = true;
        }
      }
      if (changed) { try { localStorage.setItem(PINGED_KEY, JSON.stringify(pinged.slice(-200))); } catch { /* ignore */ } }
    };

    refresh();
    const r = setInterval(refresh, REFRESH_MS);
    const t = setInterval(tick, TICK_MS);
    return () => { cancelled = true; clearInterval(r); clearInterval(t); };
  }, [signedIn]);
}