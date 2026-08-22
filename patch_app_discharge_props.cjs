const fs = require('fs');
let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(
  "onSaveDischarge={handleSaveDischarge}\n                  profile={profile}\n                />",
  "onSaveDischarge={handleSaveDischarge}\n                  profile={profile}\n                  onDeleteCase={handleDeleteCase}\n                />"
);

fs.writeFileSync("src/App.tsx", content);
