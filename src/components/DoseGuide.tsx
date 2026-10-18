import React from "react";
import { Pill } from "lucide-react";
import type { DoseSuggestion } from "../utils/drugDoseSuggestions";

interface Props {
  query: string;
  suggestions: DoseSuggestion[];
  weightKg: number | null;
  weightEstimated: boolean;
  ageLabel: string;
  onUse: (s: DoseSuggestion) => void;
}

/** Shown ABOVE the manual drug form: recommended dose for the typed drug, for this child's weight. Reference only. */
export default function DoseGuide({ query, suggestions, weightKg, weightEstimated, ageLabel, onUse }: Props) {
  if (query.trim().length < 3) return null;
  return (
    <div data-testid="dose-guide" className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/20 p-2.5 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide text-[10px]"><Pill className="w-3.5 h-3.5" />Recommended dose · {ageLabel}</span>
        {weightKg !== null && (
          <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${weightEstimated ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>
            {weightKg} kg {weightEstimated ? "(estimated from age)" : ""}
          </span>
        )}
      </div>
      {weightKg === null && <p className="text-amber-800">Enter the child's age or weight to see a calculated dose.</p>}
      {weightKg !== null && weightEstimated && <p className="text-amber-800 text-[10px]">Weight is estimated from age — confirm the actual weight before ordering.</p>}
      {weightKg !== null && suggestions.length === 0 && <p className="text-slate-500">No paediatric reference dose found for “{query.trim()}”.</p>}
      {suggestions.map((s) => (
        <div key={s.id} data-testid="dose-guide-row" className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-slate-100">{s.name}</div>
              <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 break-words">{s.doseValue}</div>
            </div>
            <button type="button" onClick={() => onUse(s)} className="shrink-0 px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px]">Use dose</button>
          </div>
          <div className="text-[10px] text-slate-500">{s.standardDose}{s.maxDose ? ` · ${s.maxDose}` : ""}</div>
          {s.notes && <div className="text-[10px] text-amber-700 dark:text-amber-400">{s.notes}</div>}
          <div className="text-[9px] text-slate-400">{s.source} · reference only — verify before administration</div>
        </div>
      ))}
    </div>
  );
}
