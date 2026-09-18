const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const old_save_case = `  // Save changes inside Case Sheet View
  const handleSaveCase = async (updatedCase: ClinicalCase) => {
    const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const editUid = auth.currentUser?.uid || "uid_priya";
    const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

    const caseToSave: ClinicalCase = {
      ...updatedCase,
      hospital: updatedCase.hospital || profile.hospital,
      doctorEmail: updatedCase.doctorEmail || profile.email,
      doctorName: updatedCase.doctorName || profile.name || "Emergency Doctor",
      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      lastEditedBy: editUid,
      lastEditedByName: editName,
      lastEditedByRole: editRole,
      lastEditedAt: new Date().toISOString()
    };`;

const new_save_case = `  // Save changes inside Case Sheet View
  const handleSaveCase = async (updatedCase: ClinicalCase) => {
    const previousCase = cases.find(c => c.id === updatedCase.id);
    
    // Phase 2: If this is a brand new case (like from Quick Discharge), resolve workspace securely.
    // If it's an existing case, preserve its existing ownership metadata.
    let workspaceMetadata = {
      workspaceType: updatedCase.workspaceType,
      ownerUid: updatedCase.ownerUid,
      hospitalId: updatedCase.hospitalId
    };

    if (!previousCase && !updatedCase.workspaceType) {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
      workspaceMetadata = {
        workspaceType: workspace.workspaceType,
        ownerUid: workspace.ownerUid,
        hospitalId: workspace.hospitalId
      };
    } else if (previousCase) {
      workspaceMetadata = {
        workspaceType: previousCase.workspaceType || updatedCase.workspaceType,
        ownerUid: previousCase.ownerUid || updatedCase.ownerUid || null,
        hospitalId: previousCase.hospitalId || updatedCase.hospitalId || null
      };
    }

    const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const editUid = auth.currentUser?.uid || "uid_priya";
    const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

    const caseToSave: ClinicalCase = {
      ...updatedCase,
      workspaceType: workspaceMetadata.workspaceType,
      ownerUid: workspaceMetadata.ownerUid,
      hospitalId: workspaceMetadata.hospitalId,
      hospital: updatedCase.hospital || profile.hospital,
      doctorEmail: updatedCase.doctorEmail || profile.email,
      doctorName: updatedCase.doctorName || profile.name || "Emergency Doctor",
      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      lastEditedBy: editUid,
      lastEditedByName: editName,
      lastEditedByRole: editRole,
      lastEditedAt: new Date().toISOString()
    };`;

content = content.replace(old_save_case, new_save_case);

// We need to remove the redeclaration of \`previousCase\` further down in the function.
const old_prev = `    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave));
      
      // Determine changed fields across all patient sections (Demographics, Vitals, Primary Survey, SAMPLE history, Treatments, Labs, Differentials, Notes, Disposition, Pediatric)
      const previousCase = cases.find(c => c.id === updatedCase.id);`;

const new_prev = `    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave));
      
      // Determine changed fields across all patient sections (Demographics, Vitals, Primary Survey, SAMPLE history, Treatments, Labs, Differentials, Notes, Disposition, Pediatric)
      // const previousCase = cases.find(c => c.id === updatedCase.id); // already fetched above`;

content = content.replace(old_prev, new_prev);

fs.writeFileSync('src/App.tsx', content);
