const fs = require('fs');
let content = fs.readFileSync('server/handover.ts', 'utf8');

content = content.replace(
  '"pastMedicalHistory": "string | null (Condensed, relevant comorbidities e.g. DM x 6y · HTN · CAD)",',
  '"pastMedicalHistory": "string | null (Extract ALL past medical history, comorbidities, and surgical history. If buried in the presenting complaint, extract it here. NEVER return null if PMH exists.)",'
);

content = content.replace(
  '"pmh": "string | null (Same as pastMedicalHistory)",',
  '"pmh": "string | null (Extract ALL past medical history, comorbidities, and surgical history. NEVER return null if PMH exists anywhere in the text)",'
);

content = content.replace(
  '"diagnosis": "string (Primary provisional diagnosis from IMP:)",',
  '"diagnosis": "string (Extract the FULL primary provisional diagnosis or assessment. DO NOT output generic placeholders like \\"Under evaluation\\" if clinical details or angiogram findings exist)",'
);

fs.writeFileSync('server/handover.ts', content, 'utf8');
