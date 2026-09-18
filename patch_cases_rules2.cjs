const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexFunc = /      function isValidNewWorkspace\(\) \{\n        let ws = incoming\(\)\.get\('workspaceType', null\);\n        let oUid = incoming\(\)\.get\('ownerUid', null\);\n        let hId = incoming\(\)\.get\('hospitalId', null\);\n        return ws == null \n            \|\| \(ws == 'individual' && oUid == request\.auth\.uid && hId == null\)\n            \|\| \(ws == 'hospital' && oUid == null && hId is string && hId\.size\(\) > 0\);\n      \}/;

const newFunc = `      function isValidNewWorkspace() {
        return incoming().get('workspaceType', null) == null 
            || (incoming().get('workspaceType', null) == 'individual' 
                && incoming().get('ownerUid', null) == request.auth.uid 
                && incoming().get('hospitalId', null) == null)
            || (incoming().get('workspaceType', null) == 'hospital' 
                && incoming().get('ownerUid', null) == null 
                && incoming().get('hospitalId', null) is string 
                && incoming().get('hospitalId', null).size() > 0);
      }`;

if (content.match(regexFunc)) {
    content = content.replace(regexFunc, newFunc);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find regex!");
}
