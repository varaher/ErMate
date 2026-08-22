const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  'triggerNotification("Auto-Saved to Dashboard", `Voice case (${newCase.patient.name}) updated in Emergency Dashboard.`, "info");',
  'triggerNotification("Case Sheet Extracted", `Case sheet extracted and saved. Voice case (${newCase.patient.name}) updated in Emergency Dashboard.`, "info");'
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
