// The privacy step turns calendar dates into "[Day N]" before text goes to the AI. Those markers must never
// reach a case sheet. This puts the real date back from the doctor's own text (kept on the device); if a
// marker cannot be matched, it is removed rather than shown.

// Must stay identical to DATE_PATTERN / parseDateString in server/deidentify.ts: the server numbers its
// "[Day N]" markers from the earliest date it matched, and we must number the same dates the same way.
const DATE_PATTERN = /\b(?<!\d)(?:(?:0?[1-9]|[12]\d|3[01])[\/\.-](?:0?[1-9]|1[012])[\/\.-](?:19|20)?\d\d|(?:19|20)\d\d[\/\.-](?:0?[1-9]|1[012])[\/\.-](?:0?[1-9]|[12]\d|3[01]))(?!\d)\b/g;
const MARKER_RE = /\[Day\s*(-?\d+)\]/gi;

function parseToUtcDay(raw: string): number | null {
  const parts = raw.split(/[\/\.-]/).map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  let day: number, month: number, year: number;
  if (parts[0] > 1000) {
    year = parts[0]; month = parts[1] - 1; day = parts[2];
  } else {
    day = parts[0]; month = parts[1] - 1; year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
  }
  const ms = Date.UTC(year, month, day);
  return isNaN(ms) ? null : Math.round(ms / 86400000);
}

/** "Day N" number (1 = earliest date in the text) -> the date exactly as the doctor wrote it. */
export function dayMapFromText(source: string): Map<number, string> {
  const matches = (source || "").match(DATE_PATTERN) || [];
  const found = matches
    .map((m) => ({ raw: m.trim(), day: parseToUtcDay(m.trim()) }))
    .filter((f): f is { raw: string; day: number } => f.day !== null);
  const out = new Map<number, string>();
  if (!found.length) return out;
  const first = Math.min(...found.map((f) => f.day));
  for (const f of found) {
    const dayNo = f.day - first + 1;
    if (!out.has(dayNo)) out.set(dayNo, f.raw);
  }
  return out;
}

export function restoreDayMarkers(value: string, map: Map<number, string>): string {
  if (typeof value !== "string" || !/\[Day/i.test(value)) return value;
  return value
    .replace(MARKER_RE, (_all, n) => {
      return map.get(parseInt(n, 10)) ?? "";
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