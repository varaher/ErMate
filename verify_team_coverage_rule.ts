import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { CREDIT_COSTS, PLAN_PRICING } from "./src/lib/pricing";
import { meterCredits, isTeamCovered, hospitalSlug } from "./server/services/creditMeter";

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
const M = { status: "Active", membershipVerified: true, hospitalId: "h1" };
(async () => {
  // pure rule
  const okDb = makeDb({ "hospital_subscriptions/h1": { active: true } });
  const offDb = makeDb({ "hospital_subscriptions/h1": { active: false } });
  const noneDb = makeDb({});
  t("slug matches the app's slug", hospitalSlug("St. Mary's  Hospital!") === "st--mary-s--hospital");
  t("verified+active member of paid hospital: covered", await isTeamCovered(okDb, M));
  t("status 'active (joined)' also counts", await isTeamCovered(okDb, { ...M, status: "Active (Joined)" }));
  t("paid hospital but member NOT verified: not covered", !(await isTeamCovered(okDb, { ...M, membershipVerified: false })));
  t("pending member: not covered", !(await isTeamCovered(okDb, { ...M, status: "pending_approval" })));
  t("hospital subscription inactive: not covered", !(await isTeamCovered(offDb, M)));
  t("hospital has no subscription doc: not covered", !(await isTeamCovered(noneDb, M)));
  t("member with no hospital id: not covered", !(await isTeamCovered(okDb, { status: "Active", membershipVerified: true })));
  t("falls back to slug of hospital name", await isTeamCovered(makeDb({ "hospital_subscriptions/city-hospital": { active: true } }), { status: "Active", membershipVerified: true, hospital: "City Hospital" }));
  const failDb: any = { collection: () => ({ doc: () => ({ get: async () => { throw new Error("down"); } }) }) };
  t("subscription lookup error fails open (care first)", await isTeamCovered(failDb, M));

  // middleware: same rule at the server
  let db: any = makeDb({ "users/u1": { aiCredits: 0 }, "team_members/u1": M, "hospital_subscriptions/h1": { active: true } });
  let c = await call(db, "scribe_chat", U, 200, { success: true });
  t("covered member with 0 personal credits: allowed, nothing charged", c.nexted && db.store["users/u1"].aiCredits === 0);
  db = makeDb({ "users/u1": { aiCredits: 0 }, "team_members/u1": M, "hospital_subscriptions/h1": { active: false } });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("member of UNPAID hospital with 0 credits: 402", !c.nexted && c.res.statusCode === 402);
  db = makeDb({ "users/u1": { aiCredits: 10 }, "team_members/u1": M, "hospital_subscriptions/h1": { active: false } });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("member of unpaid hospital uses PERSONAL credits (10 -> 9)", c.nexted && db.store["users/u1"].aiCredits === 9);
  db = makeDb({ "users/u1": { aiCredits: 10 }, "team_members/u1": M, "hospital_subscriptions/h1": { active: true } });
  c = await call(db, "scribe_chat", U, 200, { success: true });
  t("covered member: personal balance untouched", c.nexted && db.store["users/u1"].aiCredits === 10);

  // client shows the same rule
  const app = readFileSync("src/App.tsx", "utf8"), hdr = readFileSync("src/components/GlobalHeader.tsx", "utf8"), more = readFileSync("src/components/MoreView.tsx", "utf8");
  t("header requires active subscription", hdr.includes("coveredByTeam && hospitalSubscription?.active === true"));
  t("App chip requires verified member + active subscription", app.includes("coveredByTeam={isVerifiedTeamUser && hospitalSubscription?.active === true}"));
  t("More card requires active membership + active subscription", more.includes("isMembershipActive && hospitalSubscription?.active === true"));

  console.log(`verify_team_coverage_rule: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
