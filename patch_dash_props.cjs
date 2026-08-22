const fs = require('fs');
let content = fs.readFileSync("src/components/DashboardView.tsx", "utf8");

content = content.replace(
  "onStartDischargeSummary?: () => void;",
  "onStartDischargeSummary?: () => void;\n  onDeleteAllCases?: () => void;"
);

content = content.replace(
  "onStartDischargeSummary,\n  onStartVoiceScribe",
  "onStartDischargeSummary,\n  onDeleteAllCases,\n  onStartVoiceScribe"
);

fs.writeFileSync("src/components/DashboardView.tsx", content);
