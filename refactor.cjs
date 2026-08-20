const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Replace the top-level container class
content = content.replace(
  'className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto no-print"',
  'className="flex flex-col gap-6 max-w-5xl mx-auto no-print"'
);

// 2. We need to extract the Demographics & Triage and Vitals blocks.
// They are inside the left column, after ER CASE QUICK-SWITCHER WIDGET
const extractStart = content.indexOf('{/* Demographics & Triage  */}');
// Find the end of the left column.
// The left column div ends just before {/* Right Column: Case Sheets Tabbed Flow  */}
const rightColStart = content.indexOf('{/* Right Column: Case Sheets Tabbed Flow  */}');
// We want to find the closing </div> of the left column, which should be the div right before rightColStart.
const extractEnd = content.lastIndexOf('</div>', content.lastIndexOf('</div>', rightColStart - 1) - 1); 
// Wait, to be precise, let's just use string slice from extractStart to rightColStart, and remove the trailing </div>.
let rightColIndex = content.indexOf('{/* Right Column: Case Sheets Tabbed Flow  */}');
let leftColDivEnd = content.lastIndexOf('</div>', rightColIndex - 1);
leftColDivEnd = content.lastIndexOf('</div>', leftColDivEnd - 1); // get the end of the Vitals block. Wait, this might be fragile.

// Let's use regex with balancing groups? No, JS doesn't support that well.
// Let's extract by lines.
let lines = content.split('\n');

let startIdx = lines.findIndex(l => l.includes('{/* Demographics & Triage  */}'));
let endIdx = lines.findIndex(l => l.includes('{/* Right Column: Case Sheets Tabbed Flow  */}'));

// The left column closing </div> is a few lines before endIdx.
let actualEndIdx = endIdx - 1;
while(actualEndIdx > startIdx && !lines[actualEndIdx].includes('</div>')) {
    actualEndIdx--;
}
actualEndIdx--; // Skip the closing div of the left column itself.
while(actualEndIdx > startIdx && !lines[actualEndIdx].includes('</div>')) {
    actualEndIdx--;
}

const extractedLines = lines.slice(startIdx, actualEndIdx + 1);

// Remove the extracted lines from the original array
lines.splice(startIdx, actualEndIdx - startIdx + 1);

// Now, we need to insert the Triage Tab content into the activeTab switch statement.
const tabContentStart = lines.findIndex(l => l.includes('{activeTab === "complaints" && ('));
const triageTabContent = `
          {activeTab === "triage" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
              ${extractedLines.join('\n')}
            </div>
          )}
`;
lines.splice(tabContentStart, 0, triageTabContent);

// Add the Triage tab to the array of tabs.
const tabArrayLine = lines.findIndex(l => l.includes('id: "complaints", label: "Chief Complaints"'));
lines.splice(tabArrayLine, 0, `              { id: "triage", label: "Triage & Vitals", icon: Activity },`);

// Clean up the column wrappers.
// Find: <div className="w-full xl:w-80 space-y-4 shrink-0">
const leftColWrap = lines.findIndex(l => l.includes('className="w-full xl:w-80 space-y-4 shrink-0"'));
if (leftColWrap !== -1) {
    lines[leftColWrap] = lines[leftColWrap].replace('w-full xl:w-80 space-y-4 shrink-0', 'w-full space-y-4');
}

// Find: <div className="flex-1 flex flex-col space-y-4">
const rightColWrap = lines.findIndex(l => l.includes('className="flex-1 flex flex-col space-y-4"'));
if (rightColWrap !== -1) {
    // we can just make it part of the flow, but removing the flex-1 might be enough.
    lines[rightColWrap] = lines[rightColWrap].replace('flex-1 flex flex-col space-y-4', 'flex flex-col space-y-4');
}

fs.writeFileSync('src/components/CaseSheetView.tsx', lines.join('\n'));
console.log("Refactoring complete");
