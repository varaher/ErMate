const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const importStr = `import { sarvamBatchTranscribe } from "./server/sarvamBatch";\n`;
if (!content.includes('sarvamBatchTranscribe')) {
    content = content.replace('import { performTranscription } from "./server/sarvamClient";', 
    `import { performTranscription } from "./server/sarvamClient";\n${importStr}`);
}

const batchEndpoint = `
// 4c. True Batch STT Fallback
app.post("/api/sarvam/batch-transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }
  const mode = req.body.mode || "translate";
  try {
    const result = await sarvamBatchTranscribe(req.file.buffer, req.file.originalname || "dictation.webm", mode);
    res.json(result);
  } catch (error: any) {
    console.error("Batch ASR Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during batch speech transcription."
    });
  }
});
`;

if (!content.includes('/api/sarvam/batch-transcribe')) {
    content = content.replace(/\/\/ 4b\. Upgraded Unified Transcription Endpoint/, `${batchEndpoint}\n\n// 4b. Upgraded Unified Transcription Endpoint`);
    fs.writeFileSync(file, content);
}

