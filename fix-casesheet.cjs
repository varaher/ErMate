const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Add "triage" to the activeTab state type and default it.
code = code.replace(
  /const \[activeTab, setActiveTab\] = useState<\s*"complaints"/,
  `const [activeTab, setActiveTab] = useState<\n    "triage" | "complaints"`
);
code = code.replace(
  /\>\("complaints"\);/,
  `>("triage");`
);

// 2. Extract "Back and Status" and add Patient Header.
// We will replace the start of the return statement up to the Interactive UI Screen.
const startSearch = `  return (
    <div className="w-full pb-28 sm:pb-36">
      {/* Persistent "Not Yet Triaged" Warning Chip  */}`;

const replacementHeader = `  return (
    <div className="w-full pb-28 sm:pb-36">
      {/* Global Header (Back Button & Patient Info) */}
      <div className="max-w-7xl mx-auto px-2 sm:px-0 mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            Cases List
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white text-sm">{currentCase.patient.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentCase.patient.age || "N/A"}y / {currentCase.patient.gender}</span>
            {currentCase.patient.uhid && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-medium ml-1 border-l border-slate-300 dark:border-slate-700 pl-2">
                UHID: {currentCase.patient.uhid}
              </span>
            )}
          </div>
          {onReturnToScribe && (
            <button
              onClick={onReturnToScribe}
              className="flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/25 dark:text-purple-300 text-[10px] font-bold rounded border border-purple-100 dark:border-purple-900 transition-all uppercase shrink-0"
            >
              <Mic className="w-3 h-3 text-purple-500 animate-pulse" />
              Resume Dictation
            </button>
          )}
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 font-mono font-bold animate-pulse-slow">
          {currentCase.status}
        </span>
      </div>

      {/* Persistent "Not Yet Triaged" Warning Chip  */}`;

code = code.replace(startSearch, replacementHeader);

// 3. Remove the old "Back and Status" from the Left Column, and wrap the Left Column conditionally.
const oldBackSearch = `      {/* Left Column: Demographics & Abnormal Vitals Monitor  */}
      <div className="w-full xl:w-80 space-y-4 shrink-0">
        
        {/* Back and Status  */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all uppercase"
            >
              <ArrowLeft className="w-4 h-4" />
              Cases List
            </button>
            {onReturnToScribe && (
              <button
                onClick={onReturnToScribe}
                className="flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/25 dark:text-purple-300 text-[10px] font-bold rounded border border-purple-100 dark:border-purple-900 transition-all uppercase shrink-0"
              >
                <Mic className="w-3 h-3 text-purple-500 animate-pulse" />
                Resume Dictation
              </button>
            )}
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 font-mono font-bold animate-pulse-slow">
            {currentCase.status}
          </span>
        </div>`;

const newLeftColStart = `      {/* Left Column: Demographics & Abnormal Vitals Monitor  */}
      {(activeTab === "triage" || activeTab === "trends") && (
      <div className="w-full xl:w-80 space-y-4 shrink-0 animate-fade-in">`;
code = code.replace(oldBackSearch, newLeftColStart);

// Close the Left Column condition.
const rightColSearch = `      {/* Right Column: Case Sheets Tabbed Flow  */}`;
const rightColReplace = `      )}
      {/* Right Column: Case Sheets Tabbed Flow  */}`;
code = code.replace(rightColSearch, rightColReplace);


// 4. Add "triage" to the tabs array.
const tabsSearch = `            {[
              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },`;
const tabsReplace = `            {[
              { id: "triage", label: "Triage", icon: AlertTriangle },
              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },`;
code = code.replace(tabsSearch, tabsReplace);

// 5. Add Triage Tab Content
const complaintsTabSearch = `          {/* Chief Complaints & Editable Demographics  */}
          {activeTab === "complaints" && (`;
const triageTabContent = `          {/* Triage Tab  */}
          {activeTab === "triage" && (
            <div className="space-y-6 animate-fade-in text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 opacity-75" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                Triage & Patient Registration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
                Use the left panel to update demographics, set the emergency triage category, manage medico-legal (MLC) details, and record initial vital signs.
              </p>
            </div>
          )}

          {/* Chief Complaints & Editable Demographics  */}
          {activeTab === "complaints" && (`;
code = code.replace(complaintsTabSearch, triageTabContent);

// 6. Remove "Demographics & Registration Details" from Disposition tab
// It spans from `<div>` with "Demographics & Registration Details" up to just before `<div>` with "Disposition Status".
const dispSearchStart = `              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  Demographics & Registration Details
                </h3>`;
const dispSearchEnd = `              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5 mt-6">
                  <LogOut className="w-4 h-4 text-purple-500" />
                  Disposition Status
                </h3>`;

let startIdx = code.indexOf(dispSearchStart);
let endIdx = code.indexOf(dispSearchEnd);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + dispSearchEnd + code.substring(endIdx + dispSearchEnd.length);
} else {
  console.log("Could not find Disposition Demographics block");
}

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
console.log("Done");
