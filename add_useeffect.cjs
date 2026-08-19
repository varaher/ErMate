const fs = require('fs');
let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf-8');

const useEffectCode = `
  // Automatically trigger AI Draft / Course Generation on mount if not already done
  useEffect(() => {
    if (!currentCase.dischargeInfo?.courseInHospital && !aiDrafted && !aiLoading) {
      handleAiDraft();
    }
  }, []);

  const handleAiDraft = async () => {`;

content = content.replace(/const handleAiDraft = async \(\) => \{/, useEffectCode);

fs.writeFileSync('src/components/DischargeSummaryView.tsx', content);
