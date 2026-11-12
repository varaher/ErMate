import React, { useEffect, useState } from "react";
import { Mic, PenLine, ClipboardPaste, ChevronRight, X, Sparkles, Eye, FileCheck2 } from "lucide-react";
import VoiceRecorder from "../components/shared/VoiceRecorder";

/**
 * ICU entry choice — same pattern as the ER "New Patient" menu.
 *  - Speak the case (primary): dictate as many times as needed, words collect in the box, then Organise.
 *  - Type it in: closes the sheet and leaves the doctor in the note's manual form.
 *  - Paste a note: same box, no mic, for a note written elsewhere (e.g. hospital EMR or WhatsApp).
 * Nothing is saved here. "Organise into note" sends the text to the ICU scribe, and the result opens
 * as a full preview that the doctor must Apply.
 */

export type IcuEntryMode = "choose" | "speak" | "paste";

interface Props {
  bedLabel: string; // e.g. "MICU 1 · Bed 4"
  initialMode?: IcuEntryMode;
  initialText?: string;
  busy: boolean;
  onSubmitText: (text: string) => void;
  onManual: () => void;
  onClose: () => void;
  onVoiceError: (message: string) => void;
}

const STEPS = [
  { icon: Mic, title: "1. Speak naturally", body: "Any order, English or Malayalam. Problems, vitals, exam, plan, FAST HUGS — all in one go." },
  { icon: Eye, title: "2. Review the preview", body: "See the full ICU note before anything is saved. Unclear orders are flagged, gaps stay “Not documented”." },
  { icon: FileCheck2, title: "3. Apply, sign, copy", body: "Apply to the note, fix anything, sign, then Copy to EMR — whole note or section by section." },
];

export default function IcuEntryChoice({
  bedLabel, initialMode = "choose", initialText = "", busy, onSubmitText, onManual, onClose, onVoiceError,
}: Props) {
  const [mode, setMode] = useState<IcuEntryMode>(initialMode);
  const [text, setText] = useState(initialText);
  const [recording, setRecording] = useState(false);

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { setText(initialText); }, [initialText]);

  const addTranscript = (t: string) => {
    const clean = t.trim();
    if (!clean) return;
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${clean}` : clean));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center"
      role="dialog" aria-modal="true" aria-label={`Start ICU note for ${bedLabel}`}>
      <div className="w-full md:max-w-lg bg-white dark:bg-slate-950 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 md:hidden" />

        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {mode === "choose" ? "ICU note" : mode === "speak" ? "Speak the case" : "Paste a note"}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">{bedLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {mode === "choose" && (
          <>
            <button type="button" onClick={() => setMode("speak")}
              className="w-full flex items-center gap-4 bg-purple-50 hover:bg-purple-100/80 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 border border-purple-200 dark:border-purple-700 rounded-2xl px-4 py-4 mt-4 text-left">
              <span className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0">
                <Mic className="text-white" size={22} aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block text-purple-950 dark:text-white font-extrabold text-base">Speak the case</span>
                <span className="block text-purple-900/80 dark:text-slate-400 text-xs sm:text-sm mt-0.5">Dictate naturally — ErMate writes the ICU note for you to review.</span>
              </span>
              <ChevronRight className="text-purple-600 dark:text-purple-400 shrink-0" size={20} aria-hidden="true" />
            </button>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl mt-3 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
              <Row icon={<PenLine size={18} />} title="Prefer to type it in?" subtitle="Manual form — problems, exam, FAST HUGS, plan" onClick={onManual} />
              <Row icon={<ClipboardPaste size={18} />} title="Paste a note" subtitle="From the hospital EMR, WhatsApp or a document" onClick={() => setMode("paste")} />
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" /> How it works
              </p>
              {STEPS.map((s) => (
                <div key={s.title} className="flex gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                  <s.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {mode !== "choose" && (
          <div className="mt-4 space-y-3">
            {mode === "speak" && (
              <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 flex flex-col items-center gap-2">
                <VoiceRecorder
                  renderMode="compact-button"
                  disabled={busy}
                  buttonLabel={recording ? "Stop" : text.trim() ? "Speak more" : "Tap to speak"}
                  onRecordingStateChange={setRecording}
                  onTranscript={addTranscript}
                  onError={onVoiceError}
                />
                <p className="text-xs text-purple-900 dark:text-purple-200 text-center">
                  {recording ? "Listening… tap Stop when you finish." : "Speak in any order. You can record several times — the words collect below."}
                </p>
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {mode === "speak" ? "What you said (you can edit)" : "Paste the note"}
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={mode === "paste" ? 12 : 7}
                placeholder={mode === "speak"
                  ? "Your dictation appears here."
                  : "Paste a full ICU note. ErMate sorts it into problems, progress, exam, plan, FAST HUGS, tasks and lines."}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
              />
            </label>

            <button type="button" disabled={!text.trim() || busy || recording} onClick={() => onSubmitText(text)}
              className="w-full min-h-[48px] rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? "Organising…" : "Organise into note"}
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Nothing is saved until you review the preview and tap Apply.</p>
            <button type="button" onClick={() => setMode("choose")} className="w-full min-h-[40px] text-xs text-slate-600 dark:text-slate-400">
              Back to options
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-600 dark:text-slate-400">{subtitle}</span>
      </span>
      <ChevronRight className="text-slate-400 shrink-0" size={18} aria-hidden="true" />
    </button>
  );
}