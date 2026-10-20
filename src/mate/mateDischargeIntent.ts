/**
 * MATE Stage 2B-1 — "prepare the discharge summary" as an intent, separate from case-sheet dictation.
 *
 * Two routes (never mixed):
 *  - STANDALONE: a complete case sheet is pasted with the request. A discharge DRAFT is prepared from
 *    the pasted text alone. No ER case is created or switched, nothing is written to any patient.
 *  - EXISTING PATIENT: the request names (or Patient Focus is on) a verified case; its discharge
 *    preview opens. Asking for a draft is never authorization to discharge or to finalize.
 */
import { looksLikeFullCaseSheet } from "./mateNewCaseIntent";

const VERBS = "prepare|prepping|make|write|create|generate|draft|give|provide|compile|convert|turn|need|want|do|get|build|start|finali[sz]e";
const DOC = "discharge\\s+(?:summary|summaries|note|notes|sheet|papers?)|\\bds\\b";

const REQUEST = new RegExp(`\\b(?:${VERBS})\\b[^\\n.!?]{0,60}?(?:${DOC})`, "i");
const BARE = /^\s*(?:please\s+)?(?:(?:the\s+|a\s+)?discharge\s+(?:summary|note)|ds)\s*(?:please)?[.!]?\s*$/i;
// "what is pending in discharge", "is the discharge summary complete" are status questions, not requests.
const STATUS_QUESTION = /\b(?:pending|missing|completeness|incomplete|left\s+to)\b/i;
const GREETING_ONLY = /^\s*(?:hey|hi|hello|ok|okay)?[\s,]*(?:mate|jarvis)?[\s,.!:-]*$/i;

export function isDischargeSummaryRequest(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (BARE.test(t)) return true;
  const fragments = t.split(/\n+|(?<=[.!?])\s+/);
  return fragments.some((f) => REQUEST.test(f) && !STATUS_QUESTION.test(f));
}

/** The pasted clinical text with the request sentence(s) and the "Mate," address removed. */
export function stripDischargeRequest(text: string): string {
  const lines = (text || "").split("\n").map((line) => {
    const parts = line.split(/(?<=[.!?])\s+/).filter((f) => !(REQUEST.test(f) && !STATUS_QUESTION.test(f)) && !GREETING_ONLY.test(f));
    return parts.join(" ");
  });
  // A short spoken preface on the first lines ("Mate, here is the complete case sheet:") is not clinical text,
  // and would hide the sheet's own first-line patient name from the header reader.
  const PREFACE = /^\s*(?:(?:hey|hi|ok|okay)\s+)?(?:mate|jarvis)\b[^\n]*$|\b(?:here(?:'s|\s+is)|pasting|pasted|below\s+is|attached)\b[^\n]{0,80}\b(?:case\s*sheet|sheet|record|notes?)\b[^\n]*$/i;
  const out = [...lines];
  let dropped = 0;
  while (out.length && dropped < 2 && (out[0].trim() === "" || (out[0].length < 140 && PREFACE.test(out[0])))) {
    out.shift();
    dropped++;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type DischargeRoute =
  | { kind: "NONE" }
  | { kind: "STANDALONE"; clinicalText: string }
  | { kind: "EXISTING_PATIENT" };

export function classifyDischargeRequest(text: string): DischargeRoute {
  if (!isDischargeSummaryRequest(text)) return { kind: "NONE" };
  const clinicalText = stripDischargeRequest(text);
  if (looksLikeFullCaseSheet(clinicalText)) return { kind: "STANDALONE", clinicalText };
  return { kind: "EXISTING_PATIENT" };
}

/** Discharge-critical items the pasted sheet did not state. They are flagged, never invented. */
export function missingDischargeItems(info?: {
  primaryDiagnosis?: string; dischargeMedications?: string; conditionAtDischarge?: string; followUpPlan?: string;
} | null): string[] {
  const out: string[] = [];
  const blank = (v?: string) => !(typeof v === "string" && v.trim());
  if (blank(info?.primaryDiagnosis)) out.push("final diagnosis");
  if (blank(info?.dischargeMedications)) out.push("discharge medications");
  if (blank(info?.conditionAtDischarge)) out.push("condition at discharge");
  if (blank(info?.followUpPlan)) out.push("follow-up advice");
  return out;
}
