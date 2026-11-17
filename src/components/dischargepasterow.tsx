import React, { useState } from "react";
import { FileText, ChevronRight } from "lucide-react";

export interface DischargeRecentItem {
  id: string;
  label: string;
  sub: string;
  status: "Draft" | "Finalised";
}

interface Props {
  /** Paste a case sheet, then ErMate prepares the discharge summary. */
  onPrepare: (text: string) => void;
  /** Opens the full screen (paste, dictate or photo). */
  onMoreOptions: () => void;
  recent?: DischargeRecentItem[];
  onOpenRecent?: (id: string) => void;
  /** Adds a top border, for use below another row in a list. */
  withDivider?: boolean;
  dataCoach?: string;
}

/**
 * A "Discharge Summary" row for Quick tools, closed until tapped (like the other rows).
 * Opened, it shows a paste box: paste a case sheet from any EMR and ErMate prepares the summary for review.
 */
export function DischargePasteRow({ onPrepare, onMoreOptions, recent, onOpenRecent, withDivider, dataCoach }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <div data-coach={dataCoach} className={withDivider ? "border-t border-slate-100 dark:border-slate-800" : ""}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">Discharge Summary</span>
          <span className="block text-[12.5px] text-slate-500 dark:text-slate-400">Paste a case sheet, get the summary</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5" data-testid="discharge-paste-panel">
          <p className="text-[12.5px] text-slate-600 dark:text-slate-400">
            Paste a case sheet from any EMR or paper note. ErMate reads it and opens the discharge summary for you to review. Nothing is saved until you save it.
          </p>
          <textarea
            id="discharge-paste-text"
            aria-label="Case sheet to turn into a discharge summary"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the external case sheet here..."
            className="w-full box-border bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="discharge-paste-prepare"
              disabled={!ready}
              onClick={() => { if (ready) { onPrepare(text.trim()); setText(""); setOpen(false); } }}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
            >
              Prepare discharge summary
            </button>
            <button
              type="button"
              onClick={onMoreOptions}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Dictate or photo
            </button>
          </div>
          {recent && recent.length > 0 && onOpenRecent && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent</div>
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpenRecent(r.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-900 dark:text-white truncate">{r.label}</span>
                    <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{r.sub}</span>
                  </span>
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${r.status === "Finalised" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DischargePasteRow;