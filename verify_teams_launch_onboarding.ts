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

for (const r of ["Postgraduate Resident", "Nursing In-charge", "Paramedic", "Other healthcare staff"]) {
  for (const f of ["src/components/OnboardingProfileView.tsx", "src/components/MoreView.tsx", "src/components/SignUpView.tsx"]) t(`role "${r}" offered in ${f}`, read(f).includes(r));
}
console.log(fail === 0 ? "ALL PASS verify_teams_launch_onboarding" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);