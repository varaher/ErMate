const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');
content = content.replace(/const url = URL\.createObjectURL\(compactBlob\);\n\s*const link = document\.createElement\("a"\);\n/g, 'const cUrl = URL.createObjectURL(compactBlob);\n    const cLink = document.createElement("a");\n');
content = content.replace(/link\.href = url;\n\s*link\.download = `Doctors_Handover_Roster_\$\{handoverMeta\.date\.replace\(\/\\\\\/\/g, "-"\)\}\.docx`;\n\s*document\.body\.appendChild\(link\);\n\s*link\.click\(\);\n\s*document\.body\.removeChild\(link\);/g, 'cLink.href = cUrl;\n    cLink.download = `Doctors_Handover_Roster_${handoverMeta.date.replace(/\\//g, "-")}.docx`;\n    document.body.appendChild(cLink);\n    cLink.click();\n    document.body.removeChild(cLink);');
fs.writeFileSync('src/components/HandoverView.tsx', content);
