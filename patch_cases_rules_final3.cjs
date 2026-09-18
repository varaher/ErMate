const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexFuncs = /      function isValidNewWorkspace\(\) \{[\s\S]*?\n      \}/;

const newFuncs = `      function isValidNewWorkspace() {
        let active = isActiveMember();
        let mId = getMemberHospitalId();

        return (active 
                && mId != null && mId is string && mId.size() > 0 
                && incoming().get('workspaceType', null) == 'hospital' && incoming().get('ownerUid', null) == null && incoming().get('hospitalId', null) == mId) 
            || (!active 
                && incoming().get('workspaceType', null) == 'individual' && incoming().get('ownerUid', null) == request.auth.uid && incoming().get('hospitalId', null) == null);
      }`;

if (content.match(regexFuncs)) {
    content = content.replace(regexFuncs, newFuncs);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched valid syntax successfully");
} else {
    console.log("Could not find regex!");
}
