export function sanitizeDoctorError(rawMsg: any): string {
  if (!rawMsg) return "Voice or AI service temporarily unavailable. Please try again.";
  const str = typeof rawMsg === "string" ? rawMsg : (rawMsg.message || JSON.stringify(rawMsg));

  const lower = str.toLowerCase();
  
  if (lower.includes("resource_exhausted") || lower.includes("429") || lower.includes("quota") || lower.includes("rate limit") || lower.includes("overloaded")) {
    return "AI model rate limit reached. Local clinical engine activated for your request.";
  }
  
  if (lower.includes("microphone") || lower.includes("notallowederror") || lower.includes("permission denied")) {
    return "Microphone access blocked. Please check your browser microphone permissions.";
  }

  if (lower.includes("cookie") || lower.includes("iframe")) {
    return "Iframe security cookies restricted. Please open the application in a new tab.";
  }

  if (lower.includes("typeerror") || lower.includes("syntaxerror") || lower.includes("internal server error")) {
    return "Server response error. Local clinical fallback activated.";
  }

  if (str.length > 180) {
    return str.slice(0, 180) + "...";
  }

  return str;
}
