/**
 * MATE picks the bed for a NEW patient when the doctor named none, and can move a patient to another bed.
 * Pure helpers only: no Firebase, no UI.
 *
 * Rules (agreed with the doctor):
 *  - Auto-pick only for a new patient: nothing open, no bed said. A named bed is never overridden.
 *  - The pick is the lowest bed number whose A and B slots are both empty, as "<n>A". A shared slot is never auto-picked.
 *  - A move never overwrites another patient (the bed allocator refuses an occupied slot).
 */
import { normalizeMateBedId } from "./mateBedModel";

interface BedCase { bedNo?: string | null; status?: string; archivedAt?: unknown }

export function pickNextFreeBed(cases: BedCase[], physicalCapacity: number = 30): string | null {
  const cap = Math.max(1, Math.min(200, physicalCapacity || 30));
  const taken = new Set<number>();
  for (const c of cases || []) {
    if (!c || c.status === "Discharged" || c.archivedAt) continue;
    const id = normalizeMateBedId(c.bedNo);
    const m = id ? id.match(/^(\d+)[AB]?$/) : null;
    if (m) taken.add(parseInt(m[1], 10));
  }
  for (let n = 1; n <= cap; n++) if (!taken.has(n)) return `${n}A`;
  return null;
}

const MOVE_PATTERNS: RegExp[] = [
  /^(?:please\s+)?(?:move|shift|transfer)\s+(?:(?:this|the)\s+patient\s+|him\s+|her\s+|them\s+|it\s+)?to\s+(?:bed\s*(?:no\.?|number|#)?\s*)?(\d{1,3})\s*([ab])?[.!]?$/i,
  /^(?:please\s+)?(?:change|set|update)\s+(?:the\s+)?bed(?:\s+number)?\s+to\s+(?:bed\s*)?(\d{1,3})\s*([ab])?[.!]?$/i,
];

/** "Move to Bed 9", "shift him to 9A", "change bed to 9": returns "9" or "9A". Whole utterance only. */
export function parseMoveBedCommand(text: string): string | null {
  const t = (text || "").trim();
  if (!t || t.length > 60) return null;
  for (const re of MOVE_PATTERNS) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0) return `${n}${(m[2] || "").toUpperCase()}`;
    }
  }
  return null;
}

export const bedPickedNotice = (bed: string, sheet: boolean): string =>
  sheet
    ? `Started a new case in Bed ${bed}. Reading the sheet now. Nothing is applied until you review it. Wrong bed? Say "move to Bed 9".`
    : `Started a new case in Bed ${bed}. Wrong bed? Say "move to Bed 9".`;