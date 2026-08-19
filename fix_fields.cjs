const fs = require('fs');

// Fix CaseSheetView
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

// Adjuvants
content = content.replace(
  /\*\*Adjuvants to Primary:\*\*[\s\S]*?\*\*Bedside Echo \/ EFAST:[^\n]*/g,
  `**Adjuvants to Primary:**\n- **ECG:** \${currentCase.primaryAssessment.survey?.circulation?.ecg || "Normal sinus rhythm, no acute ST-T changes."}\n- **VBG/ABG:** Not done.\n- **Bedside Echo / EFAST:** \${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : "Not done."}`
);

// HTML Adjuvants
content = content.replace(
  /<strong>Adjuvants to Primary:<\/strong>[\s\S]*?<li><strong>Bedside Echo \/ EFAST:<\/strong>[^\n]*<\/li>\n<\/ul>/g,
  `<strong>Adjuvants to Primary:</strong>\n<ul>\n  <li><strong>ECG:</strong> \${currentCase.primaryAssessment.survey?.circulation?.ecg || "Normal sinus rhythm, no acute ST-T changes."}</li>\n  <li><strong>VBG/ABG:</strong> Not done.</li>\n  <li><strong>Bedside Echo / EFAST:</strong> \${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : "Not done."}</li>\n</ul>`
);

// Psych
content = content.replace(
  /- \*\*Psychological Assessment:\*\*[\s\S]*?- \*\*Additional Observations:[^\n]*/g,
  `- **Psychological Assessment:**
  - **Suicidal Ideation:** \${currentCase.psychologicalAssessment?.suicidalIdeation ? "YES ⚠️" : "No."}
  - **Self-Harm History:** \${currentCase.psychologicalAssessment?.selfHarmHistory ? "YES ⚠️" : "No."}
  - **Intent to Harm Others:** \${currentCase.psychologicalAssessment?.intentToHarmOthers ? "YES ⚠️" : "No."}
  - **Substance Abuse:** \${currentCase.psychologicalAssessment?.substanceAbuse ? "Yes." : "No."}
  - **Psychiatric History:** \${currentCase.psychologicalAssessment?.psychiatricHistory ? "Yes." : "No."}
  - **Prior mental health treatment:** \${currentCase.psychologicalAssessment?.currentlyOnPsychiatricTreatment ? "Yes." : "No."}
  - **Additional Observations:** \${currentCase.psychologicalAssessment?.notes || "Nil"}`
);

content = content.replace(
  /<strong>Psychological Assessment:<\/strong>[\s\S]*?<li><strong>Observations:<\/strong>[^\n]*<\/li>\n<\/ul>/g,
  `<strong>Psychological Assessment:</strong>\n<ul>\n  <li><strong>Suicidal Ideation:</strong> \${currentCase.psychologicalAssessment?.suicidalIdeation ? "YES ⚠️" : "No."}</li>\n  <li><strong>Self-Harm History:</strong> \${currentCase.psychologicalAssessment?.selfHarmHistory ? "YES ⚠️" : "No."}</li>\n  <li><strong>Intent to Harm Others:</strong> \${currentCase.psychologicalAssessment?.intentToHarmOthers ? "YES ⚠️" : "No."}</li>\n  <li><strong>Substance Abuse:</strong> \${currentCase.psychologicalAssessment?.substanceAbuse ? "Yes." : "No."}</li>\n  <li><strong>Psychiatric History:</strong> \${currentCase.psychologicalAssessment?.psychiatricHistory ? "Yes." : "No."}</li>\n  <li><strong>Prior treatment:</strong> \${currentCase.psychologicalAssessment?.currentlyOnPsychiatricTreatment ? "Yes." : "No."}</li>\n  <li><strong>Observations:</strong> \${currentCase.psychologicalAssessment?.notes || "Nil"}</li>\n</ul>`
);

fs.writeFileSync('src/components/CaseSheetView.tsx', content);

