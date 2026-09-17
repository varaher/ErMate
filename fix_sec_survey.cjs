const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

code = code.replace(
  'import { CheckCircle } from "lucide-react";',
  'import { CheckCircle, Activity, Heart, Brain, Stethoscope, User, Footprints } from "lucide-react";\nimport { AccordionItem } from "./PrimarySurveySection";'
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

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
