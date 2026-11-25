/**
 * Vitals always carry their unit when shown, printed or copied (25 Nov 2026, Neeraj: "make it a rule that all
 * vitals should be followed by respective things"). The stored value is not changed; a unit is added only
 * when the value starts with a number and has no unit yet, so "98% on room air" or "E4V5M6" stay as typed.
 */
export type VitalKind = "hr" | "rr" | "bp" | "spo2" | "temp" | "grbs" | "gcs" | "pain";

const EMPTY = /^(not documented|not recorded|not done|n\/?a|nil|-|pending)$/i;

export function withVitalUnit(kind: VitalKind, raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (!v || EMPTY.test(v)) return v;
  // Only a value that starts with a number gets a unit ("Tachycardic", "E4V5M6", "Afebrile" are left alone).
  const m = v.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(.*)$/);
  if (!m) return v;
  const num = m[1].replace(/\s+/g, "");
  const rest = m[2].trim();
  const after = (unit: string, has: RegExp) => (has.test(rest) ? v : `${num}${unit}${rest ? ` ${rest}` : ""}`);
  switch (kind) {
    case "hr":
    case "rr":
      return after("/min", /^(\/\s*min|bpm|breaths|beats|per\s*min|\/minute)/i);
    case "bp":
      return /\//.test(num) ? after(" mmHg", /^mm\s*hg/i) : v;
    case "spo2":
      return after("%", /^%/);
    case "grbs":
      return after(" mg/dL", /^(mg|mmol)/i);
    case "pain":
      return /\//.test(num) ? v : after("/10", /^\/\s*10/);
    case "gcs":
      return /\//.test(num) ? v : after("/15", /^\/\s*15/);
    case "temp": {
      if (/^°|^(deg|f\b|c\b|fahrenheit|celsius)/i.test(rest)) {
        // "98.6 F" / "37 C" -> "98.6°F" / "37°C"
        const unit = /^°?\s*c|celsius/i.test(rest) ? "C" : "F";
        const tail = rest.replace(/^°?\s*(deg(rees?)?\s*)?(fahrenheit|celsius|f|c)\b\.?/i, "").trim();
        return `${num}°${unit}${tail ? ` ${tail}` : ""}`;
      }
      const n = parseFloat(num);
      return `${num}°${n > 45 ? "F" : "C"}${rest ? ` ${rest}` : ""}`;
    }
  }
  return v;
}

/** Discharge-sheet vital labels and their kinds, in print order. */
export const VITAL_KINDS: Array<[label: string, key: string, kind: VitalKind]> = [
  ["HR", "Hr", "hr"], ["BP", "Bp", "bp"], ["RR", "Rr", "rr"], ["SpO2", "Spo2", "spo2"],
  ["GCS", "Gcs", "gcs"], ["Pain Score", "PainScore", "pain"], ["GRBS", "Grbs", "grbs"], ["Temp", "Temp", "temp"],
];