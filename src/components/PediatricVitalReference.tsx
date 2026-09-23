import React from "react";
import { interpretPediatricVital, type VitalStatusType } from "../utils/pediatricRanges";

interface Props {
  param: "hr" | "rr" | "sbp" | "spo2" | "temp";
  value?: string | number | null;
  ageYears?: number | null;
  ageMonthsParam?: number | null;
  ageDaysParam?: number | null;
  className?: string;
  showStatusOnly?: boolean;
}

export const PediatricVitalReference: React.FC<Props> = ({
  param,
  value,
  ageYears,
  ageMonthsParam,
  ageDaysParam,
  className = "",
  showStatusOnly = false,
}) => {
  const interp = interpretPediatricVital(param, value, ageYears, ageMonthsParam, ageDaysParam);

  if (!interp.isPediatric) {
    return null;
  }

  if (interp.requiresAgeInMonths) {
    if (showStatusOnly) return null;
    return (
      <div className={`text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5 ${className}`}>
        <span className="font-medium italic">Age in months required for pediatric reference range</span>
      </div>
    );
  }

  const getStatusBadge = (status: VitalStatusType) => {
    switch (status) {
      case "Normal":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Within age-expected range
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {interp.statusText || "Outside age-expected range"}
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            {interp.statusText || "Outside age-expected range"}
          </span>
        );
      default:
        return null;
    }
  };

  if (showStatusOnly) {
    return getStatusBadge(interp.status);
  }

  return (
    <div className={`text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="font-medium">
        Ref for age: <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">{interp.rangeLabel}</span>
      </span>
      {interp.status !== "Unknown" && (
        <span className="inline-flex items-center gap-1">
          <span className="text-[10px] text-slate-400">·</span>
          {getStatusBadge(interp.status)}
        </span>
      )}
    </div>
  );
};

export default PediatricVitalReference;
