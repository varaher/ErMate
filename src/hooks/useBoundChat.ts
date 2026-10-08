import { useState, useEffect } from 'react';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { authenticatedFetch, AuthRequiredError } from '../services/authenticatedFetch';
import { getDisplayCaseId } from '../utils/caseIdentity';

export interface ChatContext {
  type: 'case' | 'handover' | 'discharge' | 'mortality_audit' | 'reference' | 'general' | 'rounds';
  id: string; // parent record ID or user reference ID
  data: Record<string, any>; // full record data or reference state
  pendingClinicalContext?: Record<string, any>; // unapplied Scribe extraction for same case
  canEdit?: boolean; // can update parent?
  onRecordUpdated?: (updatedData: Record<string, any>) => void;
  initialMode?: 'discuss' | 'rounds';
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedUpdate?: Record<string, any> | null;
  usedLenses?: string[];
}

export function useBoundChat(context: ChatContext, initialModeOverride?: 'discuss' | 'rounds') {
  const [chatMode, setChatMode] = useState<'discuss' | 'rounds'>(
    initialModeOverride || context.initialMode || (context.type === 'rounds' ? 'rounds' : 'discuss')
  );

  useEffect(() => {
    const desired = initialModeOverride || context.initialMode;
    if (desired && (desired === 'discuss' || desired === 'rounds') && desired !== chatMode) {
      setChatMode(desired);
    }
  }, [initialModeOverride, context.initialMode]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any> | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const getStorageKey = (mode: 'discuss' | 'rounds') => {
    if (context.type === 'case') {
      return mode === 'rounds'
        ? `ermate_chat_session_rounds_${context.id}`
        : `ermate_chat_session_case_${context.id}`;
    }
    return `ermate_chat_session_${context.type}_${context.id}`;
  };

  useEffect(() => {
    if (!context.id) {
      setLoading(false);
      return;
    }
    loadOrCreateSession(chatMode);
  }, [context.id, context.type, chatMode]);

  const loadOrCreateSession = async (mode: 'discuss' | 'rounds') => {
    setLoading(true);
    const currentUserUid = auth.currentUser?.uid || 'guest_user';
    const storageKey = getStorageKey(mode);

    try {
      // LocalStorage check first for immediate responsiveness
      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setSessionId(parsed.id || `local_${Date.now()}`);
            setMessages(parsed.messages);
            setPendingUpdates(parsed.pendingUpdates || null);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[BoundChat] Local parse error:', e);
        }
      }

      if (db) {
        const q = query(
          collection(db, 'chatSessions'),
          where('contextId', '==', context.id)
        );

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
        const snap = await Promise.race([getDocs(q), timeoutPromise]).catch((e) => {
          console.warn('[BoundChat] Firestore query fallback or timeout:', e);
          return null;
        });

        if (snap && !(snap as any).empty) {
          const expectedContextType = mode === 'rounds' ? 'rounds' : context.type;
          const validDocs = (snap as any).docs
            .filter(d => d.data().createdBy === currentUserUid && (d.data().contextType === expectedContextType || d.data().chatMode === mode))
            .sort((a, b) => {
              const timeA = a.data().lastMessageAt?.toMillis?.() || new Date(a.data().createdAt || 0).getTime();
              const timeB = b.data().lastMessageAt?.toMillis?.() || new Date(b.data().createdAt || 0).getTime();
              return timeB - timeA;
            });

          if (validDocs.length > 0) {
            const sessionDoc = validDocs[0];
            setSessionId(sessionDoc.id);
            const data = sessionDoc.data();
            setMessages(data.messages || []);
            if (data.pendingUpdates) {
              setPendingUpdates(data.pendingUpdates);
            }
            setLoading(false);
            return;
          }
        }
      }

      // Create new session with concise opening message (Section P)
      const welcomeMsg = buildWelcomeMessage(context, mode);
      const newSessionData = {
        contextType: mode === 'rounds' ? 'rounds' : context.type,
        chatMode: mode,
        contextId: context.id,
        contextRef: `${context.type}s/${context.id}`,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        createdBy: currentUserUid,
        messages: [welcomeMsg],
        pendingUpdates: null,
      };

      let newDocId = `session_${Date.now()}`;
      if (db) {
        try {
          const docRef = doc(collection(db, 'chatSessions'));
          newDocId = docRef.id;
          setDoc(docRef, {
            ...newSessionData,
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          }).catch(err => {
            console.warn('[BoundChat] Firestore session creation fallback:', err);
          });
        } catch (err) {
          console.warn('[BoundChat] Firestore session creation fallback:', err);
        }
      }

      setSessionId(newDocId);
      setMessages([welcomeMsg]);
      localStorage.setItem(
        storageKey,
        JSON.stringify({ id: newDocId, messages: [welcomeMsg] })
      );
    } catch (err) {
      console.error('[BoundChat] Initialization error:', err);
      const welcomeMsg = buildWelcomeMessage(context, mode);
      setMessages([welcomeMsg]);
      setSessionId(`fallback_${Date.now()}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    setSending(true);
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const storageKey = getStorageKey(chatMode);

    try {
      let assistantContent = "";
      let suggestedUpdate = null;
      let usedLenses: string[] = [];

      if (chatMode === 'rounds') {
        // ROUNDS MODE: route to /api/rounds-debrief with 7-lens synthesis
        const response = await authenticatedFetch('/api/rounds-debrief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            caseData: context.data,
            userMessage: userText,
            message: userText,
            lens: 'auto',
            pendingClinicalContext: context.pendingClinicalContext || undefined,
            chatHistory: messages,
            messages: updatedMessages.map(m => ({ sender: m.role, text: m.content }))
          })
        });
        clearTimeout(timeoutId);

        const data = await response.json().catch(() => ({}));
        assistantContent = data.response || data.reply || data.data?.content || (response.ok
          ? "Rounds debrief generated based on clinical case facts."
          : "I couldn't complete that response right now. Please try again.");
        usedLenses = Array.isArray(data.usedLenses)
          ? data.usedLenses
          : (Array.isArray(data.data?.usedLenses) ? data.data.usedLenses : []);
      } else {
        // DISCUSS MODE: route to /api/case-discussion for practical action-oriented conversation
        const response = await authenticatedFetch('/api/case-discussion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: userText,
            contextType: context.type,
            contextData: context.data,
            caseData: context.data,
            pendingClinicalContext: context.pendingClinicalContext || undefined,
            history: messages,
            messages: updatedMessages.map((m) => ({
              sender: m.role === 'user' ? 'user' : 'ai',
              text: m.content,
            })),
          }),
        });
        clearTimeout(timeoutId);

        const data = await response.json().catch(() => ({}));
        assistantContent = data.response || data.reply || (response.ok 
          ? "I have analyzed the request based on this record's clinical context."
          : "I couldn't complete that response right now. Please try again.");
        suggestedUpdate = data.suggestedUpdate || null;
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        suggestedUpdate: suggestedUpdate,
        usedLenses: usedLenses.length > 0 ? usedLenses : undefined
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      if (suggestedUpdate) {
        setPendingUpdates(suggestedUpdate);
      }

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          id: sessionId,
          messages: finalMessages,
          pendingUpdates: suggestedUpdate,
        })
      );

      if (db && sessionId && !sessionId.startsWith('local_') && !sessionId.startsWith('fallback_')) {
        try {
          updateDoc(doc(db, 'chatSessions', sessionId), {
            messages: finalMessages,
            lastMessageAt: serverTimestamp(),
            pendingUpdates: suggestedUpdate || null,
          }).catch(e => console.warn('[BoundChat] Firestore update doc promise rejection:', e));
        } catch (e) {
          console.warn('[BoundChat] Firestore update error:', e);
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[BoundChat] Send message error:', err);
      const isAuthErr = err instanceof AuthRequiredError;
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: isAuthErr
          ? 'Your session needs to be refreshed. Please sign in again.'
          : "I couldn't complete that response right now. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const applyUpdate = async (overrideUpdate?: Record<string, any>) => {
    const updatePayload = overrideUpdate || pendingUpdates;
    if (!updatePayload || !context.id) return;

    try {
      let collectionName = `${context.type}s`;
      if (context.type === 'handover') collectionName = 'handovers';
      if (context.type === 'mortality_audit') collectionName = 'mortalityAudits';
      if (context.type === 'discharge') collectionName = 'dischargeSummaries';

      if (db) {
        const parentRef = doc(db, collectionName, context.id);
        updateDoc(parentRef, {
          ...updatePayload,
          lastUpdatedFromChat: serverTimestamp(),
          lastUpdatedBy: auth.currentUser?.uid || 'chat_assistant',
        }).catch((e) => console.warn('[BoundChat] Parent doc update warning:', e));
      }

      if (context.onRecordUpdated) {
        context.onRecordUpdated(updatePayload);
      }

      setPendingUpdates(null);
      setBannerNotice('✓ Record updated successfully from discussion!');
      setTimeout(() => setBannerNotice(null), 4000);

      if (db && sessionId && !sessionId.startsWith('local_')) {
        updateDoc(doc(db, 'chatSessions', sessionId), {
          pendingUpdates: null,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[BoundChat] applyUpdate error:', err);
      setBannerNotice('Failed to apply update to record.');
    }
  };

  const dismissUpdate = () => {
    setPendingUpdates(null);
  };

  return {
    sessionId,
    messages,
    loading,
    sending,
    pendingUpdates,
    bannerNotice,
    sendMessage,
    applyUpdate,
    dismissUpdate,
    chatMode,
    setChatMode,
  };
}

function buildWelcomeMessage(context: ChatContext, mode: 'discuss' | 'rounds' = 'discuss'): ChatMessage {
  const d = context.data || {};

  let welcomeText = '';

  switch (context.type) {
    case 'case': {
      if (mode === 'rounds') {
        welcomeText = "Let's learn from this case. Ask anything, prepare for rounds, or say 'Quiz me'.";
      } else {
        welcomeText = "Ready to discuss this patient. What would you like to focus on?";
      }
      break;
    }

    case 'rounds': {
      welcomeText = "Let's learn from this case. Ask anything, prepare for rounds, or say 'Quiz me'.";
      break;
    }

    case 'handover':
      welcomeText = `Discussing Handover for: **${d.patientLabel?.name || d.name || 'Patient'}** (Bed ${d.patientLabel?.bed || 'N/A'})

Diagnosis: ${d.diagnosis || d.presentingComplaint || 'Under evaluation'}
Status: **${(d.patientLabel?.status || 'unstable').toUpperCase()}**

Ask about management, pending actions, or ask me to update this patient's handover card (e.g. "Add MRI Brain to pending actions").`;
      break;

    case 'discharge':
      welcomeText = `Discussing Discharge Summary: **${d.patientInfo?.name || d.patientName || 'Patient'}**

Admitted: ${d.patientInfo?.dateAdmission || 'N/A'} | Discharged: ${d.patientInfo?.dateDischarge || 'N/A'}
Primary Diagnosis: ${d.diagnosisAtDischarge?.[0] || d.diagnosis || 'N/A'}

Ask about clinical course, medication reconciliation, discharge instructions, or request summary adjustments.`;
      break;

    case 'mortality_audit':
      welcomeText = `M&M Confidential Review: **${d.patientInfo?.name || d.patientName || 'Deceased Patient'}**

Date of Death: ${d.patientInfo?.dateDeath || d.dateDeath || 'N/A'}
Primary Cause: ${d.causeOfDeath?.underlying || d.causeOfDeath || 'Under audit'}

Ask questions regarding physiological timeline, ACLS/resuscitation audit, antecedent causes, or clinical pearls for rounds.`;
      break;

    case 'reference':
      welcomeText = `📚 **ErMate EM Reference** — Evidence-Based Emergency Medicine Handbook

Ask any clinical, pharmacological, or procedural emergency question (e.g., *"How do I use Ketofol in AF?"*, *"RSI drug doses paediatric"*). 

Responses are generated directly using ErMate, cited with Tintinalli's, Rosen's, UpToDate, and WikEM guidelines.`;
      break;

    default:
      welcomeText = `Clinical Discussion Session active. Ask any question regarding this record.`;
  }

  return {
    role: 'assistant',
    content: welcomeText,
    timestamp: new Date().toISOString(),
  };
}
