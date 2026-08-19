import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, FileWarning, Printer, Send, User, ChevronRight, MessageSquare, Clipboard } from "lucide-react";
import Markdown from "react-markdown";
import { ClinicalCase } from "../types";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import VoiceRecorder from "./shared/VoiceRecorder";

interface MlcCertificatesViewProps {
  cases: ClinicalCase[];
  profile: any;
  onSelectCase: (caseId: string) => void;
}

export function MlcCertificatesView({ cases, profile, onSelectCase }: MlcCertificatesViewProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const [activeTab, setActiveTab] = useState<"preview" | "chat">("preview");

  if (!selectedCase) {
    return (
      <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-orange-500" />
              MLC Registry
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cases.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No MLC cases found.</p>
            ) : (
              cases.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedCaseId(c.id)}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-orange-300 dark:hover:border-orange-800 cursor-pointer transition-colors shadow-sm"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{c.patient.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{c.patient.age}y / {c.patient.gender}</div>
                  {c.patient?.mlcDetails?.natureOfIncident && (
                    <div className="text-[10px] mt-2 font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full inline-block">
                      {c.patient?.mlcDetails.natureOfIncident}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900">
          <FileWarning className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Select an MLC Case</h3>
          <p className="text-sm mt-2 max-w-sm">Choose a case from the registry to view or generate its Medico-Legal Case certificate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <MlcDetailPanel 
        clinicalCase={selectedCase} 
        onBack={() => setSelectedCaseId(null)}
        profile={profile}
      />
    </div>
  );
}

function MlcDetailPanel({ clinicalCase, onBack, profile }: { clinicalCase: ClinicalCase, onBack: () => void, profile: any }) {
  const [activeTab, setActiveTab] = useState<"preview" | "chat">("chat");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="h-16 shrink-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {clinicalCase.patient.name} <span className="text-slate-400 font-normal text-sm">({clinicalCase.patient.age}y / {clinicalCase.patient.gender})</span>
            </h1>
            <div className="text-xs text-orange-600 dark:text-orange-400 font-mono font-bold flex items-center gap-1 mt-0.5">
              <FileWarning className="w-3.5 h-3.5" /> MLC Certificate Draft
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "chat" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            Data Extraction (Chat)
          </button>
          <button 
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "preview" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            <Printer className="w-3.5 h-3.5" /> Certificate Preview
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "chat" ? (
          <MlcChatView clinicalCase={clinicalCase} />
        ) : (
          <MlcCertificatePreview clinicalCase={clinicalCase} profile={profile} />
        )}
      </div>
    </div>
  );
}

function MlcChatView({ clinicalCase }: { clinicalCase: ClinicalCase }) {
  const [messages, setMessages] = useState<any[]>([
    { id: "1", sender: "ai", text: "Paste the outside EMR notes, casualty forms, or injury details here. I will extract all findings and format them directly into the MLC Certificate structure." }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMsg = { id: Date.now().toString(), sender: "user", text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/mlc-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: userMsg.text, 
          caseData: clinicalCase 
        })
      });
      
      const data = await res.json();
      
      if (data.extractedMlc) {
        // Save to case directly
        const updatedCase = {
          ...clinicalCase,
          mlcDetails: {
            ...clinicalCase.patient?.mlcDetails,
            ...data.extractedMlc
          },
          primaryAssessment: data.extractedPrimary || clinicalCase.primaryAssessment,
          secondaryAssessment: data.extractedSecondary || clinicalCase.secondaryAssessment
        };
        
        await updateDoc(doc(db, "cases", clinicalCase.id), updatedCase);
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: "ai",
          text: "I've extracted the MLC details and updated the certificate. You can review it in the Preview tab."
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: "ai",
          text: "Could not parse specific MLC fields from that input. Try providing more details."
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "ai",
        text: "Error processing the extraction."
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 ${msg.sender === "user" ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm" : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm"}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm p-4 flex gap-2 items-center text-slate-500 shadow-sm">
                <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full"></span>
                <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full" style={{ animationDelay: "0.2s" }}></span>
                <span className="animate-bounce inline-block w-2 h-2 bg-indigo-400 rounded-full" style={{ animationDelay: "0.4s" }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="shrink-0 p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all shadow-sm">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Paste outside EMR notes, physical findings, or injury details here..."
            className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-48 min-h-[60px] p-2 text-sm text-slate-800 dark:text-slate-100"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900/50 text-white rounded-xl transition-colors mb-1 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MlcCertificatePreview({ clinicalCase, profile }: { clinicalCase: ClinicalCase, profile: any }) {
  const c = clinicalCase;
  const m = c.patient?.mlcDetails || {};
  
  const handlePrint = () => {
    const printContent = document.getElementById("mlc-certificate-print");
    const originalBody = document.body.innerHTML;
    if (printContent) {
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalBody;
      window.location.reload();
    }
  };

  const getSecondaryList = () => {
    const s = c;
    const items = [];
    if (s.secondaryPicle && s.secondaryPicle !== "Normal") items.push(`Head/Neck: ${s.secondaryPicle}`);
    if (s.secondaryChest && s.secondaryChest !== "Normal") items.push(`Chest: ${s.secondaryChest}`);
    if (s.secondaryPa && s.secondaryPa !== "Normal") items.push(`Abdomen: ${s.secondaryPa}`);
    if (s.pelvis && s.pelvis !== "Normal") items.push(`Pelvis: ${s.pelvis}`);
    if (s.secondaryExtremities && s.secondaryExtremities !== "Normal") items.push(`Extremities: ${s.secondaryExtremities}`);
    if (s.secondaryCns && s.secondaryCns !== "Normal") items.push(`Neurological: ${s.secondaryCns}`);
    if (s.skin && s.skin !== "Normal") items.push(`Skin: ${s.skin}`);
    if (m.additionalNotes) items.push(`Other Notes: ${m.additionalNotes}`);
    return items;
  };

  const secondaryList = getSecondaryList();

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto items-center p-4 md:p-8">
      <div className="w-full max-w-4xl flex justify-end mb-4 no-print">
        <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center gap-2 hover:bg-indigo-700 transition">
          <Printer className="w-4 h-4" /> Print Certificate
        </button>
      </div>

      {/* A4 Paper Container */}
      <div 
        id="mlc-certificate-print"
        className="w-full max-w-[210mm] bg-white min-h-[297mm] shadow-2xl p-[15mm] text-black font-sans relative"
        style={{ color: "#000" }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #mlc-certificate-print, #mlc-certificate-print * { visibility: visible; color: #000 !important; }
            #mlc-certificate-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        `}</style>
        
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-black">
          <h1 className="text-xl font-extrabold uppercase mb-1">ACCIDENT REGISTER CUM WOUND CERTIFICATE</h1>
          <p className="text-xs italic text-gray-700">In accordance with Medical-Legal guidelines</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div><strong>1. Serial No:</strong> {c.uhid || "_________________"}</div>
            <div><strong>2. Date & Time of Examination:</strong> {new Date(c.patient.arrivalTime).toLocaleString()}</div>
          </div>

          <div><strong>3. Name, Sex & Age:</strong> {c.patient.name}, {c.patient.gender} / {c.patient.age} years</div>
          <div><strong>4. Address:</strong> {m.placeOfIncident || "__________________________________________________________"}</div>
          <div><strong>5. Identification Marks:</strong> {m.identificationMark || "1) ________________________ 2) ________________________"}</div>
          <div><strong>6. Brought by (Name & Address):</strong> {m.informantBroughtBy || "____________________________________"}</div>
          <div><strong>7. History was stated by:</strong> {m.historyStatedBy || "____________________________________"}</div>
          
          <div className="mt-4">
            <strong>8. History and alleged cause of injury:</strong>
            <p className="mt-1 pl-4 min-h-[40px] whitespace-pre-wrap">{m.allegedCauseOfInjury || "__________________________________________________________________"}</p>
          </div>

          <div className="mt-4">
            <strong>9. Findings of physical examination:</strong>
            <div className="pl-4 mt-1 grid grid-cols-2 gap-y-1">
              <div><span className="font-semibold">Central Nervous System:</span> {c.primaryAssessment?.disability?.gcsTotal ? `GCS ${c.primaryAssessment.disability.gcsTotal}` : (c.primaryAssessment?.disability?.avpu || "___________")}</div>
              <div><span className="font-semibold">Respiratory System:</span> {c.primaryAssessment?.breathingStatus || "___________"}</div>
              <div><span className="font-semibold">Circulatory System:</span> {c.primaryAssessment?.circulationStatus || "___________"}</div>
              <div><span className="font-semibold">Pre-existing Conditions:</span> {c.sampleHistory?.pastHistory || "Not Reported"}</div>
            </div>
            <div className="pl-4 mt-2">
              <span className="font-semibold">Other Systems:</span> 
              <p className="mt-1 whitespace-pre-wrap">{secondaryList.length > 0 ? secondaryList.join("\n") : "_____________________"}</p>
            </div>
          </div>

          <div className="mt-4">
            <strong>10. Details of injury:</strong>
            <div className="pl-4 mt-1 min-h-[100px] whitespace-pre-wrap">
              {c.investigationImaging || c.notes?.map(n=>n.content).join("\n") || "1.\n2.\n3.\n"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div><strong>11. Whether admitted or not:</strong> {c.dispositionDetails?.decision === "Admit" ? `Admitted (IP No: _________)` : (c.dispositionDetails?.decision || "__________________")}</div>
          </div>

          <div className="mt-4">
            <strong>12. Opinion:</strong>
            <p className="mt-1 pl-4 min-h-[40px] whitespace-pre-wrap">{m.opinion || "__________________________________________________________________"}</p>
          </div>
          
          <div className="mt-4">
            <strong>13. Certificate issued at request of:</strong> {m.certificateRequestedBy || "____________________________________"}
          </div>

          <div className="mt-12 flex justify-between items-end border-t border-gray-300 pt-8">
            <div className="text-sm">
              <div><strong>Date of issue:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Place:</strong> {profile?.hospital || "Hospital"}</div>
            </div>
            <div className="text-right text-sm">
              <div className="border-b border-black w-48 mb-1 inline-block"></div>
              <div className="font-bold">{profile?.name || "Dr. Name"}</div>
              <div>{m.issuingDoctorRegistration || "Reg No: ____________"}</div>
              <div className="italic text-gray-600">{profile?.hospital || "Hospital"}</div>
            </div>
          </div>
          
          <div className="mt-12 text-xs text-gray-500 space-y-1">
            <div>Original to: Police officer-in-charge / Honorable Judiciary.</div>
            <div>Copy to: Patient/ authorized representative.</div>
            <div>Copy to: Office file.</div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
