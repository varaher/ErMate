import fs from 'fs';

let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

// 1. Replace the Global Header
const headerStart = '{/* Global Header (Back Button & Patient Info) */}';
const headerEnd = '{/* Persistent "Not Yet Triaged" Warning Chip  */}';

const newHeader = `
      {/* NEW WIREFRAME HEADER */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-2 mt-4 space-y-2 no-print">
        {/* Row 1: Back, UHID, Type/Triage */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
          <button onClick={onBack} className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase">
            <ArrowLeft className="w-3.5 h-3.5" />
            Cases
          </button>
          
          {currentCase.patient.uhid && (
            <span className="font-mono">UHID {currentCase.patient.uhid}</span>
          )}
          
          <span className="text-right">
            {currentCase.patient.caseType || "Medical"} · {currentCase.patient.triageCategory ? currentCase.patient.triageCategory.split(" ")[0] : "P2"}
          </span>
        </div>

        {/* Row 2: Name & Age/Sex */}
        <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {currentCase.patient.name} <span className="font-normal text-slate-400 dark:text-slate-500">· {currentCase.patient.age || "N/A"}y/{currentCase.patient.gender?.charAt(0) || "U"}</span>
        </div>

        {/* Row 3: Resume Scribe & More Actions */}
        <div className="flex items-center justify-between pt-1 pb-2">
          {onReturnToScribe ? (
            <button onClick={onReturnToScribe} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              Resume Scribe
            </button>
          ) : (
            <div></div>
          )}
          
          <button className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* HORIZONTAL TABS (Moved from bottom) */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-6 no-print overflow-x-auto scrollbar-hide border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6 pb-2 min-w-max">
          {[
            { id: "triage", label: "Triage" },
            { id: "complaints", label: "Complaints" },
            { id: "primary-survey", label: "Primary" },
            { id: "history", label: "SAMPLE" },
            { id: "secondary-survey", label: "Secondary" },
            { id: "investigations", label: "Investigations" },
            { id: "treatment", label: "Treatment" },
            { id: "notes", label: "Notes" },
            { id: "disposition", label: "Disposition" },
            { id: "trends", label: "Trends" },
            { id: "rounds", label: "Rounds" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={\`text-sm font-bold transition-all pb-2 -mb-2 border-b-2 whitespace-nowrap \${
                activeTab === tab.id
                  ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }\`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* DIVIDER ABOVE CONTENT (from wireframe) */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 no-print">
        <hr className="border-slate-200 dark:border-slate-800 mb-6" />
      </div>

      `;

let startIndex = content.indexOf(headerStart);
let endIndex = content.indexOf(headerEnd);
if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newHeader + content.substring(endIndex);
} else {
  console.log("Could not find global header markers.");
}

// 2. Remove the old bottom tabs bar
const oldTabsStart = '{/* Fixed Bottom Clinical Section Navigation Bar (Prominent & Responsive)  */}';
const oldTabsEnd = '{/* Interactive UI Screen Close  */}'; // Right after the bottom tabs

let oldTabsStartIndex = content.indexOf(oldTabsStart);
let oldTabsEndIndex = content.indexOf(oldTabsEnd);
if (oldTabsStartIndex !== -1 && oldTabsEndIndex !== -1) {
  content = content.substring(0, oldTabsStartIndex) + content.substring(oldTabsEndIndex);
} else {
  console.log("Could not find bottom tabs markers.");
}

// 3. Change Layout Wrapper to single column
content = content.replace(
  '<div className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto no-print" id="case-sheet-container">',
  '<div className="flex flex-col gap-6 max-w-3xl mx-auto no-print px-4 sm:px-6" id="case-sheet-container">'
);

// Remove the left column wrapper:
// `w-full xl:w-80 space-y-4 shrink-0 animate-fade-in`
content = content.replace(
  '{(activeTab === "triage" || activeTab === "trends") && (\n      <div className="w-full xl:w-80 space-y-4 shrink-0 animate-fade-in">',
  '{(activeTab === "triage" || activeTab === "trends") && (\n      <div className="w-full space-y-4 shrink-0 animate-fade-in">'
);

// 4. Next/Prev button at bottom of active tab
// We need to insert a navigation footer at the bottom of the main column, right before `{/* Interactive UI Screen Close  */}`
const footerHTML = `
        {/* Next/Prev Tab Navigation Footer */}
        {(() => {
          const tabOrder = ["triage", "complaints", "primary-survey", "history", "secondary-survey", "investigations", "treatment", "notes", "disposition", "trends", "rounds"];
          const labels = {
            "triage": "Triage", "complaints": "Complaints", "primary-survey": "Primary Survey", 
            "history": "SAMPLE History", "secondary-survey": "Secondary Survey", 
            "investigations": "Investigations", "treatment": "Treatment", "notes": "Notes", 
            "disposition": "Disposition", "trends": "Trends", "rounds": "Rounds"
          };
          const currentIndex = tabOrder.indexOf(activeTab);
          const nextTab = currentIndex < tabOrder.length - 1 ? tabOrder[currentIndex + 1] : null;
          
          if (!nextTab) return null;

          return (
            <div className="mt-12 mb-8 border-t border-slate-200 dark:border-slate-800 pt-6 flex justify-end no-print">
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setActiveTab(nextTab as any);
                }}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Next: {labels[nextTab as keyof typeof labels]} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })()}
`;

// Insert the footer right before `{/* Interactive UI Screen Close  */}`
content = content.replace(
  '{/* Interactive UI Screen Close  */}',
  footerHTML + '\n      {/* Interactive UI Screen Close  */}'
);

// Save changes
fs.writeFileSync('src/components/CaseSheetView.tsx', content);
console.log("Successfully applied wireframe updates.");
