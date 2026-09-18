const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexFuncs = /    match \/cases\/\{caseId\} \{[\s\S]*?allow read: if sameHospital\(resource\.data\.hospital\);/;

const newFuncs = `    match /cases/{caseId} {
      function isUnchanged(field) {
        return incoming().get(field, null) == existing().get(field, null);
      }
      function isValidNewAttribution() {
        return incoming().get('createdByUid', null) == request.auth.uid;
      }
      function getMembership() {
        return get(/databases/$(database)/documents/team_members/$(request.auth.uid));
      }
      function isActiveMember() {
        let membership = getMembership();
        return membership != null && membership.data != null && membership.data.get('status', null) == 'active';
      }
      function getMemberHospitalId() {
        let membership = getMembership();
        return membership != null && membership.data != null ? membership.data.get('hospitalId', membership.data.get('hospital', null)) : null;
      }
      function isValidNewWorkspace() {
        let ws = incoming().get('workspaceType', null);
        let oUid = incoming().get('ownerUid', null);
        let hId = incoming().get('hospitalId', null);

        let active = isActiveMember();
        let mId = getMemberHospitalId();

        return (active 
                && mId != null && mId is string && mId.size() > 0 
                && ws == 'hospital' && oUid == null && hId == mId) 
            || (!active 
                && ws == 'individual' && oUid == request.auth.uid && hId == null);
      }
      function isMetadataImmutable() {
        return isUnchanged('createdByUid') 
            && isUnchanged('workspaceType') 
            && isUnchanged('ownerUid') 
            && isUnchanged('hospitalId');
      }

      allow read: if sameHospital(resource.data.hospital);`;

if (content.match(regexFuncs)) {
    content = content.replace(regexFuncs, newFuncs);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find regex!");
}
