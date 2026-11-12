import React, { useMemo } from "react";
import { AlertTriangle, ArrowLeft, Check, Mic } from "lucide-react";
import type { IcuAdmission, IcuExtraction, IcuNote } from "./icuTypes";
import { applyExtraction, buildIcuEmrSections, extractionCounts, noteGapSummary } from "./icuLogic";

/**
 * Full-screen "Preview ICU note" — the ICU version of the ER "Preview Case Sheet".
 * Shows exactly what the note will look like if the doctor taps Apply (current note + this dictation).
 * Nothing is written to Firestore here.
 */

interface Props {
  note: IcuNote;
  extraction: IcuExtraction;
  spokenText: string;
  admission: IcuAdmission;
  onApply: () => void;
  onDiscard: () => void;
  onAddMore: () => void;
}

export default function IcuScribePreview({ note, extraction, spokenText, admission, onApply, onDiscard, onAddMore }: Props) {
  const preview = useMemo(() => applyExtraction(note, extraction), [note, extraction]);
  const sections = useMemo(() => buildIcuEmrSections(preview, admission), [preview, admission]);
  const gaps = noteGapSummary(preview);
  const c = extractionCounts(extraction);
  const found = [
    c.problems && `${c.problems} problems`, c.vitals && `${c.vitals} vitals`, c.exam && `${c.exam} exam`,
    c.labs && `${c.labs} results`, c.plan && `${c.plan} plan items`, c.fastHugs && `${c.fastHugs} FAST HUGS`,
    c.tasks && `${c.tasks} tasks`, c.devices && `${c.devices} lines/tubes`,
  ].filter(Boolean) as string[];
  const nothing = found.length === 0 && c.flags === 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col" role="dialog" aria-modal="true" aria-label="Preview ICU note">
      <div className="bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-3">
        <div className="max-w-3xl mx-auto space-y-1">
          <button type="button" onClick={onDiscard} className="min-h-[40px] flex items-center gap-1 text-sm text-purple-700 dark:text-purple-300">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Preview ICU note</h2>
          <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">Not saved yet · {admission.unitName} · Bed {admission.bed}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-3 pb-32">
          <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-3 space-y-1">
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              {nothing ? "Nothing clinical was found in that dictation." : `Found: ${found.join(" · ")}`}
            </p>
            {extraction.attestedNormal && (
              <p className="text-xs text-purple-800 dark:text-purple-200">You attested a normal examination: respiratory, CVS, abdomen, renal and skin get normal findings (tagged). Neuro and lines are never auto-filled.</p>
            )}
            <details className="text-xs text-purple-900 dark:text-purple-200">
              <summary className="cursor-pointer">What you said</summary>
              <p className="mt-1 whitespace-pre-wrap">{spokenText}</p>
            </details>
          </div>

          {(gaps.openFlags > 0 || gaps.fastHugsGaps > 0) && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Check before signing
              </p>
              {gaps.openFlags > 0 && <p className="text-xs text-amber-900 dark:text-amber-200">{gaps.openFlags} orders need clarification (shown as [CLARIFY] below). The text is kept exactly as you said it.</p>}
              {gaps.fastHugsGaps > 0 && <p className="text-xs text-amber-900 dark:text-amber-200">{gaps.fastHugsGaps} FAST HUGS items not reviewed. They are never filled automatically.</p>}
            </div>
          )}

          {sections.map((sec) => (
            <div key={sec.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{sec.title}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{sec.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-0 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button type="button" onClick={onDiscard}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">Discard</button>
          <button type="button" onClick={onAddMore}
            className="min-h-[48px] px-4 rounded-xl border border-purple-200 dark:border-purple-800 text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-1.5">
            <Mic className="w-4 h-4" aria-hidden="true" /> Add more
          </button>
          <button type="button" onClick={onApply} disabled={nothing}
            className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" aria-hidden="true" /> Apply to note
          </button>
        </div>
      </div>
    </div>
  );
}