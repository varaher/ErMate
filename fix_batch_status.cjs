const fs = require('fs');
const file = 'server/sarvamBatch.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
        if (status === "Completed" || status === "completed" || status === "success" || status === "done") {
            if (jobDetails.failed_files_count > 0 || jobDetails.successful_files_count === 0) {
                 const errDetail = jobDetails.job_details?.[0]?.error_message || "Unknown upstream error";
                 throw new Error(\`ErMate Batch Dictation Error: \${errDetail}\`);
            }
            break;
        } else if (status === "Failed" || status === "failed" || status === "error") {
            throw new Error("ErMate Batch Dictation Error: The upstream processing engine failed to transcribe the audio.");
        }
`;

content = content.replace(/if \(status === "Completed"[\s\S]*?throw new Error\("ErMate Batch Dictation Error: The upstream processing engine failed to transcribe the audio\."\);\s*\}/, replacement);

fs.writeFileSync(file, content);
