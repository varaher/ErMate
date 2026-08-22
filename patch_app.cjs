const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetSampleHistory = `      sampleHistory: {
        symptoms: extracted.sampleHistory?.symptoms || (Array.isArray(extracted.symptoms) ? extracted.symptoms.join(", ") : extracted.symptoms) || existingMatch?.sampleHistory.symptoms || "",
        allergies: extracted.sampleHistory?.allergies || existingMatch?.sampleHistory.allergies || "",
        medications: extracted.sampleHistory?.medications || existingMatch?.sampleHistory.medications || "",
        pastHistory: extracted.sampleHistory?.pastHistory || existingMatch?.sampleHistory.pastHistory || "",
        lastMeal: extracted.sampleHistory?.lastMeal || existingMatch?.sampleHistory.lastMeal || "",
        events: extracted.sampleHistory?.events || existingMatch?.sampleHistory.events || "",
        socialHistory: extracted.sampleHistory?.socialHistory || existingMatch?.sampleHistory?.socialHistory || "",
        familyHistory: extracted.sampleHistory?.familyHistory || existingMatch?.sampleHistory?.familyHistory || "",
        psychiatricFlags: extracted.sampleHistory?.psychiatricFlags || existingMatch?.sampleHistory?.psychiatricFlags || ""
      },`;

const replacementSampleHistory = `      sampleHistory: {
        symptoms: extracted.sampleHistory?.symptoms || (Array.isArray(extracted.symptoms) ? extracted.symptoms.join(", ") : extracted.symptoms) || existingMatch?.sampleHistory.symptoms || "",
        allergies: extracted.sampleHistory?.allergies || extracted.allergies || existingMatch?.sampleHistory.allergies || "",
        medications: extracted.sampleHistory?.medications || extracted.medications || existingMatch?.sampleHistory.medications || "",
        pastHistory: extracted.sampleHistory?.pastHistory || extracted.pastMedicalHistory || extracted.pastHistory || existingMatch?.sampleHistory.pastHistory || "",
        lastMeal: extracted.sampleHistory?.lastMeal || extracted.lastMeal || existingMatch?.sampleHistory.lastMeal || "",
        events: extracted.sampleHistory?.events || extracted.events || existingMatch?.sampleHistory.events || "",
        socialHistory: extracted.sampleHistory?.socialHistory || extracted.socialHistory || existingMatch?.sampleHistory?.socialHistory || "",
        familyHistory: extracted.sampleHistory?.familyHistory || extracted.familyHistory || existingMatch?.sampleHistory?.familyHistory || "",
        psychiatricFlags: extracted.sampleHistory?.psychiatricFlags || extracted.psychiatricFlags || existingMatch?.sampleHistory?.psychiatricFlags || ""
      },`;

const targetPrimaryAssessment = `      primaryAssessment: {
        ...(existingMatch?.primaryAssessment || {}),
        ...(extracted.primaryAssessment || {}),
        airway: extracted.primaryAssessment?.airway || existingMatch?.primaryAssessment.airway || "",
        airwayStatus: extracted.primaryAssessment?.airwayStatus || existingMatch?.primaryAssessment.airwayStatus || "Normal",
        breathing: extracted.primaryAssessment?.breathing || existingMatch?.primaryAssessment.breathing || "",
        breathingStatus: extracted.primaryAssessment?.breathingStatus || existingMatch?.primaryAssessment.breathingStatus || "Normal",
        circulation: extracted.primaryAssessment?.circulation || existingMatch?.primaryAssessment.circulation || "",
        circulationStatus: extracted.primaryAssessment?.circulationStatus || existingMatch?.primaryAssessment.circulationStatus || "Normal",
        disability: extracted.primaryAssessment?.disability || existingMatch?.primaryAssessment.disability || "",
        disabilityStatus: extracted.primaryAssessment?.disabilityStatus || existingMatch?.primaryAssessment.disabilityStatus || "Normal",
        exposure: extracted.primaryAssessment?.exposure || existingMatch?.primaryAssessment.exposure || "",
        exposureStatus: extracted.primaryAssessment?.exposureStatus || existingMatch?.primaryAssessment.exposureStatus || "Normal"
      },
      secondaryAssessment: extracted.secondaryAssessment || existingMatch?.secondaryAssessment || "",`;

const replacementPrimaryAssessment = `      primaryAssessment: {
        ...(existingMatch?.primaryAssessment || {}),
        ...(extracted.primaryAssessment || {}),
        airway: extracted.primaryAssessment?.airway || extracted.airway || existingMatch?.primaryAssessment.airway || "",
        airwayStatus: extracted.primaryAssessment?.airwayStatus || extracted.airwayStatus || existingMatch?.primaryAssessment.airwayStatus || "Normal",
        breathing: extracted.primaryAssessment?.breathing || extracted.breathing || existingMatch?.primaryAssessment.breathing || "",
        breathingStatus: extracted.primaryAssessment?.breathingStatus || extracted.breathingStatus || existingMatch?.primaryAssessment.breathingStatus || "Normal",
        circulation: extracted.primaryAssessment?.circulation || extracted.circulation || existingMatch?.primaryAssessment.circulation || "",
        circulationStatus: extracted.primaryAssessment?.circulationStatus || extracted.circulationStatus || existingMatch?.primaryAssessment.circulationStatus || "Normal",
        disability: extracted.primaryAssessment?.disability || extracted.disability || existingMatch?.primaryAssessment.disability || "",
        disabilityStatus: extracted.primaryAssessment?.disabilityStatus || extracted.disabilityStatus || existingMatch?.primaryAssessment.disabilityStatus || "Normal",
        exposure: extracted.primaryAssessment?.exposure || extracted.exposure || existingMatch?.primaryAssessment.exposure || "",
        exposureStatus: extracted.primaryAssessment?.exposureStatus || extracted.exposureStatus || existingMatch?.primaryAssessment.exposureStatus || "Normal"
      },
      secondaryAssessment: extracted.secondaryAssessment || (extracted.secondarySurvey ? Object.entries(extracted.secondarySurvey).map(([k,v]) => \`\${k.toUpperCase()}: \${v}\`).join("\\n") : null) || existingMatch?.secondaryAssessment || "",`;

if (content.includes(targetSampleHistory)) {
  content = content.replace(targetSampleHistory, replacementSampleHistory);
  console.log("Updated sampleHistory");
} else {
  console.log("Failed to find sampleHistory");
}

if (content.includes(targetPrimaryAssessment)) {
  content = content.replace(targetPrimaryAssessment, replacementPrimaryAssessment);
  console.log("Updated primaryAssessment");
} else {
  console.log("Failed to find primaryAssessment");
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
