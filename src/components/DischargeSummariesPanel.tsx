/**
 * Discharge summaries · last 24 hours (25 Nov 2026). Shown on the Dashboard and at the top of Cases, so a
 * prepared summary is always easy to find again: tap to open, review, print or copy.
 */
import React, { useEffect, useState } from "react";
import { FileText, Clock, ChevronRight } from "lucide-react";
import type { ClinicalCase } from "../types";
import { recentDischargeSummaries, formatListTime, DischargeListItem } from "../utils/dischargeList";

interface Props {
  cases: ClinicalCase[];
  onOpen: (caseId: string) => void;
  /** Show at most this many rows, with "Show all" for the rest. */
  limit?: number;
  /** Hide the whole card when nothing is listed (Dashboard); Cases shows an empty line instead. */
  hideWhenEmpty?: boolean;
  dataCoach?: string;
}

const badge: Record<DischargeListItem["status"], string> = {
  Finalised: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  Draft: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "Not saved": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function DischargeSummariesPanel({ cases, onOpen, limit = 5, hideWhenEmpty = false, dataCoach }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const items = recentDischargeSummaries(cases, now);
  if (!items.length && hideWhenEmpty) return null;
  const shown = showAll ? items : items.slice(0, limit);

  return (
    <section
      id="discharge-summaries-panel"
      data-coach={dataCoach}
      aria-label="Discharge summaries from the last 24 hours"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden no-print"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Discharge summaries</h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">Prepared in the last 24 hours · always kept in the case record</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-slate-500 dark:text-slate-400">
          No discharge summaries in the last 24 hours. A summary you prepare shows here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                data-testid="discharge-list-row"
                onClick={() => onOpen(r.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{r.name}</span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge[r.status]}`}>{r.status}</span>
                  </span>
                  {r.diagnosis && <span className="block text-[12.5px] text-slate-700 dark:text-slate-300 truncate">{r.diagnosis}</span>}
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {r.sub && <span className="truncate">{r.sub}</span>}
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatListTime(r.at, now)} · {r.hoursLeft > 0 ? `${r.hoursLeft} h left` : "under 1 h left"}
                    </span>
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-400 border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}