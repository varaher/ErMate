const fs = require('fs');
let content = fs.readFileSync('server/sarvamRealtimeStream.ts', 'utf8');

// Replace multiple session.end blocks with a single one
const pattern = /(if \(msg\.event === "session\.end"\) \{[\s\S]*?cleanup\(\);\s*\}\s*){2,}/g;
content = content.replace(pattern, `if (msg.event === "session.end") {
                 console.log("[SarvamRealtime] Received session.end from Sarvam");
                 if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: "session_end" }));
                 }
                 cleanup();
              }
              `);

fs.writeFileSync('server/sarvamRealtimeStream.ts', content);
