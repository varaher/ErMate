import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, ClipboardCopy, MessageCircle } from "lucide-react";
import type { UserProfile, WorkArea } from "../types";
import ModeSwitcher from "../components/shared/ModeSwitcher";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import { openWhatsApp } from "../utils/whatsappShare";
import type { IcuAdmission, IcuNote, IcuUnit } from "./icuTypes";
import { getLatestNote, subscribeActiveAdmissions, subscribeUnits } from "./icuStore";
import { buildIcuIsbar, icuHandoverText } from "./icuHandover";

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;

interface Props {
  profile: UserProfile | null;
  onSwitchMode: (mode: WorkArea) => void;
  notify: Notify;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";

/** Handover tab in ICU mode: ISBAR per bed, built only from each bed's latest note. */
export default function IcuHandoverView({ profile, onSwitchMode, notify }: Props) {
  const [admissions, setAdmissions] = useState<IcuAdmission[] | null>(null);
  const [units, setUnits] = useState<IcuUnit[]>([]);
  const [unitId, setUnitId] = useState<string | "all">("all");
  const [notes, setNotes] = useState<Record<string, IcuNote | null>>({});
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let u1 = () => {};
    let u2 = () => {};
    try {
      u1 = subscribeActiveAdmissions(setAdmissions, (e) => setLoadError(e.message));
      u2 = subscribeUnits(setUnits, (e) => setLoadError(e.message));
    } catch (e: any) {
      setLoadError(e?.message || "Could not load ICU patients.");
    }
    return () => { u1(); u2(); };
  }, []);

  // Load each patient's latest note (refreshes when a census badge changes, i.e. after a save).
  const noteKey = (admissions || []).map((a) => `${a.id}:${a.latestNoteId}:${a.updatedAt}`).join("|");
  useEffect(() => {
    if (!admissions) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, IcuNote | null> = {};
      await Promise.all(admissions.map(async (a) => {
        try { out[a.id] = await getLatestNote(a.id); } catch { out[a.id] = null; }
      }));
      if (!cancelled) setNotes(out);
    })();
    return () => { cancelled = true; };
  }, [noteKey]);

  // Tick everyone the first time the list loads.
  useEffect(() => {
    if (admissions && ticked.size === 0) setTicked(new Set(admissions.map((a) => a.id)));
  }, [admissions?.length]);

  const visible = useMemo(() => (admissions || [])
    .filter((a) => unitId === "all" || a.unitId === unitId)
    .sort((a, b) => a.unitName.localeCompare(b.unitName) || a.bed.localeCompare(b.bed, undefined, { numeric: true })),
  [admissions, unitId]);

  const entries = useMemo(() => visible.map((a) => buildIcuIsbar(a, notes[a.id] ?? null, { showNames })), [visible, notes, showNames]);
  const chosen = entries.filter((e) => ticked.has(e.admissionId));
  const text = icuHandoverText(chosen, { doctorName: profile?.name || null });

  const toggle = (id: string) => setTicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const copy = async () => {
    if (!chosen.length) return;
    const ok = await copyTextToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
    else notify("Copy failed", "Your browser blocked the clipboard.", "warning");
  };

  const share = async () => {
    if (!chosen.length) return;
    if (showNames && !window.confirm("Patient names and UHIDs are switched on. Share on WhatsApp anyway?")) return;
    const r = await openWhatsApp(text);
    if (r === "copied") notify("Copied for WhatsApp", "The handover is long, so it was copied. Paste it in the chat.", "info");
    if (r === "failed") notify("Could not share", "Copy the handover and paste it into WhatsApp.", "warning");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-40 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 tracking-wide">ICU MODE</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ICU handover</h1>
        </div>
        <ModeSwitcher value="ICU" onChange={onSwitchMode} />
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="ICU unit">
        {[{ id: "all", name: "All units" }, ...units.map((u) => ({ id: u.id, name: u.name }))].map((u) => (
          <button key={u.id} type="button" role="tab" aria-selected={unitId === u.id} onClick={() => setUnitId(u.id)}
            className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-semibold border ${unitId === u.id
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"}`}>
            {u.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600 dark:text-slate-400">Built from each bed's latest note. Nothing is added that the note does not say.</p>
        <label className="shrink-0 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="w-4 h-4" />
          Show names
        </label>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">{loadError}</div>
      )}
      {admissions === null && !loadError && <p className="text-sm text-slate-500">Loading ICU patients…</p>}

      <div className="space-y-2" data-coach="icu-handover-list">
        {admissions !== null && entries.length === 0 && (
          <p className={`${card} p-4 text-sm text-slate-600 dark:text-slate-400`}>No patients in the ICU right now.</p>
        )}
        {entries.map((e) => {
          const isOpen = expanded === e.admissionId;
          const on = ticked.has(e.admissionId);
          return (
            <div key={e.admissionId} className={`${card} overflow-hidden`}>
              <div className="p-3 flex items-center gap-3">
                <input type="checkbox" checked={on} onChange={() => toggle(e.admissionId)} className="w-5 h-5"
                  aria-label={`Include ${e.bedLabel} in handover`} />
                <button type="button" onClick={() => setExpanded(isOpen ? null : e.admissionId)} aria-expanded={isOpen}
                  className="flex-1 min-w-0 text-left flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{e.bedLabel}</span>
                    {e.noteState !== "today" && (
                      <span className="block text-xs text-amber-800 dark:text-amber-300">
                        {e.noteState === "none" ? "No note yet" : `Today's note not started · latest ${new Date(e.noteDate!).toLocaleDateString()}`}
                      </span>
                    )}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />}
                </button>
              </div>
              {isOpen && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                  {e.blocks.map((b) => (
                    <div key={b.key} className="px-3 py-2.5 flex gap-3">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 text-xs font-bold flex items-center justify-center">{b.key}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{b.title}</p>
                        <p className={`text-sm whitespace-pre-wrap ${b.key === "R" ? "text-amber-900 dark:text-amber-200" : "text-slate-800 dark:text-slate-200"}`}>{b.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed left-0 right-0 bottom-16 md:bottom-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2" data-coach="icu-handover-share">
          <button type="button" onClick={copy} disabled={!chosen.length}
            className="flex-1 min-h-[48px] rounded-xl border border-purple-200 dark:border-purple-800 text-sm font-semibold text-purple-800 dark:text-purple-200 disabled:opacity-50 flex items-center justify-center gap-2">
            {copied ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" aria-hidden="true" />}
            {copied ? "Copied" : `Copy handover (${chosen.length})`}
          </button>
          <button type="button" onClick={share} disabled={!chosen.length}
            className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}