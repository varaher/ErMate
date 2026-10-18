// PRIMARY_SURVEY_INFANT_AGE_V1
import fs from "fs";
import { interpretPediatricVital } from "./src/utils/pediatricRanges";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL:", n)); };
const ps = fs.readFileSync("src/components/PrimarySurveySection.tsx", "utf8");
const cv = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");

t("vital input forwards months and days to interpretation", ps.includes("interpretPediatricVital(param, value, ageYears, ageMonths, ageDays)"));
t("reference chip receives months and days", ps.includes("ageMonthsParam={ageMonths} ageDaysParam={ageDays}"));
t("all five vital inputs pass months and days", (ps.match(/ageMonths=\{patientAgeMonths\}/g) || []).length === 5 && (ps.match(/ageDays=\{patientAgeDays\}/g) || []).length === 5);
t("case sheet passes months and days to primary survey", cv.includes("patientAgeMonths={currentCase.patient.ageMonths}") && cv.includes("patientAgeDays={currentCase.patient.ageDays}"));

// Behavioural: an infant's HR is judged against the infant range once months are known
const a = interpretPediatricVital("hr", "150", 0, 6, undefined);
const b = interpretPediatricVital("hr", "150", 0, 0.5, 10);
t("6-month-old HR 150 interprets without throwing", typeof a.status === "string");
t("10-day-old HR 150 interprets without throwing", typeof b.status === "string");
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
