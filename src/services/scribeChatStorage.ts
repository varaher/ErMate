/**
 * scribeChatStorage.ts
 *
 * Two independent storage scopes, kept deliberately separate so a
 * free-form clinical discussion can never be mistaken for, or leak
 * into, a real patient's case record:
 *
 *   1. CASE-LINKED chat history (dictation + case-bound discussion)
 *      Storage: cases/{caseId}/scribeChatMessages
 *      ID format: whatever handleSaveExtractedVoiceCase generates
 *      elsewhere (C-####) — unchanged, untouched by this file.
 *
 *   2. STANDALONE discussion sessions (no linked ErMate patient —
 *      e.g. a doctor pastes/attaches an external case just to
 *      discuss it, never to save it as a case sheet)
 *      Storage: users/{uid}/discussions/{discussionId}
 *      ID format: Dis-YYYYMMDD-### (day-scoped, zero-padded,
 *      transaction-counted so two sessions started back-to-back on
 *      the same day can never collide)
 *
 * Case-linked behavior (1) is UNCHANGED from the original version of
 * this file — same functions, same signatures, same Firestore paths.
 * Everything under "STANDALONE DISCUSSION SESSIONS" below is new and
 * additive only.
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { ScribeChatMessage } from "../../server/scribeChatTurn";

// ════════════════════════════════════════════════════════════════
// CASE-LINKED CHAT HISTORY — unchanged from original file
// ════════════════════════════════════════════════════════════════

/**
 * Subscribes to a case's chat history in real time. Call this when
 * the chat screen mounts for a given caseId — it immediately fires
 * with whatever history already exists (empty array for a brand new
 * case), then updates live as new messages are appended.
 *
 * Returns the unsubscribe function — call it on unmount / caseId change.
 */
export function subscribeChatHistory(
  caseId: string,
  onMessages: (messages: ScribeChatMessage[]) => void
): Unsubscribe {
  if (!caseId) {
    onMessages([]);
    return () => {};
  }

  const messagesRef = collection(db, "cases", caseId, "scribeChatMessages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        docId: doc.id,
        role: data.role || "assistant",
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.type || "text",
        content: data.content || "",
        extractionSummary: data.extractionSummary,
        clinicalReasoning: data.clinicalReasoning,
        unappliedExtraction: data.unappliedExtraction,
        dischargeDraft: data.dischargeDraft,
        mode: data.mode,
        extractionApplied: data.extractionApplied,
        dischargeApplied: data.dischargeApplied,
        dischargeIntent: data.dischargeIntent,
      } as any;
    });
    onMessages(messages);
  }, error => {
    console.warn(`[subscribeChatHistory] Listener fallback for case ${caseId}:`, error);
  });
}

/**
 * Persists a single message to the case's chat history. Call this
 * for every user turn AND every assistant response (extraction
 * confirmation + clinical reasoning), so the full thread survives
 * app restarts / re-opens.
 */
export async function appendChatMessage(caseId: string, message: ScribeChatMessage): Promise<void> {
  if (!caseId) return;
  try {
    const messagesRef = collection(db, "cases", caseId, "scribeChatMessages");
    // Firestore addDoc throws on undefined values. Strip them out.
    const cleanMessage = JSON.parse(JSON.stringify(message));

    await addDoc(messagesRef, {
      ...cleanMessage,
      serverTimestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[appendChatMessage] Error writing chat message for case ${caseId}:`, err);
  }
}

/**
 * Generates a new case and returns its ID, for the "start new chat"
 * action after a case is finalized. This does NOT touch or clear the
 * previous case's messages — they remain permanently attached to
 * their own caseId.
 */
export function generateNewCaseId(): string {
  return "C-" + Math.floor(1000 + Math.random() * 9000);
}

import { updateDoc, getDoc, setDoc } from "firebase/firestore";
export async function updateChatMessage(caseId: string, messageId: string, updates: Partial<ScribeChatMessage>): Promise<void> {
  if (!caseId || !messageId) return;
  try {
    const messageRef = doc(db, "cases", caseId, "scribeChatMessages", messageId);
    await updateDoc(messageRef, updates);
  } catch (err) {
    console.warn(`[updateChatMessage] Error updating message ${messageId} for case ${caseId}:`, err);
  }
}

// ════════════════════════════════════════════════════════════════
// STANDALONE DISCUSSION SESSIONS — new, additive only
//
// These NEVER touch the "cases" collection and never get a C-####
// ID. A discussion session id is unmistakably distinct (Dis- prefix)
// so it can never be confused with, or accidentally queried
// alongside, a real patient case.
// ════════════════════════════════════════════════════════════════

function formatDateStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * Generates a new discussion session ID scoped to today's date and
 * the current user, e.g. "Dis-20260908-001". Uses a Firestore
 * transaction on a small per-user, per-day counter document so two
 * sessions started in quick succession can never receive the same
 * sequence number — a plain "count existing docs" approach would be
 * race-prone under that scenario.
 *
 * Falls back to a timestamp-based id (still Dis-prefixed, still safe
 * to use, just not sequentially numbered) if Firestore is unreachable
 * — a doctor should never be blocked from starting a discussion
 * because of a counter-write failure.
 */
export async function generateNewDiscussionId(): Promise<string> {
  const uid = auth.currentUser?.uid;
  const todayStamp = formatDateStamp(new Date());

  if (!uid) {
    // No authenticated user context available — fall back to a
    // timestamp suffix rather than blocking discussion creation.
    return `Dis-${todayStamp}-${Date.now().toString().slice(-4)}`;
  }

  try {
    const counterRef = doc(db, "users", uid, "meta", `discussionCounter_${todayStamp}`);
    const nextSeq = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      const current = counterSnap.exists() ? (counterSnap.data().count || 0) : 0;
      const next = current + 1;
      transaction.set(counterRef, { count: next, date: todayStamp }, { merge: true });
      return next;
    });
    const paddedSeq = String(nextSeq).padStart(3, "0");
    return `Dis-${todayStamp}-${paddedSeq}`;
  } catch (err) {
    console.warn("[generateNewDiscussionId] Transaction failed, falling back to timestamp suffix:", err);
    return `Dis-${todayStamp}-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Subscribes to a standalone discussion session's chat history.
 * Mirrors subscribeChatHistory's shape/behavior exactly, but reads
 * from users/{uid}/discussions/{discussionId}/messages instead of
 * cases/{caseId}/scribeChatMessages.
 */
export function subscribeDiscussionHistory(
  discussionId: string,
  onMessages: (messages: ScribeChatMessage[]) => void
): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) {
    onMessages([]);
    return () => {};
  }

  const messagesRef = collection(db, "users", uid, "discussions", discussionId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: data.id || docSnap.id,
        docId: docSnap.id,
        role: data.role || "assistant",
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.type || "text",
        content: data.content || "",
        extractionSummary: data.extractionSummary,
        clinicalReasoning: data.clinicalReasoning,
        unappliedExtraction: data.unappliedExtraction,
        dischargeDraft: data.dischargeDraft,
        mode: data.mode,
        extractionApplied: data.extractionApplied,
        dischargeApplied: data.dischargeApplied,
        dischargeIntent: data.dischargeIntent,
      } as any;
    });
    onMessages(messages);
  }, error => {
    console.warn(`[subscribeDiscussionHistory] Listener fallback for discussion ${discussionId}:`, error);
  });
}

/**
 * Persists a single message to a standalone discussion session.
 * Also touches the parent discussion document's summary metadata
 * (title/updatedAt) so a future "My Discussions" list can be built
 * from a single collection query without reading every message
 * subcollection — the actual summary TEXT generation (AI-written
 * synopsis) is intentionally NOT done here; that belongs in the
 * component logic that decides WHEN to summarize (e.g. on session
 * end), not in the low-level storage write path.
 */
export async function appendDiscussionMessage(discussionId: string, message: ScribeChatMessage): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) return;

  try {
    const messagesRef = collection(db, "users", uid, "discussions", discussionId, "messages");
    const cleanMessage = JSON.parse(JSON.stringify(message));

    await addDoc(messagesRef, {
      ...cleanMessage,
      serverTimestamp: serverTimestamp(),
    });

    // Keep the parent discussion doc's updatedAt fresh so a
    // discussions-list view can sort by recency without reading
    // every subcollection.
    const discussionDocRef = doc(db, "users", uid, "discussions", discussionId);
    await setDoc(discussionDocRef, {
      id: discussionId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn(`[appendDiscussionMessage] Error writing message for discussion ${discussionId}:`, err);
  }
}

/**
 * Saves/updates the AI-generated summary (title + short synopsis) for
 * a discussion session. Call this once, when the doctor navigates
 * away from or explicitly closes a discussion session — never on
 * every message, to avoid burning a Claude call per turn just to
 * refresh a summary nobody has looked at yet.
 */
export async function saveDiscussionSummary(
  discussionId: string,
  summary: { title: string; synopsis: string }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) return;

  try {
    const discussionDocRef = doc(db, "users", uid, "discussions", discussionId);
    await setDoc(discussionDocRef, {
      id: discussionId,
      title: summary.title,
      synopsis: summary.synopsis,
      summarizedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn(`[saveDiscussionSummary] Error saving summary for discussion ${discussionId}:`, err);
  }
}