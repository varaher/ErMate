const fs = require('fs');
const file = 'server/sarvamBatch.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
    // 6. Read the output filename from the completed job details
    let outputFilename = null;
    if (jobDetails.job_details && jobDetails.job_details.length > 0) {
        const details = jobDetails.job_details[0];
        if (details.outputs && details.outputs.length > 0) {
            outputFilename = details.outputs[0].file_name || details.outputs[0].name;
        }
    }
    
    // Default fallback
    if (!outputFilename) {
         outputFilename = \`0.json\`;
    }
`;

content = content.replace(/\/\/ 6\. Read the output filename from the completed job details[\s\S]*?if \(\!outputFilename\) \{\s*outputFilename \= \`\$\{safeFilename\}\.json\`;\s*\}/, replacement);

fs.writeFileSync(file, content);
