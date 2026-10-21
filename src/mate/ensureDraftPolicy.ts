/**
 * When MATE asks App for a draft case for a new Scribe session, should the session be attached to the
 * case that is currently open? Normally yes (idempotent recovery). Never when MATE is starting a
 * DIFFERENT patient in a vetted vacant bed (forceNew), otherwise the open patient would be re-bedded
 * or the request refused ("Current case is already assigned to Bed 3A ...").
 */
export function shouldAttachToOpenCase(openCaseId: string | null | undefined, forceNew?: boolean): boolean {
  return Boolean(openCaseId) && !forceNew;
}
