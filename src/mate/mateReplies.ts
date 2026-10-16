/**
 * ErMate — MATE conversational reply phrasing + current-patient follow-ups
 *
 * Goal: MATE should sound like a colleague (Alexa / Claude / GPT style), not a report.
 *
 * Invariants:
 * 1. Wording only. Every fact comes from deterministic helpers
 *    (getCasePendingStatus, checkDischargeCompleteness) — never invented.
 * 2. Follow-up detection is READ-ONLY and only applies when a patient is already open
 *    and the doctor does not name another patient or ask about the whole ER.
 */

import type { ClinicalCase } from "../types";
import { getCasePendingStatus } from "../utils/caseHelper";

export function mateBedLabel(c: Pick<ClinicalCase, "bedNo" | "displayId"> | null | undefined): string {
  if (!c) return "this patient";
  if (c.bedNo) return `Bed ${c.bedNo}`;
  if (c.displayId) return `case ${c.displayId}`;
  return "this patient";
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function formatCaseCompletenessReply(c: ClinicalCase): string {
  const status = getCasePendingStatus(c);
  const label = mateBedLabel(c);
  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  if (!status.isPending || status.pendingCount === 0) {
    return `${Label} is fully documented — nothing pending.`;
  }
  const n = status.pendingCount;
  return `${Label} still needs ${n === 1 ? "one thing" : `${n} things`}: ${joinNatural(status.pendingSections)}.`;
}

export function formatDischargePendingReply(
  c: ClinicalCase,
  report: { complete: boolean; missing: string[]; pendingReports: string[] }
): string {
  const label = mateBedLabel(c);
  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  if (report.complete) return `${Label} is ready for discharge paperwork — nothing pending.`;
  const parts: string[] = [];
  if (report.missing.length) parts.push(`still missing ${joinNatural(report.missing)}`);
  if (report.pendingReports.length) parts.push(`waiting on ${joinNatural(report.pendingReports)}`);
  return `Before discharge, ${label} is ${parts.join(", and ")}.`;
}

export function greetingForNow(date: Date = new Date()): string {
  const h = date.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, Doctor. What can I do for you?`;
}

const PENDING_WORDS = /\b(?:pend\w*|remaining|missing|incomplete|outstanding|to\s*do|todo|unfinished)\b/i;
// "left" is also a body side ("left sided weakness"), so it only counts in these phrases.
const LEFT_PHRASES = /\b(?:anything|what(?:'?s|s|\s+is)?|whats|wht|whst|how\s+much|much|something)\s+(?:else\s+)?left\b|\bleft\s+(?:to\s+do|for\s+(?:him|her|them|me|this))\b/i;
// A real question/request frame. Without it the text is clinical dictation
// ("troponin pending", "CT report pending") and must NEVER be answered as a follow-up.
const QUESTION_FRAME = /^(?:(?:ok(?:ay)?|so|and|hey|hi|mate|pls|please)[\s,]+)*(?:what|whats|wht|whst|which|anything|any|is\s+there|are\s+there|do\s+i|did\s+i|tell\s+me|show\s+me|check|(?:can|could|will|would)\s+(?:u|you))\b/i;
const WHOLE_ER_WORDS = /\b(?:cases|patients|beds|everyone|everybody|all|list|er|ed|ward|department|census|today)\b/i;
const OTHER_PATIENT_REF = /\b(?:bed\s*\d|case\s*\d|\d{9}|c-\d{4})\b/i;
const DISCHARGE_WORDS = /\bdischarg\w*\b/i;

/**
 * "what's pending", "whst pending", "anything left?", "what's missing for him" —
 * asked while a patient is open — means THIS patient, not the whole ER.
 */
export function isCurrentPatientPendingFollowUp(utterance: string): boolean {
  const t = (utterance || "").trim();
  if (!t) return false;
  if (t.split(/\s+/).length > 12) return false;
  if (!QUESTION_FRAME.test(t)) return false;
  if (!PENDING_WORDS.test(t) && !LEFT_PHRASES.test(t)) return false;
  if (WHOLE_ER_WORDS.test(t)) return false;
  if (OTHER_PATIENT_REF.test(t)) return false;
  if (DISCHARGE_WORDS.test(t)) return false;
  return true;
}
