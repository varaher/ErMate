const fs = require('fs');
let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(
  "onNavigateToTab={navigateToTab}",
  "onNavigateToTab={navigateToTab}\n                  onDeleteAllCases={handleDeleteAllCases}"
);

fs.writeFileSync("src/App.tsx", content);
