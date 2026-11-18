import { readFileSync } from "fs";
import { chatUsage, chatLimitLevel, buildCarryOver, CHAT_CHAR_BUDGET } from "./src/mate/chatLimit";
import { restoreDayMarkersDeep } from "./src/mate/dayplaceholder";
import { applyPastedSheetSections } from "./src/mate/pastedsheetsections";

let fail = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok) fail++; };

// chat limit
const msg = (n: number) => [{ id: "welcome", text: "x".repeat(5000) }, { id: "a", text: "y".repeat(n) }];
t("welcome text is not counted", chatUsage(msg(0)) === 0);
t("below 80% is ok", chatLimitLevel(chatUsage(msg(CHAT_CHAR_BUDGET * 0.5))) === "ok");
t("80% warns", chatLimitLevel(chatUsage(msg(CHAT_CHAR_BUDGET * 0.8))) === "warn");
t("90% is full", chatLimitLevel(chatUsage(msg(CHAT_CHAR_BUDGET * 0.9))) === "full");
const carry = buildCarryOver([
  { id: "1", sender: "user", text: "Bed 4, 60 year old male chest pain" },
  { id: "2", sender: "ai", text: "Saved to Bed 4A. ECG ordered." },
  { id: "3", sender: "user", text: "bed 7 fall from height" },
]);
t("carry-over lists beds", /Bed 4A/.test(carry) && /Bed 7/.test(carry));
t("carry-over without beds still guides", /bed number/i.test(buildCarryOver([{ id: "1", text: "hello" }])));

// [Day N] markers
const src = "RTA at 7:30 AM on 16/11/2026. Discharged on 17/11/2026.";
const r: any = restoreDayMarkersDeep({ events: "Accident at approximately 7:30 AM on [Day 1]", nested: ["seen on [Day 2]"], incident: "[Day 1] at approximately 7:30 AM" }, src);
t("Day 1 -> real date", r.events === "Accident at approximately 7:30 AM on 16/11/2026");
t("Day 2 -> real date (nested)", r.nested[0] === "seen on 17/11/2026");
t("leading marker restored", r.incident === "16/11/2026 at approximately 7:30 AM");
const r2: any = restoreDayMarkersDeep({ a: "happened on [Day 3]" }, "no dates here");
t("unmatched marker is removed, never shown", !/\[Day/.test(r2.a));

// GCS with tube
const sheet = "Primary Assessment:\n\nAirway → secured\n\nDisability → GCS: E1 VT M1, Pupils: right 2 mm left 3 mm , GRBS: 345 mg/dl\n\nExposure → Temperature: 97 F\n";
const a: any = applyPastedSheetSections({ vitals: { gcs: "3" } }, sheet);
t("E1 VT M1 keeps parts, drops fake total", a.vitals.gcs_v === "T" && a.vitals.gcs === undefined);
const b: any = applyPastedSheetSections({ vitals: { gcs: "15" } }, "Primary Assessment:\nDisability → GCS: E4 V5 M6\n");
t("numeric GCS total untouched", b.vitals?.gcs === "15");

// wiring
const vs = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("notes component wired", vs.includes("<MateComposerNotes") && vs.includes("buildCarryOver(messages"));
t("bed note shown outside discussion mode", vs.includes("showBedNote={!isDiscussionOnly}"));
t("button passes no click event to new chat", vs.includes("onClick={() => handleStartNewChat()}"));
t("day markers restored in both routes", (vs.match(/restoreDayMarkersDeep\(/g) || []).length >= 2);
const app = readFileSync("src/App.tsx", "utf8");
t("destination filled from stated disposition", app.includes("destinationUnit: existingMatch?.dispositionAndPlan?.destinationUnit"));
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);