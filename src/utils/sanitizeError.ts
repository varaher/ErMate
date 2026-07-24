export function sanitizeDoctorError(rawMsg: any): string {
  if (!rawMsg) return "Processing busy — try again shortly";
  const str = typeof rawMsg === "string" ? rawMsg : (rawMsg.message || JSON.stringify(rawMsg));

  const lower = str.toLowerCase();
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("generativelanguage") ||
    lower.includes("{") ||
    lower.includes("}") ||
    lower.includes("asr transcription failed") ||
    lower.includes("status code") ||
    lower.includes("typeerror") ||
    lower.includes("syntaxerror")
  ) {
    return "Processing busy — try again shortly";
  }

  if (str.length > 90) {
    return "Processing busy — try again shortly";
  }

  return str;
}
