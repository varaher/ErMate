import React from "react";
import { CollapsibleSection, ChipGroup } from "./ManualEntryPrimitives";
import VoiceRecorder from "./shared/VoiceRecorder";

/**
 * PediatricABCDESections.tsx
 *
 * Built directly from PEDIATRIC_CASE_SHEET.docx (user-supplied
 * reference), field-for-field. This is the ABCDE section that comes
 * AFTER PAT (which lives in PediatricCaseSheetFields.tsx, already
 * corrected with full TICLS structure). Also covers the EFAST
 * adjunct, Focused Physical Examination, and Disposition — completing
 * the full pediatric case sheet per the reference document.
 *
 * NOTE ON "Cry": this appears TWICE in the reference, in two
 * genuinely different sections — PAT's "Speech/Cry" (TICLS, already
 * built) and, separately, this Airway section's own "Cry: Good/Weak/
 * No Cry". These are kept as two distinct fields, matching the
 * reference exactly, not merged.
 */

// ══════════════════════════════════════════════════════════════════
// A — Airway
// ══════════════════════════════════════════════════════════════════

export interface PediatricAirwayState {
  cry: string;              // "Good" | "Weak" | "No Cry"
  airwayStatus: string;     // "Patent" | "Threatened" | "Compromised"
  intervention: string;     // free text
}

export function PediatricAirwaySection({
  state, onChange,
}: { state: PediatricAirwayState; onChange: (s: PediatricAirwayState) => void }) {
  return (
    <CollapsibleSection icon={<span>A</span>} iconBgColor="bg-red-600" title="Airway" titleColor="text-red-400" defaultOpen>
      <div className="space-y-4">
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Cry</label>
          <select value={state.cry} onChange={(e) => onChange({ ...state, cry: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Good</option>
            <option>Weak</option>
            <option>No Cry</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Airway Status</label>
          <select value={state.airwayStatus} onChange={(e) => onChange({ ...state, airwayStatus: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Patent</option>
            <option>Threatened</option>
            <option>Compromised</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Intervention</label>
          <div className="flex gap-2">
            <textarea value={state.intervention} onChange={(e) => onChange({ ...state, intervention: e.target.value })}
              placeholder="e.g., airway clearance, repositioning, intubation, etc."
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, intervention: (state.intervention ? state.intervention + " " : "") + txt })} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// B — Breathing
// ══════════════════════════════════════════════════════════════════

export interface PediatricBreathingState {
  rr: string;
  spo2: string;
  wobFindings: string[];        // nasal flaring, retractions, grunting, wheezing, stridor, snoring, gurgling
  abnormalPositioning: string[]; // Tripod / Sniffing / Prefers seated
  airEntry: string;             // "Normal" | "Abnormal"
  subcutaneousEmphysema: string; // "Yes" | "No"
  intervention: string;
}

export function PediatricBreathingSection({
  state, onChange,
}: { state: PediatricBreathingState; onChange: (s: PediatricBreathingState) => void }) {
  return (
    <CollapsibleSection icon={<span>B</span>} iconBgColor="bg-orange-500" title="Breathing" titleColor="text-orange-400" defaultOpen>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Respiratory Rate (RR)</label>
            <input value={state.rr} onChange={(e) => onChange({ ...state, rr: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" placeholder="/min" />
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">SpO2</label>
            <input value={state.spo2} onChange={(e) => onChange({ ...state, spo2: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" placeholder="%" />
          </div>
        </div>

        <ChipGroup
          groupLabel="Work of Breathing (WOB)"
          options={["Nasal flaring", "Retractions", "Grunting", "Wheezing", "Stridor", "Snoring", "Gurgling"]}
          selected={state.wobFindings}
          onChange={(wobFindings) => onChange({ ...state, wobFindings })}
        />

        <ChipGroup
          groupLabel="Abnormal Positioning"
          options={["Tripod", "Sniffing", "Prefers seated posture"]}
          selected={state.abnormalPositioning}
          onChange={(abnormalPositioning) => onChange({ ...state, abnormalPositioning })}
        />

        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Air Entry</label>
          <select value={state.airEntry} onChange={(e) => onChange({ ...state, airEntry: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Normal</option>
            <option>Abnormal</option>
          </select>
        </div>

        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Subcutaneous Emphysema</label>
          <select value={state.subcutaneousEmphysema} onChange={(e) => onChange({ ...state, subcutaneousEmphysema: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>

        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Intervention</label>
          <div className="flex gap-2">
            <textarea value={state.intervention} onChange={(e) => onChange({ ...state, intervention: e.target.value })}
              placeholder="e.g., oxygen administration, CPAP, intubation, etc."
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, intervention: (state.intervention ? state.intervention + " " : "") + txt })} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// C — Circulation of Skin
// ══════════════════════════════════════════════════════════════════

export interface PediatricCirculationState {
  crt: string;              // "Normal (<2s)" | "Delayed (>2s)"
  hr: string;
  bp: string;
  skinColorTemp: string;    // "Pink" | "Pale" | "Cyanosed" | "Mottled"
  distendedNeckVeins: string; // "Yes" | "No"
  intervention: string;
}

export function PediatricCirculationSection({
  state, onChange,
}: { state: PediatricCirculationState; onChange: (s: PediatricCirculationState) => void }) {
  return (
    <CollapsibleSection icon={<span>C</span>} iconBgColor="bg-rose-600" title="Circulation of Skin" titleColor="text-rose-400" defaultOpen>
      <div className="space-y-4">
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Capillary Refill Time (CRT)</label>
          <select value={state.crt} onChange={(e) => onChange({ ...state, crt: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Normal (less than 2 seconds)</option>
            <option>Delayed (greater than 2 seconds)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Heart Rate (HR)</label>
            <input value={state.hr} onChange={(e) => onChange({ ...state, hr: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" placeholder="bpm" />
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Blood Pressure (BP)</label>
            <input value={state.bp} onChange={(e) => onChange({ ...state, bp: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" placeholder="mmHg" />
          </div>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Skin Colour and Temperature</label>
          <select value={state.skinColorTemp} onChange={(e) => onChange({ ...state, skinColorTemp: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Pink</option>
            <option>Pale</option>
            <option>Cyanosed</option>
            <option>Mottled</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Distended Neck Veins</label>
          <select value={state.distendedNeckVeins} onChange={(e) => onChange({ ...state, distendedNeckVeins: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Intervention</label>
          <div className="flex gap-2">
            <textarea value={state.intervention} onChange={(e) => onChange({ ...state, intervention: e.target.value })}
              placeholder="e.g., IV fluids, medications, etc."
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, intervention: (state.intervention ? state.intervention + " " : "") + txt })} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// D — Disability
// ══════════════════════════════════════════════════════════════════

export interface PediatricDisabilityState {
  avpuGcs: string;           // "Alert" | "Verbal" | "Pain" | "Unresponsive"
  pupils: string;            // "Equal, round, reactive to light"
  abnormalResponses: string; // free text — Pinpoint, dilated, unilaterally dilated (possible causes)
  grbs: string;
}

export function PediatricDisabilitySection({
  state, onChange,
}: { state: PediatricDisabilityState; onChange: (s: PediatricDisabilityState) => void }) {
  return (
    <CollapsibleSection icon={<span>D</span>} iconBgColor="bg-amber-500" title="Disability" titleColor="text-amber-400" defaultOpen>
      <div className="space-y-4">
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">AVPU / GCS</label>
          <select value={state.avpuGcs} onChange={(e) => onChange({ ...state, avpuGcs: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Alert</option>
            <option>Verbal</option>
            <option>Pain</option>
            <option>Unresponsive</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Pupils: Size and Response</label>
          <input value={state.pupils} onChange={(e) => onChange({ ...state, pupils: e.target.value })}
            placeholder="Equal, round, reactive to light"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Abnormal Responses</label>
          <div className="flex gap-2">
            <textarea value={state.abnormalResponses} onChange={(e) => onChange({ ...state, abnormalResponses: e.target.value })}
              placeholder="Pinpoint, dilated, unilaterally dilated (possible causes)"
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, abnormalResponses: (state.abnormalResponses ? state.abnormalResponses + " " : "") + txt })} />
          </div>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Glucose (GRBS)</label>
          <input value={state.grbs} onChange={(e) => onChange({ ...state, grbs: e.target.value })}
            placeholder="mg/dL — check if low glucose, could impair neurological function"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// E — Exposure (+ Extremities, kept adjacent per reference layout)
// ══════════════════════════════════════════════════════════════════

export interface PediatricExposureState {
  temperature: string;
  traumaLogroll: string;         // free text
  signsOfTrauma: string[];       // Rashes, Petechiae, Ecchymosis, Bruises, Burns
  infectionBleedingEvidence: string; // free text
  longBoneDeformities: string;   // "Yes" | "No" + specify
  extremitiesFindings: string;   // deformities, bruising, tenderness
  extremitiesImmobilized: string; // "Yes" | "No" / free text
}

export function PediatricExposureSection({
  state, onChange,
}: { state: PediatricExposureState; onChange: (s: PediatricExposureState) => void }) {
  return (
    <>
      <CollapsibleSection icon={<span>E</span>} iconBgColor="bg-blue-500" title="Exposure" titleColor="text-blue-400" defaultOpen>
        <div className="space-y-4">
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Temperature</label>
            <input value={state.temperature} onChange={(e) => onChange({ ...state, temperature: e.target.value })}
              placeholder="Check for fever or hypothermia"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Trauma (Logroll)</label>
            <div className="flex gap-2">
              <textarea value={state.traumaLogroll} onChange={(e) => onChange({ ...state, traumaLogroll: e.target.value })}
                placeholder="Logroll to inspect back, assess hidden injuries"
                className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
              <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, traumaLogroll: (state.traumaLogroll ? state.traumaLogroll + " " : "") + txt })} />
            </div>
          </div>
          <ChipGroup
            groupLabel="Signs of Trauma or Illness"
            options={["Rashes", "Petechiae", "Ecchymosis", "Bruises", "Burns"]}
            selected={state.signsOfTrauma}
            onChange={(signsOfTrauma) => onChange({ ...state, signsOfTrauma })}
          />
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Evidence of Infection or Bleeding</label>
            <div className="flex gap-2">
              <textarea value={state.infectionBleedingEvidence} onChange={(e) => onChange({ ...state, infectionBleedingEvidence: e.target.value })}
                placeholder="e.g., Petechiae or Purpura"
                className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[60px]" />
              <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, infectionBleedingEvidence: (state.infectionBleedingEvidence ? state.infectionBleedingEvidence + " " : "") + txt })} />
            </div>
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Long Bone Deformities</label>
            <input value={state.longBoneDeformities} onChange={(e) => onChange({ ...state, longBoneDeformities: e.target.value })}
              placeholder="Yes/No, specify fracture"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<span>+</span>} iconBgColor="bg-slate-600" title="Extremities" titleColor="text-slate-300">
        <div className="space-y-4">
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Findings</label>
            <div className="flex gap-2">
              <textarea value={state.extremitiesFindings} onChange={(e) => onChange({ ...state, extremitiesFindings: e.target.value })}
                placeholder="Check for deformities, bruising, tenderness"
                className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
              <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, extremitiesFindings: (state.extremitiesFindings ? state.extremitiesFindings + " " : "") + txt })} />
            </div>
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">Immobilization</label>
            <input value={state.extremitiesImmobilized} onChange={(e) => onChange({ ...state, extremitiesImmobilized: e.target.value })}
              placeholder="Immobilize any injured limbs"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// Adjunct: EFAST (trauma-suspected only)
// ══════════════════════════════════════════════════════════════════

export interface PediatricEfastState {
  heart: string;      // pericardial effusion
  abdomen: string;     // free fluid / hemoperitoneum
  lungs: string;       // pleural effusion or pneumothorax
  pelvis: string;      // pelvic fractures or injury
  extremities: string; // fractures, internal bleeding, soft tissue injury
}

export function PediatricEfastSection({
  state, onChange,
}: { state: PediatricEfastState; onChange: (s: PediatricEfastState) => void }) {
  const fields: { key: keyof PediatricEfastState; label: string; helper: string }[] = [
    { key: "heart", label: "Heart", helper: "Check for pericardial effusion (fluid around the heart)" },
    { key: "abdomen", label: "Abdomen", helper: "Assess for free fluid in the abdomen (hemoperitoneum)" },
    { key: "lungs", label: "Lungs", helper: "Check for pleural effusion or pneumothorax" },
    { key: "pelvis", label: "Pelvis", helper: "Check for pelvic fractures or injury" },
    { key: "extremities", label: "Extremities", helper: "Check for fractures, internal bleeding, or soft tissue injury" },
  ];
  return (
    <CollapsibleSection icon={<span>🩻</span>} iconBgColor="bg-purple-600" title="Adjunct: EFAST (If Trauma Suspected)" titleColor="text-purple-400">
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-white text-sm font-semibold block">{f.label}</label>
            <p className="text-slate-500 text-xs mb-1.5">{f.helper}</p>
            <input value={state[f.key]} onChange={(e) => onChange({ ...state, [f.key]: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// Secondary Assessment — Focused Physical Examination
// (Signs & Symptoms, Allergies, Medications, Past Medical History,
// Last Meal, Events already built in PediatricCaseSheetFields.tsx —
// this covers the remaining "Focused Physical Examination" fields)
// ══════════════════════════════════════════════════════════════════

export interface PediatricFocusedExamState {
  heent: string;
  respiratory: string;
  cardiovascular: string;
  abdomen: string;
  back: string;
  extremities: string;
}

export function PediatricFocusedPhysicalExam({
  state, onChange,
}: { state: PediatricFocusedExamState; onChange: (s: PediatricFocusedExamState) => void }) {
  const fields: { key: keyof PediatricFocusedExamState; label: string; helper: string }[] = [
    { key: "heent", label: "HEENT", helper: "Inspect the head, examine the eyes, check the ears, examine the nose, evaluate the throat, palpate the thyroid gland and lymph nodes" },
    { key: "respiratory", label: "Respiratory System", helper: "Chest, listen for abnormal breathing sounds (e.g., stridor, wheezing, crackles); check for nasal obstruction, retractions, or abnormal chest movement" },
    { key: "cardiovascular", label: "Cardiovascular", helper: "Check for signs of heart failure (gallop rhythm, crackles, peripheral edema); signs of poor perfusion like cyanosis, feeble pulse, cold extremities, flushed skin" },
    { key: "abdomen", label: "Abdomen", helper: "Check for tenderness, distention, signs of injury, and hepatomegaly" },
    { key: "back", label: "Back", helper: "Check for any signs of spine or vertebral injury" },
    { key: "extremities", label: "Extremities", helper: "Assess for fractures, swelling, bruising, or deformities" },
  ];
  return (
    <CollapsibleSection icon={<span>🔍</span>} iconBgColor="bg-teal-600" title="Focused Physical Examination" titleColor="text-teal-400">
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-white text-sm font-semibold block">{f.label}</label>
            <p className="text-slate-500 text-xs mb-1.5">{f.helper}</p>
            <div className="flex gap-2">
              <textarea value={state[f.key]} onChange={(e) => onChange({ ...state, [f.key]: e.target.value })}
                className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[70px]" />
              <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, [f.key]: (state[f.key] ? state[f.key] + " " : "") + txt })} />
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// General Examination — matches ADULT structure exactly, confirmed
// from live app screenshot: Pallor, Icterus, Cyanosis, Clubbing,
// Lymphadenopathy, Edema (toggle switches, same ToggleSwitchGrid
// pattern used on the adult Secondary Head-to-Toe Examination)
// ══════════════════════════════════════════════════════════════════

export interface PediatricGeneralExamState {
  pallor: boolean;
  icterus: boolean;
  cyanosis: boolean;
  clubbing: boolean;
  lymphadenopathy: boolean;
  edema: boolean;
}

const GENERAL_EXAM_LABELS: { key: keyof PediatricGeneralExamState; label: string }[] = [
  { key: "pallor", label: "Pallor" },
  { key: "icterus", label: "Icterus" },
  { key: "cyanosis", label: "Cyanosis" },
  { key: "clubbing", label: "Clubbing" },
  { key: "lymphadenopathy", label: "Lymphadenopathy" },
  { key: "edema", label: "Edema" },
];

export function PediatricGeneralExamSection({
  state, onChange,
}: { state: PediatricGeneralExamState; onChange: (s: PediatricGeneralExamState) => void }) {
  return (
    <CollapsibleSection icon={<span>👁</span>} iconBgColor="bg-indigo-600" title="General Examination" titleColor="text-indigo-400" defaultOpen>
      <div className="grid grid-cols-2 gap-3">
        {GENERAL_EXAM_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2.5">
            <span className="text-white text-sm">{label}</span>
            <button
              type="button"
              onClick={() => onChange({ ...state, [key]: !state[key] })}
              className={`w-11 h-6 rounded-full relative transition-colors ${state[key] ? "bg-rose-600" : "bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${state[key] ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

/** Deterministic normal-findings sentence — matches the exact phrasing
 * already confirmed live in the adult app's Mark Normal output, so
 * pediatric and adult produce consistent language across exports. */
export function buildGeneralExamNormalText(): string {
  return "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.";
}

// ══════════════════════════════════════════════════════════════════
// Quick Normal Presets — pediatric Focused Physical Exam + General
// Examination, matching the adult "QUICK NORMAL PRESETS" panel
// pattern confirmed live (JCI/NABH-compliant normal findings,
// append-on-click per section, plus a single "Fill All" action)
// ══════════════════════════════════════════════════════════════════

export const PEDIATRIC_NORMAL_PRESETS: Record<string, string> = {
  general: "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.",
  heent: "Normocephalic, atraumatic. PERRLA. Ears/nose/throat normal. No thyromegaly or cervical lymphadenopathy.",
  respiratory: "Chest clear bilaterally. No stridor, wheeze, or crackles. No nasal flaring or retractions. Normal chest movement.",
  cardiovascular: "S1 S2 heard, no murmurs or gallop. No signs of poor perfusion — CRT <2s, warm extremities, no cyanosis.",
  abdomen: "Soft, non-tender, non-distended. No hepatomegaly. Bowel sounds present.",
  back: "No signs of spine or vertebral injury on inspection/palpation.",
  extremities: "No fractures, swelling, bruising, or deformities. Full range of movement.",
};

interface PediatricQuickPresetsProps {
  onApply: (section: keyof typeof PEDIATRIC_NORMAL_PRESETS, text: string) => void;
  onFillAll: () => void;
}

export function PediatricQuickNormalPresets({ onApply, onFillAll }: PediatricQuickPresetsProps) {
  const sections: { key: keyof typeof PEDIATRIC_NORMAL_PRESETS; label: string }[] = [
    { key: "general", label: "+ Normal General" },
    { key: "heent", label: "+ Normal HEENT" },
    { key: "respiratory", label: "+ Normal Respiratory" },
    { key: "cardiovascular", label: "+ Normal CVS" },
    { key: "abdomen", label: "+ Normal Abdomen" },
    { key: "back", label: "+ Normal Back" },
    { key: "extremities", label: "+ Normal Extremities" },
  ];

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-white font-bold text-sm">QUICK NORMAL PRESETS (Pediatric)</p>
        <p className="text-slate-400 text-xs mt-1">
          Tap a preset to instantly append standard normal findings to the relevant section:
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {sections.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onApply(key, PEDIATRIC_NORMAL_PRESETS[key])}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onFillAll}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
        >
          🚀 Fill All Normal Findings
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Disposition
// ══════════════════════════════════════════════════════════════════

export interface PediatricDispositionState {
  provisionalDiagnosis: string;
  conditionAtShift: string;   // "Stable" | "Unstable"
  dispositionType: string;    // "ICU" | "Room" | "Ward" | "Referral" | "DAMA"
  differentialDiagnosis: string;
  emResident: string;
  emConsultant: string;
}

export function PediatricDispositionSection({
  state, onChange,
}: { state: PediatricDispositionState; onChange: (s: PediatricDispositionState) => void }) {
  return (
    <CollapsibleSection icon={<span>📋</span>} iconBgColor="bg-emerald-600" title="Disposition" titleColor="text-emerald-400" defaultOpen>
      <div className="space-y-4">
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Provisional Diagnosis at the Time of Discharge/Shift</label>
          <div className="flex gap-2">
            <textarea value={state.provisionalDiagnosis} onChange={(e) => onChange({ ...state, provisionalDiagnosis: e.target.value })}
              placeholder="e.g., respiratory distress, dehydration, head injury, trauma, sepsis, respiratory failure"
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[80px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, provisionalDiagnosis: (state.provisionalDiagnosis ? state.provisionalDiagnosis + " " : "") + txt })} />
          </div>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Condition at the Time of Shift</label>
          <select value={state.conditionAtShift} onChange={(e) => onChange({ ...state, conditionAtShift: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>Stable</option>
            <option>Unstable</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Disposition</label>
          <select value={state.dispositionType} onChange={(e) => onChange({ ...state, dispositionType: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="">-- Select --</option>
            <option>ICU</option>
            <option>Room</option>
            <option>Ward</option>
            <option>Referral</option>
            <option>Discharge Against Medical Advice (DAMA)</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm font-semibold block mb-1.5">Differential Diagnosis</label>
          <div className="flex gap-2">
            <textarea value={state.differentialDiagnosis} onChange={(e) => onChange({ ...state, differentialDiagnosis: e.target.value })}
              placeholder="Include possible differential diagnoses based on primary and secondary assessments"
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[80px]" />
            <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => onChange({ ...state, differentialDiagnosis: (state.differentialDiagnosis ? state.differentialDiagnosis + " " : "") + txt })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">EM Resident</label>
            <input value={state.emResident} onChange={(e) => onChange({ ...state, emResident: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-white text-sm font-semibold block mb-1.5">EM Consultant</label>
            <input value={state.emConsultant} onChange={(e) => onChange({ ...state, emConsultant: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
