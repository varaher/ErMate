/**
 * Teams Batch A (20 Nov 2026) — guards against the bugs coming back.
 * Run: npx tsx verify_teams_batch_a.ts
 */
import { readFileSync } from "fs";

let passed = 0, failed = 0;
const ok = (c: any, n: string) => { if (c) passed++; else { failed++; console.error("FAIL:", n); } };

const routes = readFileSync("server/routes/team.routes.ts", "utf8");
const resolver = readFileSync("src/utils/workspaceResolver.ts", "utf8");

// C1: the institution badge must not push team members into the individual workspace
ok(!/verificationStatus\s*===\s*"unverified"/.test(resolver), "C1: resolver ignores the badge");
ok(!/isInstitutionallyVerified\s*===\s*false/.test(resolver), "C1: resolver ignores isInstitutionallyVerified");
ok(/workspaceType:\s*"hospital"/.test(resolver), "C1: active verified member still resolves to hospital");

// C2: team routes never change the doctor's paid plan
const tierWrites = routes.match(/subscriptionTier\s*:/g) || [];
ok(tierWrites.length === 0, "C2: no subscriptionTier writes in team routes");
ok(!/hospital:\s*""\s*,/.test(routes), "C2/M7: leave/remove keep users.hospital");

// H1: no raw single-spelling status comparisons
ok(!/\.status\s*(===|!==)\s*"active"/.test(routes), "H1: no raw === \"active\" comparisons");
ok(!/\.status\s*(===|!==)\s*"active \(joined\)"/.test(routes), "H1: no raw \"active (joined)\" comparisons");
ok(/function isActiveStatus/.test(routes), "H1: shared isActiveStatus helper exists");

// The helper itself accepts every spelling
const helper = routes.match(/function isActiveStatus\(status: unknown\): boolean \{[\s\S]*?\n\}/)?.[0] || "";
const isActiveStatus = new Function("status", helper.replace(/^function isActiveStatus\(status: unknown\): boolean \{/, "").replace(/\}$/, "").replace(/String\(status \|\| ""\)/, 'String(status || "")')) as (s: unknown) => boolean;
for (const s of ["active", "Active", "ACTIVE", "Active (Joined)", "active (joined)", " Active (joined) "]) ok(isActiveStatus(s), `H1: "${s}" counts as active`);
for (const s of ["pending_approval", "inactive", "rejected", "cancelled", "", undefined]) ok(!isActiveStatus(s), `H1: "${s}" is not active`);

// H6: set-rota-manager checks the caller's team
const rota = routes.slice(routes.indexOf('router.post("/set-rota-manager"'), routes.indexOf('router.post("/verify-team"'));
ok(/callerTeamId\s*!==\s*targetTeamId/.test(rota), "H6: rota manager limited to the admin's own team");

// L1: looping /appoint-admin is gone
ok(!/router\.post\("\/appoint-admin"/.test(routes), "L1: /appoint-admin removed");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);