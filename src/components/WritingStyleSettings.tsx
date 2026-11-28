import React, { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import {
  DEFAULT_WRITING_STYLE, isDefaultWritingStyle, previewSections, resolveWritingStyle,
  type WritingStyle,
} from "../lib/writingStyle";
import { getWritingStyleStore, useWritingStyle } from "../lib/writingStyleBackend";

/**
 * Profile → My Writing Style. Presentation preferences only: nothing here changes what is recorded
 * about a patient. Saved against the signed-in doctor's own account, so it follows them to every device.
 */

type Opt<T extends string> = { value: T; label: string; hint?: string };

const GROUPS: Array<{ key: keyof Omit<WritingStyle, "v">; title: string; help?: string; options: Opt<any>[] }> = [
  {
    key: "docStyle", title: "Documentation style",
    help: "A starting point. The choices below override it.",
    options: [
      { value: "default", label: "ErMate default" },
      { value: "clinical", label: "Clinical", hint: "approved abbreviations + bullets" },
      { value: "narrative", label: "Narrative", hint: "expanded terms + paragraphs" },
      { value: "structured", label: "Structured", hint: "bullets" },
    ],
  },
  {
    key: "length", title: "Level of detail",
    help: "Chooses which sections appear in field-wise copy. Nothing is shortened or reworded.",
    options: [
      { value: "concise", label: "Concise", hint: "leaves out Past History and Investigations" },
      { value: "balanced", label: "Balanced", hint: "ErMate default" },
      { value: "detailed", label: "Detailed", hint: "adds Primary Survey, ECG/bedside, Procedures, Consults, Notes" },
    ],
  },
  {
    key: "exam", title: "Examination format",
    options: [
      { value: "default", label: "ErMate default" },
      { value: "abcde", label: "ABCDE", hint: "Primary Survey before Examination" },
      { value: "systemwise", label: "System-wise", hint: "Examination only" },
    ],
  },
  {
    key: "abbreviations", title: "Clinical terms",
    help: "A short approved list only (c/o, h/o, HTN, DM…). Drug names, doses and units are never changed.",
    options: [
      { value: "default", label: "As documented" },
      { value: "abbreviated", label: "Approved abbreviations" },
      { value: "expanded", label: "Expanded terminology" },
    ],
  },
  {
    key: "presentation", title: "Presentation",
    options: [
      { value: "default", label: "As documented" },
      { value: "bullets", label: "Bullet points" },
      { value: "paragraphs", label: "Paragraphs" },
    ],
  },
  {
    key: "emrCopy", title: "EMR copy",
    help: "Which view opens first in Copy to EMR.",
    options: [
      { value: "fields", label: "Field by field" },
      { value: "full", label: "Full case sheet" },
    ],
  },
];

export default function WritingStyleSettings() {
  const saved = useWritingStyle();
  const [draft, setDraft] = useState<WritingStyle>(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Follow the account (another device, sign-in) unless there are unsaved edits.
  useEffect(() => { if (!dirty) setDraft(saved); }, [saved, dirty]);

  const preview = useMemo(() => previewSections(draft), [draft]);

  const set = (key: keyof Omit<WritingStyle, "v">, value: string) => {
    setDraft((d) => resolveWritingStyle({ ...d, [key]: value }));
    setDirty(true);
    setMsg(null);
  };

  const run = async (next: WritingStyle | null, okText: string) => {
    setBusy(true); setMsg(null);
    try {
      await getWritingStyleStore().save(next);
      setDirty(false);
      if (next === null) setDraft(DEFAULT_WRITING_STYLE);
      setMsg({ ok: true, text: okText });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not save. Please try again." });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="writing-style-settings">
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Choose how copied and exported notes look. This only changes presentation. It never changes what is recorded
        about a patient, and anything not documented is never filled in.
      </p>

      {GROUPS.map((g) => (
        <fieldset key={g.key} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <legend className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{g.title}</legend>
          {g.help && <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{g.help}</p>}
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => {
              const on = (draft as any)[g.key] === o.value;
              return (
                <label key={o.value}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"}`}>
                  <input type="radio" className="sr-only" name={`ws-${g.key}`} checked={on} onChange={() => set(g.key, o.value)} data-testid={`ws-${g.key}-${o.value}`} />
                  {o.label}
                  {o.hint && <span className={`block text-[10px] font-medium ${on ? "text-indigo-100" : "text-slate-400"}`}>{o.hint}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Preview</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Made-up example. No patient data.</p>
        <div className="space-y-2" data-testid="writing-style-preview">
          {preview.map((s) => (
            <div key={s.key}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.title}</p>
              <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <p role="status" className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" disabled={busy || (isDefaultWritingStyle(saved) && isDefaultWritingStyle(draft))}
          onClick={() => run(null, "Back to ErMate defaults.")}
          data-testid="ws-reset"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to ErMate defaults
        </button>
        <button type="button" disabled={busy || !dirty}
          onClick={() => run(draft, "Saved to your account.")}
          data-testid="ws-save"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save my style
        </button>
      </div>
    </div>
  );
}