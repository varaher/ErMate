const fs = require('fs');
let content = fs.readFileSync('server/routes/extraction.routes.ts', 'utf8');

content = content.replace(
  '"Situation (S): Bed/room, age/gender, and provisional diagnosis."',
  '"Situation (S): Bed/room, age/gender, and FULL provisional diagnosis. Do not use generic placeholders like \'Under evaluation\'."'
);

content = content.replace(
  '"Background (B): Comorbidities and past medical history."',
  '"Background (B): Extract ALL details of comorbidities, past medical history, and surgical history. NEVER return \'No background parsed\'."'
);

fs.writeFileSync('server/routes/extraction.routes.ts', content, 'utf8');
