/**
 * MATE — ask "Which bed?" when a NEW patient starts and no bed was said (pure, no I/O).
 *
 * MATE never guesses the bed for a new patient. The dictation (or pasted sheet) is held, nothing is
 * saved, and the doctor answers with a bed ("Bed 9", "9A"), or "any bed" to let MATE pick the lowest
 * free one, or "cancel".
 *
 * A new patient "seems to start" when:
 *  - the doctor says so ("new patient", "we got a patient"), or
 *  - the dictation opens with an age/sex that does not match the open case ("45 year old female ..."
 *    while a 60-year-old male is open), or
 *  - nothing is open and nothing was mentioned recently, so the dictation can only be a new patient.
 * Dictation that names a bed or case never comes here.
 */
import { detectExplicitNewCaseIntent, detectPatientAnnouncement, classifyPendingSheetReply, type PendingSheetReply } from "./mateNewCaseIntent";
import { hasExplicitPatientReference } from "./mateWriteTargetGate";

export const WHICH_BED_QUESTION =
  'Which bed is this new patient in? Say "Bed 9" or "9A", or say "any bed" and I will pick the next free one. Nothing has been saved.';

export interface OpenCaseIdentity { age?: number | string | null; gender?: string | null }

type Sex = "M" | "F";

function sexOf(word?: string | null): Sex | null {
  const w = (word || "").trim().toLowerCase();
  if (!w) return null;
  if (/^(m|male|man|boy|gentleman)$/.test(w)) return "M";
  if (/^(f|female|woman|girl|lady)$/.test(w)) return "F";
  return null;
}

/** "60 year old male ...", "45F ...", "6 month old boy ...": age and sex at the very start of the text. */
export function openingIdentity(text: string): { age: number; sex: Sex | null } | null {
  const t = (text || "").trim().slice(0, 120);
  const a = /^\W*(?:an?\s+|the\s+)?(\d{1,3})\s*[-\s]?\s*(years?|yrs?|y|months?|mos?|weeks?|wks?|days?)\b(?:[-\s]*old)?(?:\s*[,/]?\s*(male|female|man|woman|boy|girl|gentleman|lady|m|f)\b)?/i.exec(t);
  if (a) {
    const n = parseInt(a[1], 10);
    const unit = a[2].toLowerCase();
    return { age: /^(y|yrs?|years?)$/.test(unit) ? n : 0, sex: sexOf(a[3]) };
  }
  const b = /^\W*(\d{1,3})\s*[\/-]?\s*(male|female|m|f)\b/i.exec(t);
  if (b) return { age: parseInt(b[1], 10), sex: sexOf(b[2]) };
  return null;
}

/** The text announces a different patient from the open one (only when both ages/sexes are known). */
export function startsNewPatient(opts: { text: string; openCase?: OpenCaseIdentity | null }): boolean {
  const text = opts.text || "";
  if (detectExplicitNewCaseIntent(text) || detectPatientAnnouncement(text)) return true;
  const id = openingIdentity(text);
  if (!id || !opts.openCase) return false;
  const openAge = opts.openCase.age === null || opts.openCase.age === undefined || opts.openCase.age === "" ? NaN : Number(opts.openCase.age);
  const openSex = sexOf(opts.openCase.gender);
  if (Number.isFinite(openAge) && id.age !== Math.floor(openAge)) return true;
  if (id.sex && openSex && id.sex !== openSex) return true;
  return false;
}

export function shouldAskWhichBed(opts: {
  text: string;
  clinicalWrite: boolean;
  openCase?: OpenCaseIdentity | null;   // the case open in this chat, if any
  hasRecentCase: boolean;               // a case was mentioned earlier in this chat
  hasBedRef: boolean;                   // the doctor named a bed
}): boolean {
  const text = (opts.text || "").trim();
  if (!text || /\?\s*$/.test(text)) return false;
  if (opts.hasBedRef || hasExplicitPatientReference(text)) return false;
  if (startsNewPatient({ text, openCase: opts.openCase })) return true;
  return opts.clinicalWrite && !opts.openCase && !opts.hasRecentCase;
}

export type WhichBedReply = PendingSheetReply | { kind: "any" };

const ANY_BED = /^(?:any(?:\s+(?:free|vacant|empty))?(?:\s+bed)?|next\s+(?:free|vacant|empty)(?:\s+bed)?|(?:first|lowest)\s+(?:free|vacant|empty)(?:\s+bed)?|you\s+(?:pick|choose|decide)|whichever|auto|pick\s+(?:one|any))(?:\s+please)?[.!]?$/i;

/** The answer to "Which bed?": a bed, "any bed", "cancel", or something else. */
export function classifyWhichBedReply(text: string): WhichBedReply {
  const base = classifyPendingSheetReply(text);
  if (base.kind !== "other") return base;
  return ANY_BED.test((text || "").trim()) ? { kind: "any" } : base;
}