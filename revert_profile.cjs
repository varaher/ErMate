const fs = require('fs');

let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

content = content.replace(/workplaceName/g, 'hospitalName');
content = content.replace(/setWorkplaceName/g, 'setHospitalName');

fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
