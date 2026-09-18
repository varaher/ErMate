const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexCases = /    match \/cases\/\{caseId\} \{\n      allow read, delete: if sameHospital\(resource\.data\.hospital\);\n      allow create: if isLoggedIn\(\) && sameHospital\(incoming\(\)\.hospital\);\n      allow update: if sameHospital\(resource\.data\.hospital\)\n        && \(incoming\(\)\.hospital == existing\(\)\.hospital \|\| isPlatformAdmin\(\)\);/;

const newCases = `    match /cases/{caseId} {
      function isUnchanged(field) {
        return incoming().get(field, null) == existing().get(field, null);
      }
      function isValidNewAttribution() {
        return incoming().get('createdByUid', null) == null || incoming().get('createdByUid', null) == request.auth.uid;
      }
      function isValidNewWorkspace() {
        let ws = incoming().get('workspaceType', null);
        let oUid = incoming().get('ownerUid', null);
        let hId = incoming().get('hospitalId', null);
        return ws == null 
            || (ws == 'individual' && oUid == request.auth.uid && hId == null)
            || (ws == 'hospital' && oUid == null && hId is string && hId.size() > 0);
      }
      function isMetadataImmutable() {
        return isUnchanged('createdByUid') 
            && isUnchanged('workspaceType') 
            && isUnchanged('ownerUid') 
            && isUnchanged('hospitalId');
      }

      allow read, delete: if sameHospital(resource.data.hospital);
      
      allow create: if isLoggedIn() 
        && sameHospital(incoming().hospital)
        && isValidNewAttribution()
        && isValidNewWorkspace();
        
      allow update: if sameHospital(resource.data.hospital)
        && (incoming().hospital == existing().hospital || isPlatformAdmin())
        && isMetadataImmutable();`;

if (content.match(regexCases)) {
    content = content.replace(regexCases, newCases);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find regex!");
}
