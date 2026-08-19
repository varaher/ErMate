const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

// Remove standalone <SaveSectionButton onSave={handleSave} /> that were added manually
content = content.replace(/<SaveSectionButton onSave=\{handleSave\} \/>/g, '');
// Re-insert them securely using the regex!
// But wait, the previous script might have already added them!
// Let's just do it cleanly:
