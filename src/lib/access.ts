/**
 * Access rules for creating NEW clinical records (trial -> paid).
 *
 * Pure and display/UX-level: no network, no Firebase imports. The server owns the paid
 * state (tier + tierExpiresAt are written only by verified Razorpay payments); this module
 * just reads them.
 *
 * Rules
 *  - Every doctor gets TRIAL_DAYS of full access, counted from the LATER of
 *    (account creation, PAYWALL_LIVE_AT). Existing doctors therefore get a fresh trial
 *    from go-live day.
 *  - After the trial, new cases and new log book entries need an active paid plan
 *    (Rs 600 pack, then Rs 350 AutoPay). A plan that has just ended gets GRACE_DAYS.
 *  - A locked doctor can still VIEW, PRINT and COPY TO EMR everything already saved,
 *    and can keep editing a patient who is already in the system (patient safety).
 *  - The platform owner and hospital-covered verified team members are never locked.
 */

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 3;
/** Go-live moment for the paywall: 1 Nov 2026, 00:00 IST. Change this one line to move the date. */
export const PAYWALL_LIVE_AT = "2026-11-01T00:00:00+05:30";
export const OWNER_EMAIL = "varahgrp@gmail.com";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessState = "exempt" | "trial" | "paid" | "grace" | "locked";

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
  /** True when creating a NEW case / log book entry is allowed. */
  canCreate: boolean;
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
    return { state: "exempt", canCreate: true, daysLeft: 0, endsAt: "", message: "" };
  }

  // 1. Paid plan (Individual Pro). No expiry recorded = treat as active (legacy grants).
  if (isProTier(input.subscriptionTier)) {
    const exp = parse(input.tierExpiresAt);
    if (!Number.isFinite(exp) || exp >= now) {
      const left = Number.isFinite(exp) ? daysUntil(exp, now) : 0;
      return {
        state: "paid",
        canCreate: true,
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
        daysLeft: left,
        endsAt: new Date(graceEnd).toISOString(),
        message: `Your plan has ended. Renew within ${left} day${left === 1 ? "" : "s"} to keep adding new cases.`,
      };
    }
  }

  // 2. Trial. If the account date is unknown we do not lock anyone out.
  const created = parse(input.accountCreatedAt);
  if (!Number.isFinite(created)) {
    return { state: "trial", canCreate: true, daysLeft: 0, endsAt: "", message: "" };
  }
  const live = Date.parse(input.liveAt || PAYWALL_LIVE_AT);
  const start = Number.isFinite(live) ? Math.max(created, live) : created;
  const trialEnd = start + TRIAL_DAYS * DAY_MS;
  if (now < trialEnd) {
    const left = daysUntil(trialEnd, now);
    return {
      state: "trial",
      canCreate: true,
      daysLeft: left,
      endsAt: new Date(trialEnd).toISOString(),
      message: left <= 7 ? `Free trial: ${left} day${left === 1 ? "" : "s"} left.` : "",
    };
  }

  return {
    state: "locked",
    canCreate: false,
    daysLeft: 0,
    endsAt: new Date(trialEnd).toISOString(),
    message: "Your free trial has ended. Activate a plan to add new cases and log book entries.",
  };
}

/** Wording shown when a locked doctor tries to start something new. */
export const LOCKED_TITLE = "Free trial ended";
export const LOCKED_BODY =
  "You can still view, print and Copy to EMR everything you have saved, and finish patients already in the system. To add new cases and log book entries, activate the Rs 600 plan (includes 300 AI credits) and then Rs 350 a month.";