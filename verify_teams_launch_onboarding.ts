// MARKER: ERMATE-TEAMS-LAUNCH-V1
// Mandatory profile (no skip), hospital location required, team step, existing-user notice.
import { readFileSync } from "fs";
import { hasHospitalLocation, isClinicalProfileComplete } from "./src/utils/profileCompleteness";
import { FEATURES } from "./src/config/features";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const read = (p: string) => readFileSync(p, "utf8");
const onb = read("src/components/OnboardingProfileView.tsx");
const app = read("src/App.tsx");

// no skip anywhere
t("skip button text is gone", !onb.includes("Skip for now"));
t("onSkipToTrial prop is gone", !onb.includes("onSkipToTrial") && !app.includes("onSkipToTrial"));
t("trial-mode bypass state is gone", !app.includes("exploreInTrialMode") && !app.includes("setExploreInTrialMode"));
t("gate no longer lets incomplete users through", /!isVerifiedTeamUser && \(!isProfileComplete \|\| !hasHospitalLocation\(profile\)\)/.test(app));

// hospital location
const base: any = { name: "Dr A", role: "Consultant", workplaceName: "City Hospital", department: "Emergency Medicine" };
t("profile without place/district/state needs location", !hasHospitalLocation(base));
t("existing complete profile still counts as complete otherwise", isClinicalProfileComplete(base, null));
t("profile with location passes", hasHospitalLocation({ ...base, place: "Thrissur", district: "Thrissur", state: "Kerala" }));
t("one missing field fails", !hasHospitalLocation({ ...base, place: "Thrissur", district: "Thrissur" }));
t("null profile fails", !hasHospitalLocation(null));
t("form submit still requires place district state", /place|district|state/.test(onb));

// team step
t("teams launch flag on", FEATURES.teamsLaunch === true);
t("directory stays hidden", FEATURES.teamsForIndividuals === false);
t("create team button", onb.includes('data-testid="onboarding-create-team"'));
t("join with invite link calls request-join", onb.includes("requestToJoinTeam(token"));
t("rota button after team created", onb.includes('data-testid="onboarding-open-rota"') && app.includes("onOpenTeam"));
t("team tab open under teamsLaunch", app.includes("FEATURES.teamsLaunch"));

// existing users
t("incomplete existing doctors see the launch notice", onb.includes('data-testid="teams-launch-notice"'));
t("one-time bell notification", app.includes("ermate_teams_launch_notice_v1_") && app.includes("ErMate Teams are here"));
t("team tip target exists", read("src/components/MoreView.tsx").includes('data-coach="more-team"'));

const cl = read("src/changelog.ts");
t("changelog has a 3.2.0 entry that mentions Teams", /"3\.2\.0": \[[\s\S]*?ErMate Teams/.test(cl));
t("APP_VERSION is 3.2.0 in changelog, server and package.json", cl.includes('APP_VERSION = "3.2.0"') && read("server.ts").includes('const APP_VERSION = "3.2.0"') && /"version": "3\.2\.0"/.test(read("package.json")));
const srv = read("server/routes/team.routes.ts");
const board = read("src/components/TeamRosterBoard.tsx");
const home = read("src/components/TeamHomeView.tsx");
const psv = read("src/components/ProfileSettingsView.tsx");
t("server flag exists", srv.includes("const AUTO_VERIFY_SELF_SERVE_TEAMS = true;"));
t("create-team uses the flag", /membershipVerified: AUTO_VERIFY_SELF_SERVE_TEAMS,/.test(srv));
t("approval uses the flag", srv.includes("membershipVerified: isInstVerified || AUTO_VERIFY_SELF_SERVE_TEAMS"));
t("rota tab opens first after onboarding and creation", board.includes("ermate_open_rota") && app.includes("ermate_open_rota"));
t("individual team screen explains what unlocks", board.includes('data-testid="team-unlock-hint"'));
for (const id of ["team-home-edit-profile", "team-home-edit-hospital", "team-home-edit-team", "team-home-edit-shifts", "team-home-sync-rota"]) t(`Team home row ${id}`, home.includes(`testId="${id}"`));
for (const w of ["Edit my profile", "Edit hospital profile", "Edit team", "Edit shift timings", "Sync rota with team members"]) t(`plain wording: ${w}`, home.includes(w));
t("board starts on Team home", board.includes('return "home";') && board.includes("<TeamHomeView"));
t("profile and hospital rows are wired from the More screen", psv.includes('onEditProfile={() => setSelectedSubSection("profile")}') && psv.includes('onEditHospital={() => setSelectedSubSection("facility")}'));
t("old scary banner text is gone", !board.includes("Awaiting Institutional Verification") && !board.includes("remain protected in your private individual workspace"));
t("calm team status line exists", board.includes('data-testid="team-status-line"') && board.includes("Your team is active."));
t("activate route is admin only and dry-run by default", /router\.post\("\/activate-waiting-teams"[\s\S]*?isPlatformAdminReq[\s\S]*?req\.body\?\.confirm !== true[\s\S]*?dryRun: true/.test(srv));
const act = srv.slice(srv.indexOf('router.post("/activate-waiting-teams"'), srv.indexOf('router.post("/create-team"'));
t("activate route only sets membershipVerified, never the institution badge", act.includes("{ membershipVerified: true, updatedAt: now }") && !/verificationStatus:/.test(act));
t("admin button asks before activating", board.includes("window.confirm(`${preview.waitingMembers}") && board.includes("activateWaitingTeams(false)"));
for (const r of ["Postgraduate Resident", "Nursing In-charge", "Paramedic", "Other healthcare staff"]) {
  for (const f of ["src/components/OnboardingProfileView.tsx", "src/components/MoreView.tsx", "src/components/SignUpView.tsx"]) t(`role "${r}" offered in ${f}`, read(f).includes(r));
}
console.log(fail === 0 ? "ALL PASS verify_teams_launch_onboarding" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);