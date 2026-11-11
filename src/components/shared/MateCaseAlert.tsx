import React, { useState } from "react";
import type { ClinicalCase } from "../../types";
import { computeAbnormalFlags } from "../../utils/abnormalVitals";
import { useMateEventStore } from "../../mate/mateEventStore";
import type { MateEvent } from "../../utils/mateEventEngine";

/**
 * MATE alert chips for one case card (MATE Events Phase 1, Step 8).
 * Sits next to the red CRITICAL badge. Display + doctor actions only.
 *
 * - Blinking chip = an ALERT is due (red critical / amber recheck / blue reminder) with
 *   Seen · Reviewed · Done · Snooze buttons.
 * - Steady amber "Abnormal" chip = CLINICAL state from saved values. It stays until a new
 *   reading is normal, whatever the doctor tapped (Seen/Reviewed never change clinical state).
 * "No chip" means nothing abnormal recorded — not that the patient is safe.
 */

function hhmm(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function ActionButton({ label, onClick, tone }: { label: string; onClick: () => Promise<boolean> | void; tone: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try { await onClick(); } finally { setBusy(false); }
      }}
      className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-white/90 dark:bg-slate-900 disabled:opacity-50 ${tone}`}
    >
      {busy ? "…" : label}
    </button>
  );
}

export function MateCaseAlert({ caseData }: { caseData: ClinicalCase }) {
  const { events, actions } = useMateEventStore();
  if (!caseData?.id) return null;
  const mine = events.filter((e: MateEvent) => e.caseId === caseData.id);
  const crit = mine.find((e) => e.type === "critical");
  const abn = mine.find((e) => e.type === "abnormal");
  const reminders = mine.filter((e) => e.type === "reminder" && (e.alertState === "pending" || e.alertState === "due"));
  const amberFlags = computeAbnormalFlags(caseData);

  const chips: React.ReactNode[] = [];

  // 🔴 Critical alert due → blink + Seen
  if (crit && crit.alertState === "due" && actions) {
    chips.push(
      <span key="crit" role="alert"
        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider ring-2 ring-rose-300 motion-safe:animate-pulse">
        Critical alert
        <ActionButton label="Seen" tone="text-rose-700 border-rose-200" onClick={() => actions.seen(crit.id)} />
      </span>,
    );
  }

  // 🟠 Abnormal: due → blink + Reviewed / Snooze; otherwise steady chip while values are abnormal
  if (abn && abn.alertState === "due" && actions) {
    chips.push(
      <span key="abn" role="alert"
        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider ring-2 ring-amber-300 motion-safe:animate-pulse">
        Recheck vitals
        <ActionButton label="Reviewed" tone="text-amber-700 border-amber-200" onClick={() => actions.reviewed(abn.id)} />
        <ActionButton label="15 min" tone="text-amber-700 border-amber-200" onClick={() => actions.snooze(abn.id, 15)} />
      </span>,
    );
  } else if (amberFlags.length > 0) {
    const recheck = abn && abn.alertState === "pending" ? ` · recheck ${hhmm(abn.dueAt)}` : "";
    chips.push(
      <span key="amber" title={amberFlags.map((f) => `${f.label}: ${f.display}`).join("\n")}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[9px] font-black uppercase tracking-wider">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Abnormal{recheck}
      </span>,
    );
  }

  // 🔵 Reminders
  for (const r of reminders) {
    if (r.alertState === "due" && actions) {
      chips.push(
        <span key={r.id} role="alert"
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-sky-600 text-white text-[9px] font-black uppercase tracking-wider ring-2 ring-sky-300 motion-safe:animate-pulse">
          {r.title}
          <ActionButton label="Done" tone="text-sky-700 border-sky-200" onClick={() => actions.reviewed(r.id)} />
          <ActionButton label="10 min" tone="text-sky-700 border-sky-200" onClick={() => actions.snooze(r.id, 10)} />
        </span>,
      );
    } else {
      chips.push(
        <span key={r.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 text-[9px] font-bold uppercase tracking-wider">
          ⏰ {r.title} {hhmm(r.dueAt)}
        </span>,
      );
    }
  }

  if (chips.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap" onClick={stop}>
      {chips}
    </span>
  );
}