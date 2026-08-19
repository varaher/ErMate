/**
 * scribeChatStorage.ts
 *
 * Chat history is scoped PER CASE ID, not per session/device. This
 * gives two required behaviors:
 *
 *   1. Clicking "Save to Case Sheet" (finalizing this case) starts a
 *      FRESH blank chat for the NEXT patient — new caseId generated,
 *      no carryover.
 *
 *   2. Opening an EXISTING case again (from the case list, handover,
 *      wherever) reloads that exact case's full chat thread — never
 *      a blank screen — so the doctor sees the same continuation and
 *      can keep learning from / referencing the same conversation.
 *
 * Storage: Firestore subcollection scribeChatMessages under each
 * case document: cases/{caseId}/scribeChatMessages/{messageId}
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ScribeChatMessage } from "../../server/scribeChatTurn";

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

import { doc, updateDoc } from "firebase/firestore";
export async function updateChatMessage(caseId: string, messageId: string, updates: Partial<ScribeChatMessage>): Promise<void> {
  if (!caseId || !messageId) return;
  try {
    const messageRef = doc(db, "cases", caseId, "scribeChatMessages", messageId);
    await updateDoc(messageRef, updates);
  } catch (err) {
    console.warn(`[updateChatMessage] Error updating message ${messageId} for case ${caseId}:`, err);
  }
}
