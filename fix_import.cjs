const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { sarvamBatchTranscribe }')) {
    const importStmt = 'import { sarvamBatchTranscribe } from "./server/sarvamBatch.js";\n';
    content = content.replace('import { initSarvamRealtimeStream } from "./server/sarvamRealtimeStream.js";',
        importStmt + 'import { initSarvamRealtimeStream } from "./server/sarvamRealtimeStream.js";');
    fs.writeFileSync(file, content);
}
