import React from "react";
import { chatLimitLevel } from "../mate/chatLimit";

interface Props {
  usage: number;
  showBedNote: boolean;
  onContinue: () => void;
  disabled?: boolean;
}

/** Notes shown just above the MATE message box: chat-length strip and the always-on bed-number reminder. */
export default function MateComposerNotes({ usage, showBedNote, onContinue, disabled }: Props) {
  const level = chatLimitLevel(usage);
  const pct = Math.min(100, Math.round(usage * 100));
  return (
    <div className="space-y-1.5 mb-1.5" data-testid="mate-composer-notes">
      {level !== "ok" && (
        <div
          role="status"
          data-testid="mate-chat-limit"
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] ${
            level === "full"
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          <span className="flex-1 min-w-0">
            {level === "full"
              ? `This chat is ${pct}% full. Please open the next window to continue.`
              : `This chat is getting long (${pct}% used).`}
          </span>
          <button
            type="button"
            onClick={onContinue}
            disabled={disabled}
            data-testid="mate-chat-continue"
            className={`shrink-0 min-h-[32px] px-3 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
              level === "full" ? "bg-amber-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600"
            }`}
          >
            Open next window
          </button>
        </div>
      )}
      {showBedNote && (
        <p data-testid="mate-bed-note" className="px-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-700 dark:text-slate-200">Say the bed number first</span>, or along with your dictation (e.g. “Bed 4, 60-year-old male…”). It keeps each patient on the right bed.
        </p>
      )}
    </div>
  );
}