import React, { useState } from "react";
import { 
  PlusCircle, Zap, TrendingUp, Clock, ArrowRight, Activity, 
  Calendar, Users, FileText, Heart, ShieldAlert, ChevronRight, Calculator,
  Mic, AlertTriangle, CheckCircle, Edit, Copy, Download, Check, Eye, ChevronDown, ChevronUp, Briefcase,
  Camera, Building, Trash2, UserPlus, ShieldCheck, Share2, Lightbulb, BookOpen, MessageSquare, GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ClinicalCase, UserProfile, HandoverRecord, TeamMember } from "../types";
import { getCasePendingStatus } from "../utils/caseHelper";
import { triggerPrintWithTip } from "../utils/printWithTip";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import GoogleCalendarModal from "./GoogleCalendarModal";
import GoogleClassroomModal from "./GoogleClassroomModal";
import MortalityAuditModal from "./MortalityAuditModal";

interface DashboardViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  onStartFullFlow: () => void;
  onStartQuickCase: () => void;
  onSelectCase: (caseId: string) => void;
  onViewSheet?: (caseId: string) => void;
  onNavigateToDischarge: (caseId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  onStartHandoverChat: () => void;
  onStartHandoverSheet: () => void;
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
  isDarkMode?: boolean;
  teamMembers: TeamMember[];
  onAddMember: (name: string, email: string, role: string, shift: string) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
  onUpdateShift: (id: string, shift: string) => Promise<void>;
  onApproveMember?: (id: string) => Promise<void>;
  onDeclineMember?: (id: string) => Promise<void>;
  onUpdateRole?: (id: string, role: string) => Promise<void>;
  shifts?: any[];
  pendingContributionsCount?: number;
  onDiscussCase?: (patientCase: ClinicalCase) => void;
  onStartDischargeSummary?: () => void;
}

export default function DashboardView({
  profile,
  cases,
  onStartFullFlow,
  onStartQuickCase,
  onSelectCase,
  onViewSheet,
  onNavigateToDischarge,
  onNavigateToTab,
  onStartHandoverChat,
  onStartHandoverSheet,
  onStartDischargeSummary,
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
  isDarkMode = false,
  teamMembers,
  onAddMember,
  onRemoveMember,
  onUpdateShift,
  onApproveMember,
  onDeclineMember,
  onUpdateRole,
  shifts = [],
  pendingContributionsCount = 0,
  onDiscussCase,
}: DashboardViewProps) {
  // Statistics
  const activeCasesCount = cases.filter(c => c.status === "Active" || c.status === "Triage").length;
  const casesThisWeekCount = cases.length;
  
  const recentCases = [...cases]
    .sort((a, b) => new Date(b.patient.dateOpened).getTime() - new Date(a.patient.dateOpened).getTime())
    .slice(0, 3);

  // Resolve current logged-in user's assigned shift name and time
  const userEmailLower = profile.email.toLowerCase().trim();
  const currentUserMember = teamMembers.find(
    m => m.email.toLowerCase().trim() === userEmailLower
  );
  const activeUserShiftId = currentUserMember?.shift || "morning";
  
  // Use the default fallback if shifts prop is empty
  const activeShiftsList = shifts && shifts.length > 0 ? shifts : [
    { id: "morning", name: "Morning", time: "08:00 - 14:00" },
    { id: "evening", name: "Evening", time: "14:00 - 20:00" },
    { id: "night", name: "Night", time: "20:00 - 08:00" },
    { id: "off", name: "Off Shift", time: "Off Duty" },
    { id: "d1", name: "D1 Shift", time: "08:00 - 18:00" },
    { id: "d2", name: "D2 Shift", time: "18:00 - 08:00" },
    { id: "g1", name: "G1 Shift", time: "08:00 - 16:00" },
    { id: "g2", name: "G2 Shift", time: "12:00 - 20:00" },
  ];
  
  const assignedShift = activeShiftsList.find(s => s.id === activeUserShiftId) || activeShiftsList[0];

  // Filter out discharged cases, check which active ones are pending/incomplete
  const pendingCases = cases
    .filter(c => c.status !== "Discharged")
    .map(c => ({
      case: c,
      status: getCasePendingStatus(c)
    }))
    .filter(x => x.status.isPending);

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
  const [isApprovalsHubExpanded, setIsApprovalsHubExpanded] = useState<boolean>(true);

  // Google Calendar & Classroom Modal States
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState<boolean>(false);

  // Mortality Audit Modal State
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState<boolean>(false);

  // HOD Profile & Team Sync States
  const [isEditingHospital, setIsEditingHospital] = useState(false);
  const [tempHospital, setTempHospital] = useState(profile.hospital || "Varah Group Emergency Care");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [pendingDeleteMemberId, setPendingDeleteMemberId] = useState<string | null>(null);

  // States for HOD Clinician Case Explorer
  const [selectedClinicianForCases, setSelectedClinicianForCases] = useState<any | null>(null);
  const [selectedClinicianCaseIds, setSelectedClinicianCaseIds] = useState<string[]>([]);
  const [successTakeoverMessage, setSuccessTakeoverMessage] = useState<string | null>(null);
  const [showInstantHandoverSummary, setShowInstantHandoverSummary] = useState(false);

  // Add Member Form States
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("Resident");
  const [addShift, setAddShift] = useState("morning");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addSuccessMessage, setAddSuccessMessage] = useState("");

  const handleLocalAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) return;
    setIsAddingMember(true);
    setAddSuccessMessage("");
    try {
      const formattedName = addName.trim().startsWith("Dr.") ? addName.trim() : `Dr. ${addName.trim()}`;
      await onAddMember(formattedName, addEmail.trim().toLowerCase(), addRole, addShift);
      setAddSuccessMessage(`Success! Whitelisted and added ${formattedName} to your clinical department team.`);
      setAddName("");
      setAddEmail("");
      setTimeout(() => setAddSuccessMessage(""), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleSaveHospitalLocal = async () => {
    if (!auth.currentUser || !tempHospital.trim()) return;
    try {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userDocRef, { hospital: tempHospital.trim() });
      profile.hospital = tempHospital.trim();
      setIsEditingHospital(false);
    } catch (err) {
      console.error("Error updating hospital: ", err);
    }
  };

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

  const pendingMembers = (teamMembers || []).filter(m => m.status === "Pending Approval");

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* PEER REVIEW PIPELINE BANNER */}
      {pendingContributionsCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 rounded-3xl p-5 md:p-6 text-white shadow-lg space-y-3 border border-amber-400/30 no-print animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 border border-white/20 rounded-2xl shrink-0">
                <Lightbulb className="w-6 h-6 text-amber-200 animate-pulse" />
              </div>
              <div>
                <span className="bg-white/20 border border-white/25 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono">
                  iMnemonic Peer Review Pipeline
                </span>
                <h3 className="text-sm md:text-base font-extrabold font-display tracking-tight mt-1 flex items-center gap-2">
                  {pendingContributionsCount} CLINICAL MNEMONIC{pendingContributionsCount > 1 ? "S" : ""} AWAITING REVIEW
                </h3>
                <p className="text-xs text-amber-100 font-sans leading-relaxed mt-0.5">
                  New clinical mnemonics submitted by peer clinicians are waiting for review & approval before publishing to the global directory.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab("learn")}
              className="bg-white text-slate-900 hover:bg-amber-50 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-wider active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span>Review & Publish</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* VERIFICATION & APPROVALS HUB (HOD ONLY) */}
      {profile.role.toLowerCase().includes("hod") && pendingMembers.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-4 border border-indigo-500/30 no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500"></span>
              </span>
              <div>
                <span className="bg-purple-500/30 border border-purple-400/20 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono">
                  Verification & Approvals Hub
                </span>
                <h2 className="text-sm md:text-base font-extrabold font-display tracking-tight mt-1 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-pink-300" />
                  {pendingMembers.length} CLINICIAN REGISTRATION{pendingMembers.length > 1 ? "S" : ""} AWAITING HOD VERIFICATION
                </h2>
                <p className="text-xs text-indigo-100 leading-relaxed mt-0.5 font-sans">
                  Review designation choices and approve team members to active shift status.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsApprovalsHubExpanded(!isApprovalsHubExpanded)}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 self-start md:self-center uppercase tracking-wider"
            >
              {isApprovalsHubExpanded ? "Collapse Review" : "Expand & Review"}
              <ChevronRight className={`w-4 h-4 transition-transform ${isApprovalsHubExpanded ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {isApprovalsHubExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-4 border-t border-white/10 space-y-3"
              >
                {pendingMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white/5 border border-white/10 hover:bg-white/8 transition-all p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 text-left">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <strong className="text-sm font-bold text-white font-sans">{member.name || member.email.split("@")[0]}</strong>
                        
                        <div className="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-2 py-0.5">
                          <span className="text-[10px] text-indigo-300 font-bold uppercase">Designation:</span>
                          <select
                            value={member.role}
                            onChange={async (e) => {
                              try {
                                if (onUpdateRole) {
                                  await onUpdateRole(member.id, e.target.value);
                                }
                              } catch (err) {
                                console.error("Error updating role:", err);
                              }
                            }}
                            className="bg-transparent text-xs font-bold text-indigo-200 focus:outline-none cursor-pointer uppercase font-mono"
                          >
                            <option value="Senior Consultant" className="bg-slate-900 text-white">Senior Consultant</option>
                            <option value="EM Resident" className="bg-slate-900 text-white">EM Resident</option>
                            <option value="HOD / Shift Lead" className="bg-slate-900 text-white">HOD / Shift Lead</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="text-xs text-indigo-200 font-mono flex items-center gap-1">
                        <span>Email:</span>
                        <span className="text-white underline">{member.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={async () => {
                          if (onDeclineMember) {
                            await onDeclineMember(member.id);
                          }
                        }}
                        className="px-3.5 py-2 bg-white/10 hover:bg-rose-600/30 border border-white/10 hover:border-rose-500/50 text-white hover:text-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Decline ✗
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (onApproveMember) {
                            await onApproveMember(member.id);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400/30 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Approve ✓</span>
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
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
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{assignedShift.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Time Window:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{assignedShift.time}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Clinical Facility:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.hospital}</span>
              </div>
              <div className="border-t border-slate-250 dark:border-slate-800/80 my-2 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Residents Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {teamMembers.filter(m => m.role.toLowerCase().includes("resident") && m.shift === activeUserShiftId).length} active
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Consultants Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {teamMembers.filter(m => (m.role.toLowerCase().includes("consultant") || m.role.toLowerCase().includes("hod") || m.role.toLowerCase().includes("lead")) && m.shift === activeUserShiftId).length} active
                </span>
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
      <div className={`bg-gradient-to-r ${isDarkMode ? 'from-emerald-950 via-slate-900 to-purple-950 text-white border-emerald-500/20' : 'from-emerald-600 via-teal-500 to-indigo-600 text-white border-transparent'} rounded-2xl p-4 md:p-8 shadow-md relative overflow-hidden no-print border`}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-xl -mb-10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${
                isDarkMode 
                  ? "bg-purple-950/50 text-purple-300 text-[8px] md:text-[10px] border-purple-500/30" 
                  : "bg-white/15 text-white text-[8px] md:text-[10px] border-white/20"
              }`}>
                Session • {profile.subscriptionTier || "Enterprise Platinum"}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${
                isDarkMode 
                  ? "bg-emerald-500/10 text-emerald-400 text-[8px] md:text-[10px] border-emerald-500/20" 
                  : "bg-white/10 text-white text-[8px] md:text-[10px] border-white/10"
              }`}>
                Shift Active • {profile.hospital}
              </span>
            </div>
            
            <h1 className={`text-lg md:text-2xl font-extrabold font-display tracking-tight ${
              isDarkMode 
                ? "bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent" 
                : "text-white"
            }`}>
              Welcome back, Dr. {profile.name}
            </h1>
            <p className={`hidden md:block text-xs max-w-xl leading-relaxed ${
              isDarkMode ? "text-slate-300" : "text-emerald-50"
            }`}>
              Log patient details, run certified clinical surveys, or use continuous dictation.
            </p>
          </div>
          
          <div className="flex gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={onStartHandoverChat}
              className="flex-1 md:flex-none px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] md:text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-purple-100" />
              Handover
            </button>
            <button
              onClick={() => {
                if (onStartDischargeSummary) {
                  onStartDischargeSummary();
                } else {
                  onNavigateToTab("handover");
                }
              }}
              className={`flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isDarkMode 
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200" 
                  : "bg-white/15 hover:bg-white/25 border-white/20 text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-150" />
              Discharge Summary
            </button>
          </div>
        </div>
      </div>

      {/* Pending Cases Alert Board */}
      {pendingCases.length > 0 && (
        <div className={`bg-gradient-to-br ${isDarkMode ? 'from-amber-500/10 via-purple-500/5 to-slate-900 border-amber-500/20 dark:border-amber-500/10' : 'from-amber-50/70 via-purple-50/30 to-slate-50 border-amber-200'} border rounded-2xl p-5 md:p-6 no-print space-y-4`}>
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

                <div className="flex items-center gap-2 mt-2.5">
                  {onDiscussCase && (
                    <button
                      type="button"
                      onClick={() => onDiscussCase(pc)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1.5 shrink-0"
                      title="Discuss case with AI Assistant"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Discuss</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectCase(pc.id)}
                    className="flex-1 py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm group-hover:shadow-md"
                  >
                    <span>Complete Case Sheet</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
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

          {/* Card 2: Discharge Summary Generator (Mobile) */}
          <button 
            onClick={() => {
              if (onStartDischargeSummary) {
                onStartDischargeSummary();
              } else {
                onNavigateToTab("handover");
              }
            }}
            className="flex flex-col justify-between p-3 bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 rounded-xl text-left hover:bg-purple-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-purple-500" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300 truncate">Discharge Summary</span>
              <span className="block text-[8px] text-slate-400 font-medium truncate">EMR case dump processor</span>
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
              <span className="block text-[8px] text-slate-400 font-medium">Scribe in native language</span>
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

          {/* Card 6: EM Drugs & Procedures (Mobile) */}
          <button 
            onClick={() => onNavigateToTab("emdrugs")}
            className="col-span-2 flex items-center justify-between p-3 bg-red-500/10 dark:bg-red-950/20 border border-red-500/20 rounded-xl text-left hover:bg-red-500/15 transition-all shadow-xs h-[64px] w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <span className="block font-black text-xs text-slate-800 dark:text-red-300">EM Drugs & Procedures</span>
                <span className="block text-[8px] text-slate-400 font-medium">RSI, Sedation, Vents, Lines</span>
              </div>
            </div>
            <span className="text-[8px] font-mono text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded uppercase font-black">CRITICAL</span>
          </button>

          {/* Card 7: Pediatric Drug Calculator (Mobile) */}
          <button 
            onClick={onOpenPediatricCalculator}
            className="col-span-2 flex items-center justify-between p-3 bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/20 rounded-xl text-left hover:bg-sky-500/15 transition-all shadow-xs h-[64px] w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-sky-500" />
              </div>
              <div>
                <span className="block font-black text-xs text-slate-800 dark:text-sky-300">Peds Dosing</span>
                <span className="block text-[8px] text-slate-400 font-medium">Weight calculations & dosing reference</span>
              </div>
            </div>
            <span className="text-[8px] font-mono text-sky-500 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded uppercase font-black">CALCULATOR</span>
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

          {/* Card 2: Discharge Summary Generator (Desktop) */}
          <div 
            onClick={() => {
              if (onStartDischargeSummary) {
                onStartDischargeSummary();
              } else {
                onNavigateToTab("handover");
              }
            }}
            className="group relative bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/25 dark:border-purple-500/10 rounded-2xl p-5 hover:border-purple-500 dark:hover:border-purple-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Discharge Summary Generator
                </h3>
                <span className="text-[8px] font-mono text-purple-500 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded uppercase">AI FORMATTER</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste raw EMR notes or case sheet dumps to generate standardized, medico-legal discharge summaries for any hospital.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 border-t border-purple-500/10 pt-3">
              <span>Open Generator</span>
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
                Start a new handover, build AI SBAR cards, or generate printable PDF/Word handover reports for active cases.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Start Handover & Sheets</span>
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

          {/* Card 7: EM Drugs & Procedures (Desktop) */}
          <div 
            onClick={() => onNavigateToTab("emdrugs")}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500 dark:hover:border-red-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  EM Drugs & Procedures
                </h3>
                <span className="text-[8px] font-mono text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded uppercase">CRITICAL</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                RSI 7 Ps timeline & drug estimators, sedation agent dose calculators, predicted Tidal Volume (lung protective) models, and Seldinger CVC guidelines.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open EM Reference</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 8: Pediatric Drug Calculator (Desktop) */}
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-md dark:shadow-xl space-y-4 md:space-y-6 text-slate-800 dark:text-white no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between w-full md:w-auto">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold uppercase border border-purple-200 dark:border-purple-500/30 animate-pulse">
                    Department Admin Active
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-black font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                  <Users className="w-4.5 h-4.5 md:w-5 md:h-5 text-purple-500 dark:text-purple-400" />
                  HOD Control Center
                </h2>
                <p className="hidden md:block text-xs text-slate-550 dark:text-slate-400">
                  City Emergency Department · {profile.hospital}
                </p>
              </div>

              {/* Mobile Toggle Button */}
              <button
                onClick={() => setIsHodPanelExpanded(!isHodPanelExpanded)}
                className="md:hidden px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
              >
                {isHodPanelExpanded ? "Minimize" : "Expand Admin"}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isHodPanelExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
            
            <div className={`flex-wrap gap-2 ${isHodPanelExpanded ? 'flex w-full md:w-auto' : 'hidden md:flex'}`}>
              <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="flex-1 md:flex-none px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Sync duty rotas, M&M audits, and handover events with Google Calendar"
              >
                <Calendar className="w-3.5 h-3.5 text-white" />
                Sync Google Calendar
              </button>
              <button
                onClick={() => setIsClassroomModalOpen(true)}
                className="flex-1 md:flex-none px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Manage residency courses, coursework assignments, and announcements on Google Classroom"
              >
                <GraduationCap className="w-3.5 h-3.5 text-white" />
                Google Classroom
              </button>
              <button
                onClick={() => onNavigateToTab("handover")}
                className="flex-1 md:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Handover Sheet
              </button>
              <button
                onClick={() => {
                  triggerPrintWithTip();
                }}
                className="flex-1 md:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                  Active Doctors on Shift (Clinical Roster)
                </h3>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-mono">
                  {activeShiftDoctors.length} Clinicians Active
                </span>
              </div>

              {activeShiftDoctors.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-6 text-center text-slate-450 dark:text-slate-500 text-xs">
                  No active clinicians found. All doctors checked out of shift.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeShiftDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-800"
                    >
                      <div className="space-y-1">
                        <p 
                          className="text-sm font-extrabold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 group/shiftname"
                          onClick={() => {
                            const member = teamMembers.find(m => m.name.toLowerCase() === doc.name.toLowerCase()) || {
                              id: doc.id,
                              name: doc.name,
                              email: doc.name.toLowerCase().replace(/\s+/g, "") + "@hospital.com",
                              role: doc.role,
                              status: "Active (Joined)",
                              shift: "morning"
                            };
                            setSelectedClinicianForCases(member);
                            const clinicianCases = cases.filter(c => 
                              (c.doctorEmail && member.email && c.doctorEmail.trim().toLowerCase() === member.email.trim().toLowerCase()) ||
                              (c.doctorName && member.name && c.doctorName.trim().toLowerCase().includes(member.name.trim().toLowerCase()))
                            );
                            const activeIds = clinicianCases.filter(c => c.status === "Active" || c.status === "Triage").map(c => c.id);
                            setSelectedClinicianCaseIds(activeIds);
                          }}
                          title="Click to inspect & takeover cases"
                        >
                          {doc.name}
                          <Eye className="w-3.5 h-3.5 opacity-60 group-hover/shiftname:opacity-100 transition-opacity text-indigo-500" />
                        </p>
                        <div className="flex gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>{doc.role}</span>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{doc.caseCount} patients</span>
                          <span>•</span>
                          <span>On Duty: {doc.timeOnShift}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setActiveShiftDoctors(prev => prev.filter(d => d.id !== doc.id));
                        }}
                        className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-300 font-bold rounded-lg text-[10px] transition-all"
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                  Recent Handover Acknowledgements
                </h3>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20 font-mono">
                  Audit Trail
                </span>
              </div>

              <div className="space-y-2.5">
                {handovers.map((hand) => {
                  const isAck = !!hand.acknowledgedBy;
                  return (
                    <div
                      key={hand.id}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {hand.senderName} (Handover {hand.id})
                        </span>
                        {isAck ? (
                          <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-250 dark:border-emerald-500/20 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ACKNOWLEDGED
                          </span>
                        ) : (
                          <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[9px] px-2 py-0.5 rounded-full border border-amber-250 dark:border-amber-500/20 font-bold uppercase tracking-wider animate-pulse">
                            PENDING ACK
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        "{hand.patientsText}"
                      </p>

                      <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-200 dark:border-slate-900 text-[10px] font-mono text-slate-450 dark:text-slate-500">
                        <span>Sent: {hand.timestamp}</span>
                        {isAck ? (
                          <span className="text-emerald-600 dark:text-emerald-500 font-bold">
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
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold hover:underline"
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

          {/* QUALITY & COMPLIANCE SECTION */}
          <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-500" />
                  Quality & Clinical Compliance Suite
                </h3>
                <p className="text-[11px] text-slate-500">M&M Reviews, Clinical Audits & NABH Protocol Tracking</p>
              </div>
              <span className="text-[10px] bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 font-bold uppercase tracking-wider">
                Confidential HOD Suite
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mortality & Morbidity Audit Card */}
              <div 
                onClick={() => setIsMortalityModalOpen(true)}
                className="bg-gradient-to-br from-rose-50 to-white dark:from-slate-900 dark:to-slate-950 border border-rose-200/80 dark:border-rose-900/40 p-4 rounded-xl space-y-3 cursor-pointer hover:border-rose-400 dark:hover:border-rose-700 transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg group-hover:scale-105 transition-transform">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-bold px-2 py-0.5 rounded">
                    M&M Audit
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    Mortality & Morbidity Audit
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    Formal medico-legal review & cause-of-death deconstruction with clinical intelligence.
                  </p>
                </div>
                <div className="pt-2 border-t border-rose-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  <span>Last Audit: Today</span>
                  <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Launch M&M Engine →
                  </span>
                </div>
              </div>

              {/* Department Statistics Card */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded">
                    Analytics
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Department Statistics
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Turnaround time, bed occupancy, resus volume, and clinical workload distributions.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  <span>24 Active Cases</span>
                  <button onClick={() => onNavigateToTab("analytics")} className="hover:underline cursor-pointer">
                    View Analytics →
                  </button>
                </div>
              </div>

              {/* Shift Reports & Logs Card */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded">
                    Duty Rotas
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Shift Reports & Roster Sync
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Manage duty shifts, consultant on-call rotas, and sync events to Google Calendar.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                  <span>Shift Sync Active</span>
                  <button onClick={() => onNavigateToTab("roster")} className="hover:underline cursor-pointer">
                    Open Roster Board →
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Section Divider */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6 no-print" />

          {/* HOD Department Administration Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 pb-2 no-print">
            
            {/* Left Column: Team Member Roster & Whitelisting Form (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Whitelist New Team Member Card */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-350">
                    Whitelist & Onboard Team Clinician
                  </h3>
                </div>
                
                <form onSubmit={handleLocalAddMember} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 font-mono">
                      Clinician Full Name
                    </label>
                    <input
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="Dr. Shreya Patel"
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 block w-full px-3 py-2 text-xs rounded-lg font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 font-mono">
                      Verified Gmail Address
                    </label>
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="shreya@gmail.com"
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 block w-full px-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 font-mono">
                      Designation Role
                    </label>
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 block w-full px-2 py-2 text-xs rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Resident">EM Resident</option>
                      <option value="Consultant">Senior Consultant</option>
                      <option value="HOD">HOD / Shift Lead</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Onboard Doctor</span>
                  </button>
                </form>

                {addSuccessMessage && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg font-mono flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{addSuccessMessage}</span>
                  </div>
                )}
              </div>

              {/* Active Team Roster List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                    Clinical Department Team Roster
                  </h3>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-150 dark:border-indigo-500/20 font-mono">
                    {teamMembers.length} Registered Clinicians
                  </span>
                </div>

                {teamMembers.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-8 text-center text-slate-450 dark:text-slate-500 text-xs leading-relaxed">
                    No registered team members found. Share the invitation link below to populate your clinician roster in real-time.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                            <th className="p-3.5">Clinician</th>
                            <th className="p-3.5">Post</th>
                            <th className="p-3.5">Sync Status</th>
                            <th className="p-3.5">Active Duty</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                          {teamMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                              <td className="p-3.5">
                                <div 
                                  className="flex items-center gap-2.5 cursor-pointer group/rostername"
                                  onClick={() => {
                                    setSelectedClinicianForCases(member);
                                    const clinicianCases = cases.filter(c => 
                                      (c.doctorEmail && member.email && c.doctorEmail.trim().toLowerCase() === member.email.trim().toLowerCase()) ||
                                      (c.doctorName && member.name && c.doctorName.trim().toLowerCase().includes(member.name.trim().toLowerCase()))
                                    );
                                    const activeIds = clinicianCases.filter(c => c.status === "Active" || c.status === "Triage").map(c => c.id);
                                    setSelectedClinicianCaseIds(activeIds);
                                  }}
                                  title="Click to view & takeover clinical cases"
                                >
                                  <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-black uppercase font-display group-hover/rostername:bg-indigo-600 group-hover/rostername:text-white transition-all">
                                    {member.name.replace("Dr. ", "").slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover/rostername:text-indigo-600 dark:group-hover/rostername:text-indigo-400 transition-colors flex items-center gap-1">
                                      {member.name}
                                      <Eye className="w-3 h-3 opacity-0 group-hover/rostername:opacity-100 transition-opacity text-indigo-500" />
                                    </p>
                                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono">{member.email}</p>
                                  </div>
                                </div>
                              </td>
                              
                              <td className="p-3.5">
                                <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-mono font-bold ${
                                  member.role.includes("HOD") 
                                    ? "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-200/50" 
                                    : member.role.includes("Consultant")
                                    ? "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50"
                                    : "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200/50"
                                }`}>
                                  {member.role}
                                </span>
                              </td>

                              <td className="p-3.5">
                                {member.status === "Active (Joined)" ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-bold font-sans">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Active (Joined)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20 font-bold font-sans">
                                    <Clock className="w-3 h-3" />
                                    Claim Pending
                                  </span>
                                )}
                              </td>

                              <td className="p-3.5">
                                <select
                                  value={member.shift || "off"}
                                  onChange={(e) => onUpdateShift(member.id, e.target.value)}
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="morning">Morning Shift</option>
                                  <option value="evening">Evening Shift</option>
                                  <option value="night">Night Shift</option>
                                  <option value="off">Off Duty</option>
                                </select>
                              </td>

                              <td className="p-3.5 text-right">
                                {pendingDeleteMemberId === member.id ? (
                                  <div className="flex items-center justify-end gap-1.5 animate-fade-in">
                                    <button
                                      onClick={() => setPendingDeleteMemberId(null)}
                                      className="px-2 py-1 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-md transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={async () => {
                                        await onRemoveMember(member.id);
                                        setPendingDeleteMemberId(null);
                                      }}
                                      className="px-2 py-1 text-[9px] font-black bg-rose-600 text-white rounded-md transition-all shadow-xs"
                                    >
                                      Confirm
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setPendingDeleteMemberId(member.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Revoke and Remove Clinician Access"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Hospital Department Profile & Invite Links (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Profile Card */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="w-4.5 h-4.5 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-350">
                    Institution Profile Details
                  </h3>
                </div>

                <div className="space-y-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl">
                  <div className="space-y-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 font-mono">
                      Affiliated Hospital Network
                    </span>
                    
                    {isEditingHospital ? (
                      <div className="space-y-2 animate-fade-in">
                        <input
                          type="text"
                          value={tempHospital}
                          onChange={(e) => setTempHospital(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 block w-full px-3 py-1.5 text-xs rounded-lg font-sans font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                              setTempHospital(profile.hospital);
                              setIsEditingHospital(false);
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveHospitalLocal}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded-md"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                          {profile.hospital || "Varah Group Emergency Care"}
                        </p>
                        <button
                          onClick={() => {
                            setTempHospital(profile.hospital);
                            setIsEditingHospital(true);
                          }}
                          className="p-1 text-slate-450 hover:text-slate-850 dark:hover:text-white rounded transition-colors"
                          title="Rename Institution"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-900 pt-3 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Clinical Scribe Node:</span>
                    <span className="text-slate-750 dark:text-slate-300 font-bold">Standard ISO-27001</span>
                  </div>
                </div>
              </div>

              {/* Share Invite Referral Link Card */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/30 dark:from-slate-950/40 dark:to-slate-950/10 border border-indigo-100 dark:border-slate-850 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-350">
                    Share Invitation Link
                  </h3>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  Provide this secure link to your clinical team members. Opening this link prompts colleagues to register and accept your department's roster sync automatically.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/join/${(profile.hospital || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}?ref=team_invite`}
                      className="bg-transparent text-slate-600 dark:text-slate-300 text-[10.5px] font-mono font-medium block w-full focus:outline-none select-all truncate"
                    />
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/join/${(profile.hospital || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}?ref=team_invite`;
                        navigator.clipboard.writeText(link);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                      className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                        copiedInvite
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {copiedInvite && (
                    <p className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 animate-pulse text-right">
                      ✓ Copied invitation to clipboard!
                    </p>
                  )}
                </div>
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
                              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-1.5 py-0.2 rounded font-mono">
                                Clinician: {c.doctorName || c.createdByName || c.dispositionDetails?.residentName || (c.doctorEmail ? `Dr. ${c.doctorEmail.split("@")[0]}` : null) || `Dr. ${profile?.name || "Duty Officer"}`}
                              </span>
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
                                    onClick={() => onViewSheet ? onViewSheet(c.id) : onSelectCase(c.id)}
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-md text-[11px] font-extrabold transition-all cursor-pointer"
                                    title="View Read-Only Printable Case Sheet"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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

      {/* HOD Clinician Case Explorer and Takeover Modal */}
      <AnimatePresence>
        {selectedClinicianForCases && (() => {
          const clinicianCases = cases.filter(c => 
            (c.doctorEmail && selectedClinicianForCases.email && c.doctorEmail.trim().toLowerCase() === selectedClinicianForCases.email.trim().toLowerCase()) ||
            (c.doctorName && selectedClinicianForCases.name && c.doctorName.trim().toLowerCase().includes(selectedClinicianForCases.name.trim().toLowerCase()))
          );
          const activeCases = clinicianCases.filter(c => c.status === "Active" || c.status === "Triage");

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
              id="hod-case-explorer-backdrop"
              onClick={() => {
                setSelectedClinicianForCases(null);
                setSuccessTakeoverMessage(null);
                setShowInstantHandoverSummary(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-slate-900 dark:to-slate-950 px-6 py-5 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-sm font-black uppercase font-display">
                      {selectedClinicianForCases.name.replace("Dr. ", "").slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                        {selectedClinicianForCases.name}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider font-mono">
                          {selectedClinicianForCases.role || "Clinician"}
                        </span>
                      </h3>
                      <p className="text-[10.5px] text-slate-500 font-mono mt-1">{selectedClinicianForCases.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClinicianForCases(null);
                      setSuccessTakeoverMessage(null);
                      setShowInstantHandoverSummary(false);
                    }}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Sub-header info */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium font-sans">
                    Department Duty Status: <strong className="text-slate-800 dark:text-slate-200 uppercase font-bold">{selectedClinicianForCases.shift || "Active"} Duty</strong>
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-white font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                    {activeCases.length} Active cases
                  </span>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Success Alert */}
                  {successTakeoverMessage && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="font-extrabold">{successTakeoverMessage}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">The selected cases are now assigned to your queue and visible on the active handover list.</p>
                      </div>
                    </div>
                  )}

                  {clinicianCases.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Users className="w-10 h-10 mx-auto text-indigo-250 dark:text-slate-800 mb-2.5 animate-pulse" />
                      <p className="font-extrabold text-slate-600 dark:text-slate-300">No logged cases found</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[240px] mx-auto">This clinician hasn't logged or assumed care of any clinical cases during this duty window.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Clinician Patients Queue</span>
                        {activeCases.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedClinicianCaseIds.length === activeCases.length) {
                                setSelectedClinicianCaseIds([]);
                              } else {
                                setSelectedClinicianCaseIds(activeCases.map(c => c.id));
                              }
                            }}
                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded"
                          >
                            {selectedClinicianCaseIds.length === activeCases.length ? "Deselect All" : "Select All Active"}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {clinicianCases.map((c) => {
                          const isActive = c.status === "Active" || c.status === "Triage";
                          const isSelected = selectedClinicianCaseIds.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => isActive && (
                                selectedClinicianCaseIds.includes(c.id)
                                  ? setSelectedClinicianCaseIds(selectedClinicianCaseIds.filter(id => id !== c.id))
                                  : setSelectedClinicianCaseIds([...selectedClinicianCaseIds, c.id])
                              )}
                              className={`border rounded-xl p-3.5 transition-all flex items-start gap-3.5 ${
                                !isActive
                                  ? "bg-slate-50 dark:bg-slate-900/20 border-slate-150 dark:border-slate-850 opacity-60 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-400 dark:border-indigo-900 ring-1 ring-indigo-50 dark:ring-indigo-950 cursor-pointer"
                                  : "bg-white dark:bg-slate-950 border-slate-150 dark:border-slate-800 hover:border-slate-300 cursor-pointer"
                              }`}
                            >
                              {/* Checkbox */}
                              {isActive ? (
                                <div className="pt-0.5">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? "bg-indigo-600 border-indigo-600 text-white" 
                                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  }`}>
                                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                  <CheckCircle className="w-3 h-3 text-slate-450" />
                                </div>
                              )}

                              {/* Patient Clinical details */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">{c.patient.name}</h4>
                                    <span className="text-[10px] text-slate-400">({c.patient.age}y / {c.patient.gender === "Male" ? "M" : "F"})</span>
                                    <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-900 text-slate-500 px-1.5 py-0.2 rounded">
                                      {c.patient.uhid || `ID: ${c.id.slice(0, 5)}`}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] uppercase font-black font-mono px-1.5 py-0.2 rounded border ${
                                    c.patient.triageCategory?.includes("P1")
                                      ? "bg-rose-50 border-rose-200 text-rose-700"
                                      : c.patient.triageCategory?.includes("P2")
                                      ? "bg-amber-50 border-amber-250 text-amber-700"
                                      : "bg-emerald-50 border-emerald-250 text-emerald-700"
                                  }`}>
                                    {c.patient.triageCategory?.split(" ")[0] || "P3"}
                                  </span>
                                </div>

                                <p className="text-[10.5px] text-slate-650 dark:text-slate-300 leading-relaxed font-sans line-clamp-2">
                                  <strong className="font-bold text-slate-700 dark:text-slate-200">Complaint:</strong> {c.patient.presentingComplaint}
                                </p>

                                {c.vitals && (
                                  <div className="text-[9.5px] font-mono text-slate-450 font-bold flex gap-2 pt-0.5">
                                    <span>HR: {c.vitals.hr || "N/A"}</span>
                                    <span>•</span>
                                    <span>BP: {c.vitals.bp || "N/A"}</span>
                                    <span>•</span>
                                    <span>SpO2: {c.vitals.spo2 || "N/A"}%</span>
                                    {c.bedNo && (
                                      <>
                                        <span>•</span>
                                        <span className="text-indigo-600 dark:text-indigo-400">{c.bedNo}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SBAR instantaneous report preview */}
                  {showInstantHandoverSummary && selectedClinicianCaseIds.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 animate-fade-in text-slate-800 dark:text-white">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-[10.5px] uppercase font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-wider">Instant SBAR Transition Preview</span>
                        <button
                          onClick={() => {
                            let text = `==================================================\n`;
                            text += `HOD CLINICAL TRANSFER HANDOVER REPORT\n`;
                            text += `==================================================\n`;
                            text += `Lead HOD Clinician: Dr. ${profile.name}\n`;
                            text += `Pushed from Clinician: ${selectedClinicianForCases?.name}\n`;
                            text += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n\n`;

                            const selCases = cases.filter(c => selectedClinicianCaseIds.includes(c.id));
                            selCases.forEach((c, idx) => {
                              text += `${idx + 1}. PATIENT: ${c.patient.name} (${c.patient.age}y / ${c.patient.gender})\n`;
                              text += `   Triage Category: ${c.patient.triageCategory}\n`;
                              text += `   Chief Complaint: ${c.patient.presentingComplaint}\n`;
                              text += `   Vitals: HR ${c.vitals.hr || "N/A"} | BP ${c.vitals.bp || "N/A"} | SpO2 ${c.vitals.spo2 || "N/A"}%\n`;
                              text += `   Airway Status: ${c.primaryAssessment?.airwayStatus || "Normal"}\n`;
                              text += `   Past History: ${c.sampleHistory?.pastHistory || "Nil documented"}\n`;
                              text += `   ER Plan Summary: Handed over to HOD for queue management.\n`;
                              text += `--------------------------------------------------\n\n`;
                            });

                            navigator.clipboard.writeText(text);
                            setCopiedState(prev => ({ ...prev, hod_sbar: true }));
                            setTimeout(() => setCopiedState(prev => ({ ...prev, hod_sbar: false })), 2000);
                          }}
                          className="text-[9.5px] font-black uppercase text-indigo-500 hover:text-indigo-700 bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-850 shadow-3xs cursor-pointer"
                        >
                          {copiedState["hod_sbar"] ? "✓ Copied!" : "📋 Copy SBAR Block"}
                        </button>
                      </div>

                      <div className="max-h-[160px] overflow-y-auto text-[10px] space-y-2.5 font-sans leading-relaxed text-slate-600 dark:text-slate-350 pr-1">
                        {cases.filter(c => selectedClinicianCaseIds.includes(c.id)).map((c, idx) => (
                          <div key={c.id} className="border-b border-slate-100 dark:border-slate-850 pb-2.5">
                            <p className="font-extrabold text-slate-800 dark:text-white text-[10.5px]">#{idx + 1} Patient: {c.patient.name}</p>
                            <p className="mt-1"><strong className="text-blue-700 dark:text-blue-400 font-bold">[S] Situation:</strong> Presents with {c.patient.presentingComplaint}</p>
                            <p><strong className="text-purple-700 dark:text-purple-400 font-bold">[B] Background:</strong> {c.sampleHistory?.pastHistory || "Nil past history documented."}</p>
                            <p><strong className="text-amber-700 dark:text-amber-400 font-bold">[A] Assessment:</strong> Vitals: HR {c.vitals?.hr || "N/A"}, BP {c.vitals?.bp || "N/A"}, SpO2 {c.vitals?.spo2 || "N/A"}%. Airway: {c.primaryAssessment?.airwayStatus || "Normal"}</p>
                            <p><strong className="text-emerald-700 dark:text-emerald-400 font-bold">[R] Recommendation:</strong> Handed over to department HOD Dr. {profile.name} for queue management and active assignment.</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 px-6 py-4 flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowInstantHandoverSummary(!showInstantHandoverSummary)}
                      disabled={selectedClinicianCaseIds.length === 0}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-850 hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 font-black rounded-xl text-xs transition-all shadow-3xs cursor-pointer"
                    >
                      {showInstantHandoverSummary ? "Hide SBAR" : "SBAR Preview"}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const activeCasesToOvertake = cases.filter(c => selectedClinicianCaseIds.includes(c.id));
                        if (activeCasesToOvertake.length === 0) return;

                        activeCasesToOvertake.forEach(c => {
                          const updatedCase = {
                            ...c,
                            doctorEmail: profile.email,
                            doctorName: profile.name
                          };
                          onSaveCase(updatedCase);
                        });

                        setSuccessTakeoverMessage(`Handover complete! Took control of ${activeCasesToOvertake.length} cases.`);
                        setSelectedClinicianCaseIds([]);
                        setTimeout(() => setSuccessTakeoverMessage(null), 5000);
                      }}
                      disabled={selectedClinicianCaseIds.length === 0}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-950/40 text-white disabled:text-slate-450 dark:disabled:text-slate-550 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      Take Handover ({selectedClinicianCaseIds.length})
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedClinicianForCases(null);
                        setSuccessTakeoverMessage(null);
                        setShowInstantHandoverSummary(false);
                      }}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Google Calendar Sync Modal */}
      <GoogleCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        defaultEventType="shift"
        hospitalName={profile.hospital || "Emergency Department"}
      />

      {/* Google Classroom Portal Modal */}
      <GoogleClassroomModal
        isOpen={isClassroomModalOpen}
        onClose={() => setIsClassroomModalOpen(false)}
        hospitalName={profile.hospital || "Emergency Department"}
        userRole={profile.role}
      />

      {/* Mortality & Morbidity Audit Modal */}
      <MortalityAuditModal
        isOpen={isMortalityModalOpen}
        onClose={() => setIsMortalityModalOpen(false)}
        profile={profile}
        cases={cases}
      />
    </div>
  );
}
