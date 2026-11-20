import React from "react";
import { MATE_MODES, MODE_HINT, MateMode } from "../mate/mateModes";

interface Props {
  mode: MateMode;
  onChange: (mode: MateMode) => void;
  disabled?: boolean;
}

/** One-tap mode chips above the MATE message box. A new window always starts in Dictate. */
export default function MateModeBar({ mode, onChange, disabled }: Props) {
  return (
    <div className="mb-1.5" data-testid="mate-mode-bar">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="MATE mode">
        {MATE_MODES.map((m) => {
          const on = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-pressed={on}
              disabled={disabled}
              data-testid={`mate-mode-${m.id}`}
              onClick={() => onChange(m.id)}
              className={`shrink-0 min-h-[32px] px-3 rounded-full border text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                on
                  ? m.id === "dictate"
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {MODE_HINT[mode] && (
        <p data-testid="mate-mode-hint" className="px-1 text-[11px] text-slate-500 dark:text-slate-400">{MODE_HINT[mode]}</p>
      )}
    </div>
  );
}