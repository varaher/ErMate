import { mapExtractionToCaseSheetFields } from "./server/scribeChatTurn";
import { editableFields, isChildCapture } from "./src/lib/extractionedits";
import { resolveDocumentedPrimarySurvey } from "./src/utils/primarysurveyresolve";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const run = (text: string, raw: any) => mapExtractionToCaseSheetFields({} as any, raw, {}, text) as any;

// children: same capture rules as adults
const dict = "6 year old boy, weight 20 kg, RR 32, SpO2 96, GCS fourteen, airway patent, retractions present, CRT 3 seconds";
const r = run(dict, {
  age: 6, isPediatric: true, weight: "20",
  vitals: { rr: "32", spo2: "96", gcs: "14" },
  airway: "patent",
  pediatricDetails: { airwayStatus: "Patent", breathingWob: "Retractions present", circulationCrt: "3 seconds" },
});
t("child RR kept", r.vitals?.rr === "32");
t("child spoken GCS kept", r.vitals?.gcs === "14");
t("child weight kept", r.pediatricDetails?.weight === "20" && r.pediatricDetails?.patientWeight === "20");
t("child work of breathing kept and aliased", r.pediatricDetails?.breathingWob === "Retractions present" && r.pediatricDetails?.patWorkOfBreathing === "Retractions present");
t("child CRT kept", r.pediatricDetails?.circulationCrt === "3 seconds");
t("child airway kept", r.airway === "patent");
t("child GCS never invented", run("6 year old, RR 32", { vitals: { rr: "32", gcs: "15" } }).vitals?.gcs === undefined);
t("child E V M parts sum", run("E3 V4 M5", { vitals: { gcs_e: "3", gcs_v: "4", gcs_m: "5" } }).vitals?.gcs === "12");

// who counts as a child
t("age 16 is a child", isChildCapture({ age: 16 }));
t("age 17 is not", !isChildCapture({ age: 17 }));
t("age as text", isChildCapture({ age: "6 years" }));
t("flag counts", isChildCapture({ isPediatric: true }));
t("case age used when dictation has none", isChildCapture({}, 9) && !isChildCapture({}, 40));
t("unknown age is not a child", !isChildCapture({}));

// editor offers the child fields only for children
const adultPaths = editableFields({ vitals: { rr: "20" } }).map(f => f.path);
const childPaths = editableFields({ vitals: { rr: "32" } }, { pediatric: true }).map(f => f.path);
t("adult editor has no child fields", !adultPaths.some(p => p.startsWith("pediatricDetails.")));
t("child editor offers weight and CRT", childPaths.includes("pediatricDetails.weight") && childPaths.includes("pediatricDetails.circulationCrt") && childPaths.includes("pediatricDetails.disabilityAvpuGcs"));
t("child editor still offers vitals and ABCDE", childPaths.includes("vitals.hr") && childPaths.includes("airway") && childPaths.includes("vitals.gcs"));
t("captured child values show with their text", editableFields({ pediatricDetails: { breathingWob: "Retractions" } }, { pediatric: true }).find(f => f.path === "pediatricDetails.breathingWob")?.value === "Retractions");
t("no duplicate rows for a child", new Set(childPaths).size === childPaths.length);

// discharge reads the child's fields too
const rs = resolveDocumentedPrimarySurvey({ vitals: { rr: "32", gcs: "14" }, primaryAssessment: {}, pediatricDetails: { airwayStatus: "Patent", breathingWob: "Retractions", circulationSkinColorTemp: "Pale, cool", circulationCrt: "3 seconds", disabilityPupils: "PERRL", disabilityAvpuGcs: "Alert" } });
t("child airway reaches discharge", rs.airway === "Patent");
t("child breathing reaches discharge", rs.breathingWork === "Retractions");
t("child circulation reaches discharge", rs.circulationFindings === "Pale, cool" && rs.circulationCrt === "3 seconds");
t("child pupils reach discharge", rs.pupils === "PERRL");
t("child GCS shown with RR", rs.gcsTotal === "14" && rs.rr === "32");
t("adult findings win over child fallback", resolveDocumentedPrimarySurvey({ primaryAssessment: { airway: "Obstructed" }, pediatricDetails: { airwayStatus: "Patent" } }).airway === "Obstructed");
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");