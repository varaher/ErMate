import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ══════════════════════════════════════════════════════════════════
// NormalAbnormalField
// ══════════════════════════════════════════════════════════════════

export interface NormalAbnormalFieldProps {
  label: string;
  status: "unset" | "normal" | "abnormal";
  onStatusChange: (status: "normal" | "abnormal") => void;
  normalNarrative: string;
  currentNarrative: string | null;
  abnormalContent: React.ReactNode;
}

export function NormalAbnormalField({
  label,
  status,
  onStatusChange,
  normalNarrative,
  currentNarrative,
  abnormalContent,
}: NormalAbnormalFieldProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        {label ? <h4 className="font-bold text-slate-900 dark:text-white text-base">{label}</h4> : <div />}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onStatusChange("normal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              status === "normal"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
            }`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("abnormal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              status === "abnormal"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            Abnormal
          </button>
        </div>
      </div>

      {status === "normal" && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed font-medium">
          ✓ {currentNarrative || normalNarrative}
        </div>
      )}

      {status === "abnormal" && (
        <div className="pt-1 space-y-3">
          {abnormalContent}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ChipGroup
// ══════════════════════════════════════════════════════════════════

export interface ChipGroupProps {
  groupLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiSelect?: boolean;
}

export function ChipGroup({
  groupLabel,
  options,
  selected,
  onChange,
  multiSelect = false,
}: ChipGroupProps) {
  const handleSelect = (option: string) => {
    if (multiSelect) {
      if (selected.includes(option)) {
        onChange(selected.filter((item) => item !== option));
      } else {
        onChange([...selected, option]);
      }
    } else {
      if (selected.includes(option)) {
        onChange([]);
      } else {
        onChange([option]);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-300 block">{groupLabel}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? "bg-blue-600 text-white border border-blue-500 shadow-sm"
                  : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ToggleSwitchGrid
// ══════════════════════════════════════════════════════════════════

export interface ToggleSwitchGridProps {
  columns?: number;
  fields: { key: string; label: string; value: boolean }[];
  onChange: (key: string, value: boolean) => void;
}

export function ToggleSwitchGrid({
  columns = 2,
  fields,
  onChange,
}: ToggleSwitchGridProps) {
  const gridClass = columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-2.5`}>
      {fields.map(({ key, label, value }) => (
        <div
          key={key}
          onClick={() => onChange(key, !value)}
          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-colors ${
            value
              ? "bg-emerald-950/40 border-emerald-700/80 text-emerald-200"
              : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <span className="text-xs font-semibold">{label}</span>
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
              value ? "bg-emerald-500 justify-end" : "bg-slate-600 justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CollapsibleSection
// ══════════════════════════════════════════════════════════════════

export interface CollapsibleSectionProps {
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  titleColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  icon,
  iconBgColor,
  title,
  titleColor,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden my-2 shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-xl ${iconBgColor} flex items-center justify-center text-white font-bold text-sm`}>
            {icon}
          </span>
          <h3 className={`font-bold text-base ${titleColor}`}>{title}</h3>
        </div>
        <div className="text-slate-500 dark:text-slate-400 p-1">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// AirwayField
// ══════════════════════════════════════════════════════════════════

const AIRWAY_NORMAL = "Patent airway, speaking normally, clear breath sounds, no stridor or stertor, swallow reflex intact.";

export interface AirwayState {
  status: "unset" | "normal" | "abnormal";
  position: string[];
  patency: string[];
  cause: string[];
  narrative: string | null;
}

export function AirwayField({
  state,
  onChange,
}: {
  state: AirwayState;
  onChange: (s: AirwayState) => void;
}) {
  const handleStatusChange = (status: "normal" | "abnormal") => {
    onChange({ ...state, status, narrative: status === "normal" ? AIRWAY_NORMAL : null });
  };

  const updatePart = (key: "position" | "patency" | "cause", values: string[]) => {
    const updated = { ...state, [key]: values };
    const parts: string[] = [];
    if (updated.position.length > 0) parts.push(`Position: ${updated.position.join(", ")}`);
    if (updated.patency.length > 0) parts.push(`Patency: ${updated.patency.join(", ")}`);
    if (updated.cause.length > 0) parts.push(`Cause: ${updated.cause.join(", ")}`);
    updated.narrative = parts.length > 0 ? parts.join(" | ") : "Abnormal (details pending)";
    onChange(updated);
  };

  return (
    <NormalAbnormalField
      label="A - AIRWAY"
      status={state.status}
      onStatusChange={handleStatusChange}
      normalNarrative={AIRWAY_NORMAL}
      currentNarrative={state.narrative}
      abnormalContent={
        <div className="space-y-4">
          <ChipGroup
            groupLabel="Airway Position"
            options={["Maintainable", "Unmaintainable", "Intubated", "Tracheostomy"]}
            selected={state.position}
            onChange={(v) => updatePart("position", v)}
          />
          <ChipGroup
            groupLabel="Patency / Sounds"
            options={["Clear", "Obstructed", "Stridor", "Stertor", "Gurgling", "Wheezing"]}
            selected={state.patency}
            onChange={(v) => updatePart("patency", v)}
            multiSelect
          />
          <ChipGroup
            groupLabel="Cause of Obstruction"
            options={["Tongue fall", "Foreign body", "Secretions / Blood", "Edema / Anaphylaxis", "Trauma"]}
            selected={state.cause}
            onChange={(v) => updatePart("cause", v)}
            multiSelect
          />
        </div>
      }
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// AbgVbgPanel
// ══════════════════════════════════════════════════════════════════

export interface AbgVbgPanelProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  sampleType: string;
  onSampleTypeChange: (sampleType: string) => void;
  interpretation?: string;
  onScanDocument?: () => void;
  onInterpret?: () => void;
  interpretationResult?: string | null;
}

export function AbgVbgPanel({
  values,
  onChange,
  sampleType,
  onSampleTypeChange,
  interpretation = "Not done",
  onScanDocument,
  onInterpret,
  interpretationResult,
}: AbgVbgPanelProps) {
  const fields = [
    { key: "ph", label: "pH", placeholder: "7.35-7.45" },
    { key: "pco2", label: "pCO₂ (mmHg)", placeholder: "35-45" },
    { key: "po2", label: "pO₂ (mmHg)", placeholder: "80-100" },
    { key: "hco3", label: "HCO₃⁻ (mEq/L)", placeholder: "22-26" },
    { key: "be", label: "Base Excess", placeholder: "-2 to +2" },
    { key: "lactate", label: "Lactate (mmol/L)", placeholder: "<2.0" },
    { key: "sao2", label: "SaO₂ (%)", placeholder: "95-100" },
    { key: "fio2", label: "FiO₂ (%)", placeholder: "21" },
    { key: "na", label: "Na⁺ (mEq/L)", placeholder: "135-145" },
    { key: "k", label: "K⁺ (mEq/L)", placeholder: "3.5-5.0" },
  ];

  const handleFieldChange = (key: string, val: string) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipGroup
          groupLabel="Sample Type"
          options={["Arterial (ABG)", "Venous (VBG)", "Capillary"]}
          selected={[sampleType]}
          onChange={(s) => s[0] && onSampleTypeChange(s[0])}
        />
        {onScanDocument && (
          <button
            type="button"
            onClick={onScanDocument}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            📷 Scan ABG Printout
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">{label}</label>
            <input
              type="text"
              value={values[key] || ""}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs text-center focus:outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>

      {(interpretation || interpretationResult) && (
        <div className="bg-slate-850 border border-slate-750 rounded-xl p-3 text-xs text-slate-200">
          <span className="font-bold text-emerald-400">Interpretation: </span>
          {interpretationResult || interpretation}
        </div>
      )}

      {onInterpret && (
        <button
          type="button"
          onClick={onInterpret}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
        >
          🧠 Analyze Acid-Base Status
        </button>
      )}
    </div>
  );
}
