const fs = require('fs');
let content = fs.readFileSync('server/sarvamRealtimeStream.ts', 'utf8');

const target1 = /ffmpeg\.on\("close", \(\) => \{\s+console\.log\("\[SarvamRealtime\] FFmpeg process closed"\);\s+\}\);/;
const replacement1 = `ffmpeg.on("close", () => {
              console.log("[SarvamRealtime] FFmpeg process closed");
              if (!sarvamEndSent && sarvamWs?.readyState === 1) { // 1 = OPEN
                  sarvamEndSent = true;
                  sarvamWs.send(JSON.stringify({ event: "end" }));
              }
          });`;

content = content.replace(target1, replacement1);

const target2 = /if \(msg\.event === "session\.begin"\) \{[\s\S]*?\}\s*\}/;
const replacement2 = `if (msg.event === "session.begin") {
                 streamSessionBegan = true;
                 if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ type: "ready" }));
                 }
              }
              if (msg.event === "session.end") {
                 console.log("[SarvamRealtime] Received session.end from Sarvam");
                 if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ type: "session_end" }));
                 }
                 cleanup();
              }`;
content = content.replace(target2, replacement2);

fs.writeFileSync('server/sarvamRealtimeStream.ts', content);
