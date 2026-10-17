import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ClipboardCheck, Settings2, Plus, Trash2, EyeOff, Eye, RotateCcw, X } from "lucide-react";
import { ORDER_PANELS } from "../data/orderPanels";
import {
  EffectivePanel, QuickPanelPrefs, EMPTY_PREFS, getEffectivePanels, orderForCase, parseTests,
  validatePanelName, newCustomId, sanitizePrefs, MAX_CUSTOM_PANELS, MAX_NAME_LEN, PanelGroup,
} from "../utils/quickPanels";
import { loadQuickPanels, saveQuickPanels, readLocalQuickPanels } from "../services/quickPanelsStorage";
import { auth } from "../firebase";

interface Props {
  isPediatric: boolean;
  /** Orders the panel's tests on the case. Returns how many NEW tests were added (0 = all already ordered). */
  onOrder: (panel: EffectivePanel) => number;
}

interface DraftRow {
  id: string;
  builtIn: boolean;
  originalName: string;
  originalTests: string[];
  name: string;
  testsText: string;
  group: PanelGroup;
  hidden: boolean;
}

function buildDraft(prefs: QuickPanelPrefs): DraftRow[] {
  const hidden = new Set(prefs.hidden);
  const rows: DraftRow[] = ORDER_PANELS.map((p) => {
    const o = prefs.overrides[p.name];
    return {
      id: p.name, builtIn: true, originalName: p.name, originalTests: p.tests,
      name: o?.name || p.name, testsText: (o?.tests || p.tests).join(", "), group: p.group, hidden: hidden.has(p.name),
    };
  });
  for (const c of prefs.custom) {
    rows.push({ id: c.id, builtIn: false, originalName: c.name, originalTests: c.tests, name: c.name, testsText: c.tests.join(", "), group: c.group, hidden: false });
  }
  return rows;
}

function draftToPrefs(rows: DraftRow[]): QuickPanelPrefs {
  const overrides: QuickPanelPrefs["overrides"] = {};
  const hidden: string[] = [];
  const custom: QuickPanelPrefs["custom"] = [];
  for (const r of rows) {
    const tests = parseTests(r.testsText);
    if (r.builtIn) {
      const o: { name?: string; tests?: string[] } = {};
      if (r.name.trim() && r.name.trim() !== r.originalName) o.name = r.name.trim();
      if (tests.length > 0 && tests.join("|") !== r.originalTests.join("|")) o.tests = tests;
      if (o.name || o.tests) overrides[r.id] = o;
      if (r.hidden) hidden.push(r.id);
    } else {
      custom.push({ id: r.id, name: r.name.trim(), group: r.group, tests });
    }
  }
  return sanitizePrefs({ overrides, hidden, custom });
}

export const QuickInvestigationMenu: React.FC<Props> = ({ isPediatric, onOrder }) => {
  const uid = auth.currentUser?.uid || "";
  const [prefs, setPrefs] = useState<QuickPanelPrefs>(() => (uid ? readLocalQuickPanels(uid) : EMPTY_PREFS));
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadQuickPanels().then((p) => { if (alive) setPrefs(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const panels = useMemo(() => orderForCase(getEffectivePanels(prefs), isPediatric), [prefs, isPediatric]);

  const handlePick = (panel: EffectivePanel) => {
    const added = onOrder(panel);
    setOpen(false);
    setNotice(added > 0 ? `${panel.name}: ${added} test${added === 1 ? "" : "s"} ordered` : `${panel.name}: already ordered`);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          id="quick-investigation-button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wide rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" />
          Quick Investigation
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {notice && <span role="status" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{notice}</span>}
      </div>

      {open && (
        <div
          role="listbox"
          id="quick-investigation-list"
          className="absolute z-30 mt-1 w-full sm:w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg p-1"
        >
          <div className="max-h-[50vh] overflow-y-auto">
          {panels.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No panels. Use “Manage panels” to add one.</p>}
          {panels.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              title={p.tests.join(", ")}
              onClick={() => handlePick(p)}
              className="w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">{p.name}</span>
              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                {p.group !== (isPediatric ? "pediatric" : "adult") ? `${p.group === "pediatric" ? "Paeds" : "Adult"} · ` : ""}{p.tests.length} tests
              </span>
            </button>
          ))}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
            <button
              type="button"
              id="quick-investigation-manage"
              onClick={() => { setOpen(false); setManage(true); }}
              className="w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <Settings2 className="w-4 h-4" /> Manage panels (rename / add your own)
            </button>
          </div>
        </div>
      )}

      {manage && (
        <ManagePanels
          prefs={prefs}
          onClose={() => setManage(false)}
          onSaved={(p) => { setPrefs(p); setManage(false); setNotice("Panels saved"); }}
        />
      )}
    </div>
  );
};

const ManagePanels: React.FC<{ prefs: QuickPanelPrefs; onClose: () => void; onSaved: (p: QuickPanelPrefs) => void }> = ({ prefs, onClose, onSaved }) => {
  const [rows, setRows] = useState<DraftRow[]>(() => buildDraft(prefs));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const customCount = rows.filter((r) => !r.builtIn).length;

  const update = (id: string, patch: Partial<DraftRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (customCount >= MAX_CUSTOM_PANELS) { setError(`You can add up to ${MAX_CUSTOM_PANELS} custom panels.`); return; }
    setRows((rs) => [...rs, { id: newCustomId(), builtIn: false, originalName: "", originalTests: [], name: "", testsText: "", group: "adult", hidden: false }]);
  };

  const handleSave = async () => {
    // Validate: visible rows need a unique name and at least one test.
    const asPanels = rows.map((r) => ({ id: r.id, name: r.name, group: r.group, tests: parseTests(r.testsText), builtIn: r.builtIn, modified: false })) as EffectivePanel[];
    for (const r of rows) {
      if (r.builtIn && r.hidden) continue;
      const nameErr = validatePanelName(r.name, asPanels, r.id);
      if (nameErr) { setError(`${r.name.trim() || "New panel"}: ${nameErr}`); return; }
      if (parseTests(r.testsText).length === 0) { setError(`${r.name.trim()}: add at least one test.`); return; }
    }
    setError(null);
    setSaving(true);
    const next = draftToPrefs(rows);
    const cloud = await saveQuickPanels(next);
    setSaving(false);
    if (!cloud) setError(null); // kept locally; still close — the local copy is applied
    onSaved(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Manage quick investigation panels">
      <div className="bg-white dark:bg-slate-950 w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:text-white">Quick Investigation panels</h3>
            <p className="text-[11px] text-slate-500">Rename, change tests, hide, or add your own to match your hospital policy. Saved for your account.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 min-w-[40px] min-h-[40px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={`rounded-xl border p-3 space-y-2 ${r.hidden ? "opacity-60 border-dashed border-slate-300 dark:border-slate-700" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-center gap-2">
                <input
                  value={r.name}
                  maxLength={MAX_NAME_LEN}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                  placeholder="Panel name"
                  aria-label="Panel name"
                  className="flex-1 min-w-0 px-2.5 py-2 text-xs font-bold uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                {!r.builtIn && (
                  <select value={r.group} onChange={(e) => update(r.id, { group: e.target.value as PanelGroup })} aria-label="Group" className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <option value="adult">Adult</option>
                    <option value="pediatric">Paediatric</option>
                  </select>
                )}
                {r.builtIn ? (
                  <button type="button" onClick={() => update(r.id, { hidden: !r.hidden })} title={r.hidden ? "Show in menu" : "Hide from menu"} aria-label={r.hidden ? "Show" : "Hide"} className="p-2 min-w-[40px] min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700">
                    {r.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                ) : (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} title="Delete panel" aria-label="Delete" className="p-2 min-w-[40px] min-h-[40px] rounded-lg border border-rose-200 text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <textarea
                value={r.testsText}
                rows={2}
                onChange={(e) => update(r.id, { testsText: e.target.value })}
                placeholder="Tests, separated by commas (e.g. CBC, CRP, RFT)"
                aria-label="Tests"
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              {r.builtIn && (r.name.trim() !== r.originalName || parseTests(r.testsText).join("|") !== r.originalTests.join("|")) && (
                <button type="button" onClick={() => update(r.id, { name: r.originalName, testsText: r.originalTests.join(", ") })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                  <RotateCcw className="w-3 h-3" /> Reset to default
                </button>
              )}
            </div>
          ))}
          <button type="button" id="quick-investigation-add" onClick={addRow} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-bold rounded-xl border border-dashed border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-900">
            <Plus className="w-4 h-4" /> New panel
          </button>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 justify-end flex-wrap">
          {error && <p role="alert" className="mr-auto text-[11px] font-semibold text-rose-600">{error}</p>}
          <button type="button" onClick={onClose} className="px-4 py-2 min-h-[40px] text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700">Cancel</button>
          <button type="button" id="quick-investigation-save" disabled={saving} onClick={handleSave} className="px-4 py-2 min-h-[40px] text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-60">{saving ? "Saving…" : "Save panels"}</button>
        </div>
      </div>
    </div>
  );
};
