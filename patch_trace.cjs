const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
`    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });`,
`    console.log("handleSaveCase: updating local cases array with", caseToSave.id);
    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });`
);
content = content.replace(
`const unsubscribeCases = onSnapshot(casesQuery, async (snapshot) => {`,
`const unsubscribeCases = onSnapshot(casesQuery, async (snapshot) => {
      console.log("onSnapshot fired! snapshot size:", snapshot.size);`
);
content = content.replace(
`      const deduplicated = Array.from(new Map(filteredCases.map(c => [c.id, c])).values());
      setCases(deduplicated);`,
`      const deduplicated = Array.from(new Map(filteredCases.map(c => [c.id, c])).values());
      console.log("onSnapshot: setting cases to size", deduplicated.length, ". Contains selectedCase?", deduplicated.some(c => c.id === selectedCaseId));
      setCases(deduplicated);`
);
fs.writeFileSync('src/App.tsx', content);
