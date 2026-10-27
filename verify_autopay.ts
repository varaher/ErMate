import { readFileSync } from "fs";
import { PLAN_PRICING, PLAN_KEYS, CORE_AUTOPAY } from "./src/lib/pricing";
import { fulfillCapturedPayment, fulfillRefund } from "./server/services/paymentFulfillment";
import { deleteAccount, type DeletionDeps } from "./server/services/accountDeletion";
import {
  configuredPlanId, validatePlanEntity, checkEligibility, createAutopaySubscription, cancelAutopay,
  handleSubscriptionEvent, buildAutopayView, resetPlanCache, SUBSCRIPTION_WEBHOOK_EVENTS, CREATING_LOCK_MS,
} from "./server/services/autopay";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL", n)); };
const PLAN = "plan_TsmuGiVJaFGsSN";
const NOW = Date.parse("2026-10-27T10:00:00Z");
const EXP = "2026-11-20T10:00:00.000Z";

function makeDb(seed: Record<string, any>) {
  const store: Record<string, any> = JSON.parse(JSON.stringify(seed));
  let queue: Promise<any> = Promise.resolve();
  const ref = (path: string) => ({ path, get: async () => ({ exists: path in store, data: () => (path in store ? JSON.parse(JSON.stringify(store[path])) : undefined) }) });
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
const paidUser = (over: any = {}) => ({ aiCredits: 120, subscriptionTier: "Individual Pro", tierExpiresAt: EXP, hasPurchased: true, ...over });
function makeRz(opts: any = {}) {
  const calls: any = { create: [], cancel: [], fetch: 0, all: 0 };
  let n = 0;
  const rz: any = {
    calls,
    plans: { fetch: async (id: string) => { calls.fetch++; return opts.plan ?? { id, period: "monthly", interval: 1, item: { amount: 35000, currency: "INR" } }; } },
    subscriptions: {
      create: async (body: any) => {
        calls.create.push(body);
        if (opts.createError) throw opts.createError;
        await new Promise(r => setTimeout(r, 5));
        return { id: `sub_${++n}`, plan_id: body.plan_id, status: "created", notes: body.notes };
      },
      cancel: async (id: string, atEnd: boolean) => { calls.cancel.push([id, atEnd]); if (opts.cancelError) throw opts.cancelError; return { id, status: "cancelled" }; },
      all: async () => { calls.all++; if (opts.allError) throw opts.allError; return { items: opts.items || [] }; },
    },
  };
  return rz;
}
const charged = (over: any = {}, pay: any = {}) => ({
  event: "subscription.charged",
  payload: {
    subscription: { entity: { id: "sub_1", plan_id: PLAN, status: "active", paid_count: 1, charge_at: Math.floor(Date.parse("2026-12-20T10:00:00Z") / 1000), notes: { app: "ermate", firebaseUid: "u1", attemptId: "att1" }, ...over } },
    payment: { entity: { id: "pay_r1", amount: 35000, currency: "INR", status: "captured", ...pay } },
  },
});
const evt = (name: string, over: any = {}) => ({ event: name, payload: { subscription: { entity: { id: "sub_1", plan_id: PLAN, status: "x", notes: { app: "ermate", firebaseUid: "u1", attemptId: "att1" }, ...over } } } });
const liveSeed = (status = "authenticated", extra: any = {}) => ({
  "users/u1": paidUser(),
  "autopaySubscriptions/u1": { uid: "u1", status, razorpaySubscriptionId: "sub_1", attemptId: "att1", planId: PLAN, startAt: Math.floor(Date.parse(EXP) / 1000), ...extra },
});

(async () => {
  // A. configuration + plan validation
  t("env name", configuredPlanId({ RAZORPAY_CORE_MONTHLY_PLAN_ID: PLAN }) === PLAN);
  t("missing env => null", configuredPlanId({}) === null);
  t("malformed plan id rejected", configuredPlanId({ RAZORPAY_CORE_MONTHLY_PLAN_ID: "order_123" }) === null && configuredPlanId({ RAZORPAY_CORE_MONTHLY_PLAN_ID: "plan_" }) === null);
  const goodPlan = { id: PLAN, period: "monthly", interval: 1, item: { amount: 35000, currency: "INR" } };
  t("valid plan accepted", validatePlanEntity(goodPlan, PLAN).ok === true);
  t("wrong amount rejected", validatePlanEntity({ ...goodPlan, item: { amount: 30000, currency: "INR" } }, PLAN).ok === false);
  t("wrong currency rejected", validatePlanEntity({ ...goodPlan, item: { amount: 35000, currency: "USD" } }, PLAN).ok === false);
  t("weekly rejected", validatePlanEntity({ ...goodPlan, period: "weekly" }, PLAN).ok === false);
  t("every 2 months rejected", validatePlanEntity({ ...goodPlan, interval: 2 }, PLAN).ok === false);
  t("id mismatch rejected", validatePlanEntity({ ...goodPlan, id: "plan_other123" }, PLAN).ok === false);
  t("null plan rejected", validatePlanEntity(null, PLAN).ok === false);

  // B. unchanged price table
  t("exactly the same four purchasable keys", PLAN_KEYS.length === 4 && !PLAN_KEYS.includes("core_autopay"));
  t("initial 600 -> 300 credits unchanged", PLAN_PRICING.individual_pro_monthly.amountPaise === 60000 && PLAN_PRICING.individual_pro_monthly.credits === 300);
  t("recharge packs unchanged", PLAN_PRICING.credits_refill_150.amountPaise === 30000 && PLAN_PRICING.credits_refill_350.amountPaise === 70000 && PLAN_PRICING.credits_refill_500.amountPaise === 100000);
  t("renewal = 350, zero credits, 30 days", CORE_AUTOPAY.amountPaise === 35000 && CORE_AUTOPAY.credits === 0 && CORE_AUTOPAY.periodDays === 30);

  // C. eligibility
  t("not purchased => blocked", checkEligibility({ aiCredits: 100, subscriptionTier: "Free Standard" }, NOW).ok === false);
  t("tier without purchase flag => blocked", checkEligibility(paidUser({ hasPurchased: false }), NOW).ok === false);
  t("expired period => blocked", checkEligibility(paidUser({ tierExpiresAt: "2026-10-01T00:00:00Z" }), NOW).ok === false);
  t("expires within 10 minutes => blocked", checkEligibility(paidUser({ tierExpiresAt: new Date(NOW + 5 * 60000).toISOString() }), NOW).ok === false);
  const el: any = checkEligibility(paidUser(), NOW);
  t("eligible: first renewal = end of paid period", el.ok === true && el.firstRenewalAt === EXP && el.startAtSec === Math.floor(Date.parse(EXP) / 1000));
  const view = buildAutopayView(paidUser(), null, PLAN, NOW);
  t("view shows first renewal date before approval", view.canEnable && view.firstRenewalAt === EXP && view.amountPaise === 35000 && view.status === "none");
  t("view hidden when not configured", buildAutopayView(paidUser(), null, null, NOW).canEnable === false && buildAutopayView(paidUser(), null, null, NOW).configured === false);

  // D. create: success, arguments, no upfront charge
  resetPlanCache();
  let db = makeDb({ "users/u1": paidUser() }); let rz = makeRz();
  let r: any = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("create ok", r.status === "created" && r.subscriptionId === "sub_1" && r.reused === false);
  const body = rz.calls.create[0];
  t("start_at = end of paid period", body.start_at === Math.floor(Date.parse(EXP) / 1000));
  t("plan id + monthly cycles", body.plan_id === PLAN && body.total_count === 120 && body.quantity === 1);
  t("no upfront charge: no addons, no offer", !("addons" in body) && !("offer_id" in body) && !("upfront_amount" in body));
  t("notes tag app + uid", body.notes.app === "ermate" && body.notes.firebaseUid === "u1" && typeof body.notes.attemptId === "string");
  t("record created", db.store["autopaySubscriptions/u1"].status === "created" && db.store["autopaySubscriptions/u1"].razorpaySubscriptionId === "sub_1");
  t("create never changes access or credits", JSON.stringify(db.store["users/u1"]) === JSON.stringify(paidUser()));
  // repeated click after success reuses
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + 1000 });
  t("second click reuses same subscription", r.status === "created" && r.subscriptionId === "sub_1" && r.reused === true && rz.calls.create.length === 1);

  // E. duplicate prevention
  resetPlanCache(); db = makeDb({ "users/u1": paidUser() }); rz = makeRz();
  const many = await Promise.all([1, 2, 3, 4, 5, 6].map(() => createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW })));
  t("6 parallel clicks => exactly one Razorpay subscription", rz.calls.create.length === 1);
  t("others told in-progress/reused, none errored fatally", many.filter((x: any) => x.status === "created").length >= 1 && many.every((x: any) => x.status === "created" || x.code === "IN_PROGRESS"));
  db.store["autopaySubscriptions/u1"].status = "active";
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("already live => blocked", r.status === "error" && r.code === "ALREADY_ACTIVE" && rz.calls.create.length === 1);
  for (const s of ["authenticated", "pending"]) { db.store["autopaySubscriptions/u1"].status = s; r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW }); t(`${s} => blocked`, r.code === "ALREADY_ACTIVE"); }

  // F. uncertain API response (network error) cannot create a second one
  resetPlanCache(); db = makeDb({ "users/u1": paidUser() });
  rz = makeRz({ createError: new Error("socket hang up") });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW, newAttemptId: () => "attA" });
  t("network error => uncertain", r.status === "error" && r.code === "UNCERTAIN");
  t("lock kept (status creating)", db.store["autopaySubscriptions/u1"].status === "creating" && db.store["autopaySubscriptions/u1"].attemptId === "attA");
  rz = makeRz();
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + 30000 });
  t("immediate retry => in progress, nothing created", r.code === "IN_PROGRESS" && rz.calls.create.length === 0);
  // after lock expiry: it DID reach Razorpay -> adopted, not duplicated
  rz = makeRz({ items: [{ id: "sub_existing", plan_id: PLAN, status: "created", notes: { attemptId: "attA" } }] });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + CREATING_LOCK_MS + 1000 });
  t("stale lock + found at Razorpay => adopted", r.status === "created" && r.subscriptionId === "sub_existing" && rz.calls.create.length === 0);
  t("record points at adopted id", db.store["autopaySubscriptions/u1"].razorpaySubscriptionId === "sub_existing");
  // not found -> new create allowed
  resetPlanCache(); db = makeDb({ "users/u1": paidUser(), "autopaySubscriptions/u1": { uid: "u1", status: "creating", attemptId: "attB", attemptAt: new Date(NOW).toISOString() } });
  rz = makeRz({ items: [] });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + CREATING_LOCK_MS + 1000 });
  t("stale lock + not found => creates exactly one", r.status === "created" && rz.calls.create.length === 1);
  // reconcile lookup itself fails => no create
  db = makeDb({ "users/u1": paidUser(), "autopaySubscriptions/u1": { uid: "u1", status: "creating", attemptId: "attC", attemptAt: new Date(NOW).toISOString() } });
  rz = makeRz({ allError: new Error("down") });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + CREATING_LOCK_MS + 1000 });
  t("reconcile lookup failure => uncertain, nothing created", r.code === "UNCERTAIN" && rz.calls.create.length === 0);
  // definite 4xx rejection releases lock
  resetPlanCache(); db = makeDb({ "users/u1": paidUser() });
  rz = makeRz({ createError: Object.assign(new Error("bad"), { statusCode: 400 }) });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("4xx => failed, lock released", r.code === "FAILED" && db.store["autopaySubscriptions/u1"].status === "failed");
  rz = makeRz();
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW + 1000 });
  t("can retry after a definite failure", r.status === "created");
  // old unauthorised subscription is cancelled when a new one is needed
  resetPlanCache(); db = makeDb({ "users/u1": paidUser(), "autopaySubscriptions/u1": { uid: "u1", status: "created", razorpaySubscriptionId: "sub_old", createdAt: new Date(NOW - 3 * 86400000).toISOString(), startAt: 1 } });
  rz = makeRz();
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("stale unauthorised subscription cancelled, new one made", rz.calls.cancel.some((c: any) => c[0] === "sub_old") && r.status === "created" && r.subscriptionId !== "sub_old");
  // guards
  resetPlanCache(); db = makeDb({ "users/u1": { aiCredits: 100, subscriptionTier: "Free Standard" } }); rz = makeRz();
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("no purchase => no subscription", r.code === "NOT_PURCHASED" && rz.calls.create.length === 0);
  resetPlanCache(); db = makeDb({ "users/u1": paidUser() }); rz = makeRz({ plan: { id: PLAN, period: "monthly", interval: 1, item: { amount: 30000, currency: "INR" } } });
  r = await createAutopaySubscription({ db, rz, uid: "u1", planId: PLAN, now: NOW });
  t("wrong plan amount at Razorpay => refuses to create", r.code === "PLAN_INVALID" && rz.calls.create.length === 0);
  r = await createAutopaySubscription({ db, rz: makeRz(), uid: "u1", planId: null, now: NOW });
  t("no plan id configured => refuses", r.code === "NOT_CONFIGURED");

  // G. webhook: mandate authorization alone never extends access
  for (const name of ["subscription.authenticated", "subscription.activated"]) {
    db = makeDb(liveSeed("created")); const before = JSON.stringify(db.store["users/u1"]);
    const x = await handleSubscriptionEvent(db, evt(name), { planId: PLAN, now: new Date(NOW) });
    t(`${name}: status only, access unchanged`, x.status === "updated" && JSON.stringify(db.store["users/u1"]) === before && Object.keys(db.store).every(k => !k.startsWith("creditLedger/")));
  }
  db = makeDb(liveSeed("created")); await handleSubscriptionEvent(db, evt("subscription.authenticated"), { planId: PLAN });
  t("authenticated recorded", db.store["autopaySubscriptions/u1"].status === "authenticated");

  // H. verified renewal
  db = makeDb(liveSeed("active"));
  let x: any = await handleSubscriptionEvent(db, charged(), { planId: PLAN, now: new Date(NOW) });
  t("charged: fulfilled", x.status === "fulfilled");
  t("access extended 30 days from current expiry", db.store["users/u1"].tierExpiresAt === "2026-12-20T10:00:00.000Z");
  t("ZERO credits added", db.store["users/u1"].aiCredits === 120);
  t("tier stays Individual Pro", db.store["users/u1"].subscriptionTier === "Individual Pro");
  t("ledger: 350, 0 credits, plan kind", db.store["creditLedger/pay_r1"].amountPaise === 35000 && db.store["creditLedger/pay_r1"].creditsGranted === 0 && db.store["creditLedger/pay_r1"].kind === "plan" && db.store["creditLedger/pay_r1"].balanceBefore === db.store["creditLedger/pay_r1"].balanceAfter);
  t("next renewal recorded", db.store["autopaySubscriptions/u1"].nextChargeAt === "2026-12-20T10:00:00.000Z" && db.store["autopaySubscriptions/u1"].lastPaymentId === "pay_r1");
  // duplicates
  x = await handleSubscriptionEvent(db, charged(), { planId: PLAN, now: new Date(NOW) });
  t("duplicate webhook => no second extension", x.status === "duplicate" && db.store["users/u1"].tierExpiresAt === "2026-12-20T10:00:00.000Z");
  db = makeDb(liveSeed("active"));
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => handleSubscriptionEvent(db, charged(), { planId: PLAN, now: new Date(NOW) })));
  t("5 concurrent duplicates => exactly one extension", rs.filter((q: any) => q.status === "fulfilled").length === 1 && db.store["users/u1"].tierExpiresAt === "2026-12-20T10:00:00.000Z");
  // second month with a new payment id
  x = await handleSubscriptionEvent(db, charged({}, { id: "pay_r2" }), { planId: PLAN, now: new Date("2026-12-20T10:00:05Z") });
  t("next month's payment extends again (+30d) with no credits", x.status === "fulfilled" && db.store["users/u1"].tierExpiresAt === "2027-01-19T10:00:00.000Z" && db.store["users/u1"].aiCredits === 120);
  // late renewal after expiry counts from now
  db = makeDb(liveSeed("pending", {})); db.store["users/u1"].tierExpiresAt = "2026-10-01T00:00:00.000Z";
  await handleSubscriptionEvent(db, charged(), { planId: PLAN, now: new Date(NOW) });
  t("late renewal: 30 days from now", db.store["users/u1"].tierExpiresAt === new Date(NOW + 30 * 86400000).toISOString());
  // mismatches never extend
  for (const [label, pay] of [["amount 60000", { amount: 60000 }], ["amount 30000", { amount: 30000 }], ["USD", { currency: "USD" }], ["not captured", { status: "failed" }]] as any) {
    db = makeDb(liveSeed("active")); const before = JSON.stringify(db.store["users/u1"]);
    x = await handleSubscriptionEvent(db, charged({}, pay), { planId: PLAN, now: new Date(NOW) });
    t(`charged ${label}: mismatch, no access`, x.status === "mismatch" && JSON.stringify(db.store["users/u1"]) === before && !db.store["creditLedger/pay_r1"]);
  }
  db = makeDb(liveSeed("active")); const c0 = charged(); delete (c0.payload as any).payment;
  x = await handleSubscriptionEvent(db, c0, { planId: PLAN, now: new Date(NOW) });
  t("charged without payment entity => no access", x.status === "mismatch" && db.store["users/u1"].tierExpiresAt === EXP);
  db = makeDb({ "autopaySubscriptions/u1": liveSeed("active")["autopaySubscriptions/u1"] });
  x = await handleSubscriptionEvent(db, charged(), { planId: PLAN, now: new Date(NOW) });
  t("missing user => no_user (webhook retries)", x.status === "no_user");

  // I. ARYA / foreign events ignored
  db = makeDb(liveSeed("active")); const snap = JSON.stringify(db.store);
  t("ARYA subscription (no ErMate notes) ignored", (await handleSubscriptionEvent(db, charged({ notes: { app: "arya", firebaseUid: "u1" } }), { planId: PLAN })).status === "ignored");
  t("notes without app ignored", (await handleSubscriptionEvent(db, charged({ notes: { firebaseUid: "u1" } }), { planId: PLAN })).status === "ignored");
  t("different plan ignored", (await handleSubscriptionEvent(db, charged({ plan_id: "plan_OtherOne123" }), { planId: PLAN })).status === "ignored");
  t("plan not configured => ignored", (await handleSubscriptionEvent(db, charged(), { planId: null })).status === "ignored");
  t("unknown subscription id ignored", (await handleSubscriptionEvent(db, charged({ id: "sub_zzz" }), { planId: PLAN })).status === "ignored");
  t("forged uid cannot touch another account", (await handleSubscriptionEvent(db, charged({ notes: { app: "ermate", firebaseUid: "victim" } }), { planId: PLAN })).status === "ignored");
  t("non-subscription events ignored here", (await handleSubscriptionEvent(db, { event: "subscription.updated", payload: {} }, { planId: PLAN })).status === "ignored");
  t("nothing changed by foreign events", JSON.stringify(db.store) === snap);

  // J. failed renewals / cancel events
  db = makeDb(liveSeed("active"));
  await handleSubscriptionEvent(db, evt("subscription.pending"), { planId: PLAN, now: new Date(NOW) });
  t("pending recorded, access unchanged", db.store["autopaySubscriptions/u1"].status === "pending" && db.store["users/u1"].tierExpiresAt === EXP && !!db.store["autopaySubscriptions/u1"].lastFailureAt);
  await handleSubscriptionEvent(db, evt("subscription.halted"), { planId: PLAN, now: new Date(NOW) });
  t("halted recorded, access unchanged, credits unchanged", db.store["autopaySubscriptions/u1"].status === "halted" && db.store["users/u1"].tierExpiresAt === EXP && db.store["users/u1"].aiCredits === 120);
  t("halted subscription can be re-enabled while paid", buildAutopayView(db.store["users/u1"], db.store["autopaySubscriptions/u1"], PLAN, NOW).canEnable === true);
  db = makeDb(liveSeed("active"));
  await handleSubscriptionEvent(db, evt("subscription.cancelled"), { planId: PLAN, now: new Date(NOW) });
  t("cancelled event keeps paid access", db.store["autopaySubscriptions/u1"].status === "cancelled" && db.store["users/u1"].tierExpiresAt === EXP);
  await handleSubscriptionEvent(db, evt("subscription.activated"), { planId: PLAN });
  t("late activated cannot resurrect a cancelled mandate", db.store["autopaySubscriptions/u1"].status === "cancelled");
  t("handled events list", ["subscription.charged", "subscription.authenticated", "subscription.activated", "subscription.pending", "subscription.halted", "subscription.cancelled", "subscription.completed"].every(e => SUBSCRIPTION_WEBHOOK_EVENTS.includes(e)));

  // K. user cancellation
  db = makeDb(liveSeed("active")); rz = makeRz();
  let c: any = await cancelAutopay({ db, rz, uid: "u1", now: NOW });
  t("cancel: Razorpay cancelled immediately", c.status === "cancelled" && rz.calls.cancel.length === 1 && rz.calls.cancel[0][0] === "sub_1" && rz.calls.cancel[0][1] === false);
  t("cancel preserves paid access + credits", db.store["users/u1"].tierExpiresAt === EXP && db.store["users/u1"].aiCredits === 120 && db.store["autopaySubscriptions/u1"].status === "cancelled");
  c = await cancelAutopay({ db, rz, uid: "u1", now: NOW });
  t("cancel is idempotent", c.status === "none" && rz.calls.cancel.length === 1);
  db = makeDb(liveSeed("active")); rz = makeRz({ cancelError: Object.assign(new Error("x"), { statusCode: 400, error: { description: "Subscription is not cancellable in cancelled status" } }) });
  t("already-cancelled at Razorpay => treated as cancelled", (await cancelAutopay({ db, rz, uid: "u1" })).status === "cancelled");
  db = makeDb(liveSeed("active")); rz = makeRz({ cancelError: Object.assign(new Error("boom"), { statusCode: 500 }) });
  c = await cancelAutopay({ db, rz, uid: "u1" });
  t("cancel failure => error, record still live (retry possible)", c.status === "error" && db.store["autopaySubscriptions/u1"].status === "active");
  t("no record => none", (await cancelAutopay({ db: makeDb({}), rz: makeRz(), uid: "u1" })).status === "none");
  db = makeDb({ "autopaySubscriptions/u1": { uid: "u1", status: "creating", attemptId: "attX", planId: PLAN, attemptAt: new Date(NOW).toISOString() } });
  rz = makeRz({ items: [{ id: "sub_hidden", plan_id: PLAN, status: "created", notes: { attemptId: "attX" } }] });
  c = await cancelAutopay({ db, rz, uid: "u1", now: NOW });
  t("cancel finds and cancels a half-created subscription", c.status === "cancelled" && rz.calls.cancel[0][0] === "sub_hidden");

  // L. refunds: unchanged behaviour + mandate cleanup signal
  db = makeDb({ "users/u1": paidUser({ tierExpiresAt: "2026-12-20T10:00:00.000Z" }), "creditLedger/pay_r1": { paymentId: "pay_r1", uid: "u1", planKey: "core_autopay", kind: "plan", amountPaise: 35000, creditsGranted: 0 } });
  let rf: any = await fulfillRefund(db, { id: "rf1", payment_id: "pay_r1", amount: 35000 }, new Date(NOW));
  t("renewal refund: 30 days removed, 0 credits revoked, credits intact", rf.status === "revoked" && rf.creditsRevoked === 0 && db.store["users/u1"].aiCredits === 120 && db.store["users/u1"].tierExpiresAt === "2026-11-20T10:00:00.000Z");
  t("renewal refund flags full plan refund + uid", rf.planFullyRefunded === true && rf.uid === "u1");
  rf = await fulfillRefund(db, { id: "rf1", payment_id: "pay_r1", amount: 35000 }, new Date(NOW));
  t("duplicate refund still reports uid + full refund (so cancel can be retried)", rf.status === "duplicate" && rf.uid === "u1" && rf.planFullyRefunded === true && db.store["users/u1"].tierExpiresAt === "2026-11-20T10:00:00.000Z");
  db = makeDb({ "users/u1": paidUser(), "creditLedger/pay_r1": { paymentId: "pay_r1", uid: "u1", planKey: "core_autopay", kind: "plan", amountPaise: 35000, creditsGranted: 0 } });
  rf = await fulfillRefund(db, { id: "rf2", payment_id: "pay_r1", amount: 10000 }, new Date(NOW));
  t("partial refund does not flag mandate cancel", rf.planFullyRefunded === false);
  db = makeDb({ "users/u1": { aiCredits: 10, subscriptionTier: "Free Standard" }, "paymentIntents/order_1": { orderId: "order_1", uid: "u1", planKey: "credits_refill_150", amountPaise: 30000, credits: 150, status: "created" } });
  await fulfillCapturedPayment(db, { id: "pay_1", order_id: "order_1", amount: 30000, currency: "INR", status: "captured" }, new Date(NOW));
  rf = await fulfillRefund(db, { id: "rf3", payment_id: "pay_1", amount: 30000 }, new Date(NOW));
  t("recharge refund never triggers mandate cancel", rf.planFullyRefunded === false);

  // M. account deletion never leaves a live mandate
  const order: string[] = [];
  const deps = (over: Partial<DeletionDeps> = {}): DeletionDeps => ({
    hasActiveTeamMembership: async () => false,
    findOwned: async () => [], docRef: (c, id) => `${c}/${id}`,
    recursiveDelete: async (r: any) => { order.push(`del:${r}`); },
    deleteAuthUser: async () => { order.push("auth"); }, logDeletion: async () => {},
    cancelAutopay: async () => { order.push("cancel-autopay"); }, ...over,
  });
  let dr: any = await deleteAccount(deps(), "u1");
  t("deletion cancels mandate first", dr.ok === true && order[0] === "cancel-autopay" && order.includes("auth"));
  order.length = 0;
  dr = await deleteAccount(deps({ cancelAutopay: async () => { throw new Error("razorpay down"); } }), "u1");
  t("mandate cancel failure => nothing deleted", dr.ok === false && dr.code === "AUTOPAY_CANCEL_FAILED" && order.length === 0);
  dr = await deleteAccount({ ...deps(), cancelAutopay: undefined }, "u1");
  t("older callers without the dep still work", dr.ok === true);

  // N. wiring (static)
  const route = readFileSync("server/routes/payments.ts", "utf8");
  const acct = readFileSync("server/routes/account.routes.ts", "utf8");
  const panel = readFileSync("src/components/AutoPayPanel.tsx", "utf8");
  const card = readFileSync("src/components/CreditsPlanCard.tsx", "utf8");
  const svc = readFileSync("server/services/autopay.ts", "utf8");
  t("webhook routes subscription.* events", /startsWith\("subscription\."\)/.test(route) && /handleSubscriptionEvent/.test(route));
  t("webhook ignores subscription invoices on payment.captured", /invoice_id\) return res\.status\(200\)/.test(route));
  t("signature is verified before any parsing", route.indexOf("verifyWebhookSignature(rawBody") < route.indexOf("JSON.parse(rawBody"));
  t("refund path cancels mandate on full plan refund", /planFullyRefunded && r\.uid/.test(route) && /cancelAutopay/.test(route));
  t("create/cancel/status routes exist and require auth", /router\.get\("\/autopay", requireAuth/.test(route) && /router\.post\("\/autopay\/create", requireAuth/.test(route) && /router\.post\("\/autopay\/cancel", requireAuth/.test(route));
  t("client never supplies plan id or amount", !/req\.body/.test(route.slice(route.indexOf('"/autopay/create"'), route.indexOf("// Read-only confirmation"))));
  t("account deletion route wires cancelAutopay", /cancelAutopay/.test(acct));
  t("renewal code never writes aiCredits", !/aiCredits\s*:/.test(svc) && /Renewals never add credits/.test(svc));
  t("UI: Enable AutoPay label + 350/month", /Enable AutoPay · \$\{price\}/.test(panel) && /rupees\(view\.amountPaise/.test(panel));
  t("UI: first renewal date shown before approval", /autopay-first-renewal/.test(panel) && /Nothing is charged today/.test(panel));
  t("UI: status, next renewal, credits remaining, Cancel AutoPay", /autopay-status/.test(panel) && /autopay-next/.test(panel) && /Credits remaining/.test(panel) && /Cancel AutoPay/.test(panel));
  t("UI: opens checkout with subscription_id only", /subscription_id: sub\.subscriptionId/.test(panel) && !/order_id/.test(panel));
  t("UI never grants access", !/aiCredits\s*[:=]/.test(panel) && /Renewals include platform access only/.test(panel));
  t("card mounts the panel for paid, non-exempt users", /<AutoPayPanel/.test(card) && /!exempt && active/.test(card));
  t(".env.example documents the plan id", readFileSync(".env.example", "utf8").includes("RAZORPAY_CORE_MONTHLY_PLAN_ID"));

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();