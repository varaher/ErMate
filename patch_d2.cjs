const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

// 1. Remove the header button
const navButtonRegex = /<button[\s\S]*?onClick=\{\(\) => \{[\s\S]*?onStartDischargeSummary[\s\S]*?Discharge Summary[\s\S]*?<\/button>/;
code = code.replace(navButtonRegex, '');

// 2. Remove mobile Quick Action card
const mobileCardRegex = /\{\/\* Card 2: Discharge Summary Generator \(Mobile\) \*\/\}[\s\S]*?<button[\s\S]*?onStartDischargeSummary[\s\S]*?<\/button>/;
code = code.replace(mobileCardRegex, '');

// 3. Remove desktop Quick Action card
const desktopCardRegex = /\{\/\* Card 2: Discharge Summary Generator \(Desktop\) \*\/\}[\s\S]*?<div[\s\S]*?onStartDischargeSummary[\s\S]*?<\/div>\s*<\/div>/;
// Wait, the desktop card uses a div and nested elements, let's use a simpler replace or precise string replace to avoid over-matching.
