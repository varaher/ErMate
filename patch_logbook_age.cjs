const fs = require('fs');
let content = fs.readFileSync('server/routes/logbook.routes.ts', 'utf8');

const regexAge = /      ageGroup: \(\(\) => \{\n        if \(caseData\.patient\?\.age != null && caseData\.patient\?\.age !== ""\) \{\n          const age = parseInt\(caseData\.patient\.age, 10\);\n          if \(!isNaN\(age\)\) \{\n            return age <= 16 \? "pediatric" : "adult";\n          \}\n        \}\n        return "unknown";\n      \}\)\(\),/;

const newAge = `      ageGroup: (() => {
        if (caseData.patient?.age != null && caseData.patient?.age !== "") {
          const ageStr = String(caseData.patient.age).toLowerCase();
          if (ageStr.includes('month') || ageStr.includes('day') || ageStr.includes('week') || ageStr.includes('hr') || ageStr.includes('hour')) {
            return "pediatric";
          }
          const age = parseInt(ageStr, 10);
          if (!isNaN(age)) {
            return age <= 16 ? "pediatric" : "adult";
          }
        }
        return "unknown";
      })(),`;

content = content.replace(regexAge, newAge);
fs.writeFileSync('server/routes/logbook.routes.ts', content);
