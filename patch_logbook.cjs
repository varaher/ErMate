const fs = require('fs');
let content = fs.readFileSync('server/routes/logbook.routes.ts', 'utf8');

const regexIsAttributed = /    let isAttributedDoctor = false;\n    if \(caseData\.createdByUid === uid\) \{\n      isAttributedDoctor = true;\n    \} else if \(caseData\.doctorEmail && userEmail && caseData\.doctorEmail\.toLowerCase\(\)\.trim\(\) === userEmail\) \{\n      isAttributedDoctor = true;\n    \}/;

const newIsAttributed = `    let isAttributedDoctor = false;
    if (caseData.createdByUid === uid) {
      isAttributedDoctor = true;
    } else if (!caseData.createdByUid && caseData.doctorEmail && userEmail && caseData.doctorEmail.toLowerCase().trim() === userEmail) {
      isAttributedDoctor = true;
    }`;

content = content.replace(regexIsAttributed, newIsAttributed);

const regexAgeGroup = /      dateSeen: caseData\.savedTime \? caseData\.savedTime\.split\("T"\)\[0\] : caseData\.arrivalDateTime\?\.split\("T"\)\[0\] \|\| null,\n      ageGroup: caseData\.isPediatric \? "pediatric" : "adult", \/\/ Rule 7/;

const newAgeGroup = `      // Extract just the date
      dateSeen: (caseData.dateSeen || caseData.patient?.dateOpened || caseData.savedTime || caseData.arrivalDateTime || now).split("T")[0],
      ageGroup: (() => {
        if (caseData.patient?.age != null && caseData.patient?.age !== "") {
          const age = parseInt(caseData.patient.age, 10);
          if (!isNaN(age)) {
            return age <= 16 ? "pediatric" : "adult";
          }
        }
        return "unknown";
      })(),`;

content = content.replace(regexAgeGroup, newAgeGroup);

fs.writeFileSync('server/routes/logbook.routes.ts', content);
