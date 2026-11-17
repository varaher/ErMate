import { readFileSync } from "fs";
import { buildHeuristicDischargeSummary } from "./server/dischargeSummary";
import { resolveDocumentedPrimarySurvey, gcsLine, gcsPartsText } from "./src/utils/primarysurveyresolve";
import { formatDischargeSummaryText } from "./src/utils/dischargeSummaryFormat";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };

// ---- fallback parser: every vital needs its label and a believable value ----
const fb = (s: string) => buildHeuristicDischargeSummary(s).vitalsOnArrival;
const a = fb("45 year male, bed 12, on 40 mg pantoprazole. BP 130/80, HR 98, RR 22, SpO2 94%, GRBS 120, GCS 15");
t("RR read when labelled", a.rr === "22");
t("HR read when labelled", a.hr === "98");
t("BP read", a.bp === "130/80");
t("SpO2 read", a.spo2 === "94");
t("GRBS read", a.grbs === "120");
const b = fb("45 year male in bed 12 given 40 mg pantoprazole and 500 ml saline");
t("no label -> no RR", b.rr === null);
t("no label -> no HR", b.hr === null);
t("no label -> no SpO2", b.spo2 === null);
t("no label -> no GRBS", b.grbs === null);
t("no label -> no BP", b.bp === null);
t("age is not a vital", fb("45 year old male").rr === null && fb("45 year old male").hr === null);
t("absurd RR rejected", fb("RR 99").rr === null);
t("absurd HR rejected", fb("HR 5").hr === null);
t("respiratory rate wording", fb("respiratory rate 24").rr === "24");
t("pulse wording", fb("pulse 88").hr === "88");
t("BP is not read as HR", fb("BP 120/80").hr === null);

// ---- one reading of the primary survey for adults and children ----
const adult: any = {
  vitals: { rr: "22", spo2: "94", hr: "100", bp: "130/80", gcs: "15", gcs_e: "4", gcs_v: "5", gcs_m: "6", avpu: "Alert", grbs: "120", temp: "38.5 C" },
  primaryAssessment: { airway: "Patent", breathing: "Bilateral air entry", circulation: "CRT under 2 seconds", disability: "Pupils equal and reactive", exposure: "" },
};
const r = resolveDocumentedPrimarySurvey(adult);
t("adult airway", r.airway === "Patent");
t("adult breathing findings", r.breathingFindings === "Bilateral air entry");
t("adult circulation findings", r.circulationFindings === "CRT under 2 seconds");
t("adult pupils from dictated disability", r.pupils === "Equal and reactive");
t("alert and GCS together", r.avpuGcs === "Alert / GCS 15/15 (E4 V5 M6)");
t("grbs and temp keep dictated text", r.grbs === "120" && r.temp === "38.5 C");
t("rr spo2 hr bp", r.rr === "22" && r.spo2 === "94" && r.hr === "100" && r.bp === "130/80");

const partsOnly: any = { vitals: { gcs_e: "3", gcs_v: "4", gcs_m: "5" } };
t("parts only: no total made up", gcsLine(partsOnly.vitals) === "GCS E3 V4 M5 (total not documented)");
t("parts text", gcsPartsText(partsOnly.vitals) === "E3 V4 M5");
t("total only", gcsLine({ gcs: "12" }) === "GCS 12/15");
t("nothing -> empty, the screen says Not documented", gcsLine({}) === "");
t("nothing documented stays empty", Object.values(resolveDocumentedPrimarySurvey({ vitals: {}, primaryAssessment: {} })).every(v => v === ""));
t("literal 'Not documented' text is treated as empty", resolveDocumentedPrimarySurvey({ primaryAssessment: { airway: "Not documented" } } as any).airway === "");

const ped: any = { vitals: {}, primaryAssessment: {}, pediatricDetails: { breathingWob: "Mild retractions", breathingAirEntry: "Equal", circulationCrt: "<2s", disabilityPupils: "PERRL" } };
const rp = resolveDocumentedPrimarySurvey(ped);
t("paediatric fields still read", rp.breathingWork === "Mild retractions" && rp.breathingAirEntry === "Equal" && rp.circulationCrt === "<2s" && rp.pupils === "PERRL");
const surveyCase: any = { vitals: {}, primaryAssessment: { survey: { breathing: { workOfBreathing: "increased", airEntry: "reduced right" }, circulation: { crt: ">2sec" }, disability: { pupilsEqual: true, pupilReaction: "reactive" } } } };
const rs = resolveDocumentedPrimarySurvey(surveyCase);
t("nested survey read", rs.breathingWork === "increased" && rs.breathingAirEntry === "reduced right" && rs.circulationCrt === ">2sec" && rs.pupils === "Equal, reactive");

// ---- the finished summary carries the findings ----
const base: any = { patientName: "X", patientAge: "45", patientGender: "Male", allergies: "", arrivalHr: "100", arrivalBp: "130/80", arrivalRr: "22", arrivalSpo2: "94", arrivalGcs: "15", arrivalPainScore: "", arrivalGrbs: "120", arrivalTemp: "", primaryAirway: "Patent", primaryAirwayIntervention: "", primaryBreathing: "Bilateral air entry", primaryBreathingWork: "", primaryBreathingAirEntry: "", primaryBreathingCct: "", primaryBreathingSubcut: "", primaryBreathingEfast: "", primaryBreathingIntervention: "", primaryCirculation: "CRT under 2 seconds", primaryCirculationCrt: "", primaryCirculationDnv: "", primaryCirculationPct: "", primaryCirculationDeformity: "", primaryCirculationFast: "", primaryCirculationInterventions: "", primaryDisabilityAvpuGcs: "Alert / GCS 15/15", primaryDisabilityPupils: "Equal", primaryDisabilityGrbs: "120", primaryExposureTemp: "", primaryExposureTrauma: "" };
let txt = ""; try { txt = formatDischargeSummaryText({ ...base } as any); } catch (e) { txt = "ERR " + e; }
t("summary prints RR", txt.includes("RR-22"));
t("summary prints breathing findings", txt.includes("Findings- Bilateral air entry"));
t("summary prints circulation findings", txt.includes("Findings- CRT under 2 seconds"));
t("summary prints GCS", txt.includes("GCS-15"));
let txt2 = ""; try { txt2 = formatDischargeSummaryText({ ...base, primaryBreathing: "", primaryCirculation: "" } as any); } catch (e) { txt2 = "ERR " + e; }
t("no findings -> no empty Findings label", !txt2.includes("Findings-"));

// ---- wiring ----
const view = readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
t("view uses the shared reader", view.includes("resolveDocumentedPrimarySurvey(currentCase)"));
t("view no longer reads only paediatric breathing", !view.includes("currentCase.pediatricDetails?.breathingWob || \"\""));
t("view keeps the doctor's saved edits first", view.includes("currentCase.dischargeInfo?.primaryBreathingWork || documentedPs.breathingWork"));
t("firestore.rules untouched", !readFileSync("firestore.rules", "utf8").includes("primaryCirculation"));
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");