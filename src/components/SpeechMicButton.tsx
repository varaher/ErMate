import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

interface SpeechMicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholder?: string;
}

export default function SpeechMicButton({
  onTranscript,
  className = "",
  placeholder = "Dictate..."
}: SpeechMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mode, setMode] = useState<"web" | "sarvam">("web");
  const [language, setLanguage] = useState<string>("en-IN");
  const [sarvamAvailable, setSarvamAvailable] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessingSarvam, setIsProcessingSarvam] = useState(false);

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if Sarvam AI or Gemini is available on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.sarvamConfigured || data.geminiConfigured) {
          setSarvamAvailable(true);
          setMode("sarvam"); // Auto-select server-side transcription if available
        }
      })
      .catch((err) => console.warn("Failed to check transcription availability:", err));
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
    if (isListening) {
      setRecordingSeconds(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
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
  }, [isListening]);

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

  const toggleListening = async () => {
    if (mode === "web") {
      if (!supported) {
        alert(
          "Speech recognition is not supported in your browser. For the best voice experience, please use Google Chrome or Safari, or configure Sarvam AI."
        );
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (isListening) {
        setListeningState(false);
        if (recognitionRef.current) {
          recognitionRef.current.onend = null; // Disable auto-restart loop on explicit stop
          recognitionRef.current.stop();
        }
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setListeningState(true);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            onTranscript(finalTranscript.trim());
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
          if (isListeningRef.current) {
            try {
              recognition.start();
            } catch (err) {
              console.warn("Failed to auto-restart speech recognition:", err);
              setListeningState(false);
            }
          } else {
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
      // Sarvam AI ASR Logic using MediaRecorder
      if (isListening) {
        setListeningState(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          audioChunksRef.current = [];
          
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            if (audioBlob.size === 0) return;
            
            setIsProcessingSarvam(true);
            try {
              const formData = new FormData();
              formData.append("file", audioBlob, "recording.webm");
              formData.append("model", "saarika:v1");
              formData.append("language_code", language);
              
              const res = await fetch("/api/voice/transcribe", {
                method: "POST",
                body: formData
              });
              
              const resData = await res.json();
              if (!res.ok) {
                throw new Error(resData.error || "Speech transcription failed.");
              }
              
              if (resData.success && resData.transcript) {
                onTranscript(resData.transcript);
              }
            } catch (err: any) {
              console.error("Transcription error:", err);
              alert(err.message || "Failed to transcribe clinical dictation.");
            } finally {
              setIsProcessingSarvam(false);
            }
          };
          
          mediaRecorder.start();
          setListeningState(true);
        } catch (err) {
          console.error("Failed to start MediaRecorder:", err);
          alert("Could not access microphone. Please check your browser's microphone permissions.");
          setListeningState(false);
        }
      }
    }
  };

  if (!supported && !sarvamAvailable) {
    return null; // hide if absolutely unsupported
  }

  return (
    <div className="relative inline-flex items-center gap-1" ref={menuRef}>
      <button
        type="button"
        onClick={toggleListening}
        disabled={isProcessingSarvam}
        className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${
          isListening
            ? "bg-red-500 border-red-500 text-white animate-pulse shadow-md"
            : isProcessingSarvam
            ? "bg-amber-500 border-amber-500 text-white"
            : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800"
        } ${className}`}
        title={
          isListening
            ? "Listening continuously... Click to stop."
            : isProcessingSarvam
            ? "Transcribing voice via Sarvam AI..."
            : `Click to dictate (${mode === "sarvam" ? `Sarvam: ${language}` : "Web Speech"})`
        }
      >
        {isListening ? (
          <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
            <MicOff className="w-3.5 h-3.5" />
            <span>{formatTime(recordingSeconds)}</span>
          </div>
        ) : isProcessingSarvam ? (
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Language/Source Selector Gear if Sarvam is configured */}
      {sarvamAvailable && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="px-1.5 py-1 text-[10px] font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
            title="Voice settings & language selection"
          >
            {mode === "sarvam" ? language.split("-")[0].toUpperCase() : "WEB"}
          </button>
          
          {showMenu && (
            <div className="absolute right-0 bottom-full mb-1.5 z-50 w-44 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-1 font-sans text-xs">
              <div className="px-2 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                Voice Source
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("web");
                  setShowMenu(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mode === "web"
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <span>Browser Dictation</span>
              </button>
              <div className="px-2 py-1 mt-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                Sarvam AI Languages
              </div>
              {[
                { code: "en-IN", name: "Hinglish / English" },
                { code: "hi-IN", name: "Hindi (हिंदी)" },
                { code: "bn-IN", name: "Bengali (বাংলা)" },
                { code: "ta-IN", name: "Tamil (தமிழ்)" },
                { code: "te-IN", name: "Telugu (తెలుగు)" },
                { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)" },
                { code: "ml-IN", name: "Malayalam (മലയാളം)" },
                { code: "mr-IN", name: "Marathi (मराठी)" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setMode("sarvam");
                    setLanguage(lang.code);
                    setShowMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                    mode === "sarvam" && language === lang.code
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
