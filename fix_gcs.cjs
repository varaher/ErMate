const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const gcsFind = `<AccordionItem
        title="D - DISABILITY"
        summary={[(data.disability?.gcs?.total || vitals?.gcs) ? \`GCS \${data.disability?.gcs?.total || vitals?.gcs}\` : ""]
          .filter(Boolean).join(" · ")}
        iconLetter="D"`;

const gcsRep = `<AccordionItem
        title="D - DISABILITY"
        summary={[(data.disability?.gcsTotal || vitals?.gcs) ? \`GCS \${data.disability?.gcsTotal || vitals?.gcs}\` : ""]
          .filter(Boolean).join(" · ")}
        iconLetter="D"`;

if(code.includes(gcsFind)) {
  code = code.replace(gcsFind, gcsRep);
  fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
  console.log("Fixed GCS summary field");
}

