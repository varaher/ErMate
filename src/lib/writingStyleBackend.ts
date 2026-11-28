import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { auth, db } from "../firebase";
import { createWritingStyleStore, type WritingStyleBackend, type WritingStyleStore } from "./writingStyleStore";
import { DEFAULT_WRITING_STYLE, type WritingStyle } from "./writingStyle";

/** Real backend: the doctor's own users/{uid} document (owner-only by the Firestore rules). */
const firebaseBackend: WritingStyleBackend = {
  onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? u.uid : null)),
  watch: (uid, cb) =>
    onSnapshot(
      doc(db, "users", uid),
      (snap) => cb(snap.exists() ? (snap.data() as Record<string, unknown>).writingStyle : undefined),
      () => cb(undefined), // no access / offline: stay on ErMate defaults
    ),
  write: async (uid, style) => {
    await updateDoc(doc(db, "users", uid), { writingStyle: style ?? deleteField() });
  },
};

let instance: WritingStyleStore | null = null;
export function getWritingStyleStore(): WritingStyleStore {
  if (!instance) instance = createWritingStyleStore(firebaseBackend);
  return instance;
}

/** The signed-in doctor's style (ErMate defaults until it loads, or when none is saved). */
export function useWritingStyle(): WritingStyle {
  const store = getWritingStyleStore();
  return useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_WRITING_STYLE);
}