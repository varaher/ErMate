import React from "react";
import { ClipboardList, Zap, Lightbulb, BookOpen, AlertTriangle } from "lucide-react";

export interface ClinicalSummaryData {
  summary: string;
  workingDiagnosis?: string[];
  keyPoints?: string[];
  references?: string[];
  alerts?: string[];
}

interface ClinicalSummaryCardProps {
  summary: ClinicalSummaryData;
}

export const ClinicalSummaryCard: React.FC<ClinicalSummaryCardProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 md:p-5 my-3 shadow-lg space-y-4 font-sans text-xs">
      
      {/* Alerts — show first if any */}
      {summary.alerts && summary.alerts.length > 0 && (
        <div className="bg-rose-950/80 border border-rose-800/80 text-rose-200 p-3 rounded-xl space-y-1.5 animate-pulse">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-400">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Time-Critical Alert</span>
          </div>
          {summary.alerts.map((a, i) => (
            <div key={i} className="text-xs font-bold leading-relaxed">
              ⚠ {a}
            </div>
          ))}
        </div>
      )}

      {/* Summary Header & Text */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-indigo-400" />
          <span>📋 Clinical Summary</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          {summary.summary}
        </p>
      </div>

      {/* Working Diagnosis */}
      {summary.workingDiagnosis && summary.workingDiagnosis.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>⚡ Working Diagnosis</span>
          </div>
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-2.5 space-y-1">
            {summary.workingDiagnosis.map((d, i) => (
              <div key={i} className="text-xs font-extrabold text-amber-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-mono">
                  {i + 1}
                </span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {summary.keyPoints && summary.keyPoints.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            <span>💡 Key Points & Management Pearls</span>
          </div>
          <ul className="space-y-1.5 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
            {summary.keyPoints.map((p, i) => (
              <li key={i} className="text-slate-300 flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-400 font-bold shrink-0">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* References */}
      {summary.references && summary.references.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>📚 References & Guidelines</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-400 font-mono">
            {summary.references.map((r, i) => (
              <div key={i} className="bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
                • {r}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
