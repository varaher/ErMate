import React, { useState } from "react";
import { 
  Users, ClipboardCopy, FileText, Printer, Plus, Trash2, Edit2, 
  CheckCircle, HelpCircle, Download, Check, RefreshCw, Layers, LayoutList,
  AlertTriangle, ShieldAlert, ChevronLeft
} from "lucide-react";
import { ClinicalCase, UserProfile, HandoverRecord } from "../types";

interface HandoverViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  handovers: HandoverRecord[];
  setHandovers: React.Dispatch<React.SetStateAction<HandoverRecord[]>>;
  onNavigateToTab?: (tabId: string) => void;
}

interface QuickPastePatient {
  id: string;
  name: string;
  ageGender: string;
  triage: string;
  vitals: string;
  rawNotes: string;
  structuredSBAR?: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
}

interface HandoverTableRow {
  id: string;
  bed: string;
  name: string;
  ageGender: string;
  complaints: string;
  history: string;
  assessment: string;
  planDone: string;
  planToBeDone: string;
  bystander: string;
}

export default function HandoverView({ profile, cases, handovers, setHandovers, onNavigateToTab }: HandoverViewProps) {
  // Main view navigation: "registry" (Active Cases) or "quickpaste" (EMR Quick Paste)
  const [activeSubTab, setActiveSubTab] = useState<"registry" | "quickpaste">("registry");

  // State for Registry Cases selection (by default select all active cases)
  const [selectedRegistryIds, setSelectedRegistryIds] = useState<string[]>(
    cases.filter(c => c.status === "Active").map(c => c.id)
  );

  // Quick Paste lists state (supports saving any number of patients)
  const [quickPasteList, setQuickPasteList] = useState<QuickPastePatient[]>([
    {
      id: "qp-1",
      name: "Bed 3 (John Doe)",
      ageGender: "52y / Male",
      triage: "P1 (Immediate)",
      vitals: "BP 160/95 | HR 112 | SpO2 91%",
      rawNotes: "Pasted from EMR:\nPatient presented with acute crushing chest pain for 2 hours, radiating to jaw. Diaphoretic. ECG shows 3mm ST elevation in V1-V4. Loading doses of Aspirin 325mg and Ticagrelor 180mg given at 10:15 AM. Cardiology consulted and patient accepted for immediate primary PCI in cath lab. Prep in progress. IV fluids running.",
      structuredSBAR: {
        situation: "52y Male in Bed 3 with acute retrosternal chest pain, diagnosed with Anterior Wall STEMI.",
        background: "Known history of hypertension and hyperlipidemia. Smoker.",
        assessment: "Hemodynamically stable but tachypneic. ST elevation in V1-V4. Antiplatelets loaded.",
        recommendation: "Transfer immediately to Cath Lab. Secure patent IV and keep oxygen active."
      }
    },
    {
      id: "qp-2",
      name: "Bed 7 (Clara Oswald)",
      ageGender: "29y / Female",
      triage: "P2 (Urgent)",
      vitals: "BP 115/70 | HR 88 | SpO2 99%",
      rawNotes: "EMR Notes:\nSevere right lower quadrant abdominal pain for 12 hours. Nausea, no vomiting. Tender in RLQ with positive McBurney's sign. Ultrasound ordered, report shows swollen non-compressible appendix of 8.5mm with mild surrounding free fluid, consistent with acute appendicitis. NPO since 08:00 AM. IV Cefotetan 2g administered. Surgical resident Dr. Patel reviewed and posted for appendectomy. Waiting for OT vacancy.",
      structuredSBAR: {
        situation: "29y Female in Bed 7 with acute right lower quadrant abdominal pain, diagnosed with acute appendicitis.",
        background: "Prior laparoscopic cholecystectomy 2 years ago. No known drug allergies.",
        assessment: "Tender RLQ abdomen. Ultrasound confirmed appendicitis. Pre-op antibiotics given.",
        recommendation: "Maintain NPO status, administer IV hydration, and monitor for OT transfer."
      }
    }
  ]);

  // Form states for adding/editing a quick-paste patient
  const [qpName, setQpName] = useState("");
  const [qpAgeGender, setQpAgeGender] = useState("");
  const [qpTriage, setQpTriage] = useState("P2 (Urgent)");
  const [qpVitals, setQpVitals] = useState("");
  const [qpRawNotes, setQpRawNotes] = useState("");
  const [editingQpId, setEditingQpId] = useState<string | null>(null);

  // Copy states
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});

  // Generate view modal / print layout
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [printType, setPrintType] = useState<"registry" | "quickpaste">("registry");
  const [handoverLoggedSuccess, setHandoverLoggedSuccess] = useState(false);

  const [editableRows, setEditableRows] = useState<HandoverTableRow[]>([]);
  const [handoverMeta, setHandoverMeta] = useState({
    date: new Date().toLocaleDateString('en-GB'),
    from: "Night Shift",
    to: "Morning Shift",
    time: "07:15 AM",
  });
  const [isViewingSheet, setIsViewingSheet] = useState(false);

  const compileRegistryToSheet = () => {
    const selectedCases = cases.filter(c => selectedRegistryIds.includes(c.id));
    const rows = selectedCases.map((c, idx) => {
      const rxText = c.treatments.map(t => `${t.drugName} ${t.dose}`).join(", ") || "Nil documented";
      const labsText = c.investigationResultsSummary || c.investigations.map(i => `${i.testName}: ${i.result}`).join(", ") || "CBC, LFT, electrolytes sent";
      const planDoneText = `Vitals logged.\nLabs/Imaging: ${labsText}\nTreatments given: ${rxText}`;
      const planToBeDoneText = c.dispositionDetails?.observationNotes || "Review lab/imaging reports. Continue hourly vitals/sensorium checks.";
      const assessmentText = `${c.provisionalPrimaryDiagnosis || "Under evaluation"}\nInitial assessment: conscious, oriented.\nVitals: HR ${c.vitals.hr || "N/A"}, BP ${c.vitals.bp || "N/A"}, SpO2 ${c.vitals.spo2 || "N/A"}%`;

      return {
        id: c.id,
        bed: `Bed ${idx + 1}`,
        name: c.patient.name,
        ageGender: `${c.patient.age || "N/A"}/${c.patient.gender === "Male" ? "M" : "F"}`,
        complaints: c.patient.presentingComplaint,
        history: c.sampleHistory?.pastHistory || "Nil documented",
        assessment: assessmentText,
        planDone: planDoneText,
        planToBeDone: planToBeDoneText,
        bystander: "Parents/Bystander counselled regarding admission and clinical progress.",
      };
    });
    setEditableRows(rows);
    setIsViewingSheet(true);
  };

  const compileQuickPasteToSheet = () => {
    const rows = quickPasteList.map((qp, idx) => {
      const bedMatch = qp.name.match(/bed\s*\d+/i);
      const bedText = bedMatch ? bedMatch[0] : `Bed ${idx + 1}`;
      const nameText = qp.name.replace(/bed\s*\d+\s*\(?/i, "").replace(/\)?$/, "").trim();

      return {
        id: qp.id,
        bed: bedText,
        name: nameText || "Anonymous",
        ageGender: qp.ageGender,
        complaints: qp.rawNotes.substring(0, 150) + "...",
        history: qp.structuredSBAR?.background || "Nil documented",
        assessment: qp.structuredSBAR?.assessment || "Pending assessment",
        planDone: `Vitals logged: ${qp.vitals}\nRaw notes review complete.`,
        planToBeDone: qp.structuredSBAR?.recommendation || "Maintain current orders.",
        bystander: "Bystanders counselled.",
      };
    });
    setEditableRows(rows);
    setIsViewingSheet(true);
  };

  const handleUpdateCell = (id: string, field: keyof HandoverTableRow, value: string) => {
    setEditableRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleToggleRegistryCase = (caseId: string) => {
    if (selectedRegistryIds.includes(caseId)) {
      setSelectedRegistryIds(selectedRegistryIds.filter(id => id !== caseId));
    } else {
      setSelectedRegistryIds([...selectedRegistryIds, caseId]);
    }
  };

  const handleSelectAllRegistry = () => {
    const activeCases = cases.filter(c => c.status === "Active");
    if (selectedRegistryIds.length === activeCases.length) {
      setSelectedRegistryIds([]);
    } else {
      setSelectedRegistryIds(activeCases.map(c => c.id));
    }
  };

  // Structured SBAR Helper
  const extractSBARStructure = (rawText: string, name: string): QuickPastePatient["structuredSBAR"] => {
    // Simple rule-based clinical heuristic extraction to structure EMR text instantly
    const situation = rawText.match(/(?:presented with|presenting with|diagnosed with|diagnosis of)\s+([^.\n]+)/i)?.[1] || `Evaluation of clinical symptoms for ${name}.`;
    const background = rawText.match(/(?:history of|known case of|history|known)\s+([^.\n]+)/i)?.[1] || "No chronic medical conditions listed in EMR snippet.";
    const assessment = rawText.match(/(?:assessment|ECG shows|USG shows|labs show|findings)\s+([^.\n]+)/i)?.[1] || "Clinical vitals logged; primary workup complete.";
    const recommendation = rawText.match(/(?:recommendation|plan|transfer|treatment|give|should|waiting for)\s+([^.\n]+)/i)?.[1] || "Continue active monitoring and regular hourly vitals re-checks.";

    return {
      situation: situation.charAt(0).toUpperCase() + situation.slice(1).trim() + ".",
      background: background.charAt(0).toUpperCase() + background.slice(1).trim() + ".",
      assessment: assessment.charAt(0).toUpperCase() + assessment.slice(1).trim() + ".",
      recommendation: recommendation.charAt(0).toUpperCase() + recommendation.slice(1).trim() + "."
    };
  };

  const handleAddOrEditQuickPaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qpName || !qpRawNotes) return;

    const structured = extractSBARStructure(qpRawNotes, qpName);

    if (editingQpId) {
      setQuickPasteList(quickPasteList.map(item => {
        if (item.id === editingQpId) {
          return {
            ...item,
            name: qpName,
            ageGender: qpAgeGender || "N/A",
            triage: qpTriage,
            vitals: qpVitals || "Not documented",
            rawNotes: qpRawNotes,
            structuredSBAR: structured
          };
        }
        return item;
      }));
      setEditingQpId(null);
    } else {
      const newItem: QuickPastePatient = {
        id: "qp-" + Date.now(),
        name: qpName,
        ageGender: qpAgeGender || "N/A",
        triage: qpTriage,
        vitals: qpVitals || "Not documented",
        rawNotes: qpRawNotes,
        structuredSBAR: structured
      };
      setQuickPasteList([...quickPasteList, newItem]);
    }

    // Reset Form
    setQpName("");
    setQpAgeGender("");
    setQpTriage("P2 (Urgent)");
    setQpVitals("");
    setQpRawNotes("");
  };

  const handleEditClick = (item: QuickPastePatient) => {
    setQpName(item.name);
    setQpAgeGender(item.ageGender === "N/A" ? "" : item.ageGender);
    setQpTriage(item.triage);
    setQpVitals(item.vitals === "Not documented" ? "" : item.vitals);
    setQpRawNotes(item.rawNotes);
    setEditingQpId(item.id);
  };

  const handleRemoveQuickPaste = (id: string) => {
    setQuickPasteList(quickPasteList.filter(item => item.id !== id));
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const getRegistryPrintText = (): string => {
    const selectedCases = cases.filter(c => selectedRegistryIds.includes(c.id));
    let text = `==================================================\n`;
    text += `ERMATE ACTIVE PATIENTS SHIFT HANDOVER SHEET\n`;
    text += `==================================================\n`;
    text += `Facility: ${profile.hospital}\n`;
    text += `Lead Clinician: Dr. ${profile.name} (${profile.role})\n`;
    text += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n\n`;

    selectedCases.forEach((c, idx) => {
      text += `${idx + 1}. PATIENT: ${c.patient.name} (${c.patient.age}y / ${c.patient.gender})\n`;
      text += `   Case ID: ${c.id} | UHID: ${c.patient.uhid} | Triage Level: ${c.patient.triageCategory}\n`;
      text += `   Vitals: HR ${c.vitals.hr || "N/A"} | BP ${c.vitals.bp || "N/A"} | SpO2 ${c.vitals.spo2 || "N/A"}%\n`;
      text += `   Chief Complaint: ${c.patient.presentingComplaint}\n`;
      text += `   SAMPLE History:\n`;
      text += `     - Symptoms: ${c.sampleHistory?.symptoms || "N/A"}\n`;
      text += `     - Allergies: ${c.sampleHistory?.allergies || "NKDA"}\n`;
      text += `     - Medications: ${c.sampleHistory?.medications || "N/A"}\n`;
      text += `   Primary Assessment: A-${c.primaryAssessment?.airwayStatus || "Normal"}, B-${c.primaryAssessment?.breathingStatus || "Normal"}, C-${c.primaryAssessment?.circulationStatus || "Normal"}\n`;
      text += `   ER Treatment Given: ${c.treatments.map(t => `${t.drugName} ${t.dose}`).join(", ") || "None recorded"}\n`;
      text += `   Progress Notes Summary: ${c.progressNotes || "Stable."}\n`;
      text += `--------------------------------------------------\n\n`;
    });

    text += `CONFIDENTIAL PROTECTED HEALTH INFORMATION (PHI) - SECURE DISPOSAL PROTOCOLS MANDATED.`;
    return text;
  };

  const getQuickPastePrintText = (): string => {
    let text = `==================================================\n`;
    text += `ERMATE FREE-FORM EMR QUICK PASTE HANDOVER SHEET\n`;
    text += `==================================================\n`;
    text += `Lead Clinician: Dr. ${profile.name} (${profile.role})\n`;
    text += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n\n`;

    quickPasteList.forEach((item, idx) => {
      text += `${idx + 1}. PATIENT: ${item.name} (${item.ageGender})\n`;
      text += `   Triage Priority: ${item.triage} | Current Vitals: ${item.vitals}\n`;
      text += `   IPASS/SBAR Structured Handover Summary:\n`;
      text += `     [S] Situation: ${item.structuredSBAR?.situation}\n`;
      text += `     [B] Background: ${item.structuredSBAR?.background}\n`;
      text += `     [A] Assessment: ${item.structuredSBAR?.assessment}\n`;
      text += `     [R] Recommendation: ${item.structuredSBAR?.recommendation}\n`;
      text += `   Pasted Raw EMR Audit:\n   "${item.rawNotes.replace(/\n/g, "\n   ")}"\n`;
      text += `--------------------------------------------------\n\n`;
    });

    text += `CONFIDENTIAL CLINICAL HANDOVER TRANSITION DOCUMENT.`;
    return text;
  };

  const activeCases = cases.filter(c => c.status === "Active");

  if (isViewingSheet) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans" id="landscape-handover-sheet-workspace">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
              font-family: Arial, sans-serif !important;
            }
            .no-print {
              display: none !important;
            }
            #landscape-handover-sheet-workspace {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 10px !important;
              table-layout: fixed !important;
            }
            th, td {
              border: 1px solid #000 !important;
              padding: 6px !important;
              font-size: 11px !important;
              color: black !important;
              vertical-align: top !important;
              word-wrap: break-word !important;
            }
            th {
              background-color: #f3f4f6 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-weight: bold !important;
            }
            textarea {
              border: none !important;
              background: transparent !important;
              resize: none !important;
              width: 100% !important;
              color: black !important;
              font-family: inherit !important;
              font-size: 11px !important;
              overflow: hidden !important;
            }
            @page {
              size: landscape;
              margin: 0.5cm;
            }
          }
        ` }} />

        {/* Top bar control menu (hidden during print) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm no-print">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4.5 h-4.5 text-indigo-500" />
              EMERGENCY DEPARTMENT - HANDOVER WORKSPACE
            </h2>
            <p className="text-[11px] text-slate-500">
              This layout matches your physical ED clinical sheets. You can live-edit any cell below before printing or exporting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsViewingSheet(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
            >
              ← Back to Selection
            </button>
            <button
              onClick={() => {
                const text = `Date: ${handoverMeta.date} | From: ${handoverMeta.from} | To: ${handoverMeta.to} | Time: ${handoverMeta.time}\n\n` + 
                  editableRows.map((r, idx) => `
Patient #${idx + 1}
----------------------------------------
[Patient Label]: ${r.bed}, ${r.name}, ${r.ageGender}
[Presenting complaints]: ${r.complaints}
[Past medical history]: ${r.history}
[Provisional diagnosis/Initial assessment]: ${r.assessment}
[Management plan Done]: ${r.planDone}
[Management plan To be done]: ${r.planToBeDone}
[Bystander update]: ${r.bystander}
`).join("\n");
                const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `ED_Clinical_Handover_${handoverMeta.date.replace(/\//g, "-")}.txt`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Plain Text
            </button>
            <button
              onClick={() => {
                const text = `Date: ${handoverMeta.date} | From: ${handoverMeta.from} | To: ${handoverMeta.to} | Time: ${handoverMeta.time}\n\n` + 
                  editableRows.map((r, idx) => `
Patient #${idx + 1}
----------------------------------------
[Patient Label]: ${r.bed}, ${r.name}, ${r.ageGender}
[Presenting complaints]: ${r.complaints}
[Past medical history]: ${r.history}
[Provisional diagnosis/Initial assessment]: ${r.assessment}
[Management plan Done]: ${r.planDone}
[Management plan To be done]: ${r.planToBeDone}
[Bystander update]: ${r.bystander}
`).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  setCopiedState(prev => ({ ...prev, "sheet_copy": true }));
                  setTimeout(() => setCopiedState(prev => ({ ...prev, "sheet_copy": false })), 2000);
                });
              }}
              className={`px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                copiedState["sheet_copy"]
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {copiedState["sheet_copy"] ? "Copied!" : "Copy Clipboard"}
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Handover Sheet
            </button>
          </div>
        </div>

        {/* Clinical Handover Sheet Document Layout */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm text-slate-900 dark:text-white space-y-6">
          
          {/* Document Main Heading */}
          <div className="border-b-2 border-slate-300 dark:border-slate-800 pb-4 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div>
              <h1 className="text-xl font-black tracking-wider text-slate-900 dark:text-white font-mono uppercase">
                EMERGENCY DEPARTMENT - DOCTORS HANDOVER SHEET
              </h1>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                CONFIDENTIAL • PROTECTED PATIENT TRANSITION LOG
              </p>
            </div>
            
            {/* Meta Inputs matching image format */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono w-full md:w-auto">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded">
                <span className="text-slate-400 block uppercase font-bold text-[8px]">Date</span>
                <input
                  type="text"
                  value={handoverMeta.date}
                  onChange={(e) => setHandoverMeta(prev => ({ ...prev, date: e.target.value }))}
                  className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-xs text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded">
                <span className="text-slate-400 block uppercase font-bold text-[8px]">From Shift</span>
                <input
                  type="text"
                  value={handoverMeta.from}
                  onChange={(e) => setHandoverMeta(prev => ({ ...prev, from: e.target.value }))}
                  className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-xs text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded">
                <span className="text-slate-400 block uppercase font-bold text-[8px]">To Shift</span>
                <input
                  type="text"
                  value={handoverMeta.to}
                  onChange={(e) => setHandoverMeta(prev => ({ ...prev, to: e.target.value }))}
                  className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-xs text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded">
                <span className="text-slate-400 block uppercase font-bold text-[8px]">Shift Time</span>
                <input
                  type="text"
                  value={handoverMeta.time}
                  onChange={(e) => setHandoverMeta(prev => ({ ...prev, time: e.target.value }))}
                  className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-xs text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Clinical Sheet Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs font-sans text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800">
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[14%]">Patient Label</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[14%]">Presenting complaints</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[12%]">Past medical history</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[20%]">Provisional diagnosis / Initial assessment</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[16%]">Management plan Done</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[14%]">Management plan To be done</th>
                  <th className="border border-slate-300 dark:border-slate-800 p-2 font-bold text-slate-700 dark:text-slate-300 w-[10%]">Bystander update / given time</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    {/* Patient Label */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2.5 align-top space-y-1.5 bg-slate-50/30 dark:bg-slate-900/10">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={row.bed}
                          onChange={(e) => handleUpdateCell(row.id, "bed", e.target.value)}
                          className="bg-transparent border-none p-0 font-bold focus:outline-none focus:ring-0 text-slate-800 dark:text-slate-100 font-mono text-[11px] w-full"
                        />
                      </div>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleUpdateCell(row.id, "name", e.target.value)}
                        className="bg-transparent border-none p-0 font-bold focus:outline-none focus:ring-0 text-xs text-indigo-600 dark:text-indigo-400 w-full"
                        placeholder="Patient Name"
                      />
                      <input
                        type="text"
                        value={row.ageGender}
                        onChange={(e) => handleUpdateCell(row.id, "ageGender", e.target.value)}
                        className="bg-transparent border-none p-0 text-[10px] focus:outline-none focus:ring-0 text-slate-500 w-full font-mono"
                        placeholder="Age/Sex"
                      />
                      <div className="no-print pt-2 flex justify-end">
                        <button
                          onClick={() => setEditableRows(prev => prev.filter(r => r.id !== row.id))}
                          className="text-[9px] text-red-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Remove Row
                        </button>
                      </div>
                    </td>

                    {/* Presenting complaints */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.complaints}
                        onChange={(e) => handleUpdateCell(row.id, "complaints", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[100px] h-full"
                        placeholder="Complaints details..."
                      />
                    </td>

                    {/* Past History */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.history}
                        onChange={(e) => handleUpdateCell(row.id, "history", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[100px] h-full"
                        placeholder="PMH history..."
                      />
                    </td>

                    {/* Assessment */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.assessment}
                        onChange={(e) => handleUpdateCell(row.id, "assessment", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[120px] h-full"
                        placeholder="Assessment..."
                      />
                    </td>

                    {/* Management Done */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.planDone}
                        onChange={(e) => handleUpdateCell(row.id, "planDone", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[120px] h-full"
                        placeholder="Plans completed..."
                      />
                    </td>

                    {/* Management To Be Done */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.planToBeDone}
                        onChange={(e) => handleUpdateCell(row.id, "planToBeDone", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[100px] h-full"
                        placeholder="Pending actions..."
                      />
                    </td>

                    {/* Bystander update */}
                    <td className="border border-slate-300 dark:border-slate-800 p-2 align-top">
                      <textarea
                        value={row.bystander}
                        onChange={(e) => handleUpdateCell(row.id, "bystander", e.target.value)}
                        className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full text-[11px] resize-none leading-relaxed text-slate-700 dark:text-slate-300 font-sans min-h-[100px] h-full"
                        placeholder="Bystander update details..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add custom empty row button (hidden on print) */}
          <div className="no-print pt-2 flex justify-start">
            <button
              onClick={() => {
                const newId = `custom-${Date.now()}`;
                setEditableRows(prev => [
                  ...prev,
                  {
                    id: newId,
                    bed: `Bed ${prev.length + 1}`,
                    name: "New Patient",
                    ageGender: "Age/Sex",
                    complaints: "Presenting complaints details...",
                    history: "Nil documented",
                    assessment: "Provisional diagnosis...",
                    planDone: "Vitals logged.\nLabs/Imaging done.",
                    planToBeDone: "Pending orders...",
                    bystander: "Counselled."
                  }
                ]);
              }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Empty Row
            </button>
          </div>

          {/* Footer warning matching physical sheets */}
          <div className="border-t border-slate-300 dark:border-slate-800 pt-4 text-center text-[10px] text-slate-400 font-mono leading-relaxed">
            <p>This document contains confidential Protected Health Information (PHI) under regional clinical privacy acts.</p>
            <p>Ensure secure handover transition, immediate team endorsement, and secure destruction of printed copies post shift takeover.</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" id="handover-section">
      
      {/* Printable Modal (shown on full print compilation) */}
      {showPrintReport && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-500" />
                Outgoing Handover Compiler
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => {
                    const text = printType === "registry" ? getRegistryPrintText() : getQuickPastePrintText();
                    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `ERMate_Handover_${printType === "registry" ? "Registry" : "Quick_Paste"}_${new Date().toISOString().split('T')[0]}.txt`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Text Export
                </button>
                <button
                  onClick={() => setShowPrintReport(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Close Editor
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="space-y-6 text-slate-800 dark:text-slate-100 p-2 print:p-0 font-sans" id="printable-area-comprehensive">
              <div className="flex justify-between items-start border-b-2 border-indigo-100 pb-4">
                <div>
                  <h1 className="text-xl font-black font-display text-slate-900 dark:text-white uppercase tracking-tight">
                    ErMate Standardized Handover Report
                  </h1>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    Compiled Lead: Dr. {profile.name} | Facility: {profile.hospital}
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-400">
                  <p>Generated: {new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}</p>
                  <p>Method: {printType === "registry" ? "Live ER Registry Integration" : "EMR Quick Paste Engine"}</p>
                </div>
              </div>

              {printType === "registry" ? (
                // Registry Cases Print Layout
                <div className="space-y-6">
                  {cases.filter(c => selectedRegistryIds.includes(c.id)).map((c, idx) => (
                    <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/20">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {idx + 1}. {c.patient.name} ({c.patient.age}y / {c.patient.gender})
                        </h3>
                        <span className="font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {c.patient.triageCategory}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                        <div>
                          <p><strong className="text-slate-500">UHID:</strong> <span className="font-mono">{c.patient.uhid}</span></p>
                          <p><strong className="text-slate-500">Chief Complaint:</strong> {c.patient.presentingComplaint}</p>
                          <p><strong className="text-slate-500">Vitals:</strong> HR {c.vitals.hr || "N/A"} | BP {c.vitals.bp || "N/A"} | SpO2 {c.vitals.spo2 || "N/A"}% | RR {c.vitals.rr || "N/A"}</p>
                        </div>
                        <div>
                          <p><strong className="text-slate-500">Clinical History:</strong> {c.sampleHistory?.symptoms || "No active history listed"}</p>
                          <p><strong className="text-slate-500">Allergies:</strong> <span className="text-red-600 font-bold">{c.sampleHistory?.allergies || "NKDA"}</span></p>
                          <p><strong className="text-slate-500">Therapies given in ER:</strong> {c.treatments.map(t => `${t.drugName} ${t.dose}`).join(", ") || "None recorded"}</p>
                        </div>
                      </div>

                      {c.progressNotes && (
                        <div className="text-xs bg-white p-2.5 rounded border border-slate-150 font-mono text-slate-600">
                          <strong className="text-[10px] text-slate-400 block uppercase mb-1">ER Progress Log Summary:</strong>
                          {c.progressNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Quick Paste Print Layout
                <div className="space-y-6">
                  {quickPasteList.map((item, idx) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/20">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {idx + 1}. {item.name} ({item.ageGender})
                        </h3>
                        <span className="font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {item.triage}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-slate-500"><strong className="text-slate-700">Vitals at Handover:</strong> {item.vitals}</p>

                      {/* Structured SBAR display */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-blue-700 text-[10px] uppercase block tracking-wider mb-1">[S] Situation</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.situation}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-purple-700 text-[10px] uppercase block tracking-wider mb-1">[B] Background</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.background}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-amber-700 text-[10px] uppercase block tracking-wider mb-1">[A] Assessment</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.assessment}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-emerald-700 text-[10px] uppercase block tracking-wider mb-1">[R] Recommendation</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.recommendation}</p>
                        </div>
                      </div>

                      <div className="text-[10px] bg-slate-100 p-2 rounded font-mono text-slate-500 whitespace-pre-wrap">
                        <strong className="block mb-1 text-[9px] uppercase tracking-wider text-slate-400">Raw EMR Pasted Records:</strong>
                        {item.rawNotes}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 text-center text-[10px] text-slate-400 font-mono leading-relaxed">
                <p>This document contains confidential Protected Health Information (PHI) subject to regional clinical privacy acts.</p>
                <p>Ensure secure transition, immediate consultant endorsement, and secure document disposal post shift takeover.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10">
          <RefreshCw className="w-80 h-80 animate-spin-slow" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono">
                  IPASS / SBAR Standardized Tool
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono">
                  ✓ Free Feature (Unlimited Cases)
                </span>
              </div>
              <h1 className="text-2xl font-black font-display tracking-tight">Shift Handover & Transition Center</h1>
              <p className="text-slate-300 text-xs max-w-xl font-medium leading-relaxed">
                Perform clinical shift endorsement safely. Compile outgoing summaries for boarding department cases, or instantly paste EMR dumps to auto-structure printable shift transition sheets.
              </p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("dashboard")}
                className="self-start md:self-center py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl transition-all flex items-center gap-2 font-bold font-mono text-[11px] uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
              >
                <ChevronLeft className="w-4 h-4 text-emerald-400" /> Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Toggle */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80 w-fit no-print">
        <button
          onClick={() => setActiveSubTab("registry")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "registry"
              ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <LayoutList className="w-4 h-4" />
          Active ER Registry Handover
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full font-mono font-bold">
            {activeCases.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab("quickpaste")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "quickpaste"
              ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <ClipboardCopy className="w-4 h-4" />
          Direct EMR Quick Paste
          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full font-mono font-bold">
            Always Free
          </span>
        </button>
      </div>

      {/* SUB-TAB 1: REGISTERED ER CASES HANDOVER */}
      {activeSubTab === "registry" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Active Cases Endorsement Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Select Cases for Shift Endorsement</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Toggle checkbox to include the patient in the compiled printable handover.</p>
                </div>
                <button
                  onClick={handleSelectAllRegistry}
                  className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1 bg-indigo-50/50 dark:bg-indigo-950/25 rounded"
                >
                  {selectedRegistryIds.length === activeCases.length ? "Deselect All" : "Select All Active"}
                </button>
              </div>

              {activeCases.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                  <p className="text-slate-600 dark:text-slate-300 text-xs font-bold">No Registered Active Cases Found</p>
                  <p className="text-slate-400 text-[10px] max-w-sm mx-auto">There are no boarding active patients in the ER. Complete an admission in the Triage Registry to populate this list.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCases.map((c) => {
                    const isSelected = selectedRegistryIds.includes(c.id);
                    return (
                      <div 
                        key={c.id}
                        onClick={() => handleToggleRegistryCase(c.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                          isSelected
                            ? "bg-indigo-50/30 dark:bg-indigo-950/15 border-indigo-400/80 ring-1 ring-indigo-50 dark:ring-indigo-950/50"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="pt-1">
                          <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 dark:text-white">{c.patient.name}</h4>
                            <span className="text-[9px] text-slate-400 font-mono">({c.patient.age}y / {c.patient.gender})</span>
                            <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold font-mono uppercase ${
                              c.patient.triageCategory.includes("P1")
                                ? "bg-rose-50 border border-rose-200 text-rose-700"
                                : c.patient.triageCategory.includes("P2")
                                ? "bg-amber-50 border border-amber-200 text-amber-700"
                                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            }`}>
                              {c.patient.triageCategory.split(" ")[0]}
                            </span>
                          </div>
                          
                          <p className="text-slate-600 dark:text-slate-400 truncate"><span className="font-semibold text-slate-700 dark:text-slate-300">Complaint:</span> {c.patient.presentingComplaint}</p>
                          <p className="text-[10px] text-slate-400 font-mono">UHID: {c.patient.uhid} | ER Vitals: HR {c.vitals.hr || "N/A"} bpm, BP {c.vitals.bp || "N/A"} mmHg, SpO2 {c.vitals.spo2 || "N/A"}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Compilation Card (1/3 Width) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b pb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-sm font-bold font-display">Compile Sheet</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between font-mono text-[11px] pb-2 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-400">Selected Patients:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">{selectedRegistryIds.length}</strong>
                </div>

                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Generates an integrated clinical handover report compliant with **IPASS** communication structures, detailing patient demographics, acute vital trends, current treatment statuses, and ongoing clinical instructions.
                </p>

                 <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={compileRegistryToSheet}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Generate Handover Sheet
                </button>

                <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={() => {
                    const selected = cases.filter(c => selectedRegistryIds.includes(c.id));
                    const patientsSummary = selected.map(s => `${s.patient.name} (${s.patient.triageCategory.split(" ")[0]} - ${s.patient.presentingComplaint})`).join(", ");
                    const record: HandoverRecord = {
                      id: "H-" + Math.floor(1000 + Math.random() * 9000),
                      senderName: "Dr. " + profile.name,
                      senderEmail: profile.email,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
                      caseCount: selected.length,
                      patientsText: patientsSummary
                    };
                    setHandovers(prev => [record, ...prev]);
                    setHandoverLoggedSuccess(true);
                    setTimeout(() => setHandoverLoggedSuccess(false), 5000);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Log Handover to Registry
                </button>

                <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={() => {
                    handleCopyText("registry_full", getRegistryPrintText());
                  }}
                  className={`w-full py-2.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    copiedState["registry_full"]
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {copiedState["registry_full"] ? (
                    <>
                      <Check className="w-4 h-4" />
                      Endorsement Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-4 h-4" />
                      Copy endorsement string
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Handover Log Success Alert */}
            {handoverLoggedSuccess && (
              <div className="bg-emerald-500 text-white p-3.5 rounded-xl font-bold text-xs flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>Clinical Handover registered and logged in department registry.</span>
                </div>
                <button 
                  onClick={() => setHandoverLoggedSuccess(false)}
                  className="bg-emerald-700 hover:bg-emerald-850 px-2 py-1 rounded text-[10px]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Outgoing & Incoming Handover Hub */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-5 h-5" />
                  <h3 className="text-sm font-bold font-display">Endorsement Tracker</h3>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded font-mono">
                  {handovers.length} Total
                </span>
              </div>

              {handovers.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">No logged handovers for today's shift.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {handovers.map((hand) => {
                    const isAckBySomeone = !!hand.acknowledgedBy;
                    return (
                      <div key={hand.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {hand.id}
                          </span>
                          {isAckBySomeone ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200/30 font-extrabold flex items-center gap-0.5">
                              <Check className="w-3 h-3 text-emerald-500" />
                              ACKNOWLEDGED
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-200/30 font-extrabold animate-pulse">
                              AWAITING ACK
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          <p><span className="font-bold">From:</span> {hand.senderName}</p>
                          <p className="line-clamp-2 italic text-slate-500 mt-1">"{hand.patientsText}"</p>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                          <span>{hand.timestamp}</span>
                          {isAckBySomeone ? (
                            <span className="text-emerald-500">By: {hand.acknowledgedBy}</span>
                          ) : (
                            <button
                              onClick={() => {
                                setHandovers(prev => prev.map(h => h.id === hand.id ? {
                                  ...h,
                                  acknowledgedBy: "Dr. " + profile.name,
                                  acknowledgedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today"
                                } : h));
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[10px]"
                            >
                              Sign Off & Acknowledge Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Structured Handover Tips */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-500 uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                IPASS Endorsement Protocol
              </div>
              <ul className="text-[11px] text-slate-500 space-y-1 list-disc pl-4 leading-relaxed">
                <li><strong className="text-slate-700 dark:text-slate-300">I</strong>: Illness Severity designation (P1, P2, P3).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">P</strong>: Patient Summary (Active events & reasons).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">A</strong>: Action Items (To-do lists & pending orders).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">S</strong>: Situation awareness & contingency plan.</li>
                <li><strong className="text-slate-700 dark:text-slate-300">S</strong>: Synthesis (Incoming team read-back).</li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: DIRECT EMR QUICK PASTE (FREE FOR ALL) */}
      {activeSubTab === "quickpaste" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* EMR Data Entry Form & Patient Accumulator */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Paste Form Card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    {editingQpId ? "Edit Endorsement Patient Details" : "Quick Endorsement - Paste EMR Summary"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Paste direct unstructured dumps. ErMate auto-extracts and formats structures instantly.</p>
                </div>
                {editingQpId && (
                  <button
                    onClick={() => {
                      setEditingQpId(null);
                      setQpName("");
                      setQpAgeGender("");
                      setQpVitals("");
                      setQpRawNotes("");
                    }}
                    className="text-[10px] text-red-500 hover:underline"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <form onSubmit={handleAddOrEditQuickPaste} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase tracking-wider">Patient Name / Bed ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bed 4 (Martha)"
                      value={qpName}
                      onChange={(e) => setQpName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase tracking-wider">Age & Gender (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 45y / Female"
                      value={qpAgeGender}
                      onChange={(e) => setQpAgeGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase tracking-wider">Triage Level</label>
                    <select
                      value={qpTriage}
                      onChange={(e) => setQpTriage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="P1 (Immediate)">P1 (Immediate)</option>
                      <option value="P2 (Urgent)">P2 (Urgent)</option>
                      <option value="P3 (Non-Urgent)">P3 (Non-Urgent)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Current Vital Signs (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. BP 120/80 | HR 85 bpm | SpO2 98%"
                    value={qpVitals}
                    onChange={(e) => setQpVitals(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Clinical EMR Paste / Handover Snippet *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Paste Epic/Cerner notes here or type manual summaries..."
                    value={qpRawNotes}
                    onChange={(e) => setQpRawNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {editingQpId ? "Save Patient Updates" : "Add Patient to Endorsement"}
                </button>
              </form>
            </div>

            {/* Accumulated Patients List Card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4.5 h-4.5 text-indigo-500" />
                  Current Endorsement List ({quickPasteList.length} Patients)
                </h3>
                {quickPasteList.length > 0 && (
                  <button
                    onClick={() => setQuickPasteList([])}
                    className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear List
                  </button>
                )}
              </div>

              {quickPasteList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <Layers className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">No Patients in compiled quick paste list</p>
                  <p className="text-[10px] text-slate-400 mt-1">Use the form above to copy paste a clinician handover EMR dump.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quickPasteList.map((item, idx) => (
                    <div key={item.id} className="border border-slate-150 dark:border-slate-850 rounded-xl p-4 space-y-3 bg-slate-50/20 relative group">
                      
                      {/* Actions */}
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-850"
                          title="Edit patient"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveQuickPaste(item.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500"
                          title="Remove patient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap pr-16">
                          <span className="font-mono text-[10.5px] font-black text-slate-400">#{idx + 1}</span>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{item.name}</h4>
                          <span className="text-[10px] text-slate-400">({item.ageGender})</span>
                          <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold font-mono uppercase ${
                            item.triage.includes("P1")
                              ? "bg-rose-50 border border-rose-250 text-rose-700"
                              : item.triage.includes("P2")
                              ? "bg-amber-50 border border-amber-250 text-amber-700"
                              : "bg-emerald-50 border border-emerald-250 text-emerald-700"
                          }`}>
                            {item.triage.split(" ")[0]}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 pt-0.5 font-bold">Vitals logged: {item.vitals}</p>
                      </div>

                      {/* Structured SBAR Box */}
                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-[11px] leading-relaxed space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-1 text-[9.5px] font-black uppercase text-indigo-500 tracking-wider">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          Structured SBAR Compilation
                        </div>
                        <p><strong className="text-blue-700 dark:text-blue-400 font-bold">[S] Situation:</strong> {item.structuredSBAR?.situation}</p>
                        <p><strong className="text-purple-700 dark:text-purple-400 font-bold">[B] Background:</strong> {item.structuredSBAR?.background}</p>
                        <p><strong className="text-amber-700 dark:text-amber-400 font-bold">[A] Assessment:</strong> {item.structuredSBAR?.assessment}</p>
                        <p><strong className="text-emerald-700 dark:text-emerald-400 font-bold">[R] Recommendation:</strong> {item.structuredSBAR?.recommendation}</p>
                      </div>

                      {/* Raw note collapse check */}
                      <details className="text-[10px] font-mono text-slate-400">
                        <summary className="cursor-pointer select-none font-bold hover:text-slate-600 transition-colors">Show pasted EMR payload dump</summary>
                        <pre className="bg-slate-100 p-2.5 rounded border border-slate-200 mt-2 text-[10px] leading-relaxed whitespace-pre-wrap font-mono">
                          {item.rawNotes}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Direct Print compilation card (1/3 Width) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b pb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Printer className="w-5 h-5" />
                <h3 className="text-sm font-bold font-display">Compile Multi-Print</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between font-mono text-[11px] pb-2 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-400">Accumulated cases:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">{quickPasteList.length}</strong>
                </div>

                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Accumulate any number of patients from your external hospital EMR workspace. Once satisfied, compile a full clean, standardized shift transition endorsement document that can be printed or exported.
                </p>

                <button
                  disabled={quickPasteList.length === 0}
                  onClick={compileQuickPasteToSheet}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Combined Handover ({quickPasteList.length})
                </button>

                <button
                  disabled={quickPasteList.length === 0}
                  onClick={() => {
                    handleCopyText("quickpaste_full", getQuickPastePrintText());
                  }}
                  className={`w-full py-2.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    copiedState["quickpaste_full"]
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {copiedState["quickpaste_full"] ? (
                    <>
                      <Check className="w-4 h-4" />
                      All Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-4 h-4" />
                      Copy Complete Endorsement
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Always Free Disclaimer Badge */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/80 rounded-xl p-4 space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase">Free Clinician Tier</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                The free-form EMR quick paste utility runs entirely local-first. We do not persist patient records to clinical databases, ensuring zero compliance footprint and permanent free usage.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
