import { describeNewCriticalAfterUpdate } from "./src/utils/criticalSpeech";
import { toSpokenText, isMateVoiceEnabled, speakMate, setMateVoiceEnabled, isMateVoiceSupported } from "./src/mate/mateSpeech";
let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };
const mk = (vitals: any, extra: any = {}): any => ({ id: "c1", bedNo: "5", status: "Active", isPediatric: false, patient: { name: "Ramesh" }, vitals: { bp: "", hr: "", spo2: "", rr: "", temp: "", ...vitals }, ...extra });

const r = describeNewCriticalAfterUpdate(mk({ bp: "120/80" }), { vitals: { bp: "72/40", spo2: "85" } })!;
check(!!r && r.label === "Bed 5" && r.newAlerts.length === 2, "BP 72/40 + SpO2 85 announces two new criticals");
check(r.text.startsWith("Bed 5 now critical:") && r.text.includes("SBP 72 mmHg"), "spoken text: " + r.text);
check(describeNewCriticalAfterUpdate(mk({ bp: "120/80" }), { vitals: { bp: "118/76", hr: "90" } }) === null, "normal update: silent");
check(describeNewCriticalAfterUpdate(mk({ bp: "70/40" }), { vitals: { hr: "90" } }) === null, "already critical, unchanged: not re-announced");
const again = describeNewCriticalAfterUpdate(mk({ bp: "70/40" }), { vitals: { bp: "62/30" } });
check(!!again && again.newAlerts[0].display === "SBP 62 mmHg", "worsened value is announced again");
check(describeNewCriticalAfterUpdate(mk({ bp: "70/40" }), { vitals: { bp: "110/70" } }) === null, "recovered: no alert announced");
check(describeNewCriticalAfterUpdate(mk({}), { vitals: { pulse: "170" } })?.newAlerts[0].key === "hr", "pulse alias treated as HR");
check(describeNewCriticalAfterUpdate(mk({}), { vitals: { temp: "104.9" } })!.text.includes("104.9°F (40.5°C)"), "temperature in both units");
check(describeNewCriticalAfterUpdate(mk({}), {}) === null && describeNewCriticalAfterUpdate(mk({}), null) === null, "no vitals / null safe");
check(describeNewCriticalAfterUpdate(mk({}, { isPediatric: true }), { vitals: { hr: "190" } }) === null, "paediatric HR not judged by adult limits");
const nb = describeNewCriticalAfterUpdate(null, { bedNo: "7", vitals: { bp: "70/40" } });
check(!!nb && nb.label === "Bed 7", "new patient with no case yet uses dictated bed: " + nb?.text);
check(describeNewCriticalAfterUpdate(mk({ bp: "120/80" }, { status: "Discharged" }), { vitals: { bp: "60/30" } }) === null, "discharged case stays silent");

// Speech wrapper (Node has no speech engine / storage: must be a silent no-op)
check(toSpokenText("**Bed 5** 🔴 now critical: SBP 72") === "Bed 5 now critical: SBP 72", "markdown and emoji stripped");
check(isMateVoiceSupported() === false && isMateVoiceEnabled() === false && speakMate("hello") === false, "no engine / default off: never speaks, never throws");
setMateVoiceEnabled(true); setMateVoiceEnabled(false);
check(true, "toggle calls safe without storage");
if (failures) { console.error(failures + " failed"); process.exit(1); }
console.log("\nAll MATE critical announce checks passed.");