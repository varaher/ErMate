/**
 * criticalOps.ts
 *
 * Tiny in-memory registry of "do not reload now" operations. Components that own
 * unsaved or in-flight clinical work register here; the Hard Refresh feature reads
 * it before reloading. No storage, no network, no side effects on the work itself.
 *
 *  - beginCriticalOp(key, label)  -> returns an `end()` fn (counted; safe to nest)
 *  - setCriticalFlag(key, label, active, opts) -> idempotent on/off flag for a
 *    component's own state (e.g. "isUploading")
 *
 * `opts.resolve` lets the owner offer a one-tap fix (e.g. "Save now") that the
 * blocked-refresh panel can show.
 */

export interface CriticalOpInfo {
  key: string;
  label: string;
  /** Optional one-tap action that clears this blocker (e.g. save now). */
  resolve?: { label: string; run: () => Promise<void> };
}

interface Entry {
  label: string;
  count: number;
  resolve?: CriticalOpInfo["resolve"];
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad listener must never break a save path */
    }
  });
}

/** Mark one operation as started. Call the returned function exactly when it finishes (success or failure). */
export function beginCriticalOp(key: string, label: string): () => void {
  const existing = entries.get(key);
  if (existing) {
    existing.count += 1;
    existing.label = label;
  } else {
    entries.set(key, { label, count: 1 });
  }
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const e = entries.get(key);
    if (!e) return;
    e.count -= 1;
    if (e.count <= 0) entries.delete(key);
    emit();
  };
}

/** Idempotent on/off flag owned by one component. Safe to call on every render/effect. */
export function setCriticalFlag(
  key: string,
  label: string,
  active: boolean,
  opts?: { resolve?: CriticalOpInfo["resolve"] }
): void {
  const existing = entries.get(key);
  if (active) {
    if (existing && existing.label === label && existing.count === 1 && existing.resolve === opts?.resolve) return;
    entries.set(key, { label, count: 1, resolve: opts?.resolve });
    emit();
  } else if (existing) {
    entries.delete(key);
    emit();
  }
}

export function getActiveCriticalOps(): CriticalOpInfo[] {
  return Array.from(entries.entries()).map(([key, e]) => ({ key, label: e.label, resolve: e.resolve }));
}

export function subscribeCriticalOps(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
