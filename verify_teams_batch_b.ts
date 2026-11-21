/**
 * Teams Batch B (20 Nov 2026) — the Team page.
 * Run: npx tsx verify_teams_batch_b.ts
 */
import { readFileSync } from "fs";
import { TEAM_ROLE_OPTIONS, teamRoleLabel, teamRoleOptionsFor } from "./src/lib/teamRoles";

let passed = 0, failed = 0;
const ok = (c: any, n: string) => { if (c) passed++; else { failed++; console.error("FAIL:", n); } };

const board = readFileSync("src/components/TeamRosterBoard.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const routes = readFileSync("server/routes/team.routes.ts", "utf8");

// H2: ex-members filtered out before any list
ok(/teamMembers:\s*teamMembersAll/.test(board), "H2: raw list renamed so nothing uses it by accident");
ok(/teamMembersAll[\s\S]{0,200}isActiveMembershipStatus\(m\.status\)\s*\|\|\s*isPendingApprovalStatus\(m\.status\)/.test(board), "H2: only active + pending members kept");
ok(/filteredMembers = teamMembers\.filter\(m => \{\s*if \(!isActiveMembershipStatus\(m\.status\)\) return false;/.test(board), "H2: members list / rota show active only");

// H4: fake panels gone
ok(!/Sandbox Invitation Simulator/.test(board), "H4: simulator removed");
ok(!/Department Covered \(Enterprise\)/.test(board), "H4: fake licence card removed");
ok(!/Simulated successful join/.test(board), "H4: no simulated approval call");

// H5: add clinician returns links and the page shows them
ok(/return link;/.test(app) && !/Please share this link: \$\{link\}/.test(app), "H5: App hands the link back instead of a toast + silent clipboard");
ok(/throw new Error\(err\?\.message \|\| "Failed to create invite\."\)/.test(app), "H5: failures reach the Team page");
ok(!/Successfully added Dr\./.test(board) && !/Successfully added \$\{newOnes\.length\}/.test(board), "H5: no false 'added' messages");
ok(/personalInviteLinks\.map/.test(board) && /wa\.me\/\?text=/.test(board), "H5: links listed with Copy + WhatsApp");

// M2: pending banner reads the doctor's own record
ok(/const \[myJoinRequest, setMyJoinRequest\]/.test(app), "M2: own join-request state");
ok(/if \(isPendingApprovalStatus\(membershipStatus\)\)/.test(app), "M2: set from own team_members listener");
ok(/if \(myJoinRequest\) \{/.test(app), "M2: banner uses it");

// Leave message no longer claims a plan change
ok(!/Standalone Standard plan/.test(app), "C2 follow-up: leave message fixed");

// M5: one role list, every entry accepted by the server
const serverSet = routes.match(/const INVITE_ALLOWED_ROLES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
const serverRoles = new Set([...serverSet.matchAll(/"([^"]+)"/g)].map(m => m[1]));
for (const r of TEAM_ROLE_OPTIONS) ok(serverRoles.has(r.toLowerCase()), `M5: server accepts "${r}"`);
// Decision 20 Nov 2026: the team lead can make a member HOD, so "HOD" is on the list (once).
ok(TEAM_ROLE_OPTIONS.filter(r => /hod/i.test(r)).length === 1 && TEAM_ROLE_OPTIONS.includes("HOD"), "M5: one HOD option, picked by the team lead");
ok(!/<option value="(Senior Consultant|HOD \/ Shift Lead|Staff Nurse)">/.test(board), "M5: no hard-coded role options left");
ok(teamRoleLabel("senior consultant") === "Senior Consultant", "label: lower-case stored role → display");
ok(teamRoleLabel("medical_officer") === "Medical Officer", "label: underscore role");
ok(teamRoleLabel("hod") === "HOD", "label: hod");
ok(teamRoleLabel("") === "", "label: empty");
ok(teamRoleOptionsFor("hod") === TEAM_ROLE_OPTIONS && teamRoleOptionsFor("Chief Resident")[0] === "Chief Resident", "options: keep a current off-list role visible");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);