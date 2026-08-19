const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
/profile\.name\.startsWith\("Dr\. "\) \? profile\.name : "Dr\. " \+ profile\.name/g,
'(profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor")'
);

content = content.replace(
/profile\.role\.toLowerCase\(\)\.includes\("hod"\) \? "hod" : \(profile\.role\.toLowerCase\(\)\.includes\("consultant"\) \? "consultant" : "resident"\)/g,
'(profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident")'
);

fs.writeFileSync('src/App.tsx', content);
