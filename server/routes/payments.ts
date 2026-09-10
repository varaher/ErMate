import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getRazorpayClient, RAZORPAY_ENABLED } from "../services/razorpayClient";
import { db } from "../../src/lib/firebase-admin"; // using the actual path
import { requireAuth, AuthRequest } from "../../src/middleware/auth"; // using the actual path

const router = Router();

// Canonical, server-side price table. NEVER accept amount from the client.
const PLAN_PRICING: Record<string, { amountPaise: number; credits: number; label: string }> = {
  individual_pro_monthly: { amountPaise: 119900, credits: 1500, label: "Individual Pro Plan (Monthly)" },
  individual_pro_annual:  { amountPaise: 999000, credits: 1500, label: "Individual Pro Plan (Annual)" },
  credits_refill_150:     { amountPaise: 29900,  credits: 150,  label: "150 Scribe Credits Refill" },
};

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
  const plan = PLAN_PRICING[planKey];
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
      receipt: `${uid}_${Date.now()}`,
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

  const signature = req.headers["x-razorpay-signature"] as string;
  const rawBody = req.body; // must be Buffer — see express.raw() note above

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    console.warn("Razorpay webhook signature mismatch — possible spoofed request.");
    return res.status(400).send("Invalid signature.");
  }

  const event = JSON.parse(rawBody.toString());

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;

    const intentRef = db.collection("paymentIntents").doc(orderId);
    const intentSnap = await intentRef.get();

    if (!intentSnap.exists) {
      console.error(`No paymentIntent found for order ${orderId} — ignoring.`);
      return res.status(200).send("OK"); // ack anyway so Razorpay stops retrying
    }

    const intent = intentSnap.data()!;

    if (intent.status === "fulfilled") {
      // Idempotency guard — webhook can be delivered more than once.
      return res.status(200).send("OK");
    }

    const userRef = db.collection("users").doc(intent.uid);
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error(`User ${intent.uid} not found`);
      const currentCredits = userSnap.data()?.aiCredits || 0;

      tx.update(userRef, {
        aiCredits: currentCredits + intent.credits,
        subscriptionTier: intent.planKey.startsWith("individual_pro")
          ? "Individual Pro"
          : userSnap.data()?.subscriptionTier,
      });

      tx.update(intentRef, {
        status: "fulfilled",
        fulfilledAt: new Date().toISOString(),
        razorpayPaymentId: payment.id,
      });
    });
    console.log(`Payment fulfilled for uid ${intent.uid}, order ${orderId}`);
  }

  return res.status(200).send("OK");
});

export default router;
