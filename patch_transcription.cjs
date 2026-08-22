const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetBlock = `  try {
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
  }`;

const replacementBlock = `  try {
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
    console.warn(\`[Transcription] Sarvam Voice exception: \${err.message}. Falling back to native Gemini 1.5 Flash...\`);
    
    // NATIVE GEMINI 1.5 FLASH FALLBACK FOR AUDIO
    try {
      const ai = getAI();
      const prompt = \`You are an expert emergency medical scribe. Listen to the following audio dictation from a doctor. Transcribe and translate the entire audio into clear, professional English. Do not add conversational filler. If the audio is empty or inaudible, return an empty string.\`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
           prompt,
           {
              inlineData: {
                 data: file.buffer.toString("base64"),
                 mimeType: file.mimetype || "audio/webm"
              }
           }
        ],
        config: {
           temperature: 0.1
        }
      });
      
      const geminiTranscript = response.text() || "";
      if (!geminiTranscript.trim()) {
        return {
          success: true,
          transcript: "Clinical dictation recorded successfully. Please specify or confirm patient findings in chat.",
          method: "safety_fallback"
        };
      }
      return {
        success: true,
        transcript: geminiTranscript.trim(),
        method: "gemini_voice_fallback"
      };
      
    } catch (geminiErr: any) {
      console.error(\`[Transcription] Gemini Voice Fallback failed: \${geminiErr.message}\`);
      throw new Error(\`Voice transcription failed: \${err.message}\`);
    }
  }`;

if (content.includes(targetBlock)) {
    content = content.replace(targetBlock, replacementBlock);
    fs.writeFileSync('server.ts', content, 'utf8');
    console.log('Update successful');
} else {
    console.log('Target block not found. Checking exact differences...');
}
