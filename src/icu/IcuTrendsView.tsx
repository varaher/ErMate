import React, { useEffect, useMemo, useState } from "react";
import { requestTour } from "../lib/coachTours";
import { ArrowLeft, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IcuAdmission, IcuNote } from "./icuTypes";
import { icuDayNumber } from "./icuLogic";
import { buildTrends, filterWindow, seriesSummary, type TrendPoint, type TrendSeries, type TrendWindow } from "./icuTrends";

interface Props {
  admission: IcuAdmission;
  notes: IcuNote[];
  onClose: () => void;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";
const PURPLE = "#5B21B6";
const EVENT = "#A78BFA";

const WINDOWS: { id: TrendWindow; label: string }[] = [
  { id: "24h", label: "24 h" },
  { id: "7d", label: "7 days" },
  { id: "stay", label: "Whole stay" },
];

/** Trends over the whole ICU stay. Only documented values; lines break where nothing was recorded. */
export default function IcuTrendsView({ admission, notes, onClose }: Props) {
  const [win, setWin] = useState<TrendWindow>("stay");
  const [group, setGroup] = useState<"all" | "vital" | "lab">("all");

  // One-time walkthrough for the time-window control.
  useEffect(() => { requestTour("icutrends"); }, []);

  const now = useMemo(() => new Date(), [notes]);
  const full = useMemo(() => buildTrends(admission, notes, now), [admission, notes, now]);
  const bundle = useMemo(() => filterWindow(full, win, now), [full, win, now]);
  const shown = bundle.series.filter((s) => group === "all" || s.group === group);

  const dayTick = (t: number) => {
    const d = new Date(t);
    const hh = d.getHours();
    const h12 = ((hh + 11) % 12) + 1;
    return win === "stay"
      ? `D${icuDayNumber(admission.admittedAt, d)}`
      : `D${icuDayNumber(admission.admittedAt, d)} ${h12}${hh < 12 ? "a" : "p"}`;
  };

  const whenLabel = (p: TrendPoint) => {
    const d = new Date(p.t);
    const hh = d.getHours();
    const mm = d.getMinutes();
    const h12 = ((hh + 11) % 12) + 1;
    const clock = `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`;
    return `Day ${icuDayNumber(admission.admittedAt, d)}, ${clock}${p.approx ? " (time not stated)" : ""}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col" role="dialog" aria-modal="true" aria-label="ICU trends">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-3 flex flex-col gap-2.5 shrink-0">
        <button type="button" onClick={onClose} className="self-start min-h-[44px] -ml-2 px-2 flex items-center gap-1 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-700 dark:text-violet-300" />
          Trends · {admission.unitName} · Bed {admission.bed}
        </h1>
        <div className="flex bg-slate-200/70 dark:bg-slate-800 rounded-xl p-0.5" role="radiogroup" aria-label="Time window" data-coach="icu-trends-window">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={win === w.id}
              onClick={() => setWin(w.id)}
              className={`flex-1 min-h-[40px] text-sm rounded-lg transition-colors ${win === w.id ? "bg-white dark:bg-slate-700 font-semibold text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Show">
          {(["all", "vital", "lab"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={group === g}
              onClick={() => setGroup(g)}
              className={`px-3 min-h-[34px] rounded-full text-xs font-semibold border ${group === g ? "bg-violet-700 text-white border-violet-700" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
            >
              {g === "all" ? "All" : g === "vital" ? "Vitals" : "Labs"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-10">
        {shown.length === 0 && (
          <div className={`${card} p-5 text-sm text-slate-600 dark:text-slate-300`}>
            {full.series.length === 0
              ? "No numeric vitals or results documented in this stay yet. Values you dictate in notes appear here automatically."
              : "Nothing documented in this time window. Try “Whole stay”."}
          </div>
        )}

        {shown.map((s) => (
          <TrendCard key={s.key} s={s} from={bundle.from} to={bundle.to} events={bundle.events} tick={dayTick} when={whenLabel} />
        ))}

        <div className={`${card} p-3 flex flex-col gap-1.5`}>
          <span className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400">KEY</span>
          <span className="text-xs text-slate-700 dark:text-slate-300">— Line breaks where no reading was documented for over 12 hours. Nothing is filled in.</span>
          <span className="text-xs text-slate-700 dark:text-slate-300">┆ Dashed purple line = line or device inserted.</span>
          <span className="text-xs text-slate-700 dark:text-slate-300">○ Hollow dot = time not stated, plotted at the note's time.</span>
          <span className="text-xs text-slate-700 dark:text-slate-300">Values with two numbers (e.g. “7.7 → 8.7”) are not plotted — dictate each reading with its time.</span>
        </div>
      </main>
    </div>
  );
}

function TrendCard({ s, from, to, events, tick, when }: {
  s: TrendSeries;
  from: number;
  to: number;
  events: { t: number; label: string }[];
  tick: (t: number) => string;
  when: (p: TrendPoint) => string;
}) {
  const latest = s.latest;
  const unit = s.unit ? ` ${s.unit}` : "";
  const data = s.points.map((p) => ({ t: p.t, v: p.v, approx: p.approx, raw: p.raw }));

  const renderDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (payload?.v === null || payload?.v === undefined || cx == null || cy == null) return <g key={`d${index}`} />;
    return payload.approx
      ? <circle key={`d${index}`} cx={cx} cy={cy} r={3.5} fill="#fff" stroke={PURPLE} strokeWidth={1.5} />
      : <circle key={`d${index}`} cx={cx} cy={cy} r={3} fill={PURPLE} stroke={PURPLE} />;
  };

  return (
    <section className={`${card} p-3 flex flex-col gap-1.5`} aria-label={`${s.label} trend`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.label}{s.unit ? ` (${s.unit})` : ""}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {latest ? `Latest ${latest.v}${unit} · ${when(latest)}` : "Not documented"}
        </span>
      </div>
      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#E5E5EA" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from, to]}
              tickFormatter={tick}
              tick={{ fontSize: 10, fill: "#636366" }}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 10, fill: "#636366" }} domain={["auto", "auto"]} width={44} />
            {events.map((e, i) => (
              <ReferenceLine key={`e${i}`} x={e.t} stroke={EVENT} strokeDasharray="3 3" ifOverflow="hidden" />
            ))}
            <Tooltip
              formatter={(value: any) => [value, s.label]}
              labelFormatter={(t: any, payload: any) => {
                const p = payload?.[0]?.payload;
                return p ? `${when({ t: Number(t), v: p.v, approx: p.approx, raw: p.raw, noteId: "" })}` : "";
              }}
              contentStyle={{ fontSize: 12, borderRadius: 10 }}
            />
            <Line
              type="linear"
              dataKey="v"
              stroke={PURPLE}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot={renderDot}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{seriesSummary(s)}{unit ? ` ${s.unit}` : ""}</span>
      {events.length > 0 && (
        <span className="text-[11px] text-violet-700 dark:text-violet-300">
          ┆ {events.map((e) => `${e.label} (${tick(e.t)})`).join(" · ")}
        </span>
      )}
    </section>
  );
}