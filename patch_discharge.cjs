const fs = require('fs');
let content = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");

content = content.replace(
  "profile?: UserProfile;\n}",
  "profile?: UserProfile;\n  onDeleteCase?: (caseId: string) => void;\n}"
);

content = content.replace(
  "  onSaveDischarge,\n  profile,\n}: DischargeSummaryViewProps) {",
  "  onSaveDischarge,\n  profile,\n  onDeleteCase,\n}: DischargeSummaryViewProps) {"
);

fs.writeFileSync("src/components/DischargeSummaryView.tsx", content);
console.log("Patched DischargeSummaryView props");
