const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const szBad = `onChange={(v) => onChange("disability.seizure", v.toLowerCase().replace("-", ""))}
          />`;
const szGood = `onChange={(v) => onChange("disability.seizure", v.toLowerCase().replace("-", ""))}
          /></div>`;
code = code.replace(szBad, szGood);

const hypoBad = `onChange={(v) => onChange("exposure.hypothermiaPrevention", v !== "Not required")}
          />`;
const hypoGood = `onChange={(v) => onChange("exposure.hypothermiaPrevention", v !== "Not required")}
          /></div>`;
code = code.replace(hypoBad, hypoGood);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Fixed missing divs");
