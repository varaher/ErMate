import { getFfmpegPath } from "./ffmpegPath.ts";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import { spawn } from "child_process";
import { parse } from "url";

export function initSarvamRealtimeStream(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url || "");
    if (pathname === "/api/voice/stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (clientWs, request) => {
    console.log("[SarvamRealtime] Client connected for streaming dictation");
    
    let isConfigured = false;
    let mode = "transcribe";
    let sarvamWs: WebSocket | null = null;
    let ffmpeg: any = null;
    let streamSessionBegan = false;
    let sarvamEndSent = false;

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!isConfigured) clientWs.close(1008, "Configuration timeout");
    }, 10000);

    const cleanup = () => {
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
    };

    clientWs.on("close", () => {
      console.log("[SarvamRealtime] Client disconnected");
      cleanup();
    });

    clientWs.on("error", (err) => {
      console.error("[SarvamRealtime] Client WS error:", err);
      cleanup();
    });

    clientWs.on("message", (data, isBinary) => {
      if (!isConfigured && !isBinary) {
        try {
          const config = JSON.parse(data.toString());
          mode = config.mode || "transcribe";
          isConfigured = true;
          clearTimeout(timeout);
          
          const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
          if (!sarvamKey) {
            clientWs.send(JSON.stringify({ type: "error", message: "SARVAM_API_KEY not configured on server" }));
            clientWs.close();
            return;
          }

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
          console.log(`[SarvamRealtime] Opening upstream WS to ${sarvamUrl}`);
          
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

          ffmpeg.stderr.on("data", (errData: Buffer) => {
            // console.log("[FFmpeg]", errData.toString());
          });

          ffmpeg.stdout.on("data", (pcmChunk: Buffer) => {
            if (sarvamWs?.readyState === WebSocket.OPEN && streamSessionBegan) {
               const base64Audio = pcmChunk.toString("base64");
               sarvamWs.send(JSON.stringify({
                 event: "audio_input",
                 audio: base64Audio
               }));
            }
          });

          ffmpeg.on("close", () => {
              console.log("[SarvamRealtime] FFmpeg process closed");
              if (!sarvamEndSent && sarvamWs?.readyState === 1) { // 1 = OPEN
                  sarvamEndSent = true;
                  sarvamWs.send(JSON.stringify({ event: "end" }));
              }
          });

          sarvamWs.on("open", () => {
            console.log("[SarvamRealtime] Connected to Sarvam upstream WS");
          });

          sarvamWs.on("message", (sarvamData) => {
            try {
              const msg = JSON.parse(sarvamData.toString());
              
              if (msg.event === "session.begin") {
                 streamSessionBegan = true;
                 if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ type: "ready" }));
                 }
              }
              if (msg.event === "session.end") {
                 console.log("[SarvamRealtime] Received session.end from Sarvam");
                 if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: "session_end" }));
                 }
                 cleanup();
              }
              // Relay transcript events back to the client UI
              if (msg.event === "transcript.partial" || msg.event === "transcript.final" || msg.event === "error") {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: msg.event === "transcript.partial" ? "partial" : msg.event === "transcript.final" ? "final" : "error",
                    transcript: msg.transcript || "",
                    message: msg.message || "",
                    language_code: msg.language_code || "auto"
                  }));
                }
              }
            } catch (e) {
               console.error("[SarvamRealtime] Error parsing upstream message", e);
            }
          });

          sarvamWs.on("close", () => {
            console.log("[SarvamRealtime] Sarvam WS closed");
            if (clientWs.readyState === WebSocket.OPEN) {
               // Let the client know it was cleanly closed
               clientWs.send(JSON.stringify({ type: "closed" }));
               clientWs.close();
            }
          });

          sarvamWs.on("error", (err) => {
            console.error("[SarvamRealtime] Sarvam WS error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
               clientWs.send(JSON.stringify({ type: "error", message: "Upstream API error" }));
            }
          });

        } catch (e) {
          console.error("Config parse error", e);
          clientWs.close();
        }
        return;
      }

      // If binary audio chunks are received from the browser UI
      if (isConfigured && isBinary && ffmpeg) {
         ffmpeg.stdin.write(data);
      }
      
      // If client says "stop" via JSON
      if (isConfigured && !isBinary) {
          try {
             const payload = JSON.parse(data.toString());
             if (payload.action === "stop_dictation") {
                 console.log("[SarvamRealtime] Received stop_dictation. Flushing FFmpeg...");
                 // Drain FFmpeg but do not SIGKILL immediately.
                 if (ffmpeg && ffmpeg.stdin) {
                     ffmpeg.stdin.end(); // close stdin so ffmpeg processes remaining data
                     // ffmpeg will exit when it finishes outputting stdout.
                     // The stdout 'end' event handler will send {"event":"end"} to Sarvam.
                 } else if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
                     // If no ffmpeg, just send end to Sarvam
                     sarvamWs.send(JSON.stringify({ event: "end" }));
                 }
             }
          } catch(e){}
      }
    });
  });
}
