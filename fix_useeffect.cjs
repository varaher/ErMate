const fs = require('fs');
let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf-8');

// First remove the bad one
content = content.replace(/\/\/ Automatically trigger AI Draft[\s\S]*?\}, \[\]\);\n\n  const handleAiDraft = async \(\) => \{/g, 'const handleAiDraft = async () => {');

// Now insert it AFTER handleAiDraft definition
// find the end of handleAiDraft which ends around line 630.
// Let's just find the exact place to insert it.
