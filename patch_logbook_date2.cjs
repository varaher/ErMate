const fs = require('fs');
let content = fs.readFileSync('server/routes/logbook.routes.ts', 'utf8');

const regexDateSeen = /      dateSeen: \(\(\) => \{\n        const potentialDates = \[caseData\.createdAt, caseData\.dateSeen, caseData\.arrivalDateTime\];\n        for \(const pd of potentialDates\) \{\n           if \(typeof pd === 'string' && pd\.includes\('T'\)\) \{\n             return pd\.split\('T'\)\[0\];\n           \}\n        \}\n        return now\.split\('T'\)\[0\]; \/\/ Safe stable fallback if no valid ISO date exists\n      \}\)\(\),/;

const newDateSeen = `      dateSeen: (() => {
        const potentialDates = [caseData.dateSeen, caseData.createdAt, caseData.arrivalDateTime];
        for (const pd of potentialDates) {
           if (typeof pd === 'string') {
             if (/^\\d{4}-\\d{2}-\\d{2}$/.test(pd)) {
               return pd;
             }
             if (pd.includes('T')) {
               const datePart = pd.split('T')[0];
               if (/^\\d{4}-\\d{2}-\\d{2}$/.test(datePart)) {
                 return datePart;
               }
             }
           }
        }
        return "unknown"; 
      })(),`;

if (content.match(regexDateSeen)) {
    content = content.replace(regexDateSeen, newDateSeen);
    fs.writeFileSync('server/routes/logbook.routes.ts', content);
    console.log("Patched dateSeen successfully");
} else {
    console.log("Could not find dateSeen regex!");
}
