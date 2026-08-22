const fs = require('fs');
let content = fs.readFileSync("src/components/CasesListView.tsx", "utf8");

content = content.replace(
  "onDiscussCase?: (patientCase: ClinicalCase) => void;",
  "onDiscussCase?: (patientCase: ClinicalCase) => void;\n  onDeleteAllCases?: () => void;"
);

content = content.replace(
  "onDiscussCase,\n}: CasesListViewProps) {",
  "onDiscussCase,\n  onDeleteAllCases,\n}: CasesListViewProps) {"
);

fs.writeFileSync("src/components/CasesListView.tsx", content);
