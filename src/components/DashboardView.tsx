import VoiceRecorder from "./shared/VoiceRecorder";
import React, { useState } from "react";
import { 
  PlusCircle, Zap, TrendingUp, Clock, ArrowRight, Activity, 
  Calendar, Users, FileText, Heart, ShieldAlert, ChevronRight, Calculator,
  Mic, AlertTriangle, CheckCircle, Edit, Copy, Download, Check, Eye, ChevronDown, ChevronUp, Briefcase,
  Camera, Building, Trash2, UserPlus, ShieldCheck, Share2, Lightbulb, BookOpen, MessageSquare, GraduationCap,
  Bed, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ClinicalCase, UserProfile, HandoverRecord, TeamMember, isPendingApprovalStatus, isActiveMembershipStatus } from "../types";
import { DutySessionRecord, isActiveDutySessionNow } from "../services/dutySessionService";
import { formatLocalDateKey } from "../utils/dutyWindow";
import { getCasePendingStatus } from "../utils/caseHelper";
import { triggerPrintWithTip } from "../utils/printWithTip";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { createTeamInvite } from "../services/teamInviteService";
import GoogleCalendarModal from "./GoogleCalendarModal";
import GoogleClassroomModal from "./GoogleClassroomModal";
import MortalityAuditModal from "./MortalityAuditModal";
import { ConfirmModal } from "./shared/ConfirmModal";
import { displayGcs, displayTemperature, displaySpo2, displayGrbs } from "../utils/clinicalFormatter";

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
  onDiscussCase?: (patientCase: ClinicalCase, mode?: "discuss" | "rounds") => void;
  onStartDischargeSummary?: () => void;
  onDeleteAllCases?: () => void;
  onDeleteCase?: (caseId: string) => void;
  isPlatformAdmin?: boolean;
  activeDutySession?: DutySessionRecord | null;
  onStartDutySession?: (shift: any) => Promise<void>;
  onEndDutySession?: () => Promise<void>;
  onAssignBed?: (caseId: string, bedInput: string) => Promise<{ success: boolean; error?: string; assignedBed?: string }>;
  physicalBedCapacity?: number;
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
  onDeleteAllCases,
  onDeleteCase,
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
  isPlatformAdmin = false,
  activeDutySession = null,
  onStartDutySession,
  onEndDutySession,
  onAssignBed,
  physicalBedCapacity = 30,
}: DashboardViewProps) {
  // Resolve current logged-in user's assigned shift name and time
  const userEmailLower = profile.email.toLowerCase().trim();
  const currentUserMember = teamMembers.find(
    m => m.email.toLowerCase().trim() === userEmailLower
  );
  // PLANNED DUTY: Shared rota / team shift (suggestion only)
  const plannedShiftId = currentUserMember?.shift || "morning";

  // Operational active department cases (Patch H1)
  const activeDepartmentCases = cases.filter(c => !c.archivedAt && (c.status === "Active" || c.status === "Triage"));

  const isHospitalClinician = Boolean(
    currentUserMember || (profile.hospital && profile.hospital.trim() !== "")
  );

  const validActiveDutySession = Boolean(
    activeDutySession && isActiveDutySessionNow(activeDutySession)
  );

  // HOSPITAL — MY ASSIGNED CASES (Patch H1)
  // Shows ONLY operationally active cases with currentAssigneeEmail matching doctor and currentAssignmentDutySessionId matching valid active duty session.
  // Strictly zero fallback to doctorEmail === profile.email.
  const myCurrentDutyCases = validActiveDutySession && activeDutySession
    ? activeDepartmentCases.filter(c =>
        c.currentAssigneeEmail?.toLowerCase().trim() === userEmailLower &&
        c.currentAssignmentDutySessionId === activeDutySession.id
      )
    : [];

  // INDEPENDENT HOME = CURRENT LOCAL DAY (Patch H1A)
  // For individual/independent workspace, Home personal cases must be:
  // - owned/assigned to that doctor
  // - operationally active
  // - created on the CURRENT LOCAL CALENDAR DAY
  // Do NOT require activeDutySession.
  // At local midnight, yesterday's cases disappear from Home automatically.
  // They remain untouched in Case Registry / History.
  // Uses local calendar date components without UTC toISOString() date comparison.
  const todayLocalKey = formatLocalDateKey(new Date());

  const isCaseCreatedOnLocalDay = (c: ClinicalCase, targetLocalKey: string): boolean => {
    if (c.createdAt) {
      const d = new Date(c.createdAt);
      if (!isNaN(d.getTime())) {
        return formatLocalDateKey(d) === targetLocalKey;
      }
    }
    if (c.savedTime) {
      const d = new Date(c.savedTime);
      if (!isNaN(d.getTime())) {
        return formatLocalDateKey(d) === targetLocalKey;
      }
    }
    if (c.currentAssignmentAt) {
      const d = new Date(c.currentAssignmentAt);
      if (!isNaN(d.getTime())) {
        return formatLocalDateKey(d) === targetLocalKey;
      }
    }
    if (c.patient?.dateOpened) {
      const d = new Date(c.patient.dateOpened);
      if (!isNaN(d.getTime())) {
        return formatLocalDateKey(d) === targetLocalKey;
      }
      const parts = c.patient.dateOpened.split("|");
      if (parts.length > 1) {
        const datePart = parts[1].trim();
        const dPart = new Date(datePart);
        if (!isNaN(dPart.getTime())) {
          return formatLocalDateKey(dPart) === targetLocalKey;
        }
        const dWithYear = new Date(`${datePart} ${new Date().getFullYear()}`);
        if (!isNaN(dWithYear.getTime())) {
          return formatLocalDateKey(dWithYear) === targetLocalKey;
        }
      }
    }
    return false;
  };

  const myIndependentCases = activeDepartmentCases.filter(c => {
    const isOwnedOrAssigned = Boolean(
      (c.currentAssigneeEmail && c.currentAssigneeEmail.toLowerCase().trim() === userEmailLower) ||
      (c.doctorEmail && c.doctorEmail.toLowerCase().trim() === userEmailLower) ||
      (auth.currentUser?.uid && c.ownerUid === auth.currentUser.uid) ||
      (auth.currentUser?.uid && (c as any).createdByUid === auth.currentUser.uid)
    );
    if (!isOwnedOrAssigned) return false;
    return isCaseCreatedOnLocalDay(c, todayLocalKey);
  });

  const myCases = isHospitalClinician ? myCurrentDutyCases : myIndependentCases;

  // Statistics & Home scoped metrics (Patch H1A):
  // For independent personal: active count, pending alerts, and recent cases all use the SAME current-day scoped list.
  const activeCasesCount = isHospitalClinician ? activeDepartmentCases.length : myCases.length;
  const casesThisWeekCount = cases.length;
  
  const recentCases = [...(isHospitalClinician ? cases.filter(c => !c.archivedAt) : myCases)]
    .sort((a, b) => new Date(b.patient.dateOpened).getTime() - new Date(a.patient.dateOpened).getTime())
    .slice(0, 3);
  
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
  
  const plannedShift = activeShiftsList.find(s => s.id === plannedShiftId) || activeShiftsList[0];

  // ACTUAL DUTY: Doctor confirms/selects shift -> persisted duty session (cross-device source of truth)
  const actualDutyShift = activeDutySession
    ? (activeShiftsList.find(s => s.id === activeDutySession.shiftId) || {
        id: activeDutySession.shiftId,
        name: activeDutySession.shiftName,
        time: activeDutySession.shiftTime,
      })
    : plannedShift;

  const assignedShift = actualDutyShift;

  const isResident = profile.role.toLowerCase().includes("resident");

  // Filter out discharged cases, check which active ones are pending/incomplete (Patch H1A: independent uses current-day scoped list)
  const pendingCasesSource = isHospitalClinician ? (isResident ? myCases : activeDepartmentCases) : myCases;
  const pendingCases = pendingCasesSource
    .map(c => ({
      case: c,
      status: getCasePendingStatus(c)
    }))
    .filter(x => x.status.isPending);

  // Active invite link generated dynamically
  const [activeInviteLink, setActiveInviteLink] = useState<string>("");
  const [modalShiftId, setModalShiftId] = useState<string>("");

  React.useEffect(() => {
    if (showShiftCheckIn) {
      setModalShiftId(activeDutySession?.shiftId || plannedShiftId);
    }
  }, [showShiftCheckIn, plannedShiftId, activeDutySession?.shiftId]);


  React.useEffect(() => {
    let active = true;
    if (profile?.hospital) {
      createTeamInvite(profile.hospital, auth.currentUser?.uid || "hod", profile.name || "HOD").then(res => {
        if (active) {
          setActiveInviteLink(res.link);
        }
      });
    } else {
      setActiveInviteLink(`${window.location.origin}/join/general-er-invite`);
    }
    return () => { active = false; };
  }, [profile?.hospital, profile?.name]);
  // Shift & Countdown Warning States
  const [showShiftWarning, setShowShiftWarning] = useState<boolean>(false);
  const [warningSeconds, setWarningSeconds] = useState<number>(300); // 5 minutes

  // Quick Bed Assignment Modal State
  const [assigningBedCase, setAssigningBedCase] = useState<ClinicalCase | null>(null);
  const [bedInputValue, setBedInputValue] = useState("");
  const [assignBedError, setAssignBedError] = useState<string | null>(null);
  const [isAssigningBed, setIsAssigningBed] = useState(false);

  const handleConfirmAssignBed = async () => {
    if (!assigningBedCase || !onAssignBed) return;
    setIsAssigningBed(true);
    setAssignBedError(null);
    try {
      const res = await onAssignBed(assigningBedCase.id, bedInputValue);
      if (res.success) {
        setAssigningBedCase(null);
        setBedInputValue("");
      } else {
        setAssignBedError(res.error || "Failed to assign bed.");
      }
    } catch (err: any) {
      setAssignBedError(err?.message || "Failed to assign bed.");
    } finally {
      setIsAssigningBed(false);
    }
  };

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
  const [showHODModal, setShowHODModal] = useState<boolean>(false);

  // Department HOD calculations
  const departmentHODMember = teamMembers.find(m => 
    m.role?.toLowerCase().includes("hod") || 
    m.role?.toLowerCase().includes("head") || 
    m.role?.toLowerCase().includes("lead")
  );
  const isSelfHOD = profile.role?.toLowerCase().includes("hod") || profile.role?.toLowerCase().includes("owner") || profile.role?.toLowerCase().includes("head");
  const hodDisplayName = departmentHODMember ? departmentHODMember.name : (isSelfHOD ? profile.name : (profile.hospital ? `Dr. ${profile.hospital.split(' ')[0]} HOD` : "Department Head"));
  const hodEmail = departmentHODMember ? departmentHODMember.email : (isSelfHOD ? profile.email : "hod@" + (profile.hospital ? profile.hospital.toLowerCase().replace(/[^a-z]/g, '') : "ermate") + ".in");

  // Google Calendar & Classroom Modal States
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState<boolean>(false);

  // Mortality Audit Modal State
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState<boolean>(false);

  // HOD Profile & Team Sync States
  const [isEditingHospital, setIsEditingHospital] = useState(false);
  const [tempHospital, setTempHospital] = useState(profile.hospital || "");
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
  const [caseToDelete, setCaseToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

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
      await updateDoc(userDocRef, { 
        hospitalLabel: tempHospital.trim(),
        workplaceName: tempHospital.trim()
      });
      profile.hospitalLabel = tempHospital.trim();
      profile.workplaceName = tempHospital.trim();
      setIsEditingHospital(false);
    } catch (err) {
      console.error("Error updating hospital label: ", err);
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
    const hospitalLine = c.hospital ? `Hospital: ${c.hospital}` : "";
    const mlcFlag = c.patient?.isMlc ? " | MLC CASE" : "";

    // ── Adjuncts to Primary (VBG/ABG, ECG, Echo, EFAST) ──
    const adj = (c as any).adjuncts || {};
    const adjunctsSection = `
ADJUNCTS TO PRIMARY:
- VBG/ABG: ${adj.abgStatus === "done"
      ? `pH ${adj.abgPh || "N/A"}, pCO2 ${adj.abgPco2 || "N/A"}, HCO3 ${adj.abgHco3 || "N/A"}, Lactate ${adj.abgLactate || "N/A"}, Na ${adj.abgNa || "N/A"}, K ${adj.abgK || "N/A"}`
      : "Not documented"}
- ECG: ${adj.ecgInterpretation && adj.ecgInterpretation !== "Not done" ? `${adj.ecgInterpretation}${adj.ecgNotes ? ` — ${adj.ecgNotes}` : ""}` : (adj.ecgFindings || "Not documented")}
- Bedside Echo: ${adj.echoInterpretation && adj.echoInterpretation !== "Not done" ? `${adj.echoInterpretation}${adj.echoNotes ? ` — ${adj.echoNotes}` : ""}` : (adj.echoFindings || "Not documented")}
- EFAST: ${adj.efastInterpretation && adj.efastInterpretation !== "Not done" ? `${adj.efastInterpretation}${adj.efastNotes ? ` — ${adj.efastNotes}` : ""}` : (adj.efastFindings || "Not documented")}`;

    // ── Structured Secondary Survey ──
    const sec = (c as any).secondarySurvey || {};
    const structuredSecondary = [
      sec.general ? `General: ${sec.general}` : "",
      sec.cvs ? `CVS: ${sec.cvs}` : "",
      sec.respiratory ? `Respiratory: ${sec.respiratory}` : "",
      sec.abdomen ? `Abdomen: ${sec.abdomen}` : "",
      sec.cns ? `CNS: ${sec.cns}` : "",
      sec.extremities ? `Extremities: ${sec.extremities}` : "",
    ].filter(Boolean).join("\n");
    const secondarySection = structuredSecondary || (typeof c.secondaryAssessment === "string" ? c.secondaryAssessment : "General exam within normal limits.");

    // ── Psychological Assessment ──
    const psych = (c as any).psychologicalAssessment || (c.sampleHistory?.psychiatricFlags ? {
      notes: c.sampleHistory.psychiatricFlags,
    } : null);

    const formatPsychBool = (val: any, isRisk = false) => {
      if (val === true) return isRisk ? "YES ⚠️" : "Yes";
      if (val === false) return "No";
      return "Not documented";
    };

    const hasStructuredPsych = psych && (
      psych.suicidalIdeation !== undefined ||
      psych.selfHarmHistory !== undefined ||
      psych.intentToHarmOthers !== undefined ||
      psych.substanceAbuse !== undefined ||
      psych.psychiatricHistory !== undefined ||
      psych.currentlyOnPsychiatricTreatment !== undefined ||
      psych.hasSupportSystem !== undefined
    );

    const psychSection = psych ? `
PSYCHOLOGICAL ASSESSMENT:
${hasStructuredPsych ? `- Suicidal Ideation: ${formatPsychBool(psych.suicidalIdeation, true)}
- Self-Harm History: ${formatPsychBool(psych.selfHarmHistory, true)}
- Intent to Harm Others: ${formatPsychBool(psych.intentToHarmOthers, true)}
- Substance Abuse: ${formatPsychBool(psych.substanceAbuse)}
- Psychiatric History: ${formatPsychBool(psych.psychiatricHistory)}
- Currently on Psychiatric Treatment: ${formatPsychBool(psych.currentlyOnPsychiatricTreatment)}
- Has Support System: ${formatPsychBool(psych.hasSupportSystem)}` : ""}${psych.notes ? `\n- Notes: ${psych.notes}` : ""}`.trim() : "";

    // ── Investigations — includes abnormal flags ──
    const legacyInvestigations = c.investigations?.map(i => `- ${i.testName}: ${i.result || "Pending"}`).join("\n") || "";
    const flaggedResults = c.investigationResults?.map(r =>
      `- ${r.name}: ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.isAbnormal ? ` ⚠️ ${r.flag || "ABNORMAL"}` : ""}`
    ).join("\n") || "";
    const imaging = c.investigationImaging ? `\nImaging: ${c.investigationImaging}` : "";
    const summary = c.investigationResultsSummary ? `\nSummary: ${c.investigationResultsSummary}` : "";
    const investigationsSection = [legacyInvestigations, flaggedResults, imaging, summary].filter(Boolean).join("\n") || "None ordered";

    // ── Treatments — includes infusions & procedures ──
    const meds = c.treatments?.map(t => `- ${t.timeGiven ? `[${t.timeGiven}] ` : ""}${t.drugName} ${t.dose || ""} (${t.route || "IV"})`).join("\n") || "";
    const infusionsList = c.infusions?.map(f => `- ${f.fluidName} ${f.dose || ""}, diluted ${f.dilution || "N/A"}, rate ${f.rate || "N/A"}`).join("\n") || "";
    const procedures = c.proceduresChecked?.length ? `\nProcedures: ${c.proceduresChecked.join(", ")}` : "";
    const otherProc = c.otherProcedures ? `\nOther Procedures: ${c.otherProcedures}` : "";
    const treatmentSection = [meds, infusionsList, procedures, otherProc].filter(Boolean).join("\n") || "Symptomatic care";

    // ── Disposition ──
    const dap = c.dispositionAndPlan || {};
    const dispositionSection = `
DISPOSITION & PLAN:
- Status: ${c.dispositionDetails?.dispositionType || dap.dispositionStatus || "In ER Evaluation"}
- Destination: ${dap.destinationUnit || "N/A"}
- Duration in ER: ${c.dispositionDetails?.durationInEr || "N/A"}
- Consults Requested: ${dap.consultsRequested?.length ? dap.consultsRequested.join(", ") : "None"}
- Pending Investigations: ${dap.pendingInvestigations?.length ? dap.pendingInvestigations.join(", ") : "None"}
- Follow-Up Advice: ${dap.followUpAdvice || "N/A"}
- Observation Notes: ${c.dispositionDetails?.observationNotes || "N/A"}`;

    // ── Notes / Addendum ──
    const notesSection = `
CLINICAL NOTES & ADDENDUM:
${c.progressNotes || "No progress notes recorded."}
${c.addendumNotes ? `\nAddendum: ${c.addendumNotes}` : ""}`;

    // ── MLC Details ──
    const mlc = (c.patient as any)?.mlcDetails;
    const mlcSection = c.patient?.isMlc && mlc ? `
MLC DETAILS:
- Nature of Incident: ${mlc.natureOfIncident || "Not recorded"}
- Date & Time of Incident: ${mlc.dateTimeOfIncident || "Not recorded"}
- Place of Incident: ${mlc.placeOfIncident || "Not recorded"}
- Identification Mark: ${mlc.identificationMark || "Not recorded"}
- Informant/Brought By: ${mlc.informantBroughtBy || "Not recorded"}` : "";

    // ── Pediatrics ──
    const peds = c.pediatricDetails as any;
    const pediatricsSection = c.isPediatric && peds ? `
PEDIATRIC ASSESSMENT:
- Weight: ${peds.patientWeight || peds.weight ? `${peds.patientWeight || peds.weight} kg` : "Not recorded"}
- PAT — Appearance (TICLS): Tone: ${peds.patAppearanceTone || "N/A"}, Interactivity: ${peds.patAppearanceInteractivity || "N/A"}, Consolability: ${peds.patAppearanceConsolability || "N/A"}, Look/Gaze: ${peds.patAppearanceLookGaze || "N/A"}, Speech/Cry: ${peds.patAppearanceSpeechCry || "N/A"}
- Work of Breathing: ${peds.patWorkOfBreathing || peds.workOfBreathing || "N/A"} | Circulation: ${peds.patCirculation || peds.circulation || "N/A"}
- Immunization Status: ${peds.immunizationHistory || "N/A"}
- Birth History: ${peds.birthHistory || "N/A"}
- Feeding History: ${peds.feedingHistory || "N/A"}
- Developmental History: ${peds.developmentalHistory || "N/A"}
- Brought By: ${peds.broughtBy || "N/A"}
- Informant: ${peds.informant || "N/A"}
${peds.medicationsInEnvironment ? `- Medications in Environment: ${peds.medicationsInEnvironment}` : ""}
${peds.signsAndSymptoms ? `- Signs & Symptoms: ${peds.signsAndSymptoms}` : ""}` : "";

    // NABH / JCI Safety Checklists
    const ipsg = c.ipsgChecklist;
    const vuln = c.vulnerableAssessment;
    const consent = c.consentTimeOut;
    const safetySection = (ipsg || vuln || consent) ? `
NABH/JCI SAFETY & GOVERNANCE CHECKLIST:
${ipsg ? `- IPSG Checklist: Identifiers: ${ipsg.ipsg1IdentifiersVerified ? "Verified" : "Pending"}, ReadBack: ${ipsg.ipsg2ReadBackPerformed ? "Yes" : "No"}, HighAlert: ${ipsg.ipsg3HighAlertDoubleChecked ? "Checked" : "No"}, FallRisk: ${ipsg.ipsg6FallRiskAssessed}` : ""}
${vuln ? `- Vulnerable Assessment: Vulnerable: ${vuln.isVulnerable ? `Yes (${vuln.vulnerableType})` : "No"}, Functional: ${vuln.functionalAssessmentScore}` : ""}
${consent ? `- Consent/Time-Out: Consent Obtained: ${consent.procedureConsentObtained ? "Yes" : "No"}, Time-Out Performed: ${consent.procedureTimeOutPerformed ? "Yes" : "No"}` : ""}` : "";

    const gcsVal = displayGcs(c.vitals);

    return `==================================================
EMERGENCY DEPARTMENT EMR CASE SHEET
${hospitalLine}
==================================================
CASE ID: ${c.displayId || c.id}
UHID: ${c.patient?.uhid || "N/A"}
DATE OPENED: ${c.patient?.dateOpened || c.savedTime || "N/A"}
ASSIGNED CLINICIAN: ${c.doctorName || c.doctorEmail || "Unassigned"}
CASE STATUS: ${c.status}

PATIENT DEMOGRAPHICS:
- Name: ${c.patient?.name || "N/A"} (${c.patient?.age || "N/A"}y / ${c.patient?.gender || "N/A"})
- Bed No: ${c.bedNo || "Unassigned"} | UHID: ${c.patient?.uhid || "N/A"}
- Triage: ${c.patient?.triageCategory || "P2"} | Arrival: ${c.patient?.arrivalMode || "Walk-in"}
- Chief Complaint: ${c.patient?.presentingComplaint || "N/A"}
- Case Type: ${c.patient?.caseType || "Medical"}${mlcFlag}

INITIAL PRESENTATION VITALS:
- BP: ${c.vitals?.bp ? `${c.vitals.bp} mmHg` : "Not documented"} | HR: ${c.vitals?.hr ? `${c.vitals.hr} bpm` : "Not documented"}
- SpO2: ${displaySpo2(c.vitals?.spo2)} | RR: ${c.vitals?.rr ? `${c.vitals.rr} /min` : "Not documented"}
- Temp: ${displayTemperature(c.vitals?.temp)} | GCS: ${gcsVal}
- GRBS: ${displayGrbs(c.vitals?.grbs)} | Pain Score: ${c.vitals?.painScore !== undefined && c.vitals?.painScore !== null && c.vitals?.painScore !== "" ? `${c.vitals.painScore}/10` : "Not documented"}

SAMPLE HISTORY:
- Symptoms: ${c.sampleHistory?.symptoms || "N/A"}
- Allergies: ${c.sampleHistory?.allergies || "Not documented"}
- Past Medical History: ${c.sampleHistory?.pastHistory || "None"}
- Outpatient Meds: ${c.sampleHistory?.medications || "None"}
- Last Meal: ${c.sampleHistory?.lastMeal || "N/A"}
- Events: ${c.sampleHistory?.events || "N/A"}

PRIMARY SURVEY (ABCDE):
- Airway: ${c.primaryAssessment?.airwayStatus || c.primaryAssessment?.airway || "Not documented"}
- Breathing: ${c.primaryAssessment?.breathingStatus || c.primaryAssessment?.breathing || "Not documented"}
- Circulation: ${c.primaryAssessment?.circulationStatus || c.primaryAssessment?.circulation || "Not documented"}
- Disability: ${c.primaryAssessment?.disabilityStatus || c.primaryAssessment?.disability || "Not documented"}
- Exposure: ${c.primaryAssessment?.exposureStatus || c.primaryAssessment?.exposure || "Not documented"}
${adjunctsSection}

SECONDARY ASSESSMENT / EXAMINATION:
${secondarySection}
${pediatricsSection}
${psychSection}

INVESTIGATIONS ORDERED / RESULTS:
${investigationsSection}

TREATMENTS & MEDICATION ORDERS:
${treatmentSection}

DIFFERENTIAL DIAGNOSES:
${c.differentials?.map(d => `- ${d.diagnosis}${d.status ? ` (${d.status})` : ""}`).join("\n") || "Under evaluation"}
${dispositionSection}
${notesSection}
${mlcSection}
${safetySection}
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
PATIENT CONDITION AT DISCHARGE: ${d?.dischargeCondition || "Not recorded"}

DISCHARGE VITALS
-------------------------
Blood Pressure: ${d?.dischargeBp || "Not recorded"} mmHg
Heart Rate: ${d?.dischargeHr || "Not recorded"} bpm
Oxygen Saturation: ${d?.dischargeSpo2 || "Not recorded"}% on Room Air
Respiratory Rate: ${d?.dischargeRr || "Not recorded"} /min
Temperature: ${displayTemperature(d?.dischargeTemp)}
GCS Score: ${d?.dischargeGcs || "Not recorded"}
Pain Score: ${d?.dischargePainScore || "Not recorded"}
GRBS (Glucose): ${d?.dischargeGrbs || "Not recorded"} mg/dL

CHIEF COMPLAINTS & INITIAL DIAGNOSIS
------------------------------------
Presenting Complaint: ${d?.presentingComplaints || c.patient.presentingComplaint || "Not documented"}
Provisional Primary Diagnosis: ${c.provisionalPrimaryDiagnosis || "Not documented"}
Other Diagnoses/Differentials: ${c.differentials && c.differentials.length > 0 ? c.differentials.map(diff => diff.diagnosis).join(", ") : "Not documented"}

ER COURSE & TREATMENT SUMMARY
-----------------------------
${d?.courseInHospital || (c.treatments && c.treatments.length > 0 
  ? c.treatments.map(t => `- ${t.drugName} ${t.dose} given via ${t.route} at ${t.timeGiven}`).join("\n")
  : "Not documented")}

DISCHARGE MEDICATIONS & OUTPATIENT RX
--------------------------------------
${d?.dischargeMedications || "Not documented"}
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

  const pendingMembers = (teamMembers || []).filter(m => isPendingApprovalStatus(m.status));

  return (
    <div className="space-y-6 pb-28" id="dashboard-container">
      {/* 1. Shift Status Banner & Controls */}
      {isOnShift ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs font-black text-emerald-850 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>{actualDutyShift.name} • Active on Duty</span>
                {activeDutySession?.dutyDateKey && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    [{activeDutySession.dutyDateKey}]
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {actualDutyShift.time} • {profile.hospital} • {activeShiftDoctors.length} clinicians active
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setShowShiftWarning(true);
                setWarningSeconds(300); // 5 minutes
              }}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-lg text-[11px] transition-all cursor-pointer"
            >
              Simulate Shift End
            </button>
            <button
              onClick={async () => {
                if (onEndDutySession) {
                  await onEndDutySession();
                } else {
                  setIsOnShift(false);
                }
                setShowShiftWarning(false);
              }}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-all cursor-pointer"
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
                Scheduled rota: <span className="font-bold text-slate-700 dark:text-slate-300">{plannedShift.name} ({plannedShift.time})</span>. Check in to log cases & handovers.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowShiftCheckIn(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-all shrink-0 cursor-pointer"
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
              onClick={async () => {
                if (onEndDutySession) {
                  await onEndDutySession();
                } else {
                  setIsOnShift(false);
                }
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
                <div className="relative flex items-center">
                  <select 
                    value={modalShiftId}
                    onChange={(e) => setModalShiftId(e.target.value)}
                    className="bg-transparent text-indigo-600 dark:text-indigo-400 font-extrabold outline-none text-right appearance-none cursor-pointer pr-5 pl-2 py-0.5"
                  >
                    {activeShiftsList.map(s => (
                      <option key={s.id} value={s.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                        {s.name} {s.id === plannedShift.id ? "(Roster Suggestion)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 absolute right-0 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Time Window:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{activeShiftsList.find(s => s.id === modalShiftId)?.time || plannedShift.time}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Clinical Facility:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.hospital}</span>
              </div>
              <div className="border-t border-slate-250 dark:border-slate-800/80 my-2 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Residents Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {teamMembers.filter(m => m.role.toLowerCase().includes("resident") && m.shift === modalShiftId).length} active
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Consultants Active:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {teamMembers.filter(m => (m.role.toLowerCase().includes("consultant") || m.role.toLowerCase().includes("hod") || m.role.toLowerCase().includes("lead")) && m.shift === modalShiftId).length} active
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowShiftCheckIn(false);
                }}
                className="flex-1 py-2 border text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={async () => {
                  const chosenShift = activeShiftsList.find(s => s.id === modalShiftId) || plannedShift;
                  if (modalShiftId !== plannedShiftId && currentUserMember && onUpdateShift) {
                    onUpdateShift(currentUserMember.id, modalShiftId);
                  }
                  if (onStartDutySession) {
                    await onStartDutySession(chosenShift);
                  } else {
                    setIsOnShift(true);
                  }
                  setShowShiftCheckIn(false);
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
              >
                Start Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Welcome Banner */}
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
              <button
                type="button"
                onClick={() => setShowHODModal(true)}
                className={`px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1 hover:scale-105 ${
                  isDarkMode 
                    ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40 text-[8px] md:text-[10px]" 
                    : "bg-amber-400/25 text-amber-100 hover:bg-amber-400/40 border-amber-300/40 text-[8px] md:text-[10px]"
                }`}
                title="Click to view Head of Department details"
              >
                <span>👑 HOD: {hodDisplayName}</span>
              </button>
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
              onClick={() => onOpenPediatricCalculator()}
              className={`hidden md:flex flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all items-center justify-center gap-1.5 cursor-pointer ${
                isDarkMode 
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200" 
                  : "bg-white/15 hover:bg-white/25 border-white/20 text-white"
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-slate-150" />
              Pediatric Dosing
            </button>
            <button
              onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}
              className="flex-1 md:flex-none px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] md:text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-purple-100" />
              Handover
            </button>
          </div>
        </div>
      </div>

      {/* 3. Important Clinical & Leadership Alerts */}
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

      {/* Important Alert: Pending Clinician Registrations (HOD Only) */}
      {profile.role.toLowerCase().includes("hod") && pendingMembers.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/50 to-purple-900/60 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white shadow-md no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 text-pink-300 rounded-xl shrink-0 border border-pink-500/30">
              <ShieldAlert className="w-5 h-5 text-pink-400 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-pink-300 uppercase tracking-wider font-mono">HOD Verification Pending</p>
              <h3 className="text-sm font-extrabold text-white mt-0.5">
                {pendingMembers.length} Clinician Registration{pendingMembers.length > 1 ? "s" : ""} Awaiting Verification
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab("team")}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Review & Approve in Team</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                
                <div className="space-y-2.5">
                  {/* Row 1: Bed prominence & quick action */}
                  <div className="flex items-center justify-between gap-2">
                    {pc.bedNo ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black font-mono tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          BED {pc.bedNo}
                        </span>
                        {onAssignBed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningBedCase(pc);
                              setBedInputValue(pc.bedNo || "");
                              setAssignBedError(null);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            title="Edit or reassign bed"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black font-mono tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          BED UNASSIGNED
                        </span>
                        {onAssignBed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningBedCase(pc);
                              setBedInputValue("");
                              setAssignBedError(null);
                            }}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Assign ER Bed"
                          >
                            <span>Assign Bed</span>
                          </button>
                        )}
                      </div>
                    )}
                    <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500">
                      {pc.displayId || pc.id}
                    </span>
                  </div>

                  {/* Row 2: Demographics & Triage */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {pc.patient.name && pc.patient.name !== "Emergency Patient" && (
                        <div className="font-extrabold text-sm text-slate-800 dark:text-white truncate">
                          {pc.patient.name}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {pc.patient.gender || "Unknown"} • {pc.patient.age !== null && pc.patient.age !== undefined ? `${pc.patient.age} years` : "Age N/A"}
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                      String(pc.patient.triageCategory || "").includes("P1")
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : String(pc.patient.triageCategory || "").includes("P2")
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}>
                      {String(pc.patient.triageCategory || "P2").split(" ")[0]}
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
                  {onDeleteCase && isPlatformAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setCaseToDelete({ id: pc.id, name: pc.patient.name });
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center shrink-0"
                      title="Delete Case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDiscussCase && (
                    <button
                      type="button"
                      onClick={() => onDiscussCase(pc, "discuss")}
                      className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 shrink-0"
                      title="Discuss case with AI Assistant"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Discuss</span>
                    </button>
                  )}
                  {onDiscussCase && (
                    <button
                      type="button"
                      onClick={() => onDiscussCase(pc, "rounds")}
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 shrink-0"
                      title="7-Lens Clinical Rounds & Debrief"
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Rounds</span>
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

      {/* 3. Clinical Tools & Active Workflows */}
      <div className="space-y-3 no-print">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
            Clinical Tools & Active Workflows
          </h2>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
            Rapid ER Actions
          </span>
        </div>

        {/* Unified Responsive Tool Action Pad */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Voice Scribe Desk */}
          <button 
            type="button"
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartVoiceScribe(); }}
            className="flex flex-col justify-between p-3.5 bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl text-left transition-all shadow-xs hover:shadow-md cursor-pointer group min-h-[110px]"
          >
            <div className="w-8 h-8 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Mic className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300">Voice Scribe</span>
              <span className="block text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                Dictate in native language
              </span>
            </div>
          </button>

          {/* Card 2: New Patient Intake */}
          <button 
            type="button"
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartFullFlow(); }}
            className="flex flex-col justify-between p-3.5 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 hover:border-emerald-500/40 rounded-2xl text-left transition-all shadow-xs hover:shadow-md cursor-pointer group min-h-[110px]"
          >
            <div className="w-8 h-8 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <PlusCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-emerald-300">New Patient</span>
              <span className="block text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                AI Triage & Intake
              </span>
            </div>
          </button>

          {/* Card 3: Shift Handover */}
          <button 
            type="button"
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}
            className="flex flex-col justify-between p-3.5 bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl text-left transition-all shadow-xs hover:shadow-md cursor-pointer group min-h-[110px]"
          >
            <div className="w-8 h-8 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-indigo-300">Shift Handover</span>
              <span className="block text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                Synthesize SBAR Cards
              </span>
            </div>
          </button>

          {/* Card 4: Pediatric Dosing */}
          <button 
            type="button"
            onClick={() => onOpenPediatricCalculator()}
            className="flex flex-col justify-between p-3.5 bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/20 hover:border-sky-500/40 rounded-2xl text-left transition-all shadow-xs hover:shadow-md cursor-pointer group min-h-[110px]"
          >
            <div className="w-8 h-8 bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calculator className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-sky-300 truncate">Pediatric Dosing</span>
              <span className="block text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                Weight-based drug reference
              </span>
            </div>
          </button>

          {/* Card 5: EM Drugs & Procedures (Critical) */}
          <button 
            type="button"
            onClick={() => onNavigateToTab("emdrugs")}
            className="col-span-2 sm:col-span-1 flex flex-col justify-between p-3.5 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/25 hover:border-rose-500/40 rounded-2xl text-left transition-all shadow-xs hover:shadow-md cursor-pointer group min-h-[110px]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8 h-8 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
              </div>
              <span className="text-[8px] font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded uppercase">
                CRITICAL
              </span>
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-rose-300 truncate">EM Drugs & Guide</span>
              <span className="block text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                RSI, Sedation & Resus
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. ER Snapshot (Stats Row) */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-4 no-print">
        {/* Active Cases */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-2 md:gap-3.5 min-w-0">
          <div className="p-2 md:p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Activity className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[8.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Active Cases</p>
            <h3 className="text-sm md:text-xl font-black text-slate-800 dark:text-white mt-0.5">{activeCasesCount}</h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono">Immediate clinical triage</p>
          </div>
        </div>

        {/* Admissions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-2 md:gap-3.5 min-w-0">
          <div className="p-2 md:p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <Calendar className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[8.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Admissions</p>
            <h3 className="text-sm md:text-xl font-black text-slate-800 dark:text-white mt-0.5">{casesThisWeekCount}</h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono">Today's patient intake</p>
          </div>
        </div>

        {/* Bed Capacity / Facility */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4 shadow-xs flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-2 md:gap-3.5 min-w-0">
          <div className="p-2 md:p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <Bed className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[8.5px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Occupancy</p>
            <h3 className="text-sm md:text-xl font-black text-slate-800 dark:text-white mt-0.5 truncate">
              {activeCasesCount} / {physicalBedCapacity || 30}
            </h3>
            <p className="hidden md:block text-[9px] text-slate-400 mt-0.5 font-mono truncate">{profile.hospital || "Emergency Dept"}</p>
          </div>
        </div>
      </div>

      {/* 5. Today's ER Patient Registry (Full Width Operational Centerpiece) */}
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
                      {myCases.length}
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
                    {isHospitalClinician ? "All ER Admissions" : "Today's Admissions"}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeCasesTab === "all"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-200 dark:bg-slate-855 text-slate-600"
                    }`}>
                      {isHospitalClinician ? activeDepartmentCases.length : myCases.length}
                    </span>
                  </button>
                </div>
              )}
              {onDeleteAllCases && isPlatformAdmin && (
                <button
                  onClick={() => {
                    setShowDeleteAllConfirm(true);
                  }}
                  className="ml-auto px-3 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm shrink-0"
                  title="Clear All Shift Cases"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Cases
                </button>
              )}
            </div>

            {(() => {
              const displayedCases = [
                ...(isHospitalClinician
                  ? (isResident || activeCasesTab === "my" ? myCases : activeDepartmentCases)
                  : myCases)
              ]
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
                      {isHospitalClinician
                        ? (activeCasesTab === "my" 
                            ? (validActiveDutySession
                                ? "You don't have any patients assigned to your active duty session right now. Select 'All ER Admissions' above to browse department cases or click 'Triage/Quick Register' to admit a new patient."
                                : "You are currently off-shift or your duty session has ended. Start your shift or check in to assume care of patients and view assigned cases.")
                            : "No active or registered admissions found in the ER department today.")
                        : "No active patients registered today. Click 'Triage/Quick Register' to admit a new patient."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayedCases.map((c, idx) => {
                    const isExpanded = expandedCaseId === c.id;
                    return (
                      <div
                        key={`${c.id}-${idx}`}
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
                                String(c.patient.triageCategory || "").includes("P1")
                                  ? "bg-rose-50 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                  : String(c.patient.triageCategory || "").includes("P2")
                                  ? "bg-amber-50 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                                  : "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              }`}>
                                {String(c.patient.triageCategory || "P2").split(" ")[0]}
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
                              <span>Captured: {c.createdAt ? new Date(c.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
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
                              <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded">Case ID: {c.displayId || c.id}</span>
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
                                      <VoiceRecorder
                                        renderMode="compact-button"
                                        onTranscript={(txt) => {
                                          const currentTxt = consultantReviewTexts[c.id] !== undefined ? consultantReviewTexts[c.id] : (c.consultantReview?.reviewText || "");
                                          setConsultantReviewTexts(prev => ({ ...prev, [c.id]: (currentTxt ? currentTxt + " " : "") + txt }));
                                        }}
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
                                
                                {onDeleteCase && isPlatformAdmin && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 mt-4">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setCaseToDelete({ id: c.id, name: c.patient.name });
                                      }}
                                      className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:text-rose-400 rounded-lg text-xs font-bold transition-all border border-rose-100 dark:border-rose-900/30"
                                    >
                                      <Trash2 className="w-4 h-4" /> Delete Case Record
                                    </button>
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

        {/* 6. Compact HOD Operations Overview (HOD Clinicians Only) */}
        {profile.role.toLowerCase().includes("hod") && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-xs text-slate-800 dark:text-white no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  👑
                </div>
                <div>
                  <h3 className="text-sm font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2">
                    HOD Operations Overview
                    <span className="text-[9px] font-mono font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 uppercase">
                      Leadership
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Real-time department oversight • {profile.hospital || "Emergency Department"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onNavigateToTab("team")}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Manage team clinicians, roster, and invitations"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Open Team</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab("analytics")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="View department turnaround, census, and metrics"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>View Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMortalityModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Open Mortality & Morbidity Audit Engine"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>M&M Audit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab("roster")}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Duty Rota Board & Google Calendar Sync"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Duty Rota</span>
                </button>
              </div>
            </div>

            {/* 4 Compact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              <div 
                onClick={() => onNavigateToTab("team")}
                className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Pending Approvals
                  </span>
                  {pendingMembers.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {pendingMembers.length}
                  </span>
                  <span className="text-[10px] text-slate-400">clinicians</span>
                </div>
              </div>

              <div 
                onClick={() => onNavigateToTab("roster")}
                className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    On Duty Now
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {activeShiftDoctors.length}
                  </span>
                  <span className="text-[10px] text-slate-400">doctors active</span>
                </div>
              </div>

              <div 
                onClick={() => onNavigateToTab("handover")}
                className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Pending Handovers
                  </span>
                  {handovers.filter(h => !h.acknowledgedBy).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {handovers.filter(h => !h.acknowledgedBy).length}
                  </span>
                  <span className="text-[10px] text-slate-400">unacknowledged</span>
                </div>
              </div>

              <div 
                onClick={() => setIsMortalityModalOpen(true)}
                className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    M&M Review Queue
                  </span>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {cases.filter(c => c.dispositionDetails?.dispositionType === "Death" || c.dispositionAndPlan?.dispositionStatus?.toLowerCase().includes("death") || c.dispositionAndPlan?.dispositionStatus?.toLowerCase().includes("mortality")).length}
                  </span>
                  <span className="text-[10px] text-slate-400">cases queued</span>
                </div>
              </div>
            </div>

            {/* Direct Links to Canonical Hubs */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateToTab("team")}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3 h-3 text-indigo-500" />
                  <span>Onboard & Invite Clinicians →</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onNavigateToTab("more")}
                  className="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Building className="w-3 h-3 text-purple-500" />
                  <span>Hospital & ER Setup →</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400">Canonical management in Team & More</span>
            </div>
          </div>
        )}

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
                        {clinicianCases.map((c, idx) => {
                          const isActive = c.status === "Active" || c.status === "Triage";
                          const isSelected = selectedClinicianCaseIds.includes(c.id);
                          return (
                            <div
                              key={`${c.id}-${idx}`}
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
                                      {c.patient.uhid || `ID: ${c.displayId || c.id}`}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] uppercase font-black font-mono px-1.5 py-0.2 rounded border ${
                                    String(c.patient.triageCategory || "").includes("P1")
                                      ? "bg-rose-50 border-rose-200 text-rose-700"
                                      : String(c.patient.triageCategory || "").includes("P2")
                                      ? "bg-amber-50 border-amber-250 text-amber-700"
                                      : "bg-emerald-50 border-emerald-250 text-emerald-700"
                                  }`}>
                                    {String(c.patient.triageCategory || "P2").split(" ")[0] || "P3"}
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
                              text += `   Airway Status: ${c.primaryAssessment?.airwayStatus || "Not documented"}\n`;
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
                          <div key={`${c.id}-${idx}`} className="border-b border-slate-100 dark:border-slate-850 pb-2.5">
                            <p className="font-extrabold text-slate-800 dark:text-white text-[10.5px]">#{idx + 1} Patient: {c.patient.name}</p>
                            <p className="mt-1"><strong className="text-blue-700 dark:text-blue-400 font-bold">[S] Situation:</strong> Presents with {c.patient.presentingComplaint}</p>
                            <p><strong className="text-purple-700 dark:text-purple-400 font-bold">[B] Background:</strong> {c.sampleHistory?.pastHistory || "Nil past history documented."}</p>
                            <p><strong className="text-amber-700 dark:text-amber-400 font-bold">[A] Assessment:</strong> Vitals: HR {c.vitals?.hr || "N/A"}, BP {c.vitals?.bp || "N/A"}, SpO2 {c.vitals?.spo2 || "N/A"}%. Airway: {c.primaryAssessment?.airwayStatus || "Not documented"}</p>
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
                            doctorName: profile.name,
                            currentAssigneeEmail: profile.email,
                            currentAssigneeName: profile.name,
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

      {/* Head of Department (HOD) Details Modal */}
      {showHODModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider font-mono">
                    Department Leadership (HOD)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">Hospital Clinical Authority</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHODModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-500/25 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                  Head of Department (HOD)
                </span>
                <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                  Verified Leadership
                </span>
              </div>

              <div>
                <strong className="text-base font-extrabold text-slate-900 dark:text-white block">
                  {hodDisplayName}
                </strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                  {hodEmail}
                </span>
              </div>

              <div className="border-t border-amber-500/20 pt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Facility / ER Dept</span>
                  <strong className="text-slate-700 dark:text-slate-200 block truncate">{profile.hospital || "General ED"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Shift Oversight</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 block uppercase">{departmentHODMember?.shift || "Active Duty"}</strong>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              All resident registrations, duty shift changes, and role elevations within <strong className="text-slate-700 dark:text-slate-300">{profile.hospital || "General ED"}</strong> are supervised and approved by your Head of Department.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowHODModal(false);
                  onNavigateToTab("roster");
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>View Full Team Roster</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Bed Assignment Modal */}
      {assigningBedCase && onAssignBed && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Assign ER Bed
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {assigningBedCase.patient.name} ({assigningBedCase.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssigningBedCase(null);
                  setAssignBedError(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bed Number / Slot
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. 11, 11A, or Bed 10B"
                value={bedInputValue}
                onChange={(e) => {
                  setBedInputValue(e.target.value);
                  setAssignBedError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmAssignBed();
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Entering a bare bed (e.g. <span className="font-mono font-semibold">11</span>) allocates slot <span className="font-mono font-semibold">11A</span> or <span className="font-mono font-semibold">11B</span> automatically based on ER occupancy.
              </p>
              {assignBedError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-400 text-xs font-medium flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{assignBedError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAssigningBedCase(null);
                  setAssignBedError(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigningBed || !bedInputValue.trim()}
                onClick={handleConfirmAssignBed}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isAssigningBed ? "Assigning..." : "Confirm Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Case Modal */}
      <ConfirmModal
        isOpen={!!caseToDelete}
        title="Delete Case"
        message={
          <>
            Are you sure you want to delete the case for <strong className="text-slate-900 dark:text-white">{caseToDelete?.name}</strong>? This action cannot be undone.
          </>
        }
        confirmText="Delete Case"
        onConfirm={() => {
          if (caseToDelete && onDeleteCase) onDeleteCase(caseToDelete.id);
          setCaseToDelete(null);
        }}
        onCancel={() => setCaseToDelete(null)}
      />

      {/* Delete All Cases Modal */}
      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        title="Delete All Cases"
        message="Are you sure you want to delete ALL cases in ErMate? This action cannot be undone."
        confirmText="Delete All"
        onConfirm={() => {
          if (onDeleteAllCases) onDeleteAllCases();
          setShowDeleteAllConfirm(false);
        }}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />
    </div>
  );
}
