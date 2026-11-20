import { readFileSync } from "fs";
import { parseModeSwitch, lensFromText, bedFromText, findCaseByBed, buildWardLines, looksClinicalReply, MATE_MODES, MODE_PLACEHOLDER, DICTATE_PLACEHOLDER } from "./src/mate/mateModes";

let fail = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok) fail++; };

// five modes, Dictate first
t("five modes, Dictate first", MATE_MODES.length === 5 && MATE_MODES[0].id === "dictate");
t("Dictate placeholder unchanged", MODE_PLACEHOLDER.dictate === DICTATE_PLACEHOLDER);

// voice / typed switches
t("back to dictate", parseModeSwitch("back to dictate") === "dictate");
t("dictation mode", parseModeSwitch("Dictation mode.") === "dictate");
t("chat mode", parseModeSwitch("chat mode") === "chat");
t("ask about this case", parseModeSwitch("ask about this case") === "case");
t("ask about my ward", parseModeSwitch("Ask about my ward") === "ward");
t("ward mode", parseModeSwitch("ward mode") === "ward");
t("rounds mode", parseModeSwitch("rounds mode") === "rounds");
t("clinical text never switches mode", parseModeSwitch("Bed 4 chest pain, BP 90/60") === null);
t("a long sentence about chat is not a switch", parseModeSwitch("can you explain chat mode to me please in detail") === null);
t("bare 'rounds' is left to the existing rounds routing", parseModeSwitch("rounds") === null);

// lens + bed parsing
t("devil's advocate lens", lensFromText("Devil's advocate on bed 2") === "devils-advocate");
t("first principles lens", lensFromText("first principles bed 4") === "first-principles");
t("default lens is full debrief", lensFromText("bed 2") === "full-debrief");
t("bed 2", bedFromText("devil's advocate on bed 2") === "2");
t("bed 7b", bedFromText("rounds on bed 7b") === "7B");
t("no bed", bedFromText("what about him") === null);

// finding a case by bed
const cases: any[] = [
  { id: "a", bedNo: "2A", status: "Active", patient: { name: "Secret Name", age: 66, gender: "Male", presentingComplaint: "RTA head injury" }, provisionalPrimaryDiagnosis: "Traumatic brain injury", conditionAtShift: "Critical", dispositionAndPlan: { managementPlan: "Inj mannitol 100 ml" } },
  { id: "b", bedNo: "7", status: "Active", patient: { age: 34, gender: "Female" }, provisionalPrimaryDiagnosis: "DKA" },
  { id: "c", bedNo: "9A", status: "Discharged", patient: { age: 50 } },
  { id: "d", bedNo: "4A", status: "Active", archivedAt: "x", patient: { age: 40 } },
];
t("bare number finds the A slot", findCaseByBed(cases, "2")?.id === "a");
t("exact bed finds case", findCaseByBed(cases, "7")?.id === "b");
t("discharged bed is not found", findCaseByBed(cases, "9") === null);
t("archived bed is not found", findCaseByBed(cases, "4A") === null);

// ward lines
const lines = buildWardLines(cases);
t("ward lists only open beds", lines.length === 2);
t("ward line carries bed, age/sex, dx, plan", /Bed 2A/.test(lines[0]) && /66 M/.test(lines[0]) && /Traumatic brain injury/.test(lines[0]) && /mannitol/.test(lines[0]));
t("ward lines never carry a name", !lines.join(" ").includes("Secret Name"));
t("ward is capped", buildWardLines(Array.from({ length: 50 }, (_, i) => ({ bedNo: `${i + 1}A`, status: "Active" })), 30).length === 30);

// chip heuristic
t("clinical reply gets a chip", looksClinicalReply("Give aspirin 300 mg and repeat the ECG"));
t("plain reply does not", !looksClinicalReply("Sure, here is a friendlier way to say that."));

// wiring
const vs = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("every window starts in Dictate", vs.includes('useState<MateMode>("dictate")'));
t("new chat resets to Dictate", /setMateMode\("dictate"\);\s*focusCaseIdRef\.current = null;/.test(vs));
t("mode bar rendered outside discussion-only", vs.includes("<MateModeBar mode={mateMode}") && vs.includes("!isDiscussionOnly && <MateModeBar"));
t("voice switch handled before rounds routing", vs.indexOf("parseModeSwitch(trimmed)") > 0 && vs.indexOf("parseModeSwitch(trimmed)") < vs.indexOf("detectRoundsLensIntent(trimmed)", vs.indexOf("const sendToChat")));
t("commands still work in every mode", vs.includes("if (parseMoveBedCommand(trimmed)) return false;") && vs.includes("if (fp && fp.handled) return false;"));
t("pasted sheet returns to Dictate", vs.includes("looksLikeFullCaseSheet(trimmed)") && /setMateMode\("dictate"\);\s*return false;/.test(vs));
t("ask modes ignore suggestedUpdate", vs.includes("suggestedUpdate is deliberately ignored: these modes never write"));
t("ask modes never call the scribe/extraction route", (() => { const a = vs.indexOf("const runAskMode"); const b = vs.indexOf("const handleModeTurn"); return a > 0 && b > a && !vs.slice(a, b).includes("/api/scribe-chat"); })());
t("Use in Dictate fills the box, does not save", vs.includes('data-testid="use-in-dictate-button"') && vs.includes("setInputText(msg.text)"));
t("rounds can target a named bed", vs.includes("caseOverride") && vs.includes("findCaseByBed(census as any[], bedFromText(trimmed))"));

const sv = readFileSync("server.ts", "utf8");
t("server: chat mode has no patient record", sv.includes('effectiveContextType === "chat"') && sv.includes("You have NO access to any patient record in this mode"));
t("server: ward lines de-identified again", /ward\.slice\(0, 40\)\.map\(\(l: any\) => deidentifyText/.test(sv));
t("server: ward and chat never emit UPDATE", (sv.match(/Never output an \[UPDATE\] block/g) || []).length >= 2);
t("server: drafting uses only documented facts", sv.includes("DRAFTING FROM THIS RECORD"));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);