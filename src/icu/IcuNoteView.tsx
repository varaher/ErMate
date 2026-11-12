import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, AlertTriangle, Check, ClipboardCopy, Copy, FileSignature, Keyboard, MoreHorizontal, Trash2, X,
} from "lucide-react";
import VoiceRecorder from "../components/shared/VoiceRecorder";
import { authenticatedFetch } from "../services/authenticatedFetch";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import type { UserProfile } from "../types";
import {
  ICU_OUTCOMES, type ExamStatus, type ExamSystem, type FastHugsKey, type FastHugsStatus, type IcuAdmission,
  type IcuExtraction, type IcuNote, type IcuOutcome, type IcuUnit, type PlanGroup,
} from "./icuTypes";
import {
  EXAM_SYSTEMS, FAST_HUGS_ITEMS, ICU_NORMAL_PHRASES, PLAN_GROUPS, applyExtraction, buildIcuEmrSections,
  buildIcuNoteText, deviceDay, formatObservation, gcsText, icuDayNumber, isFastHugsComplete,
  noteGapSummary, sanitizeExtraction,
} from "./icuLogic";
import { closeAdmission, moveBed, saveNote, saveTasks, signNote, startNote, subscribeNotes } from "./icuStore";
import IcuEntryChoice, { type IcuEntryMode } from "./IcuEntryChoice";
import IcuScribePreview from "./IcuScribePreview";
import { requestTour } from "../lib/coachTours";

type Notify = (title: string, message: string, type?: "info" | "success" | "warning") => void;
type Tab = "note" | "fasthugs" | "plan" | "preview";

interface Props {
  admission: IcuAdmission;
  units: IcuUnit[];
  occupiedBeds: Set<string>;
  profile: UserProfile | null;
  onBack: () => void;
  notify: Notify;
}

const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl";
const sectionTitle = "text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide px-1";
const input = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/30";
const ND = "Not documented";

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function IcuNoteView({ admission, units, occupiedBeds, profile, onBack, notify }: Props) {
  const [notes, setNotes] = useState<IcuNote[] | null>(null);
  const [note, setNote] = useState<IcuNote | null>(null);
  const [tab, setTab] = useState<Tab>("note");
  const [pending, setPending] = useState<{ ext: IcuExtraction; text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  // Entry sheet (Speak / Type / Paste), same pattern as the ER New Patient menu.
  const [entry, setEntry] = useState<{ mode: IcuEntryMode; text: string } | null>(null);
  const autoEntryShownFor = React.useRef<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<null | "menu" | "move" | "close">(null);
  const [starting, setStarting] = useState(false);

  const doctorName = profile?.name || null;
  const designation = profile?.displayRole || null;

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = subscribeNotes(admission.id, setNotes, (e) => notify("Could not load notes", e.message, "warning"));
    } catch (e: any) {
      notify("Could not load notes", e?.message || "", "warning");
    }
    return () => unsub();
  }, [admission.id]);

  // Keep the open note in sync with Firestore, but never overwrite newer local edits.
  useEffect(() => {
    if (!notes || !notes.length) return;
    const latest = notes[0];
    setNote((cur) => {
      if (!cur || cur.id !== latest.id) return latest;
      return latest.updatedAt > cur.updatedAt ? latest : cur;
    });
  }, [notes]);

  const readOnly = !note || note.status === "signed";
  const gaps = note ? noteGapSummary(note) : null;

  // A brand-new, untouched draft opens the Speak / Type / Paste choice once.
  useEffect(() => {
    if (!note || note.status !== "draft") return;
    if (note.createdAt !== note.updatedAt) return;
    if (autoEntryShownFor.current === note.id) return;
    autoEntryShownFor.current = note.id;
    setEntry({ mode: "choose", text: "" });
  }, [note?.id, note?.status, note?.createdAt, note?.updatedAt]);

  // Walkthrough for the note screen, once nothing is covering it.
  useEffect(() => {
    if (note && !entry && !pending) requestTour("icunote");
  }, [note?.id, entry, pending]);

  const persist = async (next: IcuNote) => {
    if (next.status === "signed") return;
    setNote(next);
    try {
      await saveNote(next);
    } catch (e: any) {
      notify("Not saved", e?.message || "Check your connection and try again.", "warning");
    }
  };

  const update = (fn: (n: IcuNote) => void) => {
    if (!note || readOnly) return;
    const next: IcuNote = JSON.parse(JSON.stringify(note));
    fn(next);
    next.updatedAt = new Date().toISOString();
    void persist(next);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const n = await startNote(admission, doctorName);
      setNote(n);
      setTab("note");
      autoEntryShownFor.current = n.id;
      setEntry({ mode: "choose", text: "" });
    } catch (e: any) {
      notify("Could not start note", e?.message || "Please try again.", "warning");
    } finally {
      setStarting(false);
    }
  };

  const runExtract = async (text: string) => {
    const t = text.trim();
    if (!t || !note) return;
    if (readOnly) {
      notify("Note is signed", "Start today's note to add new findings.", "info");
      return;
    }
    setExtracting(true);
    try {
      const res = await authenticatedFetch("/api/icu/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, noteKind: note.kind }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        notify("Scribe could not read that", body?.error || `Error ${res.status}. Nothing was saved.`, "warning");
        return;
      }
      setPending({ ext: sanitizeExtraction(body.data), text: t });
      setEntry(null);
    } catch (e: any) {
      notify("Scribe unavailable", e?.message || "Nothing was saved.", "warning");
    } finally {
      setExtracting(false);
    }
  };

  const applyPending = () => {
    if (!pending || !note) return;
    void persist(applyExtraction(note, pending.ext));
    setPending(null);
    notify("Applied to note", "Review the note and FAST HUGS before signing.", "success");
  };

  const handleSign = async () => {
    if (!note || !gaps) return;
    const warnings: string[] = [];
    if (gaps.fastHugsGaps) warnings.push(`${gaps.fastHugsGaps} FAST HUGS items not reviewed`);
    if (gaps.openFlags) warnings.push(`${gaps.openFlags} orders need clarification`);
    if (gaps.carriedUnconfirmed) warnings.push(`${gaps.carriedUnconfirmed} carried-forward items not confirmed`);
    const msg = warnings.length
      ? `${warnings.join("\n")}\n\nSign anyway? A signed note can no longer be edited.`
      : "Sign this note? A signed note can no longer be edited.";
    if (!window.confirm(msg)) return;
    try {
      await signNote(note);
      notify("Note signed", `${admission.unitName} · Bed ${admission.bed}`, "success");
    } catch (e: any) {
      notify("Could not sign", e?.message || "Please try again.", "warning");
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!note) return;
    const next: IcuNote = JSON.parse(JSON.stringify(note));
    const t = next.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    next.updatedAt = new Date().toISOString();
    setNote(next);
    try {
      if (note.status === "signed") await saveTasks(next);
      else await saveNote(next);
    } catch (e: any) {
      notify("Task not saved", e?.message || "", "warning");
    }
  };

  const latest = notes?.[0] || null;
  const needsNewNote = !latest || (latest.status === "signed" && !isToday(latest.createdAt));

  return (
    <div className="max-w-3xl mx-auto pb-40">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="min-h-[44px] flex items-center gap-1 text-sm font-medium text-purple-700 dark:text-purple-300">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> ICU
          </button>
          <div className="flex items-center gap-2">
            {note && (
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${note.status === "signed"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}>
                {note.status === "signed" ? "Signed" : "Draft · not signed"}
              </span>
            )}
            <button type="button" aria-label="Patient actions" onClick={() => setMenuOpen("menu")} className="p-2 min-h-[44px] text-slate-600 dark:text-slate-300">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{admission.unitName} · Bed {admission.bed} · {admission.patientLabel}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            ICU day {icuDayNumber(admission.admittedAt)}
            {note ? ` · ${note.kind === "admission" ? "Admission note" : "Daily note"} · ${new Date(note.createdAt).toLocaleString()}` : ""}
          </p>
        </div>
        {note && (
          <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-0.5" role="tablist">
            {([
              ["note", "Note"], ["fasthugs", "FAST HUGS"], ["plan", "Plan"], ["preview", "Preview"],
            ] as [Tab, string][]).map(([id, text]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                data-coach={id === "fasthugs" ? "icu-fasthugs-tab" : id === "preview" ? "icu-preview-tab" : undefined}
                className={`flex-1 min-h-[36px] rounded-lg text-xs font-semibold ${tab === id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}>
                {text}{id === "fasthugs" && gaps?.fastHugsGaps ? ` · ${gaps.fastHugsGaps}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 space-y-4">
        {notes === null && <p className="text-sm text-slate-500">Loading…</p>}

        {notes !== null && needsNewNote && (
          <div className={`${card} p-4 space-y-2`}>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {latest ? "Yesterday's note is signed. Start today's note — problems, background and lines carry forward for you to confirm. Vitals, exam and FAST HUGS start empty." : "No note yet for this admission."}
            </p>
            <button type="button" disabled={starting} onClick={handleStart}
              className="min-h-[44px] px-4 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-60">
              {starting ? "Starting…" : latest ? "Start today's note" : "Start admission note"}
            </button>
          </div>
        )}

        {note && tab === "note" && <NoteTab note={note} readOnly={readOnly} update={update} />}
        {note && tab === "fasthugs" && <FastHugsTab note={note} readOnly={readOnly} update={update} />}
        {note && tab === "plan" && <PlanTab note={note} readOnly={readOnly} update={update} onToggleTask={toggleTask} />}
        {note && tab === "preview" && (
          <PreviewTab note={note} admission={admission} doctor={{ name: doctorName, designation }} notify={notify} onSign={handleSign} />
        )}
      </div>

      {/* Dictation bar — voice first, typing/paste as backup */}
      {note && !readOnly && (
        <div className="fixed left-0 right-0 bottom-16 md:bottom-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3" data-coach="icu-dictate">
            <VoiceRecorder
              renderMode="compact-button"
              disabled={extracting}
              buttonLabel="Dictate"
              onTranscript={(t) => void runExtract(t)}
              onError={(err) => notify("Recording problem", err, "warning")}
            />
            <p className="flex-1 text-xs text-slate-600 dark:text-slate-400">
              {extracting ? "Reading your dictation…" : `Speak naturally for ${admission.unitName} · Bed ${admission.bed}`}
            </p>
            <button type="button" onClick={() => setEntry({ mode: "paste", text: "" })} aria-label="Type or paste a note"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" aria-hidden="true" /> Type
            </button>
          </div>
        </div>
      )}

      {entry && note && (
        <IcuEntryChoice
          bedLabel={`${admission.unitName} · Bed ${admission.bed}`}
          initialMode={entry.mode}
          initialText={entry.text}
          busy={extracting}
          onSubmitText={(t) => void runExtract(t)}
          onManual={() => { setEntry(null); setTab("note"); }}
          onClose={() => setEntry(null)}
          onVoiceError={(err) => notify("Recording problem", err, "warning")}
        />
      )}

      {pending && note && (
        <IcuScribePreview
          note={note}
          extraction={pending.ext}
          spokenText={pending.text}
          admission={admission}
          onApply={applyPending}
          onDiscard={() => setPending(null)}
          onAddMore={() => { const t = pending.text; setPending(null); setEntry({ mode: "speak", text: t }); }}
        />
      )}

      {menuOpen === "menu" && (
        <Sheet title="Patient actions" onClose={() => setMenuOpen(null)}>
          <button type="button" onClick={() => setMenuOpen("move")} className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Move bed / shift to another ICU
          </button>
          <button type="button" onClick={() => setMenuOpen("close")} className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Close ICU stay (ward, discharge, death…)
          </button>
        </Sheet>
      )}
      {menuOpen === "move" && (
        <MoveSheet admission={admission} units={units} occupiedBeds={occupiedBeds} onClose={() => setMenuOpen(null)}
          onMove={async (u, b) => {
            try { await moveBed(admission, u, b, occupiedBeds); setMenuOpen(null); notify("Moved", `${u.name} · Bed ${b}`, "success"); }
            catch (e: any) { notify("Could not move", e?.message || "", "warning"); }
          }} />
      )}
      {menuOpen === "close" && (
        <CloseSheet onClose={() => setMenuOpen(null)}
          onConfirm={async (o) => {
            if (!window.confirm(`Record outcome "${ICU_OUTCOMES.find((x) => x.id === o)?.label}" and close this ICU stay?`)) return;
            try { await closeAdmission(admission, o); setMenuOpen(null); onBack(); notify("ICU stay closed", "Outcome recorded.", "success"); }
            catch (e: any) { notify("Could not close", e?.message || "", "warning"); }
          }} />
      )}
    </div>
  );
}

// ── Note tab ──────────────────────────────────────────────────
function NoteTab({ note, readOnly, update }: { note: IcuNote; readOnly: boolean; update: (fn: (n: IcuNote) => void) => void }) {
  const s = note.sections;
  const gcs = gcsText(s.gcs);
  return (
    <div className="space-y-4">
      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Diagnosis / active problems</h2>
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {s.problems.length === 0 && <p className="p-3 text-sm text-slate-500">{ND}</p>}
          {s.problems.map((p, i) => (
            <div key={p.id} className={`p-3 flex items-start gap-2 ${p.carried ? "opacity-70" : ""}`}>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm text-slate-900 dark:text-white ${p.status === "resolved" ? "line-through text-slate-500" : ""}`}>{p.text}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.suspected && <Tag tone="slate">Suspected</Tag>}
                  {p.carried && <Tag tone="amber">Carried forward · confirm</Tag>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  {p.carried && (
                    <IconBtn label="Confirm" onClick={() => update((n) => { const x = n.sections.problems.find((q) => q.id === p.id); if (x) x.carried = false; })}>
                      <Check className="w-4 h-4" />
                    </IconBtn>
                  )}
                  <IconBtn label={p.status === "active" ? "Mark resolved" : "Mark active"}
                    onClick={() => update((n) => { const x = n.sections.problems.find((q) => q.id === p.id); if (x) { x.status = x.status === "active" ? "resolved" : "active"; x.carried = false; } })}>
                    <span className="text-[10px] font-bold">{p.status === "active" ? "RES" : "ACT"}</span>
                  </IconBtn>
                  <IconBtn label="Remove" onClick={() => update((n) => { n.sections.problems = n.sections.problems.filter((q) => q.id !== p.id); })}>
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              )}
            </div>
          ))}
        </div>
        {s.background && <p className="text-xs text-slate-600 dark:text-slate-400 px-1">Background: {s.background}</p>}
      </section>

      {note.kind === "admission" && (
        <TextBlock title="Admission story" value={s.admissionStory} readOnly={readOnly}
          onSave={(v) => update((n) => { n.sections.admissionStory = v; })} />
      )}
      <TextBlock title="Events since last review" value={s.events} readOnly={readOnly}
        onSave={(v) => update((n) => { n.sections.events = v; })} />

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Current status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StatusCard label="Airway / ventilation" value={s.ventilation} />
          <StatusCard label="Neuro / sedation" value={[s.neuro, gcs, s.rass && `RASS ${s.rass}`, s.camIcu && `CAM-ICU ${s.camIcu}`].filter(Boolean).join(" · ") || null} />
          <StatusCard label="Haemodynamic support" value={s.haemodynamic} />
        </div>
      </section>

      <ObsList title="Vitals" items={s.vitals} readOnly={readOnly}
        onRemove={(id) => update((n) => { n.sections.vitals = n.sections.vitals.filter((v) => v.id !== id); })} />

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Examination</h2>
        <div className="space-y-2">
          {EXAM_SYSTEMS.map(({ id, label }) => (
            <ExamCard key={id} system={id} label={label} note={note} readOnly={readOnly} update={update} />
          ))}
        </div>
      </section>

      <ObsList title="Investigations" items={s.investigations} readOnly={readOnly}
        onRemove={(id) => update((n) => { n.sections.investigations = n.sections.investigations.filter((v) => v.id !== id); })} />

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Differential considerations</h2>
        <div className={`${card} p-3 space-y-1`}>
          {s.differentials.length === 0 && <p className="text-sm text-slate-500">{ND}</p>}
          {s.differentials.map((d, i) => (
            <div key={`${d}-${i}`} className="flex items-start gap-2">
              <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">• {d}</p>
              {!readOnly && <IconBtn label="Remove" onClick={() => update((n) => { n.sections.differentials.splice(i, 1); })}><Trash2 className="w-4 h-4" /></IconBtn>}
            </div>
          ))}
        </div>
      </section>

      <TextBlock title="Summary & prognosis" value={s.summary} readOnly={readOnly}
        onSave={(v) => update((n) => { n.sections.summary = v; })} />
    </div>
  );
}

function ExamCard({ system, label, note, readOnly, update }: {
  system: ExamSystem; label: string; note: IcuNote; readOnly: boolean; update: (fn: (n: IcuNote) => void) => void;
}) {
  const e = note.sections.exam[system];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(e.text || "");
  const [reviewNormal, setReviewNormal] = useState(false);
  const [assessed, setAssessed] = useState(false);
  useEffect(() => { setText(e.text || ""); }, [e.text]);
  const phrase = ICU_NORMAL_PHRASES[system];
  const statusText = e.status === "documented" ? (e.text || ND)
    : e.status === "not_assessed" ? `Not assessed${e.reason ? ` — ${e.reason}` : ""}`
    : e.status === "unable" ? `Unable to assess${e.reason ? ` — ${e.reason}` : ""}` : ND;

  const setStatus = (status: ExamStatus, reason: string | null) => update((n) => {
    n.sections.exam[system] = { status, text: null, source: null, reason, confirmedAt: new Date().toISOString() };
  });

  return (
    <div className={`${card} p-3 space-y-2`}>
      <button type="button" className="w-full text-left flex items-start justify-between gap-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
          <p className={`text-sm ${e.status === "not_documented" ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>{statusText}</p>
          {e.source === "attested-normal" && <Tag tone="purple">Attested normal</Tag>}
        </div>
        <span className="text-xs text-purple-700 dark:text-purple-300 shrink-0">{readOnly ? "" : open ? "Close" : "Edit"}</span>
      </button>
      {open && !readOnly && (
        <div className="space-y-2">
          <textarea className={`${input} min-h-[70px]`} value={text} onChange={(ev) => setText(ev.target.value)}
            placeholder="Enter only findings you assessed" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!text.trim()}
              onClick={() => update((n) => { n.sections.exam[system] = { status: "documented", text: text.trim(), source: "manual", reason: null, confirmedAt: new Date().toISOString() }; })}
              className="min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Save findings</button>
            {phrase && (
              <button type="button" onClick={() => { setReviewNormal(true); setAssessed(false); }}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">Review normal findings</button>
            )}
            <button type="button" onClick={() => setStatus("not_assessed", window.prompt("Reason (optional)") || null)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">Not assessed</button>
            <button type="button" onClick={() => { const r = window.prompt("Why unable to assess?"); if (r && r.trim()) setStatus("unable", r.trim()); }}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">Unable to assess</button>
          </div>
          {reviewNormal && phrase && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">Suggested wording · not yet in the note</p>
              <p className="text-sm text-slate-900 dark:text-white">{phrase}</p>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input type="checkbox" checked={assessed} onChange={(ev) => setAssessed(ev.target.checked)} className="w-5 h-5" />
                I assessed these findings today
              </label>
              <button type="button" disabled={!assessed}
                onClick={() => { update((n) => { n.sections.exam[system] = { status: "documented", text: phrase, source: "attested-normal", reason: null, confirmedAt: new Date().toISOString() }; }); setReviewNormal(false); }}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Add confirmed findings</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── FAST HUGS tab ─────────────────────────────────────────────
function FastHugsTab({ note, readOnly, update }: { note: IcuNote; readOnly: boolean; update: (fn: (n: IcuNote) => void) => void }) {
  const [openKey, setOpenKey] = useState<FastHugsKey | null>(null);
  const gaps = FAST_HUGS_ITEMS.filter((it) => !isFastHugsComplete(note.fastHugs[it.key])).length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600 dark:text-slate-400 px-1">
        {11 - gaps} of 11 reviewed. Amber items are never filled automatically — dictate them, or mark Not applicable with a reason.
      </p>
      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
        {FAST_HUGS_ITEMS.map((it) => {
          const e = note.fastHugs[it.key];
          const complete = isFastHugsComplete(e);
          const isOpen = openKey === it.key;
          return (
            <div key={it.key} className="p-3">
              <button type="button" className="w-full flex items-start gap-3 text-left" onClick={() => setOpenKey(isOpen ? null : it.key)} aria-expanded={isOpen}>
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${complete
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"}`}>{it.letter}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{it.label}</p>
                  <p className={`text-sm ${complete ? "text-slate-700 dark:text-slate-300" : "text-amber-800 dark:text-amber-300"}`}>
                    {e.status === "addressed" && e.detail ? e.detail
                      : e.status === "not_applicable" && e.reason ? `Not applicable — ${e.reason}`
                      : e.status === "addressed" ? "Details needed"
                      : e.status === "not_applicable" ? "Reason needed" : "Not reviewed"}
                  </p>
                </div>
              </button>
              {isOpen && !readOnly && (
                <FastHugsEditor key={`${it.key}-${note.updatedAt}`} placeholder={it.placeholder} entry={e}
                  onSave={(status, detail, reason) => update((n) => { n.fastHugs[it.key] = { status, detail, reason }; })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FastHugsEditor({ entry, placeholder, onSave }: {
  entry: { status: FastHugsStatus; detail: string | null; reason: string | null }; placeholder: string;
  onSave: (s: FastHugsStatus, d: string | null, r: string | null) => void;
}) {
  const [status, setStatus] = useState<FastHugsStatus>(entry.status);
  const [detail, setDetail] = useState(entry.detail || "");
  const [reason, setReason] = useState(entry.reason || "");
  const valid = status === "not_reviewed" || (status === "addressed" && detail.trim()) || (status === "not_applicable" && reason.trim());
  return (
    <div className="mt-2 space-y-2 pl-10">
      <select className={input} value={status} onChange={(e) => setStatus(e.target.value as FastHugsStatus)} aria-label="Review status">
        <option value="not_reviewed">Not reviewed</option>
        <option value="addressed">Addressed</option>
        <option value="not_applicable">Not applicable</option>
      </select>
      {status === "addressed" && (
        <input className={input} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={placeholder} aria-label="Details" />
      )}
      {status === "not_applicable" && (
        <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" />
      )}
      <button type="button" disabled={!valid}
        onClick={() => onSave(status, status === "addressed" ? detail.trim() : null, status === "not_applicable" ? reason.trim() : null)}
        className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Save</button>
    </div>
  );
}

// ── Plan tab ──────────────────────────────────────────────────
function PlanTab({ note, readOnly, update, onToggleTask }: {
  note: IcuNote; readOnly: boolean; update: (fn: (n: IcuNote) => void) => void; onToggleTask: (id: string) => void;
}) {
  const openFlags = note.flags.filter((f) => !f.resolved);
  const devices = note.devices.filter((d) => d.status !== "removed");
  return (
    <div className="space-y-4">
      {openFlags.length > 0 && (
        <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Needs clarification · {openFlags.length}
          </p>
          {openFlags.map((f) => (
            <div key={f.id} className="flex items-start gap-2 border-t border-amber-200 dark:border-amber-900 pt-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{f.order}</p>
                <p className="text-xs text-amber-900 dark:text-amber-200">{f.issue}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => update((n) => { const x = n.flags.find((q) => q.id === f.id); if (x) x.resolved = true; })}
                  className="min-h-[36px] px-2 rounded-lg border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-100">Clarified</button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-amber-900 dark:text-amber-200">Text stays exactly as dictated. Dictate the correction, then mark Clarified.</p>
        </section>
      )}

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Plan for the day</h2>
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {PLAN_GROUPS.every(({ id }) => note.sections.plan[id].length === 0) && <p className="p-3 text-sm text-slate-500">{ND}</p>}
          {PLAN_GROUPS.filter(({ id }) => note.sections.plan[id].length > 0).map(({ id, label }) => (
            <div key={id} className="p-3 space-y-1">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300">{label}</p>
              {note.sections.plan[id].map((item, i) => (
                <div key={`${id}-${i}`} className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">• {item}</p>
                  {!readOnly && <IconBtn label="Remove" onClick={() => update((n) => { n.sections.plan[id as PlanGroup].splice(i, 1); })}><Trash2 className="w-4 h-4" /></IconBtn>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Timed tasks</h2>
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {note.tasks.length === 0 && <p className="p-3 text-sm text-slate-500">No timed orders.</p>}
          {[...note.tasks].sort((a, b) => (a.dueAt || "9").localeCompare(b.dueAt || "9")).map((t) => (
            <label key={t.id} className="p-3 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)} className="w-5 h-5" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 min-w-[72px]">
                {t.dueAt ? new Date(t.dueAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : t.when}
              </span>
              <span className={`flex-1 text-sm ${t.done ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>{t.what}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        <h2 className={sectionTitle}>Lines & tubes</h2>
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {devices.length === 0 && <p className="p-3 text-sm text-slate-500">{ND}</p>}
          {devices.map((d) => {
            const day = deviceDay(d);
            return (
              <div key={d.id} className={`p-3 flex items-center gap-2 ${d.carried ? "opacity-70" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.type}{d.site ? ` · ${d.site}` : ""}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {d.status === "ordered" ? "Ordered · not inserted" : day ? `Day ${day}` : "Insertion time not recorded"}
                    {d.carried ? " · carried forward, confirm" : ""}
                  </p>
                </div>
                {!readOnly && d.status === "ordered" && (
                  <button type="button" onClick={() => update((n) => { const x = n.devices.find((q) => q.id === d.id); if (x) { x.status = "in_situ"; x.insertedAt = new Date().toISOString(); x.carried = false; } })}
                    className="min-h-[36px] px-2 rounded-lg bg-purple-600 text-white text-xs font-semibold">Inserted now</button>
                )}
                {!readOnly && d.carried && (
                  <IconBtn label="Confirm" onClick={() => update((n) => { const x = n.devices.find((q) => q.id === d.id); if (x) x.carried = false; })}><Check className="w-4 h-4" /></IconBtn>
                )}
                {!readOnly && d.status === "in_situ" && (
                  <button type="button" onClick={() => update((n) => { const x = n.devices.find((q) => q.id === d.id); if (x) { x.status = "removed"; x.carried = false; } })}
                    className="min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">Removed</button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Preview + Copy to EMR + Sign ──────────────────────────────
function PreviewTab({ note, admission, doctor, notify, onSign }: {
  note: IcuNote; admission: IcuAdmission; doctor: { name: string | null; designation: string | null };
  notify: Notify; onSign: () => void;
}) {
  const sections = useMemo(() => buildIcuEmrSections(note, admission), [note, admission]);
  const full = useMemo(() => buildIcuNoteText(note, admission, doctor), [note, admission, doctor]);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    if (note.status !== "signed" && key === "__full" && !window.confirm("This note is not signed. Copy it as a DRAFT?")) return;
    const ok = await copyTextToClipboard(text);
    if (ok) { setCopied(key); setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800); }
    else notify("Copy failed", "Your browser blocked the clipboard. Select the text and copy manually.", "warning");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 dark:text-slate-400 px-1">Only dictated, entered or confirmed findings appear. Empty sections say “Not documented”.</p>
      <button type="button" onClick={() => copy("__full", full)}
        className="w-full min-h-[48px] rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 text-sm font-semibold flex items-center justify-center gap-2">
        {copied === "__full" ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" aria-hidden="true" />}
        {copied === "__full" ? "Copied" : "Copy full note to EMR"}
      </button>
      {sections.map((sec) => (
        <div key={sec.key} className={`${card} p-3 space-y-1`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{sec.title}</p>
            <button type="button" onClick={() => copy(sec.key, sec.text)} aria-label={`Copy ${sec.title}`}
              className="min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
              {copied === sec.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              {copied === sec.key ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{sec.text}</p>
        </div>
      ))}
      {note.status !== "signed" && (
        <button type="button" onClick={onSign}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2">
          <FileSignature className="w-4 h-4" aria-hidden="true" /> Sign note
        </button>
      )}
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────
function Tag({ children, tone }: { children: React.ReactNode; tone: "amber" | "slate" | "purple" }) {
  const cls = tone === "amber" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
    : tone === "purple" ? "bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{children}</span>;
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
      {children}
    </button>
  );
}

function StatusCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={`${card} p-3`}>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">{label}</p>
      <p className={`text-sm ${value ? "text-slate-900 dark:text-white" : "text-amber-800 dark:text-amber-300"}`}>{value || ND}</p>
    </div>
  );
}

function ObsList({ title, items, readOnly, onRemove }: {
  title: string; items: { id: string; name: string; value: string; unit: string | null; time: string | null }[];
  readOnly: boolean; onRemove: (id: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <h2 className={sectionTitle}>{title}</h2>
      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
        {items.length === 0 && <p className="p-3 text-sm text-slate-500">{ND}</p>}
        {items.map((o) => (
          <div key={o.id} className="px-3 py-2 flex items-center gap-2">
            <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">{formatObservation(o)}</p>
            {!o.time && <span className="text-[10px] text-slate-500">time not stated</span>}
            {!readOnly && <IconBtn label="Remove" onClick={() => onRemove(o.id)}><Trash2 className="w-4 h-4" /></IconBtn>}
          </div>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ title, value, readOnly, onSave }: { title: string; value: string | null; readOnly: boolean; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);
  return (
    <section className="space-y-1.5">
      <h2 className={sectionTitle}>{title}</h2>
      {readOnly
        ? <p className={`${card} p-3 text-sm whitespace-pre-wrap ${value ? "text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>{value || ND}</p>
        : <textarea className={`${input} min-h-[64px]`} value={text} placeholder={ND}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => { const t = text.trim() || null; if (t !== value) onSave(t); }} />}
    </section>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full md:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MoveSheet({ admission, units, occupiedBeds, onClose, onMove }: {
  admission: IcuAdmission; units: IcuUnit[]; occupiedBeds: Set<string>; onClose: () => void; onMove: (u: IcuUnit, bed: string) => Promise<void>;
}) {
  const [unitId, setUnitId] = useState(admission.unitId);
  const unit = units.find((u) => u.id === unitId) || units[0];
  const free = unit ? unit.beds.filter((b) => !occupiedBeds.has(`${unit.id}|${b}`)) : [];
  const [bed, setBed] = useState<string>("");
  return (
    <Sheet title="Move bed / shift ICU" onClose={onClose}>
      <p className="text-xs text-slate-600 dark:text-slate-400">Same ICU admission — the move is recorded in the stay history.</p>
      <select className={input} value={unitId} onChange={(e) => { setUnitId(e.target.value); setBed(""); }} aria-label="Unit">
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className={input} value={bed} onChange={(e) => setBed(e.target.value)} aria-label="Bed">
        <option value="">Choose a free bed</option>
        {free.map((b) => <option key={b} value={b}>Bed {b}</option>)}
      </select>
      <button type="button" disabled={!bed || !unit} onClick={() => unit && onMove(unit, bed)}
        className="w-full min-h-[48px] rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50">Move patient</button>
    </Sheet>
  );
}

function CloseSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (o: IcuOutcome) => Promise<void> }) {
  const [outcome, setOutcome] = useState<IcuOutcome | "">("");
  return (
    <Sheet title="Close ICU stay" onClose={onClose}>
      <select className={input} value={outcome} onChange={(e) => setOutcome(e.target.value as IcuOutcome)} aria-label="Outcome">
        <option value="">Choose outcome</option>
        {ICU_OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {outcome === "DEATH" && (
        <p className="text-xs text-slate-600 dark:text-slate-400">Cause-of-death certification (Form 4) is completed and signed by the doctor separately. ErMate does not fill it.</p>
      )}
      <button type="button" disabled={!outcome} onClick={() => outcome && onConfirm(outcome)}
        className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Record outcome</button>
    </Sheet>
  );
}