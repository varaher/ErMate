/**
 * ER Guide › Airway & Ventilation › Ventilator graphics (26 Nov 2026, Neeraj).
 * Animated pressure / flow / volume curves and loops, drawn in code from src/data/ventGraphics.ts
 * (no copied pictures). Each card: Play/Pause, Show normal (faint comparison underneath), what you see,
 * common ER causes, what to do, and links to Handbook topics.
 */
import React, { useMemo, useState } from "react";
import { Pause, Play, Activity } from "lucide-react";
import { VENT_GRAPHICS, VENT_GROUPS, VENT_GRAPHICS_REFERENCES, GRAPH_W, GRAPH_H, GRAPH_X0, type VentCard, type VentGraph, type VentGroup } from "../data/ventGraphics";
import { findTopic } from "../data/protocols";

const CSS = `
@keyframes vgx-trace{0%{stroke-dashoffset:1}82%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
@keyframes vgx-sweep{0%{transform:translateX(0)}82%{transform:translateX(${GRAPH_W - GRAPH_X0}px)}100%{transform:translateX(${GRAPH_W - GRAPH_X0}px)}}
.vgx-trace{stroke-dasharray:1;stroke-dashoffset:0;animation:vgx-trace 7s linear infinite}
.vgx-sweep{animation:vgx-sweep 7s linear infinite}
.vgx-paused .vgx-trace,.vgx-paused .vgx-sweep{animation-play-state:paused}
@media (prefers-reduced-motion: reduce){.vgx-trace,.vgx-sweep{animation:none}.vgx-sweep{display:none}}
`;

const COLORS = { p: "#fbbf24", f: "#22d3ee", v: "#c4b5fd", loop: "#fbbf24", ghost: "#e2e8f0" };

function GraphSvg({ graph, compare, showCompare, label }: { graph: VentGraph; compare?: VentGraph; showCompare: boolean; label: string }) {
  const ghost = showCompare && compare ? compare : null;
  return (
    <svg width="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} role="img" aria-label={label} className="block max-w-[420px] mx-auto overflow-hidden">
      {graph.kind === "scalar" ? (
        <>
          <text x="2" y="12" fill="#94a3b8" fontSize="9">P</text>
          <text x="2" y="82" fill="#94a3b8" fontSize="9">Flow</text>
          <text x="2" y="160" fill="#94a3b8" fontSize="9">Vol</text>
          <line x1={GRAPH_X0} y1="96" x2={GRAPH_W} y2="96" stroke="#334155" />
          <line x1={GRAPH_X0} y1="208" x2={GRAPH_W} y2="208" stroke="#334155" />
          <line x1={GRAPH_X0} y1={graph.peepY} x2={GRAPH_W} y2={graph.peepY} stroke="#334155" />
          {graph.refs.map((r, i) => (
            <g key={i}>
              <line x1={GRAPH_X0} y1={r.y} x2={GRAPH_W} y2={r.y} stroke={r.tone === "peak" ? "#fca5a5" : "#86efac"} strokeDasharray="3 3" opacity="0.7" />
              <text x={GRAPH_W - 2} y={r.tone === "peak" ? r.y - 3 : r.y + 10} fill={r.tone === "peak" ? "#fca5a5" : "#86efac"} fontSize="9" fontWeight="700" textAnchor="end">{r.label}</text>
            </g>
          ))}
          {ghost && ghost.kind === "scalar" && (
            <g opacity="0.55" data-testid="vent-compare">
              {[ghost.p, ghost.f, ghost.v].map((d, i) => <path key={i} d={d} fill="none" stroke={COLORS.ghost} strokeWidth="1.5" strokeDasharray="2 3" />)}
            </g>
          )}
          <path className="vgx-trace" pathLength={1} d={graph.p} fill="none" stroke={COLORS.p} strokeWidth="2" strokeLinejoin="round" />
          <path className="vgx-trace" pathLength={1} d={graph.f} fill="none" stroke={COLORS.f} strokeWidth="2" strokeLinejoin="round" />
          <path className="vgx-trace" pathLength={1} d={graph.v} fill="none" stroke={COLORS.v} strokeWidth="2" strokeLinejoin="round" />
          {graph.marks.map((m, i) => <circle key={i} cx={m.x} cy={m.y} r="6" fill="none" stroke="#f87171" strokeWidth="1.5" />)}
          <rect className="vgx-sweep" x={GRAPH_X0} y="0" width="2" height={GRAPH_H} fill="#f8fafc" opacity="0.35" />
        </>
      ) : (
        <>
          <line x1="30" y1="10" x2="30" y2="200" stroke="#334155" />
          <line x1="30" y1={graph.yLabel.startsWith("Flow") ? 90 : 196} x2={GRAPH_W - 6} y2={graph.yLabel.startsWith("Flow") ? 90 : 196} stroke="#334155" />
          <text x="34" y="14" fill="#94a3b8" fontSize="9">{graph.yLabel}</text>
          <text x={GRAPH_W - 6} y="210" fill="#94a3b8" fontSize="9" textAnchor="end">{graph.xLabel}</text>
          {ghost && ghost.kind === "loop" && (
            <path data-testid="vent-compare" d={ghost.path} fill="none" stroke={COLORS.ghost} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.55" />
          )}
          <path className="vgx-trace" pathLength={1} d={graph.path} fill="none" stroke={COLORS.loop} strokeWidth="2.2" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function Card({ card, onOpenTopic }: { card: VentCard; onOpenTopic?: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const [showCompare, setShowCompare] = useState(card.group !== "normal" || card.graph.kind === "loop");
  const abnormal = card.group !== "normal";
  return (
    <section data-testid="vent-card" id={`vent-${card.id}`} className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="px-4 pt-4 pb-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${abnormal ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
            {abnormal ? "Abnormal" : card.graph.kind === "loop" ? "Loop" : "Normal"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{card.mode}</span>
        </div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">{card.title}</h3>
      </div>

      <div className={`mx-3 rounded-xl bg-[#0b1220] px-1.5 pt-2 pb-1.5 ${paused ? "vgx-paused" : ""}`}>
        <GraphSvg graph={card.graph} compare={card.compare?.graph} showCompare={showCompare} label={`${card.title}: animated ventilator curves`} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pt-1.5 text-[11.5px] text-slate-300">
          {card.values.map(([k, v]) => (
            <span key={k}><span className="text-slate-400">{k}</span> <strong className="text-slate-50">{v}</strong></span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 px-3 pt-2.5">
        <button type="button" onClick={() => setPaused((p) => !p)} className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 text-[13px] font-bold cursor-pointer">
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {paused ? "Play" : "Pause"}
        </button>
        {card.compare && (
          <button type="button" aria-pressed={showCompare} onClick={() => setShowCompare((s) => !s)} className={`min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border text-[13px] font-bold cursor-pointer ${showCompare ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"}`}>
            {showCompare ? "Hide normal" : card.compare.label}
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3 text-sm text-slate-800 dark:text-slate-200">
        <div className="space-y-1.5">
          <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">What you see</h4>
          {card.see.map((s, i) => <p key={i} className="flex gap-2 leading-snug"><span className="text-indigo-600 font-extrabold">•</span><span>{s}</span></p>)}
        </div>
        <div className="space-y-1.5">
          <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">{card.causesTitle}</h4>
          <p className="leading-snug">{card.causes}</p>
        </div>
        <div className="space-y-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
          <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">What to do</h4>
          {card.todo.map((d, i) => <p key={i} className="flex gap-2 leading-snug"><span className="text-teal-700 dark:text-teal-400 font-extrabold">{i + 1}</span><span>{d}</span></p>)}
        </div>
        {card.links.length > 0 && onOpenTopic && (
          <div className="flex flex-wrap gap-2">
            {card.links.filter((l) => findTopic(l.id)).map((l) => (
              <button key={l.id} type="button" onClick={() => onOpenTopic(l.id)} className="min-h-[36px] text-[12.5px] font-bold px-3 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 cursor-pointer">
                {l.label} →
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function VentilatorGraphicsPanel({ onOpenTopic }: { onOpenTopic?: (topicId: string) => void }) {
  const [group, setGroup] = useState<VentGroup | "all">("all");
  const cards = useMemo(() => (group === "all" ? VENT_GRAPHICS : VENT_GRAPHICS.filter((c) => c.group === group)), [group]);
  return (
    <div className="space-y-4">
      <style>{CSS}</style>
      <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl"><Activity className="w-5 h-5" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Ventilator graphics</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{VENT_GRAPHICS.length} graphs · normal and abnormal · draft for clinical sign-off</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Read the screen in this order: <strong>pressure</strong> (how hard the ventilator pushes), <strong>flow</strong> (air in above the line, out below), <strong>volume</strong> (how much went in and came back). Tap <strong>Show normal</strong> to lay the normal breath under an abnormal one.
        </p>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700"><span className="w-3.5 h-[3px] rounded bg-amber-500" />Pressure (cmH₂O)</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700"><span className="w-3.5 h-[3px] rounded bg-cyan-600" />Flow (L/min)</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700"><span className="w-3.5 h-[3px] rounded bg-violet-600" />Volume (mL)</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter graphs">
          {VENT_GROUPS.map((g) => (
            <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={`min-h-[36px] px-3 rounded-full text-[12.5px] font-bold border cursor-pointer ${group === g.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map((c) => <Card key={c.id} card={c} onOpenTopic={onOpenTopic} />)}
      </div>

      <details className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-400">
        <summary className="font-bold cursor-pointer text-slate-800 dark:text-slate-200">References</summary>
        <ul className="list-disc pl-5 pt-2 space-y-1">{VENT_GRAPHICS_REFERENCES.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="pt-2">The curves are drawn from a simple breath model to show each pattern clearly; real ventilator screens vary by machine and patient.</p>
      </details>
    </div>
  );
}