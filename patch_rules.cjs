const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const regex = /        && incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['learningPoints', 'skills', 'updatedAt'\]\);/;

const newContent = `        && incoming().diff(existing()).affectedKeys().hasOnly(['learningPoints', 'skills', 'updatedAt'])
        && (!('learningPoints' in incoming()) || incoming().learningPoints is string)
        && (!('skills' in incoming()) || incoming().skills is list)
        && (!('updatedAt' in incoming()) || incoming().updatedAt is string);`;

content = content.replace(regex, newContent);
fs.writeFileSync('firestore.rules', content);
