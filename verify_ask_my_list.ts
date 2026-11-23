/** MATE "Ask: my list" (was "my ward"): new name, voice switch, richer bed lines, privacy and no-guessing rules. */
import fs from "node:fs";
import { MATE_MODES, MODE_ENTERED, parseModeSwitch, buildWardLines } from "./src/mate/mateModes.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

// name
t("mode label is 'Ask: my list'", MATE_MODES.find((m) => m.id === "ward")?.label === "Ask: my list");
t("entered message says my list", /my list/.test(MODE_ENTERED.ward) && !/ward/i.test(MODE_ENTERED.ward));
t("voice: 'ask about my list' / 'list mode' switch", parseModeSwitch("Ask about my list") === "ward" && parseModeSwitch("list mode") === "ward" && parseModeSwitch("switch to ask my list") === "ward");
t("voice: old phrases still work", parseModeSwitch("Ask about my ward") === "ward" && parseModeSwitch("ward mode") === "ward");
t("clinical text is never read as a switch", parseModeSwitch("patient on my list has chest pain, start aspirin") === null);

const chat = fs.readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("no 'my ward' wording left in the chat view", !/my ward/i.test(chat) && /Ask: my list/.test(chat) && /"Ask · list"/.test(chat));

// bed lines
const now = Date.parse("2026-11-23T12:00:00Z");
const base: any = {
  bedNo: "4", status: "Active", conditionAtShift: "Unstable",
  patient: { name: "Rajesh Kumar", age: 54, gender: "Male", presentingComplaint: "Chest pain 2 hours", uhid: "UHID-99887" },
  provisionalPrimaryDiagnosis: "Inferior STEMI",
  createdAt: "2026-11-23T05:30:00Z",
  vitals: { bp: "90/60", hr: "110", rr: "", spo2: "94", temp: "101", gcs: "15", grbs: "" },
  vitalFlags: ["Hypotension"],
  investigations: [{ testName: "Troponin", result: "2.4", isAbnormal: true }, { testName: "Creatinine", result: "" }],
  investigationsOrdered: [{ name: "Echo", status: "pending" }],
  dispositionAndPlan: { pendingInvestigations: ["Lipid profile"], consultsRequested: ["Cardiology"], managementPlan: "Primary PCI" },
  treatments: [{ drugName: "Inj. Heparin 5000 U IV" }, { drugName: "Tab Aspirin 325 mg" }],
};
const [line] = buildWardLines([base], 30, now);
t("line has bed, age/sex, complaint, dx", /^Bed 4 \| 54 M \| Complaint: Chest pain 2 hours \| Dx: Inferior STEMI/.test(line));
t("time in ER from createdAt (6h30m -> 6h)", /\| 6h in ER \|/.test(line));
t("recorded vitals only, as stored (no invented units, empty ones skipped)", /Vitals: BP 90\/60, HR 110, SpO2 94, Temp 101, GCS 15 \|/.test(line) && !/RR|GRBS/.test(line) && !/Temp 101 ?°/.test(line));
t("alerts, abnormal results, pending tests", /Alerts: Hypotension/.test(line) && /Abnormal: Troponin 2\.4/.test(line) && /Pending tests: Lipid profile, Echo, Creatinine/.test(line));
t("treatments, consults and plan", /Rx: Inj\. Heparin 5000 U IV, Tab Aspirin 325 mg/.test(line) && /Consults: Cardiology/.test(line) && /Plan: Primary PCI/.test(line));
t("no name and no UHID in the line", !/Rajesh|Kumar|UHID|99887/.test(line));
t("line stays under the server's 700 character cap", line.length < 700);

// absent data: nothing invented
const [bare] = buildWardLines([{ bedNo: "7", status: "Active", patient: {} } as any], 30, now);
t("empty bed has no invented vitals, alerts, tests or time", bare === "Bed 7 | Status: Active");
t("bad/future createdAt gives no time", !/in ER/.test(buildWardLines([{ ...base, createdAt: "nonsense" }], 30, now)[0]) && !/in ER/.test(buildWardLines([{ ...base, createdAt: "2027-01-01T00:00:00Z" }], 30, now)[0]));
t("discharged and archived beds are left out", buildWardLines([{ ...base, status: "Discharged" }, { ...base, archivedAt: "x" }], 30, now).length === 0);
t("awaiting-doctor triage patients are flagged", /Awaiting doctor/.test(buildWardLines([{ ...base, awaitingDoctor: true }], 30, now)[0]));
t("beds sort numerically and respect the cap", buildWardLines([{ ...base, bedNo: "10" }, { ...base, bedNo: "2" }], 1, now)[0].startsWith("Bed 2"));

// server side
const srv = fs.readFileSync("server.ts", "utf8");
t("server cap raised to 700 and de-identifies each line", /deidentifyText\(String\(l \|\| ""\)\.slice\(0, 700\)\)/.test(srv));
t("server tells the model missing means not documented", /A missing item means NOT DOCUMENTED, never normal/.test(srv));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);