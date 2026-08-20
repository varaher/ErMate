const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const startIdx = code.indexOf('<h3 className="text-lg text-slate-800 dark:text-slate-200 mt-6 mb-3 px-1">Adjuncts to Primary Survey</h3>');
const endIdx = code.lastIndexOf('</div>');

const adjunctsCode = code.substring(startIdx, endIdx);

const newComponent = `
export function PrimarySurveyAdjuncts({ data, onChange, openSections, toggleSection, onInterpretABG }: any) {
  return (
    <>
      ${adjunctsCode}
    </>
  );
}
`;

const modifiedCode = code.substring(0, startIdx) + 
`<PrimarySurveyAdjuncts data={data} onChange={onChange} openSections={openSections} toggleSection={toggleSection} onInterpretABG={onInterpretABG} />\n` + 
code.substring(endIdx);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', newComponent + '\n\n' + modifiedCode);
