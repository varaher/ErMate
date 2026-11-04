/**
 * Verifies the admin portal's access gate and HOD approval warnings.
 * Run: npx tsx verify_admin_portal.ts
 */
import { requirePlatformAdminVerified } from "./server/routes/admin.routes";
import { hodApprovalWarnings, resolveHodHospital } from "./server/services/hodClaimChecks";
import { readFileSync } from "fs";

let passed = 0, failed = 0;
const ok = (c: any, n: string) => { if (c) passed++; else { failed++; console.error("FAIL:", n); } };

function gate(user: any, env?: string) {
  const prev = process.env.ADMIN_UIDS;
  if (env === undefined) delete process.env.ADMIN_UIDS; else process.env.ADMIN_UIDS = env;
  let status = 200, nexted = false, body: any = null;
  const res: any = { status(s: number) { status = s; return this; }, json(b: any) { body = b; return this; } };
  requirePlatformAdminVerified({ user } as any, res, () => { nexted = true; });
  if (prev === undefined) delete process.env.ADMIN_UIDS; else process.env.ADMIN_UIDS = prev;
  return { status, nexted, body };
}

// ── access gate ──
ok(gate({ uid: "a", email: "varahgrp@gmail.com", email_verified: true }).nexted, "owner, verified → allowed");
ok(gate({ uid: "a", email: "VarahGrp@Gmail.com ", email_verified: true }).nexted, "owner email case/space-insensitive");
ok(gate({ uid: "a", email: "varahgrp@gmail.com", email_verified: false }).status === 403, "owner but unverified → 403");
ok(gate({ uid: "a", email: "varahgrp@gmail.com", email_verified: false }).body?.code === "EMAIL_NOT_VERIFIED", "unverified gets a clear code");
ok(gate({ uid: "b", email: "doctor@x.com", email_verified: true }).status === 403, "other doctor → 403");
ok(gate({ uid: "b" }).status === 403, "no email → 403");
ok(gate({ uid: "a", email: "varahgrp@gmail.com", email_verified: true }, "a,z").nexted, "UID allowlist match → allowed");
ok(gate({ uid: "x", email: "varahgrp@gmail.com", email_verified: true }, "a,z").status === 403, "UID allowlist mismatch → 403");

// ── HOD warnings with an in-memory team_members ──
function fakeDb(members: Record<string, any>) {
  return {
    collection: (_: string) => ({
      doc: (id: string) => ({ get: async () => ({ exists: id in members, data: () => members[id] }) }),
      where: (f: string, _op: string, v: any) => ({
        get: async () => ({ docs: Object.entries(members).filter(([, m]) => m[f] === v).map(([id, m]) => ({ id, data: () => m })) }),
      }),
    }),
  };
}
async function main() {
  ok(resolveHodHospital({ hospital: "St. Mary's Hospital, Thrissur" }).hospitalId === "st__mary_s_hospital__thrissur", "hospital id slug unchanged from before");
  ok(resolveHodHospital({ hospital: "X", hospitalId: "h1" }).hospitalId === "h1", "explicit claim hospitalId wins");

  const db = fakeDb({
    hod1: { hospitalId: "h1", status: "active", role: "HOD / Department Lead", name: "Dr. Existing" },
    oldHod: { hospitalId: "h1", status: "removed", role: "HOD / Department Lead", name: "Dr. Gone" },
    mover: { hospitalId: "h2", status: "active", role: "Resident", hospitalName: "Other Hospital" },
    sameTeam: { hospitalId: "h1", status: "active", role: "Resident" },
  });
  const none = await hodApprovalWarnings(db, "newbie", "h3", "New Hospital");
  ok(none.length === 0, "fresh doctor, hospital without HOD → no warnings");
  const dup = await hodApprovalWarnings(db, "newbie", "h1", "Hospital One");
  ok(dup.length === 1 && dup[0].includes("Dr. Existing") && dup[0].includes("2 HODs"), "existing active HOD flagged (inactive ignored)");
  const move = await hodApprovalWarnings(db, "mover", "h3", "New Hospital");
  ok(move.length === 1 && move[0].includes("Other Hospital"), "member of another hospital flagged");
  const same = await hodApprovalWarnings(db, "sameTeam", "h1", "Hospital One");
  ok(same.length === 1 && !same[0].includes("moves them"), "promoting own team member: only duplicate-HOD warning");
  const self = await hodApprovalWarnings(db, "hod1", "h1", "Hospital One");
  ok(self.length === 0, "re-approving the existing HOD is not a duplicate of themselves");

  // ── wiring checks on the source ──
  const team = readFileSync("server/routes/team.routes.ts", "utf8");
  ok(team.includes("HOD_APPROVAL_NEEDS_CONFIRMATION") && team.includes("confirmWarnings !== true"), "approve endpoint requires confirmation when warned");
  const server = readFileSync("server.ts", "utf8");
  ok(server.indexOf('import "./server/services/aiUsageHook.ts"') < server.indexOf("import express"), "usage hook is the first import");
  ok(server.includes('app.use("/api/admin", adminRouter)'), "admin API mounted");
  const rules = readFileSync("firestore.rules", "utf8");
  for (const c of ["aiUsageEvents", "aiUsageDaily", "adminAuditLog", "providerBalances"]) {
    ok(new RegExp(`match /${c}/\\{\\w+\\} \\{\\s*allow read, write: if false;`).test(rules), `${c} is server-only in rules`);
  }
  const panel = readFileSync("src/components/AdminPanelView.tsx", "utf8");
  ok(!panel.includes("exchangeRateINR") && !panel.includes('doc(db, "users", editingUser.email)'), "old fake cost panel and email-keyed credit edit removed");
  const stream = readFileSync("server/sarvamRealtimeStream.ts", "utf8");
  ok(stream.includes("verifyIdToken") && stream.includes("checkCreditAccess") && stream.includes("MAX_SESSION_SECONDS"), "voice stream: auth + credits + time cap");

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });