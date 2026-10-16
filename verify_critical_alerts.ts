import { computeCriticalAlerts, tempToCelsius, formatTempBoth } from "./src/utils/criticalAlerts";
let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };
const mk = (vitals: any, extra: any = {}): any => ({ id: "x", status: "Active", isPediatric: false, vitals: { bp: "", hr: "", spo2: "", rr: "", temp: "", gcs: "", gcs_e: "", gcs_v: "", gcs_m: "", grbs: "", avpu: "", painScore: "", ...vitals }, ...extra });
const keys = (c: any) => computeCriticalAlerts(c).map((a) => a.key).sort().join(",");

check(keys(mk({ bp: "120/80", hr: "88", rr: "16", spo2: "98", temp: "98.6", grbs: "110", gcs: "15" })) === "", "normal patient: no alert");
check(keys(mk({ hr: "105", spo2: "93", bp: "89/60", temp: "100.8", rr: "22", gcs: "14", grbs: "190" })) === "", "merely abnormal values do NOT alert");
check(keys(mk({ bp: "72/40" })) === "sbp", "SBP 72 alerts");
check(keys(mk({ bp: "80/50" })) === "", "SBP 80 does not (limit is <80)");
check(keys(mk({ hr: "160" })) === "hr" && keys(mk({ hr: "38" })) === "hr", "HR 160 and 38 alert");
check(keys(mk({ rr: "34" })) === "rr" && keys(mk({ rr: "6" })) === "rr", "RR 34 and 6 alert");
check(keys(mk({ spo2: "85" })) === "spo2" && keys(mk({ spo2: "88" })) === "", "SpO2 85 alerts, 88 does not");
check(keys(mk({ gcs: "8" })) === "gcs" && keys(mk({ gcs: "9" })) === "", "GCS 8 alerts, 9 does not");
check(keys(mk({ gcs: "", gcs_e: "1", gcs_v: "2", gcs_m: "4" })) === "gcs", "GCS summed from E/V/M = 7 alerts");
check(keys(mk({ grbs: "40" })) === "grbs" && keys(mk({ grbs: "450" })) === "grbs", "GRBS 40 and 450 alert");

// Temperature, both units
check(keys(mk({ temp: "98.6" })) === "", "98.6 F is normal (unit bug regression)");
check(keys(mk({ temp: "37" })) === "", "37 C is normal");
check(keys(mk({ temp: "104.9" })) === "temp", "104.9 F alerts");
check(keys(mk({ temp: "40.5" })) === "temp", "40.5 C alerts");
check(keys(mk({ temp: "94" })) === "temp", "94 F hypothermia alerts");
check(keys(mk({ temp: "34.2" })) === "temp", "34.2 C hypothermia alerts");
check(keys(mk({ temp: "104.0" })) === "" && keys(mk({ temp: "40.0" })) === "", "exactly 104 F / 40 C does not alert (limit is >40)");
check(formatTempBoth(104.9) === "104.9°F (40.5°C)", "display shows both units: " + formatTempBoth(104.9));
check(formatTempBoth(40.5) === "104.9°F (40.5°C)", "display from C shows both units: " + formatTempBoth(40.5));
check(tempToCelsius(9) === null && tempToCelsius(47) === null, "garbage temperature ignored");

// Context rules
check(keys(mk({ bp: "60/30", hr: "170" }, { isPediatric: true })) === "", "paediatric HR/BP not evaluated by adult limits");
check(keys(mk({ spo2: "80", gcs: "6" }, { isPediatric: true })) === "gcs,spo2", "paediatric SpO2 and GCS still evaluated");
check(keys(mk({ bp: "60/30" }, { status: "Discharged" })) === "", "discharged: no alert");
check(keys(mk({ bp: "60/30" }, { archivedAt: "2026-10-16" })) === "", "archived: no alert");
check(keys(mk({}, { vitalsHistory: [{ timestamp: "t", systolic: 70, hr: 30 }] })) === "hr,sbp", "falls back to latest vitals history when current empty");
check(keys(mk({ bp: "120/80", hr: "80" }, { vitalsHistory: [{ timestamp: "t", systolic: 70, hr: 30 }] })) === "", "current vitals take priority over history");
check(keys(mk({ bp: "abc", hr: "x" })) === "", "unparseable values ignored");
check(computeCriticalAlerts(null).length === 0, "null case safe");
if (failures) { console.error(failures + " failed"); process.exit(1); }
console.log("\nAll critical alert checks passed.");
