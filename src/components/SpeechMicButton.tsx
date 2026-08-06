import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Brain, Sparkles, RefreshCw, Pause, Play, Trash2, Check, X } from "lucide-react";
import { transcribeAudioLocally, ScanProgress } from "../utils/localTranscribe";
import { sanitizeDoctorError } from "../utils/sanitizeError";
import { auth, db, storage } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

// Helper function to save audio recording to Cloud Storage if consent is granted
async function uploadAudioIfConsented(blob: Blob) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  
  try {
    const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      if (profileData && profileData.hasConsentedToLearning === true) {
        console.log("Learning consent is granted. Uploading de-identified clinical audio to Google Cloud Storage...");
        const fileRef = ref(storage, `voice_recordings/${currentUser.uid}/${Date.now()}_recording.webm`);
        
        // Timeout after 6 seconds to prevent storage/retry-limit-exceeded if Cloud Storage bucket is offline
        const uploadPromise = uploadBytes(fileRef, blob, {
          contentType: "audio/webm",
          customMetadata: {
            userId: currentUser.uid,
            timestamp: new Date().toISOString()
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cloud Storage upload timeout")), 6000)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        console.log("Audio recording successfully uploaded to Cloud Storage.");
      }
    }
  } catch (err: any) {
    console.info("Cloud Storage voice recording backup skipped:", err?.message || err);
  }
}

// Check if browser is running on a mobile device
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Dictation recording configuration
const VOICE_CONFIG = {
  MIN_DURATION_SECONDS: 0.5,    // 0.5 seconds minimum to support quick updates/dictations
  MIN_FILE_SIZE_BYTES: 500,     // 500 bytes minimum safety to filter out empty files only
};

// Custom non-blocking voice-related feedback toast
function showToast(message: string, type: "info" | "warning" | "success" = "info") {
  if (typeof document === "undefined") return;
  
  let container = document.getElementById("toast-container-voice");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container-voice";
    container.className = "fixed bottom-24 left-1/2 -translate-x-1/2 z-[200000] flex flex-col gap-2 pointer-events-none items-center";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `px-5 py-3 rounded-xl border font-bold text-xs shadow-2xl transition-all duration-300 flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 ${
    type === "success"
      ? "bg-emerald-950 border-emerald-500 text-emerald-300"
      : type === "warning"
      ? "bg-amber-950 border-amber-500 text-amber-300"
      : "bg-slate-900 border-slate-700 text-slate-200"
  }`;
  
  const icon = type === "success" ? "🟢" : type === "warning" ? "⚠️" : "ℹ️";
  toast.innerHTML = `<span class="mr-1">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => {
      toast.remove();
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    }, 300);
  }, 4500);
}

// Check if system memory is low
function checkDeviceMemory() {
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    const memory = (navigator as any).deviceMemory;
    if (memory && memory <= 4) {
      showToast("Device memory low — consider saving soon", "warning");
    }
  }
}

// Realistic clinical audio transcription processing expectation
function getProcessingMessage(seconds: number): string {
  if (seconds < 120) {
    return "Processing... (~20 seconds)";
  } else if (seconds >= 120 && seconds < 300) {
    return "Processing... (~1 minute)";
  } else if (seconds >= 300 && seconds < 600) {
    return "Processing longer recording... (~2 minutes)";
  } else {
    return "Processing your full case... (~3-4 minutes)\nYou can review the notes while this completes";
  }
}

interface SpeechMicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholder?: string;
  chatLayout?: boolean;
  disabled?: boolean;
  isProcessing?: boolean;
  onProcessingChange?: (processing: boolean) => void;
}

export default function SpeechMicButton({
  onTranscript,
  className = "",
  placeholder = "Dictate...",
  chatLayout = false,
  onProcessingChange
}: SpeechMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supported, setSupported] = useState(true);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mode, setMode] = useState<"web" | "sarvam" | "local_ml">("web");
  const [language, setLanguage] = useState<string>("en-IN");
  const [sarvamAvailable, setSarvamAvailable] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessingSarvam, setIsProcessingSarvam] = useState(false);
  const [localMlProgress, setLocalMlProgress] = useState<ScanProgress | null>(null);

  const isListeningRef = useRef(false);
  const isDiscardedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const recordingSecondsRef = useRef<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Check if Sarvam AI or Gemini is available on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isSpeechSupported = !!SpeechRecognition;
    setSupported(isSpeechSupported);

    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.sarvamConfigured || data.geminiConfigured) {
          setSarvamAvailable(true);
          setMode("sarvam"); // Auto-select server-side transcription if available
        } else {
          setMode(isSpeechSupported ? "web" : "local_ml"); // Default to Web if server APIs are not configured
        }
      })
      .catch((err) => {
        console.warn("Failed to check transcription availability:", err);
        setMode(isSpeechSupported ? "web" : "local_ml");
      });
  }, []);

  // Handle click outside of the menu to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isListening && !isPaused) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isListening, isPaused]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
    
    return () => {
      // Clean up recognition instance on unmount
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const setListeningState = (state: boolean) => {
    setIsListening(state);
    isListeningRef.current = state;
  };

  const handleDelete = () => {
    isDiscardedRef.current = true;
    setListeningState(false);
    setIsPaused(false);
    
    if (mode === "web") {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.warn("Error aborting recognition:", e);
        }
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn("Error stopping media recorder:", e);
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleTogglePause = () => {
    if (mode === "web") {
      if (isPaused) {
        // Resume
        setIsPaused(false);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn("Error restarting web speech:", e);
          }
        }
      } else {
        // Pause
        setIsPaused(true);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.warn("Error stopping web speech:", e);
          }
        }
      }
    } else {
      if (mediaRecorderRef.current) {
        if (isPaused) {
          try {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
          } catch (e) {
            console.warn("Error resuming media recorder:", e);
          }
        } else {
          try {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
          } catch (e) {
            console.warn("Error pausing media recorder:", e);
          }
        }
      }
    }
  };

  const handleFinish = () => {
    setListeningState(false);
    setIsPaused(false);

    if (mode === "web") {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn("Error stopping web speech:", e);
        }
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn("Error stopping media recorder:", e);
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      handleFinish();
      return;
    }

    // Reset recording timer and verify system memory health upon start
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    checkDeviceMemory();

    if (mode === "web") {
      if (!supported) {
        showToast(
          "Speech recognition is not supported in your browser. For the best voice experience, please use Google Chrome or Safari, or use ErMate voice engine.",
          "warning"
        );
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setListeningState(true);
          setIsPaused(false);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            onTranscriptRef.current(finalTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition warning or error:", event.error);
          if (event.error === "no-speech") {
            return;
          }
          setListeningState(false);
        };

        recognition.onend = () => {
          if (isListeningRef.current && !isPaused) {
            try {
              recognition.start();
            } catch (err) {
              console.warn("Failed to auto-restart speech recognition:", err);
              setListeningState(false);
            }
          } else if (!isPaused) {
            setListeningState(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Speech initialization error:", err);
        setListeningState(false);
      }
    } else {
      // Sarvam AI or Local Web-ML Whisper ASR Logic using MediaRecorder
      try {
        isDiscardedRef.current = false;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioChunksRef.current = [];
        
        const supportedTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/aac",
          "audio/ogg",
          "audio/wav"
        ];
        let chosenMime = "audio/webm";
        for (const type of supportedTypes) {
          if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
            chosenMime = type;
            break;
          }
        }

        const mediaRecorder = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : undefined);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          if (isDiscardedRef.current) {
            console.log("Recording discarded by user.");
            isDiscardedRef.current = false;
            return;
          }

          const actualMime = mediaRecorder.mimeType || chosenMime || "audio/webm";
          const ext = actualMime.includes("mp4") ? "mp4" : actualMime.includes("aac") ? "aac" : actualMime.includes("ogg") ? "ogg" : actualMime.includes("wav") ? "wav" : "webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
          if (audioBlob.size === 0) return;

          // 1. Minimum check: Under VOICE_CONFIG.MIN_DURATION_SECONDS
          if (recordingSecondsRef.current < VOICE_CONFIG.MIN_DURATION_SECONDS) {
            if (!chatLayout) {
              showToast("Recording too short. Please dictate for a longer duration.", "info");
            }
            return;
          }

          // 2. File size minimum: safety check (keep in sync with server-side 500 bytes limit)
          if (audioBlob.size < VOICE_CONFIG.MIN_FILE_SIZE_BYTES) {
            if (!chatLayout) {
              showToast("Audio capture too short. Please dictate your clinical case.", "info");
            }
            return;
          }
          
          if (mode === "local_ml") {
            // Inform mobile users about heavy Web-ML model client-side
            if (isMobileDevice()) {
              showToast("Starting offline local transcription. Note: Running Web-ML on mobile requires substantial memory and ~240MB download.", "info");
            }

            setLocalMlProgress({ status: "loading", message: "Starting local transcriber..." });
            try {
              const transcript = await transcribeAudioLocally(audioBlob, (progress) => {
                setLocalMlProgress(progress);
              });
              if (transcript) {
                onTranscriptRef.current(transcript);
                uploadAudioIfConsented(audioBlob).catch((e) => console.info("Cloud Storage Save notice:", e?.message || e));
              }
            } catch (err: any) {
              console.error("Local ML Whisper Error:", err);
              showToast(err.message || "Failed to run client-side Whisper model.", "warning");
            } finally {
              setLocalMlProgress(null);
            }
          } else {
            setIsProcessingSarvam(true);
            try {
              const formData = new FormData();
              formData.append("file", audioBlob, `recording.${ext}`);
              formData.append("model", "saaras:v3");
              formData.append("language_code", language);
              
              const res = await fetch("/api/voice/transcribe", {
                method: "POST",
                body: formData
              });
              
              let resData: any;
              try {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  resData = await res.json();
                } else {
                  const errorText = await res.text();
                  console.error("Non-JSON API response:", errorText);
                  if (errorText.includes("Cookie check") || errorText.includes("Action required to load your app") || errorText.includes("cookie")) {
                    throw new Error("Iframe security cookies blocked. Please open the app in a new tab via the top-right button in AI Studio, or enable cross-website tracking in browser settings.");
                  }
                  throw new Error("Server returned an invalid format (possibly cookie-restricted in iframe). Please open the app in a new tab.");
                }
              } catch (parseErr: any) {
                console.error("Failed to parse API response:", parseErr);
                throw new Error(parseErr.message || "Invalid server response format.");
              }
              
              if (!res.ok) {
                const apiError = new Error(resData?.error || "Speech transcription failed.");
                (apiError as any).status = res.status;
                throw apiError;
              }
              
              if (resData.success && resData.transcript) {
                onTranscriptRef.current(resData.transcript);
                uploadAudioIfConsented(audioBlob).catch((e) => console.info("Cloud Storage Save notice:", e?.message || e));
              }
            } catch (err: any) {
              console.warn("Cloud transcription failed:", err);
              const friendlyMessage = sanitizeDoctorError(err);
              showToast(friendlyMessage, "warning");
            } finally {
              setIsProcessingSarvam(false);
              setLocalMlProgress(null);
            }
          }
        };
        
        mediaRecorder.start();
        setListeningState(true);
        setIsPaused(false);
      } catch (err) {
        console.error("Failed to start MediaRecorder:", err);
        showToast("Could not access microphone. Please check your browser's microphone permissions.", "warning");
        setListeningState(false);
      }
    }
  };

  const isLocalMlProcessing = localMlProgress && localMlProgress.status !== "idle";
  const isGlobalProcessing = isProcessingSarvam || isLocalMlProcessing;

  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(!!isGlobalProcessing);
    }
  }, [isGlobalProcessing, onProcessingChange]);

  return (
    <div className={`${isListening && chatLayout ? "" : "relative inline-flex"} items-center gap-1`} ref={menuRef}>
      <button
        type="button"
        onClick={toggleListening}
        disabled={!!isGlobalProcessing}
        className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${
          isListening
            ? "bg-rose-500 border-rose-500 text-white animate-pulse shadow-md cursor-pointer"
            : isGlobalProcessing
            ? "bg-amber-500 border-amber-500 text-white"
            : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800 cursor-pointer"
        } ${className}`}
        title={
          isListening
            ? "Listening continuously... Click to stop."
            : isLocalMlProcessing
            ? `Local Web-ML Whisper: ${localMlProgress?.message}`
            : isProcessingSarvam
            ? "Transcribing voice via ErMate engine..."
            : `Click to dictate (${mode === "sarvam" ? `Sarvam: ${language}` : mode === "local_ml" ? "Local ML (Whisper)" : "Web Speech"})`
        }
      >
        {isListening ? (
          <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
            <MicOff className="w-3.5 h-3.5 animate-bounce" />
            <span>{formatTime(recordingSeconds)}</span>
          </div>
        ) : isGlobalProcessing ? (
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Inline Processing Indicator removed to be handled gracefully by parent */}

      {/* Floating status display for client-side neural Whisper models */}
      {isLocalMlProcessing && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-64 bg-slate-950/95 text-slate-200 border border-slate-800 rounded-lg shadow-xl p-3 space-y-2 animate-fade-in font-sans">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Brain className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Offline Web-ML Whisper Engine</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal font-medium">
            {localMlProgress?.message}
          </p>
          
          {localMlProgress?.status === "downloading" && typeof localMlProgress.progress === "number" && (
            <div className="space-y-1">
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${localMlProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>Weights downloaded</span>
                <span>{localMlProgress.progress}%</span>
              </div>
            </div>
          )}

          {localMlProgress?.status === "transcribing" && (
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
              <span>Running local WASM neural inference...</span>
            </div>
          )}
        </div>
      )}

      {isProcessingSarvam && !chatLayout && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-72 bg-slate-950/95 text-slate-200 border border-slate-800 rounded-lg shadow-xl p-3 space-y-2 animate-fade-in font-sans">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
            <span>ErMate Voice Processing Engine</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-normal font-medium whitespace-pre-line">
            {getProcessingMessage(recordingSeconds)}
          </p>
          <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono">
            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
            <span>Uploading & transcribing audio...</span>
          </div>
        </div>
      )}

      {/* Language/Source Selector Gear */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="px-1.5 py-1 text-[10px] font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
          title="Voice settings & engine selection"
        >
          {mode === "sarvam" ? language.split("-")[0].toUpperCase() : mode === "local_ml" ? "OFFLINE ML" : "WEB"}
        </button>
        
        {showMenu && (
          <div className="absolute right-0 bottom-full mb-1.5 z-50 w-52 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-1 font-sans text-xs">
            <div className="px-2 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              Voice Transcription Engine
            </div>
            
            <button
              type="button"
              onClick={() => {
                setMode("local_ml");
                setShowMenu(false);
              }}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between cursor-pointer ${
                mode === "local_ml"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-emerald-500" />
                <span>Local Web-ML (Whisper)</span>
              </div>
              <span className="text-[8px] bg-emerald-500 text-white px-1 rounded uppercase font-black tracking-wide font-mono scale-90">Offline</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("web");
                setShowMenu(false);
              }}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between cursor-pointer ${
                mode === "web"
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Browser Dictation (Web)</span>
              </div>
            </button>

            {sarvamAvailable && (
              <>
                <div className="px-2 py-1 mt-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  ErMate Vernacular Languages
                </div>
                {[
                  { code: "unknown", name: "Auto-Detect Language 🔍" },
                  { code: "en-IN", name: "Hinglish / English" },
                  { code: "hi-IN", name: "Hindi (हिंदी)" },
                  { code: "bn-IN", name: "Bengali (বাংলা)" },
                  { code: "ta-IN", name: "Tamil (தமிழ்)" },
                  { code: "te-IN", name: "Telugu (తెలుగు)" },
                  { code: "kn-IN", name: "Kannada (కನ್ನಡ)" },
                  { code: "ml-IN", name: "Malayalam (മലയാളം)" },
                  { code: "mr-IN", name: "Marathi (మరాठी)" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setMode("sarvam");
                      setLanguage(lang.code);
                      setShowMenu(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between cursor-pointer ${
                      mode === "sarvam" && language === lang.code
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span>{lang.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Inline Recording Controller Overlay for chatLayout */}
      {isListening && chatLayout && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes chatgpt-wave {
              0% { transform: scaleY(0.18); }
              100% { transform: scaleY(1.1); }
            }
          `}} />
          <div className="absolute inset-0 z-40 bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            {/* Status and Timer */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full bg-rose-500 ${isPaused ? "opacity-50" : "animate-ping"}`} />
              <span className="text-[10px] font-extrabold font-mono tracking-wider text-slate-300">
                {isPaused ? "PAUSED" : "RECORDING"}
              </span>
              <span className="font-mono text-xs font-black tabular-nums text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded border border-emerald-900/35">
                {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Voice Wave Animation */}
            <div className="hidden xs:flex flex-1 items-center justify-center gap-1 h-6 max-w-[120px] bg-slate-900/50 rounded-lg border border-slate-800/60 px-2 mx-1 overflow-hidden">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                const animationDuration = `${0.35 + (bar % 3) * 0.15}s`;
                const animationDelay = `${bar * 0.03}s`;
                return (
                  <div
                    key={bar}
                    className="w-[2px] h-3 bg-gradient-to-t from-indigo-500 via-purple-400 to-emerald-400 rounded-full origin-center"
                    style={{
                      animation: isPaused ? "none" : `chatgpt-wave ${animationDuration} ease-in-out infinite alternate`,
                      animationDelay: isPaused ? "0s" : animationDelay,
                      transform: isPaused ? "scaleY(0.18)" : undefined,
                    }}
                  />
                );
              })}
            </div>

            {/* Compact Control Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all active:scale-95 cursor-pointer"
                title="Discard recording"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Pause/Play Button */}
              <button
                type="button"
                onClick={handleTogglePause}
                className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                  isPaused 
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" 
                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
                }`}
                title={isPaused ? "Resume recording" : "Pause recording"}
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                ) : (
                  <Pause className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                )}
              </button>

              {/* Done Button */}
              <button
                type="button"
                onClick={handleFinish}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                title="Done and transcribe"
              >
                <Check className="w-3 h-3 stroke-[3px]" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ChatGPT-like Recording Controller Overlay */}
      {isListening && !chatLayout && typeof document !== "undefined" && createPortal(
        <>
          {/* Inject inline keyframe animation specifically for the voice waves */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes chatgpt-wave {
              0% { transform: scaleY(0.18); }
              100% { transform: scaleY(1.1); }
            }
          `}} />

          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100000] bg-slate-950 text-white border border-slate-800 rounded-2xl px-6 py-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 w-[350px] max-w-[95vw] backdrop-blur-md">
            
            {/* Top row: Status, Timer and Waves */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full bg-rose-500 ${isPaused ? "opacity-50" : "animate-ping"}`} />
                <span className="text-xs font-bold font-mono tracking-wider text-slate-300">
                  {isPaused ? "PAUSED" : "RECORDING"}
                </span>
              </div>
              <span className="font-mono text-sm font-black tabular-nums text-emerald-400 bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-900/35">
                {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Voice Wave Animation */}
            <div className="flex items-center justify-center gap-1.5 h-10 bg-slate-900/50 rounded-xl border border-slate-800/60 px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((bar) => {
                const animationDuration = `${0.45 + (bar % 4) * 0.15}s`;
                const animationDelay = `${bar * 0.04}s`;
                return (
                  <div
                    key={bar}
                    className="w-[3px] h-6 bg-gradient-to-t from-indigo-500 via-purple-400 to-emerald-400 rounded-full origin-center transition-all duration-300"
                    style={{
                      animation: isPaused ? "none" : `chatgpt-wave ${animationDuration} ease-in-out infinite alternate`,
                      animationDelay: isPaused ? "0s" : animationDelay,
                      transform: isPaused ? "scaleY(0.18)" : undefined,
                    }}
                  />
                );
              })}
            </div>

            {/* Bottom Row: Explicit Control Buttons with Labels */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              
              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition-all active:scale-95 cursor-pointer"
                title="Discard recording"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
              </button>

              {/* Pause/Play Button */}
              <button
                type="button"
                onClick={handleTogglePause}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                  isPaused 
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25" 
                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25"
                }`}
                title={isPaused ? "Resume recording" : "Pause recording"}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pause</span>
                  </>
                )}
              </button>

              {/* Finish/Done Button */}
              <button
                type="button"
                onClick={handleFinish}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10"
                title="Done and transcribe"
              >
                <Check className="w-4 h-4 stroke-[3px]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Done</span>
              </button>

            </div>

          </div>
        </>,
        document.body
      )}
    </div>
  );
}
