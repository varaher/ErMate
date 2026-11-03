import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { openWhatsApp } from "../utils/whatsappShare";

interface Props {
  title: string;
  /** Short privacy reminder shown above the preview. */
  reminder: string;
  /** The message that will be sent, as the doctor will see it in WhatsApp. */
  text: string;
  onClose: () => void;
  /** Optional controls (for example the hide-names switch). */
  children?: React.ReactNode;
}

/** Preview and hand-off to the doctor's own WhatsApp. ErMate sends nothing itself. */
export default function ShareWhatsAppDialog({ title, reminder, text, onClose, children }: Props) {
  const [result, setResult] = useState<"link" | "copied" | "failed" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/50 p-3 no-print" role="dialog" aria-modal="true" aria-label={title} data-testid="share-whatsapp-dialog">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-xl border-[1.5px] border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200" data-testid="share-whatsapp-reminder">
          {reminder}
        </div>
        {children}
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 p-3 text-[11.5px] leading-relaxed font-mono max-h-64 overflow-y-auto" data-testid="share-whatsapp-preview">{text}</pre>
        {result === "copied" && <p className="text-xs text-slate-600 dark:text-slate-300" data-testid="share-whatsapp-copied">This message is long, so it was copied. Paste it in WhatsApp.</p>}
        {result === "failed" && <p className="text-xs text-rose-600" data-testid="share-whatsapp-failed">Could not open WhatsApp or copy the message. Select the text above and copy it by hand.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => setResult(await openWhatsApp(text))}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            data-testid="share-whatsapp-open"
          >
            Open WhatsApp
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}