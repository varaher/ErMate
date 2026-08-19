const fs = require('fs');

function fixFiles(files) {
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix triage.includes
    content = content.replace(/c\.patient\.triageCategory\.includes/g, 'String(c.patient.triageCategory || "").includes');
    content = content.replace(/oc\.patient\.triageCategory\.includes/g, 'String(oc.patient.triageCategory || "").includes');
    content = content.replace(/pc\.patient\.triageCategory\.includes/g, 'String(pc.patient.triageCategory || "").includes');
    content = content.replace(/c\.patient\.triageCategory\?\.includes/g, 'String(c.patient.triageCategory || "").includes');
    
    content = content.replace(/item\.triage\.includes/g, 'String(item.triage || "").includes');
    content = content.replace(/parsed\.triage\.includes/g, 'String(parsed.triage || "").includes');
    content = content.replace(/p\.triage\.includes/g, 'String(p.triage || "").includes');
    content = content.replace(/msg\.parsedPatient\.triage\.includes/g, 'String(msg.parsedPatient.triage || "").includes');
    content = content.replace(/currentCase\.patient\.triageCategory\.includes/g, 'String(currentCase.patient.triageCategory || "").includes');

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
