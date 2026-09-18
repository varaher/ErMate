const fs = require('fs');
let content = fs.readFileSync('server/routes/logbook.routes.ts', 'utf8');

const regexDateSeen = /      \/\/ Extract just the date\n      dateSeen: \(caseData\.dateSeen \|\| caseData\.patient\?\.dateOpened \|\| caseData\.savedTime \|\| caseData\.arrivalDateTime \|\| now\)\.split\("T"\)\[0\],/;

const newDateSeen = `      // Extract just the date
      dateSeen: (() => {
        const potentialDates = [caseData.createdAt, caseData.dateSeen, caseData.arrivalDateTime];
        for (const pd of potentialDates) {
           if (typeof pd === 'string' && pd.includes('T')) {
             return pd.split('T')[0];
           }
        }
        return now.split('T')[0]; // Safe stable fallback if no valid ISO date exists
      })(),`;

content = content.replace(regexDateSeen, newDateSeen);
fs.writeFileSync('server/routes/logbook.routes.ts', content);
