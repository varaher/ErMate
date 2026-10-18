import React from "react";
import { getPediatricAgeBand, isPediatricPatient } from "../utils/pediatricRanges";

const cToF1 = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;

interface Props {
  ageYears: number | null;
  ageMonths?: number | null;
  /** Optional measured values to flag against the band. */
  hr?: string; rr?: string; sbp?: string; spo2?: string; tempF?: string;
}

type Row = { key: string; label: string; unit: string; low: number; high: number; value?: number | null };

/** Reference-only chart: normal vitals for the entered age. Never changes triage level by itself. */
export default function PediatricNormalVitalsCard({ ageYears, ageMonths, hr, rr, sbp, spo2, tempF }: Props) {
  if (ageYears === null || !isPediatricPatient(ageYears)) return null;
  const band = getPediatricAgeBand(ageYears, ageMonths);
  if (!band) {
    return (
      <div data-testid="paed-normal-vitals" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Age under 1 year — enter the age in <b>months</b> to see the normal vitals for this infant.
      </div>
    );
  }
  const num = (s?: string) => { const n = parseFloat(s ?? ""); return isNaN(n) ? null : n; };
  const r = band.ranges;
  const rows: Row[] = [
    { key: "hr", label: "Heart rate", unit: "/min", low: r.hr.low, high: r.hr.high, value: num(hr) },
    { key: "rr", label: "Resp. rate", unit: "/min", low: r.rr.low, high: r.rr.high, value: num(rr) },
    { key: "sbp", label: "Systolic BP", unit: "mmHg", low: r.sbp.low, high: r.sbp.high, value: num(sbp) },
    { key: "spo2", label: "SpO₂", unit: "%", low: r.spo2.low, high: r.spo2.high, value: num(spo2) },
    { key: "temp", label: "Temperature", unit: "°F", low: cToF1(r.temp.low), high: cToF1(r.temp.high), value: num(tempF) },
  ];
  return (
    <div data-testid="paed-normal-vitals" className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-sky-800">Normal vitals · {band.label}</span>
        <span className="text-[10px] text-sky-700">reference only</span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {rows.map((row) => {
          const flag = row.value === null || row.value === undefined ? null : row.value < row.low ? "Low" : row.value > row.high ? "High" : "Normal";
          return (
            <div key={row.key} data-testid={`paed-row-${row.key}`} className="flex items-center justify-between text-xs">
              <span className="text-slate-700">{row.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{row.low}–{row.high} <span className="font-normal text-slate-500">{row.unit}</span></span>
                {flag && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${flag === "Normal" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {flag}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
