const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

// Airway
const airwayFind = `<AccordionItem
        title="A - AIRWAY"
        iconLetter="?"
        iconBgClass="bg-red-500"
        iconTextClass="text-red-500"
        isOpen={openSections.airway}
        onToggle={() => toggleSection('airway')}
      >`;
const airwaySummary = `[data.airway?.status ? data.airway.status.charAt(0).toUpperCase() + data.airway.status.slice(1) : ""]
          .filter(Boolean).join(" · ")`;

const airwayRep = `<AccordionItem
        title="A - AIRWAY"
        summary={${airwaySummary}}
        iconLetter="A"
        iconBgClass="bg-red-500"
        iconTextClass="text-red-500"
        isOpen={openSections.airway}
        onToggle={() => toggleSection('airway')}
      >`;
if (code.includes(airwayFind)) {
    code = code.replace(airwayFind, airwayRep);
    console.log("Airway updated");
}

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
