// MARKER: ERMATE-AGE-DOSE-GUIDE-V1
import { readFileSync } from "fs";
import { formatAge, formatAgeLong } from "./src/utils/ageLabel";
import { findPediatricDrugs, suggestPediatricDoses, resolveDosingWeight, estimateWeightFromAge } from "./src/utils/drugDoseSuggestions";
import { PEDIATRIC_DRUGS } from "./src/data/pediatricDrugs";
import { formatCaseSheetText } from "./src/utils/caseSheetFormat";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n} ${extra}`); } };
const src = (p: string) => readFileSync(p, "utf8");

// age labels: 0 is a real age
check("age null/undefined -> N/A", formatAge(null) === "N/A" && formatAge(undefined) === "N/A");
check("age 0 is NOT N/A", formatAge(0) === "<1y" && formatAge(0, 6) === "6m" && formatAge(0, 0.5) === "<1m");
check("age 1 with months", formatAge(1, 3) === "1y 3m" && formatAge(1) === "1y");
check("adults", formatAge(45) === "45y" && formatAge(45, 6) === "45y");
check("long form", formatAgeLong(45) === "45 years" && formatAgeLong(0, 6) === "6 months" && formatAgeLong(null) === "Not documented" && formatAgeLong(0, 0.5) === "Under 1 month" && formatAgeLong(0) === "Under 1 year");

// weight
check("entered weight wins and is not 'estimated'", JSON.stringify(resolveDosingWeight("15", 3)) === JSON.stringify({ kg: 15, estimated: false }));
check("no weight -> age estimate flagged estimated", resolveDosingWeight("", 4)?.estimated === true && resolveDosingWeight("", 4)?.kg === 16);
check("no weight and no age -> null (no guessing)", resolveDosingWeight("", null) === null);
check("infant months estimate (APLS 0.5*m+4)", estimateWeightFromAge(0, 6) === 7 && estimateWeightFromAge(0, 0.5) === 3.5 && estimateWeightFromAge(0) === 7);
check("child estimates unchanged from existing formulas", estimateWeightFromAge(3) === 14 && estimateWeightFromAge(8) === 31 && estimateWeightFromAge(14) === 52);

// drug search
const names = (q: string) => findPediatricDrugs(q).map((d) => d.name);
check("'amoxiclav' finds the co-amoxiclav entry", names("amoxiclav").some((n) => /Co-Amoxiclav|Clavulan/i.test(n)), names("amoxiclav").join("|"));
check("'para' finds paracetamol first", /Paracetamol/i.test(names("para")[0] || ""));
check("alias pcm -> paracetamol", /Paracetamol/i.test(names("pcm")[0] || ""));
check("alias epinephrine -> adrenaline", names("epinephrine").some((n) => /Adrenaline/i.test(n)));
check("alias augmentin -> amoxicillin/clavulanate", names("augmentin").some((n) => /Clavulan|Amoxiclav/i.test(n)));
check("under 3 letters returns nothing", findPediatricDrugs("am").length === 0);
check("gibberish returns nothing", findPediatricDrugs("zzzqqq").length === 0);

// calculation
const par15 = suggestPediatricDoses("paracetamol", 15)[0];
check("paracetamol 15 kg = 225 mg (15 mg/kg)", !!par15 && /225/.test(par15.doseValue), par15?.doseValue);
const par30 = suggestPediatricDoses("paracetamol", 30)[0];
check("dose scales with weight", !!par30 && /450/.test(par30.doseValue), par30?.doseValue);
check("no suggestion without a valid weight", suggestPediatricDoses("paracetamol", null).length === 0 && suggestPediatricDoses("paracetamol", 0).length === 0 && suggestPediatricDoses("paracetamol", 500).length === 0);
check("every formulary drug calculates cleanly at 5, 15, 40 kg", PEDIATRIC_DRUGS.every((d) => [5, 15, 40].every((w) => { try { const r = d.calculateDose!(w); return !!r && !!r.doseValue && !/NaN|undefined/.test(JSON.stringify(r)); } catch { return false; } })));
check("suggestion carries source and max dose for verification", !!par15 && !!par15.source && (par15.maxDose === undefined || par15.maxDose.length > 0));

// output text
const txt = formatCaseSheetText({ caseId: "X", patient: { name: "T", age: 0, ageMonths: 6, sex: "Male", uhid: null, bed: null }, arrival: { date: null, time: null } } as any);
check("EMR text shows 6m, not 'Not documented'", /Age \/ Sex: 6m Male/.test(txt), txt.split("\n").find((l) => l.includes("Age")) || "");

// wiring
const cv = src("src/components/CaseSheetView.tsx");
check("age field: text/numeric input, empty -> null (not 0)", cv.includes('data-testid="cs-age"') && cv.includes("age: null, ageMonths: undefined") && !cv.includes("e.target.value ? parseInt(e.target.value) : 0"));
check("months selector for age 0/1", cv.includes('data-testid="cs-age-months"'));
check("gender select has a blank option so 'Male' can be chosen", cv.includes('<option value="">Select</option>'));
check("preview-apply uses the locked <=16 rule", !/patient\.age < 18/.test(cv) && cv.includes("recomputeIsPediatric(currentCase.patient.age)"));
check("header shows age via formatAge (age 0 safe)", cv.includes("formatAge(currentCase.patient.age, currentCase.patient.ageMonths, currentCase.patient.ageDays)") && !/patient\.age \|\| "N\/A"/.test(cv));
check("vitals reference gets months", cv.includes("ageMonthsParam={currentCase.patient.ageMonths}"));
check("dose guide sits above the manual form and only for paediatric cases", cv.indexOf("<DoseGuide") > -1 && cv.indexOf("<DoseGuide") < cv.indexOf("{/* Add Manual Form */}") && cv.includes("if (!currentCase.isPediatric || newDrug.trim().length < 3) return null;"));
check("'Use dose' only fills the form; nothing is logged automatically", cv.includes("setNewDose(sg.doseValue)") && !/onUse=\{[^}]*handleAddTreatment/.test(cv));
check("weight entered in the Weight section drives both the PALS card and the dose guide", cv.includes("palsWeight()") && cv.includes("currentCase.patient?.weight || currentCase.pediatricDetails?.weight") && !cv.includes('data-testid="cs-weight"'));
check("dirty check covers months", cv.includes("ageMonths: c.patient?.ageMonths"));
const pv = src("src/components/CaseSheetPrintView.tsx");
check("print keeps age 0", pv.includes("c.patient?.age !== null && c.patient?.age !== undefined") && pv.includes("formatAge(data.patient.age, data.patient.ageMonths, data.patient.ageDays)"));
check("discharge summary keeps age 0", src("src/components/DischargeSummaryView.tsx").includes("formatAgeLong(currentCase.patient.age, currentCase.patient.ageMonths)"));
check("days: newborn 14d is 3.5 kg", estimateWeightFromAge(0, 0.5, 14) === 3.5);
check("days: 100d is not treated as a newborn", (estimateWeightFromAge(0, 0.5, 100) ?? 0) > 5 && (estimateWeightFromAge(0, 0.5, 100) ?? 99) < 7);
check("days label", formatAge(0, 0.5, 14) === "14d" && formatAgeLong(0, 0.5, 14) === "14 days");
check("dose engine is local only", !/fetch\(|axios|\/api\//.test(src("src/utils/drugDoseSuggestions.ts")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
