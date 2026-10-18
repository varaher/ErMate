/**
 * Universal Age Display & Formatting Utility for ErMate.
 * Supports years, months, and neonatal days while preserving age 0 for infants/neonates.
 */

export function formatAge(
  age: number | null | undefined,
  ageMonths?: number | null,
  ageDays?: number | null
): string {
  const hasAge = typeof age === "number" && Number.isFinite(age) && age >= 0;
  if (!hasAge) return "N/A";

  // Neonate with specific days recorded
  if (typeof ageDays === "number" && Number.isFinite(ageDays) && ageDays > 0 && age === 0) {
    return `${ageDays}d`;
  }

  const hasMonths = typeof ageMonths === "number" && Number.isFinite(ageMonths) && age! <= 1;
  if (age === 0) {
    if (!hasMonths) return "<1y";
    if (ageMonths! > 0 && ageMonths! < 1) return "<1m";
    return `${ageMonths}m`;
  }
  if (age === 1 && hasMonths && ageMonths! >= 1) return `1y ${ageMonths}m`;
  return `${age}y`;
}

/** Long form used in print/EMR text, e.g. "45 years", "6 months", "14 days", "Under 1 month". */
export function formatAgeLong(
  age: number | null | undefined,
  ageMonths?: number | null,
  ageDays?: number | null
): string {
  if (typeof ageDays === "number" && Number.isFinite(ageDays) && ageDays > 0 && age === 0) {
    return `${ageDays} day${ageDays === 1 ? "" : "s"}`;
  }
  const s = formatAge(age, ageMonths, ageDays);
  if (s === "N/A") return "Not documented";
  if (s.endsWith("d")) return `${s.slice(0, -1)} days`;
  if (s === "<1y") return "Under 1 year";
  if (s === "<1m") return "Under 1 month";
  if (s.endsWith("m") && !s.includes("y")) return `${s.slice(0, -1)} months`;
  if (s.includes("y ")) return s.replace("y ", " year ").replace("m", " months");
  return `${s.slice(0, -1)} years`;
}

export type AgeStage =
  | "Neonate"     // 0-28 days (or <= 1 month)
  | "Infant"      // 1-12 months
  | "Toddler"     // 1-3 years
  | "Preschool"   // 3-6 years
  | "School-age"  // 6-12 years
  | "Adolescent"  // 12-16 years
  | "Adult"       // 17-64 years
  | "Geriatric"   // >= 65 years
  | "Unknown";

export interface AgeStageInfo {
  stage: AgeStage;
  label: string;
  isPediatric: boolean;
  isGeriatric: boolean;
  tone: "rose" | "amber" | "sky" | "purple" | "emerald" | "slate";
}

export function getAgeStage(
  age: number | null | undefined,
  ageMonths?: number | null,
  ageDays?: number | null
): AgeStageInfo {
  if (age === null || age === undefined || !Number.isFinite(age) || age < 0) {
    return { stage: "Unknown", label: "Age not documented", isPediatric: false, isGeriatric: false, tone: "slate" };
  }

  if (age === 0) {
    if (typeof ageDays === "number" && ageDays > 0 && ageDays <= 28) {
      return { stage: "Neonate", label: "Neonate (0–28 days)", isPediatric: true, isGeriatric: false, tone: "rose" };
    }
    if (typeof ageMonths === "number" && ageMonths <= 1) {
      return { stage: "Neonate", label: "Neonate (0–1 month)", isPediatric: true, isGeriatric: false, tone: "rose" };
    }
    return { stage: "Infant", label: "Infant (1–12 months)", isPediatric: true, isGeriatric: false, tone: "rose" };
  }

  if (age <= 1) {
    return { stage: "Toddler", label: "Toddler (1–3 years)", isPediatric: true, isGeriatric: false, tone: "amber" };
  }
  if (age < 3) {
    return { stage: "Toddler", label: "Toddler (1–3 years)", isPediatric: true, isGeriatric: false, tone: "amber" };
  }
  if (age < 6) {
    return { stage: "Preschool", label: "Preschool (3–6 years)", isPediatric: true, isGeriatric: false, tone: "sky" };
  }
  if (age < 12) {
    return { stage: "School-age", label: "School-age (6–12 years)", isPediatric: true, isGeriatric: false, tone: "emerald" };
  }
  if (age <= 16) {
    return { stage: "Adolescent", label: "Adolescent (12–16 years)", isPediatric: true, isGeriatric: false, tone: "purple" };
  }
  if (age < 65) {
    return { stage: "Adult", label: "Adult", isPediatric: false, isGeriatric: false, tone: "slate" };
  }
  return { stage: "Geriatric", label: "Geriatric (≥65 years)", isPediatric: false, isGeriatric: true, tone: "amber" };
}
