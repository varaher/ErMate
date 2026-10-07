import React, { useState, useRef, useEffect } from "react";
import { Mic, Trash2, Pause, Play, Check, AlertTriangle, RefreshCw } from "lucide-react";

// Global active recording state tracking across any VoiceRecorder instances
let globalActiveRecorders = 0;
const globalRecordingListeners = new Set<(active: boolean) => void>();

export function isGlobalVoiceRecordingActive(): boolean {
  return globalActiveRecorders > 0;
}

export function subscribeGlobalVoiceRecording(listener: (active: boolean) => void): () => void {
  globalRecordingListeners.add(listener);
  listener(globalActiveRecorders > 0);
  return () => {
    globalRecordingListeners.delete(listener);
  };
}

export interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  renderMode?: "inline-composer" | "inline-bubble" | "compact-button";
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
  const finalSubmissionSentRef = useRef<boolean>(false);
  const accumulatedRef = useRef<string>("");

  useEffect(() => {
    onRecordingStateChange?.(isRecording || isPaused || isTranscribing || isInitializing);
  }, [isRecording, isPaused, isTranscribing, isInitializing, onRecordingStateChange]);

  useEffect(() => {
    const isBusy = isRecording || isTranscribing;
    if (isBusy) {
      globalActiveRecorders++;
      globalRecordingListeners.forEach(fn => fn(true));
    }
    return () => {
      if (isBusy) {
        globalActiveRecorders = Math.max(0, globalActiveRecorders - 1);
        globalRecordingListeners.forEach(fn => fn(globalActiveRecorders > 0));
      }
    };
  }, [isRecording, isTranscribing]);

  // Tab unload protection while recording is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || isPaused) {
        e.preventDefault();
        e.returnValue = "Dictation is still recording. Discard it and leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (wsRef.current) {
         wsRef.current.close();
      }
      releaseWakeLock();
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
      const wsUrl = `${protocol}//${window.location.host}/api/voice/stream`;
      const ws = new WebSocket(wsUrl);

      const connTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
           ws.close();
           reject(new Error("WebSocket connection timeout"));
        }
      }, 5000);

      ws.onopen = () => {
         // Send configuration to backend
         ws.send(JSON.stringify({ mode: transcriptionMode }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === "ready") {
             clearTimeout(connTimeout);
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
          } else if (msg.type === "session_end" || msg.type === "closed") {
             if (isStoppingRef.current) {
                finalizeTranscription();
             }
          } else if (msg.type === "error") {
             console.error("[VoiceRecorder] Upstream WS Error:", msg.message);
             if (!isStoppingRef.current) setUseFallbackBatch(true);
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
    if (isGlobalVoiceRecordingActive() && !isRecording) {
      if (!window.confirm("Dictation is still recording. Discard it and leave?")) {
        setIsInitializing(false);
        return;
      }
    }

    setMicError(null);
    setIsInitializing(true);
    setAccumulatedFinalText("");
    setCurrentPartialText("");
    accumulatedRef.current = "";
    setUseFallbackBatch(false);
    setIsReconnecting(false);
    isStoppingRef.current = false;
    finalSubmissionSentRef.current = false;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API is not available in this browser. Are you using HTTPS?");
      }

      // 1. Get Microphone Access FIRST before opening WebSocket
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Establish WebSocket NOW that mic is active
      try {
        wsRef.current = await initWebSocket();
      } catch (wsErr) {
        console.warn("[VoiceRecorder] WebSocket failed, forcing batch fallback mode.", wsErr);
        setUseFallbackBatch(true);
      }

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
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setIsTranscribing(true);
            // Instruct backend to flush FFmpeg and finalize VAD buffer
            wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
            
            // Fallback timeout in case WS hangs during closure waiting for session.end
            setTimeout(() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                 console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
                 wsRef.current.close();
                 finalizeTranscription();
              }
            }, 8000);
        } else {
            finalizeTranscription();
        }
      };

      // 250ms chunks for near real-time streaming
      recorder.start(250);
      await requestWakeLock();
      setIsInitializing(false);
      setIsRecording(true);
      setIsPaused(false);

      // Unbounded recording timer: counts indefinitely up until user chooses Done or Discard
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
      let errMsg = err.message || "Could not access microphone. Check browser permissions and try again.";
      if (err.name === "NotAllowedError" || err.message === "Permission denied") {
         errMsg = "Microphone access denied. Please click the site settings icon in your browser address bar to allow microphone access.";
      } else if (err.name === "NotFoundError" || err.message?.includes("Requested device not found")) {
         errMsg = "No microphone found on your device.";
      }
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
    setIsTranscribing(false);
    setIsInitializing(false);
    audioChunksRef.current = [];
    accumulatedRef.current = "";
    totalBytesRef.current = 0;
    setMicError(null);
  };

  const finishRecording = () => {
    isStoppingRef.current = true;
    if (mediaRecorderRef.current) {
      const listener = (mediaRecorderRef.current as any)._visibilityListener;
      if (listener) document.removeEventListener("visibilitychange", listener);
    }
    
    // Stop the media recorder FIRST. This triggers recorder.onstop.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
    } else {
      setIsTranscribing(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !useFallbackBatch) {
         wsRef.current.send(JSON.stringify({ action: "stop_dictation" }));
         setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
               console.warn("[VoiceRecorder] WS finalize timeout. Force closing.");
               wsRef.current.close();
               finalizeTranscription();
            }
         }, 8000);
      } else if (useFallbackBatch && audioChunksRef.current.length > 0) {
         const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
         transcribeAudioBatch(audioBlob, "audio/webm");
      } else {
         finalizeTranscription();
      }
    }
  };

  const finalizeTranscription = () => {
    if (finalSubmissionSentRef.current) return;
    finalSubmissionSentRef.current = true;
    let finalStr = accumulatedRef.current;
    if (currentPartialText) {
       finalStr += (finalStr ? " " : "") + currentPartialText.trim();
    }
    setIsTranscribing(false);
    setIsRecording(false);
    setIsPaused(false);
    
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
    // Clean up in-memory raw audio chunks immediately
    audioChunksRef.current = [];
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
      formData.append("file", audioBlob, `dictation.${ext}`);
      formData.append("language_code", "auto"); 
      formData.append("mode", transcriptionMode);

      const res = await fetch("/api/sarvam/batch-transcribe", { method: "POST", body: formData });

      if (res.status === 413) {
        throw new Error("Recording too long for batch fallback.");
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errText = await res.text().catch(() => "");
        console.error("Non-JSON response:", errText.substring(0, 500));
        throw new Error(`Server error (${res.status}): Please try again.`);
      }

      const data = await res.json();
      if (!res.ok || !data.success || !data.transcript) {
        throw new Error(data.error || "Transcription failed.");
      }

      setIsTranscribing(false);
      setIsRecording(false);
      setIsPaused(false);
      onTranscript(data.transcript);
    } catch (err: any) {
      console.error("[VoiceRecorder] Transcription error:", err);
      const errMsg = err.message || "Transcription failed. Please try again.";
      setMicError(errMsg);
      onError?.(errMsg);
      setIsTranscribing(false);
      setIsRecording(false);
      setIsPaused(false);
    } finally {
      audioChunksRef.current = [];
    }
  };

  const liveText = (accumulatedFinalText + (currentPartialText ? (accumulatedFinalText ? " " : "") + currentPartialText : "")).trim();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. INLINE COMPOSER RENDER MODE (ChatGPT / WhatsApp Style)
  // ─────────────────────────────────────────────────────────────────────────────
  if (renderMode === "inline-composer") {
    // A. Initializing state
    if (isInitializing) {
      return (
        <div className={`w-full flex items-center justify-center gap-2.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl select-none animate-pulse ${className}`}>
          <RefreshCw size={14} className="animate-spin text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Connecting microphone…</span>
        </div>
      );
    }

    // B. Finalizing / Transcribing state
    if (isTranscribing) {
      return (
        <div
          className={`w-full flex items-center justify-center gap-2.5 px-3 py-2.5 bg-indigo-50/80 dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl select-none animate-pulse ${className}`}
          id="voice-finalizing-bar"
        >
          <RefreshCw size={15} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Finalizing dictation…</span>
        </div>
      );
    }

    // C. Active Recording or Paused state (Full Inline Composer Layout)
    if (isRecording || isPaused) {
      return (
        <div
          className={`w-full flex items-center justify-between gap-2 sm:gap-3 px-3 py-2 ${
            isPaused
              ? "bg-slate-100/95 dark:bg-slate-900 border border-amber-300/60 dark:border-amber-800/60"
              : "bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          } rounded-2xl shadow-inner select-none transition-all ${className}`}
          id="voice-inline-composer-bar"
        >
          {/* [ 🗑 Discard ] */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); discardRecording(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
            title="Discard dictation"
            id="voice-discard-btn"
            aria-label="Discard dictation"
          >
            <Trash2 size={16} />
          </button>

          {/* Timer: 01:42 (Monospace, counts without limit) */}
          <span
            className="font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 shrink-0 tabular-nums"
            id="voice-timer"
          >
            {formatTime(recordingSeconds)}
          </span>

          {/* Subtle Audio Waveform Visualizer */}
          <div className="flex items-center gap-1 shrink-0 px-1" id="voice-waveform">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`w-[2.5px] rounded-full transition-all ${
                  isPaused
                    ? "h-2 bg-slate-400/50"
                    : "bg-gradient-to-t from-teal-400 via-cyan-500 to-indigo-600"
                }`}
                style={{
                  height: isPaused ? "8px" : `${6 + ((i * 3) % 10) + 4}px`,
                  animation: isPaused
                    ? "none"
                    : `pulse 0.5s ease-in-out ${i * 0.04}s infinite alternate`
                }}
              />
            ))}
          </div>

          {/* Status or Live Transcript Preview */}
          <div className="flex-1 min-w-0 px-1 truncate text-xs text-slate-500 dark:text-slate-400" id="voice-status-text">
            {isPaused ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">Paused</span>
            ) : liveText ? (
              <span className="text-slate-700 dark:text-slate-300 italic truncate block">"{liveText}"</span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                Listening…
              </span>
            )}
          </div>

          {/* Action Buttons: [ Pause / Resume ] [ ✓ Done ] */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); togglePause(); }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer flex items-center gap-1 ${
                isPaused
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border-emerald-300 dark:border-emerald-800"
                  : "text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700"
              }`}
              title={isPaused ? "Resume dictation" : "Pause dictation"}
              id={isPaused ? "voice-resume-btn" : "voice-pause-btn"}
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
              <span className="inline">{isPaused ? "Resume" : "Pause"}</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); finishRecording(); }}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title="Finish dictation"
              id="voice-done-btn"
            >
              <Check size={14} />
              <span className="inline">Done</span>
            </button>
          </div>
        </div>
      );
    }

    // D. Idle State (Compact Mic Button in the Composer)
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startRecording();
          }}
          className="p-2.5 rounded-full text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center shrink-0 w-10 h-10 shadow-xs"
          title="Start voice dictation (Unlimited duration)"
          id="voice-start-btn"
        >
          <Mic size={18} />
        </button>

        {micError && (
          <div className="absolute bottom-full right-0 mb-2 z-50 p-2.5 bg-rose-600 text-white text-[11px] font-bold rounded-xl shadow-xl whitespace-normal w-52 text-left flex items-start gap-1.5 border border-rose-500/50">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-tight">{micError}</div>
            <button onClick={() => setMicError(null)} className="p-0.5 text-rose-200 hover:text-white cursor-pointer shrink-0">
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. INLINE BUBBLE RENDER MODE (Standalone Full-Width Box)
  // ─────────────────────────────────────────────────────────────────────────────
  if (renderMode === "inline-bubble") {
    return (
      <div className={`w-full ${className}`}>
        {isRecording || isPaused ? (
          <div className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">
            <button
              type="button"
              onClick={discardRecording}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
              title="Discard dictation"
            >
              <Trash2 size={16} />
            </button>
            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100">
              {formatTime(recordingSeconds)}
            </span>
            <div className="flex-1 min-w-0 px-2 truncate text-xs text-slate-500">
              {isPaused ? "Paused" : liveText || "Listening…"}
            </div>
            <button
              type="button"
              onClick={togglePause}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-800"
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={finishRecording}
              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 rounded-lg"
            >
              Done
            </button>
          </div>
        ) : isTranscribing ? (
          <div className="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-950 rounded-2xl flex items-center justify-center gap-3 text-indigo-700 dark:text-indigo-300 font-bold text-xs animate-pulse">
            <RefreshCw size={16} className="animate-spin" />
            Finalizing dictation…
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={startRecording}
            className={`w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer`}
          >
            <Mic size={16} />
            <span>{buttonLabel || "Start Voice Dictation"}</span>
          </button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. COMPACT BUTTON RENDER MODE (Form Inputs & Table Rows)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Non-blocking Floating Mini-Recorder Pill during active recording */}
      {(isRecording || isPaused) && (
        <div className="absolute bottom-full mb-2 right-0 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 whitespace-nowrap text-xs animate-in fade-in duration-150">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); discardRecording(); }}
            className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
            title="Discard"
          >
            <Trash2 size={13} />
          </button>
          <span className="font-mono font-bold text-[11px] text-emerald-400 tabular-nums">
            {formatTime(recordingSeconds)}
          </span>
          <div className="flex items-center gap-0.5 px-0.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-0.5 rounded-full ${isPaused ? "h-1 bg-slate-500" : "bg-cyan-400 animate-pulse"}`}
                style={{ height: isPaused ? "4px" : `${4 + (i % 3) * 3}px` }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePause(); }}
            className="text-slate-300 hover:text-white p-0.5 transition-colors cursor-pointer"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); finishRecording(); }}
            className="text-emerald-400 hover:text-emerald-300 p-0.5 font-bold transition-colors cursor-pointer"
            title="Done"
          >
            <Check size={14} />
          </button>
        </div>
      )}

      {/* Primary Mic Button */}
      <button
        type="button"
        disabled={disabled || isTranscribing || isInitializing}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isRecording ? finishRecording() : startRecording();
        }}
        className={`p-2 rounded-full min-w-9 min-h-9 justify-center transition-all cursor-pointer flex items-center gap-1.5 ${
          isTranscribing
            ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-300"
            : isInitializing
            ? "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700"
            : isRecording
            ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md"
            : "bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700"
        }`}
        title={
          isTranscribing
            ? "Finalizing dictation…"
            : isInitializing
            ? "Connecting microphone…"
            : isRecording
            ? "Click to finish dictation"
            : "Click to start voice dictation"
        }
      >
        {isTranscribing ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : isInitializing ? (
          <RefreshCw size={14} className="animate-spin" />
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
        <div className="absolute bottom-full right-0 mb-2 z-50 p-2.5 bg-rose-600 text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-normal w-48 text-left flex items-start gap-1.5 border border-rose-500/50">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 leading-tight">{micError}</div>
          <button onClick={() => setMicError(null)} className="p-1 -mt-1 -mr-1 text-rose-200 hover:text-white cursor-pointer shrink-0">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
