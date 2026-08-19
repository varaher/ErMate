const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const targetStr = `          {activeTab === "pediatrics-sheet" && (
            <div className="space-y-6 animate-fade-in text-xs">`;

const startIdx = content.indexOf(targetStr);
if (startIdx !== -1) {
    let endIdx = content.indexOf('          )}', startIdx);
    if (endIdx !== -1) {
        endIdx += 12;
        const replacement = `          {activeTab === "pediatrics-sheet" && (
            <PediatricTabContent
              currentCase={currentCase}
              setCurrentCase={setCurrentCase}
              onSave={handleSave}
            />
          )}`;
        
        const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
        fs.writeFileSync('src/components/CaseSheetView.tsx', newContent);
        console.log("Replaced pediatrics-sheet tab successfully");
    } else {
        console.log("Could not find end of pediatrics-sheet tab block");
    }
} else {
    console.log("Could not find start of pediatrics-sheet tab block");
}
