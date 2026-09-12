const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove the bad route and the extra server declaration
content = content.replace(/const server = app\.get\("\/api\/test-batch"[\s\S]*?\}\);/g, '');
content = content.replace(/const server = app\.listen/g, 'const server = app.listen'); // this is already fine, just keeping it consistent.

fs.writeFileSync(file, content);
