import { PEDIATRIC_DRUGS, DRUG_CATEGORIES } from "./src/data/pediatricDrugs";
import { getDrugSafetyNotices } from "./src/data/pediatricDrugSafety";
let fail = 0;
const t = (n: string, ok: boolean) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fail++; };
const cat = DRUG_CATEGORIES.find(c => c.name === "Anti-Spasmodics");
const drugs = PEDIATRIC_DRUGS.filter(d => d.category === "Anti-Spasmodics");
t("category exists", !!cat);
t("3 antispasmodics listed", drugs.length === 3);
t("ids unique across formulary", new Set(PEDIATRIC_DRUGS.map(d => d.id)).size === PEDIATRIC_DRUGS.length);
for (const d of drugs) for (const w of [3, 6, 8, 12, 18, 25, 39, 40, 60]) {
  const r = d.calculateDose!(w);
  t(`${d.id} ${w}kg returns text`, !!r.doseValue && !/NaN|undefined/.test(r.doseValue + (r.breakdown || "")));
}
const dic = drugs.find(d => d.id === "dicyclomine")!;
t("dicyclomine <6kg refuses", /not use/i.test(dic.calculateDose!(4).doseValue));
t("dicyclomine danger notice", getDrugSafetyNotices(dic, null).some(n => n.severity === "danger"));
const hy = drugs.find(d => d.id === "hyoscine-butylbromide")!;
t("hyoscine capped at 20 mg", /^20\.0 mg/.test(hy.calculateDose!(90).doseValue));
t("hyoscine 10 kg = 3.0 mg", /^3\.0 mg/.test(hy.calculateDose!(10).doseValue));
const dr = drugs.find(d => d.id === "drotaverine")!;
t("drotaverine <10kg not advised", /Not advised/.test(dr.calculateDose!(8).doseValue));
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);