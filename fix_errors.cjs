const fs = require('fs');
const file = 'server/sarvamBatch.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace throwing simple errors with throwing the body text
content = content.replace(/if \(!initReq\.ok\) \{\s*const errT = await initReq\.text\(\);\s*throw new Error\(\`Failed to create batch job: \$\{initReq\.status\} \$\{errT\}\`\);\s*\}/,
`if (!initReq.ok) {
        const errText = await initReq.text();
        throw new Error(\`Failed to create batch job: \${initReq.status} \${errText}\`);
    }`);

content = content.replace(/if \(!uploadFilesReq\.ok\) \{\s*throw new Error\(\`Failed to get batch upload URLs\.\`\);\s*\}/,
`if (!uploadFilesReq.ok) {
        const errText = await uploadFilesReq.text();
        throw new Error(\`Failed to get batch upload URLs: \${errText}\`);
    }`);

content = content.replace(/if \(!putReq\.ok\) \{\s*throw new Error\(\`Failed to upload audio to Sarvam storage: \$\{putReq\.statusText\}\`\);\s*\}/,
`if (!putReq.ok) {
        const errText = await putReq.text();
        throw new Error(\`Failed to upload audio to Sarvam storage: \${putReq.status} \${errText}\`);
    }`);

content = content.replace(/if \(!startReq\.ok\) \{\s*throw new Error\(\`Failed to start batch job processing\.\`\);\s*\}/,
`if (!startReq.ok) {
        const errText = await startReq.text();
        throw new Error(\`Failed to start batch job processing: \${startReq.status} \${errText}\`);
    }`);

fs.writeFileSync(file, content);
