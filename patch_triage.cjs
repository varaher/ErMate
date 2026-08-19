const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
/m => m\.email\.toLowerCase\(\)\.trim\(\) === profile\.email\.toLowerCase\(\)\.trim\(\)/g,
'm => (m.email || "").toLowerCase().trim() === (profile.email || "").toLowerCase().trim()'
);

content = content.replace(
/m => \(m\.role\.toLowerCase\(\)\.includes\("consultant"\) \|\| m\.role\.toLowerCase\(\)\.includes\("hod"\) \|\| m\.role\.toLowerCase\(\)\.includes\("lead"\)\) && m\.shift === activeUserShiftId/g,
'm => ((m.role || "").toLowerCase().includes("consultant") || (m.role || "").toLowerCase().includes("hod") || (m.role || "").toLowerCase().includes("lead")) && m.shift === activeUserShiftId'
);

content = content.replace(
/const createdByRoleVal = profile\.role\.toLowerCase\(\)\.includes\("hod"\) \? "hod" : \(profile\.role\.toLowerCase\(\)\.includes\("consultant"\) \? "consultant" : "resident"\);/g,
'const createdByRoleVal = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");'
);

fs.writeFileSync('src/App.tsx', content);
