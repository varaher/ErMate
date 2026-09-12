const fs = require('fs');

// 1. Rewrite VoiceRecorder.tsx to fix the finishRecording and recorder.onstop logic
let file = 'src/components/shared/VoiceRecorder.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/finishRecording \= \(\) \=\> \{[\s\S]*?const finalizeTranscription \= \(\) \=\> \{/,
`finishRecording = () => {
    isStoppingRef.current = true;
    if (mediaRecorderRef.current) {
      const listener = (mediaRecorderRef.current as any)._visibilityListener;
      if (listener) document.removeEventListener("visibilitychange", listener);
    }
    
    // Stop the media recorder FIRST. This triggers recorder.onstop.
    // Inside onstop, we will handle sending stop_dictation if the WS is open.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
    } else {
      // If it's already inactive for some reason, directly trigger cleanup
      setIsTranscribing(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !useFallbackBatch) {
         wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
         setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
               console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
               wsRef.current.close();
               finalizeTranscription();
            }
         }, 8000);
      } else if (useFallbackBatch && audioChunksRef.current.length > 0) {
         const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
         transcribeAudioBatch(audioBlob, "audio/webm");
      } else {
         finalizeTranscription();
      }
    }
  };

  const finalizeTranscription = () => {`);

// Now replace recorder.onstop
content = content.replace(/const actualMime \= recorder\.mimeType \|\| mimeType;[\s\S]*?recorder\.start\(250\);/,
`const actualMime = recorder.mimeType || mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        
        setIsRecording(false);
        setIsPaused(false);
        
        if (useFallbackBatch) {
            setIsTranscribing(true);
            if (document.visibilityState === "hidden") {
              const resumeTranscribing = () => {
                 if (document.visibilityState === "visible") {
                    document.removeEventListener("visibilitychange", resumeTranscribing);
                    transcribeAudioBatch(audioBlob, actualMime);
                 }
              };
              document.addEventListener("visibilitychange", resumeTranscribing);
            } else {
              await transcribeAudioBatch(audioBlob, actualMime);
            }
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setIsTranscribing(true);
            // Instruct backend to flush FFmpeg and finalize VAD buffer
            wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
            
            // Fallback timeout in case WS hangs during closure waiting for session.end
            setTimeout(() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                 console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
                 wsRef.current.close();
                 finalizeTranscription();
              }
            }, 8000);
        } else {
            finalizeTranscription();
        }
      };

      // 250ms chunks are ideal for near real-time streaming
      recorder.start(250);`);

// Replace endpoint from /api/sarvam/transcribe to /api/sarvam/batch-transcribe
content = content.replace(/\/api\/sarvam\/transcribe/g, "/api/sarvam/batch-transcribe");

fs.writeFileSync(file, content);
