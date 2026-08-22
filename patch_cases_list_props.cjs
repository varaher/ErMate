const fs = require('fs');
let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(
  "onNavigateToTab={navigateToTab}\n                  onDiscussCase={(c) => setDiscussionModalCase(c)}",
  "onNavigateToTab={navigateToTab}\n                  onDeleteAllCases={handleDeleteAllCases}\n                  onDiscussCase={(c) => setDiscussionModalCase(c)}"
);

fs.writeFileSync("src/App.tsx", content);
