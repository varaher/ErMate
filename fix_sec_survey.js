const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

code = code.replace(
  'import { CheckCircle } from "lucide-react";',
  'import { CheckCircle, Activity } from "lucide-react";\nimport { AccordionItem } from "./PrimarySurveySection";'
);

// We need to add local state for accordions
const stateFind = `  const systems = [`;
const stateRep = `  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
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

  const systems = [`;
code = code.replace(stateFind, stateRep);

// Replace the loop
const mapFind = `{systems.map(({ key, label }) => {`;
const mapRep = `{systems.map(({ key, label }) => {
          const val = fields[key as keyof typeof fields];
          const summary = val ? (val.length > 30 ? val.substring(0, 30) + '...' : val) : '';`;
code = code.replace(mapFind, mapRep);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
