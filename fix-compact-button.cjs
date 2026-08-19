const fs = require('fs');
let code = fs.readFileSync('src/components/shared/VoiceRecorder.tsx', 'utf8');

code = code.replace(
  'className={`p-2 rounded-xl transition-all',
  'className={`p-2 rounded-full min-w-10 min-h-10 justify-center transition-all'
);
fs.writeFileSync('src/components/shared/VoiceRecorder.tsx', code);
console.log("Patched compact button shape.");
