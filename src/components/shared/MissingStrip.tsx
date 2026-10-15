import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { ClinicalCase } from "../../types";
import { getCasePendingStatus } from "../../utils/caseHelper";

// Maps each pending section reported by getCasePendingStatus to the tab that fixes it.
const SECTION_TARGET: Record<string, { tab: string; label: string }> = {
  "SAMPLE History": { tab: "history", label: "SAMPLE history" },
  "Clinical Examination": { tab: "primary-survey", label: "Examination (primary / secondary)" },
  "Treatments / Tests": { tab: "treatment", label: "Treatments / tests" },
  "Progress Notes": { tab: "notes", label: "Progress notes" },
  "Disposition Details": { tab: "disposition", label: "Disposition" },
  "Discharge Summary": { tab: "disposition", label: "Discharge summary" },
};

/** Compact "what's still missing" strip. Tap an item to jump to the tab that fixes it. Read-only; changes no data. */
export default function MissingStrip({
  clinicalCase,
  onJump,
}: {
  clinicalCase: ClinicalCase;
  onJump: (tab: string) => void;
}) {
  const status = getCasePendingStatus(clinicalCase);
  if (!status.isPending) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg px-3 py-1.5 no-print">
        <CheckCircle className="w-3.5 h-3.5" /> Case sheet complete
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-1.5 no-print">
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 mr-1">
        <AlertCircle className="w-3.5 h-3.5" /> Still missing ({status.pendingCount}):
      </span>
      {status.pendingSections.map((section) => {
        const target = SECTION_TARGET[section];
        return (
          <button
            key={section}
            type="button"
            onClick={() => target && onJump(target.tab)}
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer"
          >
            {target?.label || section}
          </button>
        );
      })}
    </div>
  );
}
