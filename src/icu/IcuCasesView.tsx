import React, { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Search } from "lucide-react";
import type { UserProfile, WorkArea } from "../types";
import ModeSwitcher from "../components/shared/ModeSwitcher";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import { ICU_OUTCOMES, ICU_SOURCES, type IcuAdmission, type IcuNote, type IcuUnit } from "./icuTypes";
import { buildIcuNoteText, icuDayNumber } from "./icuLogic";
import { subscribeAllAdmissions, subscribeNotes, subscribeUnits } from "./icuStore";

const IcuNoteView = React.lazy(() => import("./IcuNoteView"));

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;
type Filter = "active" | "closed" | "all";

interface Props {
  profile: UserProfile | null;
  onSwitchMode: (mode: WorkArea) => void;
  notify: Notify;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";

/** Cases tab in ICU mode: every ICU admission, in the ICU now or shifted out. */
export default function IcuCasesView({ profile, onSwitchMode, notify }: Props) {
  const [admissions, setAdmissions] = useState<IcuAdmission[] | null>(null);
  const [units, setUnits] = useState<IcuUnit[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let u1 = () => {};
    let u2 = () => {};
    try {
      u1 = subscribeAllAdmissions(setAdmissions, (e) => setLoadError(e.message));
      u2 = subscribeUnits(setUnits, (e) => setLoadError(e.message));
    } catch (e: any) {
      setLoadError(e?.message || "Could not load ICU cases.");
    }
    return () => { u1(); u2(); };
  }, []);

  const occupiedBeds = useMemo(
    () => new Set((admissions || []).filter((a) => a.status === "active").map((a) => `${a.unitId}|${a.bed}`)),
    [admissions],
  );

  const open = admissions?.find((a) => a.id === openId) || null;

  if (open && open.status === "active") {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Opening note…</div>}>
        <IcuNoteView admission={open} units={units} occupiedBeds={occupiedBeds} profile={profile}
          onBack={() => setOpenId(null)} notify={notify} />
      </Suspense>
    );
  }
  if (open) {
    return <ClosedCase admission={open} profile={profile} onBack={() => setOpenId(null)} notify={notify} />;
  }

  const counts = {
    active: (admissions || []).filter((a) => a.status === "active").length,
    closed: (admissions || []).filter((a) => a.status === "closed").length,
  };
  const q = search.trim().toLowerCase();
  const rows = (admissions || [])
    .filter((a) => (filter === "all" ? true : filter === "active" ? a.status === "active" : a.status === "closed"))
    .filter((a) => !q || [a.patientLabel, a.uhid, a.problemsPreview, a.unitName].some((v) => (v || "").toLowerCase().includes(q)));

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-28 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 tracking-wide">ICU MODE</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ICU cases</h1>
        </div>
        <ModeSwitcher value="ICU" onChange={onSwitchMode} />
      </div>

      <label className="relative block">
        <span className="sr-only">Search ICU cases</span>
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, UHID, problem, unit"
          className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/30" />
      </label>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter ICU cases">
        {([
          ["active", `In ICU · ${counts.active}`], ["closed", `Shifted out · ${counts.closed}`], ["all", "All"],
        ] as [Filter, string][]).map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
            className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-semibold border ${filter === id
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"}`}>
            {text}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">{loadError}</div>
      )}
      {admissions === null && !loadError && <p className="text-sm text-slate-500">Loading ICU cases…</p>}

      <div className="space-y-2" data-coach="icu-cases-list">
        {admissions !== null && rows.length === 0 && (
          <p className={`${card} p-4 text-sm text-slate-600 dark:text-slate-400`}>
            {admissions.length === 0 ? "No ICU cases yet. Admit a patient from the ICU screen." : "No cases match."}
          </p>
        )}
        {rows.map((a) => {
          const days = icuDayNumber(a.admittedAt, a.outcomeAt ? new Date(a.outcomeAt) : new Date());
          const outcome = ICU_OUTCOMES.find((o) => o.id === a.outcome)?.label;
          const moved = a.stays.length > 1 ? ` · moved from ${a.stays[0].unitName}` : "";
          return (
            <button key={a.id} type="button" onClick={() => setOpenId(a.id)}
              className={`${card} w-full text-left p-3 space-y-1.5 hover:border-purple-300 dark:hover:border-purple-700`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{a.patientLabel}</span>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-lg ${a.status === "active"
                  ? "bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200"
                  : a.outcome === "DEATH"
                    ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>
                  {a.status === "active" ? `In ICU · Day ${days}` : outcome || "Closed"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {a.unitName} · Bed {a.bed}{moved}
                {a.status === "closed" ? ` · ${days} day${days === 1 ? "" : "s"}` : ` · from ${ICU_SOURCES.find((s) => s.id === a.source)?.label || a.source}`}
                {a.uhid ? ` · UHID ${a.uhid}` : ""}
              </p>
              {a.problemsPreview && <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{a.problemsPreview}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A closed ICU stay: stay history and every note, read-only, each with Copy to EMR. */
function ClosedCase({ admission, profile, onBack, notify }: {
  admission: IcuAdmission; profile: UserProfile | null; onBack: () => void; notify: Notify;
}) {
  const [notes, setNotes] = useState<IcuNote[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = subscribeNotes(admission.id, setNotes, (e) => notify("Could not load notes", e.message, "warning"));
    } catch (e: any) {
      notify("Could not load notes", e?.message || "", "warning");
    }
    return () => unsub();
  }, [admission.id]);

  const outcome = ICU_OUTCOMES.find((o) => o.id === admission.outcome)?.label || "Closed";

  const copy = async (n: IcuNote) => {
    const text = buildIcuNoteText(n, admission, { name: profile?.name || null, designation: profile?.displayRole || null },
      new Date(n.createdAt));
    const ok = await copyTextToClipboard(text);
    if (ok) { setCopied(n.id); setTimeout(() => setCopied((k) => (k === n.id ? null : k)), 1800); }
    else notify("Copy failed", "Your browser blocked the clipboard.", "warning");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-28 space-y-4">
      <button type="button" onClick={onBack} className="min-h-[44px] flex items-center gap-1 text-sm font-medium text-purple-700 dark:text-purple-300">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> ICU cases
      </button>
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{admission.patientLabel}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {outcome}{admission.outcomeAt ? ` · ${new Date(admission.outcomeAt).toLocaleString()}` : ""}
        </p>
      </div>

      <section className="space-y-1.5">
        <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide px-1">ICU stay</h2>
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {admission.stays.map((s, i) => (
            <div key={`${s.unitId}-${s.inAt}-${i}`} className="p-3 text-sm text-slate-800 dark:text-slate-200">
              {s.unitName} · Bed {s.bed}
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {new Date(s.inAt).toLocaleString()} → {s.outAt ? new Date(s.outAt).toLocaleString() : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide px-1">Notes</h2>
        {notes === null && <p className="text-sm text-slate-500">Loading…</p>}
        {notes !== null && notes.length === 0 && <p className={`${card} p-3 text-sm text-slate-500`}>No notes for this stay.</p>}
        <div className="space-y-2">
          {(notes || []).map((n) => (
            <div key={n.id} className={`${card} p-3 flex items-center gap-2`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {n.kind === "admission" ? "Admission note" : "Daily note"} · {new Date(n.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{n.status === "signed" ? "Signed" : "Draft · not signed"}</p>
              </div>
              <button type="button" onClick={() => copy(n)}
                className="min-h-[40px] px-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-1.5">
                {copied === n.id ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />}
                {copied === n.id ? "Copied" : "Copy to EMR"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}