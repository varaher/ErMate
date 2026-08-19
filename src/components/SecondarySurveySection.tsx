import React, { useState, useEffect } from "react";
import VoiceRecorder from "./shared/VoiceRecorder";
import { CheckCircle } from "lucide-react";

export function SecondarySurveySection({
  secondaryAssessment,
  onChange,
  onMarkNormal
}: {
  secondaryAssessment: string;
  onChange: (value: string) => void;
  onMarkNormal: () => void;
}) {
  const [fields, setFields] = useState({
    General: "",
    CVS: "",
    RS: "",
    PA: "",
    CNS: "",
    Extremities: ""
  });

  // Parse initial value once when component mounts or when string completely changes externally
  useEffect(() => {
    if (!secondaryAssessment) {
      setFields({
        General: "",
        CVS: "",
        RS: "",
        PA: "",
        CNS: "",
        Extremities: ""
      });
      return;
    }

    const newFields = { ...fields };
    const regex = /(General|CVS|RS|PA|CNS|Extremities)\s*:\s*(.*?)(?=(General|CVS|RS|PA|CNS|Extremities)\s*:|$)/igs;
    let match;
    let foundAny = false;
    while ((match = regex.exec(secondaryAssessment)) !== null) {
      const key = match[1] as string;
      // Map aliases if needed, but the regex already matches the keys
      const mappedKey = Object.keys(newFields).find(k => k.toLowerCase() === key.toLowerCase()) as keyof typeof fields;
      if (mappedKey) {
        newFields[mappedKey] = match[2].trim();
        foundAny = true;
      }
    }
    
    // If it couldn't parse it into fields, maybe dump it into General
    if (!foundAny && secondaryAssessment.trim() !== "") {
       newFields.General = secondaryAssessment.trim();
    }

    setFields(newFields);
  }, [secondaryAssessment]); // We want it to re-parse if the entire case is loaded

  const handleFieldChange = (key: keyof typeof fields, value: string) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    
    // Reconstruct the string
    const parts = [];
    for (const [k, v] of Object.entries(updated) as [string, string][]) {
      if (v.trim()) {
        parts.push(`${k}: ${v.trim()}`);
      }
    }
    onChange(parts.join("\n"));
  };

  const systems = [
    { key: "General", label: "General" },
    { key: "CVS", label: "CVS" },
    { key: "RS", label: "Respiratory (RS)" },
    { key: "PA", label: "Abdomen (PA)" },
    { key: "CNS", label: "CNS" },
    { key: "Extremities", label: "Extremities" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">Secondary Head-to-Toe Examination Findings</h3>
        <button
          type="button"
          onClick={onMarkNormal}
          className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          Mark Normal
        </button>
      </div>
      
      <div className="space-y-3">
        {systems.map(({ key, label }) => {
          if (key === "General") {
            const isPallor = fields.General.toLowerCase().includes("pallor") && !fields.General.toLowerCase().includes("no pallor");
            const isIcterus = fields.General.toLowerCase().includes("icterus") && !fields.General.toLowerCase().includes("no icterus");
            const isCyanosis = fields.General.toLowerCase().includes("cyanosis") && !fields.General.toLowerCase().includes("no cyanosis");
            const isClubbing = fields.General.toLowerCase().includes("clubbing") && !fields.General.toLowerCase().includes("no clubbing");
            const isLympha = fields.General.toLowerCase().includes("lymphadenopathy") && !fields.General.toLowerCase().includes("no lymphadenopathy");
            const isEdema = fields.General.toLowerCase().includes("edema") && !fields.General.toLowerCase().includes("no edema") && !fields.General.toLowerCase().includes("no pedal edema");

            const toggleLabel = (lbl: string, flag: boolean, name: string) => {
               return (
                  <div key={name} className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 flex-1 min-w-[120px]">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{lbl}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newStr = flag 
                          ? fields.General.replace(new RegExp(`\\b${name}\\b`, "gi"), "").replace(/,\s*,/g, ",").trim()
                          : (fields.General ? fields.General + ", " + name : name);
                        handleFieldChange("General", newStr);
                      }}
                      className={`w-8 h-4 rounded-full relative transition-colors ${flag ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${flag ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
               )
            };

            return (
              <div key={key} className="flex flex-col gap-2 border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {label} Examination
                </label>
                
                <div className="flex flex-wrap gap-2 mb-1">
                   {toggleLabel("Pallor", isPallor, "Pallor")}
                   {toggleLabel("Icterus", isIcterus, "Icterus")}
                   {toggleLabel("Cyanosis", isCyanosis, "Cyanosis")}
                   {toggleLabel("Clubbing", isClubbing, "Clubbing")}
                   {toggleLabel("Lymphadenopathy", isLympha, "Lymphadenopathy")}
                   {toggleLabel("Edema", isEdema, "Edema")}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Additional general findings..."
                    value={fields.General}
                    onChange={(e) => handleFieldChange("General", e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <VoiceRecorder 
                    renderMode="compact-button" 
                    onTranscript={(txt) => handleFieldChange("General", (fields.General ? fields.General + " " : "") + txt)} 
                  />
                </div>
              </div>
            );
          }

          return (
          <div key={key} className="flex flex-col md:flex-row md:items-start gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 md:w-32 md:mt-2 shrink-0">
              {label}
            </label>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder={`Record ${label.toLowerCase()} findings...`}
                value={fields[key as keyof typeof fields]}
                onChange={(e) => handleFieldChange(key as keyof typeof fields, e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <VoiceRecorder 
                renderMode="compact-button" 
                onTranscript={(txt) => handleFieldChange(key as keyof typeof fields, (fields[key as keyof typeof fields] ? fields[key as keyof typeof fields] + " " : "") + txt)} 
              />
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
