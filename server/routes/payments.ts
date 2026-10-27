import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getRazorpayClient, RAZORPAY_ENABLED } from "../services/razorpayClient.ts";
import { db } from "../../src/lib/firebase-admin.ts"; // using the actual path
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts"; // using the actual path
import { PLAN_PRICING } from "../../src/lib/pricing.ts";
import { verifyWebhookSignature, fulfillCapturedPayment, fulfillRefund } from "../services/paymentFulfillment.ts";
import { configuredPlanId, createAutopaySubscription, cancelAutopay, handleSubscriptionEvent, buildAutopayView } from "../services/autopay.ts";

const router = Router();

// Canonical, server-side price table lives in src/lib/pricing.ts (shared with the UI for display only).

/**
 * POST /api/payments/create-order
 * body: { planKey: string }
 * Creates a Razorpay order server-side using the canonical price table.
 * Client NEVER supplies amount/credits directly.
 */
router.post("/create-order", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!RAZORPAY_ENABLED) {
    return res.status(503).json({ error: "Payments are not yet enabled." });
  }

  const { planKey } = req.body;
  const plan = typeof planKey === "string" && Object.prototype.hasOwnProperty.call(PLAN_PRICING, planKey) ? PLAN_PRICING[planKey] : undefined;
  if (!plan) {
    return res.status(400).json({ error: "Invalid plan selected." });
  }

  // req.user comes from our auth middleware
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      receipt: `em_${crypto.randomUUID().replace(/-/g, "")}`,
      notes: {
        firebaseUid: uid,
        planKey,
      },
    });

    // Record a pending payment intent so the webhook has something to reconcile against.
    await db.collection("paymentIntents").doc(order.id).set({
      orderId: order.id,
      uid: uid,
      planKey,
      amountPaise: plan.amountPaise,
      credits: plan.credits,
      currency: "INR",
      status: "created",
      createdAt: new Date().toISOString(),
    });

    return res.json({
      orderId: order.id,
      amount: plan.amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("Razorpay order creation failed:", err);
    return res.status(500).json({ error: "Failed to create payment order." });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay server-to-server webhook. This is the ONLY place credits/tier
 * are ever granted. The client-side "success" callback is never trusted.
 * Must be registered with express.raw({ type: "application/json" }) BEFORE
 * the global json() body parser, or signature verification will fail.
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("RAZORPAY_WEBHOOK_SECRET not configured.");
    return res.status(500).send("Webhook not configured.");
  }

  const rawBody = req.body; // Buffer, from express.raw() registered before express.json()
  if (!Buffer.isBuffer(rawBody)) {
    console.error("Razorpay webhook body is not a raw Buffer; check middleware order.");
    return res.status(400).send("Bad request.");
  }

  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.warn("Razorpay webhook signature mismatch — possible spoofed request.");
    return res.status(400).send("Invalid signature.");
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid payload.");
  }

  if (event?.event === "refund.processed") {
    try {
      const refund = event.payload?.refund?.entity;
      const r = await fulfillRefund(db, refund);
      if (r.status === "revoked") console.log(`Refund ${refund?.id} applied: ${r.creditsRevoked} credits revoked, shortfall ${r.shortfall}, tierDowngraded=${r.tierDowngraded}`);
      if (r.status === "no_user") return res.status(500).send("User not found.");
      // A fully refunded plan/renewal payment must not leave a live AutoPay mandate behind.
      // Runs for duplicates too, so a Razorpay retry finishes a cancel that failed the first time.
      if ((r.status === "revoked" || r.status === "duplicate") && r.planFullyRefunded && r.uid && RAZORPAY_ENABLED) {
        const c = await cancelAutopay({ db, rz: getRazorpayClient(), uid: r.uid, reason: "refund" });
        if (c.status === "error") return res.status(500).send("AutoPay cancel pending.");
      }
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Refund handling failed:", err);
      return res.status(500).send("Refund error.");
    }
  }

  // AutoPay (Razorpay Subscriptions). Only a verified `subscription.charged` extends access; see services/autopay.ts.
  if (typeof event?.event === "string" && event.event.startsWith("subscription.")) {
    try {
      const r = await handleSubscriptionEvent(db, event, { planId: configuredPlanId() });
      if (r.status === "fulfilled") console.log(`AutoPay renewal fulfilled: ${event.payload?.payment?.entity?.id}`);
      else if (r.status === "mismatch") console.error(`AutoPay payment NOT fulfilled: ${r.reason}`);
      else if (r.status === "ignored") console.log(`AutoPay event ${event.event} ignored: ${r.reason}`);
      if (r.status === "no_user") return res.status(500).send("User not found.");
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Subscription webhook failed:", err);
      return res.status(500).send("Subscription error."); // Razorpay retries; fulfilment is idempotent
    }
  }

  if (event?.event !== "payment.captured") return res.status(200).send("OK");
  // Subscription invoices also emit payment.captured; they are fulfilled via subscription.charged only.
  if (event.payload?.payment?.entity?.invoice_id) return res.status(200).send("OK");

  try {
    const payment = event.payload?.payment?.entity;
    const result = await fulfillCapturedPayment(db, payment);
    if (result.status === "fulfilled") console.log(`Payment fulfilled: order ${payment.order_id}`);
    else if (result.status === "mismatch") console.error(`Payment ${payment?.id} NOT fulfilled: ${result.reason}`);
    else if (result.status === "unknown_order") console.error(`No paymentIntent for order ${payment?.order_id} — ignoring.`);
    // no_user: return 500 so Razorpay retries after the account exists / support reconciles
    if (result.status === "no_user") return res.status(500).send("User not found.");
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook fulfillment failed:", err);
    return res.status(500).send("Fulfillment error."); // Razorpay will retry; fulfillment is idempotent
  }
});

/**
 * AutoPay endpoints. None of these grant access: that happens only in the signed webhook.
 *  GET  /api/payments/autopay          status + first/next renewal date (shown before the mandate is approved)
 *  POST /api/payments/autopay/create   creates the subscription server-side (duplicate-safe) -> subscription_id
 *  POST /api/payments/autopay/cancel   cancels the mandate; paid access is preserved
 */
router.get("/autopay", requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [u, s] = await Promise.all([db.collection("users").doc(uid).get(), db.collection("autopaySubscriptions").doc(uid).get()]);
    return res.json(buildAutopayView(u.exists ? u.data() : null, s.exists ? s.data() : null, RAZORPAY_ENABLED ? configuredPlanId() : null));
  } catch {
    return res.status(503).json({ error: "Could not load AutoPay status. Please try again." });
  }
});

router.post("/autopay/create", requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!RAZORPAY_ENABLED) return res.status(503).json({ error: "Payments are not yet enabled." });
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const r = await createAutopaySubscription({ db, rz: getRazorpayClient(), uid, planId: configuredPlanId() });
    if (r.status === "created") {
      return res.json({ subscriptionId: r.subscriptionId, keyId: process.env.RAZORPAY_KEY_ID, firstRenewalAt: r.firstRenewalAt, amount: 35000, currency: "INR", reused: r.reused });
    }
    const http = r.code === "NOT_CONFIGURED" || r.code === "PLAN_INVALID" ? 503 : r.code === "FAILED" ? 502 : r.code === "UNCERTAIN" ? 503 : 409;
    return res.status(http).json({ error: r.message, code: r.code });
  } catch (err: any) {
    console.error("AutoPay create failed:", err?.message || err);
    return res.status(500).json({ error: "Could not start AutoPay setup. Please try again." });
  }
});

router.post("/autopay/cancel", requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!RAZORPAY_ENABLED) return res.status(503).json({ error: "Payments are not yet enabled." });
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const r = await cancelAutopay({ db, rz: getRazorpayClient(), uid, reason: "user" });
    if (r.status === "error") return res.status(502).json({ error: r.message });
    return res.json({ status: r.status });
  } catch (err: any) {
    console.error("AutoPay cancel failed:", err?.message || err);
    return res.status(500).json({ error: "Could not cancel AutoPay. Please try again." });
  }
});

// Read-only confirmation for the authenticated owner. Only the webhook grants access.
router.get("/orders/:orderId", requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const orderId = String(req.params.orderId || "");
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId)) {
    return res.status(400).json({ error: "Invalid order." });
  }
  try {
    const snapshot = await db.collection("paymentIntents").doc(orderId).get();
    if (!snapshot.exists || snapshot.data()?.uid !== req.user?.uid) {
      return res.status(404).json({ error: "Order not found." });
    }
    const intent = snapshot.data()!;
    return res.json({ orderId, status: intent.status, planKey: intent.planKey });
  } catch {
    return res.status(503).json({ error: "Could not confirm payment yet. Please check again." });
  }
});

export default router;