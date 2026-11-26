import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search, Minus, Plus, Copy, TriangleAlert, Check } from "lucide-react";
import {
  DRUG_DILUTIONS, DILUTION_CATEGORIES, DILUTIONS_DISCLAIMER, DEFAULT_WEIGHT,
  DrugCategory, PatientGroup, DilutionDrug, regimenFor, searchDrugs,
  concentrationLabel, pumpRate, formatRate, rateWorking, outsideRange, bolusLabel, copyText, fmt, round3,
} from "../data/drugDilutions";

/**
 * Drug dilutions: Dashboard › Quick tools (26 Nov 2026).
 * Reference only, adult and paediatric (< 16 y). Full-screen sheet over the dashboard.
 */
interface Props {
  onClose: () => void;
}

const CAT_STYLE: Record<DrugCategory, { bar: string; text: string; head: string }> = {
  "Pressors": { bar: "bg-rose-600", text: "text-rose-700 dark:text-rose-300", head: "bg-rose-50 dark:bg-rose-950/40" },
  "Cardiac": { bar: "bg-orange-600", text: "text-orange-700 dark:text-orange-300", head: "bg-orange-50 dark:bg-orange-950/40" },
  "RSI / sedation": { bar: "bg-indigo-600", text: "text-indigo-700 dark:text-indigo-300", head: "bg-indigo-50 dark:bg-indigo-950/40" },
  "Electrolytes": { bar: "bg-teal-600", text: "text-teal-700 dark:text-teal-300", head: "bg-teal-50 dark:bg-teal-950/40" },
  "GI bleed": { bar: "bg-amber-600", text: "text-amber-700 dark:text-amber-300", head: "bg-amber-50 dark:bg-amber-950/40" },
  "Antidotes": { bar: "bg-violet-600", text: "text-violet-700 dark:text-violet-300", head: "bg-violet-50 dark:bg-violet-950/40" },
};

const stepBtn = "w-11 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-40";

export default function DrugDilutionsView({ onClose }: Props) {
  const [group, setGroup] = useState<PatientGroup>("adult");
  const [weights, setWeights] = useState<Record<PatientGroup, number>>({ ...DEFAULT_WEIGHT });
  const [cat, setCat] = useState<DrugCategory | "All">("All");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string>(DRUG_DILUTIONS[0].id);
  const [doses, setDoses] = useState<Record<string, number>>({});
  const [amts, setAmts] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const w = weights[group];
  const key = (id: string) => `${group}:${id}`;
  const list = useMemo(() => searchDrugs(q, cat), [q, cat]);
  const drug: DilutionDrug = DRUG_DILUTIONS.find((d) => d.id === selId) || DRUG_DILUTIONS[0];
  const reg = regimenFor(drug, group);
  const inf = reg?.inf ?? null;
  const amt = inf ? amts[key(drug.id)] ?? inf.amt : 0;
  const dose = inf ? doses[key(drug.id)] ?? inf.start : 0;
  const rate = inf ? pumpRate(inf, dose, w, amt) : null;
  const style = CAT_STYLE[drug.cat];

  const setWeight = (delta: number) => setWeights((p) => {
    const cur = p[group];
    const step = group === "paed" ? (delta > 0 ? (cur >= 10 ? 5 : 1) : (cur > 10 ? 5 : 1)) : 5;
    const next = cur + Math.sign(delta) * step;
    const [min, max] = group === "paed" ? [1, 80] : [30, 200];
    return { ...p, [group]: Math.min(max, Math.max(min, next)) };
  });
  const setDose = (delta: number) => inf && setDoses((p) => ({ ...p, [key(drug.id)]: Math.max(inf.doseStep, round3(dose + delta * inf.doseStep)) }));
  const setAmt = (delta: number) => inf && setAmts((p) => ({ ...p, [key(drug.id)]: Math.max(inf.amtStep, round3(amt + delta * inf.amtStep)) }));

  const doCopy = async () => {
    const text = `${copyText(drug, group, w, inf ? dose : undefined, inf ? amt : undefined)}\n(Reference: ${reg?.source ?? "—"})`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  const rightLabel = (d: DilutionDrug) => {
    const r = regimenFor(d, group);
    if (!r) return "Adult only";
    if (!r.inf) return "Bolus";
    return concentrationLabel(r.inf, amts[key(d.id)] ?? r.inf.amt);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Drug dilutions" data-testid="drug-dilutions" className="fixed inset-0 z-[60] bg-slate-100 dark:bg-slate-950 overflow-y-auto">
      <div className="max-w-xl mx-auto pb-10">
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={onClose} aria-label="Back to Dashboard" className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-rose-700 dark:text-rose-300">Dashboard</span>
            <h1 className="text-[19px] font-extrabold text-slate-900 dark:text-white leading-tight">Drug dilutions</h1>
          </div>
        </div>

        <div className="mx-4 mt-3 flex gap-2.5 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3" data-testid="dilutions-disclaimer">
          <TriangleAlert className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-[13px] leading-snug text-amber-900 dark:text-amber-200"><strong>Reference only.</strong> {DILUTIONS_DISCLAIMER.replace(/^Reference only\.\s*/, "")}</p>
        </div>

        <div className="px-4 pt-3 space-y-2.5">
          <div role="group" aria-label="Patient group" className="flex gap-1 p-1 rounded-2xl bg-slate-200 dark:bg-slate-800">
            {(["adult", "paed"] as PatientGroup[]).map((g) => (
              <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}
                className={`flex-1 min-h-[44px] rounded-xl text-[14px] font-extrabold cursor-pointer ${group === g ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}>
                {g === "adult" ? "Adult" : "Paediatric (< 16 y)"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 pl-3.5 pr-2">
            <div>
              <span className="block text-[14px] font-extrabold text-slate-900 dark:text-white">Weight</span>
              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{group === "paed" ? "Measured, or tape estimate (e.g. Broselow)" : "Actual or ideal body weight"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Weight down" className={stepBtn} onClick={() => setWeight(-1)}><Minus className="w-5 h-5" /></button>
              <span className="min-w-[64px] text-center text-[17px] font-extrabold text-slate-900 dark:text-white" data-testid="dilution-weight">{w} kg</span>
              <button type="button" aria-label="Weight up" className={stepBtn} onClick={() => setWeight(1)}><Plus className="w-5 h-5" /></button>
            </div>
          </div>

          <label className="flex items-center gap-2 min-h-[46px] rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3">
            <Search className="w-4.5 h-4.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search drug, e.g. "nor", "kcl"' aria-label="Search drug"
              className="flex-1 bg-transparent outline-none text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400" />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {(["All", ...DILUTION_CATEGORIES] as (DrugCategory | "All")[]).map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
                className={`shrink-0 min-h-[36px] px-3 rounded-full text-[13px] font-bold border cursor-pointer ${cat === c ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-2 space-y-2">
          <span className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{cat === "All" ? "All drugs" : cat} · {list.length}</span>
          {list.length === 0 && <p className="text-[14px] text-slate-500 dark:text-slate-400 py-3">No drug matches “{q}”.</p>}
          {list.map((d) => {
            const on = d.id === drug.id, has = !!regimenFor(d, group);
            return (
              <button key={d.id} type="button" onClick={() => setSelId(d.id)} aria-current={on ? "true" : undefined}
                className={`w-full text-left flex items-center gap-2.5 min-h-[58px] px-3 py-2.5 rounded-2xl cursor-pointer ${on ? "border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/30" : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"} ${has ? "" : "opacity-60"}`}>
                <span className={`w-1.5 self-stretch rounded ${CAT_STYLE[d.cat].bar}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-extrabold text-slate-900 dark:text-white">{d.name}</span>
                  <span className="block text-[12.5px] text-slate-500 dark:text-slate-400">{d.ampoule}</span>
                </span>
                <span className="text-[12.5px] font-extrabold text-slate-900 dark:text-white text-right">{rightLabel(d)}</span>
              </button>
            );
          })}
        </div>

        <section className="mx-4 mt-4 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" data-testid="dilution-detail">
          <div className={`px-3.5 pt-3.5 pb-3 ${style.head}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${style.text}`}>{drug.cat}</span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900">{group === "paed" ? `Paediatric · ${w} kg` : "Adult"}</span>
            </div>
            <h2 className="text-[21px] font-extrabold text-slate-900 dark:text-white mt-1">{drug.name}</h2>
            <span className="text-[13.5px] text-slate-700 dark:text-slate-300">Common ampoule: <strong>{drug.ampoule}</strong></span>
          </div>

          {!reg && (
            <p className="m-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-[14px] text-red-900 dark:text-red-200">
              No paediatric standard in this list. Discuss with a senior or the PICU team.
            </p>
          )}

          {reg && (
            <div className="p-3.5 space-y-2.5">
              {reg.bolus.map((b) => {
                const calc = bolusLabel(b, w);
                return (
                  <div key={b.label} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <span className="block text-[12px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">{b.label}</span>
                    <p className="text-[14.5px] leading-snug text-slate-900 dark:text-slate-100 mt-0.5">{b.text}</p>
                    {calc && <span className="inline-block mt-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[14px] font-extrabold text-rose-900 dark:text-rose-200">{calc}</span>}
                  </div>
                );
              })}

              {inf && (
                <>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                    <span className="block text-[12px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Infusion: how to make it</span>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[14px] font-bold text-slate-900 dark:text-white">Drug in syringe</span>
                        <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">Change to match your stock</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" aria-label="Less drug" className={stepBtn} onClick={() => setAmt(-1)} disabled={amt <= inf.amtStep}><Minus className="w-4 h-4" /></button>
                        <span className="min-w-[72px] text-center text-[15px] font-extrabold text-slate-900 dark:text-white">{fmt(amt)} {inf.au}</span>
                        <button type="button" aria-label="More drug" className={stepBtn} onClick={() => setAmt(1)}><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="text-[14.5px] text-slate-900 dark:text-slate-100">{fmt(amt)} {inf.au} made up to {inf.vol} ml with {inf.diluent}.</p>
                    <div className="flex items-center justify-between rounded-lg bg-slate-900 dark:bg-black px-3 py-2">
                      <span className="text-[12.5px] text-slate-300">Final strength</span>
                      <span className="text-[17px] font-extrabold text-white" data-testid="dilution-conc">{concentrationLabel(inf, amt)}</span>
                    </div>
                    <span className="block text-[12.5px] text-slate-600 dark:text-slate-400">Usual range: {fmt(inf.lo)}–{fmt(inf.hi)} {inf.unit}</span>
                  </div>

                  <div className="rounded-2xl border-2 border-rose-600 p-3 space-y-2.5">
                    <span className="block text-[12px] font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-300">Pump rate</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold text-slate-900 dark:text-white">Dose</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" aria-label="Dose down" className={stepBtn} onClick={() => setDose(-1)} disabled={dose <= inf.doseStep}><Minus className="w-5 h-5" /></button>
                        <span className="min-w-[118px] text-center text-[15px] font-extrabold text-slate-900 dark:text-white">{fmt(dose)} {inf.unit}</span>
                        <button type="button" aria-label="Dose up" className={stepBtn} onClick={() => setDose(1)}><Plus className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3" aria-live="polite">
                      <span className="text-[12.5px] font-bold text-rose-800 dark:text-rose-300">Set the pump at</span>
                      <span className="text-[32px] font-extrabold text-rose-900 dark:text-rose-100" data-testid="dilution-rate">{rate != null ? formatRate(rate) : "—"} <span className="text-[16px]">ml/h</span></span>
                      <span className="text-[12px] text-rose-800 dark:text-rose-300 text-center">{rateWorking(inf, dose, w, amt)}</span>
                    </div>
                    {outsideRange(inf, dose) && (
                      <p className="rounded-lg bg-amber-100 dark:bg-amber-950/50 px-2.5 py-2 text-[13px] font-bold text-amber-900 dark:text-amber-200">Outside the usual range. Recheck before you start.</p>
                    )}
                  </div>
                </>
              )}

              {reg.flags.map((f) => (
                <div key={f} className="flex gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-2.5 py-2 text-[13.5px] leading-snug text-red-900 dark:text-red-200">
                  <span className="font-extrabold">!</span><span>{f}</span>
                </div>
              ))}

              <button type="button" onClick={doCopy} className="w-full min-h-[44px] rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 text-[13.5px] font-bold flex items-center justify-center gap-2 cursor-pointer">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy to case sheet"}
              </button>
              <span className="block text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">Based on: {reg.source}</span>
            </div>
          )}
        </section>

        <p className="mx-4 mt-4 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          Paediatric doses are per kg and never above the adult maximum. Change the drug in the syringe to match your stock; the final strength and pump rate update.
        </p>
      </div>
    </div>
  );
}