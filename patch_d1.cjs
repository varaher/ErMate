const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const helper = `
const hasMeaningfulValue = (value: any): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (["none documented", "not assessed", "not documented", "n/a", "none"].includes(lower)) return false;
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }
  if (typeof value === "object") {
    return Object.values(value).some(hasMeaningfulValue);
  }
  return true;
};
`;

const tabHasDataStr = `  const tabHasData = (tabId: string): boolean => {
    if (!currentCase) return false;
    switch (tabId) {
      case "complaints":
        return hasMeaningfulValue(currentCase.patient?.presentingComplaint) || hasMeaningfulValue(currentCase.sampleHistory?.symptoms);
      case "primary-survey":
        return hasMeaningfulValue(currentCase.primaryAssessment) || hasMeaningfulValue(currentCase.vitals) || hasMeaningfulValue((currentCase as any).adjuncts) || hasMeaningfulValue((currentCase as any).adjunctsNow) || hasMeaningfulValue((currentCase as any).adjunctsAtArrival);
      case "history":
        return hasMeaningfulValue(currentCase.sampleHistory) || hasMeaningfulValue(currentCase.psychologicalAssessment);
      case "secondary-survey":
        return hasMeaningfulValue(currentCase.secondaryAssessment) || hasMeaningfulValue(currentCase.secondarySurvey);
      case "investigations":
        return hasMeaningfulValue(currentCase.investigations) || hasMeaningfulValue(currentCase.investigationsOrdered) || hasMeaningfulValue(currentCase.investigationResults) || hasMeaningfulValue(currentCase.investigationLabsOrdered) || hasMeaningfulValue(currentCase.investigationImaging) || hasMeaningfulValue(currentCase.investigationResultsSummary);
      case "treatment":
        return hasMeaningfulValue(currentCase.treatments) || hasMeaningfulValue(currentCase.treatmentNotes) || hasMeaningfulValue(currentCase.medications) || hasMeaningfulValue(currentCase.infusions) || hasMeaningfulValue(currentCase.proceduresChecked) || hasMeaningfulValue(currentCase.otherMedications) || hasMeaningfulValue(currentCase.otherProcedures);
      case "notes":
        return hasMeaningfulValue(currentCase.progressNotes) || hasMeaningfulValue(currentCase.addendumNotes);
      case "disposition":
        return hasMeaningfulValue(currentCase.dischargeInfo) || hasMeaningfulValue(currentCase.dispositionDetails) || hasMeaningfulValue(currentCase.ipsgChecklist) || hasMeaningfulValue(currentCase.vulnerableAssessment) || hasMeaningfulValue(currentCase.consentTimeOut) || hasMeaningfulValue(currentCase.dispositionAndPlan);
      case "trends":
        return hasMeaningfulValue(currentCase.vitalsHistory);
      case "rounds":
        return hasMeaningfulValue(currentCase.differentials) || hasMeaningfulValue(currentCase.provisionalDifferentialDiagnoses) || hasMeaningfulValue(currentCase.provisionalPrimaryDiagnosis) || hasMeaningfulValue(currentCase.consultantReview);
      default:
        return false;
    }
  };
`;

const navTarget = `          {/* Horizontal Nav Rail */}
          <div ref={navContainerRef} className="flex items-center gap-1.5 px-4 overflow-x-auto no-scrollbar pb-2 pt-1 border-t border-slate-100 dark:border-slate-800/50">
            {[
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
            ].map((tab) => {
              const isActive = activeTab === tab.id;`;

const newNav = `          {/* Horizontal Nav Rail */}
          <div ref={navContainerRef} className="flex items-center gap-1.5 px-4 overflow-x-auto no-scrollbar pb-2 pt-1 border-t border-slate-100 dark:border-slate-800/50">
            {[
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
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const hasData = tabHasData(tab.id);`;

const oldButtonClass = `                  className={\`text-[11px] font-bold px-4 py-2 rounded-full transition-colors shrink-0 whitespace-nowrap \${
                    isActive 
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20" 
                      : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }\`}`;

const newButtonClass = `                  className={\`text-[11px] font-bold px-4 py-2 rounded-full transition-colors shrink-0 whitespace-nowrap flex items-center gap-1.5 \${
                    isActive 
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20" 
                      : (hasData ? "bg-transparent text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20" : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")
                  }\`}`;

const oldButtonInner = `                  {tab.label}
                </button>`;

const newButtonInner = `                  <span>{tab.label}</span>
                  {hasData && (
                    <span className={\`w-1.5 h-1.5 rounded-full \${isActive ? 'bg-white' : 'bg-emerald-500 dark:bg-emerald-400'}\`} />
                  )}
                </button>`;


if (code.includes('export default function CaseSheetView({')) {
  // inject helper outside component
  code = code.replace(
    'export default function CaseSheetView({',
    helper + '\\nexport default function CaseSheetView({'
  );
  
  // inject tabHasData inside component
  const insideTarget = 'const [activeTab, setActiveTab] = useState<';
  code = code.replace(insideTarget, tabHasDataStr + '\\n  ' + insideTarget);
  
  // replace nav mapping
  code = code.replace(navTarget, newNav);
  code = code.replace(oldButtonClass, newButtonClass);
  code = code.replace(oldButtonInner, newButtonInner);
  
  fs.writeFileSync('src/components/CaseSheetView.tsx', code);
  console.log('CaseSheetView patched successfully.');
} else {
  console.error('Could not patch CaseSheetView.');
}
