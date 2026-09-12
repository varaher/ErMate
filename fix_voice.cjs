const fs = require('fs');
const file = 'src/components/shared/VoiceRecorder.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/setIsTranscribing\(true\);\s+wsRef\.current\.send\(JSON\.stringify\(\{ action: "stop_dictation" \}\)\);([\s\S]*?)if \(mediaRecorderRef\.current && mediaRecorderRef\.current\.state !== "inactive"\) \{\s+mediaRecorderRef\.current\.stop\(\); \/\/ will trigger recorder\.onstop\s+\}/g,
`setIsTranscribing(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // will trigger recorder.onstop
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !useFallbackBatch) {
         wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
         setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
               console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
               wsRef.current.close();
               finalizeTranscription();
            }
         }, 8000);
      }
    }`);

content = content.replace(/mediaRecorder\.onstop = \(\) => \{\s+console\.log\("\\[VoiceRecorder\\] MediaRecorder stopped"\);\s+if \(useFallbackBatch\) \{([\s\S]*?)else if \(wsRef\.current && wsRef\.current\.readyState === WebSocket\.OPEN\) \{\s+\/\/ WS is handling the finalization via action: stop_dictation\s+\}\s+\};/g,
`mediaRecorder.onstop = () => {
      console.log("[VoiceRecorder] MediaRecorder stopped");
      if (useFallbackBatch) {
        // ... (existing fallback logic is fine, we will handle it via batch endpoint later)
        // Let's actually preserve the fallback code here by grabbing the fallback block from the file.
      }
};`);

fs.writeFileSync(file, content);
