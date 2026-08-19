import VoiceRecorder from "./shared/VoiceRecorder";
import React from "react";
import { Eye, Wind, Droplet } from "lucide-react";
import { CollapsibleSection, ChipGroup, ToggleSwitchGrid } from "./ManualEntryPrimitives";
import { getAgeBand, type PediatricVitalParam } from "../../server/pediatricClinicalRanges";

export interface PatAppearanceState {
  tone: string;
  interactivity: string;
  consolability: string;
  lookGaze: string;
  speechCry: string;
}

export interface PatState {
  appearance: PatAppearanceState;
  workOfBreathing: string[];
  circulationToSkin: string[];
}

const TICLS_FIELDS: { key: keyof PatAppearanceState; label: string; helper: string; options: string[] }[] = [
  {
    key: "tone",
    label: "Tone",
    helper: "Child's muscle tone and movement",
    options: ["Moves spontaneously", "Resists examination", "Sits or stands", "Floppy"],
  },
  {
    key: "interactivity",
    label: "Interactivity",
    helper: "Alertness and engagement with clinician",
    options: ["Alert", "Engaged", "Interacts well", "Reaches for objects", "Unresponsive"],
  },
  {
    key: "consolability",
    label: "Consolability",
    helper: "Response to comforting by caregiver",
    options: ["Stops crying with caregiver", "Inconsolable"],
  },
  {
    key: "lookGaze",
    label: "Look / Gaze",
    helper: "Eye contact and visual tracking",
    options: ["Makes eye contact", "Tracks visually", "Normal behavior", "Abnormal behavior"],
  },
  {
    key: "speechCry",
    label: "Speech / Cry",
    helper: "Age-appropriate vocalization",
    options: ["Age appropriate speech", "Strong cry", "Weak cry", "No cry"],
  },
];

export function PediatricAssessmentTriangle({
  state, onChange,
}: { state: PatState; onChange: (s: PatState) => void }) {
  const setAppearanceField = (key: keyof PatAppearanceState, value: string) => {
    onChange({ ...state, appearance: { ...state.appearance, [key]: value } });
  };

  return (
    <div className="space-y-1">
      <h3 className="text-slate-900 dark:text-white font-bold text-xl mb-1">Pediatric Assessment Triangle (PAT)</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Quick visual assessment without touching the child</p>

      <CollapsibleSection icon={<Eye size={18} />} iconBgColor="bg-blue-600" title="Appearance (TICLS)" titleColor="text-blue-600 dark:text-blue-400">
        <div className="space-y-4">
          {TICLS_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="text-slate-800 dark:text-white text-sm font-semibold block">{field.label}</label>
              <p className="text-slate-500 text-xs mb-1.5">{field.helper}</p>
              <select
                value={state.appearance[field.key]}
                onChange={(e) => setAppearanceField(field.key, e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm"
              >
                <option value="">-- Select --</option>
                {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<Wind size={18} />} iconBgColor="bg-orange-500" title="Work of Breathing" titleColor="text-orange-600 dark:text-orange-400">
        <ChipGroup
          groupLabel="Visual breathing effort"
          options={[
            "Normal, no distress", "Increased rate, mild effort", "Retractions (subcostal/intercostal)",
            "Nasal flaring", "Head bobbing / grunting", "Apnea / minimal effort",
          ]}
          selected={state.workOfBreathing}
          onChange={(workOfBreathing) => onChange({ ...state, workOfBreathing })}
        />
      </CollapsibleSection>

      <CollapsibleSection icon={<Droplet size={18} />} iconBgColor="bg-red-600" title="Circulation to Skin" titleColor="text-red-600 dark:text-red-400">
        <ChipGroup
          groupLabel="Color and perfusion"
          options={["Pink, warm", "Pale", "Mottled", "Cyanotic", "Flushed"]}
          selected={state.circulationToSkin}
          onChange={(circulationToSkin) => onChange({ ...state, circulationToSkin })}
        />
      </CollapsibleSection>
    </div>
  );
}

function estimateWeightKg(ageYears: number): number {
  return Math.round((ageYears + 4) * 2);
}

export interface PediatricVitalsState {
  hr: string; rr: string; spo2: string; temp: string;
  bpSys: string; bpDia: string; gcsE: string; gcsV: string; gcsM: string;
  painScore: string; grbs: string; weightKg: string;
  broughtBy: string; informant: string;
}

export function PediatricVitalsSection({
  ageYears, state, onChange,
}: { ageYears: number; state: PediatricVitalsState; onChange: (s: PediatricVitalsState) => void }) {
  const ageMonths = ageYears * 12;
  const band = getAgeBand(ageMonths);
  const estimatedWeight = estimateWeightKg(ageYears);

  const ref = band?.ranges;

  return (
    <div className="space-y-4">
      {band && ref && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 space-y-2">
          <p className="text-slate-800 dark:text-white font-bold flex items-center gap-2">📊 Normal Vitals Reference (Pediatric)</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">{band.label}</p>
          <div className="grid grid-cols-3 gap-y-1 text-sm">
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">HR:</span> <span className="text-slate-800 dark:text-white">{ref.hr?.low}-{ref.hr?.high} bpm</span></div>
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">RR:</span> <span className="text-slate-800 dark:text-white">{ref.rr?.low}-{ref.rr?.high} /min</span></div>
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">BP:</span> <span className="text-slate-800 dark:text-white">{ref.sbp?.low}-{ref.sbp?.high}/—</span></div>
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">SpO2:</span> <span className="text-slate-800 dark:text-white">{ref.spo2?.low}-100%</span></div>
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">Temp:</span> <span className="text-slate-800 dark:text-white">{ref.temp?.low}-{ref.temp?.high}°C</span></div>
            <div><span className="text-emerald-600 dark:text-emerald-400 font-semibold">GCS:</span> <span className="text-slate-800 dark:text-white">15/15</span></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {([
          ["hr", "HR", ref?.hr ? `${ref.hr.low}-${ref.hr.high} bpm` : ""],
          ["rr", "RR", ref?.rr ? `${ref.rr.low}-${ref.rr.high} /min` : ""],
          ["spo2", "SpO2", ref?.spo2 ? `${ref.spo2.low}-100%` : ""],
          ["temp", "Temp", ref?.temp ? `${ref.temp.low}-${ref.temp.high}°C` : ""],
        ] as const).map(([key, label, hint]) => (
          <div key={key}>
            <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1 text-center">{label}</label>
            <input
              value={state[key as keyof PediatricVitalsState]}
              onChange={e => onChange({ ...state, [key]: e.target.value })}
              placeholder="--"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-3 text-slate-800 dark:text-white text-center text-lg font-semibold"
            />
            {hint && <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-0.5 italic">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1 text-center">BP (Sys/Dia)</label>
          <div className="flex gap-1 items-center">
            <input value={state.bpSys} onChange={e => onChange({ ...state, bpSys: e.target.value })} placeholder="--" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-3 text-slate-800 dark:text-white text-center" />
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <input value={state.bpDia} onChange={e => onChange({ ...state, bpDia: e.target.value })} placeholder="--" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-3 text-slate-800 dark:text-white text-center" />
          </div>
          {ref?.sbp && <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-0.5 italic">{ref.sbp.low}-{ref.sbp.high}/—</p>}
        </div>
        <div>
          <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1 text-center">GCS (E/V/M)</label>
          <div className="flex gap-1">
            <input value={state.gcsE} onChange={e => onChange({ ...state, gcsE: e.target.value })} placeholder="4" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1 py-3 text-slate-800 dark:text-white text-center" />
            <input value={state.gcsV} onChange={e => onChange({ ...state, gcsV: e.target.value })} placeholder="5" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1 py-3 text-slate-800 dark:text-white text-center" />
            <input value={state.gcsM} onChange={e => onChange({ ...state, gcsM: e.target.value })} placeholder="6" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1 py-3 text-slate-800 dark:text-white text-center" />
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-0.5 italic">E/V/M = 15/15</p>
        </div>
        <div>
          <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1 text-center">Pain</label>
          <input value={state.painScore} onChange={e => onChange({ ...state, painScore: e.target.value })} placeholder="--" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-3 text-slate-800 dark:text-white text-center" />
          <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center mt-0.5 italic">/10</p>
        </div>
      </div>

      <div>
        <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1">GRBS</label>
        <input value={state.grbs} onChange={e => onChange({ ...state, grbs: e.target.value })} placeholder="mg/dL" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-3 text-slate-800 dark:text-white" />
      </div>

      <div className="border-2 border-dashed border-blue-500 rounded-2xl p-4">
        <p className="text-slate-900 dark:text-white font-semibold flex items-center gap-2 mb-2">📈 Weight (kg)</p>
        <div className="flex items-center gap-2">
          <input
            value={state.weightKg}
            onChange={e => onChange({ ...state, weightKg: e.target.value })}
            placeholder="Enter weight in kg"
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-slate-800 dark:text-white"
          />
          <span className="text-slate-500 dark:text-slate-400">kg</span>
        </div>
        {!state.weightKg && (
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2 italic">
            Weight needed for accurate drug dosing. Estimated: {estimatedWeight}kg
          </p>
        )}
      </div>

      <div>
        <label className="text-slate-900 dark:text-white font-semibold block mb-1">Brought By</label>
        <input value={state.broughtBy} onChange={e => onChange({ ...state, broughtBy: e.target.value })} placeholder="Self" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-slate-800 dark:text-white" />
      </div>
      <div>
        <label className="text-slate-900 dark:text-white font-semibold block mb-1">Informant</label>
        <input value={state.informant} onChange={e => onChange({ ...state, informant: e.target.value })} placeholder="e.g. Parent (Reliable)" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-slate-800 dark:text-white" />
      </div>
    </div>
  );
}

export interface PediatricSymptomsState {
  breathingDifficulty: boolean;
  feverHeadacheFatigueAbdominal: boolean;
  vomitingDiarrheaBleedingAgitation: boolean;
  decreasedOralIntake: boolean;
  otherSymptoms: string;
  timeCourse: string;
}

export function SignsAndSymptomsSection({
  state, onChange,
}: { state: PediatricSymptomsState; onChange: (s: PediatricSymptomsState) => void }) {
  const fields = [
    { key: "breathingDifficulty", label: "Breathing difficulty (cough, wheezing, tachypnea)", value: state.breathingDifficulty },
    { key: "feverHeadacheFatigueAbdominal", label: "Fever, headache, fatigue, abdominal pain", value: state.feverHeadacheFatigueAbdominal },
    { key: "vomitingDiarrheaBleedingAgitation", label: "Vomiting, diarrhea, bleeding, agitation", value: state.vomitingDiarrheaBleedingAgitation },
    { key: "decreasedOralIntake", label: "Decreased oral intake, fatigue, irritability", value: state.decreasedOralIntake },
  ];

  return (
    <CollapsibleSection icon={<span>⚠</span>} iconBgColor="bg-orange-500" title="Signs and Symptoms" titleColor="text-orange-600 dark:text-orange-400" defaultOpen>
      <div className="space-y-4">
        <ToggleSwitchGrid columns={1} fields={fields} onChange={(key, value) => onChange({ ...state, [key]: value })} />
        <div>
          <label className="text-slate-900 dark:text-white font-medium block mb-1.5">Other Symptoms (type or dictate)</label>
          <div className="flex gap-2">
            <textarea
              value={state.otherSymptoms}
              onChange={e => onChange({ ...state, otherSymptoms: e.target.value })}
              placeholder="Describe other symptoms: rash, swelling, pain location, etc..."
              className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm min-h-[80px]"
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange({ ...state, otherSymptoms: (state.otherSymptoms ? state.otherSymptoms + " " : "") + txt })}
            />
          </div>
        </div>
        <div>
          <label className="text-slate-900 dark:text-white font-medium block mb-1.5">Time Course of Symptoms</label>
          <div className="flex gap-2">
            <textarea
              value={state.timeCourse}
              onChange={e => onChange({ ...state, timeCourse: e.target.value })}
              placeholder="Onset: sudden, gradual..."
              className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm min-h-[80px]"
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange({ ...state, timeCourse: (state.timeCourse ? state.timeCourse + " " : "") + txt })}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

export function PediatricEnvironmentMedsField({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-slate-900 dark:text-white font-medium block mb-1.5">Medications Found in Child's Environment</label>
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Any medications child may have accessed..."
          className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm min-h-[80px]"
        />
        <VoiceRecorder
          renderMode="compact-button"
          onTranscript={(txt) => onChange((value ? value + " " : "") + txt)}
        />
      </div>
    </div>
  );
}
