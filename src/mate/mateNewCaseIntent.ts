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
  if (detectExplicitNewCaseIntent(t)) return true;
  return opts.mayContainClinicalUpdate;
}
