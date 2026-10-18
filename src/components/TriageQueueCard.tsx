import React, { useEffect, useState } from "react";
import { Clock, UserCheck, ShieldAlert } from "lucide-react";
import type { ClinicalCase } from "../types";
import { buildTriageQueue } from "../utils/triageQueue";
import { getTriageDisplay, triageBadgeClass } from "../utils/triageScale";
import { isolationBanner } from "../utils/triageScreening";

interface Props {
  cases: ClinicalCase[];
  onTake: (caseId: string) => void | Promise<void>;
  onOpen: (caseId: string) => void;
}

/** Waiting queue: patients triaged at the desk that no doctor has taken yet. Hidden when empty. */
export default function TriageQueueCard({ cases, onTake, onOpen }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const queue = buildTriageQueue(cases, now);
  if (queue.length === 0) return null;
  return (
    <section data-testid="triage-queue" className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Waiting for a doctor · {queue.length}</h3>
      </div>
      {queue.map((q) => {
        const c = q.case;
        const d = getTriageDisplay(c.patient);
        const iso = isolationBanner(c.patient?.triageScreening);
        return (
          <div key={q.id} data-testid="triage-queue-row" className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-black ${triageBadgeClass(d.tone, "solid-soft")}`}>{d.code}</span>
            <button type="button" onClick={() => onOpen(q.id)} className="min-w-0 flex-1 text-left">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {c.patient?.name || "Unnamed"}{c.patient?.age !== null && c.patient?.age !== undefined ? ` · ${c.patient.age}y` : ""}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{c.patient?.presentingComplaint || "—"}</div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 ${q.overTarget ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                  <Clock className="w-3 h-3" />{q.waitMinutes} min{q.targetMinutes !== null ? ` / target ${q.targetMinutes}` : ""}
                </span>
                {iso && <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><ShieldAlert className="w-3 h-3" />Isolation</span>}
              </div>
            </button>
            <button
              type="button"
              disabled={busyId === q.id}
              onClick={async () => { setBusyId(q.id); try { await onTake(q.id); } finally { setBusyId(null); } }}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-60"
            >
              <UserCheck className="w-3.5 h-3.5" />Take patient
            </button>
          </div>
        );
      })}
    </section>
  );
}
