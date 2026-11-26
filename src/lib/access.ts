/**
 * Access rules: ErMate Free / ErMate Pro (26 Nov 2026 business model).
 *
 * Pure and display/UX-level: no network, no Firebase imports. The server owns the paid
 * state (tier + tierExpiresAt are written only by verified Razorpay payments); this module
 * just reads them.
 *
 * Rules
 *  - Every doctor gets TRIAL_DAYS of full Pro access, counted from the LATER of
 *    (account creation, PAYWALL_LIVE_AT).
 *  - After the trial the doctor moves to ErMate FREE, never locked out:
 *    manual case sheet, manual discharge summary, saving, editing, viewing, print, Copy to EMR,
 *    basic log book, Drug dilutions, paediatric dosing and the basic ER Guide stay free forever.
 *  - ErMate PRO (Rs 600 Pro Starter = 30 days + 300 AI credits, then Rs 350 AutoPay) unlocks the
 *    features in PRO_FEATURES. A plan that has just ended gets GRACE_DAYS of Pro.
 *  - AI features are NOT gated here: they run on credits for Free and Pro alike (server credit meter).
 *  - The platform owner and hospital-covered verified team members always have Pro.
 *  - Patient safety: a lapse never closes patients already in care (see entitlements.ts).
 */

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 3;
/** Go-live moment for the paywall: 1 Nov 2026, 00:00 IST. Change this one line to move the date. */
export const PAYWALL_LIVE_AT = "2026-11-01T00:00:00+05:30";
export const OWNER_EMAIL = "varahgrp@gmail.com";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessState = "exempt" | "trial" | "paid" | "grace" | "free";

export interface AccessInput {
  /** Firebase auth metadata.creationTime (tamper-proof). */
  accountCreatedAt?: string | null;
  email?: string | null;
  subscriptionTier?: unknown;
  tierExpiresAt?: unknown;
  /** Verified member of a hospital whose subscription is active. */
  coveredByTeam?: boolean;
  now?: number;
  /** Test hook / config override. */
  liveAt?: string;
}

export interface AccessResult {
  state: AccessState;
  /** True when creating a NEW case / log book entry is allowed. Always true: manual documentation is free forever. */
  canCreate: boolean;
  /** True when Pro features are unlocked (trial, paid, grace, exempt). */
  isPro: boolean;
  /** Whole days left in the trial / grace window (0 when not applicable). */
  daysLeft: number;
  /** ISO time the current window ends ("" when none). */
  endsAt: string;
  /** Short user-facing line for the banner ("" when nothing to say). */
  message: string;
}

function parse(v: unknown): number {
  return typeof v === "string" ? Date.parse(v) : NaN;
}

function isProTier(tier: unknown): boolean {
  return typeof tier === "string" && tier.toLowerCase().includes("individual pro");
}

function daysUntil(end: number, now: number): number {
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

export function computeAccess(input: AccessInput): AccessResult {
  const now = input.now ?? Date.now();
  const email = (input.email || "").trim().toLowerCase();

  if (email === OWNER_EMAIL || input.coveredByTeam === true) {
    return { state: "exempt", canCreate: true, isPro: true, daysLeft: 0, endsAt: "", message: "" };
  }

  // 1. Paid plan (Individual Pro). No expiry recorded = treat as active (legacy grants).
  if (isProTier(input.subscriptionTier)) {
    const exp = parse(input.tierExpiresAt);
    if (!Number.isFinite(exp) || exp >= now) {
      const left = Number.isFinite(exp) ? daysUntil(exp, now) : 0;
      return {
        state: "paid",
        canCreate: true,
        isPro: true,
        daysLeft: left,
        endsAt: Number.isFinite(exp) ? new Date(exp).toISOString() : "",
        message: left > 0 && left <= 5 ? `Your plan renews or ends in ${left} day${left === 1 ? "" : "s"}.` : "",
      };
    }
    const graceEnd = exp + GRACE_DAYS * DAY_MS;
    if (now <= graceEnd) {
      const left = daysUntil(graceEnd, now);
      return {
        state: "grace",
        canCreate: true,
        isPro: true,
        daysLeft: left,
        endsAt: new Date(graceEnd).toISOString(),
        message: `Your plan has ended. Renew within ${left} day${left === 1 ? "" : "s"} to keep adding new cases.`,
      };
    }
  }

  // 2. Trial. If the account date is unknown we do not lock anyone out.
  const created = parse(input.accountCreatedAt);
  if (!Number.isFinite(created)) {
    return { state: "trial", canCreate: true, isPro: true, daysLeft: 0, endsAt: "", message: "" };
  }
  const live = Date.parse(input.liveAt || PAYWALL_LIVE_AT);
  const start = Number.isFinite(live) ? Math.max(created, live) : created;
  const trialEnd = start + TRIAL_DAYS * DAY_MS;
  if (now < trialEnd) {
    const left = daysUntil(trialEnd, now);
    return {
      state: "trial",
      canCreate: true,
      isPro: true,
      daysLeft: left,
      endsAt: new Date(trialEnd).toISOString(),
      message: left <= 7 ? `Free trial: ${left} day${left === 1 ? "" : "s"} left.` : "",
    };
  }

  return {
    state: "free",
    canCreate: true,
    isPro: false,
    daysLeft: 0,
    endsAt: new Date(trialEnd).toISOString(),
    message: FREE_BANNER,
  };
}

// ---------- Free / Pro feature map (change a feature's plan HERE only) ----------

export type ProFeature =
  | "er-guide-full" | "vent-graphics" | "handbook" | "simulations"
  | "handover" | "icu" | "rounds" | "analytics" | "logbook-export" | "teams-create";

export const PRO_FEATURES: Record<ProFeature, string> = {
  "er-guide-full": "Full ER Guide",
  "vent-graphics": "Ventilator graphics",
  "handbook": "ErMate Handbook (protocols)",
  "simulations": "Clinical simulations",
  "handover": "Shift handover",
  "icu": "ICU mode",
  "rounds": "ICU rounds",
  "analytics": "Analytics",
  "logbook-export": "Log book export",
  "teams-create": "Create a team",
};

/** ER Guide tabs that stay free. Every other ER Guide tab needs Pro. */
export const FREE_GUIDE_TABS: readonly string[] = ["rsi", "vent", "mnemonics", "pediatric", "pocketmirror"];

/** What ErMate Free always includes (shown on the upgrade sheet and plans card). */
export const FREE_INCLUDES: readonly string[] = [
  "Manual case sheet and discharge summary",
  "Save, edit, print and Copy to EMR",
  "All your saved cases",
  "Basic log book",
  "Drug dilutions and paediatric dosing",
  "AI features with credits",
];

export function canUseFeature(a: Pick<AccessResult, "isPro">, _feature: ProFeature): boolean {
  return a.isPro === true;
}

export function canOpenGuideTab(a: Pick<AccessResult, "isPro">, tabId: string): boolean {
  return a.isPro === true || FREE_GUIDE_TABS.includes(tabId);
}

export const FREE_BANNER = "You are on ErMate Free. Manual case sheets and discharge summaries stay free.";

/** Upgrade sheet wording (one sheet for every Pro feature). */
export const PRO_TITLE = "Unlock ErMate Pro";
export const PRO_STARTER_LINE = "Pro Starter Rs 600: 30 days of Pro + 300 AI credits (worth Rs 600). Then Rs 350 a month with optional AutoPay; renewals do not include credits.";
export const PRO_INCLUDES: readonly string[] = [
  "Full ER Guide, Handbook and ventilator graphics",
  "Shift handover, ICU mode and rounds",
  "Clinical simulations",
  "Analytics and log book export",
];
/** Kept for older imports: the trial-end wording. */
export const LOCKED_TITLE = "Your trial has ended";
export const LOCKED_BODY =
  "You are now on ErMate Free. Manual case sheets, discharge summaries, saving, printing, Copy to EMR and your log book stay free. Your saved cases stay with you. Upgrade to Pro for the full ER Guide, handover, ICU mode and more.";
 
/** Trial reminder pop-up: which milestone (days left bucket) applies. 14, 7, 3, 1 days left, 0 = trial ended. null = none. */
export type TrialMilestone = 14 | 7 | 3 | 1 | 0;
export function trialMilestone(a: Pick<AccessResult, "state" | "daysLeft">): TrialMilestone | null {
  if (a.state === "free") return 0;
  if (a.state !== "trial" || a.daysLeft <= 0 || a.daysLeft > 14) return null;
  if (a.daysLeft <= 1) return 1;
  if (a.daysLeft <= 3) return 3;
  if (a.daysLeft <= 7) return 7;
  return 14;
}
 
export interface TrialStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
const trialKey = (uid: string) => `ermate_trial_popup_${uid}`;
function readSeen(store: TrialStore, uid: string): Record<string, string> {
  try { const o = JSON.parse(store.getItem(trialKey(uid)) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}
/** True when this milestone's pop-up has not been finished (seen) and is not snoozed until a later day. */
export function shouldShowTrialPopup(store: TrialStore, uid: string, m: TrialMilestone | null, today: string): boolean {
  if (m === null || !uid) return false;
  const v = readSeen(store, uid)[String(m)];
  if (!v) return true;
  if (v === "seen") return false;
  return v < today; // snoozed on an earlier day
}
export function markTrialPopup(store: TrialStore, uid: string, m: TrialMilestone, how: "seen" | "snooze", today: string): void {
  const o = readSeen(store, uid);
  o[String(m)] = how === "seen" ? "seen" : today;
  try { store.setItem(trialKey(uid), JSON.stringify(o)); } catch { /* storage blocked: popup may repeat */ }
}
export function trialPopupText(m: TrialMilestone, daysLeft: number, endsAt: string): { title: string; big: string; body: string } {
  const tail = "Everything you have saved stays viewable, printable and ready to copy to your EMR.";
  if (m === 0) return { title: "Your trial has ended", big: "ErMate Free", body: LOCKED_BODY };
  const end = endsAt ? new Date(endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  return {
    title: "Your free trial is ending soon",
    big: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    body: `${end ? `Your free trial ends on ${end}. ` : ""}After that you move to ErMate Free: manual case sheets and discharge summaries stay free. Keep Pro with Pro Starter Rs 600 (30 days + 300 AI credits), then Rs 350 a month. ${tail}`,
  };
}