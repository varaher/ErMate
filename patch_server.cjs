const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/import \{ convertAudioToWav \} from "\.\/server\/audioConvert\.ts";/g, 'import { convertAndChunkAudioToWav } from "./server/audioConvert.ts";');

const oldPerform = `async function performTranscription(file: Express.Multer.File, languageCode: string, model: string): Promise<{ success: boolean; transcript: string; method: string }> {
  // Reject files smaller than 500 bytes (Validation: filter empty/accidental taps)
  if (file.size < 500) {
    throw new Error("Audio capture too short. Please dictate for a longer duration.");
  }

  const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
  if (!sarvamKey || sarvamKey === "MY_SARVAM_API_KEY" || sarvamKey.trim() === "") {
    throw new Error("Sarvam AI API key is missing or invalid. Transcription is disabled.");
  }

  // Force size limit check for Sarvam (900KB)
  if (file.size > 900 * 1024) {
    throw new Error("Voice dictation audio size exceeds the 900KB limit.");
  }

  // Convert audio format to 16kHz mono WAV for Sarvam
  let activeBuffer = file.buffer;
  let activeFilename = file.originalname || "recording.webm";

  try {
    const converted = await convertAudioToWav(file.buffer, file.originalname || "recording.webm");
    if (converted && converted.buffer && converted.buffer.length > 0) {
      activeBuffer = converted.buffer;
      activeFilename = converted.filename;
    } else {
      console.warn("[Transcription] FFmpeg output empty, using original audio buffer.");
    }
  } catch (convErr: any) {
    console.warn(\`[Transcription] FFmpeg conversion failed (falling back to original audio): \${convErr.message}\`);
  }

  // Use the shared self-contained Sarvam STT Translation capability
  try {
    console.log(\`[Transcription] Querying Sarvam Speech-to-Text (Translate mode)\`);
    const result = await sarvamSpeechToTextTranslate(activeBuffer, activeFilename);
    if (!result.transcript || !result.transcript.trim()) {
      return {
        success: true,
        transcript: "Clinical dictation recorded successfully. Please specify or confirm patient findings in chat.",
        method: "safety_fallback"
      };
    }
    return {
      success: true,
      transcript: result.transcript.trim(),
      method: "sarvam"
    };
  } catch (err: any) {
    console.error(\`[Transcription] Sarvam exception: \${err.message}\`);
    throw new Error(\`Voice transcription failed: \${err.message}\`);
  }
}`;

const newPerform = `async function performTranscription(file: Express.Multer.File, languageCode: string, model: string): Promise<{ success: boolean; transcript: string; method: string }> {
  if (file.size < 500) {
    throw new Error("Audio capture too short. Please dictate for a longer duration.");
  }

  const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
  if (!sarvamKey || sarvamKey === "MY_SARVAM_API_KEY" || sarvamKey.trim() === "") {
    throw new Error("ErMate Voice API key is missing or invalid. Transcription is disabled.");
  }

  // Maximum size 50MB
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Voice dictation audio size exceeds the 50MB limit.");
  }

  let chunks: { buffer: Buffer; filename: string }[] = [];
  try {
    chunks = await convertAndChunkAudioToWav(file.buffer, file.originalname || "recording.webm");
  } catch (convErr: any) {
    console.warn(\`[Transcription] FFmpeg conversion/chunking failed: \${convErr.message}\`);
    chunks = [{ buffer: file.buffer, filename: file.originalname || "recording.webm" }];
  }

  if (chunks.length === 0) {
    chunks = [{ buffer: file.buffer, filename: file.originalname || "recording.webm" }];
  }

  try {
    let finalTranscript = "";
    console.log(\`[Transcription] Processing \${chunks.length} chunks via ErMate Voice API\`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(\`[Transcription] Querying chunk \${i + 1}/\${chunks.length}\`);
      const result = await sarvamSpeechToTextTranslate(chunk.buffer, chunk.filename);
      if (result && result.transcript) {
        finalTranscript += result.transcript.trim() + " ";
      }
    }

    if (!finalTranscript.trim()) {
      return {
        success: true,
        transcript: "Clinical dictation recorded successfully. Please specify or confirm patient findings in chat.",
        method: "safety_fallback"
      };
    }
    return {
      success: true,
      transcript: finalTranscript.trim(),
      method: "ermate_voice"
    };
  } catch (err: any) {
    console.error(\`[Transcription] Voice exception: \${err.message}\`);
    throw new Error(\`Voice transcription failed: \${err.message}\`);
  }
}`;

code = code.replace(oldPerform, newPerform);
fs.writeFileSync('server.ts', code);
