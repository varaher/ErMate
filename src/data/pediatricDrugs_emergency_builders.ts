import { PediatricDrug } from "./pediatricDrugs_types";

// Small builders so each emergency drug is declared as DATA (dose per kg, cap, concentration)
// and the arithmetic lives in one tested place. Doses are never changed here, only computed.

export const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return "?";
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(parseFloat(n.toFixed(1)));
  return String(parseFloat(n.toFixed(2)));
};

type Calc = NonNullable<PediatricDrug["calculateDose"]>;
type Base = Omit<PediatricDrug, "calculateDose">;

export interface BolusSpec extends Base {
  /** dose per kg as a single value or [low, high] */
  perKg: number | [number, number];
  /** unit of the dose, e.g. "mg", "mcg", "mEq", "g", "mL" */
  unit: string;
  /** absolute ceiling for one dose (same unit) */
  cap?: number | ((w: number) => number);
  /** concentration, to show the volume to draw up */
  conc?: { perMl: number; label: string };
  /** text appended to the breakdown */
  breakdownExtra?: string;
  notes?: string;
  /** shown after the dose value, e.g. "IV over 20 min" */
  how: string;
}

export function bolus(spec: BolusSpec): PediatricDrug {
  const { perKg, unit, cap, conc, breakdownExtra, notes, how, ...base } = spec;
  const [lo, hi] = Array.isArray(perKg) ? perKg : [perKg, perKg];
  const calculateDose: Calc = (w: number) => {
    const ceiling = typeof cap === "function" ? cap(w) : cap;
    const apply = (x: number) => (ceiling !== undefined ? Math.min(ceiling, x) : x);
    const dLo = apply(lo * w);
    const dHi = apply(hi * w);
    const capped = ceiling !== undefined && (lo * w > ceiling || hi * w > ceiling);
    const range = lo !== hi && dHi !== dLo;
    let breakdown = `Calculated (${lo === hi ? fmt(lo) : `${fmt(lo)}-${fmt(hi)}`} ${unit}/kg × ${fmt(w)} kg): ${fmt(lo * w)}${lo !== hi ? `-${fmt(hi * w)}` : ""} ${unit}.`;
    if (capped) breakdown += `\nCapped at the maximum single dose of ${fmt(ceiling as number)} ${unit}.`;
    if (conc) {
      breakdown += `\nVolume (${conc.label}): ${fmt(dLo / conc.perMl)}${range ? `-${fmt(dHi / conc.perMl)}` : ""} mL.`;
    }
    if (breakdownExtra) breakdown += `\n${breakdownExtra}`;
    return {
      doseValue: `${fmt(dLo)}${range ? `-${fmt(dHi)}` : ""} ${unit} ${how}`,
      unit,
      breakdown,
      notes,
    };
  };
  return { ...base, calculateDose };
}

export interface InfusionSpec extends Base {
  /** mcg/kg/min [start, max] */
  range: [number, number];
  /** absolute ceiling, mcg/kg/min */
  notes?: string;
}

/** Infusions in mcg/kg/min use the "rule of 6": 6 × weight (kg) mg made up to 100 mL, then 1 mL/h = 1 mcg/kg/min. */
export function infusion(spec: InfusionSpec): PediatricDrug {
  const { range, notes, ...base } = spec;
  const calculateDose: Calc = (w: number) => {
    const [lo, hi] = range;
    const mg = 6 * w;
    return {
      doseValue: `${fmt(lo)}-${fmt(hi)} mcg/kg/min (start ${fmt(lo)})`,
      unit: "mcg/kg/min",
      breakdown:
        `Start ${fmt(lo)} mcg/kg/min = ${fmt(lo * w)} mcg/min; titrate to effect up to ${fmt(hi)} mcg/kg/min (${fmt(hi * w)} mcg/min).\n` +
        `Rule of 6 mixing: add ${fmt(mg)} mg (6 × ${fmt(w)} kg) to diluent to make 100 mL. Then 1 mL/h = 1 mcg/kg/min.\n` +
        `Start rate: ${fmt(lo)} mL/h. Maximum of the range: ${fmt(hi)} mL/h.\n` +
        `Check the ampoule strength and draw up ${fmt(mg)} mg, not a number of mL.`,
      notes,
    };
  };
  return { ...base, calculateDose };
}

export function fixed(base: Base, calc: Calc): PediatricDrug {
  return { ...base, calculateDose: calc };
}