import { tryDeterministicFastPath } from "./src/mate/mateFastPath";
let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };
const mk = (id: string, bedNo: string, vitals: any, extra: any = {}): any => ({ id, bedNo, status: "Active", isPediatric: false, patient: { name: "P" + id, age: 50, gender: "Male" }, vitals: { bp: "", hr: "", spo2: "", rr: "", temp: "", ...vitals }, ...extra });
const cases = [mk("1", "3", { bp: "120/80" }), mk("2", "5", { bp: "72/40", spo2: "85", temp: "104.9" })];
const ask = (u: string, c = cases) => tryDeterministicFastPath({ utterance: u, censusCases: c });

for (const q of ["Who is critical?", "who are critical", "any critical patients?", "anyone critical", "Critical patients", "critical alerts", "who is critical right now?", "Show critical patients", "list critical patients"]) {
  const r = ask(q);
  check(!!r && r.handled && r.action === "CRITICAL_LIST", "recognised: " + q);
}
const r = ask("Who is critical?")!;
check(r.replyText!.includes("1 patient has critical values") && r.replyText!.includes("Bed 5") && r.replyText!.includes("Hypotension"), "reply lists Bed 5: " + r.replyText);
check(r.replyText!.includes("104.9°F (40.5°C)"), "temperature in both units");
check(!r.targetCaseId && !r.targetBed, "never selects or focuses a patient");
check(ask("who is critical", [mk("1", "3", { bp: "120/80" })])!.replyText!.includes("does not mean every patient is stable"), "none critical never claims safety");
check(ask("who is critical", [])!.handled === true, "empty census safe");
// must NOT hijack dictation or other questions
for (const q of ["Bed 5 patient is critical BP 70/40", "patient is critical", "BP 72/40", "what is a critical value for potassium", "open bed 5", "occupied beds"]) {
  const x = ask(q);
  check(!x || x.action !== "CRITICAL_LIST", "not hijacked: " + q);
}
if (failures) { console.error(failures + " failed"); process.exit(1); }
console.log("\nAll MATE critical query checks passed.");