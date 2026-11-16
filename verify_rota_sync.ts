import { readFileSync } from "fs";
import { normalizeShift, resolveShiftTimes, pingDue, describeGoogleError, describeAuthError, missingScopes, REQUIRED_GOOGLE_SCOPES, SAMPLE_ROTA_TSV, shiftNoticeText } from "./src/lib/rotaSync";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const read = (p: string) => readFileSync(p, "utf8");

// times
const day = resolveShiftTimes({ shiftDate: "2026-11-20", startTime: "08:00", endTime: "14:00" })!;
t("morning ends same day", !!day && Date.parse(day.endIso) - Date.parse(day.startIso) === 6 * 3600000);
const night = resolveShiftTimes({ shiftDate: "2026-11-20", startTime: "20:00", endTime: "08:00" })!;
t("night shift ends next morning (12h)", !!night && Date.parse(night.endIso) - Date.parse(night.startIso) === 12 * 3600000);
t("iso times kept", resolveShiftTimes({ startTime: "2026-11-20T20:00:00.000Z", endTime: "2026-11-21T08:00:00.000Z" })!.endIso === "2026-11-21T08:00:00.000Z");
t("missing end rejected", resolveShiftTimes({ shiftDate: "2026-11-20", startTime: "08:00", endTime: "" }) === null);
t("garbage time rejected", resolveShiftTimes({ shiftDate: "x", startTime: "yy", endTime: "zz" }) === null);

// normalize
const ok = normalizeShift({ doctorEmail: " A@B.com ", shiftType: "Night", shiftDate: "2026-11-20", startTime: "20:00", endTime: "08:00" })!;
t("email lower-cased and trimmed", ok.doctorEmail === "a@b.com");
t("no email rejected", normalizeShift({ shiftType: "Night", shiftDate: "2026-11-20", startTime: "20:00", endTime: "08:00" }) === null);
t("bad email rejected", normalizeShift({ doctorEmail: "abc", shiftDate: "2026-11-20", startTime: "20:00", endTime: "08:00" }) === null);
t("over 24h rejected", normalizeShift({ doctorEmail: "a@b.c", startIso: "2026-11-20T00:00:00Z", endIso: "2026-11-21T06:00:00Z" }) === null);
t("end before start (iso) rejected", normalizeShift({ doctorEmail: "a@b.c", startIso: "2026-11-20T10:00:00Z", endIso: "2026-11-20T08:00:00Z" }) === null);
t("shift type defaults and is capped", normalizeShift({ doctorEmail: "a@b.c", shiftType: "", shiftDate: "2026-11-20", startTime: "8:00", endTime: "9:00" })!.shiftType === "Shift" && normalizeShift({ doctorEmail: "a@b.c", shiftType: "x".repeat(200), shiftDate: "2026-11-20", startTime: "8:00", endTime: "9:00" })!.shiftType.length === 60);

// ping
const now = Date.parse("2026-11-20T10:00:00Z");
t("ping at 30 min", pingDue(now + 30 * 60000, now));
t("ping at 10 min", pingDue(now + 10 * 60000, now));
t("no ping at 31 min", !pingDue(now + 31 * 60000, now));
t("no ping once started", !pingDue(now - 1000, now));
t("no ping NaN", !pingDue(NaN, now));
const n = shiftNoticeText("Night", now + 30 * 60000, now);
t("notice text", n.title === "Your night shift starts in 30 minutes");
t("notice singular", shiftNoticeText("Night", now + 60000, now).title.endsWith("1 minute"));

// errors
t("our-side API disabled", describeGoogleError(403, "Google Drive API has not been used in project 1 before or it is disabled", "drive").ourSide === true);
t("missing scope message", describeGoogleError(403, "Request had insufficient authentication scopes.", "drive").title.includes("did not give ErMate access"));
t("401 expired", describeGoogleError(401, "", "sheets").title.includes("expired"));
t("404 sheet", describeGoogleError(404, "", "sheets").title.includes("could not be found"));
t("never the old vague text", !describeGoogleError(500, "", "drive").title.includes("Failed to fetch"));
t("popup closed", describeAuthError("auth/popup-closed-by-user")!.title.includes("closed"));
t("popup blocked", describeAuthError("auth/popup-blocked")!.body.includes("Allow pop-ups"));
t("different account", describeAuthError("auth/user-mismatch")!.title.includes("different Google account"));
t("unknown auth code null", describeAuthError("auth/zzz") === null);
t("scopes all granted", missingScopes(REQUIRED_GOOGLE_SCOPES.join(" ")).length === 0);
t("scopes missing sheets", missingScopes(REQUIRED_GOOGLE_SCOPES[0] + " " + REQUIRED_GOOGLE_SCOPES[2]).join() === "Sheets");
t("scopes none", missingScopes("").join() === "Drive,Sheets,Calendar");
t("sample has 6 columns", SAMPLE_ROTA_TSV.split("\n")[0].split("\t").length === 6);

// wiring
const ws = read("src/services/googleWorkspace.ts");
t("never switches account (reauthenticate/link, not signInWithPopup)", ws.includes("reauthenticateWithPopup") && ws.includes("linkWithPopup") && !ws.includes("signInWithPopup"));
t("login hint set", ws.includes("login_hint"));
t("scope check present", ws.includes("tokeninfo"));
t("old vague error gone", !ws.includes('throw new Error("Failed to fetch spreadsheets")'));
const modal = read("src/components/shared/WorkspaceRotaSyncModal.tsx");
t("guide first step", modal.includes('useState<Step>("guide")') && !modal.includes("useEffect"));
t("sample copy button", modal.includes("copySample"));
t("counts only real invites", modal.includes("if (out.success) invites++"));
t("publishes to ErMate", modal.includes("publishRota("));
t("30 min reminder on invite", modal.includes("reminderMinutes: ROTA_PING_LEAD_MIN"));
t("calendar payload supports reminders", read("src/services/googleCalendar.ts").includes("payload.reminders"));
const team = read("server/routes/team.routes.ts");
t("publish route exists", team.includes('router.post("/rota/publish"'));
t("my-shifts route exists", team.includes('router.get("/rota/my-shifts"'));
t("publish limited to admin or rota manager", /rota\/publish[\s\S]{0,900}isTeamAdmin\(caller\) \|\| caller\.isRotaManager/.test(team));
t("publish checks the team roster", /rota\/publish[\s\S]{0,2500}roster\.has\(shift\.doctorEmail\)/.test(team));
t("deterministic ids (no duplicates)", team.includes('createHash("sha256").update(`${teamId}|${shift.doctorEmail}|${shift.startIso}`)'));
t("my-shifts reads own email only", /rota\/my-shifts[\s\S]{0,600}where\("doctorEmail", "==", email\)/.test(team));
t("firestore.rules untouched by rota", !read("firestore.rules").includes("rota_shifts"));
const app = read("src/App.tsx");
t("App uses alerts hook", app.includes("useRotaShiftAlerts(!!auth.currentUser && !!profile, triggerNotification)"));
const hook = read("src/hooks/useRotaShiftAlerts.ts");
t("hook pings once per shift", hook.includes("pinged.includes") && hook.includes("ermate_rota_pinged"));
t("hook announces updated rota once", hook.includes("Your rota is updated") && hook.includes("ermate_rota_seen_publish"));
t("sync button only for managers", /isRotaManager \|\| isUserTeamAdmin\) && \(\s*<button[\s\S]{0,200}setShowWorkspaceSync\(true\)/.test(read("src/components/TeamRosterBoard.tsx")));
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");