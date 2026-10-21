import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { CREDIT_COSTS, PLAN_PRICING } from "./src/lib/pricing";
import { meterCredits, grantLegacyCredits } from "./server/services/creditMeter";
import { deleteAccount, checkDeleteRequest, OWNED_QUERIES, type DeletionDeps } from "./server/services/accountDeletion";

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
const rd = (f: string) => readFileSync(f, "utf8");
(async () => {
  // A. legacy credits
  let db: any = makeDb({ "users/u1": { name: "x" } });
  t("grant returns 100", (await grantLegacyCredits(db, "u1")) === 100 && db.store["users/u1"].aiCredits === 100);
  db.store["users/u1"].aiCredits = 7;
  t("second grant does not overwrite", (await grantLegacyCredits(db, "u1")) === 7 && db.store["users/u1"].aiCredits === 7);
  db = makeDb({ "users/u1": { aiCredits: 0 } });
  t("zero balance is NOT treated as legacy", (await grantLegacyCredits(db, "u1")) === 0 && db.store["users/u1"].aiCredits === 0);
  db = makeDb({});
  t("no user doc: nothing created", (await grantLegacyCredits(db, "ghost")) === undefined && !("users/ghost" in db.store));
  db = makeDb({ "users/u1": { name: "old" } });
  let c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: true }, 200, { success: true });
  t("legacy user: served, 100 granted, 1 charged", c.nexted && db.store["users/u1"].aiCredits === 99);
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: true }, 200, { success: true });
  t("legacy grant happens only once", db.store["users/u1"].aiCredits === 98);
  db = makeDb({ "users/u1": { name: "old" } });
  c = await call(db, "scribe_chat", { uid: "u1", email: "a@x.com", email_verified: false }, 200, { success: true });
  t("unverified legacy user: gated, NOT granted credits", !c.nexted && db.store["users/u1"].aiCredits === undefined);

  // B. deletion rule
  const log: string[] = [];
  const mk = (over: Partial<DeletionDeps> = {}): DeletionDeps => ({
    hasActiveTeamMembership: async () => false,
    findOwned: async (col, filters) => { log.push(`find:${col}:${JSON.stringify(filters)}`); return col === "cases" ? [`cases/a`, `cases/b`] : col === "chatSessions" ? [`chatSessions/c`] : []; },
    docRef: (col, id) => `${col}/${id}`,
    recursiveDelete: async (ref) => { log.push(`del:${ref}`); },
    deleteAuthUser: async (uid) => { log.push(`auth:${uid}`); },
    logDeletion: async (e) => { log.push(`log:${e.uid}`); },
    ...over,
  });
  let r = await deleteAccount(mk({ hasActiveTeamMembership: async () => true }), "u1");
  t("active team member blocked", r.ok === false && r.code === "TEAM_MEMBER");
  t("blocked: nothing deleted", !log.some(l => l.startsWith("del:") || l.startsWith("auth:")));
  log.length = 0;
  r = await deleteAccount(mk(), "u1");
  t("delete ok with counts", r.ok === true && (r as any).deleted.cases === 2 && (r as any).deleted.chatSessions === 1 && (r as any).deleted.profile === 1);
  t("cases query limited to individual workspace", log.some(l => l.startsWith("find:cases:") && l.includes('"workspaceType","individual"') && l.includes('"ownerUid","u1"')));
  t("hospital cases never queried by hospital/created-by", !log.some(l => l.includes("hospital") && l.startsWith("find:cases")));
  t("profile + handover sheet deleted", log.includes("del:users/u1") && log.includes("del:handover_sheets/u1"));
  const iAuth = log.indexOf("auth:u1");
  t("auth user deleted AFTER all data", iAuth > log.indexOf("del:users/u1") && iAuth > log.lastIndexOf("del:cases/b"));
  t("deletion logged (uid + counts only)", log.includes("log:u1"));
  t("every owned query keyed to this uid", OWNED_QUERIES.every(q => JSON.stringify(q.filters("UID")).includes("UID")));
  r = await deleteAccount(mk({ findOwned: async () => [] }), "u1");
  t("idempotent when nothing left", r.ok === true);
  let threw = false;
  try { await deleteAccount(mk({ deleteAuthUser: async () => { throw new Error("x"); } }), "u1"); } catch { threw = true; }
  t("auth failure surfaces (user can retry)", threw);
  r = await deleteAccount(mk({ logDeletion: async () => { throw new Error("log down"); } }), "u1");
  t("log failure does not fail deletion", r.ok === true);

  // C. request gate
  const now = 1_800_000_000_000;
  t("needs DELETE word", (checkDeleteRequest({}, now / 1000, now) as any).code === "BAD_REQUEST");
  t("wrong word rejected", (checkDeleteRequest({ confirm: "delete" }, now / 1000, now) as any).code === "BAD_REQUEST");
  t("stale login rejected", (checkDeleteRequest({ confirm: "DELETE" }, now / 1000 - 600, now) as any).code === "RECENT_LOGIN_REQUIRED");
  t("missing auth_time rejected", (checkDeleteRequest({ confirm: "DELETE" }, undefined, now) as any).code === "RECENT_LOGIN_REQUIRED");
  t("fresh login + DELETE accepted", checkDeleteRequest({ confirm: "DELETE" }, now / 1000 - 30, now).ok === true);

  // D. wiring / static
  const srv = rd("server.ts"), route = rd("server/routes/account.routes.ts");
  t("account router mounted", srv.includes('app.use("/api/account", accountRouter)'));
  t("delete route requires auth and owner uid only", route.includes('"/delete", requireAuth') && route.includes("req.user?.uid") && !route.includes("req.body.uid") && !route.includes("req.params"));
  for (const [f, k] of [["privacy", "Digital Personal Data Protection"], ["terms", "Clinical responsibility"], ["refund", "Duplicate or failed payments"]]) {
    const h = rd(`public/${f}.html`);
    t(`${f}.html present and complete`, h.includes(k) && h.includes("<title>") && h.includes("viewport"));
  }
  t("policy pages never name a hospital", !/(medical college|hospital,? thrissur|amala|jubilee)/i.test(rd("public/privacy.html") + rd("public/terms.html") + rd("public/refund.html")));
  const su = rd("src/components/SignUpView.tsx");
  t("signup: consent checkbox + blocking validation + stored proof", su.includes('data-testid="accept-terms"') && su.includes("if (!acceptTerms)") && su.includes("termsAcceptedAt") && su.includes("termsVersion: TERMS_VERSION"));
  t("login + More show legal links", rd("src/components/MockLoginView.tsx").includes("<LegalLinks") && rd("src/components/MoreView.tsx").includes("<LegalLinks"));
  t("More has delete-account card wired to sign out", rd("src/components/MoreView.tsx").includes("<DeleteAccountCard onDeleted={onSignOut}"));
  const dc = rd("src/components/DeleteAccountCard.tsx");
  t("card: typed DELETE, fresh reauth, then server call", dc.includes('word !== "DELETE"') && dc.includes("reauthenticateWith") && dc.includes("/api/account/delete"));
  t("firestore.rules untouched by this change", !rd("firestore.rules").includes("accountDeletionLog"));

  console.log(`verify_legal_deletion_legacy: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
