const fs = require('fs');
let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(
  "onDeleteAllCases={handleDeleteAllCases}",
  "onDeleteAllCases={handleDeleteAllCases}\n                  onDeleteCase={handleDeleteCase}"
);

fs.writeFileSync("src/App.tsx", content);
