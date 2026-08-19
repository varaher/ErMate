import VoiceRecorder from "./shared/VoiceRecorder";
import React from "react";
import { AlertTriangle } from "lucide-react";
import { CollapsibleSection } from "./ManualEntryPrimitives";

/**
 * CaseSheetAdjunctsAndMlc.tsx
 *
 * Two additions:
 *   1. ECG / Bedside Echo / EFAST — single-select dropdown +
 *      free-text notes, matching the exact option lists from the
 *      reference app screenshots. These are dropdowns (not chips)
 *      because each is a single clinical interpretation category,
 *      not a multi-select set of findings.
 *   2. MLC Details — conditional block shown when "MLC Case" toggle
 *      is on, matching the Patient tab reference screenshot exactly.
 *
 * COMPATIBILITY: writes into adjuncts.ecgInterpretation/ecgNotes,
 * adjuncts.echoInterpretation/echoNotes, adjuncts.efastInterpretation/
 * efastNotes, and patient.mlcDetails.* — confirm these exact field
 * names against your real ClinicalCase interface.
 */

// ── Reusable single-select interpretation dropdown + notes ──────────

interface InterpretationFieldProps {
  label: string;
  options: string[]; // first option should always be "Not done"
  value: string;
  onChange: (value: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  notesPlaceholder: string;
}

function InterpretationField({
  label,
  options,
  value,
  onChange,
  notes,
  onNotesChange,
  notesPlaceholder,
}: InterpretationFieldProps) {
  return (
    <CollapsibleSection icon={<span>📷</span>} iconBgColor="bg-emerald-600" title={label} titleColor="text-emerald-400">
      <div className="space-y-3">
        <div>
          <label className="text-slate-300 text-sm block mb-1.5">{label} Interpretation</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-emerald-500"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-slate-300 text-sm block mb-1.5">{label} Notes</label>
          <div className="flex gap-2">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={notesPlaceholder}
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[100px] focus:outline-none focus:border-emerald-500"
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onNotesChange((notes ? notes + " " : "") + txt)}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ── ECG ───────────────────────────────────────────────────────────

export const ECG_OPTIONS = [
  "Not done",
  "Normal sinus rhythm",
  "Sinus tachycardia",
  "Sinus bradycardia",
  "Atrial fibrillation",
  "Atrial flutter",
  "SVT",
  "VT",
  "VF",
  "STEMI",
  "NSTEMI equivalent",
  "Heart block",
  "Other",
];

export function EcgField({
  interpretation,
  notes,
  onInterpretationChange,
  onNotesChange,
}: {
  interpretation: string;
  notes: string;
  onInterpretationChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  return (
    <InterpretationField
      label="ECG"
      options={ECG_OPTIONS}
      value={interpretation}
      onChange={onInterpretationChange}
      notes={notes}
      onNotesChange={onNotesChange}
      notesPlaceholder="Detailed ECG findings..."
    />
  );
}

// ── Bedside Echo ──────────────────────────────────────────────────

export const ECHO_OPTIONS = [
  "Not done",
  "Normal",
  "Reduced EF",
  "RV strain",
  "Pericardial effusion",
  "Tamponade physiology",
  "Hypovolemia (IVC collapse)",
  "Other",
];

export function BedsideEchoField({
  interpretation,
  notes,
  onInterpretationChange,
  onNotesChange,
}: {
  interpretation: string;
  notes: string;
  onInterpretationChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  return (
    <InterpretationField
      label="Bedside Echo"
      options={ECHO_OPTIONS}
      value={interpretation}
      onChange={onInterpretationChange}
      notes={notes}
      onNotesChange={onNotesChange}
      notesPlaceholder="Detailed echo findings..."
    />
  );
}

// ── EFAST ─────────────────────────────────────────────────────────

export const EFAST_OPTIONS = [
  "Not done",
  "Negative",
  "Positive - RUQ",
  "Positive - LUQ",
  "Positive - Pelvis",
  "Positive - Pericardial",
  "Positive - Pneumothorax",
  "Positive - Multiple",
  "Other",
];

export function EfastField({
  interpretation,
  notes,
  onInterpretationChange,
  onNotesChange,
}: {
  interpretation: string;
  notes: string;
  onInterpretationChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  return (
    <InterpretationField
      label="EFAST"
      options={EFAST_OPTIONS}
      value={interpretation}
      onChange={onInterpretationChange}
      notes={notes}
      onNotesChange={onNotesChange}
      notesPlaceholder="Detailed EFAST findings..."
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// MLC Details — Patient tab, conditional on MLC Case toggle
// ══════════════════════════════════════════════════════════════════

export interface MlcDetailsState {
  isMlc: boolean;
  natureOfIncident: string;
  dateTimeOfIncident: string; // ISO datetime string
  placeOfIncident: string;
  identificationMark: string;
  informantBroughtBy: string;
}

export function MlcCaseToggle({
  state,
  onChange,
}: {
  state: MlcDetailsState;
  onChange: (s: MlcDetailsState) => void;
}) {
  return (
    <div className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-slate-800 dark:text-white font-semibold text-base">MLC Case</span>
        <button
          type="button"
          onClick={() => onChange({ ...state, isMlc: !state.isMlc })}
          className={`w-14 h-8 rounded-full relative transition-colors ${
            state.isMlc ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
              state.isMlc ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {state.isMlc && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={18} />
            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">MLC Details</h4>
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-300 text-xs font-semibold block mb-1">Nature of Incident</label>
            <input
              type="text"
              value={state.natureOfIncident}
              onChange={(e) => onChange({ ...state, natureOfIncident: e.target.value })}
              placeholder="e.g., Road Traffic Accident, Assault"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-300 text-xs font-semibold block mb-1">Date & Time of Incident</label>
            <input
              type="datetime-local"
              value={state.dateTimeOfIncident}
              onChange={(e) => onChange({ ...state, dateTimeOfIncident: e.target.value })}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-300 text-xs font-semibold block mb-1">Place of Incident</label>
            <input
              type="text"
              value={state.placeOfIncident}
              onChange={(e) => onChange({ ...state, placeOfIncident: e.target.value })}
              placeholder="Location where incident occurred"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-300 text-xs font-semibold block mb-1">Identification Mark</label>
            <input
              type="text"
              value={state.identificationMark}
              onChange={(e) => onChange({ ...state, identificationMark: e.target.value })}
              placeholder="Any identifying marks"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-300 text-xs font-semibold block mb-1">Informant/Brought By</label>
            <input
              type="text"
              value={state.informantBroughtBy}
              onChange={(e) => onChange({ ...state, informantBroughtBy: e.target.value })}
              placeholder="Self / Relative name & relation"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
