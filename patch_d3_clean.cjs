const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regex = /[ \t]*\{\/\*\s*Card 2: Pediatric Dosing \(Desktop\)\s*\*\/\}\s*<div[\s\S]*?onOpenPediatricCalculator\(\)[\s\S]*?Open Dosing[\s\S]*?<\/div>\s*<\/div>/;

if (regex.test(code)) {
  code = code.replace(regex, '');
  fs.writeFileSync('src/components/DashboardView.tsx', code);
  console.log("Desktop Card 2 successfully removed.");
} else {
  console.log("Could not find Desktop Card 2.");
}
