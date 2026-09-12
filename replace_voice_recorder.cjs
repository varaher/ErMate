const fs = require('fs');

const content = `import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic, Trash2, Pause, Play, Check, AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

export interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  renderMode?: "inline-bubble" | "compact-button";
  languageCode?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  buttonLabel?: string;
}

export default function VoiceRecorder({
  onTranscript,
  onError,
  onRecordingStateChange,
  renderMode = "compact-button",
  languageCode = "en-IN",
  disabled = false,
  className = "",
  buttonLabel,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcriptionMode, setTranscriptionMode] = useState<"transcribe" | "translate">("translate");

  // WebSocket Streaming State
  const [accumulatedFinalText, setAccumulatedFinalText] = useState<string>("");
  const [currentPartialText, setCurrentPartialText] = useState<string>("");
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [useFallbackBatch, setUseFallbackBatch] = useState<boolean>(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("auto");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const secondsRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const isSystemPausedRef = useRef(false);
  const totalBytesRef = useRef(0);
  
  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const accumulatedRef = useRef<string>("");

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (wsRef.current) {
         wsRef.current.close();
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return \`\${mins.toString().padStart(2, "0")}:\${s.toString().padStart(2, "0")}\`;
  };

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("[VoiceRecorder] Screen Wake Lock request failed:", err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn("[VoiceRecorder] Screen Wake Lock release failed:", err);
    }
  };

  const pauseForSystemEvent = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      isSystemPausedRef.current = true;
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeFromSystemEvent = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused" && isSystemPausedRef.current && document.visibilityState === "visible") {
      recorder.resume();
      isSystemPausedRef.current = false;
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);
    }
  };

  const initWebSocket = () => {
    return new Promise<WebSocket>((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = \`\${protocol}//\${window.location.host}/api/voice/stream\`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
         // Send configuration to backend
         ws.send(JSON.stringify({ mode: transcriptionMode }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === "ready") {
             resolve(ws);
          } else if (msg.type === "partial") {
             setCurrentPartialText(msg.transcript);
          } else if (msg.type === "final") {
             const cleanFinal = msg.transcript.trim();
             if (cleanFinal) {
               setAccumulatedFinalText(prev => {
                  const updated = prev ? prev + " " + cleanFinal : cleanFinal;
                  accumulatedRef.current = updated;
                  return updated;
               });
               setCurrentPartialText("");
             }
             if (msg.language_code) setDetectedLanguage(msg.language_code);
          } else if (msg.type === "error") {
             console.error("[VoiceRecorder] Upstream WS Error:", msg.message);
             if (!isStoppingRef.current) setUseFallbackBatch(true);
          } else if (msg.type === "closed") {
             if (isStoppingRef.current) {
                // Backend finished processing the end of stream
                finalizeTranscription();
             }
          }
        } catch(e) {}
      };

      ws.onerror = () => {
         reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
         if (!isStoppingRef.current) {
            console.warn("[VoiceRecorder] WebSocket dropped unexpectedly. Falling back to batch.");
            setUseFallbackBatch(true);
            setIsReconnecting(false);
         }
      };
    });
  };

  const startRecording = async () => {
    setMicError(null);
    setIsInitializing(true);
    setAccumulatedFinalText("");
    setCurrentPartialText("");
    accumulatedRef.current = "";
    setUseFallbackBatch(false);
    setIsReconnecting(false);
    isStoppingRef.current = false;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API is not available in this browser. Are you using HTTPS?");
      }

      // 1. Establish WebSocket FIRST
      try {
        wsRef.current = await initWebSocket();
      } catch (wsErr) {
        console.warn("[VoiceRecorder] WebSocket failed, forcing batch fallback mode.", wsErr);
        setUseFallbackBatch(true);
      }

      // 2. Get Microphone Access
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error("Microphone permission prompt timed out. Please check your browser settings.")), 15000);
      });

      const stream = await Promise.race([streamPromise, timeoutPromise]);
      
      stream.getAudioTracks().forEach((track) => {
        track.onmute = () => pauseForSystemEvent();
        track.onunmute = () => resumeFromSystemEvent();
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        };
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      secondsRef.current = 0;
      totalBytesRef.current = 0;
      setRecordingSeconds(0);
      
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/wav",
      ];
      const mimeType =
        supportedTypes.find(
          (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
        ) || "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // Always save for fallback
          audioChunksRef.current.push(e.data);
          totalBytesRef.current += e.data.size;
          
          // Stream if WebSocket is open
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !useFallbackBatch) {
             wsRef.current.send(e.data);
          }
        }
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        releaseWakeLock();

        const MIN_AUDIO_BYTES = 2000;
        if (secondsRef.current < 1 || totalBytesRef.current < MIN_AUDIO_BYTES) {
          const errMsg = totalBytesRef.current < MIN_AUDIO_BYTES
            ? "No audio was captured. Please try again."
            : "Recording too short — please dictate for at least 1 second.";
          setMicError(errMsg);
          onError?.(errMsg);
          setIsRecording(false);
          setIsPaused(false);
          releaseWakeLock();
          if (wsRef.current) wsRef.current.close();
          return;
        }

        const actualMime = recorder.mimeType || mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        
        setIsRecording(false);
        setIsPaused(false);
        
        // If we are gracefully stopping WS, it will call finalizeTranscription when closed.
        // If we are in fallback batch mode, we trigger REST API here.
        if (useFallbackBatch) {
            setIsTranscribing(true);
            if (document.visibilityState === "hidden") {
              const resumeTranscribing = () => {
                 if (document.visibilityState === "visible") {
                    document.removeEventListener("visibilitychange", resumeTranscribing);
                    transcribeAudioBatch(audioBlob, actualMime);
                 }
              };
              document.addEventListener("visibilitychange", resumeTranscribing);
            } else {
              await transcribeAudioBatch(audioBlob, actualMime);
            }
        }
      };

      // 250ms chunks are ideal for near real-time streaming
      recorder.start(250);
      await requestWakeLock();
      setIsInitializing(false);
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);

      const handleVisibilityChange = () => {
        if (document.hidden) {
          pauseForSystemEvent();
        } else {
          requestWakeLock();
          resumeFromSystemEvent();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      (mediaRecorderRef.current as any)._visibilityListener = handleVisibilityChange;

    } catch (err: any) {
      console.error("[VoiceRecorder] Mic access failed:", err);
      const errMsg = err.message || "Could not access microphone. Check browser permissions and try again.";
      setMicError(errMsg);
      onError?.(errMsg);
      setIsInitializing(false);
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (isPaused) {
      recorder.resume();
      isSystemPausedRef.current = false;
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);
    } else {
      recorder.pause();
      isSystemPausedRef.current = false;
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const discardRecording = () => {
    isStoppingRef.current = true;
    if (wsRef.current) wsRef.current.close();
    
    if (mediaRecorderRef.current) {
      const listener = (mediaRecorderRef.current as any)._visibilityListener;
      if (listener) document.removeEventListener("visibilitychange", listener);
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
    releaseWakeLock();
    setIsRecording(false);
    setIsPaused(false);
    audioChunksRef.current = [];
    setMicError(null);
  };

  const finishRecording = () => {
    isStoppingRef.current = true;
    if (mediaRecorderRef.current) {
      const listener = (mediaRecorderRef.current as any)._visibilityListener;
      if (listener) document.removeEventListener("visibilitychange", listener);
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !useFallbackBatch) {
       // Stop audio and instruct backend to finalize the VAD buffer
       setIsTranscribing(true);
       wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
       
       // Fallback timeout in case WS hangs during closure
       setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
             wsRef.current.close();
             finalizeTranscription();
          }
       }, 5000);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // will trigger recorder.onstop
    }
  };

  const finalizeTranscription = () => {
    // Collect what we have, append partial if it was abruptly stopped
    let finalStr = accumulatedRef.current;
    if (currentPartialText) {
       finalStr += (finalStr ? " " : "") + currentPartialText.trim();
    }
    setIsTranscribing(false);
    
    if (finalStr.trim().length > 0) {
       onTranscript(finalStr.trim());
    } else {
       // If WS yielded nothing, fallback to batch just in case
       if (audioChunksRef.current.length > 0) {
          const recorder = mediaRecorderRef.current;
          const actualMime = recorder?.mimeType || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
          transcribeAudioBatch(audioBlob, actualMime);
       } else {
          setMicError("No speech detected.");
          onError?.("No speech detected.");
       }
    }
  };

  const transcribeAudioBatch = async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setMicError(null);
    try {
      const formData = new FormData();
      const ext = mimeType.includes("mp4")
        ? "mp4"
        : mimeType.includes("aac")
        ? "aac"
        : mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("wav")
        ? "wav"
        : "webm";
      formData.append("file", audioBlob, \`dictation.\${ext}\`);
      // We pass translation intention to batch backend as well
      formData.append("language_code", "auto"); 
      formData.append("mode", transcriptionMode);

      const res = await fetch("/api/sarvam/transcribe", { method: "POST", body: formData });

      if (res.status === 413) {
        throw new Error("Recording too long for batch fallback.");
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errText = await res.text().catch(() => "");
        console.error("Non-JSON response:", errText.substring(0, 500));
        throw new Error(\`Server error (\${res.status}): Please try again.\`);
      }

      const data = await res.json();
      if (!res.ok || !data.success || !data.transcript) {
        throw new Error(data.error || "Transcription failed.");
      }

      setIsTranscribing(false);
      onTranscript(data.transcript);
    } catch (err: any) {
      console.error("[VoiceRecorder] Transcription error:", err);
      const errMsg = err.message || "Transcription failed. Please try again.";
      setMicError(errMsg);
      onError?.(errMsg);
      setIsTranscribing(false);
    }
  };

  const liveText = (accumulatedFinalText + (currentPartialText ? (accumulatedFinalText ? " " : "") + currentPartialText : "")).trim();

  const renderRecordingOverlay = () => {
    if (!isRecording) return null;
    return createPortal(
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100000]">
        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-indigo-500/50 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 flex flex-col max-h-[60vh]">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                {isPaused ? "RECORDING PAUSED" : "RECORDING DICTATION"}
                {useFallbackBatch && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] border border-amber-500/50">BATCH</span>}
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-emerald-400 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
              {formatTime(recordingSeconds)}
            </span>
          </div>
          
          {/* Audio Waveform Visualizer Simulation */}
          <div className="flex items-center justify-center gap-1.5 py-2 shrink-0">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] bg-gradient-to-t from-indigo-500 to-emerald-400 rounded-full"
                style={{
                  height: isPaused ? "4px" : \`\${6 + (i % 5) * 4}px\`,
                  animation: isPaused
                    ? "none"
                    : \`pulse 0.6s ease-in-out \${i * 0.05}s infinite alternate\`,
                }}
              />
            ))}
          </div>

          {/* Live Transcript Display */}
          <div className="flex-1 overflow-y-auto min-h-[4rem] bg-slate-950 rounded-xl p-3 border border-slate-800 shadow-inner">
             {liveText ? (
                <p className="text-sm font-medium text-slate-300 leading-relaxed">
                   {accumulatedFinalText && <span className="text-slate-100">{accumulatedFinalText} </span>}
                   {currentPartialText && <span className="text-indigo-300 animate-pulse">{currentPartialText}</span>}
                </p>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs font-semibold italic">
                   {useFallbackBatch ? "Listening... (Live transcript unavailable in batch mode)" : "Listening..."}
                </div>
             )}
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 pt-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); discardRecording(); }}
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-950/70 text-rose-400 border border-rose-800/50 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span className="text-[9px] font-bold uppercase">Discard</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); togglePause(); }}
              className={\`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors cursor-pointer \${
                isPaused
                  ? "bg-emerald-950/50 hover:bg-emerald-950/70 text-emerald-400 border-emerald-800/50"
                  : "bg-amber-950/50 hover:bg-amber-950/70 text-amber-400 border-amber-800/50"
              }\`}
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
              <span className="text-[9px] font-bold uppercase">{isPaused ? "Resume" : "Pause"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); finishRecording(); }}
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Check size={14} />
              <span className="text-[9px] font-bold uppercase">Done</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (renderMode === "inline-bubble") {
    return (
      <div className={\`w-full \${className}\`}>
        {!isRecording && !isTranscribing && !isInitializing && (
          <div className="mb-2 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setTranscriptionMode("transcribe"); }}
              className={\`flex-1 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-colors \${transcriptionMode === "transcribe" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setTranscriptionMode("translate"); }}
              className={\`flex-1 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-colors \${transcriptionMode === "translate" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
            >
              Smart
            </button>
          </div>
        )}
        {isRecording && renderRecordingOverlay()}
        {micError && (
          <div className="mb-2 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={14} /> {micError}
            </span>
            <button
              onClick={() => setMicError(null)}
              className="text-xs font-bold text-rose-500 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {isTranscribing ? (
          <div className="p-4 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-950 rounded-2xl flex items-center justify-center gap-3 text-indigo-700 dark:text-indigo-300 font-bold text-xs animate-pulse">
            <RefreshCw size={18} className="animate-spin" />
            Transcribing dictation with ErMate...
          </div>
        ) : isRecording ? (
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-indigo-500/50 shadow-2xl flex items-center justify-center gap-3 font-bold text-xs">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <span>Recording...</span>
          </div>
        ) : isInitializing ? (
          <div className={\`w-full py-3 px-4 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md \${className}\`}>
            <RefreshCw size={16} className="animate-spin" />
            <span>Waiting for microphone...</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startRecording();
            }}
            className={\`w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer \${className}\`}
          >
            <Mic size={16} />
            <span>{buttonLabel || "Start Voice Dictation"}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={\`relative inline-flex items-center \${className}\`}>
      {!isRecording && !isTranscribing && !isInitializing && (
        <div className="mr-2 flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTranscriptionMode("transcribe"); }}
            className={\`px-2 py-1 text-[9px] font-bold uppercase rounded-full transition-colors \${transcriptionMode === "transcribe" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTranscriptionMode("translate"); }}
            className={\`px-2 py-1 text-[9px] font-bold uppercase rounded-full transition-colors \${transcriptionMode === "translate" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}\`}
          >
            Smart
          </button>
        </div>
      )}
      {isRecording && renderRecordingOverlay()}
      <button
        type="button"
        disabled={disabled || isTranscribing || isInitializing}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isRecording ? finishRecording() : startRecording();
        }}
        className={\`p-2 rounded-full min-w-10 min-h-10 justify-center transition-all cursor-pointer flex items-center gap-1.5 \${
          isTranscribing
            ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-300"
            : isInitializing
            ? "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700"
            : isRecording
            ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md"
            : "bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700"
        }\`}
        title={
          isTranscribing
            ? "Transcribing with ErMate..."
            : isInitializing
            ? "Waiting for microphone..."
            : isRecording
            ? "Click to finish dictation and transcribe"
            : "Click to start voice dictation"
        }
      >
        {isTranscribing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs font-bold mr-1">Transcribing...</span>
          </>
        ) : isInitializing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
          </>
        ) : isRecording ? (
          <>
            <Mic size={14} className="animate-bounce" />
            <span className="text-[10px] font-bold font-mono">{formatTime(recordingSeconds)}</span>
          </>
        ) : (
          <>
            <Mic size={14} />
            {buttonLabel && <span className="text-xs font-semibold">{buttonLabel}</span>}
          </>
        )}
      </button>
      {micError && (
        <div className="absolute bottom-full right-0 mb-3 z-50 p-2.5 bg-rose-600 text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-normal w-48 text-left flex items-start gap-1.5 border border-rose-500/50">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 leading-tight">{micError}</div>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMicError(null); }} className="p-1 -mt-1 -mr-1 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/shared/VoiceRecorder.tsx', content);
console.log('VoiceRecorder.tsx replaced successfully');
