import React, { useEffect, useState } from "react";
import { Sparkles, Clock, X, Check } from "lucide-react";
import { AccessResult, ProFeature, PRO_FEATURES, PRO_TITLE, PRO_STARTER_LINE, PRO_INCLUDES, FREE_INCLUDES } from "../lib/access";
import { onProUpgradeRequest } from "../lib/entitlements";

/** Slim strip on Home: trial countdown, grace warning, or the ErMate Free notice. Renders nothing when there is nothing to say. */
export function AccessBanner({ access, onActivate }: { access: AccessResult; onActivate: () => void }) {
  if (!access.message) return null;
  const free = access.state === "free";
  const tone = free
    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
    : "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200";
  const Icon = free ? Sparkles : Clock;
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
          {free ? "Get Pro" : "View plans"}
        </button>
      )}
    </div>
  );
}

/**
 * The ONE Pro upgrade sheet. `feature` names what the doctor tapped (omit for a general upgrade prompt).
 * Exported as PaywallModal too, so older call sites keep working.
 */
export function ProUpgradeSheet({ open, feature, onClose, onActivate }: { open: boolean; feature?: ProFeature | null; onClose: () => void; onActivate: () => void }) {
  if (!open) return null;
  const what = feature ? PRO_FEATURES[feature] : null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={PRO_TITLE} data-testid="pro-upgrade-sheet">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{PRO_TITLE}</h2>
              {what && <p className="text-xs text-slate-500 dark:text-slate-400">{what} is part of ErMate Pro.</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {PRO_INCLUDES.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />{x}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-xs leading-relaxed text-purple-900 dark:bg-purple-950/40 dark:text-purple-200">{PRO_STARTER_LINE}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onActivate} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
            See Pro plans
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Continue with Free
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">Free forever: {FREE_INCLUDES.join(" · ")}.</p>
      </div>
    </div>
  );
}

/** Kept name for older imports (App.tsx). With manual documentation free, it now shows the Pro sheet. */
export const PaywallModal = ({ open, onClose, onActivate }: { open: boolean; onClose: () => void; onActivate: () => void }) => (
  <ProUpgradeSheet open={open} onClose={onClose} onActivate={onActivate} />
);

/** Mounted once in App: listens for requestProUpgrade(feature) from any screen. */
export function ProUpgradeHost({ onPlans }: { onPlans: () => void }) {
  const [feature, setFeature] = useState<ProFeature | null>(null);
  useEffect(() => onProUpgradeRequest((f) => setFeature(f)), []);
  return <ProUpgradeSheet open={feature !== null} feature={feature} onClose={() => setFeature(null)} onActivate={() => { setFeature(null); onPlans(); }} />;
}

/** Inline card shown in place of a Pro screen (ER Guide tab, Analytics, Learn tab). */
export function ProLockedCard({ feature, onUpgrade }: { feature: ProFeature; onUpgrade: () => void }) {
  return (
    <div className="m-4 rounded-2xl border border-purple-200 bg-white p-5 text-center dark:border-purple-900/50 dark:bg-slate-900" data-testid="pro-locked-card">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200"><Sparkles className="h-5 w-5" /></span>
      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{PRO_FEATURES[feature]} is part of ErMate Pro</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manual case sheets, discharge summaries and your log book stay free.</p>
      <button type="button" onClick={onUpgrade} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Unlock Pro</button>
    </div>
  );
}

/** One-time pop-up at 14, 7, 3, 1 days left and when the trial ends. */
export function TrialReminderModal({ open, title, big, body, onLater, onPlans }: { open: boolean; title: string; big: string; body: string; onLater: () => void; onPlans: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-3xl font-bold text-purple-700 dark:text-purple-300">{big}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onLater} className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Remind me later</button>
          <button type="button" onClick={onPlans} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">See plans</button>
        </div>
      </div>
    </div>
  );
}