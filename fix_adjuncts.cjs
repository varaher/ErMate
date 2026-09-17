const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

// ABG
const abgFind = `<AccordionItem
        title="ABG / VBG"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.abg}
        onToggle={() => toggleSection('abg')}
      >`;
const abgSummary = `[data.adjuncts?.abg?.interpretation, data.adjuncts?.abg?.finalDiagnosis]
          .filter(Boolean).join(" · ")`;

const abgRep = `<AccordionItem
        title="ABG / VBG"
        summary={${abgSummary}}
        iconLetter={<Activity className="w-4 h-4" />}
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.abg}
        onToggle={() => toggleSection('abg')}
      >`;

// ECG
const ecgFind = `<AccordionItem
        title="ECG"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.ecg}
        onToggle={() => toggleSection('ecg')}
      >`;
const ecgSummary = `[data.adjuncts?.ecgStatus]
          .filter(Boolean).join(" · ")`;

const ecgRep = `<AccordionItem
        title="ECG"
        summary={${ecgSummary}}
        iconLetter={<Heart className="w-4 h-4" />}
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.ecg}
        onToggle={() => toggleSection('ecg')}
      >`;

// EFAST
const efastFind = `<AccordionItem
        title="EFAST"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.efast}
        onToggle={() => toggleSection('efast')}
      >`;
const efastSummary = `[data.adjuncts?.efast]
          .filter(Boolean).join(" · ")`;

const efastRep = `<AccordionItem
        title="EFAST"
        summary={${efastSummary}}
        iconLetter={<Activity className="w-4 h-4" />}
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.efast}
        onToggle={() => toggleSection('efast')}
      >`;

// Bedside Echo
const echoFind = `<AccordionItem
        title="Bedside Echo"
        iconLetter="?"
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.bedsideEcho}
        onToggle={() => toggleSection('bedsideEcho')}
      >`;
const echoSummary = `[data.adjuncts?.bedsideEcho]
          .filter(Boolean).join(" · ")`;

const echoRep = `<AccordionItem
        title="Bedside Echo"
        summary={${echoSummary}}
        iconLetter={<Heart className="w-4 h-4" />}
        iconBgClass="bg-emerald-600"
        iconTextClass="text-emerald-600"
        isOpen={openSections.bedsideEcho}
        onToggle={() => toggleSection('bedsideEcho')}
      >`;


if(code.includes(abgFind)) code = code.replace(abgFind, abgRep);
if(code.includes(ecgFind)) code = code.replace(ecgFind, ecgRep);
if(code.includes(efastFind)) code = code.replace(efastFind, efastRep);
if(code.includes(echoFind)) code = code.replace(echoFind, echoRep);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Updated Adjuncts");
