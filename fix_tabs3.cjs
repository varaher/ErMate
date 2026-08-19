const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

const tabs = ["history", "trends", "notes", "investigations", "disposition", "treatment", "complaints", "pediatrics-sheet", "primary-survey", "secondary-survey"];

// Strip any left over if there's an empty div wrapper
content = content.replace(/<div className="flex justify-end mb-2">\s*<\/div>/g, '');

tabs.forEach(tab => {
  const regex = new RegExp(`(\\{activeTab === "${tab}" && \\(\\s*<div[^>]*>)`, 'g');
  
  content = content.replace(regex, (match) => {
    return match + `\n              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>`;
  });
});

content = content.replace(/(<div className="flex justify-end mb-2"><SaveSectionButton onSave=\{handleSave\} \/><\/div>\s*)+/g, '<div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>\n');

fs.writeFileSync('src/components/CaseSheetView.tsx', content);
