import crypto from "crypto";
import { CORE_AUTOPAY } from "../../src/lib/pricing.ts";

/**
 * Razorpay AutoPay (monthly subscription) for ErMate Core.
 *
 * Rules (see README / AGENTS.md):
 *  - Initial Rs 600 purchase is unchanged and still the only thing that starts paid access.
 *  - AutoPay is enabled AFTER a verified purchase; the first Rs 350 charge is scheduled at the end of the
 *    paid period (start_at = tierExpiresAt). No upfront subscription charge, no add-ons.
 *  - ONLY a verified `subscription.charged` (captured, 35000 paise, INR, our plan, our subscription) extends
 *    access, once per payment id. Mandate authorization alone never extends access. Renewals never add credits.
 *  - One live subscription per user, enforced by a Firestore transaction on autopaySubscriptions/{uid}.
 *  - Events that are not ours (e.g. ARYA, unknown subscriptions or plans) are ignored.
 */

export const AUTOPAY_PLAN_ENV = "RAZORPAY_CORE_MONTHLY_PLAN_ID";
export const PLAN_ID_RE = /^plan_[A-Za-z0-9]{6,40}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_LEAD_MS = 10 * 60 * 1000;          // first charge must be at least this far ahead
export const CREATING_LOCK_MS = 2 * 60 * 1000;      // an in-flight create blocks duplicates this long
const RENEWAL_GRACE_MS = DAY_MS;
export const CREATED_REUSE_MS = 24 * 60 * 60 * 1000; // an unauthorised subscription is reused, not re-created

export const LIVE_STATUSES = ["authenticated", "active", "pending"] as const;
const TERMINAL_STATUSES = ["cancelled", "completed", "expired", "failed"];

export function configuredPlanId(env: Record<string, string | undefined> = process.env): string | null {
  const v = String(env[AUTOPAY_PLAN_ENV] || "").trim();
  return PLAN_ID_RE.test(v) ? v : null;
}

/** The plan must charge exactly Rs 350 (35000 paise) in INR once every month. */
export function validatePlanEntity(plan: any, expectedId?: string): { ok: true } | { ok: false; reason: string } {
  if (!plan || typeof plan !== "object") return { ok: false, reason: "plan not found" };
  if (expectedId && plan.id !== expectedId) return { ok: false, reason: "plan id mismatch" };
  if (String(plan.period || "").toLowerCase() !== "monthly") return { ok: false, reason: `plan period is ${plan.period}, expected monthly` };
  if (Number(plan.interval) !== 1) return { ok: false, reason: `plan interval is ${plan.interval}, expected 1` };
  const amount = Number(plan.item?.amount);
  if (amount !== CORE_AUTOPAY.amountPaise) return { ok: false, reason: `plan amount is ${plan.item?.amount} paise, expected ${CORE_AUTOPAY.amountPaise}` };
  if (String(plan.item?.currency || "").toUpperCase() !== "INR") return { ok: false, reason: `plan currency is ${plan.item?.currency}, expected INR` };
  return { ok: true };
}

let planCache: { planId: string; at: number } | null = null;
export function resetPlanCache() { planCache = null; }

export async function loadValidatedPlan(rz: any, planId: string, now: number = Date.now()): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (planCache && planCache.planId === planId && now - planCache.at < 10 * 60 * 1000) return { ok: true };
  let plan: any;
  try { plan = await rz.plans.fetch(planId); }
  catch (e: any) { return { ok: false, reason: `could not fetch plan (${e?.statusCode || e?.message || "error"})` }; }
  const v = validatePlanEntity(plan, planId);
  if (v.ok) planCache = { planId, at: now };
  return v;
}

// ───────────────────────── eligibility ─────────────────────────

export type Eligibility =
  | { ok: true; firstRenewalAt: string; startAtSec: number }
  | { ok: false; code: "NOT_PURCHASED" | "NO_PAID_PERIOD"; message: string };

/** AutoPay needs a verified purchase (webhook-set, server-owned fields) whose paid period is still running. */
export function checkEligibility(user: any, now: number = Date.now()): Eligibility {
  const pro = typeof user?.subscriptionTier === "string" && user.subscriptionTier.toLowerCase().includes("individual pro");
  if (!user || user.hasPurchased !== true || !pro) {
    return { ok: false, code: "NOT_PURCHASED", message: "Complete the ₹600 plan purchase first. AutoPay starts after your paid period." };
  }
  const exp = typeof user.tierExpiresAt === "string" ? Date.parse(user.tierExpiresAt) : NaN;
  if (!Number.isFinite(exp) || exp < now + MIN_LEAD_MS) {
    return { ok: false, code: "NO_PAID_PERIOD", message: "Your paid period has ended or ends very soon. Renew with the ₹600 plan, then enable AutoPay." };
  }
  return { ok: true, firstRenewalAt: new Date(exp).toISOString(), startAtSec: Math.floor(exp / 1000) };
}

// ───────────────────────── create (duplicate-safe) ─────────────────────────

export type CreateResult =
  | { status: "created"; subscriptionId: string; firstRenewalAt: string; reused: boolean }
  | { status: "error"; code: "NOT_PURCHASED" | "NO_PAID_PERIOD" | "ALREADY_ACTIVE" | "IN_PROGRESS" | "UNCERTAIN" | "PLAN_INVALID" | "NOT_CONFIGURED" | "FAILED"; message: string };

const ms = (iso: any) => { const t = typeof iso === "string" ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : 0; };

async function findSubscriptionByAttempt(rz: any, attemptId: string, planId: string, attemptAtMs: number): Promise<any | null> {
  const from = Math.max(0, Math.floor(attemptAtMs / 1000) - 600);
  const list: any = await rz.subscriptions.all({ count: 100, from });
  const items: any[] = Array.isArray(list?.items) ? list.items : [];
  return items.find(s => s?.notes?.attemptId === attemptId && s?.plan_id === planId && !["cancelled", "expired"].includes(String(s?.status))) || null;
}

export async function createAutopaySubscription(deps: {
  db: any; rz: any; uid: string; planId: string | null; now?: number; newAttemptId?: () => string;
}): Promise<CreateResult> {
  const { db, rz, uid } = deps;
  const now = deps.now ?? Date.now();
  const newAttemptId = deps.newAttemptId || (() => crypto.randomUUID().replace(/-/g, ""));
  if (!deps.planId) return { status: "error", code: "NOT_CONFIGURED", message: "AutoPay is not available yet." };
  const planId = deps.planId;
  const plan = await loadValidatedPlan(rz, planId, now);
  if (plan.ok === false) { console.error(`[autopay] plan ${planId} rejected: ${plan.reason}`); return { status: "error", code: "PLAN_INVALID", message: "AutoPay is not available right now." }; }

  const userRef = db.collection("users").doc(uid);
  const subRef = db.collection("autopaySubscriptions").doc(uid);
  const attemptId = newAttemptId();

  type Decision =
    | { action: "blocked"; result: CreateResult }
    | { action: "reuse"; subscriptionId: string; firstRenewalAt: string }
    | { action: "reconcile"; oldAttemptId: string; oldAttemptAt: number; firstRenewalAt: string; startAtSec: number }
    | { action: "create"; firstRenewalAt: string; startAtSec: number; staleCreatedId?: string };

  const decision: Decision = await db.runTransaction(async (tx: any): Promise<Decision> => {
    const [uSnap, sSnap] = await Promise.all([tx.get(userRef), tx.get(subRef)]);
    const elig = checkEligibility(uSnap.exists ? uSnap.data() : null, now);
    if (elig.ok === false) return { action: "blocked", result: { status: "error", code: elig.code, message: elig.message } };
    const cur = sSnap.exists ? sSnap.data() || {} : {};
    const status = String(cur.status || "");
    if ((LIVE_STATUSES as readonly string[]).includes(status)) {
      return { action: "blocked", result: { status: "error", code: "ALREADY_ACTIVE", message: "AutoPay is already set up for your account." } };
    }
    if (status === "created" && cur.razorpaySubscriptionId && now - ms(cur.createdAt) < CREATED_REUSE_MS && cur.startAt === elig.startAtSec) {
      return { action: "reuse", subscriptionId: cur.razorpaySubscriptionId, firstRenewalAt: elig.firstRenewalAt };
    }
    if (status === "creating") {
      if (now - ms(cur.attemptAt) < CREATING_LOCK_MS) {
        return { action: "blocked", result: { status: "error", code: "IN_PROGRESS", message: "AutoPay setup is already in progress. Please wait a minute and check again." } };
      }
      return { action: "reconcile", oldAttemptId: String(cur.attemptId || ""), oldAttemptAt: ms(cur.attemptAt), firstRenewalAt: elig.firstRenewalAt, startAtSec: elig.startAtSec };
    }
    tx.set(subRef, { uid, status: "creating", attemptId, attemptAt: new Date(now).toISOString(), planId, startAt: elig.startAtSec, previousSubscriptionId: cur.razorpaySubscriptionId || null });
    return { action: "create", firstRenewalAt: elig.firstRenewalAt, startAtSec: elig.startAtSec, staleCreatedId: status === "created" ? cur.razorpaySubscriptionId : undefined };
  });

  if (decision.action === "blocked") return decision.result;
  if (decision.action === "reuse") return { status: "created", subscriptionId: decision.subscriptionId, firstRenewalAt: decision.firstRenewalAt, reused: true };

  let startAtSec = decision.startAtSec;
  const firstRenewalAt = decision.firstRenewalAt;
  // An old, never-authorised subscription is cancelled so it can never become a second mandate.
  if (decision.action === "create" && decision.staleCreatedId) {
    try { await rz.subscriptions.cancel(decision.staleCreatedId, false); } catch { /* already gone or not cancellable */ }
  }

  if (decision.action === "reconcile") {
    // A previous create ended without a confirmed result. Look for it at Razorpay before creating anything new.
    let found: any = null;
    try { found = await findSubscriptionByAttempt(rz, decision.oldAttemptId, planId, decision.oldAttemptAt); }
    catch { return { status: "error", code: "UNCERTAIN", message: "We could not confirm your earlier AutoPay setup. Please try again in a few minutes. You will not be charged twice." }; }
    if (found?.id) {
      await db.runTransaction(async (tx: any) => {
        tx.set(subRef, { uid, status: "created", razorpaySubscriptionId: found.id, attemptId: decision.oldAttemptId, planId, startAt: found.start_at ?? startAtSec, amountPaise: CORE_AUTOPAY.amountPaise, createdAt: new Date(now).toISOString() });
      });
      return { status: "created", subscriptionId: found.id, firstRenewalAt, reused: true };
    }
    await db.runTransaction(async (tx: any) => {
      tx.set(subRef, { uid, status: "creating", attemptId, attemptAt: new Date(now).toISOString(), planId, startAt: startAtSec });
    });
  }

  let sub: any;
  try {
    sub = await rz.subscriptions.create({
      plan_id: planId,
      total_count: CORE_AUTOPAY.totalCount,
      quantity: 1,
      customer_notify: 1,
      start_at: startAtSec,
      notes: { app: "ermate", firebaseUid: uid, attemptId, planKey: CORE_AUTOPAY.planKey },
    });
  } catch (e: any) {
    const code = Number(e?.statusCode);
    if (code >= 400 && code < 500) {
      // Razorpay definitely rejected it: nothing exists, safe to release the lock.
      await db.runTransaction(async (tx: any) => { tx.set(subRef, { uid, status: "failed", attemptId, failedAt: new Date(now).toISOString(), planId }); });
      console.error("[autopay] create rejected:", e?.error?.description || e?.message || code);
      return { status: "error", code: "FAILED", message: "Could not start AutoPay setup. Please try again later." };
    }
    // Network/5xx: it may exist at Razorpay. Keep the lock; the next attempt reconciles by attemptId.
    console.error("[autopay] create uncertain:", e?.message || e);
    return { status: "error", code: "UNCERTAIN", message: "AutoPay setup could not be confirmed. Please wait a few minutes and try again. You will not be charged twice." };
  }

  if (!sub?.id || typeof sub.id !== "string" || sub.plan_id !== planId) {
    return { status: "error", code: "UNCERTAIN", message: "AutoPay setup could not be confirmed. Please wait a few minutes and try again." };
  }
  await db.runTransaction(async (tx: any) => {
    tx.set(subRef, { uid, status: "created", razorpaySubscriptionId: sub.id, attemptId, planId, startAt: startAtSec, amountPaise: CORE_AUTOPAY.amountPaise, createdAt: new Date(now).toISOString() });
  });
  return { status: "created", subscriptionId: sub.id, firstRenewalAt, reused: false };
}

// ───────────────────────── cancel ─────────────────────────

export type CancelResult =
  | { status: "cancelled" }
  | { status: "none" }
  | { status: "error"; message: string };

const ALREADY_GONE = /already|not cancel|cancelled|completed|expired|no such|not found/i;

/** Cancels any live/created mandate immediately (no further charges). Paid access in users/{uid} is never touched. */
export async function cancelAutopay(deps: { db: any; rz: any; uid: string; reason?: string; now?: number }): Promise<CancelResult> {
  const { db, rz, uid } = deps;
  const now = deps.now ?? Date.now();
  const subRef = db.collection("autopaySubscriptions").doc(uid);
  const snap = await subRef.get();
  if (!snap.exists) return { status: "none" };
  const cur = snap.data() || {};
  const status = String(cur.status || "");
  if (TERMINAL_STATUSES.includes(status)) return { status: "none" };

  let subscriptionId: string | undefined = cur.razorpaySubscriptionId;
  if (!subscriptionId && status === "creating") {
    try {
      const found = await findSubscriptionByAttempt(rz, String(cur.attemptId || ""), String(cur.planId || ""), ms(cur.attemptAt));
      subscriptionId = found?.id;
    } catch { return { status: "error", message: "Could not confirm your AutoPay setup right now. Please try again in a minute." }; }
  }
  if (subscriptionId) {
    try { await rz.subscriptions.cancel(subscriptionId, false); }
    catch (e: any) {
      const text = `${e?.error?.description || ""} ${e?.message || ""}`;
      if (!(Number(e?.statusCode) === 400 && ALREADY_GONE.test(text))) {
        console.error("[autopay] cancel failed:", text || e);
        return { status: "error", message: "Could not cancel AutoPay right now. Please try again." };
      }
    }
  }
  await db.runTransaction(async (tx: any) => {
    tx.set(subRef, { ...cur, status: "cancelled", cancelledAt: new Date(now).toISOString(), cancelReason: deps.reason || "user" });
  });
  return { status: "cancelled" };
}

// ───────────────────────── webhook ─────────────────────────

export type SubscriptionEventResult =
  | { status: "ignored"; reason: string }
  | { status: "updated" }
  | { status: "fulfilled" }
  | { status: "duplicate" }
  | { status: "mismatch"; reason: string }
  | { status: "no_user" };

const STATUS_BY_EVENT: Record<string, string> = {
  "subscription.authenticated": "authenticated",
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "completed",
  "subscription.paused": "paused",
  "subscription.resumed": "active",
};
export const SUBSCRIPTION_WEBHOOK_EVENTS = Object.keys(STATUS_BY_EVENT);
const iso = (sec: any) => (Number.isFinite(Number(sec)) && Number(sec) > 0 ? new Date(Number(sec) * 1000).toISOString() : undefined);

export async function handleSubscriptionEvent(db: any, event: any, opts: { planId: string | null; now?: Date }): Promise<SubscriptionEventResult> {
  const now = opts.now ?? new Date();
  const name: string = String(event?.event || "");
  const nextStatus = STATUS_BY_EVENT[name];
  if (!nextStatus) return { status: "ignored", reason: "event not handled" };
  const sub = event?.payload?.subscription?.entity;
  if (!sub?.id) return { status: "ignored", reason: "no subscription" };
  if (sub.notes?.app !== "ermate" || typeof sub.notes?.firebaseUid !== "string" || !sub.notes.firebaseUid) return { status: "ignored", reason: "not an ErMate subscription" };
  if (!opts.planId || sub.plan_id !== opts.planId) return { status: "ignored", reason: "different plan" };
  const uid: string = sub.notes.firebaseUid;

  const subRef = db.collection("autopaySubscriptions").doc(uid);
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx: any): Promise<SubscriptionEventResult> => {
    const sSnap = await tx.get(subRef);
    if (!sSnap.exists) return { status: "ignored", reason: "no local record" };
    const cur = sSnap.data() || {};
    let record = cur;
    if (cur.razorpaySubscriptionId !== sub.id) {
      // Adopt only the subscription our own in-flight attempt created (create succeeded but the save was lost).
      if (cur.status === "creating" && cur.attemptId && cur.attemptId === sub.notes.attemptId && !cur.razorpaySubscriptionId) {
        record = { ...cur, razorpaySubscriptionId: sub.id, amountPaise: CORE_AUTOPAY.amountPaise };
      } else return { status: "ignored", reason: "subscription does not belong to this account record" };
    }
    const terminal = TERMINAL_STATUSES.includes(String(record.status));
    const patch: Record<string, any> = { ...record, uid, updatedAt: now.toISOString() };
    if (!terminal || nextStatus === "cancelled" || nextStatus === "completed") patch.status = nextStatus;
    const chargeAt = iso(sub.charge_at);
    if (chargeAt) patch.nextChargeAt = chargeAt;
    if (typeof sub.paid_count === "number") patch.paidCount = sub.paid_count;
    if (nextStatus === "pending" || nextStatus === "halted") patch.lastFailureAt = now.toISOString();

    if (name !== "subscription.charged") { tx.set(subRef, patch); return { status: "updated" }; }

    // ── verified renewal: the ONLY path that extends access ──
    const payment = event?.payload?.payment?.entity;
    const paymentId: string | undefined = payment?.id;
    if (!paymentId) return { status: "mismatch", reason: "no payment in charged event" };
    const ledgerRef = db.collection("creditLedger").doc(paymentId);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return { status: "duplicate" };

    let mismatch = "";
    if (Number(payment.amount) !== CORE_AUTOPAY.amountPaise) mismatch = `amount ${payment.amount} != ${CORE_AUTOPAY.amountPaise}`;
    else if (String(payment.currency || "").toUpperCase() !== "INR") mismatch = `currency ${payment.currency}`;
    else if (payment.status !== "captured") mismatch = `payment status ${payment.status}`;
    if (mismatch) {
      tx.set(db.collection("autopayMismatches").doc(paymentId), { paymentId, uid, subscriptionId: sub.id, reason: mismatch, at: now.toISOString() });
      return { status: "mismatch", reason: mismatch };
    }
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists) return { status: "no_user" };
    const user = uSnap.data() || {};
    const curExp = user.tierExpiresAt ? Date.parse(user.tierExpiresAt) : NaN;
    // On-time renewals (charged at the end of the paid period, webhook seconds later) continue from the old expiry so
    // there is no drift; a renewal after a long lapse counts from now.
    const base = Number.isFinite(curExp) && curExp > now.getTime() - RENEWAL_GRACE_MS ? curExp : now.getTime();
    const newExpiry = new Date(base + CORE_AUTOPAY.periodDays * DAY_MS).toISOString();
    const credits = Number.isFinite(user.aiCredits) ? Number(user.aiCredits) : 0;

    // NOTE: aiCredits is deliberately NOT written. Renewals never add credits.
    tx.update(userRef, { subscriptionTier: "Individual Pro", tierExpiresAt: newExpiry, hasPurchased: true });
    tx.set(ledgerRef, {
      paymentId, subscriptionId: sub.id, uid, planKey: CORE_AUTOPAY.planKey, kind: "plan", source: "autopay",
      amountPaise: CORE_AUTOPAY.amountPaise, creditsGranted: 0, balanceBefore: credits, balanceAfter: credits, createdAt: now.toISOString(),
    });
    tx.set(subRef, { ...patch, lastChargedAt: now.toISOString(), lastPaymentId: paymentId });
    return { status: "fulfilled" };
  });
}

// ───────────────────────── status view ─────────────────────────

export interface AutopayView {
  configured: boolean;
  amountPaise: number;
  status: "none" | "creating" | "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "paused" | "failed";
  canEnable: boolean;
  reason?: string;
  firstRenewalAt?: string;   // shown BEFORE mandate approval
  nextRenewalAt?: string;    // when a mandate is live
  accessUntil?: string;
  lastFailureAt?: string;
}

export function buildAutopayView(user: any, rec: any, planId: string | null, now: number = Date.now()): AutopayView {
  const status = (String(rec?.status || "none") as AutopayView["status"]);
  const elig = checkEligibility(user, now);
  const live = (LIVE_STATUSES as readonly string[]).includes(status);
  const view: AutopayView = {
    configured: !!planId, amountPaise: CORE_AUTOPAY.amountPaise, status,
    canEnable: !!planId && elig.ok && !live && status !== "creating",
  };
  if (user?.tierExpiresAt) view.accessUntil = user.tierExpiresAt;
  if (elig.ok === true) view.firstRenewalAt = elig.firstRenewalAt; else view.reason = elig.message;
  if (live) view.nextRenewalAt = rec?.nextChargeAt || (typeof rec?.startAt === "number" ? iso(rec.startAt) : undefined) || view.accessUntil;
  if (rec?.lastFailureAt && (status === "pending" || status === "halted")) view.lastFailureAt = rec.lastFailureAt;
  return view;
}