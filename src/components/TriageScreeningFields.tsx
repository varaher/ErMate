import React from "react";
import type { TriageScreening, IsolationType } from "../types";
import { COMMUNICABLE_SCREEN_PROMPT, ISOLATION_TYPES, needsEpidemiologicalHistory, suggestsIsolation } from "../utils/triageScreening";

interface Props {
  value: TriageScreening;
  onChange: (next: TriageScreening) => void;
  /** compact hides nothing; kept for case-sheet reuse */
  idPrefix?: string;
}

const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
    active ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
  }`;

function Choice<T extends string>({ label, options, value, onPick, testId }: { label: string; options: T[]; value?: T; onPick: (v: T | undefined) => void; testId: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5" data-testid={testId}>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onPick(value === o ? undefined : o)} className={chip(value === o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function YesNo({ label, value, onPick, testId }: { label: string; value?: boolean | null; onPick: (v: boolean | null) => void; testId: string }) {
  return (
    <div>
      <div className="text-xs text-slate-700 dark:text-slate-200 mb-1">{label}</div>
      <div className="flex gap-1.5" data-testid={testId}>
        <button type="button" aria-pressed={value === true} onClick={() => onPick(value === true ? null : true)} className={chip(value === true)}>Yes</button>
        <button type="button" aria-pressed={value === false} onClick={() => onPick(value === false ? null : false)} className={chip(value === false)}>No</button>
        {(value === null || value === undefined) && <span className="self-center text-[10px] text-slate-400">not assessed</span>}
      </div>
    </div>
  );
}

export default function TriageScreeningFields({ value, onChange, idPrefix = "ts" }: Props) {
  const set = (patch: Partial<TriageScreening>) => onChange({ ...value, ...patch });
  const showEpi = needsEpidemiologicalHistory(value);
  const toggleIso = (t: IsolationType) => {
    const cur = value.isolationTypes ?? [];
    set({ isolationTypes: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };
  const input = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100";
  return (
    <div className="space-y-4" data-testid={`${idPrefix}-screening`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Choice label="Level of consciousness" options={["Alert", "Drowsy", "Unconscious"] as const as unknown as ("Alert" | "Drowsy" | "Unconscious")[]} value={value.levelOfConsciousness} onPick={(v) => set({ levelOfConsciousness: v })} testId={`${idPrefix}-loc`} />
        <Choice label="Orientation" options={["Oriented", "Disoriented"] as ("Oriented" | "Disoriented")[]} value={value.orientation} onPick={(v) => set({ orientation: v })} testId={`${idPrefix}-orient`} />
        <Choice label="Arrived" options={["Walking", "Wheelchair", "Stretcher", "In lap"] as ("Walking" | "Wheelchair" | "Stretcher" | "In lap")[]} value={value.arrivalMobility} onPick={(v) => set({ arrivalMobility: v })} testId={`${idPrefix}-mobility`} />
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">Communicable-disease triage</div>
        <YesNo label={COMMUNICABLE_SCREEN_PROMPT} value={value.communicableScreenPositive} onPick={(v) => set({ communicableScreenPositive: v })} testId={`${idPrefix}-screen`} />
        <YesNo label="Known communicable disease?" value={value.knownCommunicableDisease} onPick={(v) => set({ knownCommunicableDisease: v })} testId={`${idPrefix}-known`} />
        {value.knownCommunicableDisease === true && (
          <input className={input} placeholder="Which disease?" value={value.knownCommunicableDiseaseName ?? ""} onChange={(e) => set({ knownCommunicableDiseaseName: e.target.value })} />
        )}
        {showEpi && (
          <div className="space-y-3 border-t border-amber-200 dark:border-amber-900 pt-3" data-testid={`${idPrefix}-epi`}>
            <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Epidemiological history</div>
            <YesNo label="Travelled to an endemic / outbreak area in the last 3 weeks?" value={value.travelEndemicArea3Weeks} onPick={(v) => set({ travelEndemicArea3Weeks: v })} testId={`${idPrefix}-travel`} />
            {value.travelEndemicArea3Weeks === true && (
              <input className={input} placeholder="Where / when (place, dates)" value={value.travelDetails ?? ""} onChange={(e) => set({ travelDetails: e.target.value })} />
            )}
            <YesNo label="Close contact with someone with similar symptoms?" value={value.closeContactSimilarSymptoms} onPick={(v) => set({ closeContactSimilarSymptoms: v })} testId={`${idPrefix}-contact`} />
            <YesNo label="Healthcare-worker / hospital exposure?" value={value.healthcareWorkerExposure} onPick={(v) => set({ healthcareWorkerExposure: v })} testId={`${idPrefix}-hcw`} />
            <YesNo label="Contact with pets / livestock / animals?" value={value.petsLivestockContact} onPick={(v) => set({ petsLivestockContact: v })} testId={`${idPrefix}-pets`} />
          </div>
        )}
        <div className="border-t border-amber-200 dark:border-amber-900 pt-3 space-y-2">
          <YesNo label="Isolation required?" value={value.isolationRequired} onPick={(v) => set({ isolationRequired: v })} testId={`${idPrefix}-iso`} />
          {suggestsIsolation(value) && value.isolationRequired !== true && (
            <div role="status" className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold" data-testid={`${idPrefix}-iso-suggest`}>
              Screen positive — consider isolation precautions.
            </div>
          )}
          {value.isolationRequired === true && (
            <div className="flex gap-1.5" data-testid={`${idPrefix}-iso-types`}>
              {ISOLATION_TYPES.map((t) => (
                <button key={t} type="button" aria-pressed={!!value.isolationTypes?.includes(t)} onClick={() => toggleIso(t)} className={chip(!!value.isolationTypes?.includes(t))}>{t}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Triaged by (nurse / EMT)</div>
          <input className={input} placeholder="Name" value={value.triagedByName ?? ""} onChange={(e) => set({ triagedByName: e.target.value })} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Emp ID</div>
          <input className={input} placeholder="Employee ID" value={value.triagedByEmpId ?? ""} onChange={(e) => set({ triagedByEmpId: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
