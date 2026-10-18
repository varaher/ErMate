import { PEDIATRIC_DRUGS } from "../data/pediatricDrugs";
import type { PediatricDrug } from "../data/pediatricDrugs_types";

export interface DoseSuggestion {
  id: string;
  name: string;
  route: string;
  frequency: string;
  standardDose: string;
  maxDose?: string;
  source: string;
  /** Dose for THIS child's weight, e.g. "PO/IV/PR: 225.0 mg, IM: 75.0 mg" */
  doseValue: string;
  breakdown?: string;
  notes?: string;
  weightKg: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Common brand / short names → generic words found in the formulary. Reference spellings only; no doses. */
const ALIASES: Record<string, string[]> = {
  pcm: ["paracetamol"], crocin: ["paracetamol"], calpol: ["paracetamol"], dolo: ["paracetamol"],
  epinephrine: ["adrenaline"], adrenalin: ["adrenaline"],
  augmentin: ["amoxiclav"], clavulin: ["amoxiclav"], amoxyclav: ["amoxiclav"], coamoxiclav: ["amoxiclav"],
  ventolin: ["salbutamol"], albuterol: ["salbutamol"],
  zofran: ["ondansetron"], emeset: ["ondansetron"],
  decadron: ["dexamethasone"], dexa: ["dexamethasone"],
  lasix: ["frusemide"], furosemide: ["frusemide"],
  valium: ["diazepam"], ativan: ["lorazepam"],
  septran: ["cotrimoxazole"], bactrim: ["cotrimoxazole"],
  ibuprofen: ["brufen"], brufen: ["ibuprofen"],
  phenobarbitone: ["phenobarbital"], rocephin: ["ceftriaxone"], zithromax: ["azithromycin"],
};

function haystack(d: PediatricDrug): string {
  return norm([d.name, d.genericName || "", d.id].join(" "));
}

/** Rank: name starts with query > a word of the name starts with it > contains. */
function score(d: PediatricDrug, q: string): number {
  const name = norm(d.name);
  if (name.startsWith(q)) return 3;
  const words = d.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 2;
  if (haystack(d).includes(q)) return 1;
  return 0;
}

export function findPediatricDrugs(query: string, limit = 3): PediatricDrug[] {
  const raw = norm(query || "");
  if (raw.length < 3) return [];
  const terms = [raw, ...(ALIASES[raw] || [])];
  const seen = new Set<string>();
  const scored: Array<{ d: PediatricDrug; s: number }> = [];
  for (const d of PEDIATRIC_DRUGS) {
    const best = Math.max(...terms.map((t) => score(d, t)));
    if (best > 0 && !seen.has(d.name)) { seen.add(d.name); scored.push({ d, s: best }); }
  }
  scored.sort((a, b) => b.s - a.s || a.d.name.length - b.d.name.length);
  return scored.slice(0, limit).map((x) => x.d);
}

/** Weight-based suggestions from the in-app paediatric formulary (same data as the Paediatric Drug Calculator). */
export function suggestPediatricDoses(query: string, weightKg: number | null | undefined, limit = 3): DoseSuggestion[] {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 120) return [];
  const out: DoseSuggestion[] = [];
  for (const d of findPediatricDrugs(query, limit)) {
    if (!d.calculateDose) continue;
    let calc: ReturnType<NonNullable<PediatricDrug["calculateDose"]>>;
    try { calc = d.calculateDose(weightKg); } catch { continue; }
    if (!calc || !calc.doseValue || /NaN|undefined/.test(calc.doseValue)) continue;
    out.push({
      id: d.id, name: d.name, route: d.route, frequency: d.frequency, standardDose: d.standardDose,
      maxDose: d.maxDose, source: d.source, doseValue: calc.doseValue, breakdown: calc.breakdown, notes: calc.notes, weightKg,
    });
  }
  return out;
}

/** Weight to dose with: the weight entered on the case sheet, else an age-based estimate (clearly labelled). */
export function resolveDosingWeight(
  entered: string | number | null | undefined,
  ageYears: number | null | undefined,
  ageMonths?: number | null,
  ageDays?: number | null
): { kg: number; estimated: boolean } | null {
  const n = typeof entered === "number" ? entered : parseFloat(String(entered ?? ""));
  if (Number.isFinite(n) && n > 0) return { kg: n, estimated: false };
  const est = estimateWeightFromAge(ageYears, ageMonths, ageDays);
  return est === null ? null : { kg: est, estimated: true };
}

/** APLS-style estimate. Infants use months when known; neonates use days; without months/days, age 0 uses 7 kg. */
export function estimateWeightFromAge(
  ageYears: number | null | undefined,
  ageMonths?: number | null,
  ageDays?: number | null
): number | null {
  if (ageYears === null || ageYears === undefined || !Number.isFinite(ageYears) || ageYears < 0) return null;
  if (ageYears === 0) {
    if (typeof ageDays === "number" && Number.isFinite(ageDays) && ageDays > 0) {
      return 3.5;
    }
    if (typeof ageMonths === "number" && Number.isFinite(ageMonths)) return ageMonths < 1 ? 3.5 : Math.round((0.5 * ageMonths + 4) * 10) / 10;
    return 7;
  }
  if (ageYears <= 5) return ageYears * 2 + 8;
  if (ageYears <= 12) return ageYears * 3 + 7;
  return ageYears * 3 + 10;
}
