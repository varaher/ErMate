const fs = require('fs');
let content = fs.readFileSync("src/components/DashboardView.tsx", "utf8");

content = content.replace(
  "onDeleteAllCases?: () => void;",
  "onDeleteAllCases?: () => void;\n  onDeleteCase?: (caseId: string) => void;"
);

content = content.replace(
  "onDeleteAllCases,\n  onStartVoiceScribe",
  "onDeleteAllCases,\n  onDeleteCase,\n  onStartVoiceScribe"
);

fs.writeFileSync("src/components/DashboardView.tsx", content);
