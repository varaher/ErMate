sed -i 's/const { formattedAssessment, alertsList: invAlerts, planDoneLabsText } = extractChronologicalInvestigationsAndAlerts(/const { formattedAssessment, alertsList: invAlerts, planDoneLabsText, fullInvText: invsFullText } = extractChronologicalInvestigationsAndAlerts(/g' src/components/HandoverView.tsx
sed -i 's/\/\/ Re-fetch the fullInvText using the modified destructured return//g' src/components/HandoverView.tsx
sed -i 's/const fullInv = extractChronologicalInvestigationsAndAlerts.*/if (invsFullText) doneParts.push(`\\n${invsFullText}`);/g' src/components/HandoverView.tsx
