/**
 * ICU Trends — pure helpers (no React, no Firestore).
 * Builds chartable series from every note in an ICU stay.
 *
 * Safety rules (Rule 8 — never fabricate):
 *  - Only values that were dictated/typed into a note are plotted.
 *  - A reading with no stated time is plotted at the note's time and flagged `approx`.
 *  - Readings more than GAP_HOURS apart are split by a null point so the line breaks;
 *    nothing is interpolated or filled in.
 *  - Values with more than one number (e.g. "7.7 → 8.7") are skipped, not guessed.
 *  - Temperature is grouped by the unit as dictated; no °C/°F conversion or assumption.
 */
import type { IcuNote, IcuObservation, IcuAdmission } from "./icuTypes";
import { resolvePastClock } from "./icuLogic";

export const GAP_HOURS = 12;

export type TrendWindow = "24h" | "7d" | "stay";

export interface TrendPoint {
  /** epoch ms; x-axis */
  t: number;
  /** null = deliberate line break */
  v: number | null;
  /** true when the time was not stated and the note's time was used */
  approx: boolean;
  /** original text as documented, for tooltips */
  raw: string;
  noteId: string;
}

export interface TrendSeries {
  key: string;           // stable id, e.g. "vital:HR", "lab:potassium", "vital:Temp|°F"
  label: string;         // "Potassium", "Temp (°F)", "Temp (unit not stated)"
  unit: string | null;
  group: "vital" | "lab";
  points: TrendPoint[];  // sorted by t, with null break points inserted
  count: number;         // real readings only
  latest: TrendPoint | null;
}

export interface TrendEvent {
  t: number;
  label: string;         // "Femoral HD catheter inserted"
}

export interface TrendBundle {
  series: TrendSeries[];
  events: TrendEvent[];
  from: number;
  to: number;
}

// ── Name normalisation ─────────────────────────────────────────
const VITAL_ALIASES: Record<string, string> = {
  hr: "HR", pulse: "HR", "pulse rate": "HR", "heart rate": "HR", pr: "HR",
  bp: "BP", "blood pressure": "BP", nibp: "BP", ibp: "BP", abp: "BP",
  map: "MAP", "mean arterial pressure": "MAP",
  rr: "RR", "resp rate": "RR", "respiratory rate": "RR",
  spo2: "SpO2", sats: "SpO2", saturation: "SpO2", "o2 sat": "SpO2", sao2: "SpO2",
  temp: "Temp", temperature: "Temp",
  grbs: "GRBS", rbs: "GRBS", cbg: "GRBS", "capillary glucose": "GRBS", "blood sugar": "GRBS",
};

const LAB_ALIASES: Record<string, string> = {
  k: "Potassium", "k+": "Potassium", potassium: "Potassium", "s.k": "Potassium", "serum potassium": "Potassium",
  na: "Sodium", "na+": "Sodium", sodium: "Sodium", "serum sodium": "Sodium",
  lactate: "Lactate", lac: "Lactate", "serum lactate": "Lactate",
  creatinine: "Creatinine", creat: "Creatinine", cr: "Creatinine", "s.cr": "Creatinine", "serum creatinine": "Creatinine",
  urea: "Urea", bun: "BUN",
  hb: "Hb", haemoglobin: "Hb", hemoglobin: "Hb",
  tlc: "TLC", wbc: "TLC", "total count": "TLC",
  platelets: "Platelets", plt: "Platelets", "platelet count": "Platelets",
  ph: "pH", pco2: "pCO2", paco2: "pCO2", po2: "pO2", pao2: "pO2",
  hco3: "HCO3", bicarb: "HCO3", bicarbonate: "HCO3",
  inr: "INR", bilirubin: "Bilirubin", "total bilirubin": "Bilirubin",
  procalcitonin: "Procalcitonin", pct: "Procalcitonin", crp: "CRP",
  "ionised calcium": "iCa", ica: "iCa", calcium: "Calcium", magnesium: "Magnesium", mg: "Magnesium",
  "base excess": "Base excess", be: "Base excess",
};

const normKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function vitalName(name: string): string | null {
  return VITAL_ALIASES[normKey(name)] ?? null;
}

function labName(name: string): string {
  const k = normKey(name);
  return LAB_ALIASES[k] ?? name.trim();
}

// ── Value parsing (only unambiguous numbers) ───────────────────
const NUM_RE = /-?\d+(?:\.\d+)?/g;

/** Single number, or null when 0 or ≥2 numbers are present. */
export function parseSingleNumber(value: string): number | null {
  const nums = (value || "").match(NUM_RE);
  if (!nums || nums.length !== 1) return null;
  const n = Number(nums[0]);
  return Number.isFinite(n) ? n : null;
}

/** "120/80" → {sys:120, dia:80}; anything else → null. */
export function parseBp(value: string): { sys: number; dia: number } | null {
  const m = (value || "").trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*(?:mm\s*hg|mmhg))?$/i);
  if (!m) return null;
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (sys < 20 || sys > 300 || dia < 10 || dia > 250 || dia >= sys) return null;
  return { sys, dia };
}

/** Unit for temperature grouping, as dictated. */
function tempUnitLabel(o: IcuObservation): string {
  const u = (o.unit || "").trim();
  if (/^°?\s*c$|celsius|centigrade/i.test(u)) return "°C";
  if (/^°?\s*f$|fahrenheit/i.test(u)) return "°F";
  if (u) return u;
  return "unit not stated";
}

/** Time for a reading: dictated clock resolved backwards from the note's anchor, or the anchor (approx). */
function readingTime(o: IcuObservation, anchorIso: string): { t: number; approx: boolean } {
  const anchor = new Date(anchorIso);
  if (o.time) {
    const iso = resolvePastClock(o.time, anchor);
    if (iso) return { t: new Date(iso).getTime(), approx: false };
  }
  return { t: anchor.getTime(), approx: true };
}

/** A signed note's anchor is its signing time; a draft's is its last update. */
export function noteAnchor(n: IcuNote): string {
  return n.signedAt || n.updatedAt || n.createdAt;
}

// ── Builder ───────────────────────────────────────────────────
interface RawPoint { t: number; v: number; approx: boolean; raw: string; noteId: string }

function addPoint(map: Map<string, { label: string; unit: string | null; group: "vital" | "lab"; pts: RawPoint[] }>,
  key: string, label: string, unit: string | null, group: "vital" | "lab", p: RawPoint) {
  let s = map.get(key);
  if (!s) { s = { label, unit, group, pts: [] }; map.set(key, s); }
  s.pts.push(p);
}

/** Sort, de-duplicate identical readings, then insert null breaks across gaps > GAP_HOURS. */
export function withBreaks(pts: RawPoint[], gapHours = GAP_HOURS): TrendPoint[] {
  const sorted = [...pts].sort((a, b) => a.t - b.t);
  const dedup: RawPoint[] = [];
  for (const p of sorted) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.t === p.t && prev.v === p.v) continue;
    dedup.push(p);
  }
  const out: TrendPoint[] = [];
  const gap = gapHours * 3_600_000;
  for (let i = 0; i < dedup.length; i++) {
    const p = dedup[i];
    if (i > 0 && p.t - dedup[i - 1].t > gap) {
      out.push({ t: dedup[i - 1].t + 1, v: null, approx: false, raw: "", noteId: "" });
    }
    out.push({ t: p.t, v: p.v, approx: p.approx, raw: p.raw, noteId: p.noteId });
  }
  return out;
}

const VITAL_ORDER = ["HR", "SBP", "DBP", "MAP", "RR", "SpO2", "Temp", "GRBS"];

export function buildTrends(adm: Pick<IcuAdmission, "admittedAt">, notes: IcuNote[], now = new Date()): TrendBundle {
  const map = new Map<string, { label: string; unit: string | null; group: "vital" | "lab"; pts: RawPoint[] }>();
  const events: TrendEvent[] = [];
  const seenEvents = new Set<string>();

  for (const n of notes) {
    const anchor = noteAnchor(n);
    const s = n.sections;

    for (const o of s.vitals || []) {
      const vn = vitalName(o.name);
      const { t, approx } = readingTime(o, anchor);
      const raw = `${o.name} ${o.value}${o.unit ? ` ${o.unit}` : ""}${o.time ? ` (${o.time})` : ""}`;
      if (vn === "BP") {
        const bp = parseBp(o.value);
        if (!bp) continue;
        addPoint(map, "vital:SBP", "Systolic BP", "mmHg", "vital", { t, v: bp.sys, approx, raw, noteId: n.id });
        addPoint(map, "vital:DBP", "Diastolic BP", "mmHg", "vital", { t, v: bp.dia, approx, raw, noteId: n.id });
        continue;
      }
      const v = parseSingleNumber(o.value);
      if (v === null) continue;
      if (vn === "Temp") {
        const u = tempUnitLabel(o);
        addPoint(map, `vital:Temp|${u}`, `Temp (${u})`, u === "unit not stated" ? null : u, "vital", { t, v, approx, raw, noteId: n.id });
      } else if (vn) {
        addPoint(map, `vital:${vn}`, vn, o.unit, "vital", { t, v, approx, raw, noteId: n.id });
      } else {
        const label = o.name.trim();
        addPoint(map, `vital:other:${normKey(label)}`, label, o.unit, "vital", { t, v, approx, raw, noteId: n.id });
      }
    }

    for (const o of s.investigations || []) {
      const v = parseSingleNumber(o.value);
      if (v === null) continue;
      const label = labName(o.name);
      const { t, approx } = readingTime(o, anchor);
      const raw = `${o.name} ${o.value}${o.unit ? ` ${o.unit}` : ""}${o.time ? ` (${o.time})` : ""}`;
      addPoint(map, `lab:${normKey(label)}`, label, o.unit, "lab", { t, v, approx, raw, noteId: n.id });
    }

    for (const d of n.devices || []) {
      if (!d.insertedAt) continue;
      const id = `${normKey(d.type)}|${d.site ? normKey(d.site) : ""}|${d.insertedAt}`;
      if (seenEvents.has(id)) continue;
      seenEvents.add(id);
      events.push({ t: new Date(d.insertedAt).getTime(), label: `${d.type}${d.site ? ` (${d.site})` : ""} inserted` });
    }
  }

  const series: TrendSeries[] = [];
  for (const [key, s] of map) {
    const points = withBreaks(s.pts);
    const real = points.filter((p) => p.v !== null);
    series.push({ key, label: s.label, unit: s.unit, group: s.group, points, count: real.length, latest: real[real.length - 1] ?? null });
  }

  series.sort((a, b) => {
    if (a.group !== b.group) return a.group === "vital" ? -1 : 1;
    if (a.group === "vital") {
      const ia = VITAL_ORDER.findIndex((x) => a.key.startsWith(`vital:${x}`));
      const ib = VITAL_ORDER.findIndex((x) => b.key.startsWith(`vital:${x}`));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label);
    }
    return b.count - a.count || a.label.localeCompare(b.label);
  });

  events.sort((a, b) => a.t - b.t);
  return { series, events, from: new Date(adm.admittedAt).getTime(), to: now.getTime() };
}

/** Restrict a bundle to a time window. Series with no real reading left are dropped. */
export function filterWindow(b: TrendBundle, w: TrendWindow, now = new Date()): TrendBundle {
  if (w === "stay") return b;
  const span = w === "24h" ? 24 : 24 * 7;
  const from = Math.max(b.from, now.getTime() - span * 3_600_000);
  const series = b.series
    .map((s) => {
      const points = s.points.filter((p) => p.t >= from);
      while (points.length && points[0].v === null) points.shift();
      const real = points.filter((p) => p.v !== null);
      return { ...s, points, count: real.length, latest: real[real.length - 1] ?? null };
    })
    .filter((s) => s.count > 0);
  return { series, events: b.events.filter((e) => e.t >= from), from, to: b.to };
}

/** "5 readings · 7.7 → 8.7 → 6.2 → 5.4 → 5.1" (last 6 values). */
export function seriesSummary(s: TrendSeries): string {
  const vals = s.points.filter((p) => p.v !== null).map((p) => p.v as number);
  const tail = vals.slice(-6).join(" → ");
  return `${s.count} reading${s.count === 1 ? "" : "s"}${tail ? ` · ${tail}` : ""}`;
}

/** Latest reading for a series key prefix, for the Rounds "since last note" tiles. */
export function latestFor(b: TrendBundle, keyPrefix: string): { series: TrendSeries; prev: number | null } | null {
  const s = b.series.find((x) => x.key === keyPrefix || x.key.startsWith(`${keyPrefix}|`));
  if (!s || !s.latest) return null;
  const real = s.points.filter((p) => p.v !== null);
  const prev = real.length > 1 ? (real[real.length - 2].v as number) : null;
  return { series: s, prev };
}