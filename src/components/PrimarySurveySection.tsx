
export function PrimarySurveyAdjuncts({ data, onChange, openSections, toggleSection, onInterpretABG }: any) {
  return (
    <>
      <h3 className="text-lg text-slate-800 dark:text-slate-200 mt-6 mb-3 px-1">Adjuncts to Primary Survey</h3>

      {/* ── ABG / VBG ─────────────────────────────────────────── */}
      <AccordionItem
        title="ABG / VBG"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.abg}
        onToggle={() => toggleSection('abg')}
      >
        <div className="flex gap-3 mb-4">
          <button className="flex-1 flex items-center justify-center gap-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-lg text-sm font-bold">
            <Camera className="w-4 h-4" /> Camera
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-lg text-sm font-bold">
            <ImageIcon className="w-4 h-4" /> Gallery
          </button>
        </div>
        <button className="w-full flex items-center justify-center gap-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-lg text-sm font-bold mb-4">
          <CheckCircle className="w-4 h-4" /> Fill Normal Values
        </button>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <DropdownSelect
            label="Sample Type"
            options={["Arterial (ABG)", "Venous (VBG)"]}
            value={data.adjuncts?.abg?.sampleType}
            onChange={(v) => onChange("adjuncts.abg.sampleType", v)}
          />
          <DropdownSelect
            label="Interpretation"
            options={["Not done", "Normal", "Abnormal"]}
            value={data.adjuncts?.abg?.interpretation}
            onChange={(v) => onChange("adjuncts.abg.interpretation", v)}
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-xs mb-4">
          <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Normal Values Reference</div>
          <div className="grid grid-cols-2 gap-y-1">
            <div className="flex justify-between px-2"><span className="text-slate-500">pH</span><span>7.35 - 7.45</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">pCO₂</span><span>35 - 45 mmHg</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">pO₂</span><span>80 - 100 mmHg</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">HCO₃</span><span>22 - 26 mEq/L</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">BE</span><span>-2 to +2</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">Lactate</span><span>0.5 - 2.0</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">SaO₂</span><span>95 - 100%</span></div>
            <div className="flex justify-between px-2"><span className="text-slate-500">A-a</span><span>&lt;10-15</span></div>
          </div>
        </div>

        <div className="text-sm font-bold mb-2">Blood Gas Values (Optional)</div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <VitalInput label="pH" value={data.adjuncts?.abg?.ph} onChange={(v) => onChange("adjuncts.abg.ph", v)} />
          <VitalInput label="pCO₂" value={data.adjuncts?.abg?.pco2} onChange={(v) => onChange("adjuncts.abg.pco2", v)} />
          <VitalInput label="pO₂" value={data.adjuncts?.abg?.po2} onChange={(v) => onChange("adjuncts.abg.po2", v)} />
          <VitalInput label="HCO₃" value={data.adjuncts?.abg?.hco3} onChange={(v) => onChange("adjuncts.abg.hco3", v)} />
          <VitalInput label="BE" value={data.adjuncts?.abg?.be} onChange={(v) => onChange("adjuncts.abg.be", v)} />
          <VitalInput label="Lactate" value={data.adjuncts?.abg?.lactate} onChange={(v) => onChange("adjuncts.abg.lactate", v)} />
          <VitalInput label="SaO₂%" value={data.adjuncts?.abg?.sao2} onChange={(v) => onChange("adjuncts.abg.sao2", v)} />
          <VitalInput label="FiO₂%" value={data.adjuncts?.abg?.fio2} onChange={(v) => onChange("adjuncts.abg.fio2", v)} />
        </div>

        <div className="text-sm font-bold mb-2">Electrolytes (Optional)</div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <VitalInput label="Na⁺" value={data.adjuncts?.abg?.na} onChange={(v) => onChange("adjuncts.abg.na", v)} />
          <VitalInput label="K⁺" value={data.adjuncts?.abg?.k} onChange={(v) => onChange("adjuncts.abg.k", v)} />
          <VitalInput label="Cl⁻" value={data.adjuncts?.abg?.cl} onChange={(v) => onChange("adjuncts.abg.cl", v)} />
          <VitalInput label="AG" value={data.adjuncts?.abg?.ag} onChange={(v) => onChange("adjuncts.abg.ag", v)} />
          <VitalInput label="Glucose" value={data.adjuncts?.abg?.glucose} onChange={(v) => onChange("adjuncts.abg.glucose", v)} />
          <VitalInput label="Hb" value={data.adjuncts?.abg?.hb} onChange={(v) => onChange("adjuncts.abg.hb", v)} />
          <VitalInput label="A-a" value={data.adjuncts?.abg?.aa} onChange={(v) => onChange("adjuncts.abg.aa", v)} />
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1">Additional Notes</label>
          <div className="flex gap-2">
            <textarea
              placeholder="Sample time, clinical context, etc..."
              value={data.adjuncts?.abg?.notes || ""}
              onChange={(e) => onChange("adjuncts.abg.notes", e.target.value)}
              className="flex-1 w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange("adjuncts.abg.notes", (data.adjuncts?.abg?.notes ? data.adjuncts?.abg?.notes + " " : "") + txt)}
            />
          </div>
        </div>

        <button type="button" onClick={onInterpretABG} className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-bold py-2 rounded-lg mb-4 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm">
          <Activity className="w-4 h-4" /> Interpret ABG
        </button>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1">Final ABG Diagnosis</label>
          <div className="flex gap-2">
            <textarea
              placeholder="e.g. Mixed respiratory and metabolic acidosis with lactic acidosis"
              value={data.adjuncts?.abg?.finalDiagnosis || ""}
              onChange={(e) => onChange("adjuncts.abg.finalDiagnosis", e.target.value)}
              className="flex-1 w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={2}
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange("adjuncts.abg.finalDiagnosis", (data.adjuncts?.abg?.finalDiagnosis ? data.adjuncts?.abg?.finalDiagnosis + " " : "") + txt)}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1">Your Interpretation (Optional)</label>
          <div className="flex gap-2">
            <textarea
              placeholder="Your clinical interpretation of the ABG..."
              value={data.adjuncts?.abg?.clinicalInterpretation || ""}
              onChange={(e) => onChange("adjuncts.abg.clinicalInterpretation", e.target.value)}
              className="flex-1 w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={2}
            />
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={(txt) => onChange("adjuncts.abg.clinicalInterpretation", (data.adjuncts?.abg?.clinicalInterpretation ? data.adjuncts?.abg?.clinicalInterpretation + " " : "") + txt)}
            />
          </div>
        </div>
      </AccordionItem>

      {/* ── ECG ─────────────────────────────────────────── */}
      <AccordionItem
        title="ECG"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.ecg}
        onToggle={() => toggleSection('ecg')}
      >
        <DropdownSelect
          label="ECG Interpretation"
          options={[
            "Not done",
            "Normal sinus rhythm",
            "Sinus tachycardia",
            "Sinus bradycardia",
            "Atrial fibrillation",
            "Atrial flutter",
            "SVT",
            "VT",
            "VF",
            "STEMI"
          ]}
          value={data.adjuncts?.ecgStatus}
          onChange={(v) => onChange("adjuncts.ecgStatus", v)}
        />
      </AccordionItem>

      {/* ── EFAST ─────────────────────────────────────────── */}
      <AccordionItem
        title="EFAST"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.efast}
        onToggle={() => toggleSection('efast')}
      >
        <DropdownSelect
          label="EFAST Result"
          options={[
            "Not done",
            "Negative",
            "Positive - RUQ",
            "Positive - LUQ",
            "Positive - Pelvis",
            "Positive - Pericardial",
            "Positive - Pneumothorax",
            "Positive - Multiple"
          ]}
          value={data.adjuncts?.efastStatus}
          onChange={(v) => onChange("adjuncts.efastStatus", v)}
        />
      </AccordionItem>

      {/* ── Bedside Echo ─────────────────────────────────────────── */}
      <AccordionItem
        title="Bedside Echo"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.bedsideEcho}
        onToggle={() => toggleSection('bedsideEcho')}
      >
        <DropdownSelect
          label="Bedside Echo Result"
          options={[
            "Not done",
            "Normal",
            "Reduced EF",
            "RV strain",
            "Pericardial effusion",
            "Tamponade physiology",
            "Hypovolemia (IVC collapse)"
          ]}
          value={data.adjuncts?.echoStatus}
          onChange={(v) => onChange("adjuncts.echoStatus", v)}
        />
      </AccordionItem>

    
    </>
  );
}


import VoiceRecorder from "./shared/VoiceRecorder";
import React, { useState } from "react";
import { PrimarySurvey, PatientVitals } from "../types";
import { Activity, ShieldAlert, CheckCircle, Heart, AlertTriangle, ChevronDown, Camera, Image as ImageIcon } from "lucide-react";

interface PrimarySurveySectionProps {
  data: PrimarySurvey;
  onChange: (fieldPath: string, value: any) => void;
  caseType: string;
  onMarkNormal?: () => void;
  onInterpretABG?: () => void;
  vitals?: PatientVitals;
  onUpdateVitals?: (field: keyof PatientVitals, value: string) => void;
}

// ── Helper UI Sub-components ──────────────────────────────────────

function QuickSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isSelected =
            value?.toLowerCase() === opt.toLowerCase() ||
            (value === "<2sec" && opt === "< 2 sec") ||
            (value === ">2sec" && opt === "> 2 sec");
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`text-[10.5px] px-2.5 py-1 rounded-md font-extrabold border transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.02]"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VitalInput({
  label,
  unit,
  placeholder,
  value,
  onChange,
  normal,
  flagHigh,
  flagLow,
  flagHighSBP,
  flagLowSBP,
  max,
  min,
}: {
  label: string;
  unit?: string;
  placeholder?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  normal?: string;
  flagHigh?: number;
  flagLow?: number;
  flagHighSBP?: number;
  flagLowSBP?: number;
  max?: number;
  min?: number;
}) {
  const numVal = value ? parseFloat(value) : NaN;
  let isAbnormal = false;
  if (!isNaN(numVal)) {
    if (flagHigh !== undefined && numVal > flagHigh) isAbnormal = true;
    if (flagLow !== undefined && numVal < flagLow) isAbnormal = true;
  }
  if (flagHighSBP !== undefined && flagLowSBP !== undefined && value && value.includes("/")) {
    const sbp = parseFloat(value.split("/")[0]);
    if (!isNaN(sbp) && (sbp > flagHighSBP || sbp < flagLowSBP)) isAbnormal = true;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[110px] flex-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {label} {unit ? <span className="text-[10px] text-slate-400 font-normal">({unit})</span> : null}
        </label>
        {normal && <span className="text-[9px] text-slate-400 font-mono">Ref: {normal}</span>}
      </div>
      <input
        type="text"
        placeholder={placeholder || `e.g. ${normal || ""}`}
        value={value || ""}
        onChange={(e) => {
          let val = e.target.value;
          if (max !== undefined && parseFloat(val) > max) val = String(max);
          if (min !== undefined && parseFloat(val) < min && val !== "") val = String(min);
          onChange(val);
        }}
        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all focus:outline-none focus:ring-1 ${
          isAbnormal
            ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 focus:ring-red-500"
            : "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:ring-indigo-500"
        }`}
      />
    </div>
  );
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <VoiceRecorder 
          renderMode="compact-button" 
          onTranscript={(txt) => onChange((value ? value + " " : "") + txt)} 
        />
      </div>
    </div>
  );
}

export function DropdownSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 flex-1 relative">
      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none pr-8"
        >
          <option value="">-- Select --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

export function AccordionItem({
  title,
  iconLetter,
  iconBgClass,
  iconTextClass,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  iconLetter: string | React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className={`w-8 h-8 rounded-full text-white font-black text-sm flex items-center justify-center ${iconBgClass}`}>
            {iconLetter}
          </span>
          <span className={`font-bold text-base uppercase tracking-wide ${iconTextClass}`}>
            {title}
          </span>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main PrimarySurveySection Component ───────────────────────────

export function PrimarySurveySection({
  data,
  onChange,
  caseType,
  onMarkNormal,
  onInterpretABG,
  vitals,
  onUpdateVitals,
}: PrimarySurveySectionProps) {
  const isTrauma = caseType?.toLowerCase() === "trauma";
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    airway: false,
    breathing: false,
    circulation: false,
    disability: false,
    exposure: false,
    abg: false,
    ecg: false,
    efast: false,
    bedsideEcho: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-4">
      {/* Header Banner - Full Width Green Banner */}
      {onMarkNormal && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border-y border-emerald-200 dark:border-emerald-800 p-4 -mx-4 md:-mx-6 mb-4 flex items-center justify-between cursor-pointer" onClick={onMarkNormal}>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">Mark all clinical findings Normal</h3>
              <p className="text-emerald-600/80 dark:text-emerald-400/80 text-[11px]">(keeps symptoms, drugs & diagnosis)</p>
            </div>
          </div>
        </div>
      )}

      {/* Scan Document Button */}
      <div className="mb-4">
        <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors text-sm">
          <Camera className="w-4 h-4" />
          Scan Document
        </button>
      </div>

      {/* ── A — AIRWAY ─────────────────────────────────────────────── */}
      <AccordionItem
        title="A - AIRWAY"
        iconLetter="?"
        iconBgClass="bg-red-500"
        iconTextClass="text-red-500"
        isOpen={openSections.airway}
        onToggle={() => toggleSection('airway')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickSelect
            label="Airway Status"
            options={["Patent", "Maintained", "Compromised", "Protected"]}
            value={data.airway?.status}
            onChange={(v) => onChange("airway.status", v.toLowerCase())}
          />
          {data.airway?.status !== "patent" && (
            <TextInput
              label="Intervention Required"
              placeholder="Jaw thrust / Chin lift / OPA / NPA / RSI / Surgical airway"
              value={data.airway?.intervention}
              onChange={(v) => onChange("airway.intervention", v)}
            />
          )}
          {isTrauma && (
            <QuickSelect
              label="C-Spine Management"
              options={["Immobilised", "Not applicable"]}
              value={data.airway?.cSpine === "immobilised" ? "Immobilised" : "Not applicable"}
              onChange={(v) =>
                onChange("airway.cSpine", v === "Immobilised" ? "immobilised" : "not_applicable")
              }
            />
          )}
        </div>
      </AccordionItem>

      {/* ── B — BREATHING ──────────────────────────────────────────── */}
      <AccordionItem
        title="B - BREATHING"
        iconLetter="?"
        iconBgClass="bg-orange-500"
        iconTextClass="text-orange-500"
        isOpen={openSections.breathing}
        onToggle={() => toggleSection('breathing')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <VitalInput
            label="RR"
            unit="/min"
            normal="12-20"
            flagHigh={25}
            flagLow={10}
            value={data.breathing?.rr || vitals?.rr || ""}
            onChange={(v) => {
              onChange("breathing.rr", v);
              onUpdateVitals?.("rr", v);
            }}
          />
          <VitalInput
            label="SpO₂"
            unit="%"
            normal="95-100"
            flagLow={94}
            value={data.breathing?.spo2 || vitals?.spo2 || ""}
            onChange={(v) => {
              onChange("breathing.spo2", v);
              onUpdateVitals?.("spo2", v);
            }}
          />
          <TextInput
            label="O₂ Delivery"
            placeholder="Room air / 2L NC / Mask / NRM / NIV / Intubated"
            value={data.breathing?.o2Delivery}
            onChange={(v) => onChange("breathing.o2Delivery", v)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickSelect
            label="Work of Breathing"
            options={["Normal", "Increased"]}
            value={data.breathing?.workOfBreathing === "increased" ? "Increased" : "Normal"}
            onChange={(v) => onChange("breathing.workOfBreathing", v.toLowerCase())}
          />
          <QuickSelect
            label="Air Entry"
            options={["Bilaterally equal", "Decreased R", "Decreased L", "Absent R", "Absent L"]}
            value={data.breathing?.airEntry}
            onChange={(v) => onChange("breathing.airEntry", v)}
          />
          <QuickSelect
            label="Added Sounds"
            options={["Clear", "Wheeze", "Crepitations", "Absent"]}
            value={data.breathing?.addedSounds}
            onChange={(v) => onChange("breathing.addedSounds", v)}
          />
        </div>
        {isTrauma && (
          <div className="mt-3">
            <QuickSelect
              label="Chest Wall Assessment"
              options={["Normal", "Asymmetric", "Flail segment", "Open wound"]}
              value={data.breathing?.chestWall}
              onChange={(v) => onChange("breathing.chestWall", v)}
            />
          </div>
        )}
      </AccordionItem>

      {/* ── C — CIRCULATION ────────────────────────────────────────── */}
      <AccordionItem
        title="C - CIRCULATION"
        iconLetter="?"
        iconBgClass="bg-amber-500"
        iconTextClass="text-amber-500"
        isOpen={openSections.circulation}
        onToggle={() => toggleSection('circulation')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <VitalInput
            label="HR"
            unit="/min"
            normal="60-100"
            flagHigh={100}
            flagLow={50}
            value={data.circulation?.hr || vitals?.hr || ""}
            onChange={(v) => {
              onChange("circulation.hr", v);
              onUpdateVitals?.("hr", v);
            }}
          />
          <QuickSelect
            label="Rhythm"
            options={["Regular", "Irregular"]}
            value={data.circulation?.rhythm === "irregular" ? "Irregular" : "Regular"}
            onChange={(v) => onChange("circulation.rhythm", v.toLowerCase())}
          />
          <VitalInput
            label="BP"
            unit="mmHg"
            placeholder="120/80"
            normal="120/80"
            flagHighSBP={160}
            flagLowSBP={90}
            value={
              data.circulation?.sbp && data.circulation?.dbp
                ? `${data.circulation.sbp}/${data.circulation.dbp}`
                : data.circulation?.sbp || vitals?.bp || ""
            }
            onChange={(v) => {
              const parts = v.split("/");
              onChange("circulation.sbp", parts[0] || "");
              onChange("circulation.dbp", parts[1] || "");
              onUpdateVitals?.("bp", v);
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <QuickSelect
            label="CRT"
            options={["< 2 sec", "> 2 sec"]}
            value={data.circulation?.crt === "<2sec" ? "< 2 sec" : data.circulation?.crt === ">2sec" ? "> 2 sec" : data.circulation?.crt}
            onChange={(v) => onChange("circulation.crt", v === "< 2 sec" ? "<2sec" : ">2sec")}
          />
          <QuickSelect
            label="Peripheral Pulses"
            options={["Normal", "Weak", "Absent", "Bounding"]}
            value={data.circulation?.peripheralPulses}
            onChange={(v) => onChange("circulation.peripheralPulses", v.toLowerCase())}
          />
          <QuickSelect
            label="Skin Perfusion"
            options={["Warm + dry", "Cool + clammy", "Mottled", "Pale"]}
            value={data.circulation?.skinPerfusion}
            onChange={(v) => onChange("circulation.skinPerfusion", v)}
          />
        </div>
        {isTrauma && (
          <div className="mb-3">
            <TextInput
              label="External Bleeding"
              placeholder="Nil / Active bleeding site & control method"
              value={data.circulation?.bleeding}
              onChange={(v) => onChange("circulation.bleeding", v)}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          <TextInput
            label="IV / IO Access"
            placeholder="18G right AC · 16G left AC · IO"
            value={data.circulation?.ivAccess}
            onChange={(v) => onChange("circulation.ivAccess", v)}
          />
        </div>
      </AccordionItem>

      {/* ── D — DISABILITY ─────────────────────────────────────────── */}
      <AccordionItem
        title="D - DISABILITY (Neuro)"
        iconLetter="?"
        iconBgClass="bg-emerald-500"
        iconTextClass="text-emerald-500"
        isOpen={openSections.disability}
        onToggle={() => toggleSection('disability')}
      >
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Glasgow Coma Scale (GCS)
            </span>
            <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
              Score: {data.disability?.gcsTotal || "15"}/15
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <VitalInput
              label="Eye (E1-E4)"
              max={4}
              min={1}
              value={data.disability?.gcsE}
              onChange={(v) => {
                onChange("disability.gcsE", v);
                const total = (parseInt(v) || 0) + (parseInt(data.disability?.gcsV || "0") || 0) + (parseInt(data.disability?.gcsM || "0") || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
            <VitalInput
              label="Verbal (V1-V5)"
              max={5}
              min={1}
              value={data.disability?.gcsV}
              onChange={(v) => {
                onChange("disability.gcsV", v);
                const total = (parseInt(data.disability?.gcsE || "0") || 0) + (parseInt(v) || 0) + (parseInt(data.disability?.gcsM || "0") || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
            <VitalInput
              label="Motor (M1-M6)"
              max={6}
              min={1}
              value={data.disability?.gcsM}
              onChange={(v) => {
                onChange("disability.gcsM", v);
                const total = (parseInt(data.disability?.gcsE || "0") || 0) + (parseInt(data.disability?.gcsV || "0") || 0) + (parseInt(v) || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
          <VitalInput
            label="Pupil Size R"
            unit="mm"
            max={8}
            min={1}
            value={data.disability?.pupilSizeR}
            onChange={(v) => onChange("disability.pupilSizeR", v)}
          />
          <VitalInput
            label="Pupil Size L"
            unit="mm"
            max={8}
            min={1}
            value={data.disability?.pupilSizeL}
            onChange={(v) => onChange("disability.pupilSizeL", v)}
          />
          <QuickSelect
            label="Reaction"
            options={["Reactive", "Sluggish", "Fixed"]}
            value={data.disability?.pupilReaction}
            onChange={(v) => onChange("disability.pupilReaction", v.toLowerCase())}
          />
          <QuickSelect
            label="Pupils Equal"
            options={["Equal", "Unequal"]}
            value={data.disability?.pupilsEqual === true ? "Equal" : data.disability?.pupilsEqual === false ? "Unequal" : null}
            onChange={(v) => onChange("disability.pupilsEqual", v === "Equal")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <VitalInput
            label="GRBS"
            unit="mg/dL"
            normal="70-140"
            flagHigh={200}
            flagLow={70}
            value={data.disability?.grbs || vitals?.grbs || ""}
            onChange={(v) => {
              onChange("disability.grbs", v);
              onUpdateVitals?.("grbs", v);
            }}
          />
          <QuickSelect
            label="Seizure Activity"
            options={["None", "Active", "Post-ictal"]}
            value={data.disability?.seizure === "none" ? "None" : data.disability?.seizure === "active" ? "Active" : data.disability?.seizure === "postictal" ? "Post-ictal" : data.disability?.seizure}
            onChange={(v) => onChange("disability.seizure", v.toLowerCase().replace("-", ""))}
          />
          <TextInput
            label="Focal Deficit"
            placeholder="Nil / Right hemiplegia / Aphasia"
            value={data.disability?.focalDeficit}
            onChange={(v) => onChange("disability.focalDeficit", v)}
          />
        </div>
      </AccordionItem>

      {/* ── E — EXPOSURE ─────────────────────────────────────────── */}
      <AccordionItem
        title="E - EXPOSURE"
        iconLetter="?"
        iconBgClass="bg-blue-500"
        iconTextClass="text-blue-500"
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <VitalInput
            label="Temperature"
            unit="°C / °F"
            normal="37.0°C / 98.6°F"
            flagHigh={38.0}
            flagLow={35.5}
            value={data.exposure?.temp || vitals?.temp || ""}
            onChange={(v) => {
              onChange("exposure.temp", v);
              onUpdateVitals?.("temp", v);
            }}
          />
          <QuickSelect
            label="Hypothermia Prevention"
            options={["Warm blankets applied", "Warmer on", "Not required"]}
            value={data.exposure?.hypothermiaPrevention ? "Warm blankets applied" : "Not required"}
            onChange={(v) => onChange("exposure.hypothermiaPrevention", v !== "Not required")}
          />
        </div>
        <div className="mb-3">
          <TextInput
            label="Skin / Rashes / Edema"
            placeholder="No rashes / Erythematous rash / Pedal edema"
            value={data.exposure?.skin}
            onChange={(v) => onChange("exposure.skin", v)}
          />
        </div>
        {isTrauma && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickSelect
              label="Log Roll"
              options={["Spine clear", "Midline tenderness", "Step deformity", "Not done"]}
              value={data.exposure?.logRoll}
              onChange={(v) => onChange("exposure.logRoll", v)}
            />
            <QuickSelect
              label="Pelvis Stability"
              options={["Stable", "Unstable", "Not assessed"]}
              value={data.exposure?.pelvis === "stable" ? "Stable" : data.exposure?.pelvis === "unstable" ? "Unstable" : "Not assessed"}
              onChange={(v) => onChange("exposure.pelvis", v.toLowerCase().replace(" ", "_"))}
            />
            <TextInput
              label="Long Bones"
              placeholder="Intact / Deformity / Open fracture"
              value={data.exposure?.longBones}
              onChange={(v) => onChange("exposure.longBones", v)}
            />
          </div>
        )}
      </AccordionItem>

      <PrimarySurveyAdjuncts data={data} onChange={onChange} openSections={openSections} toggleSection={toggleSection} onInterpretABG={onInterpretABG} />
</div>
  );
}


export function IsolatedPrimarySurveyAdjuncts({ data, onChange, onInterpretABG }: any) {
  const [openSections, setOpenSections] = React.useState({
    abg: true,
    ecg: true,
    efast: true,
    bedsideEcho: true
  });
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return <PrimarySurveyAdjuncts data={data} onChange={onChange} openSections={openSections} toggleSection={toggleSection} onInterpretABG={onInterpretABG} />;
}
