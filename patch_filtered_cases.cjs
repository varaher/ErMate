const fs = require('fs');
let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const oldFilterRegex = /\/\/ Filtered cases list based on search and triage[\s\S]*?return matchesTriage && matchesSearch;\n      }\);/;

const newFilter = `// Filtered cases list based on search and triage
      const filteredCases = activeLogs.filter(c => {
        const matchesTriage = logBookTriageFilter === "all" || 
          (logBookTriageFilter === "P1" && c.triageCategory?.includes("P1")) ||
          (logBookTriageFilter === "P2" && c.triageCategory?.includes("P2")) ||
          (logBookTriageFilter === "P3" && c.triageCategory?.includes("P3"));
          
        const searchLower = logBookSearch.toLowerCase().trim();
        const caseProcs = (c.procedures || []).join(" ").toLowerCase();
        const caseCat = (c.caseCategory || "").toLowerCase();
        
        const matchesSearch = !searchLower ||
          caseCat.includes(searchLower) ||
          caseProcs.includes(searchLower);
        
        return matchesTriage && matchesSearch;
      });`;

content = content.replace(oldFilterRegex, newFilter);
fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
