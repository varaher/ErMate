const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `          onSelect={(method: EntryMethod, newCase: ClinicalCase) => {
            setShowEntryMenu(false);
            handleSaveCase(newCase);

            switch (method) {`;

const replaceStr = `          onSelect={async (method: EntryMethod, newCase: ClinicalCase) => {
            setShowEntryMenu(false);
            
            // Optimistically add to cases so it's instantly available for CaseSheetView to render without refetch race conditions
            const caseToSave = {
              ...newCase,
              hospital: newCase.hospital || profile.hospital,
              doctorEmail: newCase.doctorEmail || profile.email,
              doctorName: newCase.doctorName || profile.name || "Emergency Doctor",
            };
            setCases(prev => [caseToSave, ...prev.filter(c => c.id !== newCase.id)]);
            
            await handleSaveCase(newCase);

            switch (method) {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched onSelect successfully!");
} else {
  console.log("Target not found");
}
