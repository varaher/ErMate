import React, { useMemo, useState } from "react";
import { X, Copy, Check, ChevronUp, ChevronDown, Settings2, RotateCcw, ArrowRight, FileText, ListChecks } from "lucide-react";
import type { CaseSheetData } from "./CaseSheetPrintView";
import { formatCaseSheetText, caseSheetTextToEmrHtml } from "../utils/caseSheetFormat";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import {
  buildEmrSections, EMR_SECTION_CATALOG, loadEmrLayout, saveEmrLayout, resetEmrLayout,
  type EmrLayoutItem, type EmrSectionKey,
} from "../utils/emrSections";

/**
 * Copy to Hospital EMR — full sheet, or field by field for structured EMR templates.
 * Read-only: copies what is saved on the case sheet. Never changes the case.
 */

interface Props {
  data: CaseSheetData;
  onClose: () => void;
}

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Line breaks survive in rich-text EMR editors; plain-text boxes get the plain flavour. */
const fieldHtml = (t: string) => `<meta charset="utf-8"><p>${t.split("\n").map(escapeHtml).join("<br>")}</p>`;

export default function CopyToEmrPanel({ data, onClose }: Props) {
  const [mode, setMode] = useState<"fields" | "full">("fields");
  const [layout, setLayout] = useState<EmrLayoutItem[]>(() => loadEmrLayout());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmrLayoutItem[]>(layout);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [nextIndex, setNextIndex] = useState(0);

  const sections = useMemo(() => buildEmrSections(data), [data]);
  const fullText = useMemo(() => formatCaseSheetText(data), [data]);

  const items = layout.map((it) => ({ ...it, section: sections[it.key], label: it.label || sections[it.key].title }));
  const copyable = items.filter((it) => it.section.text);
  const next = copyable[nextIndex];

  const flash = (key: string, ok: boolean) => {
    if (ok) { setCopiedKey(key); setFailedKey(null); setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800); }
    else { setFailedKey(key); setTimeout(() => setFailedKey((k) => (k === key ? null : k)), 3000); }
  };

  const copyField = async (key: string, text: string) => {
    const ok = await copyTextToClipboard(text, fieldHtml(text));
    flash(key, ok);
    return ok;
  };

  const copyNext = async () => {
    if (!next) return;
    const ok = await copyField(next.key, next.section.text);
    if (ok) setNextIndex((i) => i + 1);
  };

  const copyFull = async () => {
    const ok = await copyTextToClipboard(fullText, caseSheetTextToEmrHtml(fullText));
    flash("__full", ok);
  };

  /* layout editor */
  const inDraft = (k: EmrSectionKey) => draft.some((d) => d.key === k);
  const toggle = (k: EmrSectionKey) =>
    setDraft((d) => (inDraft(k) ? d.filter((x) => x.key !== k) : [...d, { key: k }]));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const c = d.slice(); [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  const rename = (i: number, label: string) =>
    setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, label: label.slice(0, 40) || undefined } : x)));

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors";

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 no-print" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Copy to hospital EMR"
        className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Copy to Hospital EMR</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Copies what is saved on the case sheet. Nothing is added.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode switch */}
        <div className="px-4 pt-3 flex gap-2">
          <button type="button" onClick={() => { setMode("fields"); setEditing(false); }}
            className={`${btn} ${mode === "fields" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"}`}>
            <ListChecks className="w-3.5 h-3.5" /> Field by field
          </button>
          <button type="button" onClick={() => { setMode("full"); setEditing(false); }}
            className={`${btn} ${mode === "full" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"}`}>
            <FileText className="w-3.5 h-3.5" /> Full case sheet
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {mode === "full" && (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">For EMRs with one notes box. Paste everything in one go.</p>
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-slate-200 max-h-[50vh] overflow-y-auto font-mono">{fullText}</pre>
            </>
          )}

          {mode === "fields" && !editing && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">For EMRs with separate boxes. Copy each part into its matching box.</p>
                <button type="button" onClick={() => { setDraft(layout); setEditing(true); }}
                  className={`${btn} shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}>
                  <Settings2 className="w-3.5 h-3.5" /> My EMR layout
                </button>
              </div>
              {items.map((it) => {
                const empty = !it.section.text;
                const isNext = next && next.key === it.key;
                return (
                  <div key={it.key}
                    className={`rounded-xl border p-3 ${isNext ? "border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-950" : "border-slate-200 dark:border-slate-800"} ${empty ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{it.label}</span>
                      {!empty && (
                        <button type="button" onClick={() => copyField(it.key, it.section.text)}
                          className={`${btn} ${copiedKey === it.key ? "bg-emerald-600 border-emerald-600 text-white" : failedKey === it.key ? "bg-rose-600 border-rose-600 text-white" : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"}`}>
                          {copiedKey === it.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === it.key ? "Copied" : failedKey === it.key ? "Failed" : "Copy"}
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                      {empty ? <span className="italic text-slate-400">Not documented</span> : it.section.text}
                    </p>
                  </div>
                );
              })}
            </>
          )}

          {mode === "fields" && editing && (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tick the boxes your hospital EMR has, put them in the same order, and rename them to match. Saved on this device.
              </p>
              {draft.map((it, i) => (
                <div key={it.key} className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900 p-2">
                  <input type="checkbox" checked onChange={() => toggle(it.key)} aria-label="Include" className="w-4 h-4 accent-indigo-600" />
                  <input
                    value={it.label ?? ""}
                    placeholder={EMR_SECTION_CATALOG.find((c) => c.key === it.key)!.title}
                    onChange={(e) => rename(i, e.target.value)}
                    className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-1">Not in my EMR</p>
              {EMR_SECTION_CATALOG.filter((c) => !inDraft(c.key)).map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={false} onChange={() => toggle(c.key)} className="w-4 h-4 accent-indigo-600" />
                  {c.title}
                </label>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 justify-end">
          {mode === "full" && (
            <button type="button" onClick={copyFull}
              className={`${btn} px-4 py-2 ${copiedKey === "__full" ? "bg-emerald-600 border-emerald-600 text-white" : failedKey === "__full" ? "bg-rose-600 border-rose-600 text-white" : "bg-indigo-600 border-indigo-600 text-white"}`}>
              {copiedKey === "__full" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedKey === "__full" ? "Copied — paste in EMR" : failedKey === "__full" ? "Copy failed — try again" : "Copy full case sheet"}
            </button>
          )}
          {mode === "fields" && !editing && (
            <>
              {nextIndex > 0 && (
                <button type="button" onClick={() => setNextIndex(0)} className={`${btn} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300`}>
                  <RotateCcw className="w-3.5 h-3.5" /> Start again
                </button>
              )}
              <button type="button" onClick={copyNext} disabled={!next}
                className={`${btn} px-4 py-2 bg-indigo-600 border-indigo-600 text-white disabled:opacity-50`}>
                {next ? <><Copy className="w-4 h-4" /> Copy next: {next.label} <ArrowRight className="w-4 h-4" /></> : <><Check className="w-4 h-4" /> All parts copied</>}
              </button>
            </>
          )}
          {mode === "fields" && editing && (
            <>
              <button type="button" onClick={() => { const d = resetEmrLayout(); setDraft(d); setLayout(d); setNextIndex(0); setEditing(false); }}
                className={`${btn} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300`}>
                <RotateCcw className="w-3.5 h-3.5" /> Default
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className={`${btn} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300`}>
                Cancel
              </button>
              <button type="button" disabled={draft.length === 0}
                onClick={() => { saveEmrLayout(draft); setLayout(draft); setNextIndex(0); setEditing(false); }}
                className={`${btn} px-4 py-2 bg-indigo-600 border-indigo-600 text-white disabled:opacity-50`}>
                <Check className="w-4 h-4" /> Save layout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}