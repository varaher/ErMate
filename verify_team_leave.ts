// MARKER: ERMATE-TEAM-LEAVE-V1
// Team home must offer "Leave team" with a confirm step; the server rule for sole admins stays.
import { readFileSync } from "fs";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const read = (p: string) => readFileSync(p, "utf8");
const home = read("src/components/TeamHomeView.tsx");
const board = read("src/components/TeamRosterBoard.tsx");
const srv = read("server/routes/team.routes.ts");
t("Leave team button", home.includes('data-testid="team-home-leave"'));
t("confirm step with plain wording", home.includes('data-testid="team-home-leave-confirm"') && home.includes("Yes, leave team") && home.includes("Stay in team"));
t("says own cases stay with the doctor", home.includes("Your own cases stay with you"));
t("lead with other members is warned first", home.includes("Make another member Team Admin first"));
t("wired from the board", board.includes("onLeaveTeam={onLeaveTeam}") && board.includes("isLead={isUserTeamAdmin}"));
t("server still blocks the sole Team Admin when others remain", srv.includes("Cannot leave team: You are the sole active Team Admin"));
console.log(fail === 0 ? "ALL PASS verify_team_leave" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);