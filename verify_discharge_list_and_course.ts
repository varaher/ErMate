/**
 * 25 Nov 2026 (Neeraj): "once prepared, where will it get saved ... display it like case list and wait for
 * 24 hrs" and "course in hospital ... the whole case sheet gets displayed".
 *  1. Course in Hospital never quotes a pasted case sheet; vitals carry one unit each.
 *  2. Every prepared / saved discharge summary is listed for 24 hours (Dashboard + Cases), newest first.
 *  3. Saving a quick-discharge summary always reaches the case; the save message says where to find it.
 */
import fs from "node:fs";
import { deriveInitialCourseInHospital, isSourceRecordText, courseHasSourceDump, formatTemperature } from "./src/utils/dischargeSyncEngine";
import { recentDischargeSummaries, DISCHARGE_LIST_WINDOW_MS } from "./src/utils/dischargeList";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

// ---- 1. Course in Hospital (the case from the screenshots)
const PASTED = `External clinical record — source for review:
25-11-2026 08:15 AM / Dr. A (Emergency) (Dr. B)
INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD

Case seen By Dr. C at 8:14am on 25/11/2026

Presenting Complaint:

Complaint of swelling over the left gluteal region with pain since 2 days.

Primary Assessment:

Airway: Patent.
History of Present Illness:
The patient presented ...
Allergies: No known allergies.
General Examination:
No pallor.`;
const gluteal: any = {
  id: "q1", quickDischargeAt: new Date().toISOString(),
  patient: { name: "Unassigned Patient", age: null, gender: "Other", uhid: "26112551", presentingComplaint: "Complaint of swelling over the left gluteal region with pain since 2 days" },
  vitals: { bp: "110/80", hr: "76", spo2: "98%", temp: "98.6°F", rr: "18", gcs: "15" },
  progressNotes: PASTED,
};
const course = deriveInitialCourseInHospital(gluteal);
t("course does not quote the pasted sheet", !/External clinical record|CASE RECORD|Presenting Complaint:|Case seen By|On reassessment/i.test(course));
t("course opens with the presentation, not the vitals list", /presented to the Emergency Department with the above-mentioned complaints/.test(course) && !/110\/80/.test(course));
t("no doubled units (98%% / 98.6°F°C)", !/%%|°F°C|°C°C|mmHg mmHg/.test(course));
t("normal vitals summarised as hemodynamically stable", /hemodynamically stable/.test(course));
t("normal temperature in °F is not called fever or printed", !/temperature 98\.6/.test(course));
const febrile = deriveInitialCourseInHospital({ ...gluteal, progressNotes: "", vitals: { temp: "101" } });
t("101 read as °F and reported", /fever of 101°F/.test(febrile));
t("38.5 read as °C and reported", /fever of 38\.5°C/.test(deriveInitialCourseInHospital({ ...gluteal, progressNotes: "", vitals: { temp: "38.5" } })));
t("37.0 °C not reported", !/temperature/.test(deriveInitialCourseInHospital({ ...gluteal, progressNotes: "", vitals: { temp: "37.0" } })));
const real = deriveInitialCourseInHospital({ ...gluteal, progressNotes: "Pain reduced after analgesia, tolerating orally" });
t("a real reassessment note is still used", /On reassessment, Pain reduced after analgesia, tolerating orally\./.test(real));
t("a pasted sheet without the marker is recognised (3+ case-sheet headings)", isSourceRecordText("Presenting Complaint: x\nPrimary Assessment: y\nAllergies: nil\nGeneral Examination: ok"));
t("a short note is not mistaken for a sheet", !isSourceRecordText("Reviewed, vitals stable, plan discharge"));
t("old saved course with the dump is detected (rebuilt on open)", courseHasSourceDump("On reassessment, External clinical record — source for review:\n...") && !courseHasSourceDump(course));
t("temperature helper", formatTemperature("98.6 F")?.text === "98.6°F" && formatTemperature("37.8")?.text === "37.8°C" && formatTemperature("Not recorded") === null);
const ds = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
t("discharge screen rebuilds a saved course that quoted the sheet", /_savedCourse && !courseHasSourceDump\(_savedCourse\)/.test(ds));

// ---- 2. 24-hour list
const now = new Date("2026-11-25T10:30:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const list = recentDischargeSummaries([
  { ...gluteal, id: "a", quickDischargeAt: ago(2) },
  { id: "b", patient: { name: "Ravi K", age: 54, gender: "Male", uhid: "U9", presentingComplaint: "Chest pain" }, dischargeInfo: { summaryStatus: "FINALIZED", primaryDiagnosis: "Musculoskeletal chest pain", preparedAt: ago(5), savedAt: ago(1) } },
  { id: "c", patient: { name: "Old", presentingComplaint: "x" }, dischargeInfo: { summaryStatus: "PREPARED", preparedAt: ago(30), savedAt: ago(25) } },
  { id: "d", patient: { name: "No summary", presentingComplaint: "x" } },
  { id: "e", patient: { name: "Draft one", presentingComplaint: "Fever" }, dischargeInfo: { summaryStatus: "MANUALLY_EDITED", preparedAt: ago(3) } },
] as any, now);
t("lists only summaries from the last 24 h", list.map((x) => x.id).join(",") === "b,a,e");
t("newest first (by last save)", list[0].id === "b");
t("statuses: Finalised / Not saved / Draft", list[0].status === "Finalised" && list[1].status === "Not saved" && list[2].status === "Draft");
t("placeholder name shown plainly, with UHID", list[1].name === "Patient (name not recorded)" && /UHID 26112551/.test(list[1].sub));
t("diagnosis shown (or complaint when no diagnosis)", list[0].diagnosis === "Musculoskeletal chest pain" && /left gluteal/.test(list[1].diagnosis));
t("hours left counts down from the last save", list[0].hoursLeft === 23 && list[1].hoursLeft === 22);
t("drops off exactly after 24 h", recentDischargeSummaries([{ id: "z", patient: { name: "Z" }, dischargeInfo: { summaryStatus: "PREPARED", savedAt: new Date(now.getTime() - DISCHARGE_LIST_WINDOW_MS).toISOString() } }] as any, now).length === 0);

// ---- 3. Wiring
const dash = fs.readFileSync("src/components/DashboardView.tsx", "utf8");
const cl = fs.readFileSync("src/components/CasesListView.tsx", "utf8");
const qd = fs.readFileSync("src/components/QuickDischargeIntake.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const tours = fs.readFileSync("src/lib/coachTours.ts", "utf8");
t("Dashboard shows the list (visible, not inside the collapsed paste row)", /<DischargeSummariesPanel cases=\{cases \|\| \[\]\} onOpen=\{\(id\) => onNavigateToDischarge\(id\)\}/.test(dash) && !/recentDischarges/.test(dash));
t("Cases shows the list at the top", /<DischargeSummariesPanel cases=\{cases\} onOpen=\{\(id\) => onNavigateToDischarge\(id\)\}/.test(cl));
t("quick-discharge cases are marked so they list before the first save", /quickDischargeAt: now,/.test(qd));
t("each save stamps savedAt", /savedAt: nowIso,/.test(ds));
t("save message says where to find it (and no false 'finalized' on a draft)", /Find it under <strong>Discharge summaries<\/strong>/.test(ds) && !/permanently finalized and archived/.test(ds));
t("save falls back to the quick-discharge case and warns when the case is missing", /\|\| \(quickDischargeCase\?\.id === showDischargeSummaryId \? quickDischargeCase : null\);/.test(app) && /could not be saved: its case was not found/.test(app));
t("walkthrough tip for the list", /feature: "discharge-list"/.test(tours) && /data-coach="discharge-list"|dataCoach="discharge-list"/.test(dash));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);