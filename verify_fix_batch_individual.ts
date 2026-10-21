import fs from "fs";
import express from "express";
import http from "http";
import { apiRateLimit } from "./server/middleware/rateLimit.ts";
import { CREDIT_COSTS } from "./src/lib/pricing.ts";
import { CREDIT_USE_LABELS } from "./src/lib/creditDisplay.ts";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : (fail++, console.error("FAIL:", m)); };
const server = fs.readFileSync("server.ts", "utf8");
const app_ = fs.readFileSync("src/App.tsx", "utf8");

ok(!/app\.(post|get|use)\(\s*"\/api\/antigravity"/.test(server), "antigravity route removed");
ok(!server.includes("antigravity-preview"), "no antigravity agent call remains");
ok(/"\/api\/mortality-audit\/generate",\s*requireAuth,\s*meterCredits\("mortality_audit"/.test(server), "mortality audit metered after requireAuth");
ok(CREDIT_COSTS.mortality_audit === 3, "mortality_audit cost 3");
ok(CREDIT_USE_LABELS.some(l => l.actions.includes("mortality_audit")), "mortality audit listed in credit uses");
ok(/app\.use\("\/api", apiRateLimit\(\)\);\s*app\.use\(express\.json/.test(server), "rate limiter mounted before body parsing");
ok(app_.includes('localStorage.removeItem("ermate_activeDutySession")') && app_.includes('localStorage.removeItem("clinical_memory_log")'), "logout clears duty session + memory log");
const card = fs.readFileSync("src/components/CreditsPlanCard.tsx", "utf8");
ok(card.includes("What uses credits") && card.includes("Always free"), "credit explainer present");

// behaviour of the limiter
const app = express();
app.use("/api", apiRateLimit({ windowMs: 60000, max: 3 }));
app.get("/api/x", (_q, r) => r.json({ ok: 1 }));
app.post("/api/payments/webhook", (_q, r) => r.json({ ok: 1 }));
const srv = http.createServer(app).listen(0, async () => {
  const port = (srv.address() as any).port;
  const get = (p: string, m = "GET") => new Promise<number>(res => { const q = http.request({ port, path: p, method: m }, r => { r.resume(); res(r.statusCode!); }); q.end(); });
  const codes = []; for (let i = 0; i < 5; i++) codes.push(await get("/api/x"));
  ok(codes.slice(0, 3).every(c => c === 200) && codes[3] === 429 && codes[4] === 429, "limiter allows 3 then 429");
  ok((await get("/api/payments/webhook", "POST")) === 200, "webhook exempt from limiter");
  srv.close();
  console.log(`verify_fix_batch_individual: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
