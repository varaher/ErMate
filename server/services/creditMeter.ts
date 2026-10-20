import type { NextFunction, Response } from "express";
import { CREDIT_COSTS, type CreditAction } from "../../src/lib/pricing.ts";

/**
 * AI credit metering.
 *  - Free forever: case sheet, saving/viewing, triage, handover PDF, team, logbook (these routes are not metered).
 *  - A credit is deducted ONLY after a successful AI response, never for failed / simulated / fallback replies.
 *  - Fails OPEN for care: unknown balance, lookup errors, team members and the platform admin are never blocked.
 *  - Balance is server-owned (users/{uid}.aiCredits). Nothing the client sends is ever read.
 */
const PLATFORM_ADMIN_EMAIL = "varahgrp@gmail.com";

export type MeterDecision =
  | { allow: true; reason: "ok" | "unknown_balance" | "exempt" }
  | { allow: false; balance: number; required: number };

export function decideAccess(stored: unknown, cost: number): MeterDecision {
  if (cost <= 0) return { allow: true, reason: "ok" };
  if (typeof stored !== "number" || !Number.isFinite(stored)) return { allow: true, reason: "unknown_balance" };
  if (stored < cost) return { allow: false, balance: Math.max(0, stored), required: cost };
  return { allow: true, reason: "ok" };
}

/** Only genuine successes are charged. Error statuses, simulated fallbacks and explicit failures are free. */
export function shouldChargeResponse(status: number, body: any): boolean {
  if (status < 200 || status >= 300) return false;
  if (body && typeof body === "object") {
    if (body.simulated === true || body.fallback === true) return false;
    if (body.success === false) return false;
    if (typeof body.error === "string" && body.error && body.success !== true) return false;
  }
  return true;
}

/** Atomic deduction + usage ledger entry. Never goes below zero. */
export async function deductCredits(
  db: any, uid: string, action: string, cost: number, now: Date = new Date()
): Promise<{ charged: number; balanceAfter?: number }> {
  if (!uid || cost <= 0) return { charged: 0 };
  const userRef = db.collection("users").doc(uid);
  const usageRef = db.collection("creditUsage").doc();
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { charged: 0 };
    const before = snap.data()?.aiCredits;
    if (typeof before !== "number" || !Number.isFinite(before)) return { charged: 0 };
    const charged = Math.min(cost, Math.max(0, before));
    const after = before - charged;
    tx.update(userRef, { aiCredits: after });
    tx.set(usageRef, { uid, action, cost: charged, requested: cost, balanceBefore: before, balanceAfter: after, at: now.toISOString() });
    return { charged, balanceAfter: after };
  });
}

async function isExempt(db: any, uid: string, email: string): Promise<boolean> {
  if (email && email.toLowerCase() === PLATFORM_ADMIN_EMAIL) return true;
  try {
    const m = await db.collection("team_members").doc(uid).get();
    if (m.exists) {
      const d = m.data() || {};
      const st = String(d.status || "").trim().toLowerCase();
      if ((st === "active" || st === "active (joined)") && d.membershipVerified === true) return true; // covered by hospital team plan
    }
  } catch { /* fail open below */ }
  return false;
}

/** Express middleware factory. Mount AFTER requireAuth. */
export function meterCredits(action: CreditAction, getDb: () => any) {
  const cost = CREDIT_COSTS[action];
  return async (req: any, res: Response, next: NextFunction) => {
    const uid = String(req.user?.uid || "");
    if (!uid || cost <= 0) return next();
    let db: any;
    try { db = getDb(); } catch { return next(); }

    try {
      if (await isExempt(db, uid, String(req.user?.email || ""))) return next();
      const snap = await db.collection("users").doc(uid).get();
      const stored = snap.exists ? snap.data()?.aiCredits : undefined;
      const decision = decideAccess(stored, cost);
      if (decision.allow === false) {
        return res.status(402).json({
          success: false,
          code: "INSUFFICIENT_CREDITS",
          error: "AI credits finished. Your case sheet, saving and printing still work. Recharge in More > Team & Subscription to use AI features.",
          balance: decision.balance,
          required: decision.required,
        });
      }
    } catch (e: any) {
      console.warn(`[credit-meter:${action}] lookup failed; not blocking clinical use:`, e?.message || e);
      return next();
    }

    // Charge after the response is sent, only if it succeeded.
    let captured: any = undefined;
    const origJson = res.json.bind(res);
    (res as any).json = (body: any) => { captured = body; return origJson(body); };
    let charged = false;
    res.on("finish", () => {
      if (charged) return;
      charged = true;
      if (!shouldChargeResponse(res.statusCode, captured)) return;
      deductCredits(db, uid, action, cost).catch((e: any) =>
        console.error(`[credit-meter:${action}] deduction failed for ${uid}:`, e?.message || e));
    });
    return next();
  };
}
