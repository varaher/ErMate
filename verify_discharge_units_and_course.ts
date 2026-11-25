/**
 * 25 Nov 2026 (Neeraj): "in the vitals mmHg, /min etc are not coming — make it a rule that all vitals should
 * be followed by respective things" and "the course in hospital is still a mismatch".
 */
import fs from "node:fs";
import { withVitalUnit } from "./src/utils/vitalUnits";
import { vitalLines, formatDischargeSummaryHtml } from "./src/utils/dischargeSummaryFormat";
import { deriveInitialCourseInHospital, endCourseWithOutcome, courseLooksOldFormat } from "./src/utils/dischargeSyncEngine";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const eq = (n: string, a: string, b: string) => t(`${n}: "${a}"`, a === b);

// ---- Units rule
eq("HR", withVitalUnit("hr", "84"), "84/min");
eq("HR with bpm kept", withVitalUnit("hr", "84 bpm"), "84 bpm");
eq("RR", withVitalUnit("rr", "18"), "18/min");
eq("BP", withVitalUnit("bp", "130/80"), "130/80 mmHg");
eq("BP already with unit", withVitalUnit("bp", "130/80 mmHg"), "130/80 mmHg");
eq("SpO2", withVitalUnit("spo2", "98"), "98%");
eq("SpO2 with context", withVitalUnit("spo2", "98 on room air"), "98% on room air");
eq("SpO2 already %", withVitalUnit("spo2", "98% on RA"), "98% on RA");
eq("GRBS", withVitalUnit("grbs", "141"), "141 mg/dL");
eq("GCS number", withVitalUnit("gcs", "15"), "15/15");
eq("GCS E V M untouched", withVitalUnit("gcs", "E4V5M6"), "E4V5M6");
eq("Pain", withVitalUnit("pain", "4"), "4/10");
eq("Temp °F inferred", withVitalUnit("temp", "97.8"), "97.8°F");
eq("Temp °C inferred", withVitalUnit("temp", "37.2"), "37.2°C");
eq("Temp '98.6 F'", withVitalUnit("temp", "98.6 F"), "98.6°F");
eq("Temp words untouched", withVitalUnit("temp", "Afebrile"), "Afebrile");
eq("Not documented untouched", withVitalUnit("hr", "Not documented"), "Not documented");

const d: any = { arrivalHr: "84", arrivalBp: "130/80", arrivalRr: "18", arrivalSpo2: "98", arrivalGcs: "15", arrivalPainScore: "", arrivalGrbs: "141", arrivalTemp: "97.8" };
t("summary vitals all carry units", vitalLines(d, "arrival").join(" | ") === "HR- 84/min | BP- 130/80 mmHg | RR- 18/min | SpO2- 98% | GCS- 15/15 | Pain Score- Not documented | GRBS- 141 mg/dL | Temp- 97.8°F");
const html = formatDischargeSummaryHtml({ ...d, patientName: "A", patientAge: 30, patientGender: "Male", uhid: "", dispositionStatus: "", primaryDisabilityGrbs: "141", primaryExposureTemp: "97.8", dischargeDateTime: "" } as any);
t("EMR copy: GRBS and temperature in the primary survey carry units", /GRBS- 141 mg\/dL/.test(html) && /Temp- 97\.8°F/.test(html));

const ds = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
const dvCount = (ds.match(/<DV k="(arrival|discharge)(Hr|Bp|Rr|Spo2|Gcs|PainScore|Grbs|Temp)"/g) || []).length;
t("sheet: all 16 arrival / discharge vitals shown with units", dvCount === 16 && !/<DF k="(arrival|discharge)(Hr|Bp|Rr|Spo2|Gcs|PainScore|Grbs|Temp)"/.test(ds));
t("sheet: primary-survey GRBS and temperature shown with units", /<DV k="primaryDisabilityGrbs" v=\{primaryDisabilityGrbs\} kind="grbs" \/>/.test(ds) && /<DV k="primaryExposureTemp" v=\{primaryExposureTemp\} kind="temp" \/>/.test(ds));

// ---- Course consistency
const old = "The patient was evaluated in the Emergency Department with Vomiting. Initial assessment revealed blood pressure 130/80 mmHg, pulse was 84/min. The patient was treated with Ondansetron 4 mg iv as documented.";
t("old wording detected", courseLooksOldFormat(old));
const lama: any = { id: "x", patient: { age: 40, presentingComplaint: "Head injury" }, vitals: { bp: "130/80", hr: "84", spo2: "98" }, dischargeInfo: { dispositionStatus: "Discharge Against Medical Advice", dischargeCondition: "STABLE", outcome: { counselledRelation: "Wife", counselledPerson: "Asha", risksExplained: "Yes", lamaFormSignedAt: "4 PM", witness: "SN Bindu" } } };
t("current builder output is not flagged as old", !courseLooksOldFormat(deriveInitialCourseInHospital(lama)));
const ai = "The patient presented to the Emergency Department with the above-mentioned complaints. CT brain was normal.\n\nHence, the patient was discharged with advice.";
const ended = endCourseWithOutcome(ai, lama);
t("AI course keeps its story but ends with the LAMA paragraph", /CT brain was normal\./.test(ended) && !/discharged with advice/.test(ended) && /The wife \(Asha\) was counselled/.test(ended) && /Hence, the patient was discharged against medical advice in a clinically stable condition\.$/.test(ended));
const oneP = endCourseWithOutcome("The patient presented with chest pain. ECG was normal. The patient was discharged home.", lama);
t("single-paragraph AI course: its outcome sentence is replaced", /ECG was normal\.\n\n/.test(oneP) && !/discharged home/.test(oneP));
t("old unedited course rebuilt on open; finalised / hand-edited kept", /const _rebuildOld = Boolean\(_savedCourse\) && courseLooksOldFormat\(_savedCourse\) && _savedStatus !== "FINALIZED" && _savedStatus !== "MANUALLY_EDITED";/.test(ds));
t("Rebuild course button with Undo", /id="discharge-rebuild-course"/.test(ds) && /setCourseBeforeRebuild\(courseInHospital\)/.test(ds) && />Undo<\/button>/.test(ds));
t("AI draft ends with ErMate's outcome paragraph", /endCourseWithOutcome\(_safeCourseInHospital\(resData\.data\.courseInHospital\), liveCase\)/.test(ds));
t("AI prompt follows the house style", /HOUSE STYLE \(ErMate, 25 Nov 2026\)/.test(fs.readFileSync("server/dischargeSummary.ts", "utf8")));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);