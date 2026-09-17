const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

// The loop starts at {systems.map(({ key, label }) => {
const mapFind = `{systems.map(({ key, label }) => {`;
const mapRep = `{systems.map(({ key, label }) => {
          const val = fields[key as keyof typeof fields];
          const summary = val ? (val.length > 40 ? val.substring(0, 40) + '...' : val) : '';
          
          let icon = <CheckCircle className="w-4 h-4" />;
          if (key === 'General') icon = <User className="w-4 h-4" />;
          if (key === 'CVS') icon = <Heart className="w-4 h-4" />;
          if (key === 'RS') icon = <Activity className="w-4 h-4" />;
          if (key === 'PA') icon = <Stethoscope className="w-4 h-4" />;
          if (key === 'CNS') icon = <Brain className="w-4 h-4" />;
          if (key === 'Extremities') icon = <Footprints className="w-4 h-4" />;
`;

code = code.replace(mapFind, mapRep);

// We need to wrap the return of each in AccordionItem
const generalReturnFind = `            return (
              <div key={key} className="flex flex-col gap-2 border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {label} Examination
                </label>`;
                
const generalReturnRep = `            return (
              <AccordionItem
                key={key}
                title={label + " Examination"}
                summary={summary}
                iconLetter={icon}
                isOpen={openSections[key]}
                onToggle={() => toggleSection(key)}
              >
                <div className="flex flex-col gap-2">`;
code = code.replace(generalReturnFind, generalReturnRep);

const generalCloseFind = `                  <VoiceRecorder 
                     renderMode="compact-button" 
                     onTranscript={(txt) => handleFieldChange("General", (fields.General ? fields.General + " " : "") + txt)} 
                   />
                </div>
              </div>
            );`;
const generalCloseRep = `                  <VoiceRecorder 
                     renderMode="compact-button" 
                     onTranscript={(txt) => handleFieldChange("General", (fields.General ? fields.General + " " : "") + txt)} 
                   />
                </div>
              </div>
              </AccordionItem>
            );`;
code = code.replace(generalCloseFind, generalCloseRep);

const otherReturnFind = `          return (
          <div key={key} className="flex flex-col md:flex-row md:items-start gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 md:w-32 md:mt-2 shrink-0">
              {label}
            </label>`;
const otherReturnRep = `          return (
          <AccordionItem
            key={key}
            title={label}
            summary={summary}
            iconLetter={icon}
            isOpen={openSections[key]}
            onToggle={() => toggleSection(key)}
          >
          <div className="flex flex-col md:flex-row md:items-start gap-2">`;
code = code.replace(otherReturnFind, otherReturnRep);

const otherCloseFind = `              <VoiceRecorder 
                 renderMode="compact-button" 
                 onTranscript={(txt) => handleFieldChange(key as keyof typeof fields, (fields[key as keyof typeof fields] ? fields[key as keyof typeof fields] + " " : "") + txt)} 
               />
            </div>
          </div>
        )})}`;
const otherCloseRep = `              <VoiceRecorder 
                 renderMode="compact-button" 
                 onTranscript={(txt) => handleFieldChange(key as keyof typeof fields, (fields[key as keyof typeof fields] ? fields[key as keyof typeof fields] + " " : "") + txt)} 
               />
            </div>
          </div>
          </AccordionItem>
        )})}`;
code = code.replace(otherCloseFind, otherCloseRep);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
