/**
 * Five-level emergency triage scale used by ErMate.
 *
 *   Priority I   Immediate     0 min
 *   Priority II  Very Urgent   5 min
 *   Priority III Urgent       30 min
 *   Priority IV  Standard     60 min
 *   Priority V   Non-urgent  120 min
 *
 * `triageLevel` (1-5) is stored next to the legacy 3-bucket `triageCategory`, which every older consumer
 * (analytics, handover, server extraction) keeps reading unchanged:  I -> P1, II/III -> P2, IV/V -> P3.
 * Cases without a `triageLevel` simply keep showing their stored legacy category.
 */
import { TriageCategory, TriageLevel } from "../types";

export type TriageTone = "rose" | "orange" | "yellow" | "emerald" | "sky" | "amber";

export interface TriageLevelInfo {
  level: TriageLevel;
  code: string;          // "P1"
  name: string;          // "Immediate"
  minutes: number | null; // target time to be seen
  label: string;         // "P1 · Immediate (0 min)"
  tone: TriageTone;
}

export const TRIAGE_LEVELS: Record<TriageLevel, TriageLevelInfo> = {
  1: { level: 1, code: "P1", name: "Immediate", minutes: 0, label: "P1 · Immediate (0 min)", tone: "rose" },
  2: { level: 2, code: "P2", name: "Very Urgent", minutes: 5, label: "P2 · Very Urgent (5 min)", tone: "orange" },
  3: { level: 3, code: "P3", name: "Urgent", minutes: 30, label: "P3 · Urgent (30 min)", tone: "yellow" },
  4: { level: 4, code: "P4", name: "Standard", minutes: 60, label: "P4 · Standard (60 min)", tone: "emerald" },
  5: { level: 5, code: "P5", name: "Non-Urgent", minutes: 120, label: "P5 · Non-Urgent (120 min)", tone: "sky" },
};

export const TRIAGE_LEVEL_LIST: TriageLevelInfo[] = [1, 2, 3, 4, 5].map((l) => TRIAGE_LEVELS[l as TriageLevel]);

/** Legacy 3-bucket category for a level (what all pre-existing consumers expect). */
export function levelToLegacyCategory(level: TriageLevel): TriageCategory {
  if (level === 1) return TriageCategory.P1;
  if (level === 2 || level === 3) return TriageCategory.P2;
  return TriageCategory.P3;
}

function legacyBucket(cat?: string | null): "P1" | "P2" | "P3" | null {
  const m = String(cat || "").trim().match(/^P([123])\b/i);
  return m ? (("P" + m[1]) as "P1" | "P2" | "P3") : null;
}

function isLevel(x: unknown): x is TriageLevel {
  return x === 1 || x === 2 || x === 3 || x === 4 || x === 5;
}

export interface TriageDisplay {
  code: string;                 // what the badge shows, e.g. "P3"
  level: TriageLevel | null;    // null for legacy / pending
  name: string | null;
  minutes: number | null;
  label: string;                // longer form for print / tooltips
  tone: TriageTone;
  legacy: boolean;
}

/**
 * Single source of truth for showing a patient's triage.
 * Uses `triageLevel` only when it is consistent with the stored legacy category (so a stale level can never
 * contradict a category that was changed elsewhere, e.g. by AI extraction); otherwise falls back to the legacy value.
 */
export function getTriageDisplay(patient?: { triageCategory?: string | null; triageLevel?: unknown } | null): TriageDisplay {
  const cat = patient?.triageCategory ?? null;
  const lvl = patient?.triageLevel;
  if (isLevel(lvl)) {
    const bucket = legacyBucket(cat);
    const expected = levelToLegacyCategory(lvl).split(" ")[0];
    if (!cat || bucket === expected) {
      const info = TRIAGE_LEVELS[lvl];
      return { code: info.code, level: lvl, name: info.name, minutes: info.minutes, label: info.label, tone: info.tone, legacy: false };
    }
  }
  const bucket = legacyBucket(cat);
  const tone: TriageTone = bucket === "P1" ? "rose" : bucket === "P3" ? "emerald" : "amber";
  const code = String(cat || "P2").split(" ")[0] || "P2";
  return { code, level: null, name: null, minutes: null, label: String(cat || code), tone, legacy: true };
}

/** Filter chip match: compares the displayed code, so legacy and new cases filter consistently. */
export function matchesTriageCode(patient: { triageCategory?: string | null; triageLevel?: unknown } | null | undefined, code: string): boolean {
  return getTriageDisplay(patient).code === code;
}

type BadgeVariant = "solid-soft" | "outline-soft" | "plain";

const TONE_CLASSES: Record<BadgeVariant, Record<TriageTone, string>> = {
  // dashboard pending-card style
  "solid-soft": {
    rose: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    orange: "bg-orange-500/10 text-orange-500 border border-orange-500/20",
    yellow: "bg-yellow-400/20 text-yellow-600 border border-yellow-500/30",
    emerald: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-500 border border-sky-500/20",
  },
  // list / case-card style
  "outline-soft": {
    rose: "bg-rose-50 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400",
    amber: "bg-amber-50 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
    orange: "bg-orange-50 border-orange-250 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400",
    yellow: "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300",
    emerald: "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
    sky: "bg-sky-50 border-sky-250 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400",
  },
  // compact (no dark variant, matches the dashboard table chip)
  plain: {
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-250 text-amber-700",
    orange: "bg-orange-50 border-orange-250 text-orange-700",
    yellow: "bg-yellow-50 border-yellow-300 text-yellow-800",
    emerald: "bg-emerald-50 border-emerald-250 text-emerald-700",
    sky: "bg-sky-50 border-sky-250 text-sky-700",
  },
};

export function triageBadgeClass(tone: TriageTone, variant: BadgeVariant): string {
  return TONE_CLASSES[variant][tone];
}
