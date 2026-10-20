import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { PLAN_PRICING, CREDIT_COSTS, rupees, type CreditAction } from "../lib/pricing";
import { creditLevel, planStatus, CREDIT_USE_LABELS } from "../lib/creditDisplay";

export interface CreditsProfileFields {
  aiCredits?: number;
  subscriptionTier?: string;
  tierExpiresAt?: string;
}

interface Props {
  profile: CreditsProfileFields | null;
  coveredByTeam: boolean;
  teamName?: string;
  /** Called when a fresh balance is read after a payment, so the rest of the app updates. */
  onProfileRefreshed?: (fields: CreditsProfileFields) => void;
}

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function CreditsPlanCard({ profile, coveredByTeam, teamName, onProfileRefreshed }: Props) {
  const [live, setLive] = useState<CreditsProfileFields | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const view: CreditsProfileFields = { ...(profile || {}), ...(live || {}) };
  const level = creditLevel(view.aiCredits);
  const plan = planStatus(view.subscriptionTier, view.tierExpiresAt);

  const readFresh = async (): Promise<CreditsProfileFields | null> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const d: any = snap.data();
    return { aiCredits: d.aiCredits, subscriptionTier: d.subscriptionTier, tierExpiresAt: d.tierExpiresAt };
  };

  const refreshNow = async () => {
    try {
      const f = await readFresh();
      if (f) { setLive(f); onProfileRefreshed?.(f); setNote("Balance updated."); }
    } catch { setNote("Could not refresh. Check your connection."); }
  };

  // After checkout closes, look for the server-granted credits for up to ~70 seconds.
  const pollAfterPayment = (before: CreditsProfileFields) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setNote("Payment received. Confirming with Razorpay...");
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries++;
      try {
        const f = await readFresh();
        const grew = f && ((Number(f.aiCredits) || 0) > (Number(before.aiCredits) || 0) || f.tierExpiresAt !== before.tierExpiresAt);
        if (f && grew) {
          setLive(f); onProfileRefreshed?.(f);
          setNote("Credits added. Thank you.");
          if (pollRef.current) window.clearInterval(pollRef.current);
          return;
        }
      } catch { /* keep trying */ }
      if (tries >= 18) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setNote("Still confirming. Your payment is safe; credits appear as soon as Razorpay confirms. Tap Refresh in a minute.");
      }
    }, 4000);
  };

  const startCheckout = async (planKey: string) => {
    if (busyKey) return;
    setBusyKey(planKey);
    setNote("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ planKey }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not start payment.");
      }
      const order = await orderRes.json();
      if (!(await loadRazorpayScript())) throw new Error("Could not load Razorpay checkout.");
      const before = { ...view };
      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "ErMate",
        description: PLAN_PRICING[planKey]?.label || "ErMate",
        // The browser callback never grants anything. Credits are added by the server once Razorpay confirms.
        handler: () => pollAfterPayment(before),
        modal: { ondismiss: () => setBusyKey(null) },
        theme: { color: "#059669" },
      });
      rzp.open();
    } catch (err: any) {
      console.error("Checkout failed:", err);
      setNote(err?.message || "Payment could not be started.");
    } finally {
      setTimeout(() => setBusyKey(null), 1500);
    }
  };

  if (coveredByTeam) {
    return (
      <div data-testid="credits-plan-card" className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-xs space-y-1">
        <strong className="text-emerald-700 dark:text-emerald-400 block">Covered by your hospital team plan</strong>
        <p className="text-slate-600 dark:text-slate-300">{teamName ? `${teamName} covers your AI features.` : "Your team covers your AI features."} No credits needed.</p>
      </div>
    );
  }

  const levelStyle =
    level === "empty" ? "text-rose-600 dark:text-rose-400"
    : level === "low" ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div data-testid="credits-plan-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">AI credits</span>
          <strong data-testid="credits-balance" className={`text-2xl font-black ${levelStyle}`}>
            {typeof view.aiCredits === "number" ? view.aiCredits : "—"}
          </strong>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase text-slate-400 block">Plan</span>
          <strong className="text-sm font-bold text-slate-900 dark:text-white block">{plan.label}</strong>
          {plan.validTill && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              {plan.active ? `valid till ${plan.validTill}` : `ended ${plan.validTill}`}
            </span>
          )}
        </div>
      </div>

      {level === "empty" && (
        <div data-testid="credits-empty-notice" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
          AI credits finished. Manual entry, saving and printing still work. Recharge below to use AI again.
        </div>
      )}
      {level === "low" && (
        <div data-testid="credits-low-notice" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
          Running low. Recharge below to keep using AI features.
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Case sheet, saving, viewing, triage and printing are always free. Credits are used only when an AI action succeeds.
      </p>

      <details className="text-[11px] text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer select-none font-semibold">What uses credits</summary>
        <ul className="mt-1.5 space-y-0.5">
          {CREDIT_USE_LABELS.map((g) => {
            const cost = Math.max(...g.actions.map((a) => CREDIT_COSTS[a as CreditAction] || 0));
            return <li key={g.label} className="flex justify-between gap-3"><span>{g.label}</span><span className="font-mono">{cost}</span></li>;
          })}
        </ul>
      </details>

      <div className="space-y-2 pt-1">
        <button
          type="button"
          data-testid="buy-individual_pro_monthly"
          disabled={!!busyKey}
          onClick={() => startCheckout("individual_pro_monthly")}
          className="w-full flex items-center justify-between gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl cursor-pointer"
        >
          <span className="text-left">
            <span className="block text-xs">{PLAN_PRICING.individual_pro_monthly.label}</span>
            <span className="block text-[10px] font-normal opacity-90">{PLAN_PRICING.individual_pro_monthly.credits} credits included</span>
          </span>
          <span className="text-sm">{rupees(PLAN_PRICING.individual_pro_monthly.amountPaise)}</span>
        </button>
        <div>
          <span className="text-[10px] text-slate-400 uppercase block mb-1.5">Recharge</span>
          <div className="grid grid-cols-3 gap-2">
            {(["credits_refill_150", "credits_refill_350", "credits_refill_500"] as const).map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`buy-${key}`}
                disabled={!!busyKey}
                onClick={() => startCheckout(key)}
                className="py-2.5 px-2 border border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 disabled:opacity-60 rounded-xl font-bold cursor-pointer"
              >
                <span className="block text-xs">{rupees(PLAN_PRICING[key].amountPaise)}</span>
                <span className="block text-[10px] font-normal">{PLAN_PRICING[key].credits} credits</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">One-time payment for one month. It does not renew automatically. Prices include GST.</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span data-testid="credits-note" className="text-[11px] text-slate-500 dark:text-slate-400">{note}</span>
        <button type="button" onClick={refreshNow} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer bg-transparent border-none">Refresh</button>
      </div>
    </div>
  );
}
