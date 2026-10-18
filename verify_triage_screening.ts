// MARKER: ERMATE-TRIAGE-SCREENING-V1
import { readFileSync } from "fs";
import { classifyEmergencyTriage } from "./src/utils/triageClassifier";
import { getPediatricAgeBand } from "./src/utils/pediatricRanges";
import { normalizeScreening, screeningLines, isolationBanner, needsEpidemiologicalHistory, suggestsIsolation } from "./src/utils/triageScreening";
import { TRIAGE_LEVELS } from "./src/utils/triageScale";
import { formatCaseSheetText } from "./src/utils/caseSheetFormat";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n} ${extra}`); } };
const V = (o: Partial<Record<string, string>> = {}) => ({ bp: "", hr: "", spo2: "", rr: "", temp: "", gcs: "", gcs_e: "", gcs_v: "", gcs_m: "", grbs: "", avpu: "", painScore: "", ...o }) as any;
const src = (p: string) => readFileSync(p, "utf8");

// scale
check("P5 target is 120 min (department form)", TRIAGE_LEVELS[5].minutes === 120 && TRIAGE_LEVELS[5].label.includes("120"));

// screening util
check("empty screening normalizes to undefined", normalizeScreening({}) === undefined && normalizeScreening(undefined) === undefined);
check("blank strings dropped", normalizeScreening({ triagedByName: "  ", orientation: "Oriented" })?.triagedByName === undefined);
check("false is kept (assessed 'No')", normalizeScreening({ communicableScreenPositive: false })?.communicableScreenPositive === false);
check("null (not assessed) is dropped, not turned into No", normalizeScreening({ communicableScreenPositive: null, orientation: "Oriented" }) !== undefined && !("communicableScreenPositive" in (normalizeScreening({ communicableScreenPositive: null, orientation: "Oriented" }) as object)));
check("isolation types dropped when isolation not required", normalizeScreening({ isolationRequired: false, isolationTypes: ["Airborne"] })?.isolationTypes === undefined);
check("travel details dropped when travel not positive", normalizeScreening({ travelEndemicArea3Weeks: false, travelDetails: "Kerala" })?.travelDetails === undefined);
check("known-disease name dropped when not known", normalizeScreening({ knownCommunicableDisease: false, knownCommunicableDiseaseName: "TB" })?.knownCommunicableDiseaseName === undefined);
check("epidemiological questions only when screen positive or known disease", !needsEpidemiologicalHistory({}) && !needsEpidemiologicalHistory({ communicableScreenPositive: false }) && needsEpidemiologicalHistory({ communicableScreenPositive: true }) && needsEpidemiologicalHistory({ knownCommunicableDisease: true }));
check("isolation suggested (never auto-set) on positive screen", suggestsIsolation({ communicableScreenPositive: true }) && !suggestsIsolation({ travelEndemicArea3Weeks: true }) && normalizeScreening({ communicableScreenPositive: true })?.isolationRequired === undefined);
check("lines list only assessed items", screeningLines({ orientation: "Oriented" }).length === 1 && screeningLines({}).length === 0 && screeningLines(null).length === 0);
const full = normalizeScreening({ levelOfConsciousness: "Alert", communicableScreenPositive: true, travelEndemicArea3Weeks: true, travelDetails: "Wayanad, 2 weeks ago", isolationRequired: true, isolationTypes: ["Droplet", "Contact"], triagedByName: "A. Nurse", triagedByEmpId: "123" });
const lines = screeningLines(full).join("\n");
check("travel history and isolation appear in lines", lines.includes("Travel to endemic area (last 3 weeks): Yes") && lines.includes("Wayanad") && lines.includes("Isolation type: Droplet, Contact") && lines.includes("Emp ID 123"));
check("isolation banner", isolationBanner(full) === "Isolation required — Droplet / Contact precautions" && isolationBanner({ isolationRequired: false }) === null);

// paediatric ranges via age bands
const b2 = getPediatricAgeBand(2); const b8 = getPediatricAgeBand(8);
check("age 2 and age 8 give different bands", !!b2 && !!b8 && b2!.label !== b8!.label);
check("infant age 0 without months gives no band (asks for months)", getPediatricAgeBand(0) === null && getPediatricAgeBand(0, 6) !== null);
check("no band for adult", getPediatricAgeBand(40) === null);
// age-in-months used by classifier: HR 150 normal at 3 months, high at 8y
check("HR 150 not escalated at 3 months", classifyEmergencyTriage(0, "fever", V({ hr: "150" }), 3).level >= 3);
check("HR 150 escalated at 8 years", classifyEmergencyTriage(8, "fever", V({ hr: "150" })).level <= 3);
check("classifier signature stays backwards compatible", classifyEmergencyTriage(30, "fever", V()).level >= 1);

// formatted output
const text = formatCaseSheetText({
  caseId: "X", patient: { name: "T", age: 5, sex: "Male", uhid: null, bed: null }, arrival: { date: null, time: null },
  triageScreening: full, triageCategory: "P3 · Urgent",
} as any);
check("EMR text has screening section with banner", text.includes("TRIAGE ASSESSMENT & INFECTION SCREENING") && text.includes("ISOLATION REQUIRED"));
const textNone = formatCaseSheetText({ caseId: "X", patient: { name: "T", age: 5, sex: "Male", uhid: null, bed: null }, arrival: { date: null, time: null } } as any);
check("EMR text omits section when nothing recorded", !textNone.includes("INFECTION SCREENING"));

// source wiring
const tf = src("src/components/TriageForm.tsx");
check("TriageForm shows paediatric card and screening in both modes", tf.includes("<PediatricNormalVitalsCard") && tf.includes("<TriageScreeningFields") && !/initialMode === "full" && \(\s*<TriageScreeningFields/.test(tf));
check("submit persists screening + ageMonths", tf.includes("triageScreening: ts") && tf.includes("ageMonths: ageMonthsNum"));
check("auto completion time only is not saved as an assessment", tf.includes('k !== "completedAt"'));
const cv = src("src/components/CaseSheetView.tsx");
check("dirty check covers screening and level", cv.includes("triageScreening: normalizeScreening") && cv.includes("triageLevel: c.patient?.triageLevel"));
check("case sheet isolation banner", cv.includes('data-testid="isolation-banner"'));
const pv = src("src/components/CaseSheetPrintView.tsx");
check("print view renders screening", pv.includes("Triage Assessment & Infection Screening") && pv.includes("triageScreening: c.patient?.triageScreening"));
const card = src("src/components/PediatricNormalVitalsCard.tsx");
check("card shows temperature in °F and is reference-only", card.includes("°F") && card.includes("reference only"));
// no hospital identity or form number anywhere in new/changed source
const all = [tf, cv, pv, card, src("src/components/TriageScreeningFields.tsx"), src("src/utils/triageScreening.ts"), src("src/utils/triageScale.ts"), src("src/utils/triageClassifier.ts")].join("\n");
check("no source-form number in source", !/\/FO\/ER\/|Rev 0\d/.test(all));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
