import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  FileText,
  Clock,
  Mic,
  MicOff,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useBoundChat, ChatContext } from '../hooks/useBoundChat';

interface BoundChatModalProps {
  context: ChatContext;
  activeContexts?: ChatContext[];
  onSelectContext?: (ctx: ChatContext) => void;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const BoundChatModal: React.FC<BoundChatModalProps> = ({
  context,
  activeContexts,
  onSelectContext,
  isOpen,
  onClose,
  title
}) => {
  const {
    messages,
    loading,
    sending,
    pendingUpdates,
    bannerNotice,
    sendMessage,
    applyUpdate,
    dismissUpdate
  } = useBoundChat(context);

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) return null;

  const handleSend = () => {
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle voice recognition if available
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  // Quick Chips
  const getQuickPrompts = () => {
    switch (context.type) {
      case 'case':
        return [
          'What are top 3 differentials?',
          'Suggest next diagnostic workup',
          'Check drug interactions',
          'Summarize case for HOD review'
        ];
      case 'handover':
        return [
          'Add MRI Brain & LP to pending actions',
          'Summarize patient story for shift rounds',
          'Update provisional diagnosis',
          'Review critical alerts'
        ];
      case 'discharge':
        return [
          'Verify discharge medications',
          'Suggest follow-up & warning signs',
          'Summarize hospital course',
          'Refine discharge instructions'
        ];
      case 'mortality_audit':
        return [
          'Deconstruct Cause of Death (Part I & II)',
          'Audit ACLS & resuscitation timeline',
          'Identify key clinical pearls & red flags',
          'Draft M&M case debrief'
        ];
      default:
        return ['Analyze patient record', 'Suggest next clinical steps'];
    }
  };

  const d = context.data || {};
  const patientDisplayName =
    d.patientLabel?.name ||
    d.patientInfo?.name ||
    d.patient?.name ||
    d.patientName ||
    d.name ||
    'Patient Record';

  const contextBadgeColors = {
    case: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
    handover: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    discharge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    mortality_audit: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    general: 'bg-slate-500/20 text-slate-300 border-slate-400/30'
  };

  const contextLabels = {
    case: 'Clinical Case Chat',
    handover: 'Handover Duty Chat',
    discharge: 'Discharge Summary Chat',
    mortality_audit: 'M&M Audit Chat',
    general: 'Clinical Chat'
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border font-mono ${contextBadgeColors[context.type]}`}>
                  {contextLabels[context.type]}
                </span>
                <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Bound Session
                </span>
              </div>
              <h3 className="text-base font-extrabold tracking-tight mt-0.5 text-white">
                {patientDisplayName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Case-Linked Discuss Tabs Strip */}
        {activeContexts && activeContexts.length > 1 && (
          <div className="bg-slate-900/90 border-b border-indigo-900/40 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
            <span className="text-[10px] font-extrabold text-indigo-300 font-mono uppercase tracking-wider shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Discuss Tabs:
            </span>
            {activeContexts.map((ctx, idx) => {
              const isCurrent = ctx.id === context.id && ctx.type === context.type;
              const name = ctx.data?.patientLabel?.name || ctx.data?.patient?.name || ctx.data?.name || `Case #${idx + 1}`;
              const bed = ctx.data?.patientLabel?.bed || ctx.data?.bedNo || null;
              return (
                <button
                  key={`${ctx.type}-${ctx.id}`}
                  onClick={() => onSelectContext?.(ctx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer border ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <span>👤 {name}</span>
                  {bed && <span className="text-[10px] opacity-75 font-mono">(Bed {bed})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Banner Notice */}
        {bannerNotice && (
          <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold font-mono flex items-center justify-between animate-fade-in">
            <span>{bannerNotice}</span>
          </div>
        )}

        {/* Pending Updates Banner */}
        {pendingUpdates && (
          <div className="p-3.5 bg-gradient-to-r from-indigo-900 to-indigo-950 border-b border-indigo-700/50 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-300 shrink-0">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-amber-300 font-mono block">
                  Suggested Record Update Detected
                </span>
                <p className="text-[11px] text-slate-200">
                  {Object.keys(pendingUpdates)
                    .map((k) => `${k}: "${String(pendingUpdates[k]).slice(0, 45)}..."`)
                    .join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => applyUpdate()}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply to Record</span>
              </button>
              <button
                type="button"
                onClick={dismissUpdate}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Chat Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-950/60">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-mono font-bold">Loading bound session history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bot className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
              <p className="text-xs">Start discussing this record with ErMate AI.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  {msg.suggestedUpdate && (
                    <div className="mt-3 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 font-mono uppercase">
                          💡 Update Proposed
                        </span>
                        <button
                          type="button"
                          onClick={() => applyUpdate(msg.suggestedUpdate!)}
                          className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-emerald-500"
                        >
                          <Check className="w-3 h-3" /> Apply
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto bg-white dark:bg-slate-900 p-1.5 rounded-md">
                        {JSON.stringify(msg.suggestedUpdate, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div
                    className={`text-[9px] font-mono mt-1 ${
                      msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 text-indigo-500 text-xs font-mono font-bold p-2 bg-indigo-50/50 dark:bg-slate-900/50 rounded-xl w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>ErMate AI is analyzing record context...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 shrink-0">
            Quick Prompts:
          </span>
          {getQuickPrompts().map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputText(prompt);
              }}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-lg shrink-0 transition-colors cursor-pointer whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about ${patientDisplayName}... (Shift+Enter for line break)`}
              rows={2}
              className="flex-1 bg-transparent border-0 focus:outline-none resize-none text-xs sm:text-sm text-slate-900 dark:text-white p-1"
            />

            <div className="flex items-center gap-1 shrink-0 pb-1">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title={isListening ? 'Stop listening' : 'Dictate message'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-1.5 px-1">
            <span className="text-[10px] text-slate-400 font-mono">
              Session auto-saved to Firestore `/chatSessions`
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ErMate Clinical Assistant
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
