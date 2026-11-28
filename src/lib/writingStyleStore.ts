/**
 * ErMate — "My Writing Style" store.
 *
 * One style per signed-in doctor, kept on that doctor's own users/{uid} document, so it follows the
 * account to every device and is never visible to anyone else. The store forgets the style the moment
 * the signed-in user changes (sign out / switch account) so one doctor's style can never apply to
 * another's output. It holds preferences only: never patient data.
 *
 * This file has no Firebase import. The real backend is wired in writingStyleBackend.ts, and tests
 * wire in an in-memory one.
 */
import { DEFAULT_WRITING_STYLE, resolveWritingStyle, sanitizeWritingStyleForSave, type WritingStyle } from "./writingStyle";

export interface WritingStyleBackend {
  /** Calls back with the signed-in uid, or null when signed out. Returns an unsubscribe. */
  onAuth(cb: (uid: string | null) => void): () => void;
  /** Live updates of that doctor's stored style (raw, unvalidated). Returns an unsubscribe. */
  watch(uid: string, cb: (raw: unknown) => void): () => void;
  /** Writes the validated style, or removes it (null = back to ErMate defaults). */
  write(uid: string, style: WritingStyle | null): Promise<void>;
}

export interface WritingStyleStore {
  get(): WritingStyle;
  subscribe(listener: () => void): () => void;
  /** Saves the style for the signed-in doctor. null resets to ErMate defaults. Throws if signed out. */
  save(style: WritingStyle | null): Promise<void>;
  currentUid(): string | null;
  stop(): void;
}

export function createWritingStyleStore(backend: WritingStyleBackend): WritingStyleStore {
  let style: WritingStyle = DEFAULT_WRITING_STYLE;
  let uid: string | null = null;
  let unwatch: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (next: WritingStyle) => {
    if (JSON.stringify(next) === JSON.stringify(style)) return;
    style = next;
    listeners.forEach((l) => l());
  };

  const stopAuth = backend.onAuth((nextUid) => {
    if (nextUid === uid) return;
    unwatch?.();
    unwatch = null;
    uid = nextUid;
    set(DEFAULT_WRITING_STYLE); // never carry a previous doctor's style over
    if (uid) {
      const mine = uid;
      unwatch = backend.watch(mine, (raw) => {
        if (uid !== mine) return; // stale update for a previous account
        set(resolveWritingStyle(raw));
      });
    }
  });

  return {
    get: () => style,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async save(next) {
      if (!uid) throw new Error("Sign in to save your writing style.");
      const mine = uid;
      const clean = next ? sanitizeWritingStyleForSave(next) : null;
      await backend.write(mine, clean);
      if (uid === mine) set(clean ?? DEFAULT_WRITING_STYLE);
    },
    currentUid: () => uid,
    stop() { stopAuth(); unwatch?.(); unwatch = null; listeners.clear(); },
  };
}