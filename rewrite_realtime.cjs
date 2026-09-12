const fs = require('fs');
const file = 'server/sarvamRealtimeStream.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/if \(payload\.action \=\=\= "stop_dictation"\) \{\s*cleanup\(\);\s*\}/,
`if (payload.action === "stop_dictation") {
                 console.log("[SarvamRealtime] Received stop_dictation. Flushing FFmpeg...");
                 // Drain FFmpeg but do not SIGKILL immediately.
                 if (ffmpeg && ffmpeg.stdin) {
                     ffmpeg.stdin.end(); // close stdin so ffmpeg processes remaining data
                     // ffmpeg will exit when it finishes outputting stdout.
                     // The stdout 'end' event handler will send {"event":"end"} to Sarvam.
                 } else if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
                     // If no ffmpeg, just send end to Sarvam
                     sarvamWs.send(JSON.stringify({ event: "end" }));
                 }
             }`);

content = content.replace(/ffmpeg\.stdout\.on\("end", \(\) \=\> \{\s*console\.log\("\\[SarvamRealtime\\] FFmpeg stdout ended"\);\s*\}\);/,
`ffmpeg.stdout.on("end", () => {
      console.log("[SarvamRealtime] FFmpeg stdout ended");
      if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
         console.log("[SarvamRealtime] Sending event:end to Sarvam WS");
         sarvamWs.send(JSON.stringify({ event: "end" }));
      }
    });`);

// Update Sarvam message handler to close connection ONLY when session.end is received
content = content.replace(/if \(msg\.event \=\=\= "transcript\.final"\) \{\s*clientWs\.send\(JSON\.stringify\(\{ event: "transcript\.final", text: msg\.text \}\)\);\s*\}/,
`if (msg.event === "transcript.final") {
            clientWs.send(JSON.stringify({ event: "transcript.final", text: msg.text }));
        } else if (msg.event === "session.end") {
            console.log("[SarvamRealtime] Sarvam session ended. Closing client WS.");
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ event: "session.end" }));
                clientWs.close();
            }
        }`);

fs.writeFileSync(file, content);
