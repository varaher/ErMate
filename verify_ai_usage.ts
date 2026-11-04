/**
 * Verifies AI usage logging (server/services/aiUsage.ts):
 *  - WAV duration parsing (plain and inside a multipart body)
 *  - fetch hook: Anthropic / OpenAI / Gemini token parsing, Sarvam audio, failures
 *  - the caller still receives the full, unread response body
 *  - non-AI requests pass straight through and are not logged
 *  - calls are attributed to the signed-in doctor and route of the current request
 *  - rupee cost uses the price table
 * Run: npx tsx verify_ai_usage.ts
 */
import { tokenCostInr, audioCostInr, usdToInrRate } from "./server/services/aiPrices";

let passed = 0, failed = 0;
const ok = (cond: any, name: string) => { if (cond) passed++; else { failed++; console.error("FAIL:", name); } };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

function wav(seconds: number, sampleRate = 16000): Buffer {
  const dataBytes = Math.round(seconds * sampleRate * 2);
  const b = Buffer.alloc(44 + dataBytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + dataBytes, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(dataBytes, 40);
  return b;
}

const responses: Record<string, () => Response> = {};
(globalThis as any).fetch = async (input: any) => {
  const url = typeof input === "string" ? input : input.url;
  const make = Object.entries(responses).find(([k]) => url.startsWith(k));
  if (!make) throw new Error("network down");
  return make[1]();
};
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function main() {
  const mod = await import("./server/services/aiUsage");
  const rows: any[] = [];
  mod.setAiUsageSinkForTests(async (row) => { rows.push(row); });
  mod.installAiUsageFetchHook();
  mod.installAiUsageFetchHook(); // idempotent
  const settle = () => new Promise(r => setTimeout(r, 30));

  // WAV parsing
  ok(near(mod.wavDurationSeconds(wav(12.5))!, 12.5), "wav 12.5 s");
  const multipart = Buffer.concat([Buffer.from("--x\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\n"), wav(3), Buffer.from("\r\n--x--\r\n")]);
  ok(near(mod.wavDurationSeconds(multipart)!, 3), "wav inside multipart (data size honoured)");
  ok(mod.wavDurationSeconds(Buffer.from("not audio at all, definitely not a wav file header")) === null, "non-wav → null");
  ok(mod.wavDurationSeconds(null) === null, "null → null");

  // Anthropic, inside a request scope with a signed-in doctor
  responses["https://api.anthropic.com/v1/messages"] = () => json({ model: "claude-sonnet-4-6", usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 200 }, content: [{ text: "hi" }] });
  const req = { user: { uid: "doc-1" }, originalUrl: "/api/ai-discharge?x=1" };
  let bodyText = "";
  await new Promise<void>(resolve => mod.aiUsageContextMiddleware(req, {}, async () => {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify({ model: "claude-sonnet-4-6" }) });
    bodyText = await r.text();
    resolve();
  }));
  await settle();
  const a = rows.pop();
  ok(bodyText.includes("\"hi\""), "caller still gets the full Anthropic body");
  ok(a?.provider === "anthropic" && a.model === "claude-sonnet-4-6", "anthropic provider/model");
  ok(a?.inputTokens === 1200 && a.outputTokens === 500, "anthropic tokens incl. cache reads");
  ok(a?.uid === "doc-1" && a.feature === "/api/ai-discharge", "attributed to doctor + route (query stripped)");
  ok(a?.costBasis === "tokens" && a.priceKnown === true, "token cost basis");
  ok(near(a.costInr, (1200 / 1e6 * 3 + 500 / 1e6 * 15) * usdToInrRate()), "anthropic ₹ cost from price table");

  // OpenAI chat completions
  responses["https://api.openai.com/v1/chat/completions"] = () => json({ model: "gpt-4o-mini-2024-07-18", usage: { prompt_tokens: 2000, completion_tokens: 100 } });
  await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4o-mini" }) });
  await settle();
  const o = rows.pop();
  ok(o?.provider === "openai" && o.inputTokens === 2000 && o.outputTokens === 100, "openai tokens");
  ok(o?.priceKnown === true && near(o.costInr, tokenCostInr("openai", "gpt-4o-mini", 2000, 100).costInr), "gpt-4o-mini priced as mini, not gpt-4o");
  ok(o?.uid === null && o.feature === "background", "outside a request → background, no uid");

  // OpenAI responses API
  responses["https://api.openai.com/v1/responses"] = () => json({ model: "gpt-4o", usage: { input_tokens: 10, output_tokens: 20 } });
  await fetch("https://api.openai.com/v1/responses", { method: "POST", body: "{}" });
  await settle();
  const o2 = rows.pop();
  ok(o2?.inputTokens === 10 && o2.outputTokens === 20, "openai responses API tokens");

  // Gemini
  responses["https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"] = () => json({ usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40, thoughtsTokenCount: 60 } });
  await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent", { method: "POST", body: "{}" });
  await settle();
  const g = rows.pop();
  ok(g?.provider === "google" && g.model === "gemini-2.5-pro" && g.inputTokens === 300 && g.outputTokens === 100, "gemini model from path + thinking tokens");

  // Sarvam sync STT with WAV in a Buffer body
  responses["https://api.sarvam.ai/speech-to-text"] = () => json({ transcript: "x" });
  await fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", body: multipart });
  await settle();
  const s = rows.pop();
  ok(s?.provider === "sarvam" && near(s.audioSeconds, 3) && s.costBasis === "audio", "sarvam audio seconds");
  ok(near(s.costInr, audioCostInr(3)), "sarvam ₹ from audio");

  // Sarvam batch-job plumbing is not double-logged
  const before = rows.length;
  responses["https://api.sarvam.ai/speech-to-text/job/v1"] = () => json({ job_id: "j" });
  await fetch("https://api.sarvam.ai/speech-to-text/job/v1", { method: "POST", body: "{}" });
  await settle();
  ok(rows.length === before, "batch job plumbing not logged by the hook");

  // Failure: HTTP 529 → logged as failed, zero cost
  responses["https://api.anthropic.com/v1/messages"] = () => json({ error: { type: "overloaded" } }, 529);
  const fr = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify({ model: "claude-haiku-4-5-20251001" }) });
  await settle();
  const f = rows.pop();
  ok(fr.status === 529, "caller still sees the error status");
  ok(f?.ok === false && f.costInr === 0 && f.model === "claude-haiku-4-5-20251001", "failed call logged, ₹0");

  // Network error is re-thrown to the caller and logged
  let threw = false;
  try { await fetch("https://api.openai.com/v1/embeddings-missing-route-x", { method: "POST", body: "{}" }); } catch { threw = true; }
  await settle();
  ok(threw && rows.pop()?.ok === false, "network error re-thrown and logged");

  // Non-AI traffic passes through untouched and unlogged
  const n = rows.length;
  responses["https://example.com/"] = () => json({ a: 1 });
  const ex = await fetch("https://example.com/", {});
  await settle();
  ok((await ex.json()).a === 1 && rows.length === n, "non-AI request untouched, not logged");

  // Unknown model is never under-costed
  ok(tokenCostInr("anthropic", "claude-future-9", 1e6, 0).known === false, "unknown model flagged");
  ok(tokenCostInr("anthropic", "claude-future-9", 1e6, 0).costInr >= tokenCostInr("anthropic", "claude-sonnet-4-6", 1e6, 0).costInr, "unknown model priced at provider max");

  // Rollup keys are Firestore-safe
  ok(mod.usageKey("/api/ai-discharge") === "_api_ai-discharge" && mod.usageKey("gpt-4.1") === "gpt-4_1", "safe map keys");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(mod.istDay(new Date("2026-11-03T20:00:00Z"))) && mod.istDay(new Date("2026-11-03T20:00:00Z")) === "2026-11-04", "IST day rollover");

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });