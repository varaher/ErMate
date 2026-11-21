/**
 * Teams Batch C (20 Nov 2026) — Neeraj's decisions:
 *  1. A team lead creates the team and can make members HOD (no platform approval needed).
 *  2. One team per hospital: once a hospital has a team, others request to join it.
 *  3. The team's own admins approve role-change requests.
 *  + HOD claims approved in admin.ermate.in land in the doctor's real team (no empty "phantom" team).
 * Run: npx tsx verify_teams_batch_c.ts
 */
import { readFileSync } from "fs";
import { hospitalKey, sameHospital, identityFromUser, identityFromTeam, findExistingHospitalTeam } from "./server/services/hospitalTeamMatch";
import { TEAM_ROLE_OPTIONS, teamRoleLabel } from "./src/lib/teamRoles";

let passed = 0, failed = 0;
const ok = (c: any, n: string) => { if (c) passed++; else { failed++; console.error("FAIL:", n); } };

// ── 1. Matching rules ──
ok(hospitalKey("M.B.M. Hospital, Kochi") === "mbm-hospital-kochi", "key: same as hospital directory");
ok(sameHospital({ nameKey: "a", directoryId: "x" }, { nameKey: "b", directoryId: "x" }), "same directory id → same hospital");
ok(!sameHospital({ nameKey: "a", directoryId: "x" }, { nameKey: "a", directoryId: "y" }), "different directory ids → different, even with the same name");
ok(sameHospital({ nameKey: "jubilee" }, { nameKey: "jubilee", directoryId: "z" }), "name match when one side has no directory id");
ok(!sameHospital({ nameKey: "general-hospital", district: "Thrissur" }, { nameKey: "general-hospital", district: "Kollam" }), "same name, different districts → different");
ok(sameHospital({ nameKey: "general-hospital", district: "Thrissur" }, { nameKey: "general-hospital" }), "same name, one district unknown → same");
ok(!sameHospital({ nameKey: "" }, { nameKey: "" }), "empty never matches");
const u = { workplaceName: "Jubilee Mission", hospitalDirectoryId: "jubilee-mission__thrissur__kerala", district: "Thrissur" };
ok(identityFromUser(u).directoryId === u.hospitalDirectoryId, "profile hospital carries its directory id");
ok(identityFromUser(u, "Other Hospital").directoryId === undefined, "a different typed hospital uses the name only");
ok(identityFromTeam({ hospitalName: "Jubilee Mission" }, u).district === "Thrissur", "older team borrows district from its creator");

// ── 2. Finder against a fake database ──
function fakeDb(data: { teams: any[]; users: Record<string, any>; members: any[] }) {
  return {
    collection(name: string) {
      if (name === "teams") return { limit: () => ({ get: async () => ({ docs: data.teams.map(t => ({ id: t.id, data: () => t })) }) }) };
      if (name === "users") return { doc: (id: string) => ({ get: async () => ({ exists: !!data.users[id], data: () => data.users[id] }) }) };
      if (name === "team_members") return { where: (_f: string, _op: string, v: string) => ({ get: async () => ({ docs: data.members.filter(m => m.hospitalId === v).map(m => ({ id: m.uid, data: () => m })) }) }) };
      throw new Error("unexpected collection " + name);
    },
  };
}
(async () => {
  const db = fakeDb({
    teams: [
      { id: "team_jub_1", hospitalName: "Jubilee Mission", teamName: "Jubilee ER", createdByUid: "lead1" },
      { id: "team_gen_1", hospitalName: "General Hospital", teamName: "GH Thrissur", createdByUid: "lead2", district: "Thrissur" },
      { id: "team_dead", hospitalName: "Amala Hospital", teamName: "Amala ER", createdByUid: "lead3" },
    ],
    users: { lead1: u, lead2: { workplaceName: "General Hospital", district: "Thrissur" }, lead3: { workplaceName: "Amala Hospital" } },
    members: [
      { uid: "lead1", hospitalId: "team_jub_1", status: "active" },
      { uid: "doc2", hospitalId: "team_jub_1", status: "Active (Joined)" },
      { uid: "lead2", hospitalId: "team_gen_1", status: "active" },
      { uid: "lead3", hospitalId: "team_dead", status: "inactive" },
    ],
  });
  const found = await findExistingHospitalTeam(db, identityFromUser({ workplaceName: "Jubilee  Mission.", hospitalDirectoryId: u.hospitalDirectoryId, district: "Thrissur" }));
  ok(found?.teamId === "team_jub_1" && found.activeMembers === 2, "finds the hospital's team and counts both active spellings");
  ok(!(await findExistingHospitalTeam(db, identityFromUser({ workplaceName: "General Hospital", district: "Kollam" }))), "General Hospital, Kollam is not GH Thrissur's team");
  ok((await findExistingHospitalTeam(db, identityFromUser({ workplaceName: "General Hospital", district: "Thrissur" })))?.teamId === "team_gen_1", "General Hospital, Thrissur matches");
  ok(!(await findExistingHospitalTeam(db, identityFromUser({ workplaceName: "Amala Hospital" }))), "a team with no active members never blocks the hospital");
  ok(!(await findExistingHospitalTeam(db, identityFromUser({ workplaceName: "New Hospital" }))), "a new hospital has no team");

  // ── 3. Server wiring ──
  const routes = readFileSync("server/routes/team.routes.ts", "utf8");
  const create = routes.slice(routes.indexOf("const handleCreateTeam"), routes.indexOf('router.post("/create-team"'));
  ok(/findExistingHospitalTeam\(db, myHospital\)/.test(create) && /status\(409\)/.test(create) && /HOSPITAL_TEAM_EXISTS/.test(create), "create-team refuses a second team for the same hospital (409)");
  ok(/hospitalNameKey:/.test(create) && /hospitalDirectoryId:/.test(create), "new teams store their hospital identity");
  ok(/router\.get\("\/hospital-team"/.test(routes), "lookup endpoint exists");
  const join = routes.slice(routes.indexOf('router.post("/request-join"'), routes.indexOf('router.post("/request-join"') + 3000);
  ok(/collection\("teams"\)\.doc\(requestedHospitalId\)/.test(join) && /That team was not found/.test(join), "request-to-join by team checks the team exists and uses its own names");
  const upd = routes.slice(routes.indexOf('router.post("/update-role"'), routes.indexOf('router.post("/update-role"') + 6000);
  ok(/const makesHod = isExactHospitalAdminRole\(normalizedRole\)/.test(upd) && /else if \(makesHod\)/.test(upd), "a lead making someone HOD makes them Team Admin");
  ok(/losesAdmin/.test(upd), "taking HOD away can't leave the team with no admin");
  const hod = routes.slice(routes.indexOf('router.post("/approve-hod-claim"'), routes.indexOf('router.post("/approve-hod-claim"') + 5000);
  ok(/HOD_CLAIMANT_NOT_IN_TEAM/.test(hod) && /const resolvedHospitalId = claimantTeamId;/.test(hod), "HOD approval uses the doctor's real team, refuses when not in one");
  ok(/teamId: resolvedHospitalId/.test(hod), "HOD approval keeps teamId and hospitalId the same");
  for (const ep of ['router.get("/role-requests"', 'router.post("/role-requests/create"', 'router.post("/role-requests/cancel"', 'router.post("/role-requests/decide"']) ok(routes.includes(ep), `endpoint ${ep}`);
  const decide = routes.slice(routes.indexOf('router.post("/role-requests/decide"'), routes.indexOf('router.post("/remove-member"'));
  ok(/isTeamAdmin\(caller\)/.test(decide) && /This request is not in your team/.test(decide), "only admins of that team decide");
  ok(/You cannot decide your own request/.test(decide), "nobody approves their own request");
  ok(/no longer an active member of the team/.test(decide), "approval re-checks the doctor is still in the team");

  // ── 4. App wiring ──
  const roleUi = readFileSync("src/components/RoleChangeSection.tsx", "utf8");
  ok(!/from "firebase\/firestore"/.test(roleUi), "role requests no longer read Firestore directly (rules blocked reviewers)");
  ok(/decideRoleRequest/.test(roleUi) && /canReview/.test(roleUi), "team admins review from the Role section");
  ok(TEAM_ROLE_OPTIONS.includes("HOD") && teamRoleLabel("hod / department lead") === "HOD", "HOD is a role the lead can pick");
  const serverSet = routes.match(/const INVITE_ALLOWED_ROLES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  for (const r of TEAM_ROLE_OPTIONS) ok(serverSet.includes(`"${r.toLowerCase()}"`), `server accepts "${r}"`);
  const start = readFileSync("src/components/TeamStartCard.tsx", "utf8");
  const onboarding = readFileSync("src/components/OnboardingProfileView.tsx", "utf8");
  ok(/<HospitalTeamFinder/.test(start) && /\{!hospitalHasTeam && \(/.test(start), "Team page: Request to join replaces Create team when the hospital has one");
  ok(/<HospitalTeamFinder/.test(onboarding) && /\{!hospitalHasTeam && \(/.test(onboarding), "Onboarding: same");
  const tours = readFileSync("src/lib/coachTours.ts", "utf8");
  ok(/feature: "hospital-team-join"/.test(tours) && /feature: "team-role-requests"/.test(tours), "walkthrough tips for both new features");
  const adminRoutes = readFileSync("server/routes/admin.routes.ts", "utf8");
  ok(/Not in a team yet/.test(adminRoutes), "admin HOD list warns when the doctor is not in a team");

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });