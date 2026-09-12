const fs = require('fs');
let content = fs.readFileSync('src/components/shared/VoiceRecorder.tsx', 'utf8');

// Add finalSubmissionSentRef
const refTarget = /const isStoppingRef = useRef<boolean>\(false\);/;
const refReplace = `const isStoppingRef = useRef<boolean>(false);
  const finalSubmissionSentRef = useRef<boolean>(false);`;
content = content.replace(refTarget, refReplace);

// Reset it in startRecording
const startTarget = /isStoppingRef\.current = false;/;
const startReplace = `isStoppingRef.current = false;
    finalSubmissionSentRef.current = false;`;
content = content.replace(startTarget, startReplace);

// Guard finalizeTranscription
const finalTarget = /const finalizeTranscription = \(\) => \{/;
const finalReplace = `const finalizeTranscription = () => {
    if (finalSubmissionSentRef.current) return;
    finalSubmissionSentRef.current = true;`;
content = content.replace(finalTarget, finalReplace);

fs.writeFileSync('src/components/shared/VoiceRecorder.tsx', content);
