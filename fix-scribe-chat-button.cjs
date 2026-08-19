const fs = require('fs');

function patchFile(file, original, replacement) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes(replacement)) {
    console.log(file + " already patched.");
    return;
  }
  code = code.replace(original, replacement);
  fs.writeFileSync(file, code);
  console.log(file + " patched.");
}

// In VoiceScribeChatView.tsx, let's also ensure the button itself is clickable by raising its z-index if needed
const originalBtn = '<button \n            onClick={() => setIsCaseSheetOpen(!isCaseSheetOpen)}\n            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all shadow-sm active:scale-95 ${isCaseSheetOpen ? \'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300\' : \'bg-indigo-600 text-white hover:bg-indigo-700\'}`}';

const newBtn = '<button \n            onClick={() => setIsCaseSheetOpen(!isCaseSheetOpen)}\n            className={`relative z-50 flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all shadow-sm active:scale-95 ${isCaseSheetOpen ? \'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300\' : \'bg-indigo-600 text-white hover:bg-indigo-700\'}`}';

patchFile('src/components/VoiceScribeChatView.tsx', originalBtn, newBtn);

