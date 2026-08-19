const fs = require('fs');

function fixFiles(files) {
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix s.patient.triage.split safely
    content = content.replace(/s\.patient\.triageCategory\?\.toString\(\)\.split\("/g, 'String(s.patient.triageCategory || "P2").split("');

    fs.writeFileSync(file, content);
  });
}

fixFiles([
  'src/components/HandoverView.tsx'
]);
