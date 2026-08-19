const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add state variable
code = code.replace(
  'const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);',
  'const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);\n  const [pendingNewCase, setPendingNewCase] = useState<ClinicalCase | null>(null);'
);

// 2. Add to onSelect
const onSelectTarget = `              case "type":
              case "adult-direct":
              case "pediatric-direct":
                setSelectedCaseId(newCase.id);`;
                
const onSelectReplacement = `              case "type":
              case "adult-direct":
              case "pediatric-direct":
                setPendingNewCase(caseToSave);
                setSelectedCaseId(newCase.id);`;
code = code.replace(onSelectTarget, onSelectReplacement);

// 3. Update the CaseSheetView render logic
const renderTarget = `          {/* 2. Full Case Sheet View (Editable Form) */}
          {selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            (() => {
              const matched = cases.find(c => c.id === selectedCaseId);
              if (!matched) return <p>Case not found</p>;`;
              
const renderReplacement = `          {/* 2. Full Case Sheet View (Editable Form) */}
          {selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            (() => {
              const matched = cases.find(c => c.id === selectedCaseId) || (pendingNewCase?.id === selectedCaseId ? pendingNewCase : null);
              if (!matched) return <p>Case not found</p>;`;
code = code.replace(renderTarget, renderReplacement);

// 4. Update the onBack in CaseSheetView
const onBackTarget = `                  onBack={() => setSelectedCaseId(null)}`;
const onBackReplacement = `                  onBack={() => {
                    setPendingNewCase(null);
                    setSelectedCaseId(null);
                  }}`;
code = code.replace(onBackTarget, onBackReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx with pendingNewCase logic");
