/**
 * Outcome details for a referral, LAMA or death (25 Nov 2026). What is typed here writes the closing
 * paragraph of the Course in Hospital; nothing is assumed when a box is left empty (Rule 8).
 */
import React from "react";
import type { DischargeOutcomeDetails } from "../types";
import type { OutcomeKind } from "../utils/dischargeSyncEngine";

type Field = { k: keyof DischargeOutcomeDetails; label: string; ph: string; wide?: boolean };

const FIELDS: Partial<Record<OutcomeKind, { title: string; fields: Field[] }>> = {
  referral: {
    title: "Referral details",
    fields: [
      { k: "referredTo", label: "Referred to", ph: "Hospital / department" },
      { k: "referralReason", label: "Reason for referral", ph: "e.g. non-availability of neurosurgery ICU bed" },
      { k: "acceptingDoctor", label: "Accepting doctor", ph: "Name, if discussed" },
      { k: "transportMode", label: "Mode of transport", ph: "e.g. ALS ambulance" },
      { k: "transferSupport", label: "Support during transfer", ph: "e.g. ventilator, noradrenaline infusion", wide: true },
    ],
  },
  lama: {
    title: "LAMA details",
    fields: [
      { k: "counselledPerson", label: "Counselled (name)", ph: "Name" },
      { k: "counselledRelation", label: "Relationship", ph: "e.g. Son / Self" },
      { k: "risksExplained", label: "Risks explained, incl. death", ph: "Yes / No" },
      { k: "lamaFormSignedAt", label: "LAMA form signed at", ph: "Time and date" },
      { k: "witness", label: "Witness", ph: "Name, designation" },
    ],
  },
  death: {
    title: "Death details",
    fields: [
      { k: "timeOfDeath", label: "Date and time of death", ph: "e.g. 2:15 PM on 17/11/2026" },
      { k: "declaredBy", label: "Declared by", ph: "Doctor" },
      { k: "resuscitation", label: "Resuscitation", ph: "e.g. CPR as per ACLS for 30 min / Not attempted (DNR)", wide: true },
      { k: "causeOfDeath", label: "Cause of death", ph: "As certified", wide: true },
      { k: "bodyHandedTo", label: "Body handed over to", ph: "Name, relationship / mortuary", wide: true },
    ],
  },
};

interface Props {
  kind: OutcomeKind;
  outcome: DischargeOutcomeDetails;
  onChange: (k: keyof DischargeOutcomeDetails, v: string) => void;
  isMlc: boolean;
  required: string[];
  advised: string[];
}

export default function DischargeOutcomeFields({ kind, outcome, onChange, isMlc, required, advised }: Props) {
  const spec = FIELDS[kind];
  if (!spec) return null;
  const fields = isMlc ? [...spec.fields, { k: "policeInformed" as const, label: "Police informed (MLC)", ph: "Station, GD entry / time", wide: true }] : spec.fields;
  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3" data-testid="discharge-outcome-fields">
      <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-xs">{spec.title}</h4>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">These write the last paragraph of the Course in Hospital. Leave a box empty if it was not done; ErMate will not assume it.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.k} className={`space-y-1 ${f.wide ? "md:col-span-2" : ""}`}>
            <span className="block font-bold text-slate-500 uppercase text-[9px]">{f.label}</span>
            <input
              type="text"
              value={String(outcome[f.k] || "")}
              placeholder={f.ph}
              onChange={(e) => onChange(f.k, e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </label>
        ))}
      </div>
      <OutcomeChecklistNote required={required} advised={advised} />
    </div>
  );
}

export function OutcomeChecklistNote({ required, advised, title }: { required: string[]; advised: string[]; title?: string }) {
  if (!required.length && !advised.length) return null;
  return (
    <div className="text-[11.5px] space-y-1" data-testid="discharge-outcome-checklist">
      {title && <div className="font-bold">{title}</div>}
      {required.length > 0 && (
        <div className="text-red-700 dark:text-red-300">
          <span className="font-bold">Needed before Finalise:</span> {required.join(" · ")}
        </div>
      )}
      {advised.length > 0 && (
        <div className="text-amber-800 dark:text-amber-300">
          <span className="font-bold">Advised:</span> {advised.join(" · ")}
        </div>
      )}
    </div>
  );
}