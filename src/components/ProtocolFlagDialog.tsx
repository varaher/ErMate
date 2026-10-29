import React, { useState } from "react";
import { X, Flag } from "lucide-react";
import { authenticatedFetch } from "../services/authenticatedFetch";
import { FLAG_REASONS, FLAG_REASON_LABELS, FLAG_LIMITS, type FlagReason } from "../lib/protocolFlag";

export interface FlagTarget {
  topicId: string;
  topicTitle: string;
  topicVersion: string;
  /** "" = whole protocol */
  stepKey: string;
  stepLabel: string;
}

/** Short "Flag a concern" form. Sends a private note to the reviewers; never changes the protocol. */
export default function ProtocolFlagDialog({ target, onClose }: { target: FlagTarget; onClose: () => void }) {
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await authenticatedFetch("/api/protocol-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: target.topicId,
          topicVersion: target.topicVersion,
          stepKey: target.stepKey,
          stepLabel: target.stepLabel,
          reason,
          comment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "Could not send your flag. Please try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch (e: any) {
      setError(e?.message || "Could not send your flag. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Flag a concern" data-testid="protocol-flag-dialog">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-[1.5px] border-violet-600 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5"><Flag className="w-4 h-4 text-violet-600" /> Flag a concern</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {target.topicTitle} v{target.topicVersion}{target.stepLabel ? ` · ${target.stepLabel}` : " · whole protocol"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        {state === "sent" ? (
          <>
            <p className="text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-3 py-2.5" data-testid="protocol-flag-sent">
              Sent to the reviewers. The protocol is not changed until they review it. Thank you.
            </p>
            <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-xs font-extrabold">Close</button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {FLAG_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border-[1.5px] border-violet-600 ${
                    reason === r ? "bg-violet-600 text-white" : "text-violet-700 dark:text-violet-300 dark:border-violet-400"
                  }`}
                >
                  {FLAG_REASON_LABELS[r]}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, FLAG_LIMITS.maxComment))}
              rows={3}
              placeholder="What is the concern? (optional)"
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5"
            />
            {state === "error" && <p className="text-[11px] text-red-600" role="alert">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={!reason || state === "sending"}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-xs font-extrabold disabled:opacity-50"
              data-testid="protocol-flag-submit"
            >
              {state === "sending" ? "Sending…" : "Send to reviewers"}
            </button>
            <p className="text-[10px] text-slate-500">Your name and email are saved with the flag so reviewers can follow up. It does not change the protocol.</p>
          </>
        )}
      </div>
    </div>
  );
}