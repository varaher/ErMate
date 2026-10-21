import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { CREDIT_COSTS, PLAN_PRICING } from "./src/lib/pricing";
import { meterCredits, isPlanExpired, needsEmailVerification } from "./server/services/creditMeter";
import { fulfillCapturedPayment, fulfillRefund } from "./server/services/paymentFulfillment";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL", n)); };

function makeDb(seed: Record<string, any>, opts: { failUsersGet?: boolean } = {}) {
  const store: Record<string, any> = JSON.parse(JSON.stringify(seed));
  let n = 0; let queue: Promise<any> = Promise.resolve();
  const mkRef = (path: string) => ({ path, get: async () => {
    if (opts.failUsersGet && path.startsWith("users/")) throw new Error("boom");
    return { exists: path in store, data: () => (path in store ? JSON.parse(JSON.stringify(store[path])) : undefined) };
  } });
  return {
    store,
    collection: (c: string) => ({ doc: (id?: string) => mkRef(`${c}/${id ?? "auto" + ++n}`) }),
    runTransaction: (fn: any) => {
      const run = queue.then(async () => {
        const w: Array<() => void> = [];
        const tx = {
          get: async (r: any) => r.get(),
          update: (r: any, d: any) => w.push(() => { store[r.path] = { ...store[r.path], ...d }; }),
          set: (r: any, d: any) => w.push(() => { store[r.path] = d; }),
        };
        const out = await fn(tx); w.forEach(x => x()); return out;
      });
      queue = run.catch(() => {}); return run;
    },
  };
}
const flush = () => new Promise(r => setTimeout(r, 20));
// run the middleware with a fake req/res; handler decides status+body
async function call(db: any, action: any, user: any, status: number, body: any, sendJson = true) {
  const res: any = new EventEmitter();
  res.statusCode = 200; res.sent = null;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.sent = b; res.emit("finish"); return res; };
  let nexted = false;
  await meterCredits(action, () => db)({ user } as any, res, () => { nexted = true; });
  if (nexted) { res.statusCode = status; if (sendJson) res.json(body); else res.emit("finish"); }
  await flush();
  return { nexted, res };
}
const DAY = 86400000;
const NOW = new Date("2026-10-21T00:00:00.000Z");
const src = readFileSync("server/routes/payments.ts", "utf8");
const card = readFileSync("src/components/CreditsPlanCard.tsx", "utf8");

(async () => {
  // A. pure helpers
  t("expired pro detected", isPlanExpired({ subscriptionTier: "Individual Pro", tierExpiresAt: "2026-10-01T00:00:00Z" }, NOW.getTime()));
  t("active pro not expired", !isPlanExpired({ subscriptionTier: "Individual Pro", tierExpiresAt: "2026-11-01T00:00:00Z" }, NOW.getTime()));
  t("free never 'expired'", !isPlanExpired({ subscriptionTier: "Free Standard", tierExpiresAt: "2020-01-01T00:00:00Z" }, NOW.getTime()));
  t("pro without date not expired", !isPlanExpired({ subscriptionTier: "Individual Pro" }, NOW.getTime()));
  t("verified token passes gate", !needsEmailVerification({}, true));
  t("unverified, never paid: gated", needsEmailVerification({ aiCredits: 100 }, false));
  t("missing claim: gated", needsEmailVerification({}, undefined));
  t("unverified but has purchased: not gated", !needsEmailVerification({ hasPurchased: true }, false));

  // B. middleware: verified-email gate
  let db: any = makeDb({ "users/u1": { aiCredits: 50 } });
  let c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: false }, 200, { success: true });
  t("unverified: 403 EMAIL_NOT_VERIFIED, handler not run", !c.nexted && c.res.statusCode === 403 && c.res.sent?.code === "EMAIL_NOT_VERIFIED");
  t("unverified: nothing charged", db.store["users/u1"].aiCredits === 50);
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: true }, 200, { success: true });
  t("verified: allowed and charged 1", c.nexted && db.store["users/u1"].aiCredits === 49);
  db = makeDb({ "users/u1": { aiCredits: 50, hasPurchased: true } });
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: false }, 200, { success: true });
  t("paid user not blocked by gate", c.nexted);
  db = makeDb({ "users/admin": { aiCredits: 0 } });
  c = await call(db, "scribe_chat", { uid: "admin", email: "varahgrp@gmail.com", email_verified: false }, 200, { success: true });
  t("platform admin exempt from gate", c.nexted);
  db = makeDb({ "users/u1": { aiCredits: 5 }, "team_members/u1": { status: "Active", membershipVerified: true, hospitalId: "h1" }, "hospital_subscriptions/h1": { active: true } });
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: false }, 200, { success: true });
  t("verified team member exempt from gate", c.nexted);

  // C. middleware: lazy expiry downgrade (credits kept)
  db = makeDb({ "users/u1": { aiCredits: 40, subscriptionTier: "Individual Pro", tierExpiresAt: "2020-01-01T00:00:00.000Z", hasPurchased: true } });
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: true }, 200, { success: true });
  t("expired pro: request still served", c.nexted);
  t("expired pro: tier -> Free Standard", db.store["users/u1"].subscriptionTier === "Free Standard");
  t("expired pro: credits kept (minus the 1 used)", db.store["users/u1"].aiCredits === 39);
  db = makeDb({ "users/u1": { aiCredits: 40, subscriptionTier: "Individual Pro", tierExpiresAt: "2999-01-01T00:00:00.000Z", hasPurchased: true } });
  await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: true }, 200, { success: true });
  t("active pro untouched", db.store["users/u1"].subscriptionTier === "Individual Pro");

  // D. purchase marks hasPurchased
  const planSeed = () => ({
    "users/u1": { aiCredits: 10, subscriptionTier: "Free Standard" },
    "paymentIntents/order_1": { orderId: "order_1", uid: "u1", planKey: "individual_pro_monthly", amountPaise: 60000, credits: 300, status: "created" },
  });
  db = makeDb(planSeed());
  await fulfillCapturedPayment(db, { id: "pay_1", order_id: "order_1", amount: 60000, currency: "INR", status: "captured" }, NOW);
  t("purchase sets hasPurchased", db.store["users/u1"].hasPurchased === true && db.store["users/u1"].aiCredits === 310);
  const paidExpiry = db.store["users/u1"].tierExpiresAt;

  // E. refunds
  let r = await fulfillRefund(db, { id: "rfnd_1", payment_id: "pay_1", amount: 60000 }, NOW);
  t("full refund: revoked 300", r.status === "revoked" && (r as any).creditsRevoked === 300 && db.store["users/u1"].aiCredits === 10);
  t("full refund: tier -> Free, expiry cleared", db.store["users/u1"].subscriptionTier === "Free Standard" && db.store["users/u1"].tierExpiresAt === null);
  r = await fulfillRefund(db, { id: "rfnd_1", payment_id: "pay_1", amount: 60000 }, NOW);
  t("same refund id again: duplicate, no change", r.status === "duplicate" && db.store["users/u1"].aiCredits === 10);

  db = makeDb(planSeed());
  await fulfillCapturedPayment(db, { id: "pay_1", order_id: "order_1", amount: 60000, currency: "INR", status: "captured" }, NOW);
  r = await fulfillRefund(db, { id: "rfnd_h", payment_id: "pay_1", amount: 30000 }, NOW);
  t("half refund: 150 credits revoked, tier kept", r.status === "revoked" && (r as any).creditsRevoked === 150 && db.store["users/u1"].aiCredits === 160 && db.store["users/u1"].subscriptionTier === "Individual Pro");
  r = await fulfillRefund(db, { id: "rfnd_h2", payment_id: "pay_1", amount: 30000 }, NOW);
  t("second half: remaining 150 revoked, tier dropped", (r as any).creditsRevoked === 150 && db.store["users/u1"].aiCredits === 10 && db.store["users/u1"].subscriptionTier === "Free Standard");
  r = await fulfillRefund(db, { id: "rfnd_x", payment_id: "pay_1", amount: 60000 }, NOW);
  t("over-refund cannot revoke more than granted", (r as any).creditsRevoked === 0 && db.store["users/u1"].aiCredits === 10);

  db = makeDb(planSeed());
  await fulfillCapturedPayment(db, { id: "pay_1", order_id: "order_1", amount: 60000, currency: "INR", status: "captured" }, NOW);
  db.store["users/u1"].aiCredits = 20; // spent most of it
  r = await fulfillRefund(db, { id: "rfnd_s", payment_id: "pay_1", amount: 60000 }, NOW);
  t("spent credits: balance floors at 0, shortfall recorded", db.store["users/u1"].aiCredits === 0 && (r as any).shortfall === 280 && db.store["creditRefunds/rfnd_s"].shortfall === 280);

  db = makeDb(planSeed());
  await fulfillCapturedPayment(db, { id: "pay_1", order_id: "order_1", amount: 60000, currency: "INR", status: "captured" }, new Date(NOW.getTime() - 5 * DAY));
  await fulfillCapturedPayment(db, { id: "pay_2", order_id: "order_2", amount: 60000, currency: "INR", status: "captured" }, NOW).catch(() => {});
  db.store["paymentIntents/order_2"] = { orderId: "order_2", uid: "u1", planKey: "individual_pro_monthly", amountPaise: 60000, credits: 300, status: "created" };
  await fulfillCapturedPayment(db, { id: "pay_2", order_id: "order_2", amount: 60000, currency: "INR", status: "captured" }, NOW);
  const stacked = Date.parse(db.store["users/u1"].tierExpiresAt);
  r = await fulfillRefund(db, { id: "rfnd_st", payment_id: "pay_2", amount: 60000 }, NOW);
  t("stacked renewal refunded: still Pro, 30 days removed", db.store["users/u1"].subscriptionTier === "Individual Pro" && Date.parse(db.store["users/u1"].tierExpiresAt) === stacked - 30 * DAY);

  db = makeDb({ "users/u1": { aiCredits: 10 } });
  r = await fulfillRefund(db, { id: "rfnd_a", payment_id: "pay_ARYA", amount: 5000 }, NOW);
  t("refund for a payment ErMate never fulfilled (ARYA): ignored", r.status === "unknown_payment" && db.store["users/u1"].aiCredits === 10);
  r = await fulfillRefund(db, { id: "", payment_id: "", amount: 0 }, NOW);
  t("malformed refund ignored", r.status === "unknown_payment");

  // F. wiring
  t("webhook handles refund.processed", /event\?\.event === "refund\.processed"/.test(src) && src.includes("fulfillRefund(db, refund)"));
  t("webhook still returns 500 on refund error (Razorpay retries)", src.includes('Refund error'));
  t("card shows verify-email notice with resend + recheck", card.includes("verify-email-notice") && card.includes("resend-verification") && card.includes("recheck-verification") && card.includes("getIdToken(true)"));

  console.log(`verify_expiry_refund_verified: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
