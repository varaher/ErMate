// MARKER: ERMATE-DRUG-DILUTIONS-V1 (26 Nov 2026)
import { readFileSync } from "fs";
import {
  DRUG_DILUTIONS, DILUTION_CATEGORIES, DILUTIONS_DISCLAIMER, PAEDIATRIC_AGE_CUTOFF,
  concentration, concentrationLabel, pumpRate, formatRate, bolusFor, bolusLabel, outsideRange,
  groupForAge, searchDrugs, copyText, regimenFor, Infusion,
} from "./src/data/drugDilutions";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const near = (a: number | null, b: number, tol = 0.01) => a != null && Math.abs(a - b) <= tol;
const byId = (id: string) => DRUG_DILUTIONS.find(d => d.id === id)!;

// ---- data integrity ----
const ids = DRUG_DILUTIONS.map(d => d.id);
t("ids unique", new Set(ids).size === ids.length);
t("17 drugs", DRUG_DILUTIONS.length === 17);
for (const d of DRUG_DILUTIONS) {
  t(`${d.id} category known`, DILUTION_CATEGORIES.includes(d.cat));
  t(`${d.id} has ampoule`, d.ampoule.length > 0);
  for (const [g, r] of [["adult", d.a], ["paed", d.p]] as const) {
    if (!r) continue;
    t(`${d.id}/${g} has a source`, r.source.trim().length > 3);
    t(`${d.id}/${g} has bolus or infusion`, !!r.inf || r.bolus.length > 0);
    if (r.inf) {
      const i = r.inf;
      t(`${d.id}/${g} range lo<=hi`, i.lo <= i.hi);
      t(`${d.id}/${g} start in range`, !outsideRange(i, i.start));
      t(`${d.id}/${g} positive amt/vol/steps`, i.amt > 0 && i.vol > 0 && i.amtStep > 0 && i.doseStep > 0);
      t(`${d.id}/${g} default rate is a number`, pumpRate(i, i.start, 60) != null);
    }
    for (const b of r.bolus) if (b.perKg) {
      t(`${d.id}/${g}/${b.label} weight bolus has max`, (b.max ?? 0) > 0 && !!b.bu);
      t(`${d.id}/${g}/${b.label} weight bolus has strength`, (b.perMl ?? 0) > 0);
    }
  }
}
// every paediatric weight bolus capped at or below the adult maximum where the adult gives one
for (const d of DRUG_DILUTIONS) if (d.p) for (const b of d.p.bolus) if (b.perKg) {
  const adult = d.a.bolus.find(x => x.label === b.label && x.max);
  if (adult) t(`${d.id} paed max ≤ adult max (${b.label})`, b.max! <= adult.max!);
}
t("adult-only drugs marked, not guessed", byId("vasopressin").p === null && byId("ntg").p === null);
t("disclaimer says reference only", /^Reference only\./.test(DILUTIONS_DISCLAIMER) && DILUTIONS_DISCLAIMER.includes("hospital protocol"));
t("paediatric cutoff is 16", PAEDIATRIC_AGE_CUTOFF === 16 && groupForAge(15.9) === "paed" && groupForAge(16) === "adult" && groupForAge(null) === null);

// ---- arithmetic ----
const nor = byId("noradrenaline").a.inf!;
t("nor 4 mg/50 ml = 80 mcg/ml", concentration(nor) === 80 && concentrationLabel(nor) === "80 mcg/ml");
t("nor 0.1 mcg/kg/min at 60 kg = 4.5 ml/h", near(pumpRate(nor, 0.1, 60), 4.5));
t("nor with 8 mg in syringe halves the rate", near(pumpRate(nor, 0.1, 60, 8), 2.25) && concentrationLabel(nor, 8) === "160 mcg/ml");
const dop = byId("dopamine").a.inf!;
t("dopamine 5 mcg/kg/min, 70 kg = 5.25 ml/h", near(pumpRate(dop, 5, 70), 5.25) && concentrationLabel(dop) === "4 mg/ml");
const vas = byId("vasopressin").a.inf!;
t("vasopressin 0.03 U/min = 4.5 ml/h, weight ignored", near(pumpRate(vas, 0.03, 0), 4.5) && concentrationLabel(vas) === "0.4 units/ml");
const ntg = byId("ntg").a.inf!;
t("NTG 10 mcg/min = 1.2 ml/h", near(pumpRate(ntg, 10, 0), 1.2) && concentrationLabel(ntg) === "500 mcg/ml");
const ami = byId("amiodarone").a.inf!;
t("amiodarone 1 mg/min in 900 mg/500 ml = 33.3 ml/h", near(pumpRate(ami, 1, 0), 33.33));
const ins = byId("insulin").a.inf!;
t("insulin 0.1 U/kg/h at 70 kg = 7 ml/h", near(pumpRate(ins, 0.1, 70), 7));
const oct = byId("octreotide").a.inf!;
t("octreotide 50 mcg/h = 5 ml/h (mcg, not mg)", near(pumpRate(oct, 50, 0), 5) && concentrationLabel(oct) === "10 mcg/ml");
const kcl = byId("kcl").a.inf!;
t("KCl 10 mEq/h of 10 mEq/100 ml = 100 ml/h", near(pumpRate(kcl, 10, 0), 100));
const midP = byId("midazolam").p!.inf!;
t("paed midazolam 0.06 mg/kg/h, 15 kg = 3 ml/h", near(pumpRate(midP, 0.06, 15), 3));
t("weight-based rate with no weight is null (Rule 8)", pumpRate(nor, 0.1, 0) === null && pumpRate(nor, 0.1, NaN) === null);
t("zero drug gives null, not Infinity", pumpRate(nor, 0.1, 60, 0) === null);
t("rate formatting", formatRate(4.5) === "4.50" && formatRate(33.333) === "33.3");

// ---- boluses ----
const adrArrest = byId("adrenaline").p!.bolus[0];
t("paed adrenaline 15 kg = 0.15 mg = 1.5 ml", bolusLabel(adrArrest, 15) === "For 15 kg: 0.15 mg = 1.5 ml");
t("paed adrenaline capped at 1 mg for 120 kg", bolusFor(adrArrest, 120)!.dose === 1 && bolusFor(adrArrest, 120)!.capped);
const adeP = byId("adenosine").p!.bolus[0];
t("paed adenosine 0.1 mg/kg capped at 6 mg", bolusFor(adeP, 80)!.dose === 6 && bolusFor(adeP, 20)!.dose === 2);
const txaP = byId("txa").p!.bolus[0];
t("paed TXA 15 mg/kg max 1 g", bolusFor(txaP, 20)!.dose === 300 && bolusFor(txaP, 80)!.dose === 1000);
const magP = byId("magnesium").p!.bolus[0];
t("paed Mg 40 mg/kg max 2 g", bolusFor(magP, 10)!.dose === 400 && bolusFor(magP, 70)!.dose === 2000);
t("non-weight bolus has no calc", bolusFor(byId("adenosine").a.bolus[0], 70) === null);
t("no weight -> no bolus calc", bolusFor(adrArrest, 0) === null);

// ---- search, copy ----
t("search by alias", searchDrugs("norepi")[0]?.id === "noradrenaline" && searchDrugs("kcl")[0]?.id === "kcl");
t("search + category", searchDrugs("", "Antidotes").every(d => d.cat === "Antidotes"));
const copied = copyText(byId("noradrenaline"), "adult", 60);
t("copy text has strength and rate", copied.includes("80 mcg/ml") && copied.includes("4.50 ml/h"));
t("copy text for adult-only drug in paed mode is honest", copyText(byId("ntg"), "paed", 15).includes("no paediatric standard"));
t("regimenFor", regimenFor(byId("ntg"), "paed") === null && !!regimenFor(byId("ntg"), "adult"));

// ---- wiring ----
const dash = readFileSync("src/components/DashboardView.tsx", "utf8");
t("dashboard opens the screen", dash.includes('data-coach="drug-dilutions"') && dash.includes("<DrugDilutionsView"));
const view = readFileSync("src/components/DrugDilutionsView.tsx", "utf8");
t("screen shows the disclaimer", view.includes("DILUTIONS_DISCLAIMER") && view.includes("Reference only."));
t("screen has adult/paediatric switch", view.includes("Paediatric (< 16 y)"));
t("screen uses no AI or Firebase", !/firebase|fetch\(|\/api\//.test(view));

console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);