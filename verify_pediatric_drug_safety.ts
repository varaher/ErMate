// PEDIATRIC_DRUG_SAFETY_NOTICES_V1
import { PEDIATRIC_DRUGS } from "./src/data/pediatricDrugs";
import { getDrugSafetyNotices, ADULT_CEILING_WEIGHT_KG } from "./src/data/pediatricDrugSafety";
import fs from "fs";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL:", name)); };
const by = (re: RegExp) => PEDIATRIC_DRUGS.filter((d) => re.test(`${d.name} ${d.genericName || ""}`.toLowerCase()));
const has = (re: RegExp, sev?: string) => by(re).length > 0 && by(re).every((d) => getDrugSafetyNotices(d, null).some((n) => !sev || n.severity === sev));

t("nimesulide danger", has(/nimesulide/, "danger"));
t("codeine danger", has(/codeine/, "danger"));
t("aspirin danger", has(/aspirin/, "danger"));
t("promethazine danger", has(/promethazine/, "danger"));
t("heparin danger", has(/heparin/, "danger"));
t("digoxin danger", has(/digoxin/, "danger"));
t("co-trimoxazole warn", has(/co-?trimoxazole/));
t("metoclopramide warn", has(/metoclopramide/));
t("nifedipine warn", has(/nifedipine/));
t("benzathine warn", has(/benzathine/));
t("diazepam warn", has(/diazepam/));
t("terbutaline warn", has(/terbutaline/));

const para = by(/^paracetamol/)[0];
t("paracetamol: no notice without weight", getDrugSafetyNotices(para, null).length === 0);
t("paracetamol: no notice at 39 kg", getDrugSafetyNotices(para, ADULT_CEILING_WEIGHT_KG - 1).length === 0);
t("paracetamol: ceiling notice at 40 kg", getDrugSafetyNotices(para, ADULT_CEILING_WEIGHT_KG).length === 1);
t("ceiling is 40 kg", ADULT_CEILING_WEIGHT_KG === 40);

// Notices must never alter computed doses
const before = PEDIATRIC_DRUGS.map((d) => d.calculateDose?.("12")?.doseValue ?? "");
getDrugSafetyNotices(para, 60);
const after = PEDIATRIC_DRUGS.map((d) => d.calculateDose?.("12")?.doseValue ?? "");
t("doses unchanged by notices", JSON.stringify(before) === JSON.stringify(after));

const src = fs.readFileSync("src/components/PediatricDrugCalculatorView.tsx", "utf8");
t("card renders notices", src.includes("drug-safety-notices") && src.includes("getDrugSafetyNotices"));
t("weight hint hides once a valid weight is entered", src.includes("weight-ok") && src.includes("weight-hint") && src.includes("isWeightValid ? ("));
const mod = fs.readFileSync("src/data/pediatricDrugSafety.ts", "utf8").replace(/\/\/.*$/gm, "");

console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
