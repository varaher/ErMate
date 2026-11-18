// The privacy step turns calendar dates into "[Day N]" before text goes to the AI. Those markers must never
// reach a case sheet. This puts the real date back from the doctor's own text (kept on the device); if a
// marker cannot be matched, it is removed rather than shown.

const DATE_RE = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g;
const MARKER_RE = /\[Day\s*(-?\d+)\]/gi;

function toUtcDay(d: number, m: number, y: number): number | null {
  const year = y < 100 ? 2000 + y : y;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return Math.floor(Date.UTC(year, m - 1, d) / 86400000);
}

/** Day offset (0 = earliest date in the text) -> date exactly as the doctor wrote it. */
export function dayMapFromText(source: string): Map<number, string> {
  const found: { day: number; raw: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(DATE_RE.source, "g");
  while ((m = re.exec(source || ""))) {
    const day = toUtcDay(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
    if (day !== null) found.push({ day, raw: m[0] });
  }
  const out = new Map<number, string>();
  if (!found.length) return out;
  const first = Math.min(...found.map((f) => f.day));
  for (const f of found) {
    const off = f.day - first;
    if (!out.has(off)) out.set(off, f.raw);
  }
  return out;
}

export function restoreDayMarkers(value: string, map: Map<number, string>): string {
  if (typeof value !== "string" || !/\[Day/i.test(value)) return value;
  return value
    .replace(MARKER_RE, (_all, n) => {
      const off = parseInt(n, 10) - 1;
      return map.get(off) ?? "";
    })
    .replace(/\s+(?=[,.;])/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\b(?:on|at)\s*$/i, "")
    .trim();
}

/** Walks every string in the extraction. Safe on nested objects and arrays. */
export function restoreDayMarkersDeep<T>(fields: T, sourceText: string): T {
  const map = dayMapFromText(sourceText);
  const walk = (v: any): any => {
    if (typeof v === "string") return restoreDayMarkers(v, map);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: any = {};
      for (const k of Object.keys(v)) o[k] = walk(v[k]);
      return o;
    }
    return v;
  };
  return walk(fields);
}