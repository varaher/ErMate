const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

// Breathing
const breathFind = `<AccordionItem
        title="B - BREATHING"
        iconLetter="?"
        iconBgClass="bg-orange-500"
        iconTextClass="text-orange-500"
        isOpen={openSections.breathing}
        onToggle={() => toggleSection('breathing')}
      >`;
const breathSummary = `[(data.breathing?.rr || vitals?.rr) ? \`RR \${data.breathing?.rr || vitals?.rr}\` : "", 
          (data.breathing?.spo2 || vitals?.spo2) ? \`SpO₂ \${data.breathing?.spo2 || vitals?.spo2}%\` : ""]
          .filter(Boolean).join(" · ")`;

const breathRep = `<AccordionItem
        title="B - BREATHING"
        summary={${breathSummary}}
        iconLetter="B"
        iconBgClass="bg-orange-500"
        iconTextClass="text-orange-500"
        isOpen={openSections.breathing}
        onToggle={() => toggleSection('breathing')}
      >`;

// Circulation
const circFind = `<AccordionItem
        title="C - CIRCULATION"
        iconLetter="?"
        iconBgClass="bg-amber-500"
        iconTextClass="text-amber-500"
        isOpen={openSections.circulation}
        onToggle={() => toggleSection('circulation')}
      >`;
const circSummary = `[(data.circulation?.hr || vitals?.hr) ? \`HR \${data.circulation?.hr || vitals?.hr}\` : "", 
          ((data.circulation?.sbp && data.circulation?.dbp) || vitals?.bp) ? \`BP \${vitals?.bp || \`\${data.circulation?.sbp}/\${data.circulation?.dbp}\`}\` : ""]
          .filter(Boolean).join(" · ")`;

const circRep = `<AccordionItem
        title="C - CIRCULATION"
        summary={${circSummary}}
        iconLetter="C"
        iconBgClass="bg-amber-500"
        iconTextClass="text-amber-500"
        isOpen={openSections.circulation}
        onToggle={() => toggleSection('circulation')}
      >`;

// Disability
const disFind = `<AccordionItem
        title="D - DISABILITY"
        iconLetter="?"
        iconBgClass="bg-indigo-500"
        iconTextClass="text-indigo-500"
        isOpen={openSections.disability}
        onToggle={() => toggleSection('disability')}
      >`;
const disSummary = `[(data.disability?.gcs?.total || vitals?.gcs) ? \`GCS \${data.disability?.gcs?.total || vitals?.gcs}\` : ""]
          .filter(Boolean).join(" · ")`;

const disRep = `<AccordionItem
        title="D - DISABILITY"
        summary={${disSummary}}
        iconLetter="D"
        iconBgClass="bg-indigo-500"
        iconTextClass="text-indigo-500"
        isOpen={openSections.disability}
        onToggle={() => toggleSection('disability')}
      >`;

// Exposure
const expFind = `<AccordionItem
        title="E - EXPOSURE"
        iconLetter="?"
        iconBgClass="bg-slate-500"
        iconTextClass="text-slate-500"
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
      >`;
const expSummary = `[(data.exposure?.temp || vitals?.temp) ? \`Temp \${data.exposure?.temp || vitals?.temp}°C\` : ""]
          .filter(Boolean).join(" · ")`;

const expRep = `<AccordionItem
        title="E - EXPOSURE"
        summary={${expSummary}}
        iconLetter="E"
        iconBgClass="bg-slate-500"
        iconTextClass="text-slate-500"
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
      >`;


if (code.includes(breathFind)) code = code.replace(breathFind, breathRep);
if (code.includes(circFind)) code = code.replace(circFind, circRep);
if (code.includes(disFind)) code = code.replace(disFind, disRep);
if (code.includes(expFind)) code = code.replace(expFind, expRep);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Updated BCDE");
