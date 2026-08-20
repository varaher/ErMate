const fs = require('fs');
let content = fs.readFileSync('src/utils/docxGenerator.ts', 'utf8');

const regex = /const abg = \[^;\]*;\s*let vbgParts = \[\];\s*if \(abg\.ph\).*?children\.push\(createLabeledLine\("VBG\/ABG", vbgParts\.length > 0 \? vbgParts\.join\(" \| "\) : "Not documented"\)\);/s;

const newVbg = `
  const abg = ((c.primaryAssessment as any)?.adjuncts)?.abgValues || ((c.primaryAssessment as any)?.adjuncts)?.vbgValues || {};
  let vbgRuns: any[] = [];
  
  const addVbgPart = (label: string, param: string, val: any) => {
    if (!val) return;
    const flag = getVitalsFlag(param, val);
    if (vbgRuns.length > 0) {
      vbgRuns.push(new TextRun({ text: " | " }));
    }
    vbgRuns.push(new TextRun({ text: \`\${label} \${flag.text}\`, color: flag.alert ? "DC2626" : "000000", bold: flag.alert }));
  };

  addVbgPart("pH", "ph", abg.ph);
  addVbgPart("pCO2", "pco2", abg.pco2);
  addVbgPart("HCO3", "hco3", abg.hco3);
  addVbgPart("Lactate", "lactate", abg.lactate);

  if (vbgRuns.length === 0) {
    children.push(createLabeledLine("VBG/ABG", "Not documented"));
  } else {
    children.push(new Paragraph({
      spacing: { line: 360 },
      children: [
        new TextRun({ text: "VBG/ABG: ", bold: true }),
        ...vbgRuns
      ]
    }));
  }
`;

content = content.replace(regex, newVbg.trim());
fs.writeFileSync('src/utils/docxGenerator.ts', content);
