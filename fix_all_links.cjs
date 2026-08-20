const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');
content = content.replace(/const dlLink/g, 'const link');
content = content.replace(/dlLink/g, 'link');
content = content.replace(/link\.download = `Doctors_Handover_Roster_\$\{handoverMeta\.date\.replace\(\/\\\\\/\/\/g, "-"\)\}\.docx`;/g, 'link.download = `Doctors_Handover_Roster_${handoverMeta.date.replace(/\\//g, "-")}.docx`;');
fs.writeFileSync('src/components/HandoverView.tsx', content);
