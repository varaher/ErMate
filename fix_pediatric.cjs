const fs = require('fs');

let file = fs.readFileSync('src/components/PediatricABCDESections.tsx', 'utf8');

file = file.replace(/bg-slate-800\/60/g, 'bg-slate-50 dark:bg-slate-900/60');
file = file.replace(/bg-slate-800/g, 'bg-white dark:bg-slate-900');
file = file.replace(/border-slate-700/g, 'border-slate-200 dark:border-slate-800');
file = file.replace(/border-slate-600/g, 'border-slate-200 dark:border-slate-800');
file = file.replace(/text-white/g, 'text-slate-800 dark:text-white');
file = file.replace(/bg-slate-700/g, 'bg-slate-200 dark:bg-slate-800');
file = file.replace(/hover:bg-slate-600/g, 'hover:bg-slate-300 dark:hover:bg-slate-700');
// some icon classes might use text-white, but the inputs do too. The above replace text-white with dark mode. 
// However, the `span` for toggles might use bg-white. Let's make sure it's ok.
// Let's write the modified content back
fs.writeFileSync('src/components/PediatricABCDESections.tsx', file);
