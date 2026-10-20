import React, { useEffect, useRef, useState } from "react";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { PLAN_PRICING, CREDIT_COSTS, rupees } from "../lib/pricing";
import { creditLevel, formatDay } from "../lib/creditDisplay";

export interface CreditsProfileFields {
  aiCredits?: number;
  subscriptionTier?: string;
  tierExpiresAt?: string;
  email?: string;
}
interface Props {
  profile: CreditsProfileFields | null;
  /** True only for a verified member of an active, paid hospital subscription. */
  coveredByTeam?: boolean;
  teamName?: string;
  onProfileRefreshed?: (fields: CreditsProfileFields) => void;
}
type Pending = { id: string; uid: string };
let checkoutScript: Promise<void> | undefined;
function loadCheckout(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;
  checkoutScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 15000);
    const fail = () => {
      window.clearTimeout(timer); script.remove(); checkoutScript = undefined;
      reject(new Error("Checkout could not load. Check your connection and try again."));
    };
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => { window.clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.body.appendChild(script);
  });
  return checkoutScript;
}

export default function CreditsPlanCard({ profile, coveredByTeam = false, teamName, onProfileRefreshed }: Props) {
  const uid = auth.currentUser?.uid;
  const [record, setRecord] = useState<{ uid: string; fields: CreditsProfileFields } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const confirming = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const checkout = useRef<any>(null);
  const callback = useRef(onProfileRefreshed);
  useEffect(() => { callback.current = onProfileRefreshed; }, [onProfileRefreshed]);

  useEffect(() => {
    setRecord(null); setPending(null); setBusy(null); setError(""); setMessage("");
    lock.current = false; confirming.current = false;
    const lifecycle = new AbortController(); controller.current = lifecycle;
    if (!uid) return () => lifecycle.abort();
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (lifecycle.signal.aborted || auth.currentUser?.uid !== uid) return;
      if (snapshot.exists()) {
        const d = snapshot.data();
        const fields = { aiCredits: d.aiCredits, subscriptionTier: d.subscriptionTier, tierExpiresAt: d.tierExpiresAt };
        setRecord({ uid, fields }); callback.current?.(fields);
      }
    }, () => { if (!lifecycle.signal.aborted) setError("Balance may be out of date. Tap Refresh to check."); });
    return () => { lifecycle.abort(); unsubscribe(); checkout.current?.close(); checkout.current = null; };
  }, [uid]);

  // Listener updates replace old balances, including decreases after AI use.
  const view = record && record.uid === uid ? { ...profile, ...record.fields } : (profile || {});
  const balance = typeof view.aiCredits === "number" && Number.isFinite(view.aiCredits) ? view.aiCredits : null;
  const admin = (auth.currentUser?.email || profile?.email || "").trim().toLowerCase() === "varahgrp@gmail.com";
  const exempt = admin || coveredByTeam;
  const pro = String(view.subscriptionTier || "").toLowerCase().includes("individual pro");
  const expiry = view.tierExpiresAt ? Date.parse(view.tierExpiresAt) : NaN;
  const active = pro && Number.isFinite(expiry) && expiry > Date.now();
  const monthly = PLAN_PRICING.individual_pro_monthly;
  const period = monthly.periodDays || 30;
  // Supported recharge packs: credits_refill_150, credits_refill_350, credits_refill_500. One-time payment; does not renew automatically.
  const refillKeys = Object.keys(PLAN_PRICING).filter(key => PLAN_PRICING[key].kind === "refill");
  const label = admin ? "Administrator access" : coveredByTeam ? "Hospital-covered" : pro ? "Individual Pro" : "Free / trial";
  const state = exempt ? "Covered" : active ? "Active" : pro ? (Number.isFinite(expiry) ? "Expired" : "Validity unavailable") : "Not subscribed";
  const amount = admin ? "₹0" : coveredByTeam ? "Paid by hospital" : pro ? `${rupees(monthly.amountPaise)} / ${period} days` : "₹0";
  const release = () => { lock.current = false; confirming.current = false; setBusy(null); };

  const request = async (path: string, owner: string, body?: object) => {
    const user = auth.currentUser;
    const lifecycle = controller.current;
    if (!user || user.uid !== owner || !lifecycle || lifecycle.signal.aborted) throw new Error("Please sign in again.");
    const token = await user.getIdToken();
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    lifecycle.signal.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(abort, 15000);
    try {
      const res = await fetch(path, {
        method: body ? "POST" : "GET", signal: timeout.signal, cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not contact billing. Please try again.");
      if (auth.currentUser?.uid !== owner || lifecycle.signal.aborted) throw new Error("Account changed.");
      return data;
    } finally { window.clearTimeout(timer); lifecycle.signal.removeEventListener("abort", abort); }
  };
  const refresh = async () => {
    if (!uid) throw new Error("Please sign in first.");
    const snapshot = await getDocFromServer(doc(db, "users", uid));
    if (controller.current?.signal.aborted || auth.currentUser?.uid !== uid) return;
    if (!snapshot.exists()) throw new Error("Your account could not be found.");
    const d = snapshot.data();
    const fields = { aiCredits: d.aiCredits, subscriptionTier: d.subscriptionTier, tierExpiresAt: d.tierExpiresAt };
    setRecord({ uid, fields }); callback.current?.(fields);
  };
  const confirm = async (order: Pending) => {
    confirming.current = true; lock.current = true; setBusy("confirming"); setError("");
    setMessage("Confirming your payment. Please do not pay again.");
    const lifecycle = controller.current;
    try {
      for (let i = 0; i < 18; i++) {
        if (lifecycle?.signal.aborted || auth.currentUser?.uid !== order.uid) return;
        const result = await request(`/api/payments/orders/${encodeURIComponent(order.id)}`, order.uid);
        if (result.status === "fulfilled") {
          setPending(null); setMessage("Payment confirmed. Your account has been updated.");
          try { await refresh(); } catch { setError("Payment is confirmed. Refresh to check your latest balance."); }
          return;
        }
        if (result.status === "mismatch") throw new Error(`This payment needs support review. Order: ${order.id}. Please do not pay again.`);
        await new Promise(resolve => window.setTimeout(resolve, 4000));
      }
      setMessage(`Confirmation is pending. Use Check payment below. Order: ${order.id}. Please do not pay again.`);
    } catch (e: any) {
      if (!lifecycle?.signal.aborted) { setMessage(`Order: ${order.id}`); setError(e.message || "Could not check payment. Try Check payment again."); }
    } finally { if (!lifecycle?.signal.aborted) release(); }
  };
  const startCheckout = async (key: string) => {
    if (lock.current || pending || exempt) return;
    const owner = auth.currentUser?.uid;
    if (!owner) { setError("Please sign in before purchasing."); return; }
    const lifecycle = controller.current;
    lock.current = true; setBusy(key); setError(""); setMessage("");
    try {
      await loadCheckout();
      const order = await request("/api/payments/create-order", owner, { planKey: key });
      if (lifecycle?.signal.aborted) return;
      if (!order.orderId || !order.keyId || order.currency !== "INR" || !Number.isInteger(order.amount) || order.amount <= 0) throw new Error("Invalid checkout response. Please contact support.");
      if (order.amount !== PLAN_PRICING[key].amountPaise) throw new Error("Pricing has changed. Refresh ErMate before paying.");
      checkout.current = new (window as any).Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: "ErMate", description: PLAN_PRICING[key].label,
        prefill: { email: auth.currentUser?.email || profile?.email || "" },
        theme: { color: "#059669" },
        handler: () => {
          if (lifecycle?.signal.aborted || auth.currentUser?.uid !== owner) return;
          const payment = { id: order.orderId, uid: owner };
          setPending(payment); void confirm(payment);
        },
        modal: { ondismiss: () => { if (!lifecycle?.signal.aborted && !confirming.current) release(); } },
      });
      checkout.current.on("payment.failed", () => {
        if (!lifecycle?.signal.aborted) setError("Payment was not completed. You can retry in checkout or close it.");
      });
      checkout.current.open();
    } catch (e: any) { if (!lifecycle?.signal.aborted) { setError(e.message || "Could not start checkout."); release(); } }
  };
  const start = startCheckout;

  const disabled = !!busy || !!pending || exempt;
  const button = "w-full rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <section id="ermate-billing" data-testid="credits-plan-card" aria-label="ErMate subscription and credits" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 scroll-mt-24">
      <header className="bg-slate-950 p-5 text-white sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">ErMate · Your shift companion</p>
        <h2 className="mt-2 text-xl font-bold">Your plan & credits</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><p className="text-xs text-slate-400">Subscription</p><p className="mt-1 font-semibold" data-testid="current-plan">{label}</p><span className="text-xs text-emerald-300">{state}</span></div>
          <div><p className="text-xs text-slate-400">{exempt ? "Billing" : "Plan price"}</p><p className="mt-1 font-semibold" data-testid="current-price">{amount}</p><span className="text-xs text-slate-400">{exempt ? "No personal payment required" : "Including GST"}</span></div>
          <div><p className="text-xs text-slate-400">{exempt ? "Personal credits remaining" : "Credits remaining"}</p><p data-testid="credits-balance" className={`mt-1 text-3xl font-bold ${creditLevel(balance) === "empty" ? "text-rose-300" : "text-emerald-300"}`}>{balance ?? "—"}</p></div>
        </div>
        <p className="mt-4 text-xs text-slate-300">{admin ? "Your administrator account is exempt from AI credit charges." : coveredByTeam ? `${teamName || "Your hospital"} covers your account. Personal credits are not used during coverage.` : pro ? Number.isFinite(expiry) ? `${active ? "Valid until" : "Expired on"} ${formatDay(view.tierExpiresAt)}. Renewal is manual.` : "Your plan expiry is unavailable. Please check with support." : "Your free / trial balance is shown above. Choose Individual Pro to start your monthly plan."}</p>
      </header>
      <div className="space-y-5 p-5 sm:p-6">
        {balance === 0 && !exempt && <p data-testid="credits-empty-notice" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">No credits remaining. Manual entry, saving and printing use no credits.</p>}
        {balance !== null && balance > 0 && creditLevel(balance) === "low" && !exempt && <p data-testid="credits-low-notice" className="text-sm text-amber-700 dark:text-amber-300">Your credits are running low. Recharge when needed.</p>}
        <article className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">Individual Pro</h3><p className="text-sm text-slate-600 dark:text-slate-300">One monthly plan. Every feature available.</p></div><div className="text-right"><strong className="text-2xl text-emerald-700 dark:text-emerald-300">{rupees(monthly.amountPaise)}</strong><p className="text-xs text-slate-500">{period} days · GST included</p></div></div>
          <ul className="my-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>✓ {monthly.credits} credits included with each purchase</li><li>✓ Voice case sheets, AI discharge, Discuss, Rounds and other AI tools use credits</li><li>✓ Manual documentation, saving and print/export use no credits</li><li>✓ Renew manually. No automatic debit. No annual commitment.</li>
          </ul>
          <button type="button" data-testid="buy-individual_pro_monthly" disabled={disabled} onClick={() => void startCheckout("individual_pro_monthly")} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>{busy === "individual_pro_monthly" ? "Opening checkout…" : exempt ? "Included through your access" : `${pro ? "Renew" : "Subscribe"} · ${rupees(monthly.amountPaise)}`}</button>
        </article>
        <div><h3 className="font-bold text-slate-900 dark:text-white">Need more AI usage?</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recharges add credits. They do not extend your subscription validity.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {refillKeys.map(key => { const pack = PLAN_PRICING[key]; return <article key={key} className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs uppercase tracking-wide text-slate-500">Credit recharge</p><h4 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{rupees(pack.amountPaise)}</h4><p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{pack.credits} credits</p><p className="my-3 text-xs text-slate-500">GST included · One-time purchase</p><button type="button" data-testid={`buy-${key}`} disabled={disabled} onClick={() => void startCheckout(key)} className={`${button} mt-auto border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30`}>{busy === key ? "Opening…" : "Recharge"}</button></article>; })}
        </div>
        <details className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950/50"><summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">How do credits work?</summary><p className="mt-3 text-slate-600 dark:text-slate-300">One credit is a usage unit, not one complete patient case. Different AI actions use different amounts. Dictation may involve transcription and extraction as separate actions. All plans use the same action rates.</p><ul className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">{[{label:"Transcription request",cost:CREDIT_COSTS.stt},{label:"Case extraction turn",cost:CREDIT_COSTS.scribe_chat},{label:"AI discharge draft",cost:CREDIT_COSTS.ai_discharge},{label:"Discuss message",cost:CREDIT_COSTS.case_discussion},{label:"Rounds request",cost:CREDIT_COSTS.rounds_debrief},{label:"Handover compilation",cost:CREDIT_COSTS.handover_compile}].map(item=><li key={item.label}>{item.label}: <strong>{item.cost} {item.cost === 1 ? "credit" : "credits"}</strong></li>)}</ul></details>
        <div aria-live="polite" className="space-y-2 text-sm"><p className="break-words text-slate-600 dark:text-slate-300">{message}</p>{error && <p role="alert" className="break-words text-rose-700 dark:text-rose-300">{error}</p>}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"><span className="text-xs text-slate-400">Secure checkout through Razorpay</span><button type="button" disabled={!!busy} onClick={() => { setError(""); if (pending) void confirm(pending); else void refresh().then(()=>setMessage("Balance updated.")).catch(e=>setError(e.message)); }} className="text-sm font-semibold text-emerald-700 disabled:opacity-50 dark:text-emerald-300">{pending ? "Check payment" : "Refresh balance"}</button></div>
      </div>
    </section>
  );
}
