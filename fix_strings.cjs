const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

code = code.replace(
  'secondaryAssessment: (prev.secondaryAssessment || "") + "\\n\\n" + preset.text',
  'secondaryAssessment: (prev.secondaryAssessment || "") + "\\n\\n" + preset.text'
);
// Wait, the string in the file actually contains a literal newline.
// It's like:
// secondaryAssessment: (prev.secondaryAssessment || "") + "
// 
// " + preset.text

code = code.replace(/\(prev\.secondaryAssessment \|\| ""\) \+ "\n\n" \+ preset\.text/g, '(prev.secondaryAssessment || "") + "\\n\\n" + preset.text');
code = code.replace(/\[gen, cns, cvs, rs, pa, ext\]\.join\("\n\n"\)/g, '[gen, cns, cvs, rs, pa, ext].join("\\n\\n")');

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
