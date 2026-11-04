/**
 * AI usage logging — one record for EVERY call ErMate makes to an AI vendor.
 *
 * How it works (no change needed at the ~40 call sites):
 *  1. `aiUsageContextMiddleware` (mounted first in server.ts) opens an AsyncLocalStorage scope per request,
 *     so any vendor call made while serving that request knows which doctor and which route caused it.
 *  2. `installAiUsageFetchHook()` wraps the global `fetch` once at startup. The Anthropic, OpenAI and Google SDKs
 *     and ErMate's own direct calls all use it. When a call goes to a known AI host, the hook reads the token
 *     counts from a COPY of the response (the caller's response is untouched) and logs it.
 *  3. Sarvam batch jobs and the realtime voice stream are logged explicitly where the audio length is known.
 *
 * Writes:
 *  - aiUsageEvents/{auto}   one row per call (server-only; rules deny all clients)
 *  - aiUsageDaily/{YYYY-MM-DD} running totals per day (IST) by provider, feature, model and doctor
 *
 * Safety: never throws into the caller, never delays a clinical response, never logs prompt or response text.
 * Logs everyone, including the platform admin and hospital-covered doctors whose credits are not charged.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../src/lib/firebase-admin.ts";
import {
  audioCostInr, tokenCostInr, round4, type CostBasis,
  PER_CALL_FALLBACK_INR, SARVAM_TRANSLATE_INR_PER_10K_CHARS,
} from "./aiPrices.ts";

export type AiProvider = "anthropic" | "openai" | "google" | "sarvam";

export interface AiUsageEvent {
  provider: AiProvider;
  model: string;
  feature?: string;          // defaults to the current request's route
  uid?: string | null;       // defaults to the current request's signed-in doctor
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  characters?: number;
  ok: boolean;
  httpStatus?: number;
  latencyMs?: number;
}

interface UsageScope { req?: any; uid?: string | null; feature?: string }
const scope = new AsyncLocalStorage<UsageScope>();

/** Express middleware: mount before every route so later middleware (requireAuth) fills req.user. */
export function aiUsageContextMiddleware(req: any, _res: any, next: () => void) {
  scope.run({ req }, next);
}

/** For work outside an Express request (the realtime voice WebSocket). */
export function runWithAiUsageContext<T>(ctx: { uid: string | null; feature: string }, fn: () => T): T {
  return scope.run({ uid: ctx.uid, feature: ctx.feature }, fn);
}

function currentScope(): { uid: string | null; feature: string } {
  const s = scope.getStore();
  if (!s) return { uid: null, feature: "background" };
  const uid = s.uid ?? (s.req?.user?.uid ? String(s.req.user.uid) : null);
  const raw = s.feature ?? String(s.req?.originalUrl || s.req?.url || "unknown");
  return { uid, feature: raw.split("?")[0] || "unknown" };
}

/** IST calendar day, so "today" in the portal matches the clinic's day. */
export function istDay(d: Date = new Date()): string {
  return new Date(d.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Firestore-safe map key. The original text is kept alongside in `labels`. */
export function usageKey(s: string): string {
  return String(s || "unknown").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "unknown";
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

function costFor(e: AiUsageEvent): { costInr: number; basis: CostBasis; priceKnown: boolean } {
  if (!e.ok) return { costInr: 0, basis: "none", priceKnown: true };
  if (e.provider === "sarvam") {
    if (num(e.audioSeconds)) return { costInr: audioCostInr(num(e.audioSeconds)), basis: "audio", priceKnown: true };
    if (num(e.characters)) return { costInr: round4((num(e.characters) / 10000) * SARVAM_TRANSLATE_INR_PER_10K_CHARS), basis: "characters", priceKnown: true };
    return { costInr: PER_CALL_FALLBACK_INR.sarvam, basis: "per_call_estimate", priceKnown: false };
  }
  if (num(e.inputTokens) || num(e.outputTokens)) {
    const { costInr, known } = tokenCostInr(e.provider, e.model, num(e.inputTokens), num(e.outputTokens));
    return { costInr, basis: "tokens", priceKnown: known };
  }
  return { costInr: 0, basis: "none", priceKnown: false };
}

let testSink: ((row: any, daily: any) => Promise<any>) | null = null;
/** Tests only: capture rows instead of writing to Firestore. */
export function setAiUsageSinkForTests(fn: ((row: any, daily: any) => Promise<any>) | null) { testSink = fn; }

/** Log one vendor call. Fire-and-forget: returns immediately, swallows every error. */
export function logAiUsage(e: AiUsageEvent): void {
  try {
    const ctx = currentScope();
    const uid = e.uid !== undefined ? e.uid : ctx.uid;
    const feature = e.feature || ctx.feature;
    const now = new Date();
    const day = istDay(now);
    const { costInr, basis, priceKnown } = costFor(e);
    const inputTokens = num(e.inputTokens), outputTokens = num(e.outputTokens), audioSeconds = round4(num(e.audioSeconds));
    const model = String(e.model || "unknown").replace(/^models\//, "");

    const row = {
      at: now.toISOString(), day, month: day.slice(0, 7),
      uid: uid || null, feature, provider: e.provider, model,
      inputTokens, outputTokens, audioSeconds, characters: num(e.characters),
      costInr, costBasis: basis, priceKnown,
      ok: e.ok, httpStatus: e.httpStatus ?? null, latencyMs: e.latencyMs ?? null,
    };

    const inc = FieldValue.increment;
    const p = usageKey(e.provider), f = usageKey(feature), m = usageKey(model), u = uid ? usageKey(uid) : "_anonymous";
    const fm = `${f}__${p}__${m}`;
    const failed = e.ok ? 0 : 1;
    const daily = {
      day, month: day.slice(0, 7), updatedAt: now.toISOString(),
      totals: { calls: inc(1), costInr: inc(costInr), failed: inc(failed) },
      byProvider: { [p]: { calls: inc(1), costInr: inc(costInr), failed: inc(failed) } },
      byFeatureModel: {
        [fm]: {
          calls: inc(1), costInr: inc(costInr), failed: inc(failed),
          inputTokens: inc(inputTokens), outputTokens: inc(outputTokens), audioSeconds: inc(audioSeconds),
        },
      },
      byUser: { [u]: { calls: inc(1), costInr: inc(costInr) } },
      labels: { [fm]: { feature, provider: e.provider, model } },
    };

    (testSink ? testSink(row, daily) : Promise.all([
      db.collection("aiUsageEvents").add(row),
      db.collection("aiUsageDaily").doc(day).set(daily, { merge: true }),
    ])).catch(err => console.warn("[ai-usage] log write failed (not blocking):", err?.message || err));
  } catch (err: any) {
    console.warn("[ai-usage] log failed (not blocking):", err?.message || err);
  }
}

/** Seconds of audio in a WAV buffer (also finds a WAV inside a multipart body). null when not a readable WAV. */
export function wavDurationSeconds(buf: Uint8Array | null | undefined): number | null {
  try {
    if (!buf || buf.length < 44) return null;
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    const start = b.indexOf("RIFF");
    if (start < 0 || b.toString("ascii", start + 8, start + 12) !== "WAVE") return null;
    let off = start + 12, byteRate = 0;
    while (off + 8 <= b.length) {
      const id = b.toString("ascii", off, off + 4);
      const size = b.readUInt32LE(off + 4);
      if (id === "fmt " && off + 20 <= b.length) byteRate = b.readUInt32LE(off + 16);
      if (id === "data") {
        if (!byteRate) return null;
        const available = b.length - (off + 8);
        const dataBytes = size > 0 && size <= available ? size : available;
        return dataBytes / byteRate;
      }
      off += 8 + size + (size % 2);
    }
    return null;
  } catch { return null; }
}

// ───────────────────────── global fetch hook ─────────────────────────

const HOOKED = Symbol.for("ermate.aiUsageFetchHook");

function urlOf(input: any): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return String(input?.url || "");
}

function classify(url: string): { provider: AiProvider; kind: string; pathModel?: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname, path = u.pathname;
  if (host === "api.anthropic.com") {
    return path.startsWith("/v1/messages") && !path.includes("count_tokens") ? { provider: "anthropic", kind: "messages" } : null;
  }
  if (host === "api.openai.com") {
    return /\/v1\/(chat\/completions|responses|embeddings)/.test(path) ? { provider: "openai", kind: "tokens" } : null;
  }
  if (host === "generativelanguage.googleapis.com" || host.endsWith("-aiplatform.googleapis.com")) {
    const m = path.match(/models\/([^:/]+):(generateContent|streamGenerateContent|embedContent)/);
    return m ? { provider: "google", kind: "gemini", pathModel: m[1] } : null;
  }
  if (host === "api.sarvam.ai") {
    if (path.startsWith("/speech-to-text/job")) return null;            // batch plumbing — logged once in sarvamBatch.ts
    if (path.startsWith("/speech-to-text")) return { provider: "sarvam", kind: "stt" };
    if (path.startsWith("/translate")) return { provider: "sarvam", kind: "translate" };
    return { provider: "sarvam", kind: "other" };
  }
  return null;
}

function requestBodyBytes(init: any): Uint8Array | null {
  const body = init?.body;
  if (!body) return null;
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return null;
}

function requestJson(init: any): any {
  try { return typeof init?.body === "string" ? JSON.parse(init.body) : null; } catch { return null; }
}

function parseUsage(kind: string, provider: AiProvider, body: any, reqJson: any, pathModel?: string) {
  const model = String(body?.model || body?.modelVersion || reqJson?.model || pathModel || "unknown");
  if (provider === "anthropic") {
    const u = body?.usage || {};
    return {
      model,
      inputTokens: num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens),
      outputTokens: num(u.output_tokens),
    };
  }
  if (provider === "openai") {
    const u = body?.usage || {};
    return { model, inputTokens: num(u.prompt_tokens) || num(u.input_tokens), outputTokens: num(u.completion_tokens) || num(u.output_tokens) };
  }
  if (provider === "google") {
    const u = body?.usageMetadata || {};
    return { model: String(pathModel || body?.modelVersion || model), inputTokens: num(u.promptTokenCount), outputTokens: num(u.candidatesTokenCount) + num(u.thoughtsTokenCount) };
  }
  return { model, inputTokens: 0, outputTokens: 0 };
}

export function installAiUsageFetchHook(): void {
  const g = globalThis as any;
  if (typeof g.fetch !== "function" || g.fetch[HOOKED]) return;
  const original: typeof fetch = g.fetch.bind(globalThis);

  const hooked = async function (input: any, init?: any): Promise<Response> {
    let match: ReturnType<typeof classify> = null;
    try { match = classify(urlOf(input)); } catch { match = null; }
    if (!match) return original(input, init);

    const started = Date.now();
    let res: Response;
    try {
      res = await original(input, init);
    } catch (err) {
      logAiUsage({ provider: match.provider, model: match.pathModel || requestJson(init)?.model || "unknown", ok: false, latencyMs: Date.now() - started });
      throw err;
    }

    try {
      const latencyMs = Date.now() - started;
      const m = match;
      if (m.provider === "sarvam") {
        const reqJson = requestJson(init);
        logAiUsage({
          provider: "sarvam",
          model: m.kind === "stt" ? "saaras-stt" : m.kind === "translate" ? "sarvam-translate" : "sarvam-other",
          audioSeconds: m.kind === "stt" ? (wavDurationSeconds(requestBodyBytes(init)) ?? undefined) : undefined,
          characters: m.kind === "translate" ? String(reqJson?.input || "").length : undefined,
          ok: res.ok, httpStatus: res.status, latencyMs,
        });
        return res;
      }
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.includes("json")) {
        logAiUsage({ provider: m.provider, model: m.pathModel || requestJson(init)?.model || "unknown", ok: res.ok, httpStatus: res.status, latencyMs });
        return res;
      }
      const copy = res.clone();
      const reqJson = requestJson(init);
      copy.json()
        .then(body => {
          const u = parseUsage(m.kind, m.provider, body, reqJson, m.pathModel);
          logAiUsage({ provider: m.provider, model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens, ok: true, httpStatus: res.status, latencyMs });
        })
        .catch(() => logAiUsage({ provider: m.provider, model: m.pathModel || reqJson?.model || "unknown", ok: true, httpStatus: res.status, latencyMs }));
    } catch { /* never disturb the caller */ }
    return res;
  };
  (hooked as any)[HOOKED] = true;
  g.fetch = hooked;
}