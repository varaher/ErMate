import React, { useState, useEffect } from "react";
import VoiceRecorder from "./shared/VoiceRecorder";
import { CheckCircle, Activity, Heart, Brain, Stethoscope, User, Footprints } from "lucide-react";
import { AccordionItem } from "./PrimarySurveySection";

export function parseSecondaryAssessmentToSurvey(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text || typeof text !== "string") return result;

  const normalizeKey = (k: string): string | null => {
    const lower = k.trim().toLowerCase();
    if (lower.startsWith("rs") || lower.includes("respiratory") || lower.includes("chest") || lower.includes("lung")) return "respiratory";
    if (lower.startsWith("pa") || lower.includes("abdomen") || lower.includes("abdominal")) return "abdomen";
    if (lower.includes("cvs") || lower.includes("cardiovascular") || lower.includes("heart")) return "cvs";
    if (lower.includes("cns") || lower.includes("neurological") || lower.includes("neuro")) return "cns";
    if (lower.includes("general")) return "general";
    if (lower.includes("extremit") || lower.includes("local") || lower.includes("trauma") || lower.includes("musculoskeletal") || lower.includes("msk")) return "extremities";
    return null;
  };

  const headerPattern = "(?:general(?:\\s+examination|\\s+exam)?|cvs(?:\\s+examination|\\s+exam)?|cardiovascular(?:\\s+examination|\\s+exam)?|respiratory(?:\\s+system|\\s+examination|\\s+exam)?|rs(?:\\s+examination|\\s+exam)?|chest(?:\\s+examination|\\s+exam)?|per\\s+abdomen(?:\\s+examination|\\s+exam)?|pa(?:\\s+examination|\\s+exam)?|abdomen(?:\\s+examination|\\s+exam)?|abdominal(?:\\s+examination|\\s+exam)?|cns(?:\\s+examination|\\s+exam)?|neurological(?:\\s+examination|\\s+exam)?|extremities(?:\\s+examination|\\s+exam)?|extremity(?:\\s+examination|\\s+exam)?|musculoskeletal(?:\\s+examination|\\s+exam)?|msk)";

  const regex = new RegExp(`(?:^|[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(${headerPattern})\\s*[:\\-]\\s*([\\s\\S]*?)(?=(?:[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(?:${headerPattern})\\s*[:\\-]|$)`, "gi");

  let match;
  let foundAny = false;
  while ((match = regex.exec(text)) !== null) {
    const key = normalizeKey(match[1]);
    let val = (match[2] || "").trim();
    val = val.replace(/^[,\.\s;:\-]+/, "").replace(/[,\.\s;:\-]+$/, "").trim();
    if (key && val) {
      result[key] = result[key] ? `${result[key]}\n${val}` : val;
      foundAny = true;
    }
  }
  if (!foundAny && text.trim()) {
    result.general = text.trim();
  }
  return result;
}

export function SecondarySurveySection({
  secondaryAssessment,
  secondarySurvey,
  onChange,
  onMarkNormal
}: {
  secondaryAssessment: string;
  secondarySurvey?: Record<string, string>;
  onChange: (value: string, updatedSurvey?: Record<string, string>) => void;
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

  // Parse initial value once when component mounts or when string / survey changes externally
  useEffect(() => {
    const newFields = {
      General: "",
      CVS: "",
      RS: "",
      PA: "",
      CNS: "",
      Extremities: ""
    };

    // 1. Populate from secondarySurvey if available
    if (secondarySurvey && typeof secondarySurvey === "object") {
      if (secondarySurvey.general) newFields.General = secondarySurvey.general;
      if (secondarySurvey.cvs) newFields.CVS = secondarySurvey.cvs;
      if (secondarySurvey.respiratory) newFields.RS = secondarySurvey.respiratory;
      if (secondarySurvey.abdomen) newFields.PA = secondarySurvey.abdomen;
      if (secondarySurvey.cns) newFields.CNS = secondarySurvey.cns;
      if (secondarySurvey.extremities) newFields.Extremities = secondarySurvey.extremities;
    }

    // 2. Parse secondaryAssessment and merge/populate missing fields
    if (secondaryAssessment && typeof secondaryAssessment === "string") {
      const parsed = parseSecondaryAssessmentToSurvey(secondaryAssessment);
      if (parsed.general && !newFields.General) newFields.General = parsed.general;
      if (parsed.cvs && !newFields.CVS) newFields.CVS = parsed.cvs;
      if (parsed.respiratory && !newFields.RS) newFields.RS = parsed.respiratory;
      if (parsed.abdomen && !newFields.PA) newFields.PA = parsed.abdomen;
      if (parsed.cns && !newFields.CNS) newFields.CNS = parsed.cns;
      if (parsed.extremities && !newFields.Extremities) newFields.Extremities = parsed.extremities;
    }

    setFields(newFields);
  }, [secondaryAssessment, secondarySurvey]);

  const handleFieldChange = (key: keyof typeof fields, value: string) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    
    // Reconstruct the string
    const parts = [];
    if (updated.General.trim()) parts.push(`General: ${updated.General.trim()}`);
    if (updated.CVS.trim()) parts.push(`CVS: ${updated.CVS.trim()}`);
    if (updated.RS.trim()) parts.push(`RS: ${updated.RS.trim()}`);
    if (updated.PA.trim()) parts.push(`PA: ${updated.PA.trim()}`);
    if (updated.CNS.trim()) parts.push(`CNS: ${updated.CNS.trim()}`);
    if (updated.Extremities.trim()) parts.push(`Extremities: ${updated.Extremities.trim()}`);

    const updatedSurvey: Record<string, string> = {
      ...(secondarySurvey || {}),
      general: updated.General.trim(),
      cvs: updated.CVS.trim(),
      respiratory: updated.RS.trim(),
      abdomen: updated.PA.trim(),
      cns: updated.CNS.trim(),
      extremities: updated.Extremities.trim()
    };
    onChange(parts.join("\n"), updatedSurvey);
  };


  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    General: false,
    CVS: false,
    RS: false,
    PA: false,
    CNS: false,
    Extremities: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
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
          const val = fields[key as keyof typeof fields];
          const summary = val ? (val.length > 40 ? val.substring(0, 40) + '...' : val) : '';
          
          let icon = <CheckCircle className="w-4 h-4" />;
          if (key === 'General') icon = <User className="w-4 h-4" />;
          if (key === 'CVS') icon = <Heart className="w-4 h-4" />;
          if (key === 'RS') icon = <Activity className="w-4 h-4" />;
          if (key === 'PA') icon = <Stethoscope className="w-4 h-4" />;
          if (key === 'CNS') icon = <Brain className="w-4 h-4" />;
          if (key === 'Extremities') icon = <Footprints className="w-4 h-4" />;

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
              <AccordionItem iconBgClass="bg-blue-100 dark:bg-blue-900" iconTextClass="text-blue-700 dark:text-blue-300"
                key={key}
                title={label + " Examination"}
                summary={summary}
                iconLetter={icon}
                isOpen={openSections[key]}
                onToggle={() => toggleSection(key)}
              >
                <div className="flex flex-col gap-2">
                
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
              </AccordionItem>
            );
          }

          return (
          <AccordionItem iconBgClass="bg-blue-100 dark:bg-blue-900" iconTextClass="text-blue-700 dark:text-blue-300"
            key={key}
            title={label}
            summary={summary}
            iconLetter={icon}
            isOpen={openSections[key]}
            onToggle={() => toggleSection(key)}
          >
          <div className="flex flex-col md:flex-row md:items-start gap-2">
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
          </AccordionItem>
        );
      })}
      </div>
    </div>
  );
}
