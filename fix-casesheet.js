const fs = require('fs');
const file = 'src/components/CaseSheetView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The block we want to move from above the tabs into activeTab === "triage".
// It starts at: {/* ER CASE QUICK-SWITCHER WIDGET */}
// Wait, the Quick Switcher shouldn't move. Or maybe it should. 
// "MLC WARNING CARD" is the first one that is "Triage/Demographics" related.
// Let's move everything from MLC WARNING CARD (inclusive) up to 
// </div>\n\n      {/* Right Column: Case Sheets Tabbed Flow */} (exclusive).
// Actually, moving it all into triage is what we want.

const mlcStartIdx = content.indexOf('{/* MLC WARNING CARD');
const rightColIdx = content.indexOf('{/* Right Column: Case Sheets Tabbed Flow */}');
const endOfLeftCol = content.lastIndexOf('</div>', rightColIdx);

if (mlcStartIdx === -1 || rightColIdx === -1) {
  console.error("Could not find start or end markers for left column.");
  process.exit(1);
}

const triageContent = content.slice(mlcStartIdx, endOfLeftCol);

// Remove it from the original place
content = content.slice(0, mlcStartIdx) + content.slice(endOfLeftCol);

// Now, find activeTab === "triage"
const triageTabIdx = content.indexOf('{activeTab === "triage" && (');
if (triageTabIdx === -1) {
  console.error("Could not find activeTab === 'triage'");
  process.exit(1);
}

const triageBlockStart = content.indexOf('<div className="space-y-6 animate-fade-in">', triageTabIdx);
if (triageBlockStart === -1) {
  console.error("Could not find space-y-6 after triage tab");
  process.exit(1);
}

// Inside the triage block, insert the triageContent after the SaveSectionButton div
const saveBtnEnd = content.indexOf('</div>', triageBlockStart);
const insertPoint = content.indexOf('\n', saveBtnEnd) + 1;

content = content.slice(0, insertPoint) + 
          triageContent + '\n' + 
          content.slice(insertPoint);

// Now we need to remove the demographics block from "complaints" tab
// The block starts with <div className="bg-slate-50 dark:bg-slate-900/50 p-5 border...
const complaintsTabIdx = content.indexOf('{activeTab === "complaints" && (');
const complaintsTitleStart = content.indexOf('<h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">', complaintsTabIdx);
const complaintsTitleEnd = content.indexOf('</h3>', complaintsTitleStart);

// Change the title to just "Chief Complaints"
content = content.slice(0, complaintsTitleStart) + 
          '<h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">\n                    Chief Complaints\n                  </h3>' + 
          content.slice(complaintsTitleEnd + 5);

// Update description
const pTextStart = content.indexOf('<p className="text-[10px] text-slate-400">Review and edit primary patient demographics and presenting complaints.</p>', complaintsTabIdx);
if (pTextStart !== -1) {
  content = content.slice(0, pTextStart) + 
            '<p className="text-[10px] text-slate-400">Review and edit presenting complaints.</p>' + 
            content.slice(pTextStart + 115);
}

// Find the block to remove
const demoBlockStart = content.indexOf('<div className="bg-slate-50 dark:bg-slate-900/50 p-5 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">', complaintsTabIdx);
if (demoBlockStart !== -1) {
  // We want to keep the "Presenting Complaint" textarea which is inside this block.
  // Wait, let's look at the complaints block again. 
  // It has <label ...>Patient Name</label> ... <label>Phone Number</label> ... <label>Arrival Mode</label> ... <label>Presenting Complaint</label>
  // Wait, the block was already modified or is it the whole block?
  // I will just use string replacement for the grid that contains demographics.
}

fs.writeFileSync(file + '.temp.tsx', content);
console.log("Written to .temp.tsx");
