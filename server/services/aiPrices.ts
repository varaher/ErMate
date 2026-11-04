/**
 * AI provider price table — the ONE place ErMate turns usage into rupees.
 *
 * Every cost the admin portal shows is computed from this file and labelled "Estimated
 * (price table)" until Phase 3 reconciles it against each vendor's own bill.
 *
 * To update: change a rate here (or override the exchange rate with the USD_INR_RATE env var)
 * and redeploy. Past events keep the rupee cost they were logged with.
 *
 * Rates checked against public vendor price pages, Nov 2026. Re-check when a vendor changes pricing.
 */

/** USD → INR used for USD-billed vendors (Anthropic, OpenAI, Google). Override with env USD_INR_RATE. */
export function usdToInrRate(): number {
  const env = Number(process.env.USD_INR_RATE);
  return Number.isFinite(env) && env > 0 ? env : 88;
}

type TokenRate = { inUsdPerM: number; outUsdPerM: number };

/**
 * USD per million tokens. Matched by prefix, longest first, so "claude-haiku-4-5-20251001"
 * matches "claude-haiku-4-5". Unknown models fall back to their provider's most expensive
 * row so an unrecognised model is never silently under-costed.
 */
const TOKEN_RATES: Record<string, TokenRate> = {
  // Anthropic
  "claude-opus-4":      { inUsdPerM: 15,   outUsdPerM: 75 },
  "claude-sonnet-4":    { inUsdPerM: 3,    outUsdPerM: 15 },
  "claude-3-5-sonnet":  { inUsdPerM: 3,    outUsdPerM: 15 },
  "claude-3.5-sonnet":  { inUsdPerM: 3,    outUsdPerM: 15 },
  "claude-haiku-4-5":   { inUsdPerM: 1,    outUsdPerM: 5 },
  "claude-3-5-haiku":   { inUsdPerM: 0.8,  outUsdPerM: 4 },
  "claude-3.5-haiku":   { inUsdPerM: 0.8,  outUsdPerM: 4 },
  // OpenAI
  "gpt-4o-mini":        { inUsdPerM: 0.15, outUsdPerM: 0.6 },
  "gpt-4o":             { inUsdPerM: 2.5,  outUsdPerM: 10 },
  "gpt-4.1-mini":       { inUsdPerM: 0.4,  outUsdPerM: 1.6 },
  "gpt-4.1":            { inUsdPerM: 2,    outUsdPerM: 8 },
  // Google
  "gemini-2.5-pro":     { inUsdPerM: 1.25, outUsdPerM: 10 },
  "gemini-2.5-flash":   { inUsdPerM: 0.3,  outUsdPerM: 2.5 },
  "gemini-2.0-flash":   { inUsdPerM: 0.1,  outUsdPerM: 0.4 },
  "gemini-1.5-flash":   { inUsdPerM: 0.075, outUsdPerM: 0.3 },
};

const PROVIDER_FALLBACK: Record<string, TokenRate> = {
  anthropic: TOKEN_RATES["claude-opus-4"],
  openai: TOKEN_RATES["gpt-4o"],
  google: TOKEN_RATES["gemini-2.5-pro"],
};

const SORTED_KEYS = Object.keys(TOKEN_RATES).sort((a, b) => b.length - a.length);

export function tokenRateFor(provider: string, model: string): { rate: TokenRate; known: boolean } {
  const m = String(model || "").toLowerCase().replace(/^models\//, "");
  const key = SORTED_KEYS.find(k => m.startsWith(k));
  if (key) return { rate: TOKEN_RATES[key], known: true };
  return { rate: PROVIDER_FALLBACK[provider] || PROVIDER_FALLBACK.anthropic, known: false };
}

/** Sarvam speech-to-text, rupees per hour of audio (batch, sync and realtime). */
export const SARVAM_STT_INR_PER_HOUR = 30;
/** Sarvam text translate, rupees per 10,000 characters. */
export const SARVAM_TRANSLATE_INR_PER_10K_CHARS = 20;
/** Used only when a call's size cannot be measured (e.g. a Sarvam PDF parse). Labelled "per-call estimate". */
export const PER_CALL_FALLBACK_INR: Record<string, number> = {
  sarvam: 0.5,
};

export type CostBasis = "tokens" | "audio" | "characters" | "per_call_estimate" | "none";

export function tokenCostInr(provider: string, model: string, inputTokens: number, outputTokens: number): { costInr: number; known: boolean } {
  const { rate, known } = tokenRateFor(provider, model);
  const usd = (inputTokens / 1e6) * rate.inUsdPerM + (outputTokens / 1e6) * rate.outUsdPerM;
  return { costInr: round4(usd * usdToInrRate()), known };
}

export function audioCostInr(seconds: number): number {
  return round4((seconds / 3600) * SARVAM_STT_INR_PER_HOUR);
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}