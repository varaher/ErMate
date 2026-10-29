import { findCriticalCases, speakCaseAlerts, speakCriticalOverview } from "./src/utils/criticalSpeech";
let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };
const mk = (id: string, vitals: any, extra: any = {}): any => ({ id, status: "Active", isPediatric: false, patient: { name: "P" + id }, vitals: { bp: "", hr: "", spo2: "", rr: "", temp: "", ...vitals }, ...extra });

const cases = [
  mk("1", { bp: "120/80" }, { bedNo: "3" }),
  mk("2", { bp: "72/40", spo2: "85", temp: "104.9" }, { bedNo: "5" }),
  mk("3", { hr: "170" }, { bedNo: "" }),
  mk("4", { bp: "60/30" }, { status: "Discharged" }),
];
const list = findCriticalCases(cases);
check(list.length === 2, "only active critical cases listed (2)");
check(list[0].label === "Bed 5" && list[0].alerts.length === 3, "most alerts first, labelled by bed");
check(list[1].label === "P3", "no bed falls back to patient name");
const t = speakCaseAlerts("Bed 5", list[0].alerts);
check(t.includes("Hypotension, SBP 72 mmHg") && t.includes("SpO2 85%") && !t.includes("₂"), "speech text is TTS-friendly: " + t);
check(t.includes("104.9°F (40.5°C)"), "temperature spoken in both units");
const o = speakCriticalOverview(cases);
check(o.startsWith("2 patients have critical values."), "overview count");
check(speakCriticalOverview([mk("1", { bp: "120/80" })]).includes("does not mean every patient is stable"), "none critical never claims safety");
check(speakCriticalOverview(null).includes("No critical"), "null safe");
check(speakCriticalOverview([mk("9", { bp: "70/40" })]).startsWith("1 patient has critical values."), "singular wording");
if (failures) { console.error(failures + " failed"); process.exit(1); }
console.log("\nAll critical speech checks passed.");