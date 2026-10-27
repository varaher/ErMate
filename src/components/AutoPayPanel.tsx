import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { CORE_AUTOPAY, rupees } from "../lib/pricing";
import { formatDay } from "../lib/creditDisplay";

/**
 * Monthly AutoPay (Razorpay Subscriptions) for the ErMate plan.
 * Display + intent only. Access is extended exclusively by the server webhook after a verified Rs 350 charge;
 * nothing here grants access or credits. Renewals never add AI credits.
 */
interface View {
  configured: boolean;
  amountPaise: number;
  status: string;
  canEnable: boolean;
  reason?: string;
  firstRenewalAt?: string;
  nextRenewalAt?: string;
  accessUntil?: string;
  lastFailureAt?: string;
}
interface Props {
  /** Changes when the plan is bought/renewed so the status reloads. */
  tierExpiresAt?: string;
  credits: number | null;
  loadCheckout: () => Promise<void>;
}

const LIVE = ["authenticated", "active", "pending"];

export default function AutoPayPanel({ tierExpiresAt, credits, loadCheckout }: Props) {
  const uid = auth.currentUser?.uid;
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<"" | "enable" | "confirm" | "cancel">("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const call = useCallback(async (path: string, method: "GET" | "POST" = "GET") => {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    const token = await user.getIdToken();
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(path, { method, cache: "no-store", signal: ctl.signal, headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not contact billing. Please try again.");
      return data;
    } finally { window.clearTimeout(timer); }
  }, []);

  const load = useCallback(async () => {
    try { const v = await call("/api/payments/autopay"); if (alive.current) setView(v); }
    catch { /* panel stays hidden / unchanged; billing card still works */ }
  }, [call]);
  useEffect(() => { setView(null); setMessage(""); setError(""); setConfirmCancel(false); if (uid) void load(); }, [uid, tierExpiresAt, load]);

  if (!view || !view.configured) return null;
  const live = LIVE.includes(view.status);
  const price = `${rupees(view.amountPaise || CORE_AUTOPAY.amountPaise)}/month`;
  const noCredits = "Renewals include platform access only. No AI credits are added.";

  const waitForMandate = async () => {
    setBusy("confirm"); setMessage("Confirming your AutoPay authorization. Please do not try again.");
    for (let i = 0; i < 18; i++) {
      if (!alive.current) return;
      try {
        const v: View = await call("/api/payments/autopay");
        if (alive.current) setView(v);
        if (LIVE.includes(v.status)) { setMessage("AutoPay is set up. Nothing is charged until your renewal date."); return; }
      } catch { /* keep polling */ }
      await new Promise(r => window.setTimeout(r, 4000));
    }
    setMessage("Confirmation is still pending. Check again in a minute. You will not be charged twice.");
  };

  const enable = async () => {
    if (lock.current || busy) return;
    lock.current = true; setBusy("enable"); setError(""); setMessage("");
    try {
      await loadCheckout();
      const sub = await call("/api/payments/autopay/create", "POST");
      if (!sub.subscriptionId || !sub.keyId) throw new Error("Invalid checkout response. Please contact support.");
      let handled = false;
      const rz = new (window as any).Razorpay({
        key: sub.keyId, subscription_id: sub.subscriptionId,
        name: "ErMate", description: `ErMate AutoPay · ${price}`,
        prefill: { email: auth.currentUser?.email || "" },
        theme: { color: "#059669" },
        handler: () => { handled = true; void waitForMandate().finally(() => { lock.current = false; if (alive.current) setBusy(""); }); },
        modal: { ondismiss: () => { if (!handled) { lock.current = false; if (alive.current) { setBusy(""); void load(); } } } },
      });
      rz.on("payment.failed", () => { if (alive.current) setError("Authorization was not completed. You can try again."); });
      rz.open();
    } catch (e: any) {
      setError(e?.message || "Could not start AutoPay setup.");
      lock.current = false; setBusy("");
      void load();
    }
  };

  const cancel = async () => {
    if (lock.current || busy) return;
    lock.current = true; setBusy("cancel"); setError(""); setMessage("");
    try {
      await call("/api/payments/autopay/cancel", "POST");
      setConfirmCancel(false);
      setMessage(`AutoPay cancelled. You keep your paid access${view.accessUntil ? ` until ${formatDay(view.accessUntil)}` : ""}.`);
      await load();
    } catch (e: any) { setError(e?.message || "Could not cancel AutoPay. Please try again."); }
    finally { lock.current = false; setBusy(""); }
  };

  return (
    <article data-testid="autopay-panel" className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Monthly AutoPay</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{noCredits}</p>
        </div>
        <strong data-testid="autopay-price" className="text-lg text-emerald-700 dark:text-emerald-300">{price}</strong>
      </div>

      {live && (
        <dl data-testid="autopay-status" className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Status</dt><dd className="font-semibold text-emerald-700 dark:text-emerald-300">{view.status === "pending" ? "Renewal payment pending" : "AutoPay on"}</dd></div>
          <div><dt className="text-xs text-slate-500">Next renewal</dt><dd data-testid="autopay-next" className="font-semibold text-slate-900 dark:text-white">{view.nextRenewalAt ? formatDay(view.nextRenewalAt) : "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Credits remaining</dt><dd className="font-semibold text-slate-900 dark:text-white">{credits === null ? "—" : credits}</dd></div>
        </dl>
      )}

      {view.status === "halted" && <p data-testid="autopay-failed" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">AutoPay stopped because a renewal payment failed. Your paid access continues until {view.accessUntil ? formatDay(view.accessUntil) : "the end of your paid period"}. Re-enable AutoPay or renew the plan.</p>}
      {view.status === "pending" && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">The last renewal payment did not go through. Razorpay will retry. Please check your UPI or card.</p>}
      {view.status === "cancelled" && <p data-testid="autopay-cancelled" className="mt-3 text-sm text-slate-600 dark:text-slate-300">AutoPay is cancelled. You keep paid access{view.accessUntil ? ` until ${formatDay(view.accessUntil)}` : ""}.</p>}

      {!live && view.canEnable && (
        <div className="mt-3 space-y-3">
          <p data-testid="autopay-first-renewal" className="text-sm text-slate-700 dark:text-slate-200">
            Nothing is charged today. Your first {price} renewal (GST included) is on <strong>{view.firstRenewalAt ? formatDay(view.firstRenewalAt) : "—"}</strong>, when your current paid period ends. Cancel any time from here. Your bank or UPI app may show a small authorization when you approve the mandate.
          </p>
          <button type="button" data-testid="enable-autopay" disabled={!!busy} onClick={() => void enable()}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy === "enable" ? "Opening checkout…" : busy === "confirm" ? "Confirming…" : `Enable AutoPay · ${price}`}
          </button>
        </div>
      )}
      {!live && !view.canEnable && view.status !== "creating" && view.reason && view.status === "none" && (
        <p className="mt-3 text-xs text-slate-500">{view.reason}</p>
      )}
      {view.status === "creating" && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">AutoPay setup is in progress. Please check again in a minute.</p>}

      {live && (
        <div className="mt-3">
          {!confirmCancel ? (
            <button type="button" data-testid="cancel-autopay" disabled={!!busy} onClick={() => setConfirmCancel(true)}
              className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30">Cancel AutoPay</button>
          ) : (
            <div className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-950/30">
              <p className="text-rose-800 dark:text-rose-200">Stop future renewals? You keep your paid access{view.accessUntil ? ` until ${formatDay(view.accessUntil)}` : ""}.</p>
              <div className="flex gap-2">
                <button type="button" data-testid="confirm-cancel-autopay" disabled={!!busy} onClick={() => void cancel()} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{busy === "cancel" ? "Cancelling…" : "Yes, cancel AutoPay"}</button>
                <button type="button" disabled={!!busy} onClick={() => setConfirmCancel(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Keep AutoPay</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div aria-live="polite" className="mt-2 space-y-1 text-sm"><p className="break-words text-slate-600 dark:text-slate-300">{message}</p>{error && <p role="alert" className="break-words text-rose-700 dark:text-rose-300">{error}</p>}</div>
    </article>
  );
}