const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
`              if (!matched) return <p className="p-6 text-slate-400">Case not found</p>;`,
`              if (!matched) return <div className="p-6 text-slate-400"><p>Case not found: {selectedCaseId}</p><p>Available cases: {cases.map(c => c.id).join(", ")}</p></div>;`
);
content = content.replace(
`              if (!matched) return <p>Case not found</p>;`,
`              if (!matched) return <div className="p-6 text-red-500"><p>Case not found: {selectedCaseId}</p><p>Available cases: {cases.map(c => c.id).join(", ")}</p></div>;`
);
fs.writeFileSync('src/App.tsx', content);
