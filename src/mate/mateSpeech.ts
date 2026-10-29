/**
 * ErMate — MATE spoken replies (text-to-speech), OFF by default.
 *
 * Uses the browser's built-in speech engine only: no server, no AI call, no patient data leaves the device.
 * Safe everywhere: if the browser has no speech engine, or storage is blocked, every call is a quiet no-op.
 * Only the doctor can switch it on (setMateVoiceEnabled); nothing speaks until they do.
 */

const KEY = "ermate_mate_voice_v1";

function engine(): SpeechSynthesis | null {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window && typeof (window as any).SpeechSynthesisUtterance === "function") {
      return window.speechSynthesis;
    }
  } catch { /* ignore */ }
  return null;
}

export function isMateVoiceSupported(): boolean {
  return engine() !== null;
}

export function isMateVoiceEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setMateVoiceEnabled(on: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (on) localStorage.setItem(KEY, "on"); else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  if (!on) stopMateSpeech();
}

/** Strip markdown and emoji so the voice reads clean text. */
export function toSpokenText(text: string): string {
  return String(text || "")
    .replace(/[*_`#>]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}☀-➿⭐⭕]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Speak a reply if (and only if) the doctor has switched voice on. Returns true when speech was started. */
export function speakMate(text: string, opts?: { urgent?: boolean }): boolean {
  const synth = engine();
  if (!synth || !isMateVoiceEnabled()) return false;
  const spoken = toSpokenText(text);
  if (!spoken) return false;
  try {
    if (opts?.urgent) synth.cancel(); // a critical value interrupts a longer reply
    const u = new (window as any).SpeechSynthesisUtterance(spoken);
    u.lang = "en-IN";
    u.rate = 1;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopMateSpeech(): void {
  try { engine()?.cancel(); } catch { /* ignore */ }
}