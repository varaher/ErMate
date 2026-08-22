const fs = require('fs');
let content = fs.readFileSync('src/components/HandoverView.tsx', 'utf8');

// Replace "No background parsed." with ""
content = content.replace(/"No background parsed\."/g, '""');

// Replace "Under evaluation" with "" where it makes sense
content = content.replace(/\|\| "Under evaluation"/g, '|| ""');
content = content.replace(/\|\| 'Under evaluation'/g, '|| ""');
content = content.replace(/: "Under evaluation"/g, ': ""');

// Replace "No situation parsed." with ""
content = content.replace(/"No situation parsed\."/g, '""');

// Replace "No assessment parsed." with ""
content = content.replace(/"No assessment parsed\."/g, '""');

fs.writeFileSync('src/components/HandoverView.tsx', content, 'utf8');
