import React, { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, GraduationCap, MessageSquare, Mic, TrendingUp } from "lucide-react";
import type { UserProfile } from "../types";
import type { ChatContext } from "../hooks/useBoundChat";
import { FAST_HUGS_ITEMS, icuDayNumber } from "./icuLogic";
import type { IcuAdmission, IcuNote, IcuUnit } from "./icuTypes";
import { subscribeNotes } from "./icuStore";
import { buildTrends, noteAnchor, type TrendSeries } from "./icuTrends";
import { buildIcuDiscussRecord } from "./icuDiscussContext";
import { requestTour } from "../lib/coachTours";

const IcuNoteView = React.lazy(() => import("./IcuNoteView"));
const IcuTrendsView = React.lazy(() => import("./IcuTrendsView"));
const CaseChatWorkspace = React.lazy(() => import("../components/CaseChatWorkspace"));

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;

interface Props {
  unit: IcuUnit;
  units: IcuUnit[];
  /** active admissions across all units */
  admissions: IcuAdmission[];
  occupiedBeds: Set<string>;
  profile: UserProfile | null;
  notify: Notify;
  onClose: () => void;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";
const tileBtn = "min-h-[64px] rounded-2xl bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900 flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] transition-transform";

const bedSort = (a: IcuAdmission, b: IcuAdmission) => a.bed.localeCompare(b.bed, undefined, { numeric: true, sensitivity: "base" });

function clockOf(t: number): string {
  const d = new Date(t);
  const hh = d.getHours();
  const mm = d.getMinutes();
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`;
}

function relativeWhen(iso: string, admittedAt: string, now: Date): string {
  const d = new Date(iso);
  const day = icuDayNumber(admittedAt, d);
  const today = icuDayNumber(admittedAt, now);
  const prefix = day === today ? "today" : day === today - 1 ? "yesterday" : `Day ${day}`;
  return `${prefix} ${clockOf(d.getTime())}`;
}

/** Bed-by-bed ICU rounds for one unit. */
export default function IcuRoundsView({ unit, units, admissions, occupiedBeds, profile, notify, onClose }: Props) {
  const beds = useMemo(() => admissions.filter((a) => a.unitId === unit.id).sort(bedSort), [admissions, unit.id]);
  const [idx, setIdx] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<IcuNote[] | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [chatMode, setChatMode] = useState<"discuss" | "rounds" | null>(null);

  const safeIdx = Math.min(idx, Math.max(0, beds.length - 1));
  const adm = beds[safeIdx] || null;

  useEffect(() => {
    if (!adm) return;
    setNotes(null);
    setNoteError(null);
    setVisited((v) => (v.has(adm.id) ? v : new Set(v).add(adm.id)));
    let unsub = () => {};
    try {
      unsub = subscribeNotes(adm.id, setNotes, (e) => setNoteError(e.message));
    } catch (e: any) {
      setNoteError(e?.message || "Could not load notes.");
    }
    return () => unsub();
  }, [adm?.id]);

  // Walkthrough for the rounds screen, once the first bed has loaded and nothing covers it.
  useEffect(() => {
    if (notes !== null && !openNote && !showTrends && !chatMode) requestTour("icurounds");
  }, [notes !== null, openNote, showTrends, chatMode]);

  const now = useMemo(() => new Date(), [notes, adm?.id]);
  const sorted = useMemo(() => (notes ? [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []), [notes]);
  const latest = sorted[sorted.length - 1] || null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const trends = useMemo(() => (adm && notes ? buildTrends(adm, notes, now) : null), [adm, notes, now]);

  // "Since the last note": series with a reading newer than the previous note's anchor
  const tiles = useMemo(() => {
    if (!trends || !adm) return [] as { label: string; value: string; sub: string; warn?: boolean }[];
    const since = previous ? new Date(noteAnchor(previous)).getTime() : new Date(adm.admittedAt).getTime() - 1;
    const fresh = trends.series
      .filter((s) => s.latest && s.latest.t > since)
      .sort((a, b) => (b.latest!.t - a.latest!.t) || (a.group === "lab" ? -1 : 1))
      .slice(0, 5);
    const out: { label: string; value: string; sub: string; warn?: boolean }[] = fresh.map((s: TrendSeries) => {
      const real = s.points.filter((p) => p.v !== null);
      const prev = real.length > 1 ? real[real.length - 2].v : null;
      return {
        label: s.label,
        value: prev !== null ? `${prev} → ${s.latest!.v}` : `${s.latest!.v}`,
        sub: s.latest!.approx ? "time not stated" : clockOf(s.latest!.t),
      };
    });
    // On pressors with no MAP documented in the last 24 h → say so (never guess a value)
    const onPressors = (adm.supportChips || []).includes("Pressors");
    const map = trends.series.find((s) => s.key === "vital:MAP");
    if (onPressors && (!map?.latest || map.latest.t < now.getTime() - 24 * 3_600_000)) {
      out.push({ label: "MAP", value: "Not documented", sub: "last 24 h", warn: true });
    }
    return out.slice(0, 6);
  }, [trends, previous, adm, now]);

  // "To address this round" — straight from the latest note
  const toAddress = useMemo(() => {
    const items: string[] = [];
    if (!adm) return items;
    if (!latest) {
      items.push("No note written yet for this stay");
      return items;
    }
    if (latest.status !== "signed") items.push("Latest note is a draft — not signed");
    for (const t of latest.tasks) {
      if (t.done) continue;
      if (t.dueAt && new Date(t.dueAt).getTime() < now.getTime()) items.push(`Overdue: ${t.what} (${t.when}) — not ticked`);
      else if (!t.dueAt && /stat/i.test(t.when)) items.push(`STAT not ticked: ${t.what}`);
    }
    for (const f of latest.flags) if (!f.resolved) items.push(`To clarify: ${f.order} — ${f.issue}`);
    const gaps = FAST_HUGS_ITEMS.filter((it) => latest.fastHugs[it.key]?.status === "not_reviewed").map((it) => it.label.toLowerCase());
    if (gaps.length) items.push(`FAST HUGS not reviewed: ${gaps.length > 5 ? `${gaps.slice(0, 5).join(", ")} +${gaps.length - 5}` : gaps.join(", ")}`);
    const cp = latest.sections.problems.filter((p) => p.carried && p.status === "active").length;
    const cd = latest.devices.filter((d) => d.carried && d.status !== "removed").length;
    if (cp || cd) items.push(`Carried forward, not confirmed: ${[cp ? `${cp} problem${cp > 1 ? "s" : ""}` : "", cd ? `${cd} line${cd > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}`);
    return items;
  }, [adm, latest, now]);

  const chatContext: ChatContext | null = useMemo(() => {
    if (!adm || !notes) return null;
    const rec = buildIcuDiscussRecord(adm, notes, now);
    return {
      type: "icu",
      id: adm.id,
      canEdit: false,
      data: {
        icuRecord: rec.text,
        icuDay: rec.icuDay,
        unitLabel: adm.unitName,
        bed: adm.bed,
        patient: {
          age: adm.ageYears,
          gender: adm.sex === "M" ? "Male" : adm.sex === "F" ? "Female" : adm.sex === "Other" ? "Other" : null,
        },
      },
    };
  }, [adm, notes, now]);

  // ── Sub-screens ──
  if (adm && openNote) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Opening note…</div>}>
        <IcuNoteView
          admission={adm}
          units={units}
          occupiedBeds={occupiedBeds}
          profile={profile}
          onBack={() => setOpenNote(false)}
          notify={notify}
        />
      </Suspense>
    );
  }

  if (beds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-28 space-y-4">
        <button type="button" onClick={onClose} className="min-h-[44px] -ml-2 px-2 flex items-center gap-1 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <ArrowLeft className="w-4 h-4" /> ICU
        </button>
        <div className={`${card} p-5 text-sm text-slate-600 dark:text-slate-300`}>No patients in {unit.name} right now.</div>
      </div>
    );
  }

  const icuDay = adm ? icuDayNumber(adm.admittedAt, now) : 1;
  const lastNoteLine = latest
    ? `last note ${relativeWhen(noteAnchor(latest), adm!.admittedAt, now)} (${latest.status === "signed" ? "signed" : "draft"})`
    : "no note yet";
  const latestIsToday = !!latest && icuDayNumber(adm!.admittedAt, new Date(latest.createdAt)) === icuDay;
  const noteBtn = latestIsToday && latest!.status !== "signed" ? `Continue today's note for Bed ${adm!.bed}` : latestIsToday ? `Open today's note for Bed ${adm!.bed}` : `Start today's note for Bed ${adm!.bed}`;
  const hour = now.getHours();
  const session = hour < 12 ? "MORNING ROUNDS" : hour < 17 ? "AFTERNOON ROUNDS" : "EVENING ROUNDS";
  const prevBed = safeIdx > 0 ? beds[safeIdx - 1] : null;
  const nextBed = safeIdx < beds.length - 1 ? beds[safeIdx + 1] : null;

  return (
    <div className="max-w-3xl mx-auto pb-44 md:pb-28 flex flex-col min-h-full">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="min-h-[44px] -ml-2 px-2 flex items-center gap-1 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <ArrowLeft className="w-4 h-4" /> ICU
          </button>
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950 px-2.5 py-1 rounded-full">
            Bed {safeIdx + 1} of {beds.length}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 tracking-wide">{session} · {unit.name.toUpperCase()}</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">Bed {adm!.bed} · {adm!.patientLabel || "Unnamed"}</span>
          <span className="text-[13px] text-slate-500 dark:text-slate-400">ICU day {icuDay} · {lastNoteLine}</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {beds.map((b, i) => (
            <span
              key={b.id}
              className={`flex-1 h-1 rounded-full ${i === safeIdx ? "bg-violet-700" : visited.has(b.id) ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>
      </header>

      <main className="px-4 py-4 flex flex-col gap-3">
        {noteError && <div className={`${card} p-3 text-sm text-rose-700`}>{noteError}</div>}

        <section className={`${card} p-3 flex flex-col gap-1`}>
          <span className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400">ACTIVE PROBLEMS</span>
          <span className="text-[13px] leading-snug text-slate-900 dark:text-white">{adm!.problemsPreview || "Not documented"}</span>
          {(adm!.supportChips || []).length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">On: {adm!.supportChips.join(" · ")}</span>
          )}
        </section>

        <section className={`${card} p-3 flex flex-col gap-2`}>
          <span className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400">SINCE THE LAST NOTE</span>
          {notes === null ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : tiles.length === 0 ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">No new numeric readings documented since the previous note.</span>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {tiles.map((t, i) => (
                <div key={i} className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.label}</span>
                  <span className="text-[15px] font-bold text-slate-900 dark:text-white truncate">{t.value}</span>
                  <span className={`text-[10px] ${t.warn ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>{t.sub}</span>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setShowTrends(true)} className="self-start text-xs font-semibold text-violet-700 dark:text-violet-300 min-h-[32px]">
            See full trends ›
          </button>
        </section>

        {toAddress.length > 0 && (
          <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3 flex flex-col gap-1" data-coach="icu-rounds-address">
            <span className="text-[13px] font-bold text-amber-900 dark:text-amber-200">To address this round</span>
            {toAddress.map((t, i) => (
              <span key={i} className="text-xs text-amber-900 dark:text-amber-200">• {t}</span>
            ))}
          </section>
        )}

        <div className="grid grid-cols-3 gap-2" data-coach="icu-rounds-partners">
          <button type="button" className={tileBtn} disabled={!chatContext} onClick={() => setChatMode("discuss")}>
            <span className="text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />Discuss</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Ask about this bed</span>
          </button>
          <button type="button" className={tileBtn} disabled={!chatContext} onClick={() => setChatMode("rounds")}>
            <span className="text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />7-lens</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Teaching rounds</span>
          </button>
          <button type="button" className={tileBtn} disabled={!notes} onClick={() => setShowTrends(true)}>
            <span className="text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Trends</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Whole stay</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpenNote(true)}
          className="min-h-[52px] rounded-2xl bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center gap-2 text-[15px] font-semibold"
        >
          <Mic className="w-4 h-4" /> {noteBtn}
        </button>
      </main>

      <nav className="fixed left-0 right-0 bottom-16 md:bottom-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 py-3" aria-label="Move between beds">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button
            type="button"
            disabled={!prevBed}
            onClick={() => setIdx(safeIdx - 1)}
            className="flex-1 min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {prevBed ? `Bed ${prevBed.bed}` : "First bed"}
          </button>
          {nextBed ? (
            <button
              type="button"
              onClick={() => setIdx(safeIdx + 1)}
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-1"
            >
              Next: Bed {nextBed.bed} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
            >
              Finish rounds
            </button>
          )}
        </div>
      </nav>

      {showTrends && adm && notes && (
        <Suspense fallback={null}>
          <IcuTrendsView admission={adm} notes={notes} onClose={() => setShowTrends(false)} />
        </Suspense>
      )}

      {chatMode && chatContext && (
        <Suspense fallback={null}>
          <CaseChatWorkspace
            key={`${chatContext.id}_${chatMode}`}
            context={chatContext}
            isOpen
            initialMode={chatMode}
            onClose={() => setChatMode(null)}
          />
        </Suspense>
      )}
    </div>
  );
}