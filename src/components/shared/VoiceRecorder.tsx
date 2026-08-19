import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic, Trash2, Pause, Play, Check, AlertTriangle, RefreshCw } from "lucide-react";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const secondsRef = useRef<number>(0);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    setMicError(null);
    setIsInitializing(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API is not available in this browser. Are you using HTTPS?");
      }

      // Add a timeout to getUserMedia to prevent silent hanging
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error("Microphone permission prompt timed out. Please check your browser settings.")), 15000);
      });

      const stream = await Promise.race([streamPromise, timeoutPromise]);
      
      stream.getAudioTracks().forEach((track) => {
        track.onmute = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            clearInterval(timerRef.current);
          }
        };
        track.onunmute = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            timerRef.current = setInterval(() => {
              secondsRef.current += 1;
              setRecordingSeconds(secondsRef.current);
            }, 1000);
          }
        };
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        };
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      secondsRef.current = 0;
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
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);

        if (secondsRef.current < 1) {
          const errMsg = "Recording too short — please dictate for at least 1 second.";
          setMicError(errMsg);
          onError?.(errMsg);
          setIsRecording(false);
          setIsPaused(false);
          return;
        }

        const actualMime = recorder.mimeType || mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        setIsRecording(false);
        setIsPaused(false);
        
        if (document.visibilityState === "hidden") {
          const resumeTranscribing = () => {
             if (document.visibilityState === "visible") {
                document.removeEventListener("visibilitychange", resumeTranscribing);
                transcribeAudio(audioBlob, actualMime);
             }
          };
          document.addEventListener("visibilitychange", resumeTranscribing);
        } else {
          await transcribeAudio(audioBlob, actualMime);
        }
      };

      recorder.start();
      setIsInitializing(false);
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);

      // Handle visibility change (page backgrounded)
      const handleVisibilityChange = () => {
        if (document.hidden && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.pause();
          setIsPaused(true);
          clearInterval(timerRef.current);
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      // Store listener for cleanup
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
      setIsPaused(false);
    } else {
      recorder.pause();
      setIsPaused(true);
    }
  };

  const discardRecording = () => {
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
    setIsRecording(false);
    setIsPaused(false);
    audioChunksRef.current = [];
    setMicError(null);
  };

  const finishRecording = () => {
    if (mediaRecorderRef.current) {
      const listener = (mediaRecorderRef.current as any)._visibilityListener;
      if (listener) document.removeEventListener("visibilitychange", listener);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const transcribeAudio = async (audioBlob: Blob, mimeType: string) => {
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
      formData.append("language_code", languageCode);

      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });

      if (res.status === 413) {
        throw new Error("Recording too long. Please dictate in shorter segments (under 2 minutes).");
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errText = await res.text().catch(() => "");
        console.error("Non-JSON response:", errText.substring(0, 500));
        throw new Error(`Server error (${res.status}): Please try again or refresh the page.`);
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

  const renderRecordingOverlay = () => {
    if (!isRecording) return null;
    return createPortal(
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100000]">
        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-indigo-500/50 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                {isPaused ? "RECORDING PAUSED" : "RECORDING DICTATION"}
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-emerald-400 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
              {formatTime(recordingSeconds)}
            </span>
          </div>
          {/* Audio Waveform Visualizer Simulation */}
          <div className="flex items-center justify-center gap-1.5 py-2">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] bg-gradient-to-t from-indigo-500 to-emerald-400 rounded-full"
                style={{
                  height: isPaused ? "4px" : `${6 + (i % 5) * 4}px`,
                  animation: isPaused
                    ? "none"
                    : `pulse 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
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
              className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors cursor-pointer ${
                isPaused
                  ? "bg-emerald-950/50 hover:bg-emerald-950/70 text-emerald-400 border-emerald-800/50"
                  : "bg-amber-950/50 hover:bg-amber-950/70 text-amber-400 border-amber-800/50"
              }`}
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
              <span className="text-[9px] font-bold uppercase">{isPaused ? "Resume" : "Pause"}</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); finishRecording(); }}
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
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
      <div className={`w-full ${className}`}>
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
          <div className={`w-full py-3 px-4 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md ${className}`}>
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
            className={`w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${className}`}
          >
            <Mic size={16} />
            <span>{buttonLabel || "Start Voice Dictation"}</span>
          </button>
        )}
      </div>
    );
  }

  // Compact Button Mode
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {isRecording && renderRecordingOverlay()}
      <button
        type="button"
        disabled={disabled || isTranscribing || isInitializing}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isRecording ? finishRecording() : startRecording();
        }}
        className={`p-2 rounded-full min-w-10 min-h-10 justify-center transition-all cursor-pointer flex items-center gap-1.5 ${
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
        <div className="absolute top-full left-0 mt-1 z-50 p-2 bg-rose-600 text-white text-[10px] font-medium rounded-lg shadow-lg whitespace-nowrap flex items-center gap-1">
          <AlertTriangle size={12} />
          {micError}
          <button onClick={() => setMicError(null)} className="ml-1 text-white underline font-bold">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
