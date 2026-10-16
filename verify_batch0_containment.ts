/**
 * verify_batch0_containment.ts
 * Batch 0 P-A (legacy SQL containment) + P-B (learning capture containment).
 *
 * Runs real Express apps on ephemeral ports with spy handlers standing in for
 * the legacy routes, plus static checks on server.ts wiring.
 */
import express from "express";
import fs from "fs";
import { inspect } from "util";
import type { AddressInfo } from "net";
import { legacySqlGuard, learningFeedbackRejectHandler, learningCaptureDecision, errorForLog } from "./server/legacyContainment";
import { recordFeedbackCorrection, getAllFeedbackCorrections } from "./server/learningService";

let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };

async function withApp(build: (app: express.Express) => void, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  build(app);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try { await run(base); } finally { server.close(); }
}

const VICTIM = { hospital: "Other Hospital", uid: "victim-uid" };
const AUTH = { Authorization: "Bearer attacker-token", "Content-Type": "application/json" };

async function main() {
  // ───────────── P-A: runtime behaviour ─────────────
  for (const flag of [undefined, "true", "1", "yes"]) {
    if (flag === undefined) delete process.env.ENABLE_LEGACY_SQL_API; else process.env.ENABLE_LEGACY_SQL_API = flag;
    const hits: string[] = [];
    await withApp((app) => {
      app.use("/api/sql", legacySqlGuard);
      const spy = (name: string) => (_q: any, r: any) => { hits.push(name); r.json({ spy: name }); };
      app.get("/api/sql/cases", spy("GET cases"));
      app.post("/api/sql/cases", spy("POST cases"));
      app.get("/api/sql/handovers", spy("GET handovers"));
      app.post("/api/sql/handovers", spy("POST handovers"));
      app.get("/api/sql/team-members", spy("GET team"));
      app.post("/api/sql/team-members", spy("POST team"));
      app.get("/api/sql/contributions", spy("GET contrib"));
      app.post("/api/sql/contributions", spy("POST contrib"));
      app.put("/api/sql/contributions/:id/approve", spy("PUT approve"));
      app.delete("/api/sql/contributions/:id", spy("DELETE contrib"));
      app.post("/api/sql/sync-user", spy("POST sync-user"));
    }, async (base) => {
      const tag = `[ENABLE_LEGACY_SQL_API=${flag ?? "unset"}]`;
      const attempts: [string, string, any?][] = [
        ["GET", `/api/sql/cases?hospital=${encodeURIComponent(VICTIM.hospital)}`],
        ["POST", "/api/sql/cases", { id: "victim-case", hospital: VICTIM.hospital, patientName: "overwritten" }],
        ["GET", `/api/sql/handovers?hospital=${encodeURIComponent(VICTIM.hospital)}`],
        ["POST", "/api/sql/handovers", { hospital: VICTIM.hospital }],
        ["GET", `/api/sql/team-members?hospital=${encodeURIComponent(VICTIM.hospital)}`],
        ["POST", "/api/sql/team-members", { hospital: VICTIM.hospital, role: "admin" }],
        ["GET", `/api/sql/contributions?hospital=${encodeURIComponent(VICTIM.hospital)}`],
        ["POST", "/api/sql/contributions", { hospital: VICTIM.hospital }],
        ["PUT", "/api/sql/contributions/123/approve", {}],
        ["DELETE", "/api/sql/contributions/123"],
        // path variants that must not slip past the guard
        ["GET", "/api/SQL/Cases?hospital=Other%20Hospital"],
        ["GET", "/api/sql/cases/?hospital=Other%20Hospital"],
        ["DELETE", "/api/sql/CONTRIBUTIONS/123"],
        ["PATCH", "/api/sql/cases"],
        ["GET", "/api/sql/anything-new"],
        ["GET", "/api/sql/sync-user/../cases"],
      ];
      for (const [method, path, body] of attempts) {
        for (const headers of [AUTH, { "Content-Type": "application/json" }]) {
          const r = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
          const authed = (headers as any).Authorization ? "authed" : "anon";
          check(r.status === 410, `${tag} ${method} ${path} (${authed}) -> 410 (got ${r.status})`);
        }
      }
      check(hits.length === 0, `${tag} no legacy handler was reached (hits=${hits.join(",") || "none"})`);
      const ok = await fetch(base + "/api/sql/sync-user", { method: "POST", headers: AUTH, body: JSON.stringify({ uid: "self" }) });
      check(ok.status === 200 && hits.join() === "POST sync-user", `${tag} POST /api/sql/sync-user still reaches its handler`);
      const ok2 = await fetch(base + "/api/sql/Sync-User/", { method: "POST", headers: AUTH, body: "{}" });
      check(ok2.status === 200, `${tag} sync-user case/trailing-slash variant still reaches handler (its own uid check applies)`);
    });
  }
  delete process.env.ENABLE_LEGACY_SQL_API;

  // Non-/api/sql routes are untouched by the guard.
  await withApp((app) => {
    app.use("/api/sql", legacySqlGuard);
    app.post("/api/handover/parse-structured", (_q, r) => r.json({ ok: "handover" }));
    app.post("/api/billing/create-order", (_q, r) => r.json({ ok: "billing" }));
    app.get("/api/sqlish", (_q, r) => r.json({ ok: "sqlish" }));
  }, async (base) => {
    for (const p of ["/api/handover/parse-structured", "/api/billing/create-order"]) {
      const r = await fetch(base + p, { method: "POST", headers: AUTH, body: "{}" });
      check(r.status === 200, `non-SQL route ${p} unaffected by guard`);
    }
    const r = await fetch(base + "/api/sqlish");
    check(r.status === 200, "sibling path /api/sqlish not captured by /api/sql guard");
  });

  // ───────────── P-B: learning capture ─────────────
  const before = getAllFeedbackCorrections().length;
  const decision = learningCaptureDecision();
  check(decision.allowed === false, "capture decision is closed");

  for (const flag of [undefined, "true", "1"]) {
    if (flag === undefined) delete process.env.LEARNING_CAPTURE_ENABLED; else process.env.LEARNING_CAPTURE_ENABLED = flag;
    await withApp((app) => {
      app.post("/api/learning/feedback", learningFeedbackRejectHandler);
    }, async (base) => {
      const tag = `[LEARNING_CAPTURE_ENABLED=${flag ?? "unset"}]`;
      const payloads: [string, any][] = [
        ["missing consent", { field: "primary_diagnosis", ai_output: "Gastritis", corrected_output: "Inferior wall MI", source_context: "chest pain" }],
        ["spoofed identity", { field: "vitals", ai_output: "BP 90/60", corrected_output: "BP 120/80", corrected_by: "varahgrp@gmail.com", hasConsentedToLearning: true }],
        ["cross-tenant", { field: "patient_name", ai_output: "A B", corrected_output: "C D", hospital: VICTIM.hospital, caseId: "victim-case", corrected_by: "victim-uid" }],
        ["consent claimed in body", { field: "x", ai_output: "zz-ai-secret-1", corrected_output: "zz-corr-secret-2", consent: true, hasConsentedToLearning: true, workspaceId: "ws-other" }],
      ];
      for (const [name, body] of payloads) {
        const r = await fetch(base + "/api/learning/feedback", { method: "POST", headers: AUTH, body: JSON.stringify(body) });
        const j: any = await r.json();
        const echoed = JSON.stringify(j).includes(String(body.corrected_output)) || JSON.stringify(j).includes(String(body.ai_output));
        check(r.status === 403 && j.captured === false && j.code === "LEARNING_CAPTURE_DISABLED", `${tag} ${name} -> 403 rejected`);
        check(!echoed, `${tag} ${name}: submitted clinical content not echoed`);
      }
    });
  }
  delete process.env.LEARNING_CAPTURE_ENABLED;
  check(getAllFeedbackCorrections().length === before, "no correction was stored by any rejected attempt");
  void recordFeedbackCorrection; // imported only to prove the module loads; never called here

  // ───────────── B3: error-log redaction (malformed JSON must not leak its body) ─────────────
  {
    const logged: string[] = [];
    const statuses: number[] = [];
    const orig = console.error;
    console.error = (...a: any[]) => { logged.push(a.map((x) => (typeof x === "string" ? x : inspect(x, { depth: 6 }))).join(" ")); };
    try {
      await withApp((app) => {
        app.post("/echo", (_q, r) => r.json({ ok: true }));
        app.use((err: any, _req: any, res: any, _next: any) => { console.error("Unhandled server error:", errorForLog(err)); res.status(err.status || 500).json({ success: false }); });
      }, async (base) => {
        for (const raw of ['{"note":"ZZ-SECRET-CLINICAL chest pain", bad', "{ZZ-SECRET-CLINICAL", '{"a":"ZZ-SECRET-CLINICAL" "b":1}']) {
          const r = await fetch(base + "/echo", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
          statuses.push(r.status);
        }
      });
    } finally { console.error = orig; }
    const all = logged.join("\n");
    check(statuses.length === 3 && statuses.every((c) => c === 400), `malformed JSON still answered 400 (${statuses.join(",")})`);
    check(logged.length === 3, "each malformed request was logged once");
    check(!all.includes("ZZ-SECRET-CLINICAL"), "no request body text appears in error logs");
    check(/status: 400/.test(all) && /entity\.parse\.failed/.test(all), "log keeps status and error type");
    const plain = new Error("boom");
    check(errorForLog(plain) === plain, "non-body errors are logged unchanged");
    check(errorForLog(null) === null && errorForLog(undefined) === undefined, "null/undefined pass through");
    const withBody: any = new Error("x"); withBody.body = "ZZ-SECRET-CLINICAL";
    check(!JSON.stringify(errorForLog(withBody)).includes("ZZ-SECRET-CLINICAL"), "any error carrying .body is redacted");
  }

  // ───────────── Static wiring checks on server.ts ─────────────
  const server = fs.readFileSync("./server.ts", "utf8");
  const guardIdx = server.indexOf('app.use("/api/sql", legacySqlGuard)');
  check(guardIdx > 0, "server.ts mounts legacySqlGuard on /api/sql");
  const sqlRoutes = [...server.matchAll(/app\.(get|post|put|delete|patch)\(\s*["'`](\/api\/sql\/[^"'`]*)["'`]/g)];
  check(sqlRoutes.length >= 11, `found ${sqlRoutes.length} /api/sql route registrations`);
  check(sqlRoutes.every((m) => (m.index ?? 0) > guardIdx), "every /api/sql route is registered AFTER the guard");
  const nonSync = sqlRoutes.filter((m) => !m[2].startsWith("/api/sql/sync-user"));
  check(nonSync.length === 10, `10 non-sync routes remain behind guard (found ${nonSync.length})`);
  check(!/ENABLE_LEGACY_SQL_API|LEARNING_CAPTURE_ENABLED/.test(server), "server.ts does not read either re-enable flag");
  check(!/ENABLE_LEGACY_SQL_API|LEARNING_CAPTURE_ENABLED/.test(fs.readFileSync("./server/legacyContainment.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "guards do not read env flags in code");
  const syncBlock = server.slice(server.indexOf('app.post("/api/sql/sync-user"'), server.indexOf('app.get("/api/sql/cases"'));
  check(/req\.user\?\.uid !== uid/.test(syncBlock) && /403/.test(syncBlock), "sync-user UID ownership check intact");
  check(/app\.post\("\/api\/learning\/feedback", requireAuth, learningFeedbackRejectHandler\)/.test(server), "learning feedback route uses the rejecting handler");
  check(!/recordFeedbackCorrection/.test(server), "server.ts no longer calls recordFeedbackCorrection");
  check(/console\.error\("Unhandled server error:", errorForLog\(err\)\)/.test(server) && /console\.error\("Unhandled Error:", errorForLog\(err\)\)/.test(server), "both global error handlers log via errorForLog");
  check(!/console\.error\("Unhandled (server error|Error):", err\)/.test(server), "no global error handler logs the raw error object");

  // No other caller of recordFeedbackCorrection outside learningService itself.
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]);
  const callers = [...walk("./server"), ...walk("./src"), "./server.ts"].filter((f) => /\.(ts|tsx)$/.test(f) && f !== "./server/learningService.ts" && fs.readFileSync(f, "utf8").includes("recordFeedbackCorrection("));
  check(callers.length === 0, `no other caller of recordFeedbackCorrection (${callers.join(",") || "none"})`);

  // Client side
  const hv = fs.readFileSync("./src/components/HandoverView.tsx", "utf8");
  check(!hv.includes('"patient_name"'), "HandoverView no longer captures patient_name");
  check(/handleSaveModalEdit[\s\S]{0,900}setQuickPasteList\(prev => prev\.map\(item => item\.id === editingPatient\.id \? editingPatient : item\)\)/.test(hv), "HandoverView edit-save still updates the patient list");
  const lc = fs.readFileSync("./src/services/learningClient.ts", "utf8");
  check(/LEARNING_CAPTURE_CLIENT_ENABLED = false/.test(lc) && /if \(!LEARNING_CAPTURE_CLIENT_ENABLED\) return \{ captured: false \}/.test(lc), "client capture is closed (no network call)");
  check(!/captured: true/.test(lc.split("export async function captureFeedbackCorrection")[1].split("export async function")[0].replace(/Boolean\(data\.captured\)/, "")) , "client never fabricates captured:true");

  if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
  console.log("\nAll Batch 0 containment checks passed.");
}
main().catch((e) => { console.error(e); process.exit(1); });
