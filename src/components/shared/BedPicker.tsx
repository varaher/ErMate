import React, { useMemo, useState } from "react";
import { ClinicalCase } from "../../types";
import { normalizeMateBedId } from "../../mate/mateBedModel";

interface BedPickerProps {
  /** Current value as stored/typed: "", "11", "11A", "11B". */
  value: string;
  onChange: (next: string) => void;
  activeCases: ClinicalCase[];
  capacity?: number;
  hasError?: boolean;
}

type Occ = { A: string | null; B: string | null };

/**
 * Tap-to-pick ER bed selector. Uses the same occupancy rules as allocateOrValidateBed
 * (a bare "11" occupies slot A). It only produces the string the old text box produced,
 * so all existing validation/allocation in TriageForm is unchanged.
 */
export default function BedPicker({ value, onChange, activeCases, capacity = 30, hasError }: BedPickerProps) {
  const cap = Math.max(1, Math.min(200, capacity || 30));
  const [open, setOpen] = useState(false);

  const occupancy = useMemo(() => {
    const map = new Map<number, Occ>();
    for (const c of activeCases || []) {
      if (!c || c.status === "Discharged" || (c as any).archivedAt) continue;
      const id = normalizeMateBedId(c.bedNo);
      if (!id) continue;
      const m = id.match(/^(\d+)([AB])?$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      const slot: "A" | "B" = m[2] === "B" ? "B" : "A";
      const who = c.patient?.name || "occupied";
      const cur = map.get(n) || { A: null, B: null };
      cur[slot] = who;
      map.set(n, cur);
    }
    return map;
  }, [activeCases]);

  const norm = normalizeMateBedId(value);
  const selMatch = norm ? norm.match(/^(\d+)([AB])?$/) : null;
  const selNum = selMatch ? parseInt(selMatch[1], 10) : null;
  const selSlot = (selMatch?.[2] as "A" | "B" | undefined) || "";

  const pickNumber = (n: number) => onChange(String(n));
  const pickSlot = (slot: "" | "A" | "B") => {
    if (selNum === null) return;
    onChange(`${selNum}${slot}`);
  };

  const summary = selNum === null ? "No bed selected" : `Bed ${selNum}${selSlot || ""}${selSlot ? "" : " (auto A/B)"}`;
  const selOcc = selNum !== null ? occupancy.get(selNum) : undefined;

  return (
    <div data-testid="bed-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full px-4 py-2 text-left bg-slate-50 dark:bg-slate-900 border ${
          hasError ? "border-rose-500" : "border-slate-200 dark:border-slate-800"
        } rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100 flex items-center justify-between cursor-pointer`}
      >
        <span>{summary}</span>
        <span className="text-[10px] text-slate-400">{open ? "Hide" : "Choose"}</span>
      </button>

      {open && (
        <div className="mt-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="grid grid-cols-6 gap-1.5" role="listbox" aria-label="ER beds">
            {Array.from({ length: cap }, (_, i) => i + 1).map((n) => {
              const o = occupancy.get(n);
              const full = Boolean(o?.A && o?.B);
              const part = Boolean(o && (o.A || o.B)) && !full;
              const selected = selNum === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={full}
                  onClick={() => pickNumber(n)}
                  title={full ? `Bed ${n} full` : part ? `Bed ${n}: one slot taken` : `Bed ${n} free`}
                  className={`py-1.5 rounded-md text-xs font-mono font-bold border cursor-pointer disabled:cursor-not-allowed ${
                    selected
                      ? "bg-blue-600 text-white border-blue-600"
                      : full
                      ? "bg-rose-50 dark:bg-rose-950/30 text-rose-300 border-rose-200 dark:border-rose-900 line-through"
                      : part
                      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {selNum !== null && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 mr-1">Slot</span>
              {([["", "Auto"], ["A", "A"], ["B", "B"]] as const).map(([s, label]) => {
                const taken = s === "A" ? selOcc?.A : s === "B" ? selOcc?.B : null;
                const active = selSlot === s;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={Boolean(taken)}
                    onClick={() => pickSlot(s)}
                    title={taken ? `${selNum}${s} taken by ${taken}` : undefined}
                    className={`px-3 py-1 rounded-md text-xs font-bold border cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="ml-auto text-[11px] text-slate-500 underline cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded-md text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-400">
            <span className="text-amber-600">Amber</span> = one slot taken · <span className="text-rose-400">struck</span> = both slots taken.
          </p>
        </div>
      )}
    </div>
  );
}

