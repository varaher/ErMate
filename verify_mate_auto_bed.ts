// MARKER: ERMATE-MATE-AUTO-BED-V1
import { readFileSync } from "fs";
import { pickNextFreeBed, parseMoveBedCommand, bedPickedNotice } from "./src/mate/autoBed";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const c = (bedNo: string, extra: any = {}) => ({ bedNo, ...extra });

// pick
t("empty ER picks 1A", pickNextFreeBed([], 30) === "1A");
t("skips occupied 1A", pickNextFreeBed([c("1A")], 30) === "2A");
t("skips a bed with only B occupied", pickNextFreeBed([c("1B")], 30) === "2A");
t("bare bed number counts as occupied", pickNextFreeBed([c("1"), c("2")], 30) === "3A");
t("lowest gap is used", pickNextFreeBed([c("1A"), c("3A")], 30) === "2A");
t("discharged does not occupy", pickNextFreeBed([c("1A", { status: "Discharged" })], 30) === "1A");
t("archived does not occupy", pickNextFreeBed([c("1A", { archivedAt: "2026-01-01" })], 30) === "1A");
t("unassigned cases do not occupy", pickNextFreeBed([c(""), { bedNo: null }], 30) === "1A");
t("full ER returns null", pickNextFreeBed([c("1A"), c("2A"), c("3B")], 3) === null);
t("respects capacity", pickNextFreeBed([c("1A")], 1) === null);

// move parsing
for (const [u, e] of [["Move to Bed 9", "9"], ["move to bed 9a", "9A"], ["shift him to 12", "12"], ["Please move this patient to bed no 4B.", "4B"], ["change bed to 9", "9"], ["set the bed number to bed 7", "7"], ["transfer to bed 3"], ] as any) t(`parses "${u}"`, parseMoveBedCommand(u) === (e ?? "3"));
for (const u of ["Bed 9", "move on to the next step", "move 9", "patient moved to bed 9 and is stable, BP 90/60", "move to bed", "move to bed 0", "", "move to bed 9 please call the family and arrange transport to the ward now"]) t(`ignores "${u}"`, parseMoveBedCommand(u) === null);

t("notice names the bed and the move command", bedPickedNotice("7A", false).includes("Bed 7A") && bedPickedNotice("7A", false).includes("move to Bed 9"));
t("sheet notice says nothing is applied", bedPickedNotice("7A", true).includes("Nothing is applied"));

// wiring
const v = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
t("App passes onAssignBed to MATE", /onEnsureDraftCase=\{handleEnsureDraftCase\}\s+onAssignBed=\{handleAssignBedToCase\}/.test(app));
t("paste with no bed picks a bed before holding", v.indexOf("pickNextFreeBed(activeCensusCases") > 0 && v.indexOf("pickNextFreeBed(activeCensusCases") < v.indexOf("pendingPastedSheetRef.current = {\n          text: trimmed"));
t("hold-and-ask stays as the fallback", v.includes('Which bed is this patient in?'));
t("dictation only picks when no bed was said", /if \(!rawBed\) \{[\s\S]{0,200}pickNextFreeBed/.test(v));
t("named bed is never overridden", /if \(rawBed\) \{\s*const alloc = allocateOrValidateBed\(rawBed/.test(v));
t("move needs Patient Focus", /parseMoveBedCommand\(trimmed\)[\s\S]{0,700}isFocusAuthorized\(focusCaseIdRef\.current, moveCaseId\)/.test(v));
t("move goes through the allocator (refuses occupied)", v.includes("await onAssignBed(moveCase.id, moveBedTo)") && readFileSync("src/utils/bedAllocation.ts", "utf8").includes("already occupied"));
t("move runs before the fast path and Stage 0", v.indexOf("parseMoveBedCommand(trimmed)") < v.indexOf("STAGE 0: NEVER GUESS THE PATIENT"));
t("Change bed button present", v.includes('data-testid="change-bed-button"'));
t("notice is spoken only via speakMate (off by default)", (v.match(/speakMate\(pickedText\)/g) || []).length === 2);
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);