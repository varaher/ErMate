const fs = require('fs');
let code = fs.readFileSync('src/components/MlcCertificatesView.tsx', 'utf8');

code = code.replace('{c.uhid ||', '{(c as any).uhid ||');
code = code.replace('c.patient.arrivalTime', '(c.patient as any).arrivalTime || c.patient.dateOpened');
code = code.replace('{m.placeOfIncident', '{(m as any).placeOfIncident');
code = code.replace('{m.identificationMark', '{(m as any).identificationMark');
code = code.replace('{m.informantBroughtBy', '{(m as any).informantBroughtBy');
code = code.replace('{m.historyStatedBy', '{(m as any).historyStatedBy');
code = code.replace('c.investigationImaging || c.notes', '(c as any).investigationImaging || c.notes');
code = code.replace('c.dispositionDetails?.decision', '(c.dispositionDetails as any)?.decision');
code = code.replace('c.dispositionDetails?.decision', '(c.dispositionDetails as any)?.decision');
code = code.replace('{m.opinion ||', '{(m as any).opinion ||');
code = code.replace('{m.certificateRequestedBy ||', '{(m as any).certificateRequestedBy ||');
code = code.replace('{m.issuingDoctorRegistration ||', '{(m as any).issuingDoctorRegistration ||');

fs.writeFileSync('src/components/MlcCertificatesView.tsx', code);
