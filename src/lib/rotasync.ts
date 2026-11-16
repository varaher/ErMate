/**
 * Rota sync helpers (pure: no network, no Firebase). Shared by the sync screen, the server routes and tests.
 *
 *  - resolveShiftTimes / normalizeShift: turn a parsed sheet row into clean start and end times.
 *    A night shift whose end clock time is before its start (20:00 to 08:00) ends the NEXT day.
 *  - pingDue: true when a shift starts within the next 30 minutes.
 *  - describeGoogleError: one plain sentence for each reason Google can refuse, with a next step.
 */

export const ROTA_PING_LEAD_MIN = 30;
export const ROTA_MAX_SHIFTS_PER_PUBLISH = 300;
export const ROTA_MAX_SHIFT_HOURS = 24;

export interface RotaShift {
  doctorEmail: string;
  shiftType: string;
  startIso: string;
  endIso: string;
}

function toMs(v: unknown): number {
  if (typeof v !== "string" || !v.trim()) return NaN;
  return new Date(v.trim()).getTime();
}

/** Start and end as ISO strings, or null when the row cannot be read. */
export function resolveShiftTimes(raw: any): { startIso: string; endIso: string } | null {
  if (!raw) return null;
  const startText = String(raw.startTime || "").trim();
  const endText = String(raw.endTime || "").trim();
  if (!startText || !endText) return null;
  let start: number;
  let end: number;
  if (startText.includes("T")) {
    start = toMs(startText);
    end = toMs(endText.includes("T") ? endText : startText.split("T")[0] + "T" + endText);
  } else {
    const day = String(raw.shiftDate || "").trim();
    start = toMs(`${day} ${startText}`);
    end = toMs(`${day} ${endText}`);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) end += 24 * 60 * 60 * 1000; // night shift ends the next morning
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/** Clean shift or null. Email is lower-cased; length is capped; a shift longer than 24 hours is rejected. */
export function normalizeShift(raw: any): RotaShift | null {
  const email = String(raw?.doctorEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 200) return null;
  const times = raw?.startIso && raw?.endIso
    ? { startIso: new Date(raw.startIso).toISOString(), endIso: new Date(raw.endIso).toISOString() }
    : resolveShiftTimes(raw);
  if (!times) return null;
  const s = Date.parse(times.startIso);
  const e = Date.parse(times.endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  if (e - s > ROTA_MAX_SHIFT_HOURS * 60 * 60 * 1000) return null;
  const shiftType = String(raw?.shiftType || "Shift").trim().slice(0, 60) || "Shift";
  return { doctorEmail: email, shiftType, startIso: times.startIso, endIso: times.endIso };
}

/** True when the shift starts within the next `lead` minutes (and has not started yet). */
export function pingDue(startMs: number, nowMs: number, lead: number = ROTA_PING_LEAD_MIN): boolean {
  if (!Number.isFinite(startMs)) return false;
  const diff = startMs - nowMs;
  return diff > 0 && diff <= lead * 60 * 1000;
}

export function minutesUntil(startMs: number, nowMs: number): number {
  return Math.max(1, Math.round((startMs - nowMs) / 60000));
}

export type GoogleApiName = "drive" | "sheets" | "calendar";
export interface GoogleErrorText { title: string; body: string; ourSide: boolean }

/** Plain wording for a Google refusal. `ourSide` = a setup problem on ErMate's side, not the doctor's. */
export function describeGoogleError(status: number, apiMessage: string, api: GoogleApiName): GoogleErrorText {
  const m = (apiMessage || "").toLowerCase();
  const name = api === "drive" ? "Drive" : api === "sheets" ? "Sheets" : "Calendar";
  if (status === 401) {
    return { title: "Your Google sign-in has expired.", body: "Tap Try again and sign in once more.", ourSide: false };
  }
  if (status === 403 && (m.includes("has not been used") || m.includes("is disabled") || m.includes("service_disabled") || m.includes("api has not"))) {
    return { title: `ErMate cannot read ${name} yet (setup issue on our side).`, body: "Nothing is wrong with your account. Please try again later.", ourSide: true };
  }
  if (status === 403 && (m.includes("scope") || m.includes("insufficient") || m.includes("permission"))) {
    return { title: `Google did not give ErMate access to your ${name}.`, body: "Tap Try again, and on the Google screen tick Drive, Sheets and Calendar.", ourSide: false };
  }
  if (status === 403) {
    return { title: `Google would not let ErMate open your ${name}.`, body: "Tap Try again and tick every box on the Google screen. If it keeps happening, tell us.", ourSide: false };
  }
  if (status === 404) {
    return { title: "That sheet could not be found.", body: "It may have been moved or deleted. Pick it again from the list.", ourSide: false };
  }
  if (status === 429) {
    return { title: "Google is busy right now.", body: "Wait a minute and tap Try again.", ourSide: false };
  }
  if (status >= 500) {
    return { title: "Google had a problem on its side.", body: "Wait a minute and tap Try again.", ourSide: false };
  }
  return { title: `Could not read your ${name}.`, body: "Check your internet and tap Try again.", ourSide: false };
}

/** Plain wording for a Firebase sign-in popup failure. */
export function describeAuthError(code: string): GoogleErrorText | null {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return { title: "The Google window was closed.", body: "Tap Connect Google again and finish the steps.", ourSide: false };
    case "auth/popup-blocked":
      return { title: "Your browser blocked the Google window.", body: "Allow pop-ups for this site, then tap Connect Google again.", ourSide: false };
    case "auth/user-mismatch":
    case "auth/wrong-password":
      return { title: "That is a different Google account.", body: "Please use the same Google account you use to sign in to ErMate.", ourSide: false };
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
      return { title: "This Google account is already used with another ErMate login.", body: "Sign in to ErMate with that Google account, then try again.", ourSide: false };
    case "auth/network-request-failed":
      return { title: "No internet connection.", body: "Check your connection and tap Try again.", ourSide: false };
    default:
      return null;
  }
}

export const REQUIRED_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/** Which of the three needed permissions are missing from a space-separated granted-scope string. */
export function missingScopes(granted: string): string[] {
  const have = new Set((granted || "").split(/\s+/).filter(Boolean));
  const out: string[] = [];
  if (!have.has(REQUIRED_GOOGLE_SCOPES[0])) out.push("Drive");
  if (!have.has(REQUIRED_GOOGLE_SCOPES[1])) out.push("Sheets");
  if (!have.has(REQUIRED_GOOGLE_SCOPES[2])) out.push("Calendar");
  return out;
}

/** Tab-separated sample the HOD can paste straight into a new Google Sheet. */
export const SAMPLE_ROTA_TSV =
  "Date\tShift\tDoctor\tEmail\tStart\tEnd\n" +
  "20 Nov 2026\tMorning\tDr A\ta@example.com\t08:00\t14:00\n" +
  "20 Nov 2026\tNight\tDr B\tb@example.com\t20:00\t08:00";

export function shiftNoticeText(shiftType: string, startMs: number, nowMs: number): { title: string; message: string } {
  const mins = minutesUntil(startMs, nowMs);
  const t = new Date(startMs).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return {
    title: `Your ${shiftType.toLowerCase()} shift starts in ${mins} minute${mins === 1 ? "" : "s"}`,
    message: `Starts at ${t}.`,
  };
}