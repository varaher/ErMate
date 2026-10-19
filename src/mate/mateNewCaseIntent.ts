/**
 * MATE — recognising "start a new patient" speech (pure, no I/O).
 *
 * Doctors say it many ways: "new patient bed 11", "new pt in bed no 11",
 * "start a case in bed 11", or simply begin dictating about "patient number 11".
 * An occupied bed is never re-used here; callers still check occupancy first.
 */
import type { MatePatientReference } from "./mateInterpretationTypes";

const NEW_CASE_PATTERN =
  /\b(?:(?:new|fresh)\s+(?:patient|pt|case|intake|arrival|admission)|(?:start|create|begin|register)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:patient|pt|case)|patient\s+just\s+arrived|admit(?:ted)?\s+a?\s*new\s+(?:patient|pt))\b/i;

export function detectExplicitNewCaseIntent(text: string): boolean {
  if (!text) return false;
  return NEW_CASE_PATTERN.test(text);
}

/**
 * "I have apt in bed no 9", "we got a new patient in bed 4": the doctor is announcing a patient
 * before dictating. Subject + verb + patient word only, so "summarise patient in bed 9" or
 * "open the patient in bed 9" never count.
 */
export function detectPatientAnnouncement(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (/\?\s*$/.test(t)) return false;
  return /\b(?:(?:i|we)(?:'ve|\s+have|\s+got|\s+just\s+got)|there(?:'s|\s+is)|(?:just\s+)?(?:got|received|admitted))\s+(?:a\s+|an\s+|one\s+|another\s+)?(?:new\s+)?(?:patient|pt|apt|case|admission)\b/i.test(t);
}

const SHORT_BED = /^\s*(\d{1,3})\s*([ab])?\s*$/i;

/**
 * A reference that the interpreter could not match to a case but that looks like a bed
 * ("bed 11", or a bare "11" said as "patient number 11"). Returns the bed id or null.
 * Long display IDs (e.g. 261006004, C-2976) are never treated as beds.
 */
export function bedFromUnmatchedReference(ref?: MatePatientReference | null): string | null {
  if (!ref || (ref.type !== "BED" && ref.type !== "DISPLAY_ID")) return null;
  const m = String(ref.value ?? "").match(SHORT_BED);
  if (!m) return null;
  return `${Number(m[1])}${(m[2] || "").toUpperCase()}`;
}

/**
 * Vacant/unknown bed + clinical content that is not a question → the doctor is starting a
 * new patient. Reading requests ("summarise bed 9") and questions never create a case.
 */
export function shouldStartCaseForVacantBed(opts: {
  utterance: string;
  mayContainClinicalUpdate: boolean;
}): boolean {
  const t = (opts.utterance || "").trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (detectExplicitNewCaseIntent(t) || detectPatientAnnouncement(t)) return true;
  return opts.mayContainClinicalUpdate;
}

/**
 * The interpreter model sometimes mistakes a number inside a dictation ("RR 18", "BP 140 by 80")
 * for a bed or case number. A BED / DISPLAY_ID reference is trusted only when the doctor
 * actually said it as one: "bed 11", "patient number 11", "case C-2976", or a bare reply "11".
 */
export function isReferenceGroundedInUtterance(
  ref: MatePatientReference | null | undefined,
  utterance: string
): boolean {
  if (!ref || (ref.type !== "BED" && ref.type !== "DISPLAY_ID")) return true;
  const value = String(ref.value ?? "").trim();
  const text = (utterance || "").trim();
  if (!value || !text) return false;
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (text.toLowerCase() === value.toLowerCase()) return true;
  if (value.length >= 4 && new RegExp(esc, "i").test(text)) return true; // long display IDs are distinctive
  const num = value.match(/^0*(\d{1,3})\s*([ab])?$/i);
  if (!num) return new RegExp(`\\b${esc}\\b`, "i").test(text);
  const slot = num[2] ? `\\s*${num[2]}` : "(?:\\s*[ab])?";
  return new RegExp(
    `(?:\\bbed|\\bpatient|\\bpt|\\bcase|\\bnumber|\\bno\\.?|#|\\bid)\\W{0,6}(?:no\\.?|number|#)?\\W{0,3}0*${num[1]}${slot}(?![\\d.])`,
    "i"
  ).test(text);
}

/** Reference to use for routing: an ungrounded BED / DISPLAY_ID becomes NONE (open patient / new patient). */
export function groundPatientReference(
  ref: MatePatientReference | null | undefined,
  utterance: string
): MatePatientReference | undefined {
  if (!ref) return ref ?? undefined;
  return isReferenceGroundedInUtterance(ref, utterance) ? ref : { type: "NONE" };
}

/**
 * A pasted case sheet / long note. Interpreting it as a command wastes up to ~24 s on two model
 * calls and can only misroute it, so it goes straight to clinical extraction.
 */
export function isLongClinicalPaste(utterance: string, mayContainClinicalUpdate: boolean): boolean {
  const t = (utterance || "").trim();
  return t.length >= 500 && mayContainClinicalUpdate && !/\?\s*$/.test(t);
}

/** Looks like a whole external case sheet (several labelled sections) rather than a short dictation. */
export function looksLikeFullCaseSheet(utterance: string): boolean {
  const t = (utterance || "").trim();
  if (t.length < 500) return false;
  const labels = [
    /\b(?:chief\s+)?complaints?\b/i, /\b(?:history|hpi|h\/o)\b/i, /\bvitals?\b/i,
    /\b(?:examination|exam|o\/e|cvs|cns|p\/a)\b/i, /\b(?:investigations?|labs?|ecg|x-?ray|ct)\b/i,
    /\b(?:diagnosis|impression)\b/i, /\b(?:treatment|management|rx)\b/i,
    /\b(?:disposition|discharge|advice|admit)\b/i,
  ];
  return labels.filter((r) => r.test(t)).length >= 4;
}

/** A sheet that states its own bed with a "Bed" label (not a stray "B12" / "2a" token). */
export function hasExplicitBedLabel(text: string): boolean {
  return /\bbed\s*(?:no\.?|number|#)?\s*[:\-]?\s*\d{1,3}\s*[ab]?\b/i.test(text || "");
}

/** Paste-first: a full case sheet with no bed of its own and no open patient is held until a bed is given. */
export function shouldHoldPastedSheet(opts: { text: string; hasOpenPatient: boolean }): boolean {
  return !opts.hasOpenPatient && looksLikeFullCaseSheet(opts.text) && !hasExplicitBedLabel(opts.text);
}

export type PendingSheetReply =
  | { kind: "bed"; bed: string }
  | { kind: "cancel" }
  | { kind: "other" };

/** Classify the message that follows a held sheet. Only a short bed-only reply is a bed answer. */
export function classifyPendingSheetReply(text: string): PendingSheetReply {
  const t = (text || "").trim();
  if (/^(cancel|discard|stop|never ?mind)[.!]?$/i.test(t)) return { kind: "cancel" };
  const m = /^(?:(?:it(?:'s| is)|its|in|to|put (?:him|her|them|this|the patient) in|assign(?: it)?(?: to)?|place(?: it)?(?: in)?)\s+)?(?:bed\s*(?:no\.?|number|#)?\s*)?(\d{1,3})\s*([ab])?\s*(?:please)?[.!]?$/i.exec(t);
  if (m) return { kind: "bed", bed: `${parseInt(m[1], 10)}${(m[2] || "").toUpperCase()}` };
  return { kind: "other" };
}
