// MARKER: ERMATE-SECURITY-FOLLOWUP-V1
import express from "express";
import fs from "fs";
import type { AddressInfo } from "net";
import { legacySqlGuard, buildSyncUserRecord, evaluateCreditGate } from "./server/legacyContainment";

let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };

async function main() {
  // S1: guard is pinned to POST + /sync-user
  const app = express(); app.use(express.json());
  const hits: string[] = [];
  app.use("/api/sql", legacySqlGuard);
  for (const m of ["get", "post", "put", "patch", "delete"] as const) (app as any)[m]("/api/sql/sync-user", (_q: any, r: any) => { hits.push(m.toUpperCase()); r.json({ ok: 1 }); });
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const m of ["GET", "PUT", "PATCH", "DELETE"]) {
      const r = await fetch(base + "/api/sql/sync-user", { method: m });
      check(r.status === 410, `${m} /api/sql/sync-user is blocked (410)`);
    }
    const ok = await fetch(base + "/api/sql/sync-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    check(ok.status === 200, "POST /api/sql/sync-user still reaches its handler");
    const ok2 = await fetch(base + "/api/sql/SYNC-USER/", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    check(ok2.status === 200, "POST case/trailing-slash variant still reaches its handler");
    const other = await fetch(base + "/api/sql/cases", { method: "POST" });
    check(other.status === 410, "POST on any other legacy path stays blocked");
    check(hits.join() === "POST,POST", "only POST handlers were ever reached: " + hits.join());
  } finally { server.close(); }

  // S3: sync-user never stores client-supplied privileged fields
  const evil = { uid: "u1", email: "a@b.c", name: "Dr A", role: "HOD", hospital: "Other Hospital", aiCredits: 999999, subscriptionTier: "Enterprise", hasConsentedToLearning: true, streak: 500, isAdmin: true };
  const rec = buildSyncUserRecord(evil, { uid: "u1", email: "real@x.in" })!;
  check(rec.insert.role === "EM Physician" && rec.insert.hospital === "Varah Group Emergency Care", "insert ignores client role/hospital");
  check(rec.insert.aiCredits === 350 && rec.insert.subscriptionTier === "Free Standard", "insert ignores client credits/tier");
  check(rec.insert.hasConsentedToLearning === null && rec.insert.streak === 0, "insert ignores client consent/streak");
  check(Object.keys(rec.update).sort().join() === "email,name", "update touches ONLY email and name");
  check(rec.insert.email === "real@x.in" && rec.update.email === "real@x.in", "email taken from verified token, not request body");
  check(buildSyncUserRecord({ name: "x", email: "e@e" }, { uid: "", email: "e@e" }) === null, "no token uid -> rejected");
  check(buildSyncUserRecord({ name: " ", email: "e@e" }, { uid: "u", email: "e@e" }) === null, "blank name -> rejected");
  check(buildSyncUserRecord({ name: "x".repeat(500) }, { uid: "u", email: "e@e" })!.update.name.length === 200, "name length capped");

  // credit gate
  check(evaluateCreditGate(0).allowed === false && evaluateCreditGate(-5).allowed === false, "stored balance < 1 is blocked");
  check(evaluateCreditGate(1).allowed === true && evaluateCreditGate(1).remaining === 0, "balance of 1 allowed, 0 remaining");
  check(evaluateCreditGate(undefined).allowed === true && evaluateCreditGate("9999" as any).allowed === true && evaluateCreditGate(NaN).allowed === true, "unknown balance does not block clinical use");

  // wiring in server.ts
  const server_ts = fs.readFileSync("server.ts", "utf8");
  const sync = server_ts.slice(server_ts.indexOf('app.post("/api/sql/sync-user"'), server_ts.indexOf('app.get("/api/sql/cases"')).replace(/\/\/.*$/gm, "");
  check(/req\.user\?\.uid !== uid/.test(sync) && /403/.test(sync), "sync-user UID ownership check intact");
  check(/buildSyncUserRecord\(req\.body, req\.user\)/.test(sync) && !/req\.body.*aiCredits|aiCredits.*req\.body|subscriptionTier/.test(sync), "sync-user uses the sanitised record, no privileged field reads");
  const voice = server_ts.slice(server_ts.indexOf('app.post("/api/voice-dictation"'), server_ts.indexOf("const safeSpeechText"));
  check(!/req\.body[^;]*aiCredits|aiCredits[^;]*=\s*req\.body/.test(voice) && /firestoreAdmin\.collection\("users"\)/.test(voice), "voice-dictation reads credits from the server record, not the body");
  check(!/ENABLE_LEGACY|process\.env/.test(fs.readFileSync("server/legacyContainment.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")), "guards remain non-configurable");

  console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
main();
