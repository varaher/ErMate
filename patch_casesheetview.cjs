const fs = require('fs');
let content = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");

content = content.replace(
  "onDiscussCase?: (patientCase: ClinicalCase) => void;\n}",
  "onDiscussCase?: (patientCase: ClinicalCase) => void;\n  onDeleteCase?: (caseId: string) => void;\n}"
);

content = content.replace(
  "  onDiscussCase,\n}: CaseSheetViewProps) {",
  "  onDiscussCase,\n  onDeleteCase,\n}: CaseSheetViewProps) {"
);

fs.writeFileSync("src/components/CaseSheetView.tsx", content);
