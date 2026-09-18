const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexFuncs = /      function isValidNewWorkspace\(\) \{[\s\S]*?\n      \}/;

const newFuncs = `      function isValidNewWorkspace() {
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
      }`;

if (content.match(regexFuncs)) {
    content = content.replace(regexFuncs, newFuncs);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched valid syntax successfully");
} else {
    console.log("Could not find regex!");
}
