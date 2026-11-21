/**
 * The spoken / written ways a doctor labels the psychological assessment section.
 * "Psychology assessment normal", "psychiatric evaluation: no issues", "mental status normal" and the
 * original "psychological assessment" all mean the same section.
 *
 * Only a label followed by assessment/evaluation/exam/status/... counts. "Psychiatric history" and
 * "psychiatry consult" are different things and never match.
 *
 * The same text is repeated in src/mate/pastedsheetsections.ts (the browser cannot import server files);
 * verify_psych_capture.ts checks that the two stay identical.
 */
export const PSYCH_LABEL =
  String.raw`(?:psycholog(?:ical|y)|psychiatr(?:ic|y)|psych)\s+(?:assessment|evaluation|examination|exam|status|screening|review|findings?)|mental\s+(?:health|status)(?:\s+(?:assessment|evaluation|examination|exam))?`;

/** Swap the old fixed "psychological assessment" wording inside an existing pattern for the full label set. */
export function withPsychLabel(re: RegExp): RegExp {
  return new RegExp(re.source.replace(/psychological\\s\+assessment/g, `(?:${PSYCH_LABEL})`), re.flags);
}