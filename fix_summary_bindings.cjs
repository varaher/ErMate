const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const efastFind = `[data.adjuncts?.efast]`;
const efastRep = `[data.adjuncts?.efastStatus]`;

const echoFind = `[data.adjuncts?.bedsideEcho]`;
const echoRep = `[data.adjuncts?.echoStatus]`;

if(code.includes(efastFind)) code = code.replace(efastFind, efastRep);
if(code.includes(echoFind)) code = code.replace(echoFind, echoRep);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Summary properties fixed");
