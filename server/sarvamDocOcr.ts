/**
 * Sarvam Vision OCR (Document Intelligence "parse").
 *
 * Flow (Sarvam docs, Nov 2026):
 *   1. POST /doc-ai/v1/job/parse   multipart: file, language (BCP-47), output_format=md   → { job_id, status }
 *   2. GET  /doc-ai/v1/job/{id}/status   until completed | partially_completed | failed | rejected
 *      (response carries usage.pages_* and, when done, results_url)
 *   3. Fetch the results: a ZIP holding the document as Markdown (+ metadata/page_NNN.json, manifest.json).
 *      The docs give the results location only as `results_url`, so this module accepts every shape it may take:
 *      the ZIP itself, or JSON pointing at a download URL, or JSON carrying the text.
 *
 * Auth header: api-subscription-key. Limits: PDF/JPG/PNG, ≤10–30 pages, 10 requests/minute.
 * Price: ₹0.50 per page (Document Digitization API) — logged once per scan to aiUsageEvents.
 *
 * The image goes to Sarvam (Indian provider, same as dictation audio). Text returned here still contains
 * patient identifiers — callers must de-identify before sending it to any overseas model.
 */
import JSZip from "jszip";
import { logAiUsage } from "./services/aiUsage.ts";

const BASE = "https://api.sarvam.ai";
const TERMINAL_OK = new Set(["completed", "partially_completed"]);
const TERMINAL_BAD = new Set(["failed", "rejected"]);

export class SarvamOcrError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

export interface SarvamOcrResult {
  text: string;          // Markdown text of the whole document
  pages: number;         // pages Sarvam processed (billing unit)
  jobId: string;
}

type FetchLike = typeof fetch;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function extFor(mimeType: string): string {
  const m = String(mimeType || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("pdf")) return "pdf";
  return "jpg";
}

/** Primary Markdown/HTML file from Sarvam's results ZIP (skips metadata/ and manifest.json). */
export async function textFromResultsZip(zipBytes: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(zipBytes);
  const files = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)metadata\//i.test(f.name) && !/manifest\.json$/i.test(f.name));
  const pick = files.find(f => /\.md$/i.test(f.name)) || files.find(f => /\.html?$/i.test(f.name)) || files.find(f => /\.txt$/i.test(f.name));
  if (pick) {
    const raw = await pick.async("string");
    return /\.html?$/i.test(pick.name) ? htmlToText(raw) : raw;
  }
  // No primary file: fall back to the per-page JSON blocks.
  const pages = Object.values(zip.files).filter(f => !f.dir && /metadata\/page_\d+\.json$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  const out: string[] = [];
  for (const p of pages) {
    try { out.push(collectText(JSON.parse(await p.async("string")))); } catch { /* skip unreadable page */ }
  }
  return out.filter(Boolean).join("\n\n");
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Text from a JSON body of unknown shape: prefers markdown/text/content fields, walks arrays (pages, blocks). */
function collectText(node: any, depth = 0): string {
  if (depth > 6 || node == null) return "";
  if (typeof node === "string") return "";
  if (Array.isArray(node)) return node.map(n => collectText(n, depth + 1)).filter(Boolean).join("\n");
  for (const k of ["markdown", "md", "text", "content", "html"]) {
    if (typeof node[k] === "string" && node[k].trim()) return k === "html" ? htmlToText(node[k]) : node[k];
  }
  return ["pages", "blocks", "documents", "results", "data", "output"]
    .map(k => collectText(node[k], depth + 1)).filter(Boolean).join("\n");
}

/** A download URL inside a JSON body of unknown shape. */
function findUrl(node: any, depth = 0): string | null {
  if (depth > 5 || node == null) return null;
  if (typeof node === "string") return /^https?:\/\//.test(node) ? node : null;
  if (Array.isArray(node)) { for (const n of node) { const u = findUrl(n, depth + 1); if (u) return u; } return null; }
  for (const k of ["url", "download_url", "downloadUrl", "file_url", "signed_url"]) {
    if (typeof node[k] === "string" && /^https?:\/\//.test(node[k])) return node[k];
  }
  for (const k of ["download_urls", "urls", "files", "documents", "output", "results", "data"]) {
    const u = findUrl(node[k], depth + 1); if (u) return u;
  }
  return null;
}

const isZip = (res: Response) => /zip|octet-stream/i.test(res.headers.get("content-type") || "");

async function readResults(res: Response, f: FetchLike): Promise<string> {
  if (isZip(res)) return textFromResultsZip(await res.arrayBuffer());
  const body = await res.json().catch(() => null);
  if (!body) return "";
  const direct = collectText(body);
  if (direct.trim()) return direct;
  const url = findUrl(body);
  if (url) {
    const dl = await f(url); // signed link: no API key
    if (!dl.ok) throw new SarvamOcrError(`Sarvam OCR download failed (${dl.status})`, dl.status);
    if (isZip(dl) || /\.zip(\?|$)/i.test(url)) return textFromResultsZip(await dl.arrayBuffer());
    const t = await dl.text();
    return /^\s*</.test(t) ? htmlToText(t) : t;
  }
  return "";
}

/**
 * OCR one scanned page/document with Sarvam Vision. Returns Markdown text.
 * Throws SarvamOcrError on failure (callers fail honestly — never invent content).
 */
export async function sarvamOcr(
  file: Buffer | Uint8Array,
  mimeType: string,
  opts: { language?: string; timeoutMs?: number; pollMs?: number; fetchImpl?: FetchLike } = {}
): Promise<SarvamOcrResult> {
  const key = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
  if (!key) throw new SarvamOcrError("SARVAM_API_KEY is not configured");
  const f: FetchLike = opts.fetchImpl || fetch;
  const headers = { "api-subscription-key": key };
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const pollMs = opts.pollMs ?? 2_000;

  try {
    // 1. Submit
    const form = new FormData();
    const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
    form.append("file", new Blob([bytes], { type: mimeType || "image/jpeg" }), `scan.${extFor(mimeType)}`);
    form.append("language", opts.language || "en-IN");
    form.append("output_format", "md");
    const submit = await f(`${BASE}/doc-ai/v1/job/parse`, { method: "POST", headers, body: form });
    if (!submit.ok) {
      const detail = await submit.text().catch(() => "");
      throw new SarvamOcrError(`Sarvam OCR submit failed (${submit.status}) ${detail.slice(0, 200)}`, submit.status);
    }
    const job = await submit.json();
    const jobId = String(job?.job_id || "");
    if (!jobId) throw new SarvamOcrError("Sarvam OCR returned no job id");

    // 2. Poll
    let status: any = null;
    while (true) {
      if (Date.now() - started > timeoutMs) throw new SarvamOcrError("Sarvam OCR timed out");
      await sleep(pollMs);
      const s = await f(`${BASE}/doc-ai/v1/job/${encodeURIComponent(jobId)}/status`, { headers });
      if (!s.ok) throw new SarvamOcrError(`Sarvam OCR status failed (${s.status})`, s.status);
      status = await s.json();
      const st = String(status?.status || "").toLowerCase();
      if (TERMINAL_OK.has(st)) break;
      if (TERMINAL_BAD.has(st)) throw new SarvamOcrError(`Sarvam OCR job ${st}`);
    }
    const pages = Number(status?.usage?.pages_succeeded ?? status?.usage?.pages_processed ?? status?.usage?.pages_total ?? 1) || 1;

    // 3. Results — results_url first, then the documented SDK equivalents.
    const candidates: string[] = [];
    const ru = String(status?.results_url || status?.documents?.[0]?.results_url || "");
    if (ru) candidates.push(/^https?:\/\//.test(ru) ? ru : `${BASE}${ru.startsWith("/") ? "" : "/"}${ru}`);
    candidates.push(`${BASE}/doc-ai/v1/job/${encodeURIComponent(jobId)}/download-url`, `${BASE}/doc-ai/v1/job/${encodeURIComponent(jobId)}/results`);
    let text = "";
    let lastErr = "";
    for (const url of candidates) {
      const r = await f(url, { headers });
      if (!r.ok) { lastErr = `${r.status}`; continue; }
      text = await readResults(r, f);
      if (text.trim()) break;
    }
    if (!text.trim()) throw new SarvamOcrError(`Sarvam OCR returned no text${lastErr ? ` (${lastErr})` : ""}`);

    logAiUsage({ provider: "sarvam", model: "sarvam-vision", pages, ok: true, latencyMs: Date.now() - started });
    return { text: text.trim(), pages, jobId };
  } catch (err: any) {
    logAiUsage({ provider: "sarvam", model: "sarvam-vision", ok: false, latencyMs: Date.now() - started });
    throw err instanceof SarvamOcrError ? err : new SarvamOcrError(err?.message || "Sarvam OCR failed");
  }
}