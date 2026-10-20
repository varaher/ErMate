import crypto from "crypto";
import { PLAN_PRICING } from "../../src/lib/pricing.ts";

/** Constant-time HMAC check of the raw webhook body. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined, secret: string): boolean {
  if (!signature || typeof signature !== "string") return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type FulfillResult =
  | { status: "fulfilled" }
  | { status: "duplicate" }
  | { status: "unknown_order" }
  | { status: "mismatch"; reason: string }
  | { status: "no_user" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Grants credits for a captured payment. Everything that decides the grant (intent status, amount, currency,
 * user balance) is read INSIDE one Firestore transaction, so concurrent duplicate webhooks cannot double-grant.
 * Credits are never granted from the browser callback.
 */
export async function fulfillCapturedPayment(db: any, payment: any, now: Date = new Date()): Promise<FulfillResult> {
  const orderId: string | undefined = payment?.order_id;
  const paymentId: string | undefined = payment?.id;
  if (!orderId || !paymentId) return { status: "unknown_order" };

  const intentRef = db.collection("paymentIntents").doc(orderId);
  const ledgerRef = db.collection("creditLedger").doc(paymentId);

  return db.runTransaction(async (tx: any): Promise<FulfillResult> => {
    const intentSnap = await tx.get(intentRef);
    if (!intentSnap.exists) return { status: "unknown_order" };
    const intent = intentSnap.data();

    if (intent.status === "fulfilled") return { status: "duplicate" };

    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return { status: "duplicate" };

    // Price table is the authority for credits; the stored intent must agree with it AND with what was captured.
    const plan = PLAN_PRICING[intent.planKey];
    let mismatch = "";
    if (!plan) mismatch = `unknown plan ${intent.planKey}`;
    else if (intent.amountPaise !== plan.amountPaise) mismatch = "intent amount differs from price table";
    else if (Number(payment.amount) !== intent.amountPaise) mismatch = `captured amount ${payment.amount} != expected ${intent.amountPaise}`;
    else if (String(payment.currency || "").toUpperCase() !== "INR") mismatch = `currency ${payment.currency}`;
    else if (payment.status && payment.status !== "captured") mismatch = `payment status ${payment.status}`;
    if (mismatch) {
      tx.update(intentRef, { status: "mismatch", mismatchReason: mismatch, razorpayPaymentId: paymentId, updatedAt: now.toISOString() });
      return { status: "mismatch", reason: mismatch };
    }

    const userRef = db.collection("users").doc(intent.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { status: "no_user" }; // intent stays "created"; Razorpay retries / support can reconcile

    const user = userSnap.data() || {};
    const before = Number.isFinite(user.aiCredits) ? Number(user.aiCredits) : 0;
    const after = before + plan.credits;
    const update: Record<string, any> = { aiCredits: after };

    if (plan.kind === "plan") {
      const currentExpiry = user.tierExpiresAt ? Date.parse(user.tierExpiresAt) : NaN;
      const base = Number.isFinite(currentExpiry) && currentExpiry > now.getTime() ? currentExpiry : now.getTime();
      update.subscriptionTier = "Individual Pro";
      update.tierExpiresAt = new Date(base + (plan.periodDays || 30) * DAY_MS).toISOString();
    }

    tx.update(userRef, update);
    tx.update(intentRef, { status: "fulfilled", fulfilledAt: now.toISOString(), razorpayPaymentId: paymentId });
    tx.set(ledgerRef, {
      paymentId, orderId, uid: intent.uid, planKey: intent.planKey, kind: plan.kind,
      amountPaise: intent.amountPaise, creditsGranted: plan.credits,
      balanceBefore: before, balanceAfter: after, createdAt: now.toISOString(),
    });
    return { status: "fulfilled" };
  });
}
