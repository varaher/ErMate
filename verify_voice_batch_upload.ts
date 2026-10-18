// VOICE_BATCH_UPLOAD_CONTENT_TYPE_V1
// Simulates Sarvam batch STT: the job start step rejects blobs stored as binary/octet-stream.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

process.env.SARVAM_API_KEY = "test-key";
process.env.SARVAM_AI_API_KEY = "test-key";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL:", n)); };

const tmp = path.join(os.tmpdir(), `vb_${Date.now()}.wav`);
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ac", "1", "-ar", "16000", tmp], { stdio: "ignore" });
const audio = fs.readFileSync(tmp);
fs.unlinkSync(tmp);

type Mode = "good" | "octet";
function installFetch(blobTypeSink: { v: string | null }, mode: Mode) {
  const real = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const u = String(url);
    const j = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.endsWith("/speech-to-text/job/v1") && init.method === "POST") return j({ job_id: "job1" });
    if (u.endsWith("/upload-files")) return j({ upload_urls: { [Object.keys(JSON.parse(init.body).files.reduce((a: any, f: string) => (a[f] = 1, a), {}))[0]]: { file_url: "https://blob.test/put" } } });
    if (u === "https://blob.test/put") {
      const h = init.headers || {};
      blobTypeSink.v = h["x-ms-blob-content-type"] || h["Content-Type"] || "binary/octet-stream";
      return new Response("", { status: 201 });
    }
    if (u.endsWith("/job1/start")) {
      if (blobTypeSink.v !== "audio/wav") {
        return j({ error: { message: `Invalid file type: ${blobTypeSink.v}. Only ['audio/wav'] allowed.`, code: "invalid_request_error", request_id: "req-123" } }, 400);
      }
      return j({ ok: true });
    }
    if (u.endsWith("/job1/status")) return j({ job_state: "Completed", successful_files_count: 1, failed_files_count: 0, job_details: [{ outputs: [{ file_name: "0.json" }] }] });
    if (u.endsWith("/download-files")) return j({ download_urls: { "0.json": { file_url: "https://blob.test/out" } } });
    if (u === "https://blob.test/out") return j({ transcript: "patient has chest pain" });
    return real(url, init);
  };
  return () => { (globalThis as any).fetch = real; };
}

(async () => {
  // Static checks (always run)
  const src = fs.readFileSync("server/sarvamBatch.ts", "utf8").replace(/\/\/.*$/gm, "");
  t("PUT declares audio/wav (x-ms-blob-content-type)", /"x-ms-blob-content-type":\s*"audio\/wav"/.test(src));
  t("PUT declares audio/wav (Content-Type)", /"Content-Type":\s*"audio\/wav"[^}]*Content-Length/s.test(src));
  t("no raw upstream body is thrown to the caller", !/throw new Error\(`Failed to (start|create|get|upload)[^`]*\$\{(errText|startReq|putReq)/.test(src));

  const srv = fs.readFileSync("server.ts", "utf8");
  t("sync transcription path does not echo vendor errors to the clinician", !/temporarily unavailable\. Error: \$\{err\.message\}/.test(srv));

  // End-to-end simulation needs an ffmpeg binary (ffmpeg-static); skip cleanly where it is not installed
  try { (await import("./server/ffmpegPath.ts")).getFfmpegPath(); } catch {
    console.log("SKIP e2e simulation: ffmpeg-static binary not available here");
    console.log(`pass ${pass} fail ${fail}`);
    process.exit(fail ? 1 : 0);
  }
  // Skip the 5 s poll wait
  const realSetTimeout = globalThis.setTimeout;
  (globalThis as any).setTimeout = (fn: any, ms: number, ...a: any[]) => realSetTimeout(fn, ms >= 5000 ? 0 : ms, ...a);
  const { sarvamBatchTranscribe, BATCH_USER_ERROR } = await import("./server/sarvamBatch.ts");

  // 1. Fixed behaviour: upload declares audio/wav, job completes
  let sink = { v: null as string | null };
  let restore = installFetch(sink, "good");
  const ok = await sarvamBatchTranscribe(audio, "dictation.webm", "translate");
  restore();
  t("blob is uploaded as audio/wav", sink.v === "audio/wav");
  t("transcript returned", ok.success && ok.transcript === "patient has chest pain");

  // 2. If the vendor still rejects, the clinician gets a safe message (no raw JSON, ids or file types)
  sink = { v: null };
  const real = globalThis.fetch;
  restore = installFetch(sink, "octet");
  // force the bad blob type by stripping the declared type from the PUT
  const inner = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    if (String(url) === "https://blob.test/put") init = { ...init, headers: { "x-ms-blob-type": "BlockBlob" } };
    return inner(url, init);
  };
  let msg = "";
  const errSpy = console.error; console.error = () => {};
  try { await sarvamBatchTranscribe(audio, "dictation.webm", "translate"); } catch (e: any) { msg = e.message; }
  console.error = errSpy;
  (globalThis as any).fetch = real;
  t("rejection surfaces the safe message", msg === BATCH_USER_ERROR);
  t("safe message hides vendor details", !/octet|400|invalid_request|request_id|\{|audio\//i.test(msg));

  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
