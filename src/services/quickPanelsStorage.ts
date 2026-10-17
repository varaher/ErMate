/**
 * Persistence for a clinician's Quick Investigation panel customisations.
 * Firestore: users/{uid}/meta/quickPanels (owner-only under existing rules; no profile write involved).
 * localStorage mirrors it so the menu works instantly/offline. Both reads and writes are best-effort.
 */
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { QuickPanelPrefs, EMPTY_PREFS, sanitizePrefs } from "../utils/quickPanels";

const LS_PREFIX = "ermate_quickPanels_";

function lsKey(uid: string) {
  return `${LS_PREFIX}${uid}`;
}

export function readLocalQuickPanels(uid: string): QuickPanelPrefs {
  try {
    const raw = localStorage.getItem(lsKey(uid));
    return raw ? sanitizePrefs(JSON.parse(raw)) : EMPTY_PREFS;
  } catch {
    return EMPTY_PREFS;
  }
}

export async function loadQuickPanels(): Promise<QuickPanelPrefs> {
  const uid = auth.currentUser?.uid;
  if (!uid) return EMPTY_PREFS;
  try {
    const snap = await getDoc(doc(db, "users", uid, "meta", "quickPanels"));
    if (snap.exists()) {
      const prefs = sanitizePrefs(snap.data());
      try { localStorage.setItem(lsKey(uid), JSON.stringify(prefs)); } catch {}
      return prefs;
    }
  } catch (err) {
    console.warn("[quickPanels] load failed, using local copy:", err);
  }
  return readLocalQuickPanels(uid);
}

/** Resolves true when the cloud copy was written; the local copy is always updated. */
export async function saveQuickPanels(prefs: QuickPanelPrefs): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const clean = sanitizePrefs(prefs);
  try { localStorage.setItem(lsKey(uid), JSON.stringify(clean)); } catch {}
  try {
    await setDoc(doc(db, "users", uid, "meta", "quickPanels"), { ...clean, updatedAt: serverTimestamp() });
    return true;
  } catch (err) {
    console.warn("[quickPanels] cloud save failed (kept on this device):", err);
    return false;
  }
}
