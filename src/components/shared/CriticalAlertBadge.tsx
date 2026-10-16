import React, { useState } from "react";
import type { CriticalAlert } from "../../utils/criticalAlerts";

/**
 * Pulsing red dot + small popup listing the critical values. Display only.
 * Not a substitute for bedside monitoring; absence of a dot means "nothing critical recorded".
 */
export function CriticalAlertBadge({ alerts }: { alerts: CriticalAlert[] }) {
  const [open, setOpen] = useState(false);
  if (!alerts || alerts.length === 0) return null;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={`${alerts.length} critical value${alerts.length > 1 ? "s" : ""}`}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        Critical
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full mt-1.5 z-30 w-60 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-xl p-2.5 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1.5">Critical values on case sheet</p>
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.key} className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold">{a.label}</span> — {a.display}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[9px] text-slate-500 dark:text-slate-400 leading-snug">
            Decision support only. Check the patient. No alert does not mean the patient is safe.
          </p>
        </div>
      )}
    </span>
  );
}

export default CriticalAlertBadge;
