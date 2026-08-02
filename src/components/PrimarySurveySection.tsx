import React from "react";
import { PrimarySurvey, PatientVitals } from "../types";
import { Activity, ShieldAlert, CheckCircle, Heart, AlertTriangle } from "lucide-react";

interface PrimarySurveySectionProps {
  data: PrimarySurvey;
  onChange: (fieldPath: string, value: any) => void;
  caseType: string;
  onMarkNormal?: () => void;
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

function VitalInput({
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
      <input
        type="text"
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

// ── Main PrimarySurveySection Component ───────────────────────────

export function PrimarySurveySection({
  data,
  onChange,
  caseType,
  onMarkNormal,
  vitals,
  onUpdateVitals,
}: PrimarySurveySectionProps) {
  const isTrauma = caseType?.toLowerCase() === "trauma";

  return (
    <div className="space-y-5 bg-white dark:bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>ABCDE Primary Survey</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {isTrauma ? "ATLS Trauma Standard" : "RCEM Medical Standard"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Structured time-critical primary assessment & resuscitation record
            </p>
          </div>
        </div>

        {onMarkNormal && (
          <button
            type="button"
            onClick={onMarkNormal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Mark ABCDE Normal</span>
          </button>
        )}
      </div>

      {/* ── A — AIRWAY ─────────────────────────────────────────────── */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <span className="w-6 h-6 rounded-lg bg-red-600 text-white font-black text-xs flex items-center justify-center">
            A
          </span>
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Airway & Cervical Spine
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickSelect
            label="Airway Status"
            options={["Patent", "Maintained", "Compromised", "Protected"]}
            value={data.airway.status}
            onChange={(v) => onChange("airway.status", v.toLowerCase())}
          />

          {data.airway.status !== "patent" && (
            <TextInput
              label="Intervention Required"
              placeholder="Jaw thrust / Chin lift / OPA / NPA / RSI / Surgical airway"
              value={data.airway.intervention}
              onChange={(v) => onChange("airway.intervention", v)}
            />
          )}

          {isTrauma && (
            <QuickSelect
              label="C-Spine Management"
              options={["Immobilised", "Not applicable"]}
              value={data.airway.cSpine === "immobilised" ? "Immobilised" : "Not applicable"}
              onChange={(v) =>
                onChange("airway.cSpine", v === "Immobilised" ? "immobilised" : "not_applicable")
              }
            />
          )}
        </div>
      </div>

      {/* ── B — BREATHING ──────────────────────────────────────────── */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <span className="w-6 h-6 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center">
            B
          </span>
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Breathing & Ventilation
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <VitalInput
            label="RR"
            unit="/min"
            normal="12-20"
            flagHigh={25}
            flagLow={10}
            value={data.breathing.rr || vitals?.rr || ""}
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
            value={data.breathing.spo2 || vitals?.spo2 || ""}
            onChange={(v) => {
              onChange("breathing.spo2", v);
              onUpdateVitals?.("spo2", v);
            }}
          />
          <TextInput
            label="O₂ Delivery"
            placeholder="Room air / 2L NC / Mask / NRM / NIV / Intubated"
            value={data.breathing.o2Delivery}
            onChange={(v) => onChange("breathing.o2Delivery", v)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickSelect
            label="Work of Breathing"
            options={["Normal", "Increased"]}
            value={data.breathing.workOfBreathing === "increased" ? "Increased" : "Normal"}
            onChange={(v) => onChange("breathing.workOfBreathing", v.toLowerCase())}
          />
          <QuickSelect
            label="Air Entry"
            options={["Bilaterally equal", "Decreased R", "Decreased L", "Absent R", "Absent L"]}
            value={data.breathing.airEntry}
            onChange={(v) => onChange("breathing.airEntry", v)}
          />
          <QuickSelect
            label="Added Sounds"
            options={["Clear", "Wheeze", "Crepitations", "Absent"]}
            value={data.breathing.addedSounds}
            onChange={(v) => onChange("breathing.addedSounds", v)}
          />
        </div>

        {isTrauma && (
          <QuickSelect
            label="Chest Wall Assessment"
            options={["Normal", "Asymmetric", "Flail segment", "Open wound"]}
            value={data.breathing.chestWall}
            onChange={(v) => onChange("breathing.chestWall", v)}
          />
        )}
      </div>

      {/* ── C — CIRCULATION ────────────────────────────────────────── */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
            C
          </span>
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Circulation & Hemorrhage Control
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <VitalInput
            label="HR"
            unit="/min"
            normal="60-100"
            flagHigh={100}
            flagLow={50}
            value={data.circulation.hr || vitals?.hr || ""}
            onChange={(v) => {
              onChange("circulation.hr", v);
              onUpdateVitals?.("hr", v);
            }}
          />
          <QuickSelect
            label="Rhythm"
            options={["Regular", "Irregular"]}
            value={data.circulation.rhythm === "irregular" ? "Irregular" : "Regular"}
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
              data.circulation.sbp && data.circulation.dbp
                ? `${data.circulation.sbp}/${data.circulation.dbp}`
                : data.circulation.sbp || vitals?.bp || ""
            }
            onChange={(v) => {
              const parts = v.split("/");
              onChange("circulation.sbp", parts[0] || "");
              onChange("circulation.dbp", parts[1] || "");
              onUpdateVitals?.("bp", v);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickSelect
            label="CRT"
            options={["< 2 sec", "> 2 sec"]}
            value={data.circulation.crt === "<2sec" ? "< 2 sec" : data.circulation.crt === ">2sec" ? "> 2 sec" : data.circulation.crt}
            onChange={(v) => onChange("circulation.crt", v === "< 2 sec" ? "<2sec" : ">2sec")}
          />
          <QuickSelect
            label="Peripheral Pulses"
            options={["Normal", "Weak", "Absent", "Bounding"]}
            value={data.circulation.peripheralPulses}
            onChange={(v) => onChange("circulation.peripheralPulses", v.toLowerCase())}
          />
          <QuickSelect
            label="Skin Perfusion"
            options={["Warm + dry", "Cool + clammy", "Mottled", "Pale"]}
            value={data.circulation.skinPerfusion}
            onChange={(v) => onChange("circulation.skinPerfusion", v)}
          />
        </div>

        {isTrauma && (
          <TextInput
            label="External Bleeding"
            placeholder="Nil / Active bleeding site & control method"
            value={data.circulation.bleeding}
            onChange={(v) => onChange("circulation.bleeding", v)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput
            label="IV / IO Access"
            placeholder="18G right AC · 16G left AC · IO"
            value={data.circulation.ivAccess}
            onChange={(v) => onChange("circulation.ivAccess", v)}
          />
          <TextInput
            label="ECG"
            placeholder="NSR / AF / ST changes / S1Q3T3"
            value={data.circulation.ecg}
            onChange={(v) => onChange("circulation.ecg", v)}
          />
        </div>

        {/* EFAST Grid */}
        <div className="mt-2 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              EFAST (Extended Focused Assessment with Sonography in Trauma / Echo)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {[
              { label: "Pericardial window", key: "pericardial", opts: ["Negative", "Positive", "Not done"] },
              { label: "RUQ (Morison's pouch)", key: "ruq", opts: ["Negative", "Positive", "Not done"] },
              { label: "LUQ (Splenorenal)", key: "luq", opts: ["Negative", "Positive", "Not done"] },
              { label: "Suprapubic (Pouch of Douglas)", key: "suprapubic", opts: ["Negative", "Positive", "Not done"] },
              { label: "Bilateral lungs", key: "lungs", opts: ["No B-lines", "B-lines", "Not done"] },
            ].map((win) => {
              const curVal = (data.circulation.efast as any)?.[win.key] || "not_done";
              return (
                <div key={win.key} className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{win.label}</span>
                  <div className="flex gap-1">
                    {win.opts.map((opt) => {
                      const optCode = opt === "No B-lines" ? "no_blines" : opt === "B-lines" ? "blines" : opt.toLowerCase().replace(" ", "_");
                      const isSel = curVal === optCode;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => onChange(`circulation.efast.${win.key}`, optCode)}
                          className={`text-[9.5px] px-2 py-0.5 rounded font-extrabold border transition-all cursor-pointer ${
                            isSel
                              ? optCode === "positive" || optCode === "blines"
                                ? "bg-red-600 text-white border-red-600"
                                : optCode === "negative" || optCode === "no_blines"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-slate-700 text-white border-slate-700"
                              : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── D — DISABILITY ─────────────────────────────────────────── */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center">
            D
          </span>
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Disability & Neurological
          </h4>
        </div>

        {/* GCS Auto Calculator */}
        <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Glasgow Coma Scale (GCS)
            </span>
            <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
              Score: {data.disability.gcsTotal || "15"}/15
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <VitalInput
              label="Eye (E1-E4)"
              max={4}
              min={1}
              value={data.disability.gcsE}
              onChange={(v) => {
                onChange("disability.gcsE", v);
                const total = (parseInt(v) || 0) + (parseInt(data.disability.gcsV || "0") || 0) + (parseInt(data.disability.gcsM || "0") || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
            <VitalInput
              label="Verbal (V1-V5)"
              max={5}
              min={1}
              value={data.disability.gcsV}
              onChange={(v) => {
                onChange("disability.gcsV", v);
                const total = (parseInt(data.disability.gcsE || "0") || 0) + (parseInt(v) || 0) + (parseInt(data.disability.gcsM || "0") || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
            <VitalInput
              label="Motor (M1-M6)"
              max={6}
              min={1}
              value={data.disability.gcsM}
              onChange={(v) => {
                onChange("disability.gcsM", v);
                const total = (parseInt(data.disability.gcsE || "0") || 0) + (parseInt(data.disability.gcsV || "0") || 0) + (parseInt(v) || 0);
                onChange("disability.gcsTotal", total > 0 ? String(total) : null);
              }}
            />
          </div>
        </div>

        {/* Pupil Assessment */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <VitalInput
            label="Pupil Size R"
            unit="mm"
            max={8}
            min={1}
            value={data.disability.pupilSizeR}
            onChange={(v) => onChange("disability.pupilSizeR", v)}
          />
          <VitalInput
            label="Pupil Size L"
            unit="mm"
            max={8}
            min={1}
            value={data.disability.pupilSizeL}
            onChange={(v) => onChange("disability.pupilSizeL", v)}
          />
          <QuickSelect
            label="Reaction"
            options={["Reactive", "Sluggish", "Fixed"]}
            value={data.disability.pupilReaction}
            onChange={(v) => onChange("disability.pupilReaction", v.toLowerCase())}
          />
          <QuickSelect
            label="Pupils Equal"
            options={["Equal", "Unequal"]}
            value={data.disability.pupilsEqual === true ? "Equal" : data.disability.pupilsEqual === false ? "Unequal" : null}
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
            value={data.disability.grbs || vitals?.grbs || ""}
            onChange={(v) => {
              onChange("disability.grbs", v);
              onUpdateVitals?.("grbs", v);
            }}
          />
          <QuickSelect
            label="Seizure Activity"
            options={["None", "Active", "Post-ictal"]}
            value={data.disability.seizure === "none" ? "None" : data.disability.seizure === "active" ? "Active" : data.disability.seizure === "postictal" ? "Post-ictal" : data.disability.seizure}
            onChange={(v) => onChange("disability.seizure", v.toLowerCase().replace("-", ""))}
          />
          <TextInput
            label="Focal Deficit"
            placeholder="Nil / Right hemiplegia / Aphasia"
            value={data.disability.focalDeficit}
            onChange={(v) => onChange("disability.focalDeficit", v)}
          />
        </div>
      </div>

      {/* ── E — EXPOSURE ─────────────────────────────────────────── */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">
            E
          </span>
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Exposure & Environmental Control
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VitalInput
            label="Temperature"
            unit="°C / °F"
            normal="37.0°C / 98.6°F"
            flagHigh={38.0}
            flagLow={35.5}
            value={data.exposure.temp || vitals?.temp || ""}
            onChange={(v) => {
              onChange("exposure.temp", v);
              onUpdateVitals?.("temp", v);
            }}
          />
          <QuickSelect
            label="Hypothermia Prevention"
            options={["Warm blankets applied", "Warmer on", "Not required"]}
            value={data.exposure.hypothermiaPrevention ? "Warm blankets applied" : "Not required"}
            onChange={(v) => onChange("exposure.hypothermiaPrevention", v !== "Not required")}
          />
        </div>

        <TextInput
          label="Skin / Rashes / Edema"
          placeholder="No rashes / Erythematous rash / Pedal edema"
          value={data.exposure.skin}
          onChange={(v) => onChange("exposure.skin", v)}
        />

        {isTrauma && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickSelect
              label="Log Roll"
              options={["Spine clear", "Midline tenderness", "Step deformity", "Not done"]}
              value={data.exposure.logRoll}
              onChange={(v) => onChange("exposure.logRoll", v)}
            />
            <QuickSelect
              label="Pelvis Stability"
              options={["Stable", "Unstable", "Not assessed"]}
              value={data.exposure.pelvis === "stable" ? "Stable" : data.exposure.pelvis === "unstable" ? "Unstable" : "Not assessed"}
              onChange={(v) => onChange("exposure.pelvis", v.toLowerCase().replace(" ", "_"))}
            />
            <TextInput
              label="Long Bones"
              placeholder="Intact / Deformity / Open fracture"
              value={data.exposure.longBones}
              onChange={(v) => onChange("exposure.longBones", v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
