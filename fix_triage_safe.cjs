const fs = require('fs');

function fixFiles(files) {
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix triage.split safely
    content = content.replace(/c\.patient\.triageCategory\?\.toString\(\)\.split\("/g, 'String(c.patient.triageCategory || "P2").split("');
    content = content.replace(/pc\.patient\.triageCategory\?\.toString\(\)\.split\("/g, 'String(pc.patient.triageCategory || "P2").split("');
    content = content.replace(/oc\.patient\.triageCategory\?\.toString\(\)\.split\("/g, 'String(oc.patient.triageCategory || "P2").split("');

    fs.writeFileSync(file, content);
  });
}

fixFiles([
  'src/components/HandoverView.tsx',
  'src/components/DashboardView.tsx',
  'src/components/CaseSheetView.tsx',
  'src/components/CasesListView.tsx',
  'src/App.tsx'
]);
