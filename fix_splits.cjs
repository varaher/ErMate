const fs = require('fs');

function fixFiles(files) {
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix triage.split -> String(triage).split
    content = content.replace(/\.triageCategory(\?)?\.split\("/g, '.triageCategory$1?.toString().split("');
    content = content.replace(/\{c\.patient\.triageCategory\.split\("/g, '{String(c.patient.triageCategory || "P2").split("');
    content = content.replace(/c\.patient\.triageCategory\.split\("/g, 'String(c.patient.triageCategory || "P2").split("');
    
    content = content.replace(/\{pc\.patient\.triageCategory\.split\("/g, '{String(pc.patient.triageCategory || "P2").split("');
    content = content.replace(/\{oc\.patient\.triageCategory\.split\("/g, '{String(oc.patient.triageCategory || "P2").split("');
    
    content = content.replace(/\{item\.triage\.split\("/g, '{String(item.triage || "P2").split("');
    content = content.replace(/newItem\.triage\.split\("/g, 'String(newItem.triage || "P2").split("');
    content = content.replace(/newPatient\.triage\.split\("/g, 'String(newPatient.triage || "P2").split("');
    content = content.replace(/fallbackPatient\.triage\.split\("/g, 'String(fallbackPatient.triage || "P2").split("');
    content = content.replace(/restoredPatient\.triage\.split\("/g, 'String(restoredPatient.triage || "P2").split("');

    // For row.planDone.split
    content = content.replace(/row\.planDone \? row\.planDone\.split\('\\n'\) : \[\]/g, 'typeof row.planDone === "string" ? row.planDone.split("\\n") : (Array.isArray(row.planDone) ? row.planDone : [])');
    content = content.replace(/row\.planToBeDone \? row\.planToBeDone\.split\('\\n'\) : \[\]/g, 'typeof row.planToBeDone === "string" ? row.planToBeDone.split("\\n") : (Array.isArray(row.planToBeDone) ? row.planToBeDone : [])');

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
