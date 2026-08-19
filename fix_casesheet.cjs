const fs = require('fs');

function fixFile(filename) {
  if (!fs.existsSync(filename)) return;
  let content = fs.readFileSync(filename, 'utf-8');

  // Replace hardcoded Adjuvants
  const adjuvantsReplace = 
`**Adjuvants to Primary:**
- **ECG:** \${currentCase.primaryAssessment.survey?.circulation?.ecg || currentCase.primaryAssessment.adjuvantsEcg || "Normal sinus rhythm, no acute ST-T changes."}
- **VBG/ABG:** \${currentCase.primaryAssessment.adjuvantsVbg || currentCase.primaryAssessment.adjuvantsAbg || "Not done."}
- **Bedside Echo / EFAST:** \${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : currentCase.primaryAssessment.adjuvantsEcho || "Not done."}`;

  content = content.replace(
    /\*\*Adjuvants to Primary:\*\*[\s\S]*?\*\*Bedside Echo:[^\n]*/,
    adjuvantsReplace
  );

  // HTML version
  const htmlAdjuvantsReplace = 
`<strong>Adjuvants to Primary:</strong>
<ul>
  <li><strong>ECG:</strong> \${currentCase.primaryAssessment.survey?.circulation?.ecg || currentCase.primaryAssessment.adjuvantsEcg || "Normal sinus rhythm, no acute ST-T changes."}</li>
  <li><strong>VBG/ABG:</strong> \${currentCase.primaryAssessment.adjuvantsVbg || currentCase.primaryAssessment.adjuvantsAbg || "Not done."}</li>
  <li><strong>Bedside Echo / EFAST:</strong> \${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : currentCase.primaryAssessment.adjuvantsEcho || "Not done."}</li>
</ul>`;

  content = content.replace(
    /<strong>Adjuvants to Primary:<\/strong>[\s\S]*?<li><strong>Bedside Echo:<\/strong>[^\n]*/,
    htmlAdjuvantsReplace
  );

  // Psych assessment
  const psychReplace =
`- **Psychological Assessment:**
  - **Persistent low mood/anxiety/anger/focus issues:** \${currentCase.psychAssessment?.lowMood || "No."}
  - **Hallucinations/restlessness/hyper-energy:** \${currentCase.psychAssessment?.hallucinations || "No."}
  - **Alcohol/tobacco/substance use:** \${currentCase.psychAssessment?.substanceUse || "No."}
  - **Confusion/agitation:** \${currentCase.psychAssessment?.confusion || "No."}
  - **Suicidal thoughts/self-harm:** \${currentCase.psychAssessment?.suicidal || "No."}
  - **Prior mental health treatment:** \${currentCase.psychAssessment?.priorTreatment || "No."}
  - **Additional Observations:** \${currentCase.psychAssessment?.observations || "Nil"}`;

  content = content.replace(
    /- \*\*Psychological Assessment:\*\*[\s\S]*?- \*\*Additional Observations:\*\* Nil/,
    psychReplace
  );
  
  // HTML version of Psych
  const htmlPsychReplace = 
`<strong>Psychological Assessment:</strong>
<ul>
  <li><strong>Low mood/anxiety:</strong> \${currentCase.psychAssessment?.lowMood || "No."}</li>
  <li><strong>Hallucinations/restlessness:</strong> \${currentCase.psychAssessment?.hallucinations || "No."}</li>
  <li><strong>Substance use:</strong> \${currentCase.psychAssessment?.substanceUse || "No."}</li>
  <li><strong>Confusion/agitation:</strong> \${currentCase.psychAssessment?.confusion || "No."}</li>
  <li><strong>Suicidal thoughts:</strong> \${currentCase.psychAssessment?.suicidal || "No."}</li>
  <li><strong>Prior treatment:</strong> \${currentCase.psychAssessment?.priorTreatment || "No."}</li>
  <li><strong>Observations:</strong> \${currentCase.psychAssessment?.observations || "Nil"}</li>
</ul>`;

  content = content.replace(
    /<strong>Psychological Assessment:<\/strong>[\s\S]*?<li><strong>Prior mental health treatment:<\/strong> No\.<\/li>[\s\S]*?<li><strong>Additional Observations:<\/strong> Nil<\/li>\s*<\/ul>/,
    htmlPsychReplace
  );
  
  // Also fix treatments, infusions, investigations
  content = content.replace(
    /\*\*Investigations Ordered:\*\*[\s\S]*?\*\*Progress Notes:\*\*/,
    `**Investigations Ordered:**\n\${investigationsText}\n**Treatments & Medications:**\n\${treatmentsText}\n**Infusions:**\n\${infusionsText}\n**Procedures:**\n\${proceduresText}\n\n**Progress Notes:**`
  );

  fs.writeFileSync(filename, content);
}

fixFile('src/components/CaseSheetView.tsx');
fixFile('src/components/DashboardView.tsx');

