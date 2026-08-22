const fs = require('fs');
let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(
  "onDiscussCase={(c) => setDiscussionModalCase(c)}\n                />",
  "onDiscussCase={(c) => setDiscussionModalCase(c)}\n                  onDeleteCase={handleDeleteCase}\n                />"
);

fs.writeFileSync("src/App.tsx", content);
