import React, { useState } from "react";
import { LEGAL_LINKS, TERMS_VERSION } from "../lib/legal";

/**
 * Shown after sign-in when the account has not accepted the current Terms and Privacy Policy
 * (Google sign-in accounts, accounts created before the policy, and after TERMS_VERSION changes).
 * The doctor must tick the box to continue. Declining signs them out.
 */
export default function TermsGate({
  onAccept, onDecline, busy,
}: {
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title" data-testid="terms-gate">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4">
        <h2 id="terms-gate-title" className="text-lg font-extrabold text-slate-900 dark:text-white">Before you continue</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Please read how ErMate handles your data. Version {TERMS_VERSION}.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 dark:text-emerald-400">{l.label}</a>
          ))}
        </nav>
        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            data-testid="terms-gate-check"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span>I have read and accept the Terms of Use and the Privacy Policy.</span>
        </label>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            data-testid="terms-gate-accept"
            disabled={!checked || busy}
            onClick={onAccept}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm py-2.5"
          >
            Accept and continue
          </button>
          <button
            type="button"
            data-testid="terms-gate-decline"
            disabled={busy}
            onClick={onDecline}
            className="rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm px-4 py-2.5"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}