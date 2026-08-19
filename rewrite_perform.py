import re

with open('server.ts', 'r') as f:
    content = f.read()

new_perform = """async function performTranscription(file: Express.Multer.File, languageCode: string, model: string): Promise<{ success: boolean; transcript: string; method: string }> {
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
    console.warn(`[Transcription] FFmpeg conversion failed (falling back to original audio): ${convErr.message}`);
  }

  // Use the shared self-contained Sarvam STT Translation capability
  try {
    console.log(`[Transcription] Querying Sarvam Speech-to-Text (Translate mode)`);
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
    console.error(`[Transcription] Sarvam exception: ${err.message}`);
    throw new Error(`Voice transcription failed: ${err.message}`);
  }
}"""

# The start is "async function performTranscription"
# The end is right before "// 4a. Legacy endpoint proxy (Layer 3 compliant)"
pattern = r"async function performTranscription\(.*?method: \"safety_fallback\"\n  \};\n\}"

replaced = re.sub(pattern, new_perform, content, flags=re.DOTALL)

with open('server.ts', 'w') as f:
    f.write(replaced)

print("Replaced performTranscription")
