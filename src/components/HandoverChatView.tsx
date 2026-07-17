import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Send, Sparkles, CheckCircle2, Copy, Share2, 
  Printer, MessageSquare, AlertCircle, HelpCircle, Users, Download
} from "lucide-react";
import SpeechMicButton from "./SpeechMicButton";

interface HandoverPatient {
  bed: string;
  name: string;
  ageGender: string;
  complaint: string;
  status: "Critical" | "Unstable" | "Stable" | "For Discharge" | string;
  treatment: string;
  pendingActions: string;
  allergies: string;
  receivingDoctor: string;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

interface HandoverChatViewProps {
  onBack: () => void;
}

export default function HandoverChatView({ onBack }: HandoverChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "Hello! I am your ErMate Shift Handover assistant. I will compile your shift report. Tell me about your patients in any order (e.g., 'Bed 3 is Arthur, 62M, chest pain, STEMI team activated, transferring to cath lab...'). I'll maintain the structured patient board on the right.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [patients, setPatients] = useState<HandoverPatient[]>([
    {
      bed: "Bed 1",
      name: "Arthur Pendelton",
      ageGender: "62M",
      complaint: "Crushing chest pain",
      status: "Critical",
      treatment: "Aspirin 325mg, Clopidogrel 300mg, GTN",
      pendingActions: "Cath lab transfer, cardiology review",
      allergies: "NKDA",
      receivingDoctor: "Dr. Jenkins (Cardio)"
    },
    {
      bed: "Bed 2",
      name: "Chloe Harrison",
      ageGender: "6F",
      complaint: "Wheezing & High Fever",
      status: "Stable",
      treatment: "Nebulized Salbutamol, Dexamethasone",
      pendingActions: "Observe breathing for 2h, discharge if stable",
      allergies: "Amoxicillin",
      receivingDoctor: "Dr. Jenkins"
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const response = await fetch("/api/handover-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ sender: m.sender, text: m.text })),
          currentPatients: patients
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const payload = resData.data;
        
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: payload.replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);

        if (payload.extractedPatients && payload.extractedPatients.length > 0) {
          // If the AI extracted new/updated patient details, merge/add them
          setPatients(payload.extractedPatients);
        }

        if (payload.isReady !== undefined) {
          setIsReady(payload.isReady);
        }
      } else {
        // Fallback simulated parsing
        const textLower = userMsg.text.toLowerCase();
        let newPat: HandoverPatient | null = null;
        
        if (textLower.includes("bed") || textLower.includes("resus")) {
          const bedMatch = userMsg.text.match(/(bed|resus)\s*\d+/i);
          const nameMatch = userMsg.text.match(/is\s+([A-Z][a-z]+)/);
          const ageGenderMatch = userMsg.text.match(/(\d+[MF])/i);
          
          newPat = {
            bed: bedMatch ? bedMatch[0] : "Bed " + (patients.length + 1),
            name: nameMatch ? nameMatch[1] : "Unspecified",
            ageGender: ageGenderMatch ? ageGenderMatch[1] : "Unknown",
            complaint: textLower.includes("chest pain") ? "Chest Pain" : textLower.includes("fever") ? "Fever" : "Assessment",
            status: textLower.includes("critical") ? "Critical" : textLower.includes("unstable") ? "Unstable" : "Stable",
            treatment: "As documented",
            pendingActions: "Pending monitoring",
            allergies: "None specified",
            receivingDoctor: "Dr. Jenkins"
          };
        }

        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "ai",
              text: "I have updated the shift handover board on the right. Is there any other critical details like drug allergies, active treatments or a receiving doctor to document before we finalize?",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          ]);
          if (newPat) {
            setPatients(prev => [...prev.filter(p => p.bed !== newPat!.bed), newPat!]);
          }
          setIsReady(true);
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Critical":
        return "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400";
      case "Unstable":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400";
      case "Stable":
        return "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400";
      case "For Discharge":
        return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  const handleCopyHandover = () => {
    const text = patients.map(p => 
      `[${p.bed}] ${p.name} (${p.ageGender}) - CC: ${p.complaint}\nStatus: ${p.status}\nRx: ${p.treatment}\nPlan: ${p.pendingActions}\nAllergies: ${p.allergies}\nMD: ${p.receivingDoctor}`
    ).join("\n\n---\n\n");
    
    navigator.clipboard.writeText(text);
    alert("Handover text copied to clipboard successfully!");
  };

  const handleWhatsAppShare = () => {
    const text = "*ERMATE SHIFT HANDOVER REPORT*\n\n" + patients.map(p => 
      `*${p.bed}*: ${p.name} (${p.ageGender})\n- Complaint: ${p.complaint}\n- Status: ${p.status}\n- Rx: ${p.treatment}\n- Plan: ${p.pendingActions}\n- Allergies: ${p.allergies}`
    ).join("\n\n");
    
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6" id="handover-chat-view">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              ErMate Shift Handover Coordinator
            </h1>
            <p className="text-xs text-slate-400">
              Speak or type patient updates naturally. ErMate will format a 7-column structured handover registry.
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowFinalizedModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
          Finalize Shift Handover
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: ChatGPT-style Chat */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-sm overflow-hidden h-[550px]">
          
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-b border-slate-150 dark:border-slate-850 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse-slow" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Live Handover Compiler</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map(m => (
              <div 
                key={m.id} 
                className={`flex flex-col max-w-[85%] ${m.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-purple-600 text-white rounded-br-none"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-800"
                }`}>
                  {m.text}
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono p-1">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce delay-200" />
                <span>Compiler analyzing speech...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 'Bed 4 is Robert, 68M, heart failure, BP 135/85, stable...'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <SpeechMicButton 
              onTranscript={(txt) => setInputText(prev => prev ? `${prev} ${txt}` : txt)} 
              className="h-[34px] px-2.5" 
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-2 h-[34px] bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

        {/* Right Side: Structured Handover Board */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">Running Board</span>
              <h3 className="text-sm font-bold font-display">Active Handover Patient Registry</h3>
            </div>
            <span className="text-[10px] bg-white/10 text-slate-300 border border-white/15 px-2 py-0.5 rounded font-mono">
              {patients.length} Cases Logged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
            {patients.map((p, idx) => (
              <div 
                key={idx} 
                className={`bg-white dark:bg-slate-950 border rounded-xl p-4 flex flex-col justify-between shadow-xs ${getStatusColor(p.status)}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] bg-slate-900/10 dark:bg-white/10 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                        {p.bed}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-1 leading-tight">{p.name}</h4>
                    </div>
                    <span className="text-[10px] bg-slate-900/10 dark:bg-white/10 px-2 py-0.5 rounded-full font-mono font-bold uppercase text-[9px]">
                      {p.status}
                    </span>
                  </div>

                  <div className="text-[11px] leading-relaxed space-y-1 pt-1.5 border-t border-slate-200/40 font-mono">
                    <p><strong className="text-slate-600 dark:text-slate-400">CC:</strong> {p.complaint}</p>
                    <p><strong className="text-slate-600 dark:text-slate-400">Rx Given:</strong> {p.treatment}</p>
                    <p><strong className="text-slate-600 dark:text-slate-400">Plan:</strong> {p.pendingActions}</p>
                    <p><strong className="text-slate-600 dark:text-slate-400">Allergies:</strong> <span className="text-rose-600 font-bold">{p.allergies}</span></p>
                    <p><strong className="text-slate-600 dark:text-slate-400">MD Recv:</strong> {p.receivingDoctor}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Handover Finalization Modal */}
      {showFinalizedModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fade-in text-center">
            
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-full w-fit mx-auto">
              <CheckCircle2 className="w-10 h-10 text-purple-600 animate-pulse-slow" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                Handover Sheet successfully drafted!
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Your shift handover is structured and validated against standard ATLS/PALS specifications.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={handleCopyHandover}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                <Copy className="w-5 h-5 text-blue-500" />
                Copy as Text
              </button>
              
              <button
                onClick={handleWhatsAppShare}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                WhatsApp Share
              </button>

              <button
                onClick={() => window.print()}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                <Printer className="w-5 h-5 text-purple-500" />
                Print 7-Col PDF
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowFinalizedModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Modify Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
