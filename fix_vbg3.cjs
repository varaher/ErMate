const fs = require('fs');
let content = fs.readFileSync('src/utils/docxGenerator.ts', 'utf8');

const sIdx = content.indexOf('const abg = adj.abgValues || adj.vbgValues || {};');
const eIdx = content.indexOf('children.push(new Paragraph(""));\n  // SECTION 4 - INVESTIGATIONS');
if (sIdx !== -1 && eIdx !== -1) {
  const newVbg = `const abg = adj.abgValues || adj.vbgValues || {};
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
  content = content.substring(0, sIdx) + newVbg + content.substring(eIdx);
  fs.writeFileSync('src/utils/docxGenerator.ts', content);
} else {
  console.log("NOT FOUND", sIdx, eIdx);
}
