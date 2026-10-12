// ============================================================
// ErMate — Handover browser-cache ownership
// File: src/utils/handoverLocalCache.ts
// ============================================================
// Handover data cached in this browser belongs to exactly ONE signed-in
// account. It is removed at sign-out / account switch, and when a
// different account signs in on the same device. Unlabelled caches
// written before Oct 2026 have no provable owner, so they are removed,
// never adopted by whoever signs in next.

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const HANDOVER_LOCAL_KEYS = [
  "ermate_refined_handover_rows_v2",
  "ermate_refined_handover_meta_v2",
  "ermate_scribe_chat_messages",
  "ermate_direct_discharge_list",
];
export const HANDOVER_LOCAL_OWNER_KEY = "ermate_handover_local_owner";
const QUICK_PASTE_KEY = "ermate_quick_paste_list";

/** Remove every handover cache key (sign-out / account switch). */
export function clearHandoverLocalCache(storage: StorageLike): void {
  HANDOVER_LOCAL_KEYS.forEach(k => storage.removeItem(k));
  storage.removeItem(HANDOVER_LOCAL_OWNER_KEY);
}

/**
 * Call once the signed-in Firebase uid is known.
 * Returns clearedQuickPaste=true when the Quick Paste cache belonged to a
 * different account and was removed (caller must also reset in-memory state).
 */
export function enforceHandoverCacheOwner(storage: StorageLike, uid: string): { clearedQuickPaste: boolean } {
  const owner = storage.getItem(HANDOVER_LOCAL_OWNER_KEY);
  if (owner === uid) return { clearedQuickPaste: false };

  HANDOVER_LOCAL_KEYS.forEach(k => storage.removeItem(k));
  let clearedQuickPaste = false;
  // The Quick Paste cache was already cleared at every sign-out before this
  // change, so an unlabelled one belongs to the current user. A cache
  // labelled with a DIFFERENT uid never does.
  if (owner !== null) {
    storage.removeItem(QUICK_PASTE_KEY);
    clearedQuickPaste = true;
  }
  storage.setItem(HANDOVER_LOCAL_OWNER_KEY, uid);
  return { clearedQuickPaste };
}
