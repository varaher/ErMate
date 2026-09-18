const fs = require('fs');

let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

// Replace state definition
content = content.replace(
  'const [hospitalName, setHospitalName] = useState<string>(profile.hospital || "");',
  'const [workplaceName, setWorkplaceName] = useState<string>(profile.workplaceName || profile.hospital || "");'
);

// Replace handleSaveProfileForm assignment
content = content.replace(
  '      hospital: hospitalName,',
  '      workplaceName: workplaceName,'
);

// Replace JSX references from hospitalName to workplaceName
content = content.replace(/hospitalName/g, 'workplaceName');
content = content.replace(/setHospitalName/g, 'setWorkplaceName');

fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
