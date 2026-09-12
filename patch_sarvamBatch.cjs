const fs = require('fs');

let content = fs.readFileSync('server/sarvamBatch.ts', 'utf8');

// Ensure child_process is imported
if (!content.includes('import { spawn } from "child_process";')) {
    content = content.replace('import fetch from "node-fetch";', 'import fetch from "node-fetch";\nimport { spawn } from "child_process";');
}

const target = `  const safeFilename = \`audio_\${Date.now()}.webm\`; 
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, safeFilename);
  
  try {
    // Write buffer to a temporary file
    fs.writeFileSync(tmpPath, audioBuffer);`;

const replacement = `  const timestamp = Date.now();
  const safeFilename = \`audio_\${timestamp}.wav\`; // Target must be .wav
  const tmpDir = os.tmpdir();
  const tmpInputPath = path.join(tmpDir, \`input_\${timestamp}.webm\`);
  const tmpWavPath = path.join(tmpDir, safeFilename);
  
  let normalizedBuffer: Buffer | null = null;
  
  try {
    // Write raw browser buffer to a temporary input file
    fs.writeFileSync(tmpInputPath, audioBuffer);
    
    // Normalize using FFmpeg
    await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            "-y",
            "-i", tmpInputPath,
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            tmpWavPath
        ]);
        ffmpeg.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(\`FFmpeg failed to normalize audio with code \${code}\`));
        });
        ffmpeg.on("error", reject);
    });
    
    normalizedBuffer = fs.readFileSync(tmpWavPath);
    if (!normalizedBuffer || normalizedBuffer.length === 0) {
        throw new Error("Normalized WAV buffer is empty.");
    }`;

content = content.replace(target, replacement);

const targetUpload = `    // 3. PUT the audio file to the presigned upload URL
    const putReq = await fetch(uploadUrl, {
        method: "PUT",
        body: audioBuffer,
        headers: {
            "x-ms-blob-type": "BlockBlob",
            "Content-Length": String(audioBuffer.length)
        }
    });`;

const replacementUpload = `    // 3. PUT the audio file to the presigned upload URL
    const putReq = await fetch(uploadUrl, {
        method: "PUT",
        body: normalizedBuffer,
        headers: {
            "x-ms-blob-type": "BlockBlob",
            "Content-Length": String(normalizedBuffer.length)
        }
    });`;

content = content.replace(targetUpload, replacementUpload);

const targetFinally = `  } finally {
      // Security: Always delete the temporary patient audio file immediately after processing/failure
      try {
          if (fs.existsSync(tmpPath)) {
              fs.unlinkSync(tmpPath);
          }
      } catch (e) {
          console.error(\`[SarvamBatch] Failed to delete temporary audio file: \${tmpPath}\`);
      }
  }`;

const replacementFinally = `  } finally {
      // Security: Always delete the temporary patient audio files immediately after processing/failure
      try {
          if (fs.existsSync(tmpInputPath)) {
              fs.unlinkSync(tmpInputPath);
          }
      } catch (e) {
          console.error(\`[SarvamBatch] Failed to delete temporary input file: \${tmpInputPath}\`);
      }
      try {
          if (fs.existsSync(tmpWavPath)) {
              fs.unlinkSync(tmpWavPath);
          }
      } catch (e) {
          console.error(\`[SarvamBatch] Failed to delete temporary WAV file: \${tmpWavPath}\`);
      }
  }`;

content = content.replace(targetFinally, replacementFinally);

fs.writeFileSync('server/sarvamBatch.ts', content);
