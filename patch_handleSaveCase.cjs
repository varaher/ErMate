const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
/hospital: updatedCase\.hospital \|\| profile\.hospital,/g,
`hospital: updatedCase.hospital || profile.hospital,
      doctorEmail: updatedCase.doctorEmail || profile.email,
      doctorName: updatedCase.doctorName || profile.name || "Emergency Doctor",
      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      createdByUid: (updatedCase as any).createdByUid || auth.currentUser?.uid,`
);

fs.writeFileSync('src/App.tsx', content);
