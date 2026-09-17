const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

let mobileStart = code.indexOf('{/* Mobile Minimalist Action Pad (Visible on Mobile only) */}');
let desktopEnd = code.indexOf('{/* 2. Stats Cards Row */}');

console.log(code.slice(mobileStart, desktopEnd));
