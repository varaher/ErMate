import React from "react";
import { Activity, HeartPulse, Stethoscope } from "lucide-react";
import type { WorkArea } from "../../types";

interface Props {
  value: WorkArea;
  onChange: (mode: WorkArea) => void;
  disabled?: boolean;
  className?: string;
}

const MODES: { id: WorkArea; label: string; icon: React.ElementType; soon?: boolean }[] = [
  { id: "ER", label: "ER", icon: Activity },
  { id: "ICU", label: "ICU", icon: HeartPulse },
  { id: "OPD", label: "OPD", icon: Stethoscope, soon: true },
];

/**
 * ER · ICU · OPD mode switch. Shown on the Home dashboard and the ICU screen.
 * Switching opens that mode immediately; the parent saves it as the doctor's work area.
 */
export default function ModeSwitcher({ value, onChange, disabled, className = "" }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="ErMate mode"
      data-coach="mode-switcher"
      className={`inline-flex items-center gap-0.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-0.5 ${className}`}
    >
      {MODES.map((m) => {
        const selected = value === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || m.soon}
            title={m.soon ? "OPD mode is coming soon" : `Switch to ${m.label} mode`}
            onClick={() => { if (!selected) onChange(m.id); }}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              selected
                ? "bg-purple-600 text-white shadow-sm"
                : "text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/50"
            } ${m.soon ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {m.label}
            {m.soon && <span className="text-[9px] font-medium opacity-80">Soon</span>}
          </button>
        );
      })}
    </div>
  );
}