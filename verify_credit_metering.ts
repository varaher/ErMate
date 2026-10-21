import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { CREDIT_COSTS, PLAN_PRICING } from "./src/lib/pricing";
import { decideAccess, shouldChargeResponse, deductCredits, meterCredits } from "./server/services/creditMeter";

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
const U = { uid: "u1", email: "doc@x.com", email_verified: true };

(async () => {
  // A. pure decisions
  t("enough credits allowed", decideAccess(10, 3).allow === true);
  t("exactly enough allowed", decideAccess(3, 3).allow === true);
  t("short blocked", decideAccess(2, 3).allow === false);
  t("zero blocked", decideAccess(0, 1).allow === false);
  t("unknown balance fails open", decideAccess(undefined, 1).allow === true && decideAccess("x", 1).allow === true && decideAccess(NaN, 1).allow === true);
  t("free action never blocked", decideAccess(0, 0).allow === true);
  t("2xx success charged", shouldChargeResponse(200, { success: true, data: {} }));
  t("plain 200 body charged", shouldChargeResponse(200, { data: 1 }));
  t("4xx/5xx not charged", !shouldChargeResponse(400, {}) && !shouldChargeResponse(500, {}) && !shouldChargeResponse(402, {}));
  t("simulated fallback not charged", !shouldChargeResponse(200, { success: true, simulated: true }));
  t("success:false not charged", !shouldChargeResponse(200, { success: false }));
  t("error body not charged", !shouldChargeResponse(200, { error: "model failed" }));

  // B. deduction
  let db: any = makeDb({ "users/u1": { aiCredits: 5 } });
  let r = await deductCredits(db, "u1", "scribe_chat", 1);
  t("deducts 1", r.charged === 1 && db.store["users/u1"].aiCredits === 4);
  t("usage ledger row", Object.values(db.store).some((v: any) => v?.action === "scribe_chat" && v.balanceBefore === 5 && v.balanceAfter === 4));
  db = makeDb({ "users/u1": { aiCredits: 2 } });
  r = await deductCredits(db, "u1", "ai_discharge", 3);
  t("never below zero", db.store["users/u1"].aiCredits === 0 && r.charged === 2);
  db = makeDb({ "users/u1": { aiCredits: 50 } });
  await Promise.all(Array.from({ length: 10 }, () => deductCredits(db, "u1", "stt", 1)));
  t("10 concurrent deductions = exactly 10", db.store["users/u1"].aiCredits === 40);
  db = makeDb({});
  r = await deductCredits(db, "ghost", "stt", 1);
  t("missing user: nothing charged", r.charged === 0);

  // C. middleware flow
  db = makeDb({ "users/u1": { aiCredits: 5 } });
  let c = await call(db, "scribe_chat", U, 200, { success: true });
  t("success: passes and charges 1", c.nexted && db.store["users/u1"].aiCredits === 4);
  c = await call(db, "ai_discharge", U, 200, { success: true });
  t("discharge draft charges 3", db.store["users/u1"].aiCredits === 1);
  c = await call(db, "ai_discharge", U, 200, { success: true });
  t("insufficient: 402, handler never runs", !c.nexted && c.res.statusCode === 402 && c.res.sent.code === "INSUFFICIENT_CREDITS" && db.store["users/u1"].aiCredits === 1);
  t("402 message keeps care working", /case sheet/i.test(c.res.sent.error));
  db = makeDb({ "users/u1": { aiCredits: 5 } });
  await call(db, "scribe_chat", U, 500, { error: "x" });
  await call(db, "scribe_chat", U, 200, { success: true, simulated: true });
  await call(db, "scribe_chat", U, 200, { success: false });
  t("failed / simulated calls cost nothing", db.store["users/u1"].aiCredits === 5);
  db = makeDb({ "users/u1": { aiCredits: 0 }, "team_members/u1": { status: "Active", membershipVerified: true, hospitalId: "h1" }, "hospital_subscriptions/h1": { active: true } });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("verified active team member never metered", c.nexted && db.store["users/u1"].aiCredits === 0);
  db = makeDb({ "users/u1": { aiCredits: 0 }, "team_members/u1": { status: "pending_approval", membershipVerified: false } });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("pending team member is metered", !c.nexted);
  db = makeDb({ "users/u1": { aiCredits: 0 } });
  c = await call(db, "scribe_chat", { uid: "admin", email: "VarahGrp@gmail.com" }, 200, { success: true });
  t("platform admin exempt", c.nexted);
  db = makeDb({}, { failUsersGet: true });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("lookup error fails open", c.nexted);
  db = makeDb({ "users/u1": {} });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("no balance field (legacy): starter 100 granted once, then this call charged 1", c.nexted && db.store["users/u1"].aiCredits === 99 && !!db.store["users/u1"].legacyCreditsGrantedAt);
  db = makeDb({ "users/u1": { aiCredits: 5 } });
  c = await call(db, "scribe_chat", U, 200, null, false);
  t("2xx with non-json response still charges once", db.store["users/u1"].aiCredits === 4);
  c = await call(db, "scribe_chat", { uid: "" }, 200, { success: true });
  t("no uid passes through (auth layer handles)", c.nexted);

  // D. wiring
  const srv = readFileSync("server.ts", "utf8");
  const ext = readFileSync("server/routes/extraction.routes.ts", "utf8");
  const mate = readFileSync("server/routes/mate.routes.ts", "utf8");
  const metered = ["/api/sarvam-asr", "/api/voice/transcribe", "/api/scribe-chat", "/api/scribe-extract", "/api/ai-discharge", "/api/rounds-debrief",
    "/api/case-discussion", "/api/interpret-abg", "/api/lens-report", "/api/document-scan", "/api/scribe-ocr-scan", "/api/mlc-extract", "/api/em-reference",
    "/api/handover/compile-sheet", "/api/parse-rota", "/api/scan-mnemonic", "/api/voice-dictation"];
  for (const p of metered) t(`metered ${p}`, srv.includes(`app.post("${p}", requireAuth, meterCredits(`));
  for (const p of ["/api/discharge-summary", "/api/discharge-summary/generate", "/api/differentials", "/api/voice/extract-clinical"])
    t(`metered ${p}`, new RegExp(`'${p}',\\s*requireAuth,\\s*meterCredits`).test(ext));
  for (const p of ["/api/handover/pdf", "/api/logbook", "/api/team", "/api/sql", "/api/payments"])
    t(`free ${p}`, !new RegExp(`${p.replace(/\//g, "\\/")}[^\\n]*meterCredits`).test(srv));
  t("MATE planner not charged (downstream actions are)", !/meterCredits/.test(mate));
  t("payments routes not metered", !/meterCredits/.test(readFileSync("server/routes/payments.ts", "utf8")));

  // E. pricing economics
  t("every credit cost is a positive integer", Object.values(CREDIT_COSTS).every(v => Number.isInteger(v) && v >= 1));
  t("all packs priced at flat Rs2/credit", Object.values(PLAN_PRICING).every(p => p.amountPaise === p.credits * 200));
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
