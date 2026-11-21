/**
 * Verifies (17 Nov 2026):
 *  A. Scribe dictation turns do NOT call Claude Sonnet clinical reasoning unless asked
 *     (question in the turn, or includeReasoning: true). Extraction still runs every turn.
 *  B. Sarvam Vision OCR client: submit → poll → results (ZIP / JSON link / JSON text), honest failures,
 *     one usage log per scan priced by page, and the usage hook ignores the job's polling calls.
 * Run: npx tsx verify_scribe_reasoning_and_ocr.ts
 */
import JSZip from "jszip";
import { processScribeChatTurn } from "./server/scribeChatTurn";
import { sarvamOcr, textFromResultsZip } from "./server/sarvamDocOcr";
import { setAiUsageSinkForTests, installAiUsageFetchHook } from "./server/services/aiUsage";
import { SARVAM_OCR_INR_PER_PAGE } from "./server/services/aiPrices";

let passed = 0, failed = 0;
const ok = (c: any, n: string) => { if (c) passed++; else { failed++; console.error("FAIL:", n); } };

// ── A. Scribe reasoning on request ──
let extractionCalls = 0, reasoningCalls = 0;
const helpers: any = {
  callExtractionModel: async () => { extractionCalls++; return { chiefComplaint: "chest pain", bp: "140/90" }; },
  callClinicalReasoningModel: async () => { reasoningCalls++; return { summary: "Consider ACS.", differentials: ["ACS"], references: [], watchFor: ["ST changes"] }; },
};
const reset = () => { extractionCalls = 0; reasoningCalls = 0; };

async function scribeTests() {
  reset();
  const r1: any = await processScribeChatTurn("Patient is a 54 year old man with chest pain since 2 hours, BP 140/90, pulse 96", 54, {}, "C1", [], helpers);
  ok(extractionCalls === 1, "plain dictation: extraction runs");
  ok(reasoningCalls === 0, "plain dictation: NO Sonnet reasoning call");
  ok(r1.reasoningMessage?.type !== "clinical-reasoning" && !r1.reasoningMessage?.clinicalReasoning, "plain dictation: no reasoning card");
  ok(/differentials\?/.test(r1.reply), "first plain turn shows the one-time tip");

  reset();
  const r2: any = await processScribeChatTurn("BP now 130/80, pulse 88", 54, {}, "C1", [{ role: "assistant", content: r1.reply }], helpers);
  ok(reasoningCalls === 0, "second plain turn: still no Sonnet");
  ok(!/differentials\?/.test(r2.reply), "tip is not repeated once shown");

  reset();
  const r3: any = await processScribeChatTurn("What are the differentials?", 54, {}, "C1", [], helpers);
  ok(reasoningCalls === 1, "question: Sonnet reasoning runs");
  ok(r3.reasoningMessage?.type === "clinical-reasoning", "question: reasoning card returned");

  reset();
  await processScribeChatTurn("Patient has chest pain since 2 hours, BP 140/90", 54, {}, "C1", [], helpers, { includeReasoning: true });
  ok(reasoningCalls === 1 && extractionCalls === 1, "includeReasoning: true → both run");

  reset();
  const failing = { ...helpers, callClinicalReasoningModel: async () => { reasoningCalls++; throw new Error("down"); } };
  const r5: any = await processScribeChatTurn("Patient has chest pain, BP 140/90", 54, {}, "C1", [], failing, { includeReasoning: true });
  ok(r5.reasoningMessage?.type === "error" && /temporarily unavailable/.test(r5.reasoningMessage.content), "Rule 1: Sonnet failure → honest message, no fallback model");
}

// ── B. Sarvam OCR ──
async function zipWith(files: Record<string, string>) {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return z.generateAsync({ type: "uint8array" });
}
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

async function ocrTests() {
  process.env.SARVAM_API_KEY = "test-key";
  const rows: any[] = [];
  setAiUsageSinkForTests(async (row) => { rows.push(row); });

  // ZIP via results_url (relative path)
  const zip = await zipWith({ "scan.md": "# Referral\nName: Ravi Kumar\nBP 150/90", "metadata/page_001.json": "{}", "manifest.json": "{}" });
  const calls: string[] = [];
  let polls = 0;
  const fakeZip: any = async (url: string, init?: any) => {
    calls.push(`${init?.method || "GET"} ${url} key=${init?.headers?.["api-subscription-key"] ? "y" : "n"}`);
    if (url.endsWith("/doc-ai/v1/job/parse")) {
      ok(init.body instanceof FormData && init.body.get("output_format") === "md" && init.body.get("language") === "en-IN", "submit sends file, language en-IN, output_format md");
      return json({ job_id: "J1", status: "pending" }, 201);
    }
    if (url.endsWith("/J1/status")) {
      polls++;
      return json(polls < 2 ? { job_id: "J1", status: "running", usage: {} } : { job_id: "J1", status: "completed", usage: { pages_succeeded: 2 }, results_url: "/doc-ai/v1/job/J1/results" });
    }
    if (url.endsWith("/J1/results")) return new Response(zip, { status: 200, headers: { "content-type": "application/zip" } });
    return json({}, 404);
  };
  const r1 = await sarvamOcr(Buffer.from([1, 2, 3]), "image/jpeg", { fetchImpl: fakeZip, pollMs: 1 });
  ok(r1.text.includes("Name: Ravi Kumar") && r1.pages === 2 && r1.jobId === "J1", "ZIP results → markdown text + page count");
  ok(calls.every(c => c.includes("key=y")), "API key sent on every Sarvam call");
  await new Promise(r => setTimeout(r, 10));
  const log = rows.pop();
  ok(log?.provider === "sarvam" && log.model === "sarvam-vision" && log.pages === 2 && log.costInr === 2 * SARVAM_OCR_INR_PER_PAGE && log.costBasis === "pages", "one usage log, priced ₹0.50/page");

  // JSON with a signed download URL (no key on the download)
  let dlKey = "unset";
  const fakeLink: any = async (url: string, init?: any) => {
    if (url.endsWith("/job/parse")) return json({ job_id: "J2" }, 201);
    if (url.endsWith("/J2/status")) return json({ status: "completed", usage: { pages_total: 1 } });
    if (url.endsWith("/J2/download-url")) return json({ url: "https://storage.example/out.zip?sig=1" });
    if (url.startsWith("https://storage.example/")) { dlKey = init?.headers?.["api-subscription-key"] ? "sent" : "none"; return new Response(zip, { headers: { "content-type": "application/zip" } }); }
    return json({}, 404);
  };
  const r2 = await sarvamOcr(Buffer.from([1]), "image/png", { fetchImpl: fakeLink, pollMs: 1 });
  ok(r2.text.includes("BP 150/90") && dlKey === "none", "JSON download link → ZIP fetched without the API key");

  // JSON body carrying text directly
  const fakeText: any = async (url: string) => {
    if (url.endsWith("/job/parse")) return json({ job_id: "J3" }, 201);
    if (url.endsWith("/J3/status")) return json({ status: "partially_completed", usage: { pages_processed: 1 }, results_url: "https://api.sarvam.ai/doc-ai/v1/job/J3/results" });
    if (url.endsWith("/J3/results")) return json({ pages: [{ markdown: "Page one text" }, { markdown: "Page two text" }] });
    return json({}, 404);
  };
  const r3 = await sarvamOcr(Buffer.from([1]), "application/pdf", { fetchImpl: fakeText, pollMs: 1 });
  ok(r3.text.includes("Page one text") && r3.text.includes("Page two text"), "JSON pages → joined text (partially_completed accepted)");

  // Failures are honest
  const rejected: any = async (url: string) => url.endsWith("/job/parse") ? json({ job_id: "J4" }, 201) : json({ status: "rejected", usage: {} });
  let e1 = ""; try { await sarvamOcr(Buffer.from([1]), "image/jpeg", { fetchImpl: rejected, pollMs: 1 }); } catch (e: any) { e1 = e.message; }
  ok(/rejected/.test(e1), "rejected job → error, no text");
  const slow: any = async (url: string) => url.endsWith("/job/parse") ? json({ job_id: "J5" }, 201) : json({ status: "running", usage: {} });
  let e2 = ""; try { await sarvamOcr(Buffer.from([1]), "image/jpeg", { fetchImpl: slow, pollMs: 5, timeoutMs: 40 }); } catch (e: any) { e2 = e.message; }
  ok(/timed out/.test(e2), "never-finishing job → timeout error");
  const submit429: any = async () => json({ title: "rate limited" }, 429);
  let e3: any = null; try { await sarvamOcr(Buffer.from([1]), "image/jpeg", { fetchImpl: submit429, pollMs: 1 }); } catch (e: any) { e3 = e; }
  ok(e3?.status === 429, "rate limit surfaces as an error with status 429");
  const empty: any = async (url: string) => url.endsWith("/job/parse") ? json({ job_id: "J6" }, 201) : url.endsWith("/status") ? json({ status: "completed", usage: {} }) : json({});
  let e4 = ""; try { await sarvamOcr(Buffer.from([1]), "image/jpeg", { fetchImpl: empty, pollMs: 1 }); } catch (e: any) { e4 = e.message; }
  ok(/no text/.test(e4), "completed but empty → error, never invented text");
  await new Promise(r => setTimeout(r, 10));
  ok(rows.filter(r => r.ok === false && r.model === "sarvam-vision").length >= 4 && rows.filter(r => r.ok === false).every(r => r.costInr === 0), "failed scans logged as failed, ₹0");

  // HTML primary file is converted to text
  const htmlZip = await zipWith({ "doc.html": "<h1>Discharge</h1><p>Hb 9.2</p>" });
  ok((await textFromResultsZip(htmlZip)).includes("Hb 9.2"), "HTML result → plain text");

  // Hook ignores /doc-ai polling (logged once per scan instead)
  rows.length = 0;
  (globalThis as any).fetch = async () => json({ status: "running" });
  installAiUsageFetchHook();
  await fetch("https://api.sarvam.ai/doc-ai/v1/job/X/status");
  await new Promise(r => setTimeout(r, 10));
  ok(rows.length === 0, "usage hook does not log each OCR status poll");
}

(async () => {
  await scribeTests();
  await ocrTests();
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });