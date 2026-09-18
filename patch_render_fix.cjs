const fs = require('fs');
let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const regex = /          <\/div>\n        <\/div>\n      <\/div>\n    <\/div>\n  <\/div>\n      \);\n    \} else if \(selectedSubSection === "self-learning"\) \{/;

content = content.replace(regex, `          </div>\n      );\n    } else if (selectedSubSection === "self-learning") {`);
fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
