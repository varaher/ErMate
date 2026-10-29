import React from "react";
import { Lock, Clock, X } from "lucide-react";
import { AccessResult, LOCKED_TITLE, LOCKED_BODY } from "../lib/access";

/** Slim strip on Home: trial countdown, grace warning, or locked notice. Renders nothing when there is nothing to say. */
export function AccessBanner({ access, onActivate }: { access: AccessResult; onActivate: () => void }) {
  if (!access.message) return null;
  const locked = access.state === "locked";
  const tone = locked
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
    : "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200";
  const Icon = locked ? Lock : Clock;
  return (
    <div role="status" data-coach="plan-banner" className={`mx-3 mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{access.message}</span>
      {access.state !== "paid" && (
        <button
          type="button"
          onClick={onActivate}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
        >
          {locked ? "Activate" : "View plans"}
        </button>
      )}
    </div>
  );
}

/** Shown when a locked doctor tries to start a new case or log book entry. */
export function PaywallModal({ open, onClose, onActivate }: { open: boolean; onClose: () => void; onActivate: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={LOCKED_TITLE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">
              <Lock className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{LOCKED_TITLE}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{LOCKED_BODY}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onActivate} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
            Activate plan
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}