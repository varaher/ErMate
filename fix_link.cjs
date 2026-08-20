const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');
content = content.replace(/const url = URL\.createObjectURL\(blob\);\n\s*const dlLink = document\.createElement\("a"\);\n\s*dlLink\.href = url;\n\s*link\.download = /g, 'const url = URL.createObjectURL(blob);\n      const dlLink = document.createElement("a");\n      dlLink.href = url;\n      dlLink.download = ');
content = content.replace(/const url = URL\.createObjectURL\(blob\);\n\s*const dlLink = document\.createElement\("a"\);\n\s*dlLink\.href = url;\n\s*dlLink\.download = `Doctors_Handover_Roster_/g, 'const url = URL.createObjectURL(compactBlob);\n    const dlLink = document.createElement("a");\n    dlLink.href = url;\n    dlLink.download = `Doctors_Handover_Roster_');
fs.writeFileSync('src/components/HandoverView.tsx', content);
