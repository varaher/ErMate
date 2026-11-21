import FormData from "form-data";
import { getErMateApiKey, sarvamParsePDF } from "./sarvamClient.ts";

const SARVAM_API_BASE = "https://api.sarvam.ai";

export interface SarvamOcrResult {
  text: string;
}

/**
 * Reads text from a scanned clinical page or PDF using Sarvam Vision / Document Parse.
 * The image stays with Sarvam (Indian provider) and is never sent to overseas LLMs.
 */
export async function sarvamOcr(
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<SarvamOcrResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty document buffer provided for OCR.");
  }

  const normalizedMime = (mimeType || "image/jpeg").toLowerCase().trim();
  if (normalizedMime === "application/pdf" || normalizedMime.endsWith("/pdf")) {
    const text = await sarvamParsePDF(buffer, 1);
    if (!text || !text.trim()) {
      throw new Error("No readable text returned from PDF scan.");
    }
    return { text: text.trim() };
  }

  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured");
  }

  const ext = normalizedMime.includes("png")
    ? "png"
    : normalizedMime.includes("webp")
    ? "webp"
    : "jpg";

  const formData = new FormData();
  formData.append("file", buffer, {
    filename: `scan.${ext}`,
    contentType: normalizedMime,
  });
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
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sarvam Vision OCR failed (${response.status}): ${errorText || "Unable to read document"}`);
  }

  const result = (await response.json().catch(() => ({}))) as {
    output?: string;
    parsed_text?: string;
    text?: string;
  };

  let extractedText = "";
  if (result.output) {
    try {
      extractedText = Buffer.from(result.output, "base64").toString("utf-8");
    } catch {
      extractedText = result.output;
    }
  } else {
    extractedText = result.parsed_text || result.text || "";
  }

  if (!extractedText || !extractedText.trim()) {
    throw new Error("No readable text detected in the scanned image.");
  }

  return { text: extractedText.trim() };
}
