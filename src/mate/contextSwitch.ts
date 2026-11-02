/**
 * Is a patient/session change in the MATE chat one that MATE itself started (new bed, "open Bed 5")?
 * An expected switch keeps the held utterance or pasted sheet alive so it can be replayed into the new case.
 *
 * The chat's own activeCaseId follows the incoming caseId prop one render LATE (it is synced in an effect),
 * while the session id changes in the first render. So the incoming caseId must count too; otherwise the
 * first render looks like an unexpected switch, the context generation is bumped, and the held sheet is
 * silently discarded (case created, nothing extracted).
 */
export function isExpectedContextSwitch(args: {
  activeCaseId: string | null | undefined;
  incomingCaseId: string | null | undefined;
  handoffTargetCaseId: string | null | undefined;
  switchTargetCaseId: string | null | undefined;
}): boolean {
  const targets = [args.handoffTargetCaseId, args.switchTargetCaseId].filter((x): x is string => Boolean(x));
  if (targets.length === 0) return false;
  return targets.some((t) => t === args.activeCaseId || t === args.incomingCaseId);
}