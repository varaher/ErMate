/** Age text for headers/print: keeps age 0 (infants) instead of treating it as "not recorded". */
export function formatAge(age: number | null | undefined, ageMonths?: number | null): string {
  const hasAge = typeof age === "number" && Number.isFinite(age) && age >= 0;
  if (!hasAge) return "N/A";
  const hasMonths = typeof ageMonths === "number" && Number.isFinite(ageMonths) && age! <= 1;
  if (age === 0) {
    if (!hasMonths) return "<1y";
    if (ageMonths! > 0 && ageMonths! < 1) return "<1m";
    return `${ageMonths}m`;
  }
  if (age === 1 && hasMonths && ageMonths! >= 1) return `1y ${ageMonths}m`;
  return `${age}y`;
}

/** Long form used in print/EMR text, e.g. "45 years", "6 months", "Under 1 month". */
export function formatAgeLong(age: number | null | undefined, ageMonths?: number | null): string {
  const s = formatAge(age, ageMonths);
  if (s === "N/A") return "Not documented";
  if (s === "<1y") return "Under 1 year";
  if (s === "<1m") return "Under 1 month";
  if (s.endsWith("m") && !s.includes("y")) return `${s.slice(0, -1)} months`;
  if (s.includes("y ") ) return s.replace("y ", " year ").replace("m", " months");
  return `${s.slice(0, -1)} years`;
}
