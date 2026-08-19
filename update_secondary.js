const fs = require('fs');
let content = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

const replacement = `
        {systems.map(({ key, label }) => {
          if (key === "General") {
            const isPallor = fields.General.toLowerCase().includes("pallor") && !fields.General.toLowerCase().includes("no pallor");
            const isIcterus = fields.General.toLowerCase().includes("icterus") && !fields.General.toLowerCase().includes("no icterus");
            const isCyanosis = fields.General.toLowerCase().includes("cyanosis") && !fields.General.toLowerCase().includes("no cyanosis");
            const isClubbing = fields.General.toLowerCase().includes("clubbing") && !fields.General.toLowerCase().includes("no clubbing");
            const isLympha = fields.General.toLowerCase().includes("lymphadenopathy") && !fields.General.toLowerCase().includes("no lymphadenopathy");
            const isEdema = fields.General.toLowerCase().includes("edema") && !fields.General.toLowerCase().includes("no edema") && !fields.General.toLowerCase().includes("no pedal edema");

            const toggleLabel = (label: string, flag: boolean, name: string) => {
               return (
                  <div key={name} className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 flex-1 min-w-[120px]">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newStr = flag 
                          ? fields.General.replace(new RegExp(\`\\\\b\${name}\\\\b\`, "gi"), "").replace(/,\\s*,/g, ",").trim()
                          : (fields.General ? fields.General + ", " + name : name);
                        handleFieldChange("General", newStr);
                      }}
                      className={\`w-8 h-4 rounded-full relative transition-colors \${flag ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"}\`}
                    >
                      <span className={\`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform \${flag ? "translate-x-4" : "translate-x-0.5"}\`} />
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
`;

content = content.replace(/{systems\.map\(\(\{\ key,\ label\ \}\)\ =>\ \(\s*<div\ key=\{key\}\ className="flex\ flex-col\ md:flex-row\ md:items-start\ gap-2">/g, replacement);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', content);
