const fs = require('fs');
let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf-8');

// Strip the current useEffect block
content = content.replace(/\/\/ Automatically trigger AI Draft[\s\S]*?\}, \[\]\);\n/g, '');

// Insert it before handleSave
const useEffectCode = `
  // Automatically trigger AI Draft / Course Generation on mount if not already done
  useEffect(() => {
    if (!currentCase.dischargeInfo?.courseInHospital && !aiDrafted && !aiLoading) {
      handleAiDraft();
    }
  }, []);

  const handleSave = () => {`;

content = content.replace(/const handleSave = \(\) => \{/g, useEffectCode);

fs.writeFileSync('src/components/DischargeSummaryView.tsx', content);
