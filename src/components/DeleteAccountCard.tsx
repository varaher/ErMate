import React, { useState } from "react";
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import { authenticatedFetch } from "../services/authenticatedFetch";

interface Props { onDeleted: () => void | Promise<void>; }

/** In-app account deletion (DPDP erasure). The server enforces the retention rule; see /privacy.html. */
export default function DeleteAccountCard({ onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const user = auth.currentUser;
  const usesPassword = !!user?.providerData.some(p => p.providerId === "password");

  const submit = async () => {
    const u = auth.currentUser;
    if (!u || busy) return;
    setBusy(true); setError("");
    try {
      // Fresh sign-in proves it is really the owner (the server rejects logins older than 5 minutes).
      if (usesPassword) {
        if (!password) { setError("Enter your password to confirm."); setBusy(false); return; }
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email || "", password));
      } else {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      }
      await u.getIdToken(true);
      const res = await authenticatedFetch("/api/account/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: word }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setError(data.error || "Could not delete the account. Please try again."); setBusy(false); return; }
      await onDeleted();
    } catch (e: any) {
      const code = String(e?.code || "");
      setError(code.includes("wrong-password") || code.includes("invalid-credential") ? "Password is incorrect." : "Could not confirm your identity. Please try again.");
      setBusy(false);
    }
  };

  return (
    <section data-testid="delete-account-card" className="rounded-2xl border border-rose-200 p-4 dark:border-rose-900/50">
      <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Delete my account</h3>
      {!open ? (
        <>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Permanently removes your login, profile and your individual-workspace cases, dictation sessions and logbook. Hospital records stay with the hospital. Payment records are kept for tax purposes.</p>
          <button type="button" data-testid="delete-account-open" onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-rose-600 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">Delete my account…</button>
        </>
      ) : (
        <div className="mt-2 space-y-2 text-xs">
          <p className="text-slate-700 dark:text-slate-200">This cannot be undone. Unused credits are lost. Type <b>DELETE</b> to confirm.</p>
          <input data-testid="delete-confirm-word" value={word} onChange={e => setWord(e.target.value)} autoCapitalize="characters" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="DELETE" />
          {usesPassword && <input data-testid="delete-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Your password" />}
          {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button type="button" data-testid="delete-account-confirm" disabled={busy || word !== "DELETE"} onClick={() => void submit()} className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50">{busy ? "Deleting…" : "Permanently delete"}</button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setWord(""); setPassword(""); setError(""); }} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold dark:border-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
