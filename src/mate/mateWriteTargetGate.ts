/**
 * MATE Stage 0 — never guess which patient a clinical update belongs to.
 *
 * In MATE's general conversation, a clinical update that names no patient must NOT be written to
 * the case that happens to be open, displayed or last mentioned. It is held (unapplied, nothing
 * saved) while MATE asks "Which patient is this update for, doctor?".
 * The only implicit write target is an explicit Patient Focus: a case the clinician deliberately
 * opened (or that MATE just started for them), and only while that same case is the one in use.
 */
import type { MatePatientReference } from "./mateInterpretationTypes";

export const WHICH_PATIENT_QUESTION = "Which patient is this update for, doctor?";
export const HELD_UPDATE_TTL_MS = 15 * 60 * 1000;

/** An explicit patient reference in the utterance: a labelled bed, a compact bed like "3A", or a case no. */
export function hasExplicitPatientReference(text: string): boolean {
  const t = text || "";
  if (/\bbed\s*(?:no\.?|number|#)?\s*[:\-]?\s*\d{1,3}\s*[ab]?\b/i.test(t)) return true;
  if (/\b(?:patient|pt)\s+in\s+(?:bed\s*)?\d{1,3}\s*[ab]?\b/i.test(t)) return true;
  if (/(?:^|[\s,.(])\d{1,3}[ab]\b(?!\s*(?:mg|mcg|ml|%))/i.test(t)) return true;
  if (/\b(?:case|patient|pt)\s*(?:no\.?|number|#|id)\s*[:\-]?\s*[\w-]+/i.test(t)) return true;
  if (/\bC-\d{3,}\b/i.test(t) || /\b\d{9}\b/.test(t)) return true;
  return false;
}

/** Patient Focus is valid only while the focused case is the case actually in use. */
export function isFocusAuthorized(focusCaseId: string | null | undefined, inUseCaseId: string | null | undefined): boolean {
  return Boolean(focusCaseId) && Boolean(inUseCaseId) && focusCaseId === inUseCaseId;
}

/** True when the model/interpreter did not name a patient (none, "this patient", "the last one", untyped). */
export function isImplicitPatientReference(ref?: MatePatientReference | null): boolean {
  if (!ref) return true;
  return ref.type === "NONE" || ref.type === "CURRENT" || ref.type === "RECENT" || !ref.type;
}

export function shouldAskWhichPatient(opts: {
  clinicalWrite: boolean;
  text: string;
  explicitNewCase: boolean;
  hasContextCase: boolean;   // a case is open/displayed or was last referenced
  focusAuthorized: boolean;
  pasteFlow: boolean;        // bed-less sheet with no open patient: handled by the paste-first flow
}): boolean {
  if (!opts.clinicalWrite) return false;
  if (opts.explicitNewCase) return false;
  if (hasExplicitPatientReference(opts.text)) return false;
  if (opts.focusAuthorized) return false;
  if (opts.pasteFlow) return false;
  // Nothing open and nothing mentioned: a fresh new-patient dictation, nothing to be silently assigned to.
  return opts.hasContextCase;
}

export interface HeldUpdate { text: string; generation: number; createdAt: number }

export function isHeldUpdateExpired(held: HeldUpdate | null, generation: number, now: number = Date.now()): boolean {
  if (!held) return false;
  return held.generation !== generation || now - held.createdAt > HELD_UPDATE_TTL_MS;
}

/** Add a further unreferenced update to the held one; identical text is never added twice. */
export function appendHeldUpdate(prev: HeldUpdate | null, text: string, generation: number, now: number = Date.now()): HeldUpdate {
  const t = (text || "").trim();
  if (!prev) return { text: t, generation, createdAt: now };
  if (prev.text.includes(t)) return prev;
  return { ...prev, text: `${prev.text}\n${t}` };
}
