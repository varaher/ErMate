// PEDS_FORMULARY_FIXES_V1
import { PEDIATRIC_DRUGS } from "./src/data/pediatricDrugs";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL:", n)); };
const get = (id: string) => PEDIATRIC_DRUGS.find((d) => d.id === id)!;
const dose = (id: string, w: number) => get(id).calculateDose!(w);

// Unique ids (duplicate React keys previously made two cards expand together)
const ids = PEDIATRIC_DRUGS.map((d) => d.id);
t("all drug ids are unique", new Set(ids).size === ids.length);
t("127 drugs still present", PEDIATRIC_DRUGS.length === 127);

// Adrenaline single-dose caps
t("adrenaline IM 10 kg unchanged (0.10 mL)", dose("adrenaline", 10).doseValue.includes("Anaph IM: 0.10 mL"));
t("adrenaline IM 60 kg capped at 0.50 mL", dose("adrenaline", 60).doseValue.includes("Anaph IM: 0.50 mL"));
t("adrenaline CPR IV 120 kg capped at 10 mL", dose("adrenaline", 120).doseValue.includes("CPR IV: 10.0 mL"));
t("adrenaline CPR IV 10 kg unchanged (1.0 mL)", dose("adrenaline", 10).doseValue.includes("CPR IV: 1.0 mL"));

// Heparin in units, numbers unchanged
const h = dose("heparin", 10);
t("heparin 10 kg numbers unchanged", h.doseValue.includes("IV: 500-1000") && h.doseValue.includes("SC: 250-500"));
t("heparin labelled in units not mcg", /units/.test(h.doseValue) && !/mcg/.test(h.doseValue) && !/mcg/.test(get("heparin").standardDose));

// Terbutaline neb is a fixed dose
t("terbutaline neb not per kg", !/2\.5-5 mg\/kg/.test(get("terbutaline").standardDose));

// Benzathine by weight
t("benzathine 20 kg = 0.6 MU", dose("penicillin-g-benzathine", 20).doseValue.startsWith("0.6"));
t("benzathine 26.9 kg = 0.6 MU", dose("penicillin-g-benzathine", 26.9).doseValue.startsWith("0.6"));
t("benzathine 27 kg = 1.2 MU", dose("penicillin-g-benzathine", 27).doseValue.startsWith("1.2"));
t("benzathine shows one band only", !/<6 yrs/.test(dose("penicillin-g-benzathine", 20).doseValue));

// Co-amoxiclav own max (2000 mg/day amoxicillin component)
t("co-amoxiclav 10 kg unchanged (225 mg BD)", dose("co-amoxiclav", 10).doseValue.startsWith("225.0"));
t("co-amoxiclav 60 kg capped at 1000 mg BD", dose("co-amoxiclav", 60).doseValue.startsWith("1000.0"));

// Acyclovir varicella oral cap 800 mg per dose
t("acyclovir varicella 10 kg unchanged (200 mg)", dose("acyclovir-varicella", 10).doseValue.includes("200 mg"));
t("acyclovir varicella 60 kg capped at 800 mg", dose("acyclovir-varicella", 60).doseValue.includes("800 mg"));

// No hospital literal in the changed data
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
