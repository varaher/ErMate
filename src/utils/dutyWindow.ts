/**
 * Canonical Duty Window Resolver (ErMate — Patch D1)
 *
 * Pure, reusable duty-window resolution for:
 * - normal same-day clinical shifts
 * - overnight shifts crossing midnight
 * - custom hospital shifts
 * - Off Duty / malformed shift entries
 *
 * Zero dependencies on React, Firebase, localStorage, or UI state.
 * Uses local device timezone without hard-coded offsets.
 */

export interface DutyShiftLike {
  id?: string;
  name?: string;
  time?: string;
}

export interface DutyWindow {
  shiftId: string | null;
  shiftName: string | null;

  start: Date;
  end: Date;

  crossesMidnight: boolean;

  /**
   * Local YYYY-MM-DD representing the CALENDAR DATE on which
   * this duty shift started.
   */
  dutyDateKey: string;

  /**
   * Whether the given reference time falls within [start, end)
   * (start is inclusive, end is exclusive).
   */
  isActive: boolean;
}

/**
 * Parses time format: "HH:mm - HH:mm", tolerating en-dash (–), em-dash (—),
 * hyphens (-), and varying whitespace.
 */
const SHIFT_TIME_REGEX = /^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/;

/**
 * Returns a local date formatted as YYYY-MM-DD using local calendar components.
 * Does NOT use UTC toISOString() to avoid calendar day shifts.
 */
export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolves the canonical DutyWindow for a given shift and reference time.
 *
 * @param shift - Object with a `time` string (e.g. "08:00 - 14:00", "20:00 - 08:00")
 * @param now - Reference Date (defaults to new Date())
 * @returns DutyWindow or null if the shift is off-duty, malformed, or missing
 */
export function resolveDutyWindow(
  shift: DutyShiftLike | null | undefined,
  now?: Date
): DutyWindow | null {
  if (!shift || typeof shift.time !== "string") {
    return null;
  }

  const trimmedTime = shift.time.trim();
  if (!trimmedTime || trimmedTime.toLowerCase() === "off duty") {
    return null;
  }

  const match = trimmedTime.match(SHIFT_TIME_REGEX);
  if (!match) {
    return null;
  }

  const startH = parseInt(match[1], 10);
  const startM = parseInt(match[2], 10);
  const endH = parseInt(match[3], 10);
  const endM = parseInt(match[4], 10);

  // Validate hour and minute ranges
  if (
    isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM) ||
    startH < 0 || startH > 23 || startM < 0 || startM > 59 ||
    endH < 0 || endH > 23 || endM < 0 || endM > 59
  ) {
    return null;
  }

  // Reject identical start and end times (do not invent 24h duty)
  if (startH === endH && startM === endM) {
    return null;
  }

  const ref = now ? new Date(now) : new Date();
  if (isNaN(ref.getTime())) {
    return null;
  }

  const currentY = ref.getFullYear();
  const currentM = ref.getMonth();
  const currentD = ref.getDate();

  const nowMinutes = ref.getHours() * 60 + ref.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let start: Date;
  let end: Date;
  let crossesMidnight = false;

  if (startMinutes < endMinutes) {
    // ── SAME-DAY SHIFT (e.g. 08:00 - 14:00, 08:00 - 18:00) ───────────
    crossesMidnight = false;
    start = new Date(currentY, currentM, currentD, startH, startM, 0, 0);
    end = new Date(currentY, currentM, currentD, endH, endM, 0, 0);
  } else {
    // ── OVERNIGHT SHIFT CROSSING MIDNIGHT (e.g. 20:00 - 08:00, 18:00 - 08:00) ──
    crossesMidnight = true;

    if (nowMinutes >= startMinutes) {
      // 1. Current clock is on or after shift start before midnight (e.g. 22:00)
      // Anchor start to TODAY
      start = new Date(currentY, currentM, currentD, startH, startM, 0, 0);
      end = new Date(currentY, currentM, currentD + 1, endH, endM, 0, 0);
    } else if (nowMinutes < endMinutes) {
      // 2. Current clock is after midnight and before shift end (e.g. 02:00, 07:59)
      // Anchor start to YESTERDAY (this is still the same duty)
      start = new Date(currentY, currentM, currentD - 1, startH, startM, 0, 0);
      end = new Date(currentY, currentM, currentD, endH, endM, 0, 0);
    } else {
      // 3. Current clock is between shift end and upcoming shift start (e.g. 10:00)
      // Anchor start to TODAY as the upcoming shift
      start = new Date(currentY, currentM, currentD, startH, startM, 0, 0);
      end = new Date(currentY, currentM, currentD + 1, endH, endM, 0, 0);
    }
  }

  const dutyDateKey = formatLocalDateKey(start);
  const isActive = ref.getTime() >= start.getTime() && ref.getTime() < end.getTime();

  return {
    shiftId: shift.id || null,
    shiftName: shift.name || null,
    start,
    end,
    crossesMidnight,
    dutyDateKey,
    isActive,
  };
}

/**
 * Convenience helper to test whether a given timestamp falls within a resolved DutyWindow.
 */
export function isWithinDutyWindow(
  window: DutyWindow | null | undefined,
  timestamp: Date | string | number
): boolean {
  if (!window) return false;
  const target = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(target.getTime())) return false;
  return target.getTime() >= window.start.getTime() && target.getTime() < window.end.getTime();
}
