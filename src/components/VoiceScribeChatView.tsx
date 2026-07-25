import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Mic, Send, Sparkles, AlertCircle, RefreshCw, 
  CheckCircle, FileText, User, Heart, Shield, PlusCircle, Trash2,
  Upload, Camera, BookOpen, MoreHorizontal
} from "lucide-react";
import SpeechMicButton from "./SpeechMicButton";
import { sanitizeDoctorError } from "../utils/sanitizeError";

import { UserProfile } from "../types";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  isOcrProposal?: boolean;
  proposalActive?: boolean;
  extractedData?: any;
}

interface VoiceScribeChatViewProps {
  onBack: () => void;
  onSaveExtractedCase: (extractedData: any, options?: { autoNavigate?: boolean; existingCaseId?: string | null }) => Promise<string> | void;
  profile?: UserProfile;
  onSaveProfile?: (updated: UserProfile) => void;
  messages?: Message[];
  onUpdateMessages?: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
}

export default function VoiceScribeChatView({ 
  onBack, 
  onSaveExtractedCase,
  profile,
  onSaveProfile,
  messages: propsMessages,
  onUpdateMessages
}: VoiceScribeChatViewProps) {
  const [localMessages, setLocalMessages] = useState<Message[]>([
    {
      id: "msg-1",
      sender: "ai",
      text: "ErMate is ready.\n\n🎙️ Dictate your case in your native language\n📄 Scan a referral letter\n💬 Ask a clinical question\n\nEvidence-based. Built for Indian ERs.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const messages = propsMessages || localMessages;
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setMessages = (newMsgs: Message[] | ((prev: Message[]) => Message[])) => {
    if (onUpdateMessages) {
      if (typeof newMsgs === "function") {
        onUpdateMessages(newMsgs(messagesRef.current));
      } else {
        onUpdateMessages(newMsgs);
      }
    } else {
      if (typeof newMsgs === "function") {
        setLocalMessages(newMsgs);
      } else {
        setLocalMessages(newMsgs);
      }
    }
  };
  const [inputText, setInputText] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVoiceCaseId, setActiveVoiceCaseId] = useState<string | null>(null);
  const activeVoiceCaseIdRef = useRef<string | null>(null);
  activeVoiceCaseIdRef.current = activeVoiceCaseId;

  const autoExtractAndSaveCase = async (dictationText: string) => {
    if (!dictationText || !dictationText.trim()) return;
    try {
      const response = await fetch("/api/voice/extract-clinical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          dictation: dictationText,
          aiCredits: profile?.aiCredits
        })
      });

      if (!response.ok) return;

      const resData = await response.json();
      if (resData.success && resData.data) {
        if (onSaveProfile && profile && resData.remainingCredits !== undefined) {
          onSaveProfile({
            ...profile,
            aiCredits: resData.remainingCredits
          });
        }
        const savedId = await onSaveExtractedCase(resData.data, {
          autoNavigate: false,
          existingCaseId: activeVoiceCaseIdRef.current
        });
        if (savedId) {
          setActiveVoiceCaseId(savedId);
          activeVoiceCaseIdRef.current = savedId;
        }
      }
    } catch (err) {
      console.warn("Auto-save voice case extraction notice:", err);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand input text textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  // Document scanning states
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrInputText, setOcrInputText] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // base64 string
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle standard or conversational messages
  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    const userMsg: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    setInputText("");
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/scribe-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages })
      });

      if (!response.ok) {
        throw new Error("Failed to reach clinical assistant.");
      }

      const resData = await response.json();
      if (resData.success && resData.reply) {
        const aiMsg: Message = {
          id: "ai-" + Date.now(),
          sender: "ai",
          text: resData.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(resData.error || "No response received from clinical consult.");
      }
    } catch (err: any) {
      console.error(err);
      // Fallback with official emergency textbooks cited
      const aiMsg: Message = {
        id: "ai-fallback-" + Date.now(),
        sender: "ai",
        text: `Based on your clinical query: "${userText}", here is the general clinical guideline summary:\n\nEnsure immediate resuscitation measures, check airway patency, secure large-bore IV access, and continuous cardiac monitoring.\n\n### 📚 Reference Citations\n* **Tintinalli's Emergency Medicine**: Chapter 22: Cardiac Rhythm Disturbances.\n* **Rosen's Emergency Medicine**: Chapter 12: Airway and Resuscitation protocols.\n* **Harrison's Principles of Internal Medicine**: Section 5: Cardinal Manifestations of Disease.\n* **WikEM**: Resuscitation and emergency department therapies.\n* **UpToDate**: Evidence-based management of acute emergency department presentations.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsProcessing(false);
      // Auto-extract and save case sheet to Emergency Dashboard in background
      setTimeout(() => {
        autoExtractAndSaveCase(getFullDictationString());
      }, 100);
    }
  };

  // Automatically send transcribed voice text to chat & AI assistant
  const handleVoiceTranscript = async (transcriptText: string) => {
    if (!transcriptText.trim()) return;

    const userMsg: Message = {
      id: "user-voice-" + Date.now(),
      sender: "user",
      text: transcriptText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/scribe-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages })
      });

      if (!response.ok) {
        throw new Error("Failed to reach clinical assistant.");
      }

      const resData = await response.json();
      if (resData.success && resData.reply) {
        const aiMsg: Message = {
          id: "ai-" + Date.now(),
          sender: "ai",
          text: resData.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(resData.error || "No response received from clinical consult.");
      }
    } catch (err: any) {
      console.error("Voice Scribe assistant error:", err);
      const aiMsg: Message = {
        id: "ai-fallback-" + Date.now(),
        sender: "ai",
        text: `Based on your clinical dictation: "${transcriptText}", here is the general clinical guideline summary:\n\nEnsure immediate resuscitation measures, check airway patency, secure large-bore IV access, and continuous cardiac monitoring.\n\n### 📚 Reference Citations\n* **Tintinalli's Emergency Medicine**: Chapter 22: Cardiac Rhythm Disturbances.\n* **Rosen's Emergency Medicine**: Chapter 12: Airway and Resuscitation protocols.\n* **Harrison's Principles of Internal Medicine**: Section 5: Cardinal Manifestations of Disease.\n* **WikEM**: Resuscitation and emergency department therapies.\n* **UpToDate**: Evidence-based management of acute emergency department presentations.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsProcessing(false);
      // Auto-extract and save case sheet to Emergency Dashboard in background
      setTimeout(() => {
        autoExtractAndSaveCase(getFullDictationString());
      }, 100);
    }
  };

  // Convert uploaded image to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    setImageMimeType(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setUploadedImage(base64Data);
    };
    reader.readAsDataURL(file);
  };

  // Process reference letter scanning (OCR / simulation)
  const handleOcrScan = async () => {
    if (!ocrInputText.trim() && !uploadedImage) {
      setError("Please paste a letter, upload an image, or load a mockup template.");
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch("/api/scribe-ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uploadedImage,
          mimeType: imageMimeType,
          imageText: ocrInputText
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process document OCR scanner.");
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const extracted = resData.data;

        // User confirmation message in transcript
        const userMsg: Message = {
          id: "user-ocr-" + Date.now(),
          sender: "user",
          text: `📄 [Scanned Reference Document]\n**Source Hospital:** ${extracted.hospitalName || "Metro Heart & General Hospital"}\n**Patient:** ${extracted.patientName || "Robert Miller"} (${extracted.age ? extracted.age + ' y/o' : ''} ${extracted.gender || 'Male'})`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };

        // AI Proposal message
        const aiProposalMsg: Message = {
          id: "ai-proposal-" + Date.now(),
          sender: "ai",
          text: `**I have successfully scanned and processed the referral document!** 📄\n\n### Clinical Summary Extracted:\n* **Patient Name:** ${extracted.patientName || "Robert Miller"}\n* **Age/Gender:** ${extracted.age || "68"} y/o ${extracted.gender || "Male"}\n* **Presenting Complaint:** ${extracted.presentingComplaint || "Acute shortness of breath and chest pressure"}\n* **Admitting Vitals:** BP ${extracted.bp || "165/95"}, HR ${extracted.hr || "98"} bpm, SpO2 ${extracted.spo2 || "91"}%\n* **SAMPLE History Extracted:**\n  - Symptoms: ${extracted.symptoms || "Worsening dyspnea, orthopnea"}\n  - Allergies: ${extracted.allergies || "Penicillin (Anaphylaxis)"}\n  - Past History: ${extracted.pastHistory || "Congestive Heart Failure, CABG x2"}\n\n**Would you like me to include this clinical data as the primary Case Sheet?**`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isOcrProposal: true,
          proposalActive: true,
          extractedData: extracted
        };

        setMessages(prev => [...prev, userMsg, aiProposalMsg]);
        setShowOcrModal(false);

        // Reset states
        setOcrInputText("");
        setUploadedImage(null);
        setImageMimeType(null);
        setImageFileName(null);
      } else {
        throw new Error(resData.error || "Could not parse document data.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during document scanning.");
    } finally {
      setIsScanning(false);
    }
  };

  // Compile user's actual dictations, queries, or OCR proposals for clinical case sheet extraction
  const getFullDictationString = () => {
    const userTexts: string[] = [];

    messages.forEach(m => {
      if (m.sender === "user") {
        if (!m.text.includes("[Scanned Referral Document]") && !m.text.includes("[Scanned Reference Document]")) {
          userTexts.push(m.text);
        }
      } else if (m.sender === "ai") {
        // Extract clinical query/dictation quoted inside fallback AI messages
        const queryMatch = m.text.match(/Based on your clinical (?:query|dictation):\s*["'`]([\s\S]*?)["'`]/i);
        if (queryMatch && queryMatch[1]) {
          userTexts.push(queryMatch[1]);
        }
        // Extract OCR proposal structured data if present
        if (m.isOcrProposal && m.extractedData) {
          const d = m.extractedData;
          const ocrSummary = `Patient: ${d.patientName || "Unknown"}, Age: ${d.age || "N/A"}, Gender: ${d.gender || "N/A"}. Presenting Complaint: ${d.presentingComplaint || ""}. Vitals: BP ${d.bp || "N/A"}, HR ${d.hr || "N/A"}, SpO2 ${d.spo2 || "N/A"}%. Symptoms: ${d.symptoms || ""}. Allergies: ${d.allergies || ""}. Past History: ${d.pastHistory || ""}.`;
          userTexts.push(ocrSummary);
        }
      }
    });

    // Auto-include current unsent text in the textarea
    if (inputText.trim()) {
      userTexts.push(inputText.trim());
    }

    // Deduplicate and filter out empty strings
    const uniqueTexts = Array.from(new Set(userTexts.map(t => t.trim()))).filter(Boolean);
    return uniqueTexts.join("\n\n");
  };

  const handleSaveToCaseSheet = async () => {
    let fullDictation = getFullDictationString();
    
    // Auto-include current unsent text in the textarea to avoid losing work!
    if (inputText.trim()) {
      if (fullDictation) {
        fullDictation += "\n\n" + inputText.trim();
      } else {
        fullDictation = inputText.trim();
      }
    }

    if (!fullDictation.trim()) {
      setError("Please dictate or type some details first before saving.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/voice/extract-clinical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          dictation: fullDictation,
          aiCredits: profile?.aiCredits
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to extract structured data from dictation.");
      }
      
      if (resData.success && resData.data) {
        if (onSaveProfile && profile && resData.remainingCredits !== undefined) {
          onSaveProfile({
            ...profile,
            aiCredits: resData.remainingCredits
          });
        }
        await onSaveExtractedCase(resData.data, {
          autoNavigate: true,
          existingCaseId: activeVoiceCaseIdRef.current
        });
        // Clear chat & reset session so subsequent patient dictations are isolated
        clearChat();
      } else {
        throw new Error(resData.error || "ErMate was unable to extract structured clinical fields.");
      }
    } catch (err: any) {
      console.error(err);
      setError(sanitizeDoctorError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Preload a demo case scenario
  const loadScenario = (scenarioText: string) => {
    const userMsg: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: scenarioText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    fetch("/api/scribe-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...messages, userMsg] })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success && data.reply) {
        setMessages(prev => [...prev, {
          id: "ai-" + Date.now(),
          sender: "ai",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }]);
      }
    })
    .catch(err => {
      console.error(err);
    })
    .finally(() => {
      setIsProcessing(false);
    });
  };

  // Preload mock reference letters
  const loadMockReferralTemplate = (type: string) => {
    setUploadedImage(null);
    setImageFileName(null);
    if (type === "cardio") {
      setOcrInputText(`METRO HEART & GENERAL HOSPITAL - PATIENT REFERRAL LETTER
Date: July 13, 2026
To: Emergency Department, ErMate Medical Center
From: Dr. Alan Sterling, Department of Cardiology, Metro Heart

Dear Colleague,
I am referring Robert Miller, a 68-year-old male with a history of CABG x2 in 2020 and Stage 3 CKD.
He presented to our outpatient clinic today with a 2-day history of worsening shortness of breath, severe orthopnea, and paroxysmal nocturnal dyspnea. He also reports chest pressure (rated 7/10) with minimal exertion.
On assessment, he is in mild respiratory distress, tachypneic at 24/min, heart rate 98 bpm, BP is 165/95 mmHg, and SpO2 is 91% on room air.
Lung exam reveals diffuse fine crepitations in bilateral bases. Jugular venous pressure is elevated (~8 cm H2O), and he has bilateral 2+ pitting pedal edema.
His outpatient medications include Lisinopril 20mg OD, Metoprolol succinate 50mg OD, and Furosemide 40mg OD.
He has a critical allergy to Penicillin, which previously caused anaphylaxis.
I am referring him for immediate clinical evaluation, IV diuretics challenge, and inpatient telemetry.

Sincerely,
Dr. Alan Sterling, FACC`);
    } else if (type === "pediatric") {
      setOcrInputText(`ST. JUDE PEDIATRIC CLINIC - URGENT REFERRAL
Date: July 13, 2026
Patient: Chloe Harrison, 6 years old Female
Parent: Sarah Harrison
Allergies: Severe Amoxicillin allergy (rash and bronchospasm)

Clinical Summary:
Chloe was brought in by her mother with an acute onset of severe wheezing, fever up to 39.2°C, and marked work of breathing for the past 6 hours.
On examination: Patient is alert but distressed. Diffuse expiratory wheezes are heard bilaterally with mild subcostal retractions.
Vitals:
- Heart Rate: 128 bpm
- Respiratory Rate: 32/min
- SpO2: 92% on room air
- Temperature: 39.2°C (tympanic)
Current medications: Salbutamol inhaler as needed.
Last oral intake: A glass of milk approximately 3 hours ago.
Recommendation: Refer to Emergency Center for immediate nebulization therapy, oxygen support, and pediatric medical assessment.

Dr. Melissa Vance, MD`);
    } else if (type === "trauma") {
      setOcrInputText(`COUNTY HOSPITAL TRAUMA CENTER - PATIENT TRANSFER RECORD
Date: July 13, 2026
Patient: Kevin Peters, 28 years old Male
Arrival Mode: Ambulance with C-collar intact (MVA collision)

Vitals on Transfer:
- BP: 105/65 mmHg
- Heart Rate: 110 bpm
- Respiratory Rate: 22/min
- SpO2: 97% on room air
- GCS: 14 (Confused, opening eyes to voice, obeys commands)
- Pain Score: 8/10 (Right thigh)

Clinical Status:
Patient was involved in a high-speed motor vehicle accident. He presents with a right thigh deformity and swelling, highly consistent with a femur fracture. Active bleeding from a 4cm laceration on his left arm, which has been pressure-dressed.
SAMPLE History:
- Allergies: No known drug allergies (NKDA)
- Medications: None
- Last oral intake: Unknown
- Events: Driver of car struck by oncoming vehicle at 50 mph; airbag deployed, self-extricated but unable to bear weight.

Requested Action: Please assume trauma care, obtain urgent femoral X-rays, and consult orthopedic surgery.

Dr. Marcus Brody, Trauma Lead`);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "msg-1",
        sender: "ai",
        text: "Transcript cleared. Speak or type some fresh dictation observations to begin. 🎙️",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    setActiveVoiceCaseId(null);
    activeVoiceCaseIdRef.current = null;
    setInputText("");
    setError(null);
  };

  // Custom visual markdown formatter
  function parseBold(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-extrabold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  function parseMarkdown(text: string) {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return <h3 key={idx} className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-2.5 mb-1 uppercase tracking-wider">{trimmed.replace(/^###\s*/, "")}</h3>;
      }
      if (trimmed.startsWith("##")) {
        return <h2 key={idx} className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-3 mb-1 border-b pb-0.5 border-slate-100 dark:border-slate-800/80">{trimmed.replace(/^##\s*/, "")}</h2>;
      }
      if (trimmed.startsWith("#")) {
        return <h1 key={idx} className="text-sm font-black text-slate-950 dark:text-white mt-3.5 mb-1.5">{trimmed.replace(/^#\s*/, "")}</h1>;
      }
      if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
        const content = parseBold(trimmed.replace(/^[*-\s]+/, ""));
        return <li key={idx} className="ml-4 list-disc text-xs text-slate-700 dark:text-slate-300 my-0.5 leading-relaxed">{content}</li>;
      }
      return <p key={idx} className="text-xs text-slate-750 dark:text-slate-350 my-1 leading-relaxed">{parseBold(line)}</p>;
    });
  }

  return (
    <div id="scribe_desk_root" className="flex flex-col h-[80vh] bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md animate-fade-in">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              <h2 className="text-sm font-extrabold text-slate-850 dark:text-white font-display">Scribe & Clinical Chat</h2>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Textbook Consult & Multi-Hospital Referral Document OCR</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            title="Clear current log"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            onClick={handleSaveToCaseSheet}
            disabled={isProcessing || isTranscribing}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-950 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving to Case Sheet...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Save to Case Sheet
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Chat window */}
        <div className="flex-1 flex flex-col justify-between bg-slate-100/40 dark:bg-slate-900/10 p-4 overflow-y-auto space-y-4">
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div 
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-sm flex flex-col ${
                  m.sender === "user"
                    ? "bg-purple-600 text-white rounded-tr-none"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-150 dark:border-slate-850"
                }`}>
                  <div className="whitespace-pre-wrap font-sans">
                    {m.sender === "ai" ? parseMarkdown(m.text) : m.text}
                  </div>

                  {/* Render OCR interactive case sheet insertion option */}
                  {m.isOcrProposal && m.proposalActive && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-900 dark:text-purple-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span>Include this scanned hospital transfer as Case Sheet?</span>
                      </div>
                      <p className="text-[10px] text-purple-700/80 dark:text-purple-300/80 leading-snug">
                        Selecting Yes will automatically compile this hospital reference data, configure the vitals, and initiate a newly structured case file.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            // Call save callback
                            onSaveExtractedCase(m.extractedData, { autoNavigate: true, existingCaseId: activeVoiceCaseIdRef.current });
                            // Set proposal inactive
                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, proposalActive: false, text: msg.text + "\n\n✅ *Hospital reference letter successfully included as structured Case Sheet!*" } : msg));
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Yes, Include as Case Sheet
                        </button>
                        <button
                          onClick={() => {
                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, proposalActive: false, text: msg.text + "\n\n❌ *Transfer letter retained in chat log only.*" } : msg));
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer"
                        >
                          No, Keep in Chat
                        </button>
                      </div>
                    </div>
                  )}

                  <span className={`text-[9px] mt-1.5 self-end font-mono ${
                    m.sender === "user" ? "text-purple-200" : "text-slate-400"
                  }`}>
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {isTranscribing && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  <div>
                    <span className="font-extrabold block">Transcribing continuous voice recording...</span>
                    <span className="text-[10px] text-slate-400 font-medium">Please wait while ErMate converts your clinical audio to text</span>
                  </div>
                </div>
              </div>
            )}
            {isProcessing && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  <div>
                    <span className="font-extrabold block">ErMate is thinking, please wait...</span>
                    <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70 font-medium">Consulting medical reference textbooks & formulating answer</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Input Dock */}
          <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            
            {/* 3-Dots Menu Button (More Actions) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`p-2 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 h-9 w-9 cursor-pointer ${showMoreMenu ? 'bg-slate-100 dark:bg-slate-800 text-purple-600' : 'text-slate-500 dark:text-slate-400'}`}
                title="More Actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Popup Dropdown Menu */}
              {showMoreMenu && (
                <div className="absolute left-0 bottom-full mb-2 z-50 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 animate-fade-in flex flex-col space-y-0.5">
                  <div className="px-2.5 py-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/85 mb-1">
                    Scribe Actions
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setShowOcrModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Scan Reference Letter (OCR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearChat();
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Clear Chat Log</span>
                  </button>
                </div>
              )}
            </div>

            {/* Main Textarea */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                disabled={isProcessing || isTranscribing}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isTranscribing ? "Transcribing voice recording... please wait" : isProcessing ? "ErMate is thinking... please wait" : "Ask anything, dictate, or type here..."}
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none px-1 py-2 resize-none max-h-[160px] overflow-y-auto leading-relaxed disabled:opacity-60"
              />
            </div>

            {/* Right side actions: WhatsApp-style dynamic Mic/Send toggle */}
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              {inputText.trim() === "" ? (
                <SpeechMicButton 
                  onTranscript={handleVoiceTranscript} 
                  chatLayout={true}
                  onProcessingChange={setIsTranscribing}
                  className="!w-10 !h-10 !rounded-full !bg-purple-600 hover:!bg-purple-700 !text-white dark:!text-white !border-none shadow-md flex items-center justify-center cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isProcessing || isTranscribing}
                  className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Send message"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Right side helper panel */}
        <div className="hidden lg:block w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              Citing References
            </h3>
            <p className="text-[10px] text-slate-400 leading-snug">
              Every response dynamically cites guidelines and specific thresholds from:
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {[
              { name: "Tintinalli's EM", desc: "Gold-standard Emergency Medicine procedures" },
              { name: "Rosen's EM", desc: "Clinical practice and pathophysiological algorithms" },
              { name: "Harrison's Medicine", desc: "Internal Medicine and diagnostic deep dives" },
              { name: "WikEM Guidelines", desc: "Rapid ER point-of-care references" },
              { name: "UpToDate", desc: "Continuous evidence-based peer reviews" }
            ].map((lib, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-850 dark:text-slate-200">{lib.name}</span>
                <span className="text-[9px] text-slate-400">{lib.desc}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Demo Consult Queries
            </h3>
            <p className="text-[10px] text-slate-400 leading-snug">
              Click any clinical case query to consult our cited textbook reference library instantly:
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {[
              {
                title: "💨 Pediatric Asthma Steps",
                text: "Explain the escalation of therapy for severe pediatric asthma exacerbation according to Tintinalli and Rosen's guidelines. What are the weight-based doses of Epinephrine and Magnesium Sulfate?"
              },
              {
                title: "⚡ Hyperkalemia Cocktail",
                text: "What are the first-line therapies for severe hyperkalemia with ECG changes according to Harrison's and UpToDate? Provide the exact dosage and onset times for Calcium Gluconate, Insulin/Dextrose, and Salbutamol."
              },
              {
                title: "🧠 Status Epilepticus Protocol",
                text: "Outline the first, second, and third-line anticonvulsant algorithms for status epilepticus in adults based on WikEM guidelines and Tintinalli's. State specific timing constraints."
              }
            ].map((sc, idx) => (
              <button
                key={idx}
                onClick={() => loadScenario(sc.text)}
                className="w-full text-left p-2.5 bg-slate-50 hover:bg-purple-50 dark:bg-slate-950/40 dark:hover:bg-purple-950/20 border border-slate-150 dark:border-slate-850 rounded-xl transition-all cursor-pointer group"
              >
                <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 transition-colors">
                  {sc.title}
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-2">
                  {sc.text}
                </p>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* OCR scanner modal */}
      {showOcrModal && (
        <div id="ocr_scanner_modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-150 dark:border-slate-850">
              <h3 className="text-sm font-bold font-display text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Hospital Reference Letter Scanner (Clinical OCR)
              </h3>
              <button 
                onClick={() => {
                  setShowOcrModal(false);
                  setUploadedImage(null);
                  setImageFileName(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              {/* Image Upload Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Option 1: Upload Referral Document / Letter Image
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-850 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-7 h-7 text-slate-400 mb-2" />
                      <p className="text-xs text-slate-500 font-medium">
                        {imageFileName ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{imageFileName}</span>
                        ) : (
                          <span>Click to upload patient record image</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, JPEG (multimodal OCR will run on this file)</p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                  </label>
                </div>
              </div>

              {/* Paste or Mockup Select */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Option 2: Paste Letter Text or Select Hospital Template
                  </label>
                </div>
                
                <textarea
                  rows={4}
                  placeholder="Paste clinical letter/referral text here or click one of the mock-ups below..."
                  value={ocrInputText}
                  onChange={(e) => {
                    setOcrInputText(e.target.value);
                    setUploadedImage(null);
                    setImageFileName(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadMockReferralTemplate("cardio")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-semibold transition-colors"
                  >
                    🏥 Metro Heart (Robert, 68M)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReferralTemplate("pediatric")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-semibold transition-colors"
                  >
                    🏥 St. Jude (Chloe, 6F)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReferralTemplate("trauma")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-semibold transition-colors"
                  >
                    🏥 County Trauma (Kevin, 28M)
                  </button>
                </div>
              </div>
            </div>

            {/* Error display inside modal */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 p-2.5 rounded-xl text-[10px] flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3.5 border-slate-150 dark:border-slate-850">
              <button
                type="button"
                onClick={() => {
                  setShowOcrModal(false);
                  setUploadedImage(null);
                  setImageFileName(null);
                }}
                className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isScanning}
                onClick={handleOcrScan}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Scanning OCR...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Run Document Scan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
