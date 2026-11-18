// Chat-window length guard for MATE: warn at 80%, ask to continue in a new window at 90%.
// Pure helpers (no React) so they can be tested. Budget is in characters, not tokens.

export const CHAT_CHAR_BUDGET = 60000;
export const CHAT_WARN_AT = 0.8;
export const CHAT_FULL_AT = 0.9;

export interface LimitMessage { id?: string; sender?: string; text?: string }

export function chatUsedChars(messages: LimitMessage[]): number {
  let n = 0;
  for (const m of messages || []) {
    if (m && m.id !== "welcome" && typeof m.text === "string") n += m.text.length;
  }
  return n;
}

/** 0..1+ share of the budget used. */
export function chatUsage(messages: LimitMessage[], budget: number = CHAT_CHAR_BUDGET): number {
  return budget > 0 ? chatUsedChars(messages) / budget : 0;
}

export type ChatLimitLevel = "ok" | "warn" | "full";

export function chatLimitLevel(usage: number): ChatLimitLevel {
  if (usage >= CHAT_FULL_AT) return "full";
  if (usage >= CHAT_WARN_AT) return "warn";
  return "ok";
}

const BED_RE = /\bbed\s*(?:no\.?\s*)?(\d{1,3}\s?[A-Za-z]?)\b/gi;

/**
 * Short hand-over text placed at the top of the next window: which beds were discussed and the latest
 * thing said about each. Built locally from the chat, so nothing leaves the device and nothing is invented.
 * Patient case sheets stay in their own records; this only saves re-explaining.
 */
export function buildCarryOver(messages: LimitMessage[]): string {
  const latest = new Map<string, string>();
  for (const m of messages || []) {
    if (!m || m.id === "welcome" || typeof m.text !== "string") continue;
    const text = m.text.replace(/\s+/g, " ").trim();
    BED_RE.lastIndex = 0;
    let hit: RegExpExecArray | null;
    while ((hit = BED_RE.exec(text))) {
      const bed = hit[1].replace(/\s+/g, "").toUpperCase();
      const from = Math.max(0, hit.index - 10);
      latest.set(bed, text.slice(from, from + 160).trim());
    }
  }
  const lines = [...latest.entries()].slice(-12).map(([bed, line]) => `• Bed ${bed}: ${line}`);
  const head = "Continued from your previous window. Saved case sheets are unchanged.";
  if (!lines.length) return `${head}\nNothing pending was mentioned by bed. Start by saying the bed number.`;
  return `${head}\nBeds discussed so far:\n${lines.join("\n")}\nTell me the bed number to carry on with any of them.`;
}