/**
 * Self-serve account deletion (DPDP erasure).
 *
 * Retention rule (published in /privacy.html):
 *  - DELETED: login, users/{uid} (+ discussions, meta, logbook), individual-workspace cases and
 *    dictation sessions, personal chat sessions, handover sheet, personal quick-paste items.
 *  - KEPT: hospital-workspace cases (the hospital's record), and payment / credit ledgers
 *    (tax + audit). Those hold only the uid, not the profile.
 *  - BLOCKED: while the user is an active member of a hospital team (leave / transfer first).
 *
 * Side effects go through `deps` so the rule is testable without Firestore.
 */
export interface DeletionDeps {
  hasActiveTeamMembership(uid: string): Promise<boolean>;
  /** Refs of docs matching all equality filters in a top-level collection. */
  findOwned(collection: string, filters: Array<[string, any]>): Promise<any[]>;
  docRef(collection: string, id: string): any;
  /** Deletes the doc and all its subcollections. Must tolerate a missing doc. */
  recursiveDelete(ref: any): Promise<void>;
  deleteAuthUser(uid: string): Promise<void>;
  logDeletion(entry: Record<string, any>): Promise<void>;
  /** Cancels any live AutoPay mandate. Must reject if the mandate could not be cancelled. Optional for older callers. */
  cancelAutopay?(uid: string): Promise<void>;
}

export type DeletionResult =
  | { ok: true; deleted: Record<string, number> }
  | { ok: false; code: "TEAM_MEMBER" | "RECENT_LOGIN_REQUIRED" | "BAD_REQUEST" | "AUTOPAY_CANCEL_FAILED"; message: string };

export const DELETE_CONFIRM_WORD = "DELETE";
export const RECENT_LOGIN_SECONDS = 5 * 60;

/** Individual-workspace data only. Hospital-workspace records are deliberately excluded. */
export const OWNED_QUERIES: Array<{ key: string; collection: string; filters: (uid: string) => Array<[string, any]> }> = [
  { key: "cases", collection: "cases", filters: uid => [["ownerUid", uid], ["workspaceType", "individual"]] },
  { key: "scribeSessions", collection: "scribeSessions", filters: uid => [["ownerUid", uid], ["workspaceType", "individual"]] },
  { key: "chatSessions", collection: "chatSessions", filters: uid => [["createdBy", uid]] },
  { key: "quickPaste", collection: "quick_paste_patients", filters: uid => [["createdByUid", uid], ["hospital", ""]] },
];

export function checkDeleteRequest(body: any, authTimeSec: unknown, nowMs: number = Date.now()):
  { ok: true } | { ok: false; code: "BAD_REQUEST" | "RECENT_LOGIN_REQUIRED"; message: string } {
  if (!body || body.confirm !== DELETE_CONFIRM_WORD) {
    return { ok: false, code: "BAD_REQUEST", message: `Type ${DELETE_CONFIRM_WORD} to confirm.` };
  }
  const t = typeof authTimeSec === "number" ? authTimeSec : NaN;
  if (!Number.isFinite(t) || nowMs / 1000 - t > RECENT_LOGIN_SECONDS) {
    return { ok: false, code: "RECENT_LOGIN_REQUIRED", message: "For your security, please sign in again and retry within 5 minutes." };
  }
  return { ok: true };
}

export async function deleteAccount(deps: DeletionDeps, uid: string, now: Date = new Date()): Promise<DeletionResult> {
  if (!uid) return { ok: false, code: "BAD_REQUEST", message: "Missing account." };
  if (await deps.hasActiveTeamMembership(uid)) {
    return { ok: false, code: "TEAM_MEMBER", message: "You are an active member of a hospital team. Leave the team (or ask your HOD to remove you) first, then delete your account. Hospital records stay with the hospital." };
  }

  // A live AutoPay mandate must never outlive the account. If it cannot be cancelled, delete nothing.
  if (deps.cancelAutopay) {
    try { await deps.cancelAutopay(uid); }
    catch { return { ok: false, code: "AUTOPAY_CANCEL_FAILED", message: "We could not cancel your AutoPay subscription, so nothing was deleted. Please try again in a few minutes." }; }
  }

  const deleted: Record<string, number> = {};
  for (const q of OWNED_QUERIES) {
    const refs = await deps.findOwned(q.collection, q.filters(uid));
    for (const r of refs) await deps.recursiveDelete(r);
    deleted[q.key] = refs.length;
  }
  await deps.recursiveDelete(deps.docRef("handover_sheets", uid));
  await deps.recursiveDelete(deps.docRef("users", uid));
  deleted.profile = 1;

  await deps.deleteAuthUser(uid); // last: if it fails the user can retry; earlier steps are idempotent
  await deps.logDeletion({ uid, deletedAt: now.toISOString(), counts: deleted }).catch(() => undefined);
  return { ok: true, deleted };
}