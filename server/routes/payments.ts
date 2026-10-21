import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getRazorpayClient, RAZORPAY_ENABLED } from "../services/razorpayClient.ts";
import { db } from "../../src/lib/firebase-admin.ts"; // using the actual path
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts"; // using the actual path
import { PLAN_PRICING } from "../../src/lib/pricing.ts";
import { verifyWebhookSignature, fulfillCapturedPayment, fulfillRefund } from "../services/paymentFulfillment.ts";

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
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Refund handling failed:", err);
      return res.status(500).send("Refund error.");
    }
  }

  if (event?.event !== "payment.captured") return res.status(200).send("OK");

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
