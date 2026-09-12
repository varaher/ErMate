const fs = require('fs');
let content = fs.readFileSync('src/components/shared/VoiceRecorder.tsx', 'utf8');

const target = /\} else if \(msg\.type === "error"\) \{/;
const replacement = `} else if (msg.type === "session_end" || msg.type === "closed") {
             if (isStoppingRef.current) {
                finalizeTranscription();
             }
          } else if (msg.type === "error") {`;

content = content.replace(target, replacement);

const target2 = /\} else if \(msg\.type === "closed"\) \{[\s\S]*?\}\s*\}/;
content = content.replace(target2, `}`);

fs.writeFileSync('src/components/shared/VoiceRecorder.tsx', content);
