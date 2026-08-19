import VoiceRecorder from "./shared/VoiceRecorder";
import React from "react";
import { Heart, Wind, Activity, Brain, Move } from "lucide-react";
import {
  NormalAbnormalField,
  ChipGroup,
  ToggleSwitchGrid,
  CollapsibleSection,
} from "./ManualEntryPrimitives";

/**
 * CaseSheetABCDEFields.tsx
 *
 * COMPATIBILITY GUARANTEE: every field here writes into the SAME
 * string/boolean paths already consumed by CaseSheetPrintView.tsx,
 * getFormattedDischargeSummaryText/Html(), and generateCaseSheetText()
 * from earlier today. This file only changes the INPUT experience
 * (chips + Normal/Abnormal toggle instead of free text) — the OUTPUT
 * shape is identical, so View, Download, Copy, and Discharge Summary
 * generation all continue working without any changes on their side.
 *
 * primaryAssessment.airway/breathing/circulation/disability/exposure
 * remain plain strings — this UI just builds that string FOR the
 * doctor via chip selection + templated normal text, instead of
 * asking them to type it from scratch. Consuming components never
 * know the difference.
 */

function buildAbnormalNarrative(parts: Record<string, string[]>): string {
  const segments = Object.entries(parts)
    .filter(([, values]) => values.length > 0)
    .map(([label, values]) => `${label}: ${values.join(", ")}`);
  return segments.length > 0 ? segments.join(" | ") : "Abnormal (details not yet specified)";
}

// ══════════════════════════════════════════════════════════════════
// B — BREATHING
// ══════════════════════════════════════════════════════════════════

const BREATHING_NORMAL = "Effortless breathing, regular pattern, bilateral chest expansion, clear air entry, no added sounds, on room air";

interface BreathingState {
  status: "unset" | "normal" | "abnormal";
  effort: string[];
  o2Device: string[];
  pattern: string[];
  chestExpansion: string[];
  narrative: string | null;
}

export function BreathingField({ state, onChange }: { state: BreathingState; onChange: (s: BreathingState) => void }) {
  const handleStatusChange = (status: "normal" | "abnormal") => {
    onChange({ ...state, status, narrative: status === "normal" ? BREATHING_NORMAL : null });
  };

  const updatePart = (key: "effort" | "o2Device" | "pattern" | "chestExpansion", values: string[]) => {
    const updated = { ...state, [key]: values };
    updated.narrative = buildAbnormalNarrative({
      Effort: updated.effort, "O2 Device": updated.o2Device,
      Pattern: updated.pattern, "Chest Expansion": updated.chestExpansion,
    });
    onChange(updated);
  };

  return (
    <NormalAbnormalField
      label="B - BREATHING"
      status={state.status}
      onStatusChange={handleStatusChange}
      normalNarrative={BREATHING_NORMAL}
      currentNarrative={state.narrative}
      abnormalContent={
        <div className="space-y-4">
          <ChipGroup groupLabel="Effort" options={["Normal", "Mild ↑", "Moderate ↑", "Severe ↑", "Exhaustion"]} selected={state.effort} onChange={v => updatePart("effort", v)} />
          <ChipGroup groupLabel="O2 Device" options={["Room air", "Nasal prongs", "Face mask", "NRM", "NIV", "Ventilator"]} selected={state.o2Device} onChange={v => updatePart("o2Device", v)} />
          <ChipGroup groupLabel="Pattern" options={["Normal", "Tachypneic", "Bradypneic", "Kussmaul", "Cheyne-Stokes"]} selected={state.pattern} onChange={v => updatePart("pattern", v)} />
          <ChipGroup groupLabel="Chest Expansion" options={["Equal", "Reduced L", "Reduced R", "Reduced both"]} selected={state.chestExpansion} onChange={v => updatePart("chestExpansion", v)} />
        </div>
      }
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// C — CIRCULATION
// ══════════════════════════════════════════════════════════════════

const CIRCULATION_NORMAL = "Peripheries warm, capillary refill < 2s. Radial pulses strong and regular. No active external hemorrhage, blood pressure stable.";

interface CirculationState {
  status: "unset" | "normal" | "abnormal";
  crt: string[];
  pulse: string[];
  skinTemp: string[];
  bleeding: string[];
  narrative: string | null;
}

export function CirculationField({ state, onChange }: { state: CirculationState; onChange: (s: CirculationState) => void }) {
  const handleStatusChange = (status: "normal" | "abnormal") => {
    onChange({ ...state, status, narrative: status === "normal" ? CIRCULATION_NORMAL : null });
  };

  const updatePart = (key: "crt" | "pulse" | "skinTemp" | "bleeding", values: string[]) => {
    const updated = { ...state, [key]: values };
    updated.narrative = buildAbnormalNarrative({
      CRT: updated.crt, Pulse: updated.pulse, "Skin Temp": updated.skinTemp, Bleeding: updated.bleeding,
    });
    onChange(updated);
  };

  return (
    <NormalAbnormalField
      label="C - CIRCULATION"
      status={state.status}
      onStatusChange={handleStatusChange}
      normalNarrative={CIRCULATION_NORMAL}
      currentNarrative={state.narrative}
      abnormalContent={
        <div className="space-y-4">
          <ChipGroup groupLabel="Capillary Refill Time" options={["<2s", "2-4s", ">4s"]} selected={state.crt} onChange={v => updatePart("crt", v)} />
          <ChipGroup groupLabel="Pulse" options={["Regular", "Irregular", "Weak/Thready", "Bounding", "Absent"]} selected={state.pulse} onChange={v => updatePart("pulse", v)} multiSelect />
          <ChipGroup groupLabel="Skin" options={["Warm", "Cool", "Clammy", "Mottled", "Pale"]} selected={state.skinTemp} onChange={v => updatePart("skinTemp", v)} multiSelect />
          <ChipGroup groupLabel="Active Bleeding" options={["None", "External — controlled", "External — uncontrolled", "Suspected internal"]} selected={state.bleeding} onChange={v => updatePart("bleeding", v)} />
        </div>
      }
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// D — DISABILITY
// ══════════════════════════════════════════════════════════════════

const DISABILITY_NORMAL = "Alert, oriented x3. Pupils equal, round, and reactive to light (PEARL). Moving all four limbs with 5/5 strength. GCS 15 (E4V5M6).";

interface DisabilityState {
  status: "unset" | "normal" | "abnormal";
  avpu: string[];
  pupils: string[];
  motor: string[];
  narrative: string | null;
  gcsE: string;
  gcsV: string;
  gcsM: string;
}

export function DisabilityField({ state, onChange }: { state: DisabilityState; onChange: (s: DisabilityState) => void }) {
  const recomputeNarrative = (s: DisabilityState): string => {
    const gcsNote = s.gcsE && s.gcsV && s.gcsM ? `GCS E${s.gcsE}V${s.gcsV}M${s.gcsM}` : "";
    return [
      buildAbnormalNarrative({ AVPU: s.avpu, Pupils: s.pupils, Motor: s.motor }),
      gcsNote,
    ].filter(Boolean).join(" | ");
  };

  const handleStatusChange = (status: "normal" | "abnormal") => {
    onChange({ ...state, status, narrative: status === "normal" ? DISABILITY_NORMAL : null });
  };

  const updatePart = (key: "avpu" | "pupils" | "motor", values: string[]) => {
    const updated = { ...state, [key]: values };
    onChange({ ...updated, narrative: recomputeNarrative(updated) });
  };

  const updateGcs = (key: "gcsE" | "gcsV" | "gcsM", value: string) => {
    const updated = { ...state, [key]: value };
    onChange({ ...updated, narrative: recomputeNarrative(updated) });
  };

  return (
    <NormalAbnormalField
      label="D - DISABILITY"
      status={state.status}
      onStatusChange={handleStatusChange}
      normalNarrative={DISABILITY_NORMAL}
      currentNarrative={state.narrative}
      abnormalContent={
        <div className="space-y-4">
          <ChipGroup groupLabel="AVPU" options={["Alert", "Responds to Voice", "Responds to Pain", "Unresponsive"]} selected={state.avpu} onChange={v => updatePart("avpu", v)} />
          <ChipGroup groupLabel="Pupils" options={["PEARL", "Unequal", "Fixed & Dilated", "Pinpoint"]} selected={state.pupils} onChange={v => updatePart("pupils", v)} />
          <ChipGroup groupLabel="Motor" options={["5/5 all limbs", "Focal weakness", "Posturing", "Flaccid"]} selected={state.motor} onChange={v => updatePart("motor", v)} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Eye (1-4)</label>
              <input value={state.gcsE} onChange={e => updateGcs("gcsE", e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center" />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Verbal (1-5)</label>
              <input value={state.gcsV} onChange={e => updateGcs("gcsV", e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center" />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Motor (1-6)</label>
              <input value={state.gcsM} onChange={e => updateGcs("gcsM", e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center" />
            </div>
          </div>
        </div>
      }
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// E — EXPOSURE
// ══════════════════════════════════════════════════════════════════

const EXPOSURE_NORMAL = "Fully exposed. No visible rashes, bruises, wounds or deformities. Soft non-tender abdomen, body temperature stable.";

interface ExposureState {
  status: "unset" | "normal" | "abnormal";
  findings: string[];
  logRoll: string[];
  narrative: string | null;
}

export function ExposureField({ state, onChange }: { state: ExposureState; onChange: (s: ExposureState) => void }) {
  const handleStatusChange = (status: "normal" | "abnormal") => {
    onChange({ ...state, status, narrative: status === "normal" ? EXPOSURE_NORMAL : null });
  };

  const updatePart = (key: "findings" | "logRoll", values: string[]) => {
    const updated = { ...state, [key]: values };
    updated.narrative = buildAbnormalNarrative({ Findings: updated.findings, "Log Roll": updated.logRoll });
    onChange(updated);
  };

  return (
    <NormalAbnormalField
      label="E - EXPOSURE"
      status={state.status}
      onStatusChange={handleStatusChange}
      normalNarrative={EXPOSURE_NORMAL}
      currentNarrative={state.narrative}
      abnormalContent={
        <div className="space-y-4">
          <ChipGroup groupLabel="Findings" options={["Rash", "Bruising", "Open wound", "Deformity", "Burns", "Fever"]} selected={state.findings} onChange={v => updatePart("findings", v)} multiSelect />
          <ChipGroup groupLabel="Log Roll / Spine" options={["Not indicated", "Clear — no tenderness", "Midline tenderness", "Step-off deformity"]} selected={state.logRoll} onChange={v => updatePart("logRoll", v)} />
        </div>
      }
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// General Examination — toggle switches, writes into examStructured booleans
// ══════════════════════════════════════════════════════════════════

interface GeneralExamState {
  pallor: boolean; icterus: boolean; cyanosis: boolean;
  clubbing: boolean; lymphadenopathy: boolean; edema: boolean;
  notes: string;
}

export function GeneralExaminationSection({ state, onChange }: { state: GeneralExamState; onChange: (s: GeneralExamState) => void }) {
  const fields = [
    { key: "pallor", label: "Pallor", value: state.pallor },
    { key: "icterus", label: "Icterus", value: state.icterus },
    { key: "cyanosis", label: "Cyanosis", value: state.cyanosis },
    { key: "clubbing", label: "Clubbing", value: state.clubbing },
    { key: "lymphadenopathy", label: "Lymphadenopathy", value: state.lymphadenopathy },
    { key: "edema", label: "Edema", value: state.edema },
  ];

  return (
    <CollapsibleSection icon={<Activity size={18} />} iconBgColor="bg-emerald-600" title="General Examination" titleColor="text-emerald-400" defaultOpen>
      <div className="space-y-4">
        <ToggleSwitchGrid fields={fields} onChange={(key, value) => onChange({ ...state, [key]: value })} />
        <div className="flex gap-2">
          <textarea
            value={state.notes}
            onChange={e => onChange({ ...state, notes: e.target.value })}
            placeholder="General exam notes..."
            className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[80px]"
          />
          <VoiceRecorder
            renderMode="compact-button"
            onTranscript={(txt) => onChange({ ...state, notes: (state.notes ? state.notes + " " : "") + txt })}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ══════════════════════════════════════════════════════════════════
// Secondary systemic exam sections — CVS / Respiratory / Abdomen / CNS / Extremities
// Each is Normal/Abnormal + free text, feeding secondaryAssessment
// ══════════════════════════════════════════════════════════════════

interface SystemExamState {
  status: "unset" | "normal" | "abnormal";
  notes: string;
}

function SystemSection({
  icon, iconBgColor, title, titleColor, normalText, state, onChange, placeholder,
}: {
  icon: React.ReactNode; iconBgColor: string; title: string; titleColor: string;
  normalText: string; state: SystemExamState; onChange: (s: SystemExamState) => void; placeholder: string;
}) {
  return (
    <CollapsibleSection icon={icon} iconBgColor={iconBgColor} title={title} titleColor={titleColor}>
      <NormalAbnormalField
        label=""
        status={state.status}
        onStatusChange={status => onChange({ status, notes: status === "normal" ? normalText : "" })}
        normalNarrative={normalText}
        currentNarrative={state.status === "normal" ? normalText : state.notes}
        abnormalContent={
          <div className="flex gap-2">
            <textarea
              value={state.notes}
              onChange={e => onChange({ ...state, notes: e.target.value })}
              placeholder={placeholder}
              className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[80px]"
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange({ ...state, notes: (state.notes ? state.notes + " " : "") + txt })}
            />
          </div>
        }
      />
    </CollapsibleSection>
  );
}

export function CvsSection(props: { state: SystemExamState; onChange: (s: SystemExamState) => void }) {
  return (
    <SystemSection
      {...props}
      icon={<Heart size={18} />} iconBgColor="bg-red-600" title="Cardiovascular System" titleColor="text-red-400"
      normalText="S1 S2 heard clearly, regular rhythm, no murmurs. Peripheral pulses intact."
      placeholder="Describe abnormal CVS findings — murmurs, rhythm, added sounds..."
    />
  );
}

export function RespiratorySection(props: { state: SystemExamState; onChange: (s: SystemExamState) => void }) {
  return (
    <SystemSection
      {...props}
      icon={<Wind size={18} />} iconBgColor="bg-orange-500" title="Respiratory System" titleColor="text-orange-400"
      normalText="B/L air entry equal, no added sounds, vesicular breath sounds, normal vocal resonance."
      placeholder="Describe abnormal respiratory findings — crackles, wheeze, reduced entry..."
    />
  );
}

export function AbdomenSection(props: { state: SystemExamState; onChange: (s: SystemExamState) => void }) {
  return (
    <SystemSection
      {...props}
      icon={<Activity size={18} />} iconBgColor="bg-amber-500" title="Abdomen" titleColor="text-amber-400"
      normalText="Soft, non-tender. No distension. No organomegaly. Bowel sounds present. External genitalia normal."
      placeholder="Describe abnormal abdominal findings — tenderness, distension, organomegaly..."
    />
  );
}

export function CnsSection(props: { state: SystemExamState; onChange: (s: SystemExamState) => void }) {
  return (
    <SystemSection
      {...props}
      icon={<Brain size={18} />} iconBgColor="bg-emerald-600" title="Central Nervous System" titleColor="text-emerald-400"
      normalText="Moving all four limbs. No focal neurological deficit."
      placeholder="Describe abnormal neurological findings — focal deficit, altered sensorium..."
    />
  );
}

export function ExtremitiesSection(props: { state: SystemExamState; onChange: (s: SystemExamState) => void }) {
  return (
    <SystemSection
      {...props}
      icon={<Move size={18} />} iconBgColor="bg-blue-600" title="Extremities" titleColor="text-blue-400"
      normalText="No deformity, no edema, pulses present and symmetric, full range of motion."
      placeholder="Describe abnormal extremity findings — deformity, edema, absent pulses..."
    />
  );
}
