/**
 * scribeChatStorage.ts
 *
 * Unified and secure storage for ErMate Scribe Sessions & Messages.
 *
 * 1. SESSION-BACKED CHAT HISTORY:
 *    Storage: scribeSessions/{sessionId}/messages/{messageId}
 *    Session Metadata: scribeSessions/{sessionId}
 *    Fields: ownerUid, workspaceType, hospitalId, createdAt, updatedAt, linkedCaseId, mode
 *    Linked to ClinicalCase via case.scribeSessionId & session.linkedCaseId
 *
 * 2. BACKWARD COMPATIBILITY:
 *    Legacy cases/{caseId}/scribeChatMessages are read-only and merged into
 *    active views so historical chats remain visible.
 *
 * 3. STANDALONE DISCUSSION SESSIONS:
 *    Storage: users/{uid}/discussions/{discussionId}
 *    ID format: Dis-YYYYMMDD-###
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
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  where,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { ScribeChatMessage } from "../../server/scribeChatTurn";
import type { ClinicalCase } from "../types";

export interface ScribeSessionDoc {
  id: string;
  ownerUid: string;
  workspaceType: "hospital" | "individual";
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  linkedCaseId: string | null;
  mode: "case" | "discussion";
}

function mapDocToMessage(docSnap: any): ScribeChatMessage {
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
}

export function mergeChatMessages(
  listA: ScribeChatMessage[],
  listB: ScribeChatMessage[]
): ScribeChatMessage[] {
  const seenIds = new Set<string>();
  const combined: ScribeChatMessage[] = [];

  for (const m of [...listA, ...listB]) {
    const key = m.id || (m as any).docId;
    if (key && seenIds.has(key)) continue;
    if (key) seenIds.add(key);
    combined.push(m);
  }

  combined.sort((a, b) => {
    const tA = new Date(a.timestamp || 0).getTime();
    const tB = new Date(b.timestamp || 0).getTime();
    return tA - tB;
  });

  return combined;
}

/**
 * Creates a brand new Scribe session document with linkedCaseId == null.
 * Re-throws on any Firestore permission or network failure.
 */
export async function createScribeSession(params: {
  sessionId?: string;
  ownerUid: string;
  workspaceType: "hospital" | "individual";
  hospitalId: string | null;
  mode?: "case" | "discussion";
}): Promise<string> {
  const sessionId = params.sessionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const now = new Date().toISOString();
  const sessionDoc: ScribeSessionDoc = {
    id: sessionId,
    ownerUid: params.ownerUid,
    workspaceType: params.workspaceType,
    hospitalId: params.hospitalId,
    createdAt: now,
    updatedAt: now,
    linkedCaseId: null,
    mode: params.mode || "case",
  };

  await setDoc(doc(db, "scribeSessions", sessionId), sessionDoc);
  return sessionId;
}

/**
 * Links an unlinked Scribe session to an accessible case document.
 * Re-throws on error.
 */
export async function linkSessionToCase(sessionId: string, caseId: string): Promise<void> {
  if (!sessionId || !caseId) throw new Error("Missing sessionId or caseId for linking");
  const sessionRef = doc(db, "scribeSessions", sessionId);
  await updateDoc(sessionRef, {
    linkedCaseId: caseId,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Two-sided linkage between a Scribe session and a ClinicalCase.
 * A link is complete ONLY when both:
 * 1. scribeSessions/{sessionId}.linkedCaseId == caseId
 * 2. cases/{caseId}.scribeSessionId == sessionId
 */
export async function linkScribeSessionAndCase(
  sessionId: string,
  caseId: string
): Promise<{ success: boolean; sessionLinked: boolean; caseLinked: boolean; error?: string }> {
  if (!sessionId || !caseId) {
    throw new Error("Missing sessionId or caseId for two-sided link");
  }

  const sessionRef = doc(db, "scribeSessions", sessionId);
  const caseRef = doc(db, "cases", caseId);

  try {
    return await runTransaction(db, async (txn) => {
      // 1. ATOMIC PRE-FLIGHT READS: read both documents inside the transaction
      const sessionSnap = await txn.get(sessionRef);
      const caseSnap = await txn.get(caseRef);

      // Verify existence of both documents
      if (!sessionSnap.exists()) {
        return {
          success: false,
          sessionLinked: false,
          caseLinked: false,
          error: `Session document ${sessionId} not found`,
        };
      }
      if (!caseSnap.exists()) {
        return {
          success: false,
          sessionLinked: false,
          caseLinked: false,
          error: `Case document ${caseId} not found`,
        };
      }

      const sessionData = sessionSnap.data();
      const caseData = caseSnap.data();

      const currentSessionLinkedCaseId = sessionData?.linkedCaseId ?? null;
      const currentCaseScribeSessionId = caseData?.scribeSessionId ?? null;

      // 2. CONFLICT CHECKS: validate both directions atomically before any writes
      // Session conflict: session belongs to another case
      if (currentSessionLinkedCaseId != null && currentSessionLinkedCaseId !== caseId) {
        return {
          success: false,
          sessionLinked: false,
          caseLinked: false,
          error: `Session conflict: session ${sessionId} is already linked to case ${currentSessionLinkedCaseId}`,
        };
      }

      // Case conflict: case already linked to another session
      if (currentCaseScribeSessionId != null && currentCaseScribeSessionId !== sessionId) {
        return {
          success: false,
          sessionLinked: false,
          caseLinked: false,
          error: `Case conflict: case ${caseId} already has canonical session ${currentCaseScribeSessionId}`,
        };
      }

      // 3. ATOMIC MUTATIONS (only executed if pre-flight and conflict checks pass cleanly)
      const sessionNeedsUpdate = currentSessionLinkedCaseId == null;
      const caseNeedsUpdate = currentCaseScribeSessionId == null;

      // Write session link if needed
      if (sessionNeedsUpdate) {
        txn.update(sessionRef, {
          linkedCaseId: caseId,
          updatedAt: new Date().toISOString(),
        });
      }

      // Write case pointer if needed
      if (caseNeedsUpdate) {
        txn.update(caseRef, {
          scribeSessionId: sessionId,
        });
      }

      return {
        success: true,
        sessionLinked: true,
        caseLinked: true,
      };
    });
  } catch (err: any) {
    console.error("[linkScribeSessionAndCase] Transaction error during two-sided link:", err);
    return {
      success: false,
      sessionLinked: false,
      caseLinked: false,
      error: err?.message || "Transaction failed during two-sided link",
    };
  }
}

/**
 * Reads both documents and strictly verifies two-sided link invariant.
 */
export async function verifyTwoSidedLink(sessionId: string, caseId: string): Promise<boolean> {
  try {
    const sessionSnap = await getDoc(doc(db, "scribeSessions", sessionId));
    const caseSnap = await getDoc(doc(db, "cases", caseId));
    if (!sessionSnap.exists() || !caseSnap.exists()) return false;
    const sData = sessionSnap.data();
    const cData = caseSnap.data();
    return sData?.linkedCaseId === caseId && cData?.scribeSessionId === sessionId;
  } catch (e) {
    console.error("[verifyTwoSidedLink] Verification read failed:", e);
    return false;
  }
}

/**
 * Resolves or establishes an authorized Scribe session for an existing case.
 * Follows strict protocol:
 * 1. If case.scribeSessionId exists and is valid, uses it.
 * 2. Looks for an existing authorized session linked to caseId.
 *    If multiple discovered: does NOT throw. Sorts deterministically,
 *    proposes earliest as canonical, and transactions case.scribeSessionId.
 * 3. Only if none exists: creates session with linkedCaseId: null, awaits,
 *    then links to caseId, awaits, and persists case.scribeSessionId.
 */
export async function resolveSessionForExistingCase(
  caseItem: ClinicalCase,
  user: any,
  workspace: { workspaceType: "hospital" | "individual"; hospitalId: string | null; ownerUid: string | null }
): Promise<{ sessionId: string; warning?: string }> {
  if (!caseItem.id) {
    throw new Error("Cannot resolve session without a valid case ID");
  }

  // 1. case.scribeSessionId if present
  if (caseItem.scribeSessionId) {
    try {
      const existingSnap = await getDoc(doc(db, "scribeSessions", caseItem.scribeSessionId));
      if (existingSnap.exists()) {
        const sData = existingSnap.data();
        if (sData?.linkedCaseId === caseItem.id || sData?.linkedCaseId == null) {
          if (sData?.linkedCaseId == null) {
            await linkSessionToCase(caseItem.scribeSessionId, caseItem.id);
          }
          return { sessionId: caseItem.scribeSessionId };
        }
      }
    } catch (e) {
      console.warn(`[resolveSessionForExistingCase] Could not read existing session ${caseItem.scribeSessionId}:`, e);
    }
  }

  // 2. Query for existing sessions linked to this case
  try {
    const sessionsRef = collection(db, "scribeSessions");
    const q = query(sessionsRef, where("linkedCaseId", "==", caseItem.id));
    const snap = await getDocs(q);

    if (snap.size === 1) {
      const foundSessionId = snap.docs[0].id;
      try {
        await updateDoc(doc(db, "cases", caseItem.id), {
          scribeSessionId: foundSessionId,
        });
      } catch (err) {
        console.warn("[resolveSessionForExistingCase] Could not backfill case.scribeSessionId:", err);
      }
      return { sessionId: foundSessionId };
    }

    if (snap.size > 1) {
      // Sort linked sessions deterministically by createdAt, then sessionId
      const sortedDocs = [...snap.docs].sort((a, b) => {
        const tA = new Date(a.data().createdAt || 0).getTime();
        const tB = new Date(b.data().createdAt || 0).getTime();
        if (tA !== tB) return tA - tB;
        return a.id.localeCompare(b.id);
      });

      const proposedCanonical = sortedDocs[0].id;

      // Set case.scribeSessionId using a Firestore transaction
      let chosenCanonical: string | null = null;
      let txnSucceeded = false;
      try {
        chosenCanonical = await runTransaction(db, async (txn) => {
          const caseRef = doc(db, "cases", caseItem.id);
          const cSnap = await txn.get(caseRef);
          if (cSnap.exists()) {
            const storedScribeId = cSnap.data()?.scribeSessionId;
            if (storedScribeId) {
              return storedScribeId;
            }
            txn.update(caseRef, { scribeSessionId: proposedCanonical });
            return proposedCanonical;
          }
          return proposedCanonical;
        });
        txnSucceeded = true;
      } catch (txnErr) {
        console.warn("[resolveSessionForExistingCase] Initial transaction setting canonical session warning:", txnErr);
        txnSucceeded = false;
      }

      // If the canonical-session transaction fails:
      if (!txnSucceeded) {
        // a. Re-read cases/{caseId}.scribeSessionId
        const recheckSnap = await getDoc(doc(db, "cases", caseItem.id));
        const currentScribeId = recheckSnap.exists() ? recheckSnap.data()?.scribeSessionId : null;

        // b. If it is now set:
        if (currentScribeId) {
          // use that stored session as canonical
          // verify it exists and is linked to this case
          const sSnap = await getDoc(doc(db, "scribeSessions", currentScribeId));
          if (sSnap.exists() && sSnap.data()?.linkedCaseId === caseItem.id) {
            // only then enable writes
            return { sessionId: currentScribeId };
          } else {
            console.error(`[resolveSessionForExistingCase] Stored session ${currentScribeId} failed verification`);
            throw new Error("Unable to attach Scribe history to this case.");
          }
        }

        // c. If it is STILL null:
        // DO NOT simply fall back to proposedCanonical
        // retry setting proposedCanonical using a transaction
        try {
          chosenCanonical = await runTransaction(db, async (txn) => {
            const caseRef = doc(db, "cases", caseItem.id);
            const cSnap = await txn.get(caseRef);
            if (cSnap.exists()) {
              const stored = cSnap.data()?.scribeSessionId;
              if (stored) return stored;
              txn.update(caseRef, { scribeSessionId: proposedCanonical });
              return proposedCanonical;
            }
            return proposedCanonical;
          });
        } catch (retryErr) {
          console.error("[resolveSessionForExistingCase] Retry transaction setting canonical session failed:", retryErr);
        }

        // verify both: case.scribeSessionId == chosenSessionId && session.linkedCaseId == caseId
        if (chosenCanonical) {
          const verifyCaseSnap = await getDoc(doc(db, "cases", caseItem.id));
          const verifySessionSnap = await getDoc(doc(db, "scribeSessions", chosenCanonical));
          const caseMatches = verifyCaseSnap.exists() && verifyCaseSnap.data()?.scribeSessionId === chosenCanonical;
          const sessionMatches = verifySessionSnap.exists() && verifySessionSnap.data()?.linkedCaseId === caseItem.id;
          if (caseMatches && sessionMatches) {
            return { sessionId: chosenCanonical };
          }
        }

        // d. If canonicalization still cannot be committed/verified: fail safely
        throw new Error("Unable to attach Scribe history to this case.");
      }

      if (chosenCanonical) {
        return { sessionId: chosenCanonical };
      }
      throw new Error("Unable to attach Scribe history to this case.");
    }
  } catch (err: any) {
    console.warn("[resolveSessionForExistingCase] Query for linked sessions failed:", err);
  }

  // 3. Create unlinked first, await, then link to existing case.id
  const newSessionId = await createScribeSession({
    ownerUid: user?.uid || "",
    workspaceType: workspace.workspaceType,
    hospitalId: workspace.hospitalId,
    mode: "case",
  });

  try {
    await linkSessionToCase(newSessionId, caseItem.id);
  } catch (err: any) {
    console.error("[resolveSessionForExistingCase] Failed to link new session to case:", err);
    throw new Error("Unable to attach Scribe history to this case.");
  }

  try {
    await updateDoc(doc(db, "cases", caseItem.id), {
      scribeSessionId: newSessionId,
    });
  } catch (e) {
    console.warn("[resolveSessionForExistingCase] Could not update case.scribeSessionId:", e);
  }

  return { sessionId: newSessionId };
}

/**
 * Persists a single chat message to the session's message subcollection.
 * RE-THROWS on failure to guarantee honest error handling.
 */
export async function appendChatMessage(
  targetId: string,
  message: ScribeChatMessage,
  options?: { isSession?: boolean }
): Promise<void> {
  if (!targetId) throw new Error("Missing target session or case ID");
  const cleanMessage = JSON.parse(JSON.stringify(message));
  const msgId = message.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  cleanMessage.id = msgId;

  const isSession = options?.isSession !== false;

  if (isSession) {
    const msgRef = doc(db, "scribeSessions", targetId, "messages", msgId);
    await setDoc(msgRef, {
      ...cleanMessage,
      serverTimestamp: serverTimestamp(),
    }, { merge: true });
  } else {
    const msgRef = doc(db, "cases", targetId, "scribeChatMessages", msgId);
    await setDoc(msgRef, {
      ...cleanMessage,
      serverTimestamp: serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Updates an existing chat message. RE-THROWS on failure.
 */
export async function updateChatMessage(
  targetId: string,
  messageId: string,
  updates: Partial<ScribeChatMessage>,
  options?: { isSession?: boolean }
): Promise<void> {
  if (!targetId || !messageId) throw new Error("Missing ID for message update");
  const isSession = options?.isSession !== false;

  if (isSession) {
    const messageRef = doc(db, "scribeSessions", targetId, "messages", messageId);
    const snap = await getDoc(messageRef);
    if (snap.exists()) {
      await updateDoc(messageRef, updates);
      return;
    }

    const messagesRef = collection(db, "scribeSessions", targetId, "messages");
    const q = query(messagesRef, where("id", "==", messageId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      await updateDoc(querySnap.docs[0].ref, updates);
      return;
    }

    throw new Error(`Message ${messageId} not found in session ${targetId}`);
  } else {
    const messageRef = doc(db, "cases", targetId, "scribeChatMessages", messageId);
    const snap = await getDoc(messageRef);
    if (snap.exists()) {
      await updateDoc(messageRef, updates);
      return;
    }

    const messagesRef = collection(db, "cases", targetId, "scribeChatMessages");
    const q = query(messagesRef, where("id", "==", messageId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      await updateDoc(querySnap.docs[0].ref, updates);
      return;
    }

    throw new Error(`Message ${messageId} not found in case ${targetId}`);
  }
}

/**
 * Retrieves chat history from a session, optionally merging legacy messages.
 * RE-THROWS on failure.
 */
export async function getChatHistory(
  sessionId: string,
  legacyCaseId?: string | null
): Promise<ScribeChatMessage[]> {
  if (!sessionId) throw new Error("Missing session ID for getChatHistory");

  const sessionMsgsRef = collection(db, "scribeSessions", sessionId, "messages");
  const qSession = query(sessionMsgsRef, orderBy("timestamp", "asc"));
  const snapSession = await getDocs(qSession);
  let allMessages = snapSession.docs.map(mapDocToMessage);

  if (!legacyCaseId) {
    return allMessages;
  }

  // 1. Legacy messages
  try {
    const legacyRef = collection(db, "cases", legacyCaseId, "scribeChatMessages");
    const qLegacy = query(legacyRef, orderBy("timestamp", "asc"));
    const legacySnap = await getDocs(qLegacy);
    const legacyMessages = legacySnap.docs.map(mapDocToMessage);
    allMessages = mergeChatMessages(legacyMessages, allMessages);
  } catch (err) {
    console.warn(`[getChatHistory] Legacy message read skipped for case ${legacyCaseId}:`, err);
  }

  // 2. Any other linked sessions for this case (read-only historical display)
  try {
    const sessionsRef = collection(db, "scribeSessions");
    const qOther = query(sessionsRef, where("linkedCaseId", "==", legacyCaseId));
    const snapOther = await getDocs(qOther);
    for (const oDoc of snapOther.docs) {
      if (oDoc.id !== sessionId) {
        const oMsgsRef = collection(db, "scribeSessions", oDoc.id, "messages");
        const oSnap = await getDocs(query(oMsgsRef, orderBy("timestamp", "asc")));
        const oMessages = oSnap.docs.map(mapDocToMessage);
        allMessages = mergeChatMessages(oMessages, allMessages);
      }
    }
  } catch (err) {
    console.warn(`[getChatHistory] Other linked sessions read skipped for case ${legacyCaseId}:`, err);
  }

  return allMessages;
}

/**
 * Subscribes to chat history in real time.
 */
export function subscribeChatHistory(
  targetId: string,
  onMessages: (messages: ScribeChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!targetId) {
    onMessages([]);
    return () => {};
  }

  const messagesRef = collection(db, "cases", targetId, "scribeChatMessages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(
    q,
    snapshot => {
      onMessages(snapshot.docs.map(mapDocToMessage));
    },
    error => {
      console.warn(`[subscribeChatHistory] Listener error for ${targetId}:`, error);
      onError?.(error);
    }
  );
}

/**
 * Subscribes to session messages AND legacy case messages, merging them seamlessly.
 * Also loads any additional linked sessions' messages for this case read-only.
 */
export function subscribeSessionAndLegacyHistory(
  sessionId: string,
  legacyCaseId: string | null | undefined,
  onMessages: (messages: ScribeChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!sessionId) {
    onMessages([]);
    return () => {};
  }

  let canonicalMessages: ScribeChatMessage[] = [];
  let legacyMessages: ScribeChatMessage[] = [];
  const secondarySessionsMap = new Map<string, ScribeChatMessage[]>();
  const secondaryUnsubs: (() => void)[] = [];
  let unsubLegacy: (() => void) | null = null;
  let isClosed = false;

  const emit = () => {
    if (isClosed) return;
    const secondaryMessages: ScribeChatMessage[] = [];
    for (const msgs of secondarySessionsMap.values()) {
      secondaryMessages.push(...msgs);
    }
    const combinedSecondary = mergeChatMessages(legacyMessages, secondaryMessages);
    const merged = mergeChatMessages(combinedSecondary, canonicalMessages);
    onMessages(merged);
  };

  const sessionRef = collection(db, "scribeSessions", sessionId, "messages");
  const qSession = query(sessionRef, orderBy("timestamp", "asc"));

  const unsubSession = onSnapshot(
    qSession,
    snapshot => {
      canonicalMessages = snapshot.docs.map(mapDocToMessage);
      emit();
    },
    error => {
      console.error(`[subscribeSessionHistory] Error for session ${sessionId}:`, error);
      onError?.(error);
    }
  );

  if (legacyCaseId) {
    const legacyRef = collection(db, "cases", legacyCaseId, "scribeChatMessages");
    const qLegacy = query(legacyRef, orderBy("timestamp", "asc"));
    unsubLegacy = onSnapshot(
      qLegacy,
      snapshot => {
        legacyMessages = snapshot.docs.map(mapDocToMessage);
        emit();
      },
      error => {
        console.warn(`[subscribeSessionHistory] Legacy listener warning for case ${legacyCaseId}:`, error);
      }
    );

    // Multi-session support: query any additional sessions linked to this same case
    getDocs(query(collection(db, "scribeSessions"), where("linkedCaseId", "==", legacyCaseId)))
      .then(snap => {
        if (isClosed) return;
        for (const sDoc of snap.docs) {
          if (sDoc.id !== sessionId) {
            const secRef = collection(db, "scribeSessions", sDoc.id, "messages");
            const qSec = query(secRef, orderBy("timestamp", "asc"));
            const unsubSec = onSnapshot(
              qSec,
              sSnap => {
                secondarySessionsMap.set(sDoc.id, sSnap.docs.map(mapDocToMessage));
                emit();
              },
              e => console.warn(`[subscribeSessionHistory] Secondary session ${sDoc.id} listener warning:`, e)
            );
            secondaryUnsubs.push(unsubSec);
          }
        }
      })
      .catch(e => console.warn("[subscribeSessionHistory] Query for secondary linked sessions error:", e));
  }

  return () => {
    isClosed = true;
    unsubSession();
    if (unsubLegacy) unsubLegacy();
    secondaryUnsubs.forEach(u => u());
  };
}

/**
 * Checks if a case has any persisted scribe chat history.
 * Checks EITHER legacy cases/{caseId}/scribeChatMessages
 * OR any authorized scribeSession linked to this case containing messages.
 */
export async function hasCaseScribeHistory(caseId: string): Promise<boolean> {
  if (!caseId) return false;
  try {
    // 1. Check legacy path first
    const legacyRef = collection(db, "cases", caseId, "scribeChatMessages");
    const legacySnap = await getDocs(query(legacyRef, limit(1)));
    if (!legacySnap.empty) return true;

    // 2. Check session-backed history on the case itself
    try {
      const caseDocSnap = await getDoc(doc(db, "cases", caseId));
      if (caseDocSnap.exists()) {
        const cData = caseDocSnap.data();
        if (cData?.scribeSessionId) {
          const sMsgsRef = collection(db, "scribeSessions", cData.scribeSessionId, "messages");
          const sMsgSnap = await getDocs(query(sMsgsRef, limit(1)));
          if (!sMsgSnap.empty) return true;
        }
      }
    } catch (e) {
      console.warn(`[hasCaseScribeHistory] Case doc lookup check error for ${caseId}:`, e);
    }

    // 3. Query scribeSessions where linkedCaseId == caseId
    const sessionsRef = collection(db, "scribeSessions");
    const qSessions = query(sessionsRef, where("linkedCaseId", "==", caseId));
    const sessionSnap = await getDocs(qSessions);
    for (const sDoc of sessionSnap.docs) {
      const msgsRef = collection(db, "scribeSessions", sDoc.id, "messages");
      const mSnap = await getDocs(query(msgsRef, limit(1)));
      if (!mSnap.empty) return true;
    }

    return false;
  } catch (err) {
    console.warn(`[hasCaseScribeHistory] Error checking history for case ${caseId}:`, err);
    return false;
  }
}

import { generateInternalCaseId } from "../utils/caseIdentity";

/**
 * Returns a collision-safe UUID for new case documents.
 */
export function generateNewCaseId(): string {
  return generateInternalCaseId();
}

// ════════════════════════════════════════════════════════════════
// STANDALONE DISCUSSION SESSIONS
// ════════════════════════════════════════════════════════════════

function formatDateStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function generateNewDiscussionId(uid: string): Promise<string> {
  const todayStamp = formatDateStamp(new Date());
  if (!uid) {
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
    onMessages(snapshot.docs.map(mapDocToMessage));
  }, error => {
    console.warn(`[subscribeDiscussionHistory] Listener fallback for discussion ${discussionId}:`, error);
  });
}

export async function getDiscussionHistory(discussionId: string): Promise<ScribeChatMessage[]> {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) return [];
  try {
    const messagesRef = collection(db, "users", uid, "discussions", discussionId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToMessage);
  } catch (err) {
    console.warn(`[getDiscussionHistory] Error fetching discussion history for ${discussionId}:`, err);
    return [];
  }
}

export async function appendDiscussionMessage(discussionId: string, message: ScribeChatMessage): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) return;

  const messagesRef = collection(db, "users", uid, "discussions", discussionId, "messages");
  const cleanMessage = JSON.parse(JSON.stringify(message));

  await addDoc(messagesRef, {
    ...cleanMessage,
    serverTimestamp: serverTimestamp(),
  });

  const discussionDocRef = doc(db, "users", uid, "discussions", discussionId);
  await setDoc(discussionDocRef, {
    id: discussionId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function saveDiscussionSummary(
  discussionId: string,
  summary: { title: string; synopsis: string }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!discussionId || !uid) return;

  const discussionDocRef = doc(db, "users", uid, "discussions", discussionId);
  await setDoc(discussionDocRef, {
    id: discussionId,
    title: summary.title,
    synopsis: summary.synopsis,
    summarizedAt: new Date().toISOString(),
  }, { merge: true });
}
