/**
 * Drug dilutions (Dashboard › Quick tools). Added 26 Nov 2026.
 *
 * REFERENCE ONLY. A basic standard drawn from international guidelines (named on each entry).
 * Doctors adapt it to their hospital protocol and the ampoule strength in stock.
 * Pure data + arithmetic: no Firebase, no AI, no patient data.
 *
 * Safety rules enforced by verify_drug_dilutions.ts:
 *  - every weight-based paediatric bolus has an absolute maximum (never above the adult dose)
 *  - paediatric = under 16 years (ErMate's locked cutoff)
 *  - drugs with no paediatric standard here are marked adult only (p: null), never guessed
 */

export type DrugCategory = "Pressors" | "Cardiac" | "RSI / sedation" | "Electrolytes" | "GI bleed" | "Antidotes";
export type AmountUnit = "mg" | "mcg" | "units" | "mEq";
export type DoseUnit =
  | "mcg/kg/min" | "mcg/min" | "mg/min" | "units/min"
  | "mcg/kg/h" | "mg/kg/h" | "units/kg/h" | "mEq/kg/h" | "mcg/h" | "mEq/h";
export type PatientGroup = "adult" | "paed";

export interface Infusion {
  /** drug in the syringe/bag by default */
  amt: number;
  au: AmountUnit;
  /** final volume, ml */
  vol: number;
  diluent: string;
  /** step for the "drug in syringe" − / + control */
  amtStep: number;
  unit: DoseUnit;
  start: number;
  doseStep: number;
  lo: number;
  hi: number;
}

export interface Bolus {
  label: string;
  text: string;
  /** weight-based: dose per kg, in `bu` */
  perKg?: number;
  bu?: AmountUnit;
  /** absolute maximum single dose, in `bu` (required when perKg is set) */
  max?: number;
  /** strength drawn up, `bu` per ml (to show the volume) */
  perMl?: number;
}

export interface DrugRegimen {
  inf: Infusion | null;
  bolus: Bolus[];
  flags: string[];
  source: string;
}

export interface DilutionDrug {
  id: string;
  name: string;
  aliases: string[];
  cat: DrugCategory;
  ampoule: string;
  a: DrugRegimen;
  /** null = no paediatric standard in this list (adult only) */
  p: DrugRegimen | null;
}

export const PAEDIATRIC_AGE_CUTOFF = 16;
export const DILUTION_CATEGORIES: DrugCategory[] = ["Pressors", "Cardiac", "RSI / sedation", "Electrolytes", "GI bleed", "Antidotes"];
export const DILUTIONS_DISCLAIMER =
  "Reference only. Basic standard from international guidelines. Adapt to your hospital protocol and the ampoule strength you have. Final dose is the treating doctor's decision.";
export const DEFAULT_WEIGHT: Record<PatientGroup, number> = { adult: 60, paed: 15 };

export const DRUG_DILUTIONS: DilutionDrug[] = [
  {
    id: "noradrenaline", name: "Noradrenaline", aliases: ["norepinephrine", "nor", "levophed", "na"], cat: "Pressors", ampoule: "2 mg / 2 ml (base)",
    a: { inf: { amt: 4, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 2, unit: "mcg/kg/min", start: 0.1, doseStep: 0.02, lo: 0.05, hi: 0.5 }, bolus: [],
      flags: ["Labels differ: some state the salt (bitartrate), where 2 mg salt = 1 mg base. Doses here are base.", "Central line preferred; peripheral short term in a large vein, check the site hourly."],
      source: "Surviving Sepsis Campaign 2021" },
    p: { inf: { amt: 1, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 0.5, unit: "mcg/kg/min", start: 0.1, doseStep: 0.02, lo: 0.05, hi: 1 }, bolus: [],
      flags: ["Labels differ: check salt vs base."], source: "AHA PALS; Surviving Sepsis Campaign Children 2020" },
  },
  {
    id: "adrenaline", name: "Adrenaline", aliases: ["epinephrine", "adr", "epi"], cat: "Pressors", ampoule: "1 mg / 1 ml (1:1000)",
    a: { inf: { amt: 4, au: "mg", vol: 50, diluent: "NS", amtStep: 1, unit: "mcg/kg/min", start: 0.05, doseStep: 0.01, lo: 0.01, hi: 0.5 },
      bolus: [
        { label: "Cardiac arrest", text: "1 mg IV/IO every 3–5 min, flush 20 ml." },
        { label: "Anaphylaxis", text: "0.5 mg IM (0.5 ml of 1:1000), anterolateral thigh. Repeat after 5 min if needed." },
      ],
      flags: ["IV bolus 1 mg is for cardiac arrest only."], source: "AHA ACLS; Resuscitation Council UK anaphylaxis 2021" },
    p: { inf: { amt: 1, au: "mg", vol: 50, diluent: "NS", amtStep: 0.5, unit: "mcg/kg/min", start: 0.05, doseStep: 0.01, lo: 0.05, hi: 1 },
      bolus: [
        { label: "Cardiac arrest", text: "0.01 mg/kg IV/IO (0.1 ml/kg of 1:10,000) every 3–5 min. Max 1 mg.", perKg: 0.01, bu: "mg", max: 1, perMl: 0.1 },
        { label: "Anaphylaxis", text: "0.01 mg/kg IM of 1:1000. Max 0.5 mg.", perKg: 0.01, bu: "mg", max: 0.5, perMl: 1 },
      ],
      flags: [], source: "AHA PALS; WAO anaphylaxis guidance" },
  },
  {
    id: "dopamine", name: "Dopamine", aliases: ["dop"], cat: "Pressors", ampoule: "200 mg / 5 ml",
    a: { inf: { amt: 200, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 50, unit: "mcg/kg/min", start: 5, doseStep: 1, lo: 5, hi: 20 }, bolus: [], flags: [], source: "AHA ACLS" },
    p: { inf: { amt: 50, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 10, unit: "mcg/kg/min", start: 5, doseStep: 1, lo: 2, hi: 20 }, bolus: [], flags: [], source: "AHA PALS" },
  },
  {
    id: "dobutamine", name: "Dobutamine", aliases: ["dob", "dobu"], cat: "Pressors", ampoule: "250 mg / 20 ml",
    a: { inf: { amt: 250, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 50, unit: "mcg/kg/min", start: 5, doseStep: 1, lo: 2.5, hi: 20 }, bolus: [], flags: [], source: "AHA ACLS" },
    p: { inf: { amt: 50, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 10, unit: "mcg/kg/min", start: 5, doseStep: 1, lo: 2, hi: 20 }, bolus: [], flags: [], source: "AHA PALS" },
  },
  {
    id: "vasopressin", name: "Vasopressin", aliases: ["vaso", "pitressin"], cat: "Pressors", ampoule: "20 units / 1 ml",
    a: { inf: { amt: 20, au: "units", vol: 50, diluent: "NS", amtStep: 10, unit: "units/min", start: 0.03, doseStep: 0.01, lo: 0.01, hi: 0.04 }, bolus: [],
      flags: ["Added to noradrenaline; not a first-line agent on its own.", "Check the vial strength: brands differ."], source: "Surviving Sepsis Campaign 2021" },
    p: null,
  },
  {
    id: "ntg", name: "Nitroglycerin", aliases: ["ntg", "gtn", "glyceryl trinitrate", "nitro"], cat: "Cardiac", ampoule: "25 mg / 5 ml",
    a: { inf: { amt: 25, au: "mg", vol: 50, diluent: "NS or D5", amtStep: 5, unit: "mcg/min", start: 10, doseStep: 5, lo: 5, hi: 200 }, bolus: [],
      flags: ["Avoid after a PDE-5 inhibitor (sildenafil 24 h, tadalafil 48 h), or with RV infarct."], source: "ACC/AHA; ESC heart failure 2021" },
    p: null,
  },
  {
    id: "amiodarone", name: "Amiodarone", aliases: ["amio", "cordarone"], cat: "Cardiac", ampoule: "150 mg / 3 ml",
    a: { inf: { amt: 900, au: "mg", vol: 500, diluent: "D5 only", amtStep: 150, unit: "mg/min", start: 1, doseStep: 0.5, lo: 0.5, hi: 1 },
      bolus: [
        { label: "Arrest (VF / pulseless VT)", text: "300 mg IV push, then 150 mg." },
        { label: "Stable VT / AF", text: "150 mg in 100 ml D5 over 10 min." },
      ],
      flags: ["Infusion: 1 mg/min for 6 h, then 0.5 mg/min for 18 h."], source: "AHA ACLS" },
    p: { inf: { amt: 150, au: "mg", vol: 50, diluent: "D5 only", amtStep: 50, unit: "mcg/kg/min", start: 5, doseStep: 1, lo: 5, hi: 15 },
      bolus: [
        { label: "Arrest (VF / pulseless VT)", text: "5 mg/kg IV/IO push. Max 300 mg; may repeat up to 15 mg/kg.", perKg: 5, bu: "mg", max: 300, perMl: 50 },
        { label: "Perfusing rhythm", text: "5 mg/kg over 20–60 min. Expert advice first.", perKg: 5, bu: "mg", max: 300, perMl: 50 },
      ],
      flags: [], source: "AHA PALS; BNFC" },
  },
  {
    id: "adenosine", name: "Adenosine", aliases: ["ade", "adenocor"], cat: "Cardiac", ampoule: "6 mg / 2 ml",
    a: { inf: null, bolus: [{ label: "SVT", text: "6 mg rapid push, then 20 ml NS flush at once. If no effect: 12 mg, then 12 mg." }],
      flags: ["Not diluted. Defib pads on; warn the patient."], source: "AHA ACLS" },
    p: { inf: null,
      bolus: [
        { label: "SVT, first dose", text: "0.1 mg/kg rapid push, then 5–10 ml NS flush. Max 6 mg.", perKg: 0.1, bu: "mg", max: 6, perMl: 3 },
        { label: "SVT, second dose", text: "0.2 mg/kg rapid push. Max 12 mg.", perKg: 0.2, bu: "mg", max: 12, perMl: 3 },
      ],
      flags: ["Not diluted. Defib pads on."], source: "AHA PALS" },
  },
  {
    id: "fentanyl", name: "Fentanyl", aliases: ["fen", "fenta"], cat: "RSI / sedation", ampoule: "100 mcg / 2 ml",
    a: { inf: { amt: 500, au: "mcg", vol: 50, diluent: "NS", amtStep: 100, unit: "mcg/kg/h", start: 1, doseStep: 0.25, lo: 0.5, hi: 2 },
      bolus: [{ label: "RSI / analgesia", text: "1–2 mcg/kg slow IV; lower in shock.", perKg: 1, bu: "mcg", max: 200, perMl: 50 }],
      flags: [], source: "SCCM PADIS 2018; BNF" },
    p: { inf: { amt: 250, au: "mcg", vol: 50, diluent: "NS", amtStep: 50, unit: "mcg/kg/h", start: 1, doseStep: 0.5, lo: 1, hi: 4 },
      bolus: [{ label: "RSI / analgesia", text: "1 mcg/kg slow IV. Max 100 mcg.", perKg: 1, bu: "mcg", max: 100, perMl: 50 }],
      flags: [], source: "BNFC; APLS" },
  },
  {
    id: "midazolam", name: "Midazolam", aliases: ["mid", "mida", "versed"], cat: "RSI / sedation", ampoule: "5 mg / 1 ml",
    a: { inf: { amt: 50, au: "mg", vol: 50, diluent: "NS", amtStep: 10, unit: "mg/kg/h", start: 0.05, doseStep: 0.01, lo: 0.02, hi: 0.1 },
      bolus: [{ label: "Status epilepticus", text: "10 mg IM (over 40 kg)." }], flags: [], source: "AES 2016 status epilepticus; BNF" },
    p: { inf: { amt: 15, au: "mg", vol: 50, diluent: "NS", amtStep: 5, unit: "mg/kg/h", start: 0.06, doseStep: 0.02, lo: 0.06, hi: 0.24 },
      bolus: [{ label: "Status epilepticus", text: "0.2 mg/kg IM or buccal. Max 10 mg.", perKg: 0.2, bu: "mg", max: 10, perMl: 5 }],
      flags: [], source: "APLS; BNFC" },
  },
  {
    id: "rocuronium", name: "Rocuronium", aliases: ["roc", "rocu"], cat: "RSI / sedation", ampoule: "50 mg / 5 ml",
    a: { inf: null, bolus: [{ label: "RSI", text: "1.2 mg/kg IV push.", perKg: 1.2, bu: "mg", max: 200, perMl: 10 }],
      flags: ["Keep sugammadex ready where stocked."], source: "Difficult Airway Society; BNF" },
    p: { inf: null, bolus: [{ label: "RSI", text: "1.2 mg/kg IV push.", perKg: 1.2, bu: "mg", max: 200, perMl: 10 }], flags: [], source: "APLS; BNFC" },
  },
  {
    id: "kcl", name: "Potassium chloride", aliases: ["kcl", "potassium", "k"], cat: "Electrolytes", ampoule: "15% · 10 ml = 20 mEq",
    a: { inf: { amt: 10, au: "mEq", vol: 100, diluent: "NS", amtStep: 10, unit: "mEq/h", start: 10, doseStep: 5, lo: 5, hi: 10 }, bolus: [],
      flags: ["Never IV push. Never undiluted.", "Above 10 mEq/h: central line and cardiac monitor."], source: "ADA consensus 2024; BNF" },
    p: { inf: { amt: 4, au: "mEq", vol: 50, diluent: "NS", amtStep: 2, unit: "mEq/kg/h", start: 0.25, doseStep: 0.05, lo: 0.1, hi: 0.5 }, bolus: [],
      flags: ["Never IV push. Max 10 mEq/h; cardiac monitor."], source: "BNFC" },
  },
  {
    id: "magnesium", name: "Magnesium sulphate", aliases: ["mag", "mgso4", "magnesium"], cat: "Electrolytes", ampoule: "50% · 1 g / 2 ml",
    a: { inf: null,
      bolus: [
        { label: "Asthma / torsades", text: "2 g in 100 ml NS over 20 min (torsades in arrest: over 1–2 min)." },
        { label: "Eclampsia", text: "4 g IV over 15–20 min, then 1 g/h." },
      ],
      flags: ["Watch reflexes and breathing."], source: "BTS/SIGN asthma; AHA ACLS; WHO" },
    p: { inf: null, bolus: [{ label: "Asthma / torsades", text: "40 mg/kg in NS over 20 min. Max 2 g.", perKg: 40, bu: "mg", max: 2000, perMl: 500 }],
      flags: [], source: "BTS/SIGN asthma; AHA PALS" },
  },
  {
    id: "insulin", name: "Insulin (regular)", aliases: ["insulin", "actrapid", "dka"], cat: "Electrolytes", ampoule: "100 units / ml",
    a: { inf: { amt: 50, au: "units", vol: 50, diluent: "NS", amtStep: 10, unit: "units/kg/h", start: 0.1, doseStep: 0.02, lo: 0.05, hi: 0.1 }, bolus: [],
      flags: ["Check K⁺ first; delay insulin until K⁺ is above 3.5.", "Match vial and syringe (U-40 vs U-100)."], source: "ADA hyperglycemic crises consensus 2024" },
    p: { inf: { amt: 50, au: "units", vol: 50, diluent: "NS", amtStep: 10, unit: "units/kg/h", start: 0.05, doseStep: 0.05, lo: 0.05, hi: 0.1 }, bolus: [],
      flags: ["No bolus. Start at least 1 h after IV fluids have begun.", "Check K⁺ first."], source: "ISPAD 2022" },
  },
  {
    id: "octreotide", name: "Octreotide", aliases: ["oct", "octreo", "sandostatin"], cat: "GI bleed", ampoule: "100 mcg / 1 ml",
    a: { inf: { amt: 500, au: "mcg", vol: 50, diluent: "NS", amtStep: 100, unit: "mcg/h", start: 50, doseStep: 5, lo: 25, hi: 50 },
      bolus: [{ label: "Variceal bleed", text: "50 mcg IV bolus (0.5 ml)." }], flags: [], source: "Baveno VII; AASLD" },
    p: { inf: { amt: 100, au: "mcg", vol: 50, diluent: "NS", amtStep: 50, unit: "mcg/kg/h", start: 1, doseStep: 0.5, lo: 1, hi: 4 },
      bolus: [{ label: "Variceal bleed", text: "1 mcg/kg IV bolus. Max 50 mcg.", perKg: 1, bu: "mcg", max: 50, perMl: 100 }], flags: [], source: "BNFC; ESPGHAN" },
  },
  {
    id: "txa", name: "Tranexamic acid", aliases: ["txa", "tranexamic", "pause"], cat: "GI bleed", ampoule: "500 mg / 5 ml",
    a: { inf: null,
      bolus: [
        { label: "Trauma", text: "1 g in 100 ml NS over 10 min, then 1 g over 8 h. Within 3 h of injury." },
        { label: "Postpartum haemorrhage", text: "1 g IV over 10 min; a second 1 g after 30 min if still bleeding." },
      ],
      flags: ["Not for upper GI bleed (HALT-IT)."], source: "CRASH-2; WOMAN; HALT-IT" },
    p: { inf: { amt: 500, au: "mg", vol: 50, diluent: "NS", amtStep: 100, unit: "mg/kg/h", start: 2, doseStep: 0.5, lo: 2, hi: 2 },
      bolus: [{ label: "Trauma", text: "15 mg/kg over 10 min. Max 1 g. Then 2 mg/kg/h.", perKg: 15, bu: "mg", max: 1000, perMl: 100 }],
      flags: [], source: "RCPCH; NHS GGC paediatric TXA guideline" },
  },
  {
    id: "nac", name: "N-acetylcysteine", aliases: ["nac", "acetylcysteine", "paracetamol", "parvolex"], cat: "Antidotes", ampoule: "200 mg / 1 ml",
    a: { inf: null,
      bolus: [
        { label: "Bag 1", text: "150 mg/kg in 200 ml D5 over 1 h.", perKg: 150, bu: "mg", max: 16500, perMl: 200 },
        { label: "Bag 2", text: "50 mg/kg in 500 ml D5 over 4 h.", perKg: 50, bu: "mg", max: 5500, perMl: 200 },
        { label: "Bag 3", text: "100 mg/kg in 1000 ml D5 over 16 h.", perKg: 100, bu: "mg", max: 11000, perMl: 200 },
      ],
      flags: ["Weight capped at 110 kg. The two-bag (SNAP) regimen is an alternative if your hospital uses it."], source: "TOXBASE; SNAP trial" },
    p: { inf: null,
      bolus: [
        { label: "Bag 1", text: "150 mg/kg in 3 ml/kg D5 over 1 h.", perKg: 150, bu: "mg", max: 16500, perMl: 200 },
        { label: "Bag 2", text: "50 mg/kg in 7 ml/kg D5 over 4 h.", perKg: 50, bu: "mg", max: 5500, perMl: 200 },
        { label: "Bag 3", text: "100 mg/kg in 14 ml/kg D5 over 16 h.", perKg: 100, bu: "mg", max: 11000, perMl: 200 },
      ],
      flags: ["Small volumes to avoid fluid overload."], source: "TOXBASE; BNFC" },
  },
];

// ---------- arithmetic ----------

export const round3 = (n: number): number => Math.round(n * 1000) / 1000;
export const fmt = (n: number): string => String(round3(n));

/** Factor to bring the syringe amount into the dose's numerator unit (mg → mcg). */
export function unitFactor(au: AmountUnit, unit: DoseUnit): number {
  return au === "mg" && unit.startsWith("mcg") ? 1000 : 1;
}

/** Concentration in the dose's numerator unit per ml. */
export function concentration(inf: Infusion, amt: number = inf.amt): number {
  if (!(amt > 0) || !(inf.vol > 0)) return 0;
  return (amt * unitFactor(inf.au, inf.unit)) / inf.vol;
}

/** Final strength as read on a label, e.g. "80 mcg/ml", "4 mg/ml", "0.4 units/ml". */
export function concentrationLabel(inf: Infusion, amt: number = inf.amt): string {
  const c = amt / inf.vol;
  if (inf.au === "mg" && c < 1) return `${fmt(c * 1000)} mcg/ml`;
  return `${fmt(c)} ${inf.au}/ml`;
}

export const isPerKg = (unit: DoseUnit) => unit.includes("/kg");
export const isPerMin = (unit: DoseUnit) => unit.endsWith("/min");

/** Pump rate in ml/h. Returns null when the inputs cannot give a safe number (Rule 8: null over a guess). */
export function pumpRate(inf: Infusion, dose: number, weightKg: number, amt: number = inf.amt): number | null {
  const c = concentration(inf, amt);
  if (!(c > 0) || !(dose >= 0)) return null;
  if (isPerKg(inf.unit) && !(weightKg > 0)) return null;
  const perHour = dose * (isPerKg(inf.unit) ? weightKg : 1) * (isPerMin(inf.unit) ? 60 : 1);
  return perHour / c;
}

export const formatRate = (r: number): string => (r >= 10 ? r.toFixed(1) : r.toFixed(2));

export function rateWorking(inf: Infusion, dose: number, weightKg: number, amt: number = inf.amt): string {
  return `${fmt(dose)} ${inf.unit}${isPerKg(inf.unit) ? ` × ${weightKg} kg` : ""}${isPerMin(inf.unit) ? " × 60 min" : ""} ÷ ${concentrationLabel(inf, amt)}`;
}

export function outsideRange(inf: Infusion, dose: number): boolean {
  return dose < inf.lo - 1e-9 || dose > inf.hi + 1e-9;
}

export interface BolusResult { dose: number; ml: number | null; capped: boolean; unit: AmountUnit }

/** Weight-based bolus, capped at the stated maximum. null if not weight based or no weight. */
export function bolusFor(b: Bolus, weightKg: number): BolusResult | null {
  if (!b.perKg || !b.bu || !(weightKg > 0) || !(b.max! > 0)) return null;
  const raw = b.perKg * weightKg;
  const dose = Math.min(raw, b.max!);
  return { dose: round3(dose), ml: b.perMl && b.perMl > 0 ? round3(dose / b.perMl) : null, capped: raw > b.max!, unit: b.bu };
}

export function bolusLabel(b: Bolus, weightKg: number): string | null {
  const r = bolusFor(b, weightKg);
  if (!r) return null;
  return `For ${weightKg} kg: ${fmt(r.dose)} ${r.unit}${r.ml != null ? ` = ${fmt(r.ml)} ml` : ""}${r.capped ? " (capped at max)" : ""}`;
}

export const regimenFor = (d: DilutionDrug, g: PatientGroup): DrugRegimen | null => (g === "paed" ? d.p : d.a);

export const groupForAge = (ageYears: number | null | undefined): PatientGroup | null =>
  ageYears == null || !Number.isFinite(ageYears) ? null : ageYears < PAEDIATRIC_AGE_CUTOFF ? "paed" : "adult";

export function searchDrugs(q: string, cat: DrugCategory | "All" = "All", list: DilutionDrug[] = DRUG_DILUTIONS): DilutionDrug[] {
  const s = q.trim().toLowerCase();
  return list.filter((d) => (cat === "All" || d.cat === cat) && (!s || d.name.toLowerCase().includes(s) || d.aliases.some((a) => a.includes(s))));
}

/** Plain text for "Copy to case sheet". */
export function copyText(d: DilutionDrug, g: PatientGroup, weightKg: number, dose?: number, amt?: number): string {
  const r = regimenFor(d, g);
  if (!r) return `${d.name}: no paediatric standard in this list.`;
  const lines: string[] = [`${d.name}${g === "paed" ? ` (paediatric, ${weightKg} kg)` : ` (${weightKg} kg)`}`];
  for (const b of r.bolus) {
    const calc = bolusLabel(b, weightKg);
    lines.push(`${b.label}: ${b.text}${calc ? ` → ${calc.replace(/^For [\d.]+ kg: /, "")}` : ""}`);
  }
  if (r.inf) {
    const a = amt ?? r.inf.amt, ds = dose ?? r.inf.start;
    const rate = pumpRate(r.inf, ds, weightKg, a);
    lines.push(`Infusion: ${fmt(a)} ${r.inf.au} in ${r.inf.vol} ml ${r.inf.diluent} (${concentrationLabel(r.inf, a)}) at ${fmt(ds)} ${r.inf.unit}${rate != null ? ` = ${formatRate(rate)} ml/h` : ""}`);
  }
  return lines.join("\n");
}