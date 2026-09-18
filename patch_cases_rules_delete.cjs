const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regexDelete = /      allow read, delete: if sameHospital\(resource\.data\.hospital\);/;

const newDelete = `      allow read: if sameHospital(resource.data.hospital);
      
      // Prevent delete-recreate ownership forgery: ownership-aware cases cannot be hard-deleted by ordinary clients
      allow delete: if sameHospital(resource.data.hospital) 
        && (resource.data.get('createdByUid', null) == null || isPlatformAdmin());`;

if (content.match(regexDelete)) {
    content = content.replace(regexDelete, newDelete);
    fs.writeFileSync('firestore.rules', content);
    console.log("Patched delete rule successfully");
} else {
    console.log("Could not find regex!");
}
