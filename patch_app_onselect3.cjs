const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `            setCases(prev => [caseToSave, ...prev.filter(c => c.id !== newCase.id)]);
            
            await handleSaveCase(newCase);

            switch (method) {`;

const replaceStr = `            setCases(prev => [caseToSave, ...prev.filter(c => c.id !== newCase.id)]);
            
            // Do NOT await, let it save in background so UI navigates instantly!
            handleSaveCase(newCase).catch(console.error);

            switch (method) {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched onSelect successfully (removed await)!");
} else {
  console.log("Target not found");
}
