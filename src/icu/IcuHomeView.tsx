import React, { Suspense, useEffect, useMemo, useState } from "react";
import { HeartPulse, Plus, BedDouble, AlertTriangle, X } from "lucide-react";
import type { UserProfile, WorkArea } from "../types";
import ModeSwitcher from "../components/shared/ModeSwitcher";
import { ICU_SOURCES, ICU_UNIT_TYPES, type IcuAdmission, type IcuAdmissionSource, type IcuUnit, type IcuUnitType } from "./icuTypes";
import { admitPatient, createUnit, subscribeActiveAdmissions, subscribeUnits } from "./icuStore";
import { icuDayNumber } from "./icuLogic";

const IcuNoteView = React.lazy(() => import("./IcuNoteView"));

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;

interface Props {
  profile: UserProfile | null;
  onSwitchMode: (mode: WorkArea) => void;
  notify: Notify;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";
const input = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/30";
const label = "text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide";

export default function IcuHomeView({ profile, onSwitchMode, notify }: Props) {
  const [units, setUnits] = useState<IcuUnit[] | null>(null);
  const [admissions, setAdmissions] = useState<IcuAdmission[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [openAdmissionId, setOpenAdmissionId] = useState<string | null>(null);
  const [showUnitSetup, setShowUnitSetup] = useState(false);
  const [admitBed, setAdmitBed] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let u1 = () => {};
    let u2 = () => {};
    try {
      u1 = subscribeUnits(setUnits, (e) => setLoadError(e.message));
      u2 = subscribeActiveAdmissions(setAdmissions, (e) => setLoadError(e.message));
    } catch (e: any) {
      setLoadError(e?.message || "Could not load ICU.");
    }
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (units && units.length && (!unitId || !units.some((u) => u.id === unitId))) setUnitId(units[0].id);
  }, [units, unitId]);

  const unit = units?.find((u) => u.id === unitId) || null;
  const occupiedBeds = useMemo(() => new Set(admissions.map((a) => `${a.unitId}|${a.bed}`)), [admissions]);
  const openAdmission = admissions.find((a) => a.id === openAdmissionId) || null;

  if (openAdmission && units) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Opening note…</div>}>
        <IcuNoteView
          admission={openAdmission}
          units={units}
          occupiedBeds={occupiedBeds}
          profile={profile}
          onBack={() => setOpenAdmissionId(null)}
          notify={notify}
        />
      </Suspense>
    );
  }

  const unitAdmissions = admissions.filter((a) => a.unitId === unitId);
  const gapTotal = unitAdmissions.reduce((n, a) => n + (a.fastHugsGapCount || 0), 0);
  const flagTotal = unitAdmissions.reduce((n, a) => n + (a.openFlagCount || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-28 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 tracking-wide">OTHER MODES</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-purple-600" aria-hidden="true" /> ICU
          </h1>
        </div>
        <ModeSwitcher value="ICU" onChange={onSwitchMode} />
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">
          {loadError}
        </div>
      )}

      {units === null && !loadError && <p className="text-sm text-slate-500">Loading ICU…</p>}

      {units && units.length === 0 && !showUnitSetup && (
        <div className={`${card} p-5 space-y-3`}>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Set up your ICU</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add each unit you work in, for example MICU 1, Neuro ICU or CCU, with its number of beds.
          </p>
          <button type="button" onClick={() => setShowUnitSetup(true)} data-coach="icu-add-unit"
            className="min-h-[44px] px-4 rounded-xl bg-purple-600 text-white text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> Add ICU unit
          </button>
        </div>
      )}

      {showUnitSetup && (
        <UnitSetup
          onCancel={() => setShowUnitSetup(false)}
          onCreate={async (name, type, beds) => {
            try {
              const u = await createUnit({ name, type, bedCount: beds });
              setUnitId(u.id);
              setShowUnitSetup(false);
              notify("ICU unit added", `${u.name} with ${u.beds.length} beds is ready.`, "success");
            } catch (e: any) {
              notify("Could not add unit", e?.message || "Please try again.", "warning");
            }
          }}
        />
      )}

      {units && units.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="ICU units" data-coach="icu-units">
            {units.map((u) => (
              <button key={u.id} type="button" role="tab" aria-selected={u.id === unitId}
                onClick={() => setUnitId(u.id)}
                className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-semibold border ${
                  u.id === unitId
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                }`}>
                {u.name}
              </button>
            ))}
            <button type="button" onClick={() => setShowUnitSetup(true)} aria-label="Add ICU unit"
              className="shrink-0 min-h-[40px] px-3 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat value={unitAdmissions.length} label="Occupied" />
            <Stat value={gapTotal} label="FAST HUGS gaps" tone={gapTotal ? "amber" : undefined} />
            <Stat value={flagTotal} label="To clarify" tone={flagTotal ? "amber" : undefined} />
          </div>

          {unit && (
            <div className="space-y-2" data-coach="icu-beds">
              {unit.beds.map((bed) => {
                const adm = unitAdmissions.find((a) => a.bed === bed);
                if (!adm) {
                  return (
                    <div key={bed} className={`${card} border-dashed p-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center justify-center">{bed}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">Empty</span>
                      </div>
                      <button type="button" onClick={() => setAdmitBed(bed)}
                        className="min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
                        Admit
                      </button>
                    </div>
                  );
                }
                return (
                  <button key={bed} type="button" onClick={() => setOpenAdmissionId(adm.id)}
                    className={`${card} w-full text-left p-3 space-y-2 hover:border-purple-300 dark:hover:border-purple-700`}>
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center">{bed}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{adm.patientLabel}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          ICU day {icuDayNumber(adm.admittedAt)} · from {ICU_SOURCES.find((s) => s.id === adm.source)?.label || adm.source}
                        </p>
                      </div>
                    </div>
                    {adm.problemsPreview && <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{adm.problemsPreview}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {adm.supportChips.map((c) => (
                        <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{c}</span>
                      ))}
                      {adm.fastHugsGapCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200">
                          {adm.fastHugsGapCount} FAST HUGS not reviewed
                        </span>
                      )}
                      {adm.openFlagCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {adm.openFlagCount} to clarify
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {admitBed && unit && (
        <AdmitSheet
          unit={unit}
          bed={admitBed}
          onCancel={() => setAdmitBed(null)}
          onAdmit={async (form) => {
            try {
              const adm = await admitPatient({ unit, bed: admitBed, occupiedBeds, ...form });
              setAdmitBed(null);
              setOpenAdmissionId(adm.id);
            } catch (e: any) {
              notify("Could not admit", e?.message || "Please try again.", "warning");
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({ value, label: text, tone }: { value: number; label: string; tone?: "amber" }) {
  return (
    <div className={`${card} p-3`}>
      <p className={`text-xl font-bold ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white"}`}>{value}</p>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}

function UnitSetup({ onCreate, onCancel }: { onCreate: (n: string, t: IcuUnitType, beds: number) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<IcuUnitType>("MICU");
  const [beds, setBeds] = useState("10");
  const [busy, setBusy] = useState(false);
  return (
    <form className={`${card} p-4 space-y-3`} onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      await onCreate(name, type, Number(beds));
      setBusy(false);
    }}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Add ICU unit</h2>
        <button type="button" onClick={onCancel} aria-label="Close" className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
      </div>
      <label className="block space-y-1"><span className={label}>Unit name</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MICU 1" maxLength={40} required />
      </label>
      <label className="block space-y-1"><span className={label}>Unit type</span>
        <select className={input} value={type} onChange={(e) => setType(e.target.value as IcuUnitType)}>
          {ICU_UNIT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="block space-y-1"><span className={label}>Number of beds</span>
        <input className={input} type="number" min={1} max={60} value={beds} onChange={(e) => setBeds(e.target.value)} required />
      </label>
      <button type="submit" disabled={busy} className="w-full min-h-[44px] rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-60">
        {busy ? "Saving…" : "Add unit"}
      </button>
    </form>
  );
}

function AdmitSheet({ unit, bed, onAdmit, onCancel }: {
  unit: IcuUnit; bed: string; onCancel: () => void;
  onAdmit: (f: { patientLabel: string; uhid?: string; ageYears: number | null; sex: "M" | "F" | "Other" | null; source: IcuAdmissionSource }) => Promise<void>;
}) {
  const [patientLabel, setPatientLabel] = useState("");
  const [uhid, setUhid] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"" | "M" | "F" | "Other">("");
  const [source, setSource] = useState<IcuAdmissionSource>("ER");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={`Admit to ${unit.name} bed ${bed}`}>
      <form className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ageNum = age.trim() === "" ? null : Number(age);
          await onAdmit({ patientLabel, uhid, ageYears: ageNum !== null && Number.isFinite(ageNum) ? ageNum : null, sex: sex || null, source });
          setBusy(false);
        }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-purple-600" aria-hidden="true" /> {unit.name} · Bed {bed}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <label className="block space-y-1"><span className={label}>Patient name / label *</span>
          <input className={input} value={patientLabel} onChange={(e) => setPatientLabel(e.target.value)} maxLength={100} required />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1 col-span-1"><span className={label}>Age</span>
            <input className={input} type="number" min={0} max={129} value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
          <label className="block space-y-1 col-span-2"><span className={label}>Sex</span>
            <select className={input} value={sex} onChange={(e) => setSex(e.target.value as any)}>
              <option value="">Not stated</option><option value="M">Male</option><option value="F">Female</option><option value="Other">Other</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1"><span className={label}>UHID (optional)</span>
          <input className={input} value={uhid} onChange={(e) => setUhid(e.target.value)} maxLength={40} />
        </label>
        <label className="block space-y-1"><span className={label}>Admitted from</span>
          <select className={input} value={source} onChange={(e) => setSource(e.target.value as IcuAdmissionSource)}>
            {ICU_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {unit.type === "PICU" && (
          <p className="text-xs text-slate-600 dark:text-slate-400">PICU: paediatric rules apply for patients under 16.</p>
        )}
        <button type="submit" disabled={busy} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60">
          {busy ? "Admitting…" : "Admit and open note"}
        </button>
      </form>
    </div>
  );
}