const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const expFind = `<AccordionItem
        title="E - EXPOSURE"
        iconLetter="?"
        iconBgClass="bg-blue-500"
        iconTextClass="text-blue-500"
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
      >`;
const expSummary = `[(data.exposure?.temp || vitals?.temp) ? \`Temp \${data.exposure?.temp || vitals?.temp}°C\` : ""]
          .filter(Boolean).join(" · ")`;

const expRep = `<AccordionItem
        title="E - EXPOSURE"
        summary={${expSummary}}
        iconLetter="E"
        iconBgClass="bg-blue-500"
        iconTextClass="text-blue-500"
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
      >`;

code = code.replace(expFind, expRep);
fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Exposure updated");
