const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexFunc = /      function isValidNewWorkspace\(\) \{[\s\S]*?\n      \}/;

const newFunc = `      function isValidNewWorkspace() {
        let isLegacy = incoming().get('workspaceType', null) == null 
            && incoming().get('ownerUid', null) == null
            && incoming().get('hospitalId', null) == null
            && incoming().get('createdByUid', null) == null;
            
        if (isLegacy) return true;
        
        let membership = get(/databases/$(database)/documents/team_members/$(request.auth.uid));
        let isActiveMember = membership != null && membership.data != null && membership.data.status == 'active';
        let memberHospitalId = isActiveMember ? membership.data.get('hospitalId', membership.data.get('hospital', null)) : null;

        let ws = incoming().get('workspaceType', null);
        let oUid = incoming().get('ownerUid', null);
        let hId = incoming().get('hospitalId', null);

        if (isActiveMember) {
            if (memberHospitalId == null || !(memberHospitalId is string) || memberHospitalId.size() == 0) {
                return false; // Malformed active membership
            }
            return ws == 'hospital' && oUid == null && hId == memberHospitalId;
        } else {
            return ws == 'individual' && oUid == request.auth.uid && hId == null;
        }
      }`;

if (content.match(regexFunc)) {
    content = content.replace(regexFunc, newFunc);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find regex!");
}
