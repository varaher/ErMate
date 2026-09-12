const fs = require('fs');
const file = 'server/sarvamBatch.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/body: JSON\.stringify\(\{\s*model: "saaras:v3",\s*mode: mode\s*\}\)/g, 
`body: JSON.stringify({
            job_parameters: {
                model: "saaras:v3",
                mode: mode
            }
        })`);

content = content.replace(/files: \[\{ name: safeFilename \}\]/g, `files: [safeFilename]`);

content = content.replace(/const uploadUrlObj = uploadRes\.upload_urls\?\.\[safeFilename\] \|\| uploadRes\.upload_urls\?\.\[0\];/g, 
`const uploadUrlObj = uploadRes.upload_urls?.[safeFilename];`);
// wait, in my test, `upload_urls` is an object with filenames as keys.
content = content.replace(/const uploadUrlObj = uploadRes\.upload_urls\?\.find\(\(u: any\) \=\> u\.file_name \=\=\= safeFilename\) \|\| uploadRes\.upload_urls\?\.\[0\];/g,
`const uploadUrlObj = uploadRes.upload_urls?.[safeFilename];`);
content = content.replace(/const uploadUrl = uploadUrlObj\?\.url;/g, `const uploadUrl = uploadUrlObj?.file_url;`);

content = content.replace(/body: audioStream/g, `body: audioStream,\n        headers: { "x-ms-blob-type": "BlockBlob" }`);

content = content.replace(/const statusReq = await fetch\(\`\$\{SARVAM_API_BASE\}\/speech-to-text\/job\/v1\/\$\{jobId\}\`, \{/g, 
`const statusReq = await fetch(\`\${SARVAM_API_BASE}/speech-to-text/job/v1/\${jobId}/status\`, {`);

content = content.replace(/status = jobDetails\.status \|\| jobDetails\.state \|\| status;/g, 
`status = jobDetails.job_state || jobDetails.status || jobDetails.state || status;`);

// Download files logic:
content = content.replace(/const downloadUrlObj = downloadRes\.download_urls\?\.find\(\(u: any\) \=\> u\.file_name \=\=\= outputFilename\) \|\| downloadRes\.download_urls\?\.\[0\];/g,
`const downloadUrlObj = downloadRes.download_urls?.[outputFilename];`);
content = content.replace(/const transcriptUrl = downloadUrlObj\?\.url;/g, `const transcriptUrl = downloadUrlObj?.file_url;`);

fs.writeFileSync(file, content);
