import crypto from "crypto";
import { readFileSync } from "fs";
import { PLAN_PRICING, PLAN_KEYS } from "./src/lib/pricing";
import { verifyWebhookSignature, fulfillCapturedPayment } from "./server/services/paymentFulfillment";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL", n)); };

// ── in-memory Firestore fake: transactions are serialised (as Firestore guarantees for conflicting docs)
function makeDb(seed: Record<string, any>) {
  const store: Record<string, any> = JSON.parse(JSON.stringify(seed));
  let queue: Promise<any> = Promise.resolve();
  const ref = (path: string) => ({ path });
  const db: any = {
    store,
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
    runTransaction: (fn: any) => {
      const run = queue.then(async () => {
        const writes: Array<() => void> = [];
        const tx = {
          get: async (r: any) => ({ exists: r.path in store, data: () => (r.path in store ? JSON.parse(JSON.stringify(store[r.path])) : undefined) }),
          update: (r: any, d: any) => writes.push(() => { store[r.path] = { ...store[r.path], ...d }; }),
          set: (r: any, d: any) => writes.push(() => { store[r.path] = d; }),
        };
        const out = await fn(tx);
        writes.forEach(w => w());
        return out;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return db;
}
const seed = (planKey: string) => ({
  "users/u1": { aiCredits: 10, subscriptionTier: "Free Standard" },
  "paymentIntents/order_1": { orderId: "order_1", uid: "u1", planKey, amountPaise: PLAN_PRICING[planKey].amountPaise, credits: PLAN_PRICING[planKey].credits, status: "created" },
});
const pay = (planKey: string, over: any = {}) => ({ id: "pay_1", order_id: "order_1", amount: PLAN_PRICING[planKey].amountPaise, currency: "INR", status: "captured", ...over });

(async () => {
  // A. price table
  t("monthly 600 / 300", PLAN_PRICING.individual_pro_monthly.amountPaise === 60000 && PLAN_PRICING.individual_pro_monthly.credits === 300);
  t("recharge 300/150", PLAN_PRICING.credits_refill_150.amountPaise === 30000 && PLAN_PRICING.credits_refill_150.credits === 150);
  t("recharge 700/350", PLAN_PRICING.credits_refill_350.amountPaise === 70000 && PLAN_PRICING.credits_refill_350.credits === 350);
  t("recharge 1000/500", PLAN_PRICING.credits_refill_500.amountPaise === 100000 && PLAN_PRICING.credits_refill_500.credits === 500);
  t("flat Rs2 per credit across all packs", PLAN_KEYS.every(k => PLAN_PRICING[k].amountPaise === PLAN_PRICING[k].credits * 200));
  t("exactly four keys, no annual, no old prices", PLAN_KEYS.length === 4 && !PLAN_KEYS.some(k => /annual/.test(k)) && ![119900, 999000, 29900].some(a => PLAN_KEYS.some(k => PLAN_PRICING[k].amountPaise === a)));

  // B. signature
  const body = Buffer.from('{"event":"payment.captured"}');
  const sig = crypto.createHmac("sha256", "sec").update(body).digest("hex");
  t("valid signature", verifyWebhookSignature(body, sig, "sec"));
  t("invalid signature", !verifyWebhookSignature(body, sig.replace(/.$/, "0") === sig ? "x" : sig.replace(/.$/, "0"), "sec"));
  t("wrong secret", !verifyWebhookSignature(body, sig, "other"));
  t("missing signature", !verifyWebhookSignature(body, undefined, "sec"));
  t("short signature (length mismatch) does not throw", !verifyWebhookSignature(body, "abc", "sec"));

  // C. fulfilment
  let db = makeDb(seed("individual_pro_monthly"));
  const now = new Date("2026-10-20T10:00:00Z");
  let r = await fulfillCapturedPayment(db, pay("individual_pro_monthly"), now);
  t("monthly fulfilled", r.status === "fulfilled");
  t("credits 10+400", db.store["users/u1"].aiCredits === 310);
  t("tier set", db.store["users/u1"].subscriptionTier === "Individual Pro");
  t("expiry = +30 days", db.store["users/u1"].tierExpiresAt === "2026-11-19T10:00:00.000Z");
  t("intent fulfilled", db.store["paymentIntents/order_1"].status === "fulfilled");
  t("ledger written", db.store["creditLedger/pay_1"]?.creditsGranted === 300 && db.store["creditLedger/pay_1"].balanceBefore === 10 && db.store["creditLedger/pay_1"].balanceAfter === 310);

  // D. second delivery
  r = await fulfillCapturedPayment(db, pay("individual_pro_monthly"), now);
  t("duplicate ignored", r.status === "duplicate" && db.store["users/u1"].aiCredits === 310);

  // E. concurrent duplicates
  db = makeDb(seed("credits_refill_350"));
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => fulfillCapturedPayment(db, pay("credits_refill_350"), now)));
  t("concurrent: exactly one grant", rs.filter(x => x.status === "fulfilled").length === 1 && db.store["users/u1"].aiCredits === 360);
  t("recharge does not change tier", db.store["users/u1"].subscriptionTier === "Free Standard" && !db.store["users/u1"].tierExpiresAt);

  // F. mismatches never grant
  for (const [name, over] of [["amount", { amount: 100 }], ["currency", { currency: "USD" }], ["status", { status: "failed" }]] as const) {
    db = makeDb(seed("credits_refill_150"));
    r = await fulfillCapturedPayment(db, pay("credits_refill_150", over), now);
    t(`${name} mismatch not granted`, r.status === "mismatch" && db.store["users/u1"].aiCredits === 10 && db.store["paymentIntents/order_1"].status === "mismatch" && !db.store["creditLedger/pay_1"]);
  }
  db = makeDb({ ...seed("credits_refill_150"), "paymentIntents/order_1": { ...seed("credits_refill_150")["paymentIntents/order_1"], amountPaise: 1 } });
  r = await fulfillCapturedPayment(db, pay("credits_refill_150", { amount: 1 }), now);
  t("tampered intent amount vs price table not granted", r.status === "mismatch" && db.store["users/u1"].aiCredits === 10);
  db = makeDb({ ...seed("credits_refill_150"), "paymentIntents/order_1": { ...seed("credits_refill_150")["paymentIntents/order_1"], credits: 99999 } });
  r = await fulfillCapturedPayment(db, pay("credits_refill_150"), now);
  t("credits come from the price table, not the stored intent", r.status === "fulfilled" && db.store["users/u1"].aiCredits === 160);
  db = makeDb(seed("credits_refill_150"));
  r = await fulfillCapturedPayment(db, pay("credits_refill_150", { order_id: "order_x" }), now);
  t("unknown order ignored", r.status === "unknown_order" && db.store["users/u1"].aiCredits === 10);
  db = makeDb({ "paymentIntents/order_1": seed("credits_refill_150")["paymentIntents/order_1"] });
  r = await fulfillCapturedPayment(db, pay("credits_refill_150"), now);
  t("missing user: not fulfilled, retryable", r.status === "no_user" && db.store["paymentIntents/order_1"].status === "created");

  // G. renewal extends from active expiry
  db = makeDb({ ...seed("individual_pro_monthly"), "users/u1": { aiCredits: 5, subscriptionTier: "Individual Pro", tierExpiresAt: "2026-10-30T00:00:00.000Z" } });
  await fulfillCapturedPayment(db, pay("individual_pro_monthly"), now);
  t("early renewal extends from current expiry", db.store["users/u1"].tierExpiresAt === "2026-11-29T00:00:00.000Z");
  db = makeDb({ ...seed("individual_pro_monthly"), "users/u1": { aiCredits: 5, tierExpiresAt: "2026-01-01T00:00:00.000Z" } });
  await fulfillCapturedPayment(db, pay("individual_pro_monthly"), now);
  t("lapsed plan restarts from today", db.store["users/u1"].tierExpiresAt === "2026-11-19T10:00:00.000Z");

  // H. source guards
  const route = readFileSync("server/routes/payments.ts", "utf8");
  const ful = readFileSync("server/services/paymentFulfillment.ts", "utf8");
  const ui = readFileSync("src/components/CreditsPlanCard.tsx", "utf8");
  const srv = readFileSync("server.ts", "utf8");
  t("raw body registered before json", srv.indexOf('"/api/payments/webhook", express.raw') < srv.indexOf('app.use(express.json'));
  t("route has no outside-transaction intent read", !/intentRef\.get\(\)/.test(route));
  t("fulfilment reads intent in tx", /tx\.get\(intentRef\)/.test(ful));
  t("route uses timing-safe verify", /verifyWebhookSignature/.test(route) && /timingSafeEqual/.test(ful));
  t("route no longer holds its own price table", !/amountPaise:\s*\d/.test(route));
  t("UI buttons call server keys", (/startCheckout\("individual_pro_monthly"\)/.test(ui) || /start\("individual_pro_monthly"\)/.test(ui)) && /credits_refill_150/.test(ui));
  const fnIdx = ui.indexOf("startCheckout = async") !== -1 ? ui.indexOf("startCheckout = async") : ui.indexOf("start = async");
  t("UI never grants on success", !/aiCredits\s*[:=].*\+/.test(ui.slice(fnIdx, fnIdx + 1800)));
  t("UI says no auto-renewal", /does not renew automatically/.test(ui));
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
