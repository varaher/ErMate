/**
 * AI discharge summaries: remove leftover "[Day N]" anchors from the model's answer.
 *
 * The server replaces calendar dates with "[Day N]" before text goes to the AI (DPDP, Rule 4), and the day
 * number is counted per field, so the same number can mean different dates in different fields. A marker the
 * model echoes back therefore cannot be turned back into a real date safely. It is removed instead, with the
 * little word before it ("on [Day 3]", "since [Day 2]") and empty brackets, so the sentence still reads.
 * Plain clinical wording such as "Day 3 of fever" is never touched: only the square-bracket anchor goes.
 */
const LEAD_WORD = String.raw`(?:on|since|from|until|till|by|dated|as of|during|at)`;
const MARKER = String.raw`\[\s*Day\s+\d+\s*\]`;
const RANGE = String.raw`(?:\s*(?:-|–|to)\s*${MARKER})?`;

export function stripDayMarkers(value: string): string {
  if (typeof value !== "string" || !/\[\s*Day\s+\d+\s*\]/i.test(value)) return value;
  return value
    .replace(new RegExp(String.raw`\(\s*${MARKER}${RANGE}\s*\)`, "gi"), "")
    .replace(new RegExp(String.raw`\b${LEAD_WORD}\s+${MARKER}${RANGE}`, "gi"), "")
    .replace(new RegExp(MARKER, "gi"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function stripDayMarkersDeep<T>(input: T): T {
  if (typeof input === "string") return stripDayMarkers(input) as unknown as T;
  if (Array.isArray(input)) return input.map((x) => stripDayMarkersDeep(x)) as unknown as T;
  if (input && typeof input === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(input as any)) out[k] = stripDayMarkersDeep(v);
    return out;
  }
  return input;
}