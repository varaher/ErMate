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

export interface ChatContext {
  type: 'case' | 'handover' | 'discharge' | 'mortality_audit' | 'reference' | 'general';
  id: string; // parent record ID or user reference ID
  data: Record<string, any>; // full record data or reference state
  canEdit?: boolean; // can update parent?
  onRecordUpdated?: (updatedData: Record<string, any>) => void;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedUpdate?: Record<string, any> | null;
}

export function useBoundChat(context: ChatContext) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any> | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!context.id) {
      setLoading(false);
      return;
    }
    loadOrCreateSession();
  }, [context.id, context.type]);

  const loadOrCreateSession = async () => {
    setLoading(true);
    const currentUserUid = auth.currentUser?.uid || 'guest_user';

    try {
      if (db) {
        // Simplified query to bypass Firestore composite index requirements
        const q = query(
          collection(db, 'chatSessions'),
          where('contextId', '==', context.id)
        );

        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        const snap = await Promise.race([getDocs(q), timeoutPromise]).catch((e) => {
          console.warn('[BoundChat] Firestore query fallback or timeout:', e);
          return null;
        });

        if (snap && !(snap as any).empty) {
          // Filter and sort client-side to avoid needing a composite index
          const validDocs = (snap as any).docs
            .filter(d => d.data().createdBy === currentUserUid && d.data().contextType === context.type)
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

      // LocalStorage fallback
      const localKey = `ermate_chat_session_${context.type}_${context.id}`;
      const savedLocal = localStorage.getItem(localKey);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed && Array.isArray(parsed.messages)) {
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

      // Create new session
      const welcomeMsg = buildWelcomeMessage(context);
      const newSessionData = {
        contextType: context.type,
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
        `ermate_chat_session_${context.type}_${context.id}`,
        JSON.stringify({ id: newDocId, messages: [welcomeMsg] })
      );

// Trigger automatic AI summary generation asynchronously
      setTimeout(async () => {
        try {
          const summaryPrompt = "Please provide a concise clinical summary of this case based on the provided record, and then ask me what I would like to focus on or what follow-up queries I have.";
          setSending(true);
          const response = await fetch('/api/case-discussion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: summaryPrompt,
              contextType: context.type,
              contextData: context.data,
              caseData: context.data,
              history: [],
              messages: [{ sender: 'user', text: summaryPrompt }]
            }),
          });
          const data = await response.json();
          const assistantContent = data.response || "Summary unavailable.";
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
          };
          
          setMessages(prev => {
            const newMsgs = [...prev, assistantMsg];
            // Save local
            localStorage.setItem(
              `ermate_chat_session_${context.type}_${context.id}`,
              JSON.stringify({ id: newDocId, messages: newMsgs })
            );
            return newMsgs;
          });
          
          if (db && newDocId) {
             updateDoc(doc(db, 'chatSessions', newDocId), {
                messages: [welcomeMsg, assistantMsg],
                lastMessageAt: serverTimestamp()
             }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to auto-generate summary', e);
        } finally {
          setSending(false);
        }
      }, 500);
    } catch (err) {
      console.error('[BoundChat] Initialization error:', err);
      const welcomeMsg = buildWelcomeMessage(context);
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

    try {
      const response = await fetch('/api/case-discussion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          contextType: context.type,
          contextData: context.data,
          caseData: context.data,
          history: messages,
          messages: updatedMessages.map((m) => ({
            sender: m.role === 'user' ? 'user' : 'ai',
            text: m.content,
          })),
        }),
      });

      const data = await response.json();

      const assistantContent = data.response || "I have analyzed the request based on this record's clinical context.";
      const suggestedUpdate = data.suggestedUpdate || null;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        suggestedUpdate: suggestedUpdate,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      if (suggestedUpdate) {
        setPendingUpdates(suggestedUpdate);
      }

      localStorage.setItem(
        `ermate_chat_session_${context.type}_${context.id}`,
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
    } catch (err) {
      console.error('[BoundChat] Send message error:', err);
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: '⚠️ Clinical assistant is temporarily unavailable. Please try again in a moment.',
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
  };
}

function buildWelcomeMessage(context: ChatContext): ChatMessage {
  const d = context.data || {};

  let welcomeText = '';

  switch (context.type) {
    case 'case':
      welcomeText = `Discussing Active Case: **${d.patient?.name || d.patientName || 'Patient'}**

${d.dischargeInfo?.primaryDiagnosis || d.provisionalPrimaryDiagnosis || d.diagnosis ? `Working Diagnosis: ${d.dischargeInfo?.primaryDiagnosis || d.provisionalPrimaryDiagnosis || d.diagnosis}` : `Chief Complaint: ${d.patient?.presentingComplaint || d.chiefComplaint || 'Emergency evaluation'}`}

Ask me anything about this case — differentials, management questions, investigation interpretations, or request updates to the case sheet.`;
      break;

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
