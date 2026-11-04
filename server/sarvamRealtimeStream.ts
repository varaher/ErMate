import { getFfmpegPath } from "./ffmpegPath.ts";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import { spawn } from "child_process";
import { parse } from "url";
import { adminAuth, db } from "../src/lib/firebase-admin.ts";
import { CREDIT_COSTS } from "../src/lib/pricing.ts";
import {
  checkCreditAccess, deductCredits,
  EMAIL_NOT_VERIFIED_MESSAGE, INSUFFICIENT_CREDITS_MESSAGE,
} from "./services/creditMeter.ts";
import { logAiUsage, runWithAiUsageContext } from "./services/aiUsage.ts";

/**
 * Realtime dictation: browser → this server → Sarvam saaras:v3-realtime.
 *
 * Access rules (same as every other AI route):
 *  - The FIRST message must be JSON { mode, token } with a valid Firebase ID token. No token → closed, Sarvam never opened.
 *  - Credits are checked before Sarvam is opened (same rules as /api/sarvam/batch-transcribe: exempt users and
 *    lookup errors are never blocked). One "stt" charge per session, taken only if Sarvam returned a final transcript.
 *  - A session is capped at MAX_SESSION_SECONDS of wall-clock time, then flushed and closed.
 *  - Audio length is measured from the PCM actually sent and logged to aiUsageEvents for the admin portal.
 */
const FEATURE = "/api/voice/stream";
const MAX_SESSION_SECONDS = 45 * 60;
const PCM_BYTES_PER_SECOND = 16000 * 2; // 16 kHz, 16-bit, mono
const ALLOWED_MODES = new Set(["transcribe", "translate"]);

export function initSarvamRealtimeStream(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url || "");
    if (pathname === "/api/voice/stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (clientWs) => {
    console.log("[SarvamRealtime] Client connected for streaming dictation");

    let configStarted = false;   // first JSON message received (auth in progress)
    let isConfigured = false;    // auth + credits passed, Sarvam opened
    let mode = "transcribe";
    let sarvamWs: WebSocket | null = null;
    let ffmpeg: any = null;
    let streamSessionBegan = false;
    let sarvamEndSent = false;
    let uid: string | null = null;
    let chargeOnSuccess = false;
    let pcmBytesSent = 0;
    let gotFinalTranscript = false;
    let upstreamError = false;
    let finished = false;
    let sessionCap: NodeJS.Timeout | null = null;
    const pendingAudio: Buffer[] = [];

    // Safety timeout: no valid config within 10 s → close
    const timeout = setTimeout(() => {
      if (!isConfigured) clientWs.close(1008, "Configuration timeout");
    }, 10000);

    const sendClient = (payload: any) => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(payload));
    };

    const finishSession = () => {
      if (finished || !isConfigured) return;
      finished = true;
      const audioSeconds = pcmBytesSent / PCM_BYTES_PER_SECOND;
      runWithAiUsageContext({ uid, feature: FEATURE }, () => {
        logAiUsage({
          provider: "sarvam", model: "saaras:v3-realtime",
          audioSeconds, ok: !upstreamError || gotFinalTranscript,
        });
      });
      if (chargeOnSuccess && uid && gotFinalTranscript) {
        deductCredits(db, uid, "stt", CREDIT_COSTS.stt).catch((e: any) =>
          console.error(`[SarvamRealtime] credit deduction failed for ${uid}:`, e?.message || e));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      if (sessionCap) { clearTimeout(sessionCap); sessionCap = null; }
      if (ffmpeg) {
        ffmpeg.stdin.end();
        ffmpeg.kill("SIGKILL");
        ffmpeg = null;
      }
      if (sarvamWs) {
        if (sarvamWs.readyState === WebSocket.OPEN) {
            sarvamWs.send(JSON.stringify({ event: "end" }));
        }
        sarvamWs.close();
        sarvamWs = null;
      }
      finishSession();
    };

    const flushAndStop = () => {
      if (ffmpeg && ffmpeg.stdin) {
        ffmpeg.stdin.end(); // ffmpeg drains remaining audio; its close handler sends "end" to Sarvam
      } else if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN && !sarvamEndSent) {
        sarvamEndSent = true;
        sarvamWs.send(JSON.stringify({ event: "end" }));
      }
    };

    clientWs.on("close", () => {
      console.log("[SarvamRealtime] Client disconnected");
      cleanup();
    });

    clientWs.on("error", (err) => {
      console.error("[SarvamRealtime] Client WS error:", err);
      cleanup();
    });

    const openSarvam = () => {
      const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
      if (!sarvamKey) {
        sendClient({ type: "error", message: "SARVAM_API_KEY not configured on server" });
        clientWs.close();
        return;
      }

      isConfigured = true;
      clearTimeout(timeout);

      // CURRENT Sarvam Realtime API configuration
      const queryParams = new URLSearchParams({
        model: "saaras:v3-realtime",
        "language_code": "auto",
        mode: mode, // "transcribe" or "translate"
        endpointing: "vad",
        encoding: "linear16",
        sample_rate: "16000",
        stream_type: "balanced"
      });

      const sarvamUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?${queryParams.toString()}`;
      console.log(`[SarvamRealtime] Opening upstream WS (mode: ${mode})`);

      sarvamWs = new WebSocket(sarvamUrl, {
        headers: {
          "api-subscription-key": sarvamKey
        }
      });

      // Convert browser WebM to 16kHz Mono 16-bit PCM
      ffmpeg = spawn(getFfmpegPath(), [
        "-f", "webm",
        "-i", "pipe:0",
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "pipe:1"
      ]);

      ffmpeg.stderr.on("data", () => { /* ffmpeg progress noise */ });
      ffmpeg.stdin.on("error", () => { /* client closed mid-write */ });

      ffmpeg.stdout.on("data", (pcmChunk: Buffer) => {
        if (sarvamWs?.readyState === WebSocket.OPEN && streamSessionBegan) {
           pcmBytesSent += pcmChunk.length;
           sarvamWs.send(JSON.stringify({
             event: "audio_input",
             audio: pcmChunk.toString("base64")
           }));
        }
      });

      ffmpeg.on("close", () => {
          console.log("[SarvamRealtime] FFmpeg process closed");
          if (!sarvamEndSent && sarvamWs?.readyState === WebSocket.OPEN) {
              sarvamEndSent = true;
              sarvamWs.send(JSON.stringify({ event: "end" }));
          }
      });

      // Any audio that arrived while auth was being checked
      for (const chunk of pendingAudio.splice(0)) ffmpeg.stdin.write(chunk);

      sessionCap = setTimeout(() => {
        console.warn("[SarvamRealtime] Session reached the time cap; flushing and closing.");
        sendClient({ type: "error", code: "SESSION_TIME_LIMIT", message: "Dictation reached the maximum length. What you said so far has been kept." });
        flushAndStop();
      }, MAX_SESSION_SECONDS * 1000);

      sarvamWs.on("open", () => {
        console.log("[SarvamRealtime] Connected to Sarvam upstream WS");
      });

      sarvamWs.on("message", (sarvamData) => {
        try {
          const msg = JSON.parse(sarvamData.toString());

          if (msg.event === "session.begin") {
             streamSessionBegan = true;
             sendClient({ type: "ready" });
          }
          if (msg.event === "session.end") {
             console.log("[SarvamRealtime] Received session.end from Sarvam");
             sendClient({ type: "session_end" });
             cleanup();
          }
          if (msg.event === "transcript.final" && String(msg.transcript || "").trim()) gotFinalTranscript = true;
          if (msg.event === "error") upstreamError = true;
          // Relay transcript events back to the client UI
          if (msg.event === "transcript.partial" || msg.event === "transcript.final" || msg.event === "error") {
            sendClient({
              type: msg.event === "transcript.partial" ? "partial" : msg.event === "transcript.final" ? "final" : "error",
              transcript: msg.transcript || "",
              message: msg.message || "",
              language_code: msg.language_code || "auto"
            });
          }
        } catch (e) {
           console.error("[SarvamRealtime] Error parsing upstream message", e);
        }
      });

      sarvamWs.on("close", () => {
        console.log("[SarvamRealtime] Sarvam WS closed");
        if (clientWs.readyState === WebSocket.OPEN) {
           sendClient({ type: "closed" });
           clientWs.close();
        }
        cleanup();
      });

      sarvamWs.on("error", (err) => {
        upstreamError = true;
        console.error("[SarvamRealtime] Sarvam WS error:", err);
        sendClient({ type: "error", message: "Upstream API error" });
      });
    };

    const configure = async (raw: string) => {
      let config: any;
      try { config = JSON.parse(raw); } catch { clientWs.close(1008, "Invalid configuration"); return; }

      const token = typeof config?.token === "string" ? config.token.trim() : "";
      if (!token) {
        sendClient({ type: "error", code: "AUTH_REQUIRED", message: "Please sign in again to use live dictation." });
        clientWs.close(4401, "Unauthorized");
        return;
      }
      let decoded: any;
      try {
        decoded = await adminAuth.verifyIdToken(token);
      } catch {
        sendClient({ type: "error", code: "AUTH_REQUIRED", message: "Please sign in again to use live dictation." });
        clientWs.close(4401, "Unauthorized");
        return;
      }
      uid = String(decoded.uid);
      mode = ALLOWED_MODES.has(config?.mode) ? config.mode : "transcribe";

      const check = await checkCreditAccess(db, uid, String(decoded.email || ""), decoded.email_verified, "stt");
      if (check.status === "email_not_verified") {
        sendClient({ type: "error", code: "EMAIL_NOT_VERIFIED", message: EMAIL_NOT_VERIFIED_MESSAGE });
        clientWs.close(4403, "Email not verified");
        return;
      }
      if (check.status === "insufficient") {
        sendClient({ type: "error", code: "INSUFFICIENT_CREDITS", message: INSUFFICIENT_CREDITS_MESSAGE });
        clientWs.close(4402, "Insufficient credits");
        return;
      }
      chargeOnSuccess = check.status === "charge";
      if (clientWs.readyState !== WebSocket.OPEN) return; // client left while we were checking
      openSarvam();
    };

    clientWs.on("message", (data, isBinary) => {
      if (!configStarted) {
        if (isBinary) { clientWs.close(1008, "Configuration required first"); return; }
        configStarted = true;
        configure(data.toString()).catch((e) => {
          console.error("[SarvamRealtime] Configuration failed:", e?.message || e);
          clientWs.close(1011, "Configuration failed");
        });
        return;
      }

      // Binary audio chunks from the browser
      if (isBinary) {
        const chunk = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        if (isConfigured && ffmpeg) ffmpeg.stdin.write(chunk);
        else if (!isConfigured && pendingAudio.length < 200) pendingAudio.push(chunk);
        return;
      }

      // Client says "stop" via JSON
      if (isConfigured) {
          try {
             const payload = JSON.parse(data.toString());
             if (payload.action === "stop_dictation") {
                 console.log("[SarvamRealtime] Received stop_dictation. Flushing FFmpeg...");
                 flushAndStop();
             }
          } catch (e) {}
      }
    });
  });
}