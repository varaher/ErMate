import FormData from "form-data";

/**
 * server/sarvamClient.ts
 *
 * Ported from the old ErMate app — this is a clean, self-contained
 * ErMate AI integration layer. One function per ErMate capability, consistent
 * error handling, single API-key accessor.
 *
 * IMPORTANT: this file operates on RAW audio/text — it does NOT and
 * CANNOT de-identify anything. PHI de-identification only works on
 * text AFTER transcription produces it (deidentifyText() in
 * deidentify.ts). Whatever calls sarvamSpeechToText() below must NOT
 * treat its output as safe to log, store long-term, or forward
 * anywhere until it has passed through deidentifyText() first.
 */

const SARVAM_API_BASE = "https://api.sarvam.ai";

function getErMateApiKey(): string | null {
  return process.env.SARVAM_AI_API_KEY || process.env.SARVAM_API_KEY || null;
}

export interface ErMateTranscriptionResult {
  transcript: string;
  language_code?: string;
}

/**
 * Transcribe audio, keeping the output in whatever language was
 * spoken (e.g. Malayalam audio -> Malayalam text). Use this when the
 * downstream pipeline should preserve the original language.
 */
export async function sarvamSpeechToText(
  audioBuffer: Buffer,
  filename: string,
  languageCode: string = "unknown"
): Promise<ErMateTranscriptionResult> {
  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: filename,
    contentType: getAudioMimeType(filename),
  });
  formData.append("model", "saaras:v3");
  formData.append("language_code", languageCode);
  formData.append("mode", "transcribe");

  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer() as unknown as BodyInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ErMate Voice] Error:", response.status, errorText);
    
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(`ErMate Voice failed: ${parsedMsg}`);

  }

  const result = (await response.json()) as ErMateTranscriptionResult;
  console.log(
    "[ErMate Voice] Success, language:",
    result.language_code,
    "transcript length:",
    result.transcript?.length
  );
  return result;
}

/**
 * Transcribe AND translate to English in one call. Use this when the
 * downstream pipeline (extraction, reasoning) should always receive
 * English regardless of what language the doctor spoke.
 */
export async function sarvamSpeechToTextTranslate(
  audioBuffer: Buffer,
  filename: string
): Promise<ErMateTranscriptionResult> {
  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: filename,
    contentType: getAudioMimeType(filename),
  });
  formData.append("model", "saaras:v3");
  formData.append("mode", "translate");

  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer() as unknown as BodyInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ErMate Voice Translate] Error:", response.status, errorText);
    
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(`ErMate Voice Translate failed: ${parsedMsg}`);

  }

  const result = (await response.json()) as ErMateTranscriptionResult;
  console.log("[ErMate Voice Translate] Success, language:", result.language_code);
  return result;
}

export interface ErMateDocParseResult {
  output: string;
  parsed_text?: string;
}

/**
 * Parse a PDF (e.g. a scanned referral letter) into text via ErMate's
 * document parsing endpoint.
 */
export async function sarvamParsePDF(
  pdfBuffer: Buffer,
  pageNumber: number = 1
): Promise<string> {
  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured");
  }

  const formData = new FormData();
  formData.append("pdf", pdfBuffer, {
    filename: "document.pdf",
    contentType: "application/pdf",
  });
  formData.append("page_number", String(pageNumber));
  formData.append("sarvam_mode", "large");

  const response = await fetch(`${SARVAM_API_BASE}/parse/parsepdf`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer() as unknown as BodyInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ErMate Parse] Error:", response.status, errorText);
    
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(`ErMate Document Parse failed: ${parsedMsg}`);

  }

  const result = (await response.json()) as ErMateDocParseResult;

  if (result.output) {
    try {
      const decoded = Buffer.from(result.output, "base64").toString("utf-8");
      return decoded;
    } catch {
      return result.output;
    }
  }

  return result.parsed_text || "";
}

export interface ErMateTranslateResult {
  translated_text: string;
  source_language_code?: string;
}

/**
 * Translate already-existing TEXT to English (no audio involved).
 * mode: "code-mixed" handles Hinglish-style mixed-language sentences
 * correctly rather than choking on them.
 */
export async function sarvamTranslateToEnglish(
  text: string
): Promise<ErMateTranslateResult> {
  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured");
  }

  const response = await fetch(`${SARVAM_API_BASE}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: "auto",
      target_language_code: "en-IN",
      mode: "code-mixed",
      model: "mayura:v1",
      numerals_format: "international",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ErMate Translate] Error:", response.status, errorText);
    
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) {
        parsedMsg = parsed.error.message;
      } else if (parsed.message) {
        parsedMsg = parsed.message;
      }
    } catch(e) {}
    throw new Error(`ErMate Translation failed: ${parsedMsg}`);

  }

  const result = (await response.json()) as ErMateTranslateResult;
  console.log(
    "[ErMate Translate] Success, source language:",
    result.source_language_code,
    "output length:",
    result.translated_text?.length
  );
  return result;
}

export function isErMateAvailable(): boolean {
  return !!getErMateApiKey();
}

function getAudioMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    amr: "audio/amr",
    wma: "audio/x-ms-wma",
    opus: "audio/opus",
    caf: "audio/x-caf",
    mp4: "audio/mp4",
  };
  return mimeMap[ext] || "audio/mpeg";
}
