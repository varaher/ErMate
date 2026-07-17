import React, { useState } from "react";
import { 
  PlusCircle, Zap, TrendingUp, Clock, ArrowRight, Activity, 
  Calendar, Users, FileText, Heart, ShieldAlert, ChevronRight, Calculator,
  Mic, AlertTriangle, CheckCircle, Edit, Copy, Download, Check, Eye, ChevronDown, ChevronUp, Briefcase,
  Camera
} from "lucide-react";
import { ClinicalCase, UserProfile, HandoverRecord } from "../types";
import { getCasePendingStatus } from "../utils/caseHelper";

interface DashboardViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  onStartFullFlow: () => void;
  onStartQuickCase: () => void;
  onSelectCase: (caseId: string) => void;
  onNavigateToDischarge: (caseId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  onStartHandoverChat: () => void;
  onStartVoiceScribe: () => void;
  onOpenPediatricCalculator: () => void;
  onOpenPocketMirror: () => void;
  isOnShift: boolean;
  setIsOnShift: (on: boolean) => void;
  showShiftCheckIn: boolean;
  setShowShiftCheckIn: (show: boolean) => void;
  handovers: HandoverRecord[];
  setHandovers: React.Dispatch<React.SetStateAction<HandoverRecord[]>>;
  rotaAssignments: any[];
  setRotaAssignments: React.Dispatch<React.SetStateAction<any[]>>;
  activeShiftDoctors: any[];
  setActiveShiftDoctors: React.Dispatch<React.SetStateAction<any[]>>;
  onSaveCase: (updatedCase: ClinicalCase) => void;
}

export default function DashboardView({
  profile,
  cases,
  onStartFullFlow,
  onStartQuickCase,
  onSelectCase,
  onNavigateToDischarge,
  onNavigateToTab,
  onStartHandoverChat,
  onStartVoiceScribe,
  onOpenPediatricCalculator,
  onOpenPocketMirror,
  isOnShift,
  setIsOnShift,
  showShiftCheckIn,
  setShowShiftCheckIn,
  handovers,
  setHandovers,
  rotaAssignments,
  setRotaAssignments,
  activeShiftDoctors,
  setActiveShiftDoctors,
  onSaveCase,
}: DashboardViewProps) {
  // Statistics
  const activeCasesCount = cases.filter(c => c.status === "Active" || c.status === "Triage").length;
  const casesThisWeekCount = cases.length;
  
  const recentCases = [...cases]
    .sort((a, b) => new Date(b.patient.dateOpened).getTime() - new Date(a.patient.dateOpened).getTime())
    .slice(0, 3);

  // Filter out discharged cases, check which active ones are pending/incomplete
  const pendingCases = cases
    .filter(c => c.status !== "Discharged")
    .map(c => ({
      case: c,
      status: getCasePendingStatus(c)
    }))
    .filter(x => x.status.isPending);

  const [showHandoverSheet, setShowHandoverSheet] = useState<boolean>(false);

  // Shift & Countdown Warning States
  const [showShiftWarning, setShowShiftWarning] = useState<boolean>(false);
  const [warningSeconds, setWarningSeconds] = useState<number>(300); // 5 minutes

  // Active timer for countdown warning
  React.useEffect(() => {
    let timer: any;
    if (showShiftWarning && warningSeconds > 0) {
      timer = setInterval(() => {
        setWarningSeconds(prev => {
          if (prev <= 1) {
            setIsOnShift(false);
            setShowShiftWarning(false);
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showShiftWarning, warningSeconds]);

  // Draft review texts per case for Consultants
  const [consultantReviewTexts, setConsultantReviewTexts] = useState<{[caseId: string]: string}>({});

  // User-specific dashboard cases state and helpers
  const [activeCasesTab, setActiveCasesTab] = useState<"my" | "all">("my");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  const [isHodPanelExpanded, setIsHodPanelExpanded] = useState<boolean>(false);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    }).catch(err => {
      console.error("Could not copy text: ", err);
    });
  };

  const handleDownload = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCaseSheetText = (c: ClinicalCase): string => {
    return `==================================================
ERMATE ELECTRONIC MEDICAL RECORD - CLINICAL CASE SHEET
==================================================
CASE ID: ${c.id}
UHID: ${c.patient.uhid}
DATE OPENED: ${c.patient.dateOpened}
ASSIGNED CLINICIAN: ${c.doctorEmail || "Unassigned"}
CASE STATUS: ${c.status}

PATIENT DEMOGRAPHICS
--------------------
Full Name: ${c.patient.name}
Age & Gender: ${c.patient.age}y / ${c.patient.gender}
Phone Number: ${c.patient.phone || "N/A"}
Arrival Mode: ${c.patient.arrivalMode}
Triage Category: ${c.patient.triageCategory}
Medico-Legal Case (MLC): ${c.patient.isMlc ? "YES" : "NO"}
Category Type: ${c.patient.caseType || "Medical"}

CHIEF COMPLAINT
---------------
${c.patient.presentingComplaint}

INITIAL VITALS (AT TRIAGE)
--------------------------
Blood Pressure: ${c.vitals.bp || "N/A"} mmHg
Heart Rate: ${c.vitals.hr || "N/A"} bpm
Oxygen Saturation: ${c.vitals.spo2 || "N/A"}% on Room Air
Respiratory Rate: ${c.vitals.rr || "N/A"} /min
Temperature: ${c.vitals.temp || "N/A"} °F
GCS Score: ${c.vitals.gcs || "15"}/15 (E${c.vitals.gcs_e || "4"} V${c.vitals.gcs_v || "5"} M${c.vitals.gcs_m || "6"})
GRBS (Glucose): ${c.vitals.grbs || "N/A"} mg/dL
AVPU Scale: ${c.vitals.avpu || "Alert"}
Pain Score: ${c.vitals.painScore || "0"}/10

SAMPLE CLINICAL HISTORY
-----------------------
Signs & Symptoms: ${c.sampleHistory?.symptoms || "None documented"}
Allergies: ${c.sampleHistory?.allergies || "NKDA (No Known Drug Allergies)"}
Medications: ${c.sampleHistory?.medications || "None"}
Past Medical History: ${c.sampleHistory?.pastHistory || "None"}
Last Oral Intake: ${c.sampleHistory?.lastMeal || "N/A"}
Events Leading to Illness: ${c.sampleHistory?.events || "N/A"}

PRIMARY ASSESSMENT (A-B-C-D-E)
------------------------------
Airway Status: ${c.primaryAssessment?.airwayStatus || "Normal"} ${c.primaryAssessment?.airway ? `- ${c.primaryAssessment.airway}` : ""}
Breathing Status: ${c.primaryAssessment?.breathingStatus || "Normal"} ${c.primaryAssessment?.breathing ? `- ${c.primaryAssessment.breathing}` : ""}
Circulation Status: ${c.primaryAssessment?.circulationStatus || "Normal"} ${c.primaryAssessment?.circulation ? `- ${c.primaryAssessment.circulation}` : ""}
Disability Status: ${c.primaryAssessment?.disabilityStatus || "Normal"} ${c.primaryAssessment?.disability ? `- ${c.primaryAssessment.disability}` : ""}
Exposure Status: ${c.primaryAssessment?.exposureStatus || "Normal"} ${c.primaryAssessment?.exposure ? `- ${c.primaryAssessment.exposure}` : ""}

SECONDARY ASSESSMENT
--------------------
${c.secondaryAssessment || "Systemic examination unremarkable."}

ER INVESTIGATIONS ORDERED & RESULTS
-----------------------------------
${c.investigations && c.investigations.length > 0 
  ? c.investigations.map(i => `* [${i.orderTime}] ${i.testName} -> Result: ${i.result} (${i.resultTime})`).join("\n")
  : "No investigations/diagnostic labs ordered for this case."}

EMERGENCY TREATMENTS & DRUGS GIVEN
----------------------------------
${c.treatments && c.treatments.length > 0
  ? c.treatments.map(t => `* [${t.timeGiven}] ${t.drugName} ${t.dose} via ${t.route} (IPSG Verified: ${t.ipsgVerified ? "YES" : "NO"})`).join("\n")
  : "Symptomatic supportive treatment administered. No active medications recorded."}

CLINICAL PROGRESS NOTES
-----------------------
${c.progressNotes || "Patient stable in ER. Under observation."}

DISPOSITION SUMMARY
-------------------
Disposition Status: ${c.dispositionDetails?.dispositionType || "Observation"}
Duration in ER: ${c.dispositionDetails?.durationInEr || "N/A"}
Consultant in Charge: ${c.dispositionDetails?.consultantName || "Dr. Varah"}
Resident Doctor: ${c.dispositionDetails?.residentName || "N/A"}
Observation Notes: ${c.dispositionDetails?.observationNotes || "N/A"}
==================================================`;
  };

  const generateDischargeSummaryText = (c: ClinicalCase): string => {
    const d = c.dischargeInfo;
    return `==================================================
ERMATE EMERGENCY CARE - CLINICAL DISCHARGE SUMMARY
==================================================
PATIENT NAME: ${c.patient.name}
AGE & GENDER: ${c.patient.age}y / ${c.patient.gender}
UHID (Hospital ID): ${c.patient.uhid}
ADMISSION DATE: ${c.patient.dateOpened}
DISCHARGE STATUS: Clinically Discharged

DATE/TIME OF DISCHARGE: ${d?.dischargeDateTime || new Date().toLocaleTimeString() + " | Today"}
PATIENT CONDITION AT DISCHARGE: ${d?.dischargeCondition || "Hemodynamically stable, alert, conscious, ambulatory"}

DISCHARGE VITALS (STABLE)
-------------------------
Blood Pressure: ${d?.dischargeBp || c.vitals.bp || "N/A"} mmHg
Heart Rate: ${d?.dischargeHr || c.vitals.hr || "N/A"} bpm
Oxygen Saturation: ${d?.dischargeSpo2 || c.vitals.spo2 || "N/A"}% on Room Air
Respiratory Rate: ${d?.dischargeRr || c.vitals.rr || "N/A"} /min
Temperature: ${d?.dischargeTemp || c.vitals.temp || "N/A"} °F
GCS Score: ${d?.dischargeGcs || c.vitals.gcs || "15"}/15
Pain Score: ${d?.dischargePainScore || "0"}/10
GRBS (Glucose): ${d?.dischargeGrbs || c.vitals.grbs || "N/A"} mg/dL

CHIEF COMPLAINTS & INITIAL DIAGNOSIS
------------------------------------
Presenting Complaint: ${d?.presentingComplaints || c.patient.presentingComplaint}
Provisional Primary Diagnosis: ${c.provisionalPrimaryDiagnosis || "Under investigation"}
Other Diagnoses/Differentials: ${c.differentials?.map(diff => diff.diagnosis).join(", ") || "None"}

ER COURSE & TREATMENT SUMMARY
-----------------------------
Patient was received in emergency department and resuscitated/evaluated.
Diagnostic tests and lab workups performed. Treated with appropriate medications in ER:
${c.treatments && c.treatments.length > 0 
  ? c.treatments.map(t => `- ${t.drugName} ${t.dose} given via ${t.route} at ${t.timeGiven}`).join("\n")
  : "- Symptomatic support, IV hydration."}

DISCHARGE MEDICATIONS & OUTPATIENT RX
--------------------------------------
${d?.dischargeMedications || "* Tab Paracetamol 650mg SOS for fever or body pain.\n* Follow-up in OPD as recommended."}

RED FLAG WARNINGS / EMERGENCY RETURN
------------------------------------
THE PATIENT MUST RETURN TO THE EMERGENCY ROOM IMMEDIATELY IF THEY EXPERIENCE:
1. Difficulty in breathing, gasping, or chest discomfort.
2. High-grade fever unresponsive to medications, or chills.
3. Persistent, severe abdominal pain or constant vomiting.
4. Loss of consciousness, sudden confusion, extreme lethargy, or weakness.
5. Suture rupture, active bleeding, or foul-smelling discharge.

FOLLOW-UP APPOINTMENT
---------------------
Follow up with General OPD / Primary care physician within 3 to 5 days, or sooner if symptoms persist or deteriorate.
==================================================`;
  };

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Shift Banner & Controls */}
      {isOnShift ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs font-black text-emerald-850 dark:text-emerald-400 uppercase tracking-wider">
                Morning Shift • Active on Duty
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                06:00 – 14:00 • {profile.hospital} • {activeShiftDoctors.length} clinicians active
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setShowShiftWarning(true);
                setWarningSeconds(300); // 5 minutes
              }}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-lg text-[11px] transition-all"
            >
              Simulate Shift End
            </button>
            <button
              onClick={() => {
                setIsOnShift(false);
                setShowShiftWarning(false);
              }}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-all"
            >
              End Shift
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div>
              <p className="text-xs font-black text-amber-850 dark:text-amber-400 uppercase tracking-wider">
                OFF SHIFT • Clinical Records Locked
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Please check into your scheduled shift to access cases, log metrics, and collaborate.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowShiftCheckIn(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-all shrink-0"
          >
            Check In Now
          </button>
        </div>
      )}

      {/* Countdown warning for auto-logout */}
      {showShiftWarning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-xl flex items-center justify-between gap-4 font-semibold text-xs shadow-md animate-bounce">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
            <span>
              Your shift window has ended. You will be automatically logged out of ErMate in{" "}
              <strong className="font-mono">
                {Math.floor(warningSeconds / 60)}:{(warningSeconds % 60).toString().padStart(2, "0")}
              </strong>{" "}
              minutes.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowShiftWarning(false);
                setWarningSeconds(300);
              }}
              className="bg-slate-950 text-white hover:bg-slate-900 px-3 py-1.5 rounded font-bold text-[10px]"
            >
              Extend Shift (30m)
            </button>
            <button
              onClick={() => {
                setIsOnShift(false);
                setShowShiftWarning(false);
              }}
              className="bg-rose-700 text-white hover:bg-rose-800 px-3 py-1.5 rounded font-bold text-[10px]"
            >
              End Shift & Logout
            </button>
          </div>
        </div>
      )}

      {/* Shift Check-In Modal overlay */}
      {showShiftCheckIn && !isOnShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-left">
            <div className="flex items-center gap-2.5 border-b pb-3 border-slate-100 dark:border-slate-900">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Your Shift is Available</h3>
                <p className="text-[11px] text-slate-400">Scheduled clinical roster check-in</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Shift Name:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">Morning Shift</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Time Window:</span>
                <span>06:00 – 14:00</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Clinical Facility:</span>
                <span>{profile.hospital}</span>
              </div>
              <div className="border-t border-slate-250 dark:border-slate-800/80 my-2 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Residents Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">2/4 slots</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Consultants Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">1/2 slots</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowShiftCheckIn(false);
                }}
                className="flex-1 py-2 border text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl text-xs transition-all"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setIsOnShift(true);
                  setShowShiftCheckIn(false);
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
              >
                Start Shift
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-purple-950 text-white rounded-2xl p-4 md:p-8 shadow-md relative overflow-hidden no-print border border-emerald-500/20">
        <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-xl -mb-10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-purple-950/50 text-purple-300 text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border border-purple-500/30">
                Session • {profile.subscriptionTier || "Enterprise Platinum"}
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border border-emerald-500/20">
                Shift Active • {profile.hospital}
              </span>
            </div>
            
            <h1 className="text-lg md:text-2xl font-extrabold font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent">
              Welcome back, Dr. {profile.name}
            </h1>
            <p className="hidden md:block text-slate-300 text-xs max-w-xl leading-relaxed">
              Log patient details, run certified clinical surveys, or use continuous dictation.
            </p>
          </div>
          
          <div className="flex gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={onStartHandoverChat}
              className="flex-1 md:flex-none px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] md:text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-purple-100" />
              New Handover
            </button>
            <button
              onClick={() => setShowHandoverSheet(true)}
              className="flex-1 md:flex-none px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] md:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Handover Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Pending Cases Alert Board */}
      {pendingCases.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-slate-900 border border-amber-500/20 dark:border-amber-500/10 rounded-2xl p-5 md:p-6 no-print space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/10 pb-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 border border-amber-500/20 animate-pulse-slow">
                <AlertTriangle className="w-5.5 h-5.5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-amber-300 uppercase tracking-wide leading-tight">
                  Incomplete Clinical Case Sheets Pending
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  The following active cases in your ER queue are missing clinical sections. Please complete them to guarantee safe handovers.
                </p>
              </div>
            </div>
            <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900 font-mono self-start sm:self-center shadow-xs">
              🚨 {pendingCases.length} CASE{pendingCases.length > 1 ? "S" : ""} PENDING
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {pendingCases.map(({ case: pc, status }) => (
              <div 
                key={pc.id}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:border-purple-500/40 dark:hover:border-purple-500/40 rounded-xl p-4 transition-all hover:shadow-xs relative overflow-hidden group flex flex-col justify-between space-y-3"
              >
                {/* Visual accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-amber-400 to-purple-600" />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-white truncate">
                      {pc.patient.name}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                      {pc.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-medium">
                    <span>{pc.patient.gender} • {pc.patient.age || "N/A"} years</span>
                    <span className={`font-mono font-bold text-[9.5px] uppercase tracking-wider px-1.5 py-0.2 rounded ${
                      pc.patient.triageCategory.includes("P1")
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : pc.patient.triageCategory.includes("P2")
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}>
                      {pc.patient.triageCategory.split(" ")[0]}
                    </span>
                  </div>

                  {/* Pending Details */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{status.pendingCount} section{status.pendingCount > 1 ? "s" : ""} incomplete</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {status.pendingSections.map((sect, idx) => (
                        <span 
                          key={idx} 
                          className="bg-purple-500/10 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded font-mono border border-purple-500/15"
                        >
                          {sect}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectCase(pc.id)}
                  className="w-full mt-2.5 py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm group-hover:shadow-md"
                >
                  <span>Complete Case Sheet</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Simplified Workflows Entry Section */}
      <div className="space-y-3 no-print">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
          Clinical Tools & Active Workflows
        </h2>

        {/* Mobile Minimalist Action Pad (Visible on Mobile only) */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {/* Card 1: New Patient Intake */}
          <button 
            onClick={onStartFullFlow}
            className="flex flex-col justify-between p-3 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-left hover:bg-emerald-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
              <PlusCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-emerald-300">New Patient</span>
              <span className="block text-[8px] text-slate-400 font-medium">AI triage intake</span>
            </div>
          </button>

          {/* Card 2: Pediatric Drug Calculator */}
          <button 
            onClick={onOpenPediatricCalculator}
            className="flex flex-col justify-between p-3 bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/20 rounded-xl text-left hover:bg-sky-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-lg flex items-center justify-center">
              <Calculator className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-sky-300">Peds Dosing</span>
              <span className="block text-[8px] text-slate-400 font-medium">Weight calculations</span>
            </div>
          </button>

          {/* Card 3: Voice Scribe Desk */}
          <button 
            onClick={onStartVoiceScribe}
            className="flex flex-col justify-between p-3 bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 rounded-xl text-left hover:bg-purple-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <Mic className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300">Voice Scribe</span>
              <span className="block text-[8px] text-slate-400 font-medium">EM consult scribe</span>
            </div>
          </button>

          {/* Card 4: Shift Handover */}
          <button 
            onClick={onStartHandoverChat}
            className="flex flex-col justify-between p-3 bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-left hover:bg-indigo-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-indigo-300">Shift Handover</span>
              <span className="block text-[8px] text-slate-400 font-medium">AI SBAR builder</span>
            </div>
          </button>

          {/* Card 5: iPhone Pocket Mirror */}
          <button 
            onClick={onOpenPocketMirror}
            className="col-span-2 flex items-center justify-between p-3 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/20 rounded-xl text-left hover:bg-rose-500/15 transition-all shadow-xs h-[64px] w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <span className="block font-black text-xs text-slate-800 dark:text-rose-300">iPhone Pocket Mirror</span>
                <span className="block text-[8px] text-slate-400 font-medium">Diagnostic eye & throat mirror</span>
              </div>
            </div>
            <span className="text-[8px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">NEW</span>
          </button>
        </div>

        {/* Desktop Detailed Grid (Visible on Desktop only) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Card 1: New Patient Intake */}
          <div 
            onClick={onStartFullFlow}
            className="group relative bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 dark:border-emerald-500/10 rounded-2xl p-5 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <PlusCircle className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                New Patient
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Speak your case — ErMate fills the case sheet. Dynamic triage scaling, voice dictation, and medical codes.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 border-t border-emerald-500/10 pt-3">
              <span>Start Intake Scribe</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Pediatric Drug Calculator */}
          <div 
            onClick={onOpenPediatricCalculator}
            className="group relative bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/25 dark:border-sky-500/10 rounded-2xl p-5 hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl group-hover:scale-110 transition-transform">
              <Calculator className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Pediatric Drug Calculator
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Weight-based dosing reference. Enter weight for immediate calculations across 24 drug categories.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400 border-t border-sky-500/10 pt-3">
              <span>Open Calculator</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Voice Scribe Desk */}
          <div 
            onClick={onStartVoiceScribe}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-purple-500 dark:hover:border-purple-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <Mic className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Voice Scribe Desk
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Free-form emergency room medical scribe. Record natural conversations and extract clinical data.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open Voice Scribe</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Shift Handover */}
          <div 
            onClick={onStartHandoverChat}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500 dark:hover:border-indigo-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Shift Handover
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Start a new handover or resume a previous session. AI synthesis constructs clean SBAR handover cards.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Start Handover</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 5: Handover Sheet */}
          <div 
            onClick={() => setShowHandoverSheet(true)}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-500 dark:hover:border-blue-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Handover Sheet (manual)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Review and generate a printable PDF shift handover report for active/triage cases in your queue.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>View Handover Sheet</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 6: iPhone Pocket Mirror */}
          <div 
            onClick={onOpenPocketMirror}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-rose-500 dark:hover:border-rose-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform">
              <Camera className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  iPhone Pocket Mirror
                </h3>
                <span className="text-[8px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">NEW</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Horizontal reflected clinical camera feed. Includes a mm pupil size comparator gauge and Mallampati airway classification checklists.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open Mirror Cam</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </div>

      {/* 2. Stats Cards Row */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4 no-print">
        {/* Active Cases */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-5 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-1 md:gap-4 min-w-0">
          <div className="p-1.5 md:p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg md:rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Activity className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[7.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Active cases</p>
            <h3 className="text-xs md:text-xl font-black text-slate-800 dark:text-white mt-0.5">{activeCasesCount}</h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono">Immediate clinical triage active</p>
          </div>
        </div>

        {/* Weekly Cases */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-5 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-1 md:gap-4 min-w-0">
          <div className="p-1.5 md:p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg md:rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <Calendar className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[7.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Admissions</p>
            <h3 className="text-xs md:text-xl font-black text-slate-800 dark:text-white mt-0.5">{casesThisWeekCount}</h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono">Total cases registered</p>
          </div>
        </div>

        {/* Clinical Facility */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-5 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-1 md:gap-4 min-w-0">
          <div className="p-1.5 md:p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg md:rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <Users className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[7.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Facility</p>
            <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white mt-0.5 truncate">
              {profile.hospital.split(" ")[0]}
            </h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono">Emergency Department Active</p>
          </div>
        </div>
      </div>

      {/* HOD / Shift Lead Department Control Center */}
      {profile.role.toLowerCase().includes("hod") && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 md:space-y-6 text-white no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between w-full md:w-auto">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-500/20 text-purple-300 text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold uppercase border border-purple-500/30 animate-pulse">
                    Department Admin Active
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-black font-display tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2 mt-1">
                  <Users className="w-4.5 h-4.5 md:w-5 md:h-5 text-purple-400" />
                  HOD Control Center
                </h2>
                <p className="hidden md:block text-xs text-slate-400">
                  City Emergency Department · {profile.hospital}
                </p>
              </div>

              {/* Mobile Toggle Button */}
              <button
                onClick={() => setIsHodPanelExpanded(!isHodPanelExpanded)}
                className="md:hidden px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                {isHodPanelExpanded ? "Minimize" : "Expand Admin"}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isHodPanelExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
            
            <div className={`flex-wrap gap-2 ${isHodPanelExpanded ? 'flex w-full md:w-auto' : 'hidden md:flex'}`}>
              <button
                onClick={() => onNavigateToTab("handover")}
                className="flex-1 md:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Handover Sheet
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 md:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Print Registry Cases
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isHodPanelExpanded ? 'grid' : 'hidden md:grid'}`}>
            {/* Active shifts list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Doctors on Shift (Clinical Roster)
                </h3>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                  {activeShiftDoctors.length} Clinicians Active
                </span>
              </div>

              {activeShiftDoctors.length === 0 ? (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-6 text-center text-slate-500 text-xs">
                  No active clinicians found. All doctors checked out of shift.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeShiftDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-slate-800"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-extrabold text-white">{doc.name}</p>
                        <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                          <span>{doc.role}</span>
                          <span>•</span>
                          <span className="text-indigo-400">{doc.caseCount} patients</span>
                          <span>•</span>
                          <span>On Duty: {doc.timeOnShift}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setActiveShiftDoctors(prev => prev.filter(d => d.id !== doc.id));
                        }}
                        className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 font-bold rounded-lg text-[10px] transition-all"
                      >
                        End Shift
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Handover Acknowledgement Trail */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Handover Acknowledgements
                </h3>
                <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 font-mono">
                  Audit Trail
                </span>
              </div>

              <div className="space-y-2.5">
                {handovers.map((hand) => {
                  const isAck = !!hand.acknowledgedBy;
                  return (
                    <div
                      key={hand.id}
                      className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {hand.senderName} (Handover {hand.id})
                        </span>
                        {isAck ? (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            ACKNOWLEDGED
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-400 text-[9px] px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase tracking-wider animate-pulse">
                            PENDING ACK
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                        "{hand.patientsText}"
                      </p>

                      <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-900 text-[10px] font-mono text-slate-500">
                        <span>Sent: {hand.timestamp}</span>
                        {isAck ? (
                          <span className="text-emerald-500">
                            Ack'd by {hand.acknowledgedBy} ({hand.acknowledgedTime?.split("|")[0]})
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setHandovers(prev => prev.map(h => h.id === hand.id ? {
                                ...h,
                                acknowledgedBy: profile.name,
                                acknowledgedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today"
                              } : h));
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline"
                          >
                            Force Acknowledge Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Content Area */}
      <div className="space-y-6">
          
          <div className="space-y-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold font-display text-slate-800 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  Today's ER Patient Registry
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Logged in as: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{profile.name} ({profile.role})</span></p>
              </div>

              {/* Segmented Control Tabs */}
              {profile.role.toLowerCase().includes("resident") ? (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-750 dark:text-rose-400 border border-rose-250/30 px-3 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 shadow-xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  EM Resident Desk • Restricted to My Assigned Cases Only
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60 dark:border-slate-800/80">
                  <button
                    onClick={() => {
                      setActiveCasesTab("my");
                      setExpandedCaseId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeCasesTab === "my"
                        ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    My Assigned Cases
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeCasesTab === "my"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-200 dark:bg-slate-855 text-slate-600"
                    }`}>
                      {cases.filter(c => c.doctorEmail === profile.email).length}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveCasesTab("all");
                      setExpandedCaseId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeCasesTab === "all"
                        ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    All ER Admissions
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeCasesTab === "all"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-200 dark:bg-slate-855 text-slate-600"
                    }`}>
                      {cases.length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {(() => {
              const isResident = profile.role.toLowerCase().includes("resident");
              const myCases = cases.filter(c => c.doctorEmail === profile.email);
              const displayedCases = [...(isResident || activeCasesTab === "my" ? myCases : cases)]
                .sort((a, b) => {
                  const getNumTime = (str: string) => {
                    try {
                      if (!str) return 0;
                      const timePart = str.split("|")[0].trim();
                      const [time, modifier] = timePart.split(" ");
                      let [hours, minutes] = time.split(":").map(Number);
                      if (modifier === "PM" && hours < 12) hours += 12;
                      if (modifier === "AM" && hours === 12) hours = 0;
                      return hours * 60 + minutes;
                    } catch {
                      return 0;
                    }
                  };
                  return getNumTime(b.patient.dateOpened) - getNumTime(a.patient.dateOpened);
                });

              if (displayedCases.length === 0) {
                return (
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center shadow-xs">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700 animate-pulse-slow" />
                    <p className="text-slate-700 dark:text-slate-300 font-bold">No Patients in this Registry</p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                      {activeCasesTab === "my" 
                        ? "You don't have any patients assigned to you right now. Select 'All ER Admissions' above to browse department cases or click 'Triage/Quick Register' to admit a new patient."
                        : "No active or registered admissions found in the ER department today."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayedCases.map((c) => {
                    const isExpanded = expandedCaseId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`bg-white dark:bg-slate-950 border rounded-xl shadow-xs transition-all flex flex-col overflow-hidden ${
                          isExpanded 
                            ? "border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-100 dark:ring-indigo-950" 
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        {/* Clickable Header Row */}
                        <div
                          onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                          className="p-4 cursor-pointer hover:bg-slate-50/45 dark:hover:bg-slate-900/30 flex items-center justify-between gap-4 transition-colors select-none"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] px-2 py-0.5 rounded border font-bold font-mono uppercase ${
                                c.patient.triageCategory.includes("P1")
                                  ? "bg-rose-50 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                  : c.patient.triageCategory.includes("P2")
                                  ? "bg-amber-50 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                                  : "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              }`}>
                                {c.patient.triageCategory.split(" ")[0]}
                              </span>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {c.patient.name}
                              </h4>
                              {c.isPediatric ? (
                                <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                                  Pediatric
                                </span>
                              ) : (
                                <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                                  Adult
                                </span>
                              )}
                              {c.doctorEmail && (
                                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-1.5 py-0.2 rounded font-mono">
                                  Clinician: {c.doctorName || c.doctorEmail.split("@")[0]}
                                </span>
                              )}
                              {c.escalated && (
                                <span className="text-[9px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 px-1.5 py-0.2 rounded font-bold animate-pulse uppercase tracking-wider flex items-center gap-0.5">
                                  Escalated ⚠️
                                </span>
                              )}
                              {c.consultantReview && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                                  Reviewed ✓
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Complaint:</span> {c.patient.presentingComplaint}
                            </p>
                            <div className="flex gap-4 text-[10px] text-slate-400 font-mono pt-1 flex-wrap">
                              <span>Age: {c.patient.age}y</span>
                              <span>Gender: {c.patient.gender}</span>
                              <span>UHID: {c.patient.uhid}</span>
                              <span className="text-slate-500">Vitals: HR {c.vitals.hr || "N/A"} | BP {c.vitals.bp || "N/A"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                                c.status === "Discharged"
                                  ? "bg-slate-150 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                              }`}>
                                {c.status}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-2 font-mono">{c.patient.dateOpened}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expandable Quick Actions Drawer */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10 p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-900 pb-2">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Actions & Documents Manager</span>
                              <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded">Case ID: {c.id}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* EMR Case Sheet Section */}
                              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">EMR Case Sheet</span>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-400">Status: Registered</span>
                                </div>
                                <p className="text-[11px] text-slate-500">View detailed clinical notes, airway evaluation, SAMPLE history, and treatment orders.</p>
                                
                                <div className="grid grid-cols-2 gap-2 pt-1.5">
                                  <button
                                    onClick={() => onSelectCase(c.id)}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Sheet
                                  </button>
                                  <button
                                    onClick={() => onSelectCase(c.id)}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit Sheet
                                  </button>
                                  <button
                                    onClick={() => handleCopy(`${c.id}_casesheet`, generateCaseSheetText(c))}
                                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                      copiedState[`${c.id}_casesheet`]
                                        ? "bg-emerald-500 text-white"
                                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400"
                                    }`}
                                  >
                                    {copiedState[`${c.id}_casesheet`] ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        Copy Text
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDownload(`Case_Sheet_${c.patient.name.replace(/\s+/g, "_")}_${c.id}.txt`, generateCaseSheetText(c))}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </button>
                                </div>
                              </div>

                              {/* Discharge Summary Section */}
                              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Discharge Card</span>
                                  </div>
                                  <span className={`text-[9px] font-mono ${c.status === "Discharged" ? "text-emerald-500 font-bold" : "text-slate-400"}`}>
                                    {c.status === "Discharged" ? "Ready" : "Pending Discharge"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500">Generate, view, and print patient discharge instructions, follow-up, and warning triggers.</p>
                                
                                <div className="grid grid-cols-2 gap-2 pt-1.5">
                                  <button
                                    onClick={() => onNavigateToDischarge(c.id)}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Card
                                  </button>
                                  <button
                                    onClick={() => onNavigateToDischarge(c.id)}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit Card
                                  </button>
                                  <button
                                    onClick={() => handleCopy(`${c.id}_discharge`, generateDischargeSummaryText(c))}
                                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                      copiedState[`${c.id}_discharge`]
                                        ? "bg-emerald-500 text-white"
                                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400"
                                    }`}
                                  >
                                    {copiedState[`${c.id}_discharge`] ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        Copy Text
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDownload(`Discharge_Summary_${c.patient.name.replace(/\s+/g, "_")}_${c.id}.txt`, generateDischargeSummaryText(c))}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </button>
                                </div>
                              </div>

                              {/* Team Controls, Escalation & Consultant Review Note */}
                              <div className="md:col-span-2 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                {/* Escalation Status Banner */}
                                {c.escalated && (
                                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-750 dark:text-rose-400 p-3.5 rounded-lg flex items-center gap-2.5">
                                    <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce" />
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wider">Escalated to Consultant</p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        This case has been marked as high-priority or clinical exception by the primary clinician.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Consultant Review display */}
                                {c.consultantReview && (
                                  <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 p-3.5 rounded-lg space-y-1">
                                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-[11px] uppercase tracking-wider">
                                      <Check className="w-4 h-4 text-emerald-500" />
                                      Consultant Reviewed ✓
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                                      "{c.consultantReview.reviewText}"
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      Reviewed by {c.consultantReview.reviewedBy} at {c.consultantReview.timestamp}
                                    </p>
                                  </div>
                                )}

                                {/* Resident Escalation Trigger */}
                                {profile.role.toLowerCase().includes("resident") && !c.escalated && (
                                  <button
                                    onClick={() => {
                                      const updated: ClinicalCase = {
                                        ...c,
                                        escalated: true
                                      };
                                      onSaveCase(updated);
                                    }}
                                    className="w-full py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                                  >
                                    <ShieldAlert className="w-4 h-4 animate-bounce" />
                                    Escalate Case to Senior Consultant ⚠️
                                  </button>
                                )}

                                {/* Consultant Review Note Input Form */}
                                {(profile.role.toLowerCase().includes("consultant") || profile.role.toLowerCase().includes("hod")) && (
                                  <div className="bg-slate-50 dark:bg-slate-900/40 border p-3 rounded-xl space-y-2 text-slate-800 dark:text-white">
                                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      {c.consultantReview ? "Update Consultant Review Note" : "Add Consultant Review Note"}
                                    </label>
                                    <div className="flex gap-2">
                                      <textarea
                                        value={consultantReviewTexts[c.id] !== undefined ? consultantReviewTexts[c.id] : (c.consultantReview?.reviewText || "")}
                                        onChange={(e) => setConsultantReviewTexts(prev => ({ ...prev, [c.id]: e.target.value }))}
                                        placeholder="Add clinical oversight notes, teaching points, or confirmation of treatment plan..."
                                        className="flex-1 bg-white dark:bg-slate-950 border text-xs p-2.5 rounded-xl min-h-[60px]"
                                      />
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                      <p className="text-[10px] text-slate-400">
                                        Will tag as: <span className="font-bold text-slate-600 dark:text-slate-300">Dr. {profile.name} (Consultant)</span>
                                      </p>
                                      <button
                                        onClick={() => {
                                          const text = consultantReviewTexts[c.id] !== undefined ? consultantReviewTexts[c.id] : (c.consultantReview?.reviewText || "");
                                          if (!text.trim()) return;
                                          const updated: ClinicalCase = {
                                            ...c,
                                            consultantReview: {
                                              reviewedBy: "Dr. " + profile.name,
                                              reviewText: text,
                                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today"
                                            }
                                          };
                                          onSaveCase(updated);
                                          // Clear state
                                          setConsultantReviewTexts(prev => {
                                            const copy = { ...prev };
                                            delete copy[c.id];
                                            return copy;
                                          });
                                        }}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs transition-all"
                                      >
                                        Save Review ✓
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

      {/* Manual Handover Sheet Printable Modal */}
      {showHandoverSheet && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Outgoing Shift Handover Sheet (Manual PDF)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setShowHandoverSheet(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="space-y-6 text-slate-800 dark:text-slate-100 p-2 print:p-0" id="printable-handover-document">
              <div className="flex justify-between items-start border-b-2 pb-4">
                <div>
                  <h1 className="text-xl font-black font-display text-slate-900 dark:text-white uppercase tracking-tight">
                    ErMate Outgoing Handover Report
                  </h1>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Facility: {profile.hospital} | Chief lead: Dr. {profile.name}
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-400">
                  <p>Handover generated on: {new Date().toLocaleDateString()}</p>
                  <p>System context: ATLS/PALS Standardized</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Active Clinical Cases List
                </h3>

                <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[10px]">
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Triage Priority</th>
                        <th className="p-3">Vitals Summary</th>
                        <th className="p-3">Chief Complaint</th>
                        <th className="p-3">Treatments Given</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-mono text-[11px]">
                      {cases.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">No active cases to handover.</td>
                        </tr>
                      ) : (
                        cases.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/20">
                            <td className="p-3 font-bold text-slate-800 dark:text-white">{c.patient.name} ({c.patient.age}y {c.patient.gender})</td>
                            <td className="p-3">
                              <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                {c.patient.triageCategory}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500">HR {c.vitals.hr || "N/A"} | BP {c.vitals.bp || "N/A"} | SpO2 {c.vitals.spo2 || "N/A"}%</td>
                            <td className="p-3 text-slate-600 truncate max-w-[150px]">{c.patient.presentingComplaint}</td>
                            <td className="p-3 text-slate-500 truncate max-w-[150px]">
                              {c.treatments.map(t => t.drugName).join(", ") || "None"}
                            </td>
                            <td className="p-3 font-semibold text-blue-700">{c.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Note */}
              <div className="border-t pt-4 text-center text-[10px] text-slate-400 font-mono leading-relaxed">
                <p>This document contains confidential Protected Health Information (PHI) subject to patient privacy rules.</p>
                <p>Ensure secure clinical disposition and specialist reconciliation post shift takeover.</p>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
