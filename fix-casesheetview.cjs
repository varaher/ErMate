const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const replaceBlock = `<SecondarySurveySection
                secondaryAssessment={currentCase.secondaryAssessment || ""}
                onChange={(val) => setCurrentCase(prev => ({ ...prev, secondaryAssessment: val }))}
                onMarkNormal={markSecondarySurveyNormal}
              />`;

const fixedBlock = `<div className="space-y-4">
              <SecondarySurveySection
                secondaryAssessment={currentCase.secondaryAssessment || ""}
                onChange={(val) => setCurrentCase(prev => ({ ...prev, secondaryAssessment: val }))}
                onMarkNormal={markSecondarySurveyNormal}
              />`;

code = code.replace(replaceBlock, fixedBlock);
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
