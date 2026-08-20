const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const newWrapper = `
export function IsolatedPrimarySurveyAdjuncts({ data, onChange, onInterpretABG }: any) {
  const [openSections, setOpenSections] = React.useState({
    abg: true,
    ecg: true,
    efast: true,
    bedsideEcho: true
  });
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return <PrimarySurveyAdjuncts data={data} onChange={onChange} openSections={openSections} toggleSection={toggleSection} onInterpretABG={onInterpretABG} />;
}
`;

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code + '\n' + newWrapper);
