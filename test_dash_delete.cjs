const fs = require('fs');
let content = fs.readFileSync("src/components/DashboardView.tsx", "utf8");
console.log(content.includes('                                  </div>\n                                )}');
