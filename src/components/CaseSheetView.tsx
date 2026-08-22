import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Save, Sparkles, Mic, FileText, CheckCircle, CheckCircle2,
  Trash2, Plus, ShieldAlert, BookOpen, Clock, Heart, Baby,
  Eye, RefreshCw, Printer, AlertTriangle, ClipboardCheck, 
  User, Check, Shield, FileCheck, Users, LogOut, ChevronRight,
  Copy, Download, ChevronDown, TrendingUp, PlusCircle, Activity, Edit3,
  Brain, Send, Award, MoreHorizontal, Pill, MessageSquare, HelpCircle, Info, Lightbulb, X, Skull,
  BookmarkCheck
} from "lucide-react";
import { 
  ClinicalCase, PatientVitals, SampleHistory, PrimaryAssessment, PrimarySurvey, getInitialPrimarySurvey,
  TreatmentItem, InvestigationItem, DifferentialDiagnosis, TriageCategory, ArrivalMode,
  IpsgChecklist, VulnerableAssessment, ConsentTimeOut, DispositionDetails, MlcDetails, VitalsRecord,
  UserProfile, PediatricDetails, DischargeInfo
} from "../types";
import { 
  PediatricAirwaySection,
  PediatricBreathingSection,
  PediatricCirculationSection,
  PediatricDisabilitySection,
  PediatricExposureSection,
  PediatricFocusedPhysicalExam,
  PediatricGeneralExamSection,
  PediatricQuickNormalPresets,
  PEDIATRIC_NORMAL_PRESETS,
  PediatricDispositionSection
} from "./PediatricABCDESections";
import { PrimarySurveySection, IsolatedPrimarySurveyAdjuncts } from "./PrimarySurveySection";
import { PediatricAssessmentTriangle } from "./PediatricCaseSheetFields";
import { SecondarySurveySection } from "./SecondarySurveySection";
import { triggerPrintWithTip } from "../utils/printWithTip";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import VoiceRecorder from "./shared/VoiceRecorder";
import { getCasePendingStatus } from "../utils/caseHelper";
import { classifyEmergencyTriage } from "../utils/triageClassifier";
import { formatTemperature, formatDoctorName, deduplicateMeds, validateMedRoute, formatDisabilityAssessment } from "../utils/clinicalFormatter";
import { isTriageCategoryPending } from "./NewPatientEntryMenu";

export function parseSecondaryAssessment(text: string) {
  if (!text) return { General: "", CVS: "", RS: "", PA: "", CNS: "", Extremities: "" };
  const fields = { General: "", CVS: "", RS: "", PA: "", CNS: "", Extremities: "" };
  
  // Find the first occurrence of a section header
  const firstHeaderMatch = text.match(/(General|CVS|RS|PA|CNS|Extremities)\s*:/i);
  
  if (firstHeaderMatch) {
    const preamble = text.substring(0, firstHeaderMatch.index).trim();
    if (preamble) {
      fields.General = preamble;
    }
  } else if (text.trim()) {
    // If no headers at all, dump everything into General
    fields.General = text.trim();
  }

  const regex = /(General|CVS|RS|PA|CNS|Extremities)\s*:\s*(.*?)(?=(General|CVS|RS|PA|CNS|Extremities)\s*:|$)/igs;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = Object.keys(fields).find(k => k.toLowerCase() === match[1].toLowerCase());
    if (key) { 
      // Append if already has something (e.g., from preamble)
      fields[key as keyof typeof fields] = fields[key as keyof typeof fields] 
        ? fields[key as keyof typeof fields] + "\n" + match[2].trim()
        : match[2].trim();
    }
  }
  
  return fields;
}

function mergeUnique(existing: string[] | undefined, incoming: string[] | undefined): string[] {
  const base = existing || [];
  const additions = incoming || [];
  const combined = [...base];
  for (const item of additions) {
    if (item && !combined.includes(item)) {
      combined.push(item);
    }
  }
  return combined;
}

export function MarkTabNormalButton({
  tabLabel,
  isActive,
  onMarkNormal,
}: {
  tabLabel: string;
  isActive: boolean;
  onMarkNormal: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onMarkNormal}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
        isActive
          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
          : "bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
      }`}
      title={`Pre-fill normal findings for ${tabLabel} only`}
    >
      <CheckCircle className={`w-3.5 h-3.5 ${isActive ? "text-white animate-pulse" : "text-emerald-500"}`} />
      {isActive ? "Normal Active" : "Mark as Normal"}
    </button>
  );
}

interface CaseSheetViewProps {
  initialCase: ClinicalCase;
  allCases?: ClinicalCase[];
  onSelectCase?: (caseId: string) => void;
  onViewPrintSheet?: (caseId: string) => void;
  onBack: () => void;
  onSaveCase: (updatedCase: ClinicalCase) => void;
  onNavigateToDischarge: (caseId: string) => void;
  onStartNewTriage?: () => void;
  profile?: UserProfile;
  onSaveProfile?: (updated: UserProfile) => void;
  onReturnToScribe?: () => void;
  hasActiveScribeSession?: boolean;
  onDiscussCase?: (patientCase: ClinicalCase) => void;
  onDeleteCase?: (caseId: string) => void;
}



export function SaveSectionButton({ onSave }: { onSave: () => void }) {
  return (
    <button
      type="button"
      onClick={onSave}
      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
    >
      <Save className="w-3.5 h-3.5" />
      <span>Save Changes</span>
    </button>
  );
}

import { recomputeIsPediatric } from "./NewPatientEntryMenu";

export default function CaseSheetView({ 
  initialCase, 
  allCases,
  onSelectCase,
  onViewPrintSheet,
  onBack, 
  onSaveCase,
  onNavigateToDischarge,
  onStartNewTriage,
  profile,
  onSaveProfile,
  onReturnToScribe,
  hasActiveScribeSession,
  onDiscussCase
}: CaseSheetViewProps) {
  const [activeTab, setActiveTab] = useState<
    "triage" | "complaints" | "primary-survey" | "history" | "secondary-survey" | "investigations" | "trends" | "treatment" | "notes" | "disposition" | "rounds"
  >("triage");

  // Clinical Rounds & 7-Lens Debrief States
  const [roundsLens, setRoundsLens] = useState<
    "first-principles" | "devils-advocate" | "pathophysiology" | "rare-but-real" | "guidelines" | "disease-snapshot" | "full-debrief" | "cause-of-death"
  >("first-principles");
  const [roundsContent, setRoundsContent] = useState<string>("");
  const [roundsLoading, setRoundsLoading] = useState<boolean>(false);
  const [roundsKeyTakeaway, setRoundsKeyTakeaway] = useState<string>("");
  const [roundsMemoryKey, setRoundsMemoryKey] = useState<string>("");
  const [roundsSuggestedQuestions, setRoundsSuggestedQuestions] = useState<string[]>([]);
  const [roundsChatHistory, setRoundsChatHistory] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [roundsUserMessage, setRoundsUserMessage] = useState<string>("");
  const [roundsChatLoading, setRoundsChatLoading] = useState<boolean>(false);
  const [showRoundsMoreMenu, setShowRoundsMoreMenu] = useState(false);
  const roundsMoreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roundsMoreMenuRef.current && !roundsMoreMenuRef.current.contains(event.target as Node)) {
        setShowRoundsMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roundsTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand rounds chat textarea
  useEffect(() => {
    const textarea = roundsTextareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
    }
  }, [roundsUserMessage]);
  const [roundsSavedToMemory, setRoundsSavedToMemory] = useState<boolean>(false);
  const [roundsReflections, setRoundsReflections] = useState<string>("");
  const [showPostSaveModal, setShowPostSaveModal] = useState<boolean>(false);

  const [currentCase, setCurrentCase] = useState<ClinicalCase>(initialCase);
  const displayHospitalName = (currentCase.hospital || profile?.hospital || "Emergency Hospital & Trauma Center").toUpperCase();
  const displayHospitalAddress = profile?.hospitalAddress 
    ? `${profile.hospitalAddress}${profile?.state ? `, ${profile.state}` : ''}`
    : (profile?.state ? `Department of Emergency Medicine, ${profile.state}` : "Department of Emergency Medicine & Trauma Center");
  const [isEditingDemographics, setIsEditingDemographics] = useState(false);
  const [caseSwitcherOpen, setCaseSwitcherOpen] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ show: boolean; minutesSaved: number } | null>(null);
  const [normalMarkedBanner, setNormalMarkedBanner] = useState<boolean>(false);
  const [isNormalToggled, setIsNormalToggled] = useState<boolean>(false);
  const [backupCase, setBackupCase] = useState<ClinicalCase | null>(null);

  // New features: PDF Preview Modal, Disposition Save feedback, Rounds Instructions
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [dispositionSaveMessage, setDispositionSaveMessage] = useState<string | null>(null);
  const [showRoundsGuide, setShowRoundsGuide] = useState<boolean>(true);

  // States for logging new vitals to trend timeline
  const [logTime, setLogTime] = useState("");
  const [logHr, setLogHr] = useState("");
  const [logBp, setLogBp] = useState("");
  const [logSpo2, setLogSpo2] = useState("");
  const [logRr, setLogRr] = useState("");
  const [logTemp, setLogTemp] = useState("");

  useEffect(() => {
    if (activeTab === "trends") {
      const now = new Date();
      setLogTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setLogHr(currentCase.vitals.hr || "");
      setLogBp(currentCase.vitals.bp || "");
      setLogSpo2(currentCase.vitals.spo2 || "");
      setLogRr(currentCase.vitals.rr || "");
      setLogTemp(currentCase.vitals.temp || "");
    }
  }, [activeTab, currentCase.vitals]);

  const getVitalsHistoryData = (): VitalsRecord[] => {
    if (currentCase.vitalsHistory && currentCase.vitalsHistory.length > 0) {
      return currentCase.vitalsHistory;
    }
    
    // Auto-generate realistic vital history leading to current values
    const currentHr = parseInt(currentCase.vitals.hr) || 80;
    const currentBp = currentCase.vitals.bp || "120/80";
    const parts = currentBp.split("/");
    const currentSys = parseInt(parts[0]) || 120;
    const currentDia = parseInt(parts[1]) || 80;
    const currentSpo2 = parseInt(currentCase.vitals.spo2) || 98;
    const currentRr = parseInt(currentCase.vitals.rr) || 16;
    const currentTemp = parseFloat(currentCase.vitals.temp) || 98.6;

    const points: VitalsRecord[] = [];
    const count = 4;
    
    const isP1 = String(currentCase.patient.triageCategory || "").includes("P1");
    
    for (let i = count - 1; i >= 0; i--) {
      if (i === 0) {
        points.push({
          timestamp: "Now",
          bp: currentBp,
          systolic: currentSys,
          diastolic: currentDia,
          hr: currentHr,
          spo2: currentSpo2,
          rr: currentRr,
          temp: currentTemp
        });
      } else {
        const factor = i / count;
        let hrVar = 0;
        let sysVar = 0;
        let diaVar = 0;
        let spo2Var = 0;
        let tempVar = 0;
        let rrVar = 0;

        if (isP1) {
          hrVar = Math.round(15 * factor);
          sysVar = Math.round(25 * factor);
          diaVar = Math.round(15 * factor);
          spo2Var = -Math.round(5 * factor);
          rrVar = Math.round(6 * factor);
        } else if (currentTemp > 101.3) {
          tempVar = parseFloat((2.2 * factor).toFixed(1));
          hrVar = Math.round(20 * factor);
          rrVar = Math.round(8 * factor);
        } else {
          hrVar = Math.round((Math.sin(i) * 8));
          sysVar = Math.round((Math.cos(i) * 10));
          diaVar = Math.round((Math.sin(i) * 5));
          spo2Var = Math.round((Math.sin(i) * 1));
          tempVar = parseFloat((Math.sin(i) * 0.4).toFixed(1));
          rrVar = Math.round((Math.sin(i) * 2));
        }

        const hr = Math.max(40, currentHr + hrVar);
        const systolic = Math.max(70, currentSys + sysVar);
        const diastolic = Math.max(40, currentDia + diaVar);
        const spo2 = Math.min(100, Math.max(70, currentSpo2 + spo2Var));
        const temp = parseFloat(Math.min(42, Math.max(35, currentTemp + tempVar)).toFixed(1));
        const rr = Math.max(8, currentRr + rrVar);

        const now = new Date();
        now.setMinutes(now.getMinutes() - (i * 30));
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        points.push({
          timestamp: timeStr,
          bp: `${systolic}/${diastolic}`,
          systolic,
          diastolic,
          hr,
          spo2,
          rr,
          temp
        });
      }
    }
    return points;
  };

  const handleLogVitalsTrend = () => {
    const bpParts = logBp.split("/");
    const sys = parseInt(bpParts[0]) || 120;
    const dia = parseInt(bpParts[1]) || 80;
    
    const hrVal = parseInt(logHr) || 80;
    const spo2Val = parseInt(logSpo2) || 98;
    const rrVal = parseInt(logRr) || 16;
    const tempVal = parseFloat(logTemp) || 98.6;

    const newRecord: VitalsRecord = {
      timestamp: logTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bp: logBp,
      systolic: sys,
      diastolic: dia,
      hr: hrVal,
      spo2: spo2Val,
      rr: rrVal,
      temp: tempVal
    };

    const existingHistory = currentCase.vitalsHistory && currentCase.vitalsHistory.length > 0 
      ? currentCase.vitalsHistory 
      : getVitalsHistoryData();
      
    // Replace "Now" text with actual previous time if we append
    const updatedHistory = existingHistory.map(pt => 
      pt.timestamp === "Now" 
        ? { ...pt, timestamp: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } 
        : pt
    ).concat(newRecord);

    const updatedVitals: PatientVitals = {
      ...currentCase.vitals,
      hr: logHr,
      bp: logBp,
      spo2: logSpo2,
      rr: logRr,
      temp: logTemp
    };
    
    const triageResult = classifyEmergencyTriage(currentCase.patient.age, currentCase.patient.presentingComplaint, updatedVitals);

    const updatedCase: ClinicalCase = {
      ...currentCase,
      vitals: updatedVitals,
      patient: {
        ...currentCase.patient,
        triageCategory: triageResult.category
      },
      vitalsHistory: updatedHistory
    };
    
    setCurrentCase(updatedCase);
    onSaveCase(updatedCase);
  };

  const [pediatricWeight, setPediatricWeight] = useState<number | "">("");
  const getAPLSEstimate = (ageNum: number | null) => {
    if (ageNum === null) return 15;
    if (ageNum < 1) return 7;
    if (ageNum >= 1 && ageNum <= 5) return (ageNum * 2) + 8;
    if (ageNum > 5 && ageNum <= 12) return (ageNum * 3) + 7;
    return (ageNum * 3) + 10;
  };

  useEffect(() => {
    setCurrentCase(initialCase);
    setIsNormalToggled(false);
    setActiveTab("complaints");
    setPediatricWeight("");

    // Sync rounds and discussion chat history
    if (initialCase.discussionMessages && Array.isArray(initialCase.discussionMessages) && initialCase.discussionMessages.length > 0) {
      const converted = initialCase.discussionMessages.map((m: any) => ({
        role: m.sender === "ai" ? ("model" as const) : ("user" as const),
        text: m.text
      }));
      setRoundsChatHistory(converted);
    } else {
      setRoundsChatHistory([]);
    }
  }, [initialCase.id]);

  const getPalsNormalParameters = (age: number | null) => {
    const a = age === null ? 6 : age;
    let weight = 20;
    let hr = "90";
    let rr = "22";
    let bp = "105/70";
    let gcs = "15";
    let comment = "";

    if (a < 1) {
      weight = 7;
      hr = "130"; 
      rr = "35";  
      bp = "80/50";
      gcs = "15";
      comment = "Infant normal ranges. Airway is patent, chest expansion symmetrical, GCS 15 (infant scale).";
    } else if (a >= 1 && a <= 3) {
      weight = Math.round((a * 2) + 8);
      hr = "110"; 
      rr = "28";  
      bp = "90/55";
      gcs = "15";
      comment = "Toddler normal ranges. Capillary refill < 2s, chest clear, GCS 15 (toddler scale).";
    } else if (a > 3 && a <= 5) {
      weight = Math.round((a * 2) + 8);
      hr = "100"; 
      rr = "24";  
      bp = "95/60";
      gcs = "15";
      comment = "Preschooler normal ranges. Clear vesicular breath sounds, warm peripheries, GCS 15.";
    } else if (a > 5 && a <= 12) {
      weight = Math.round((a * 3) + 7);
      hr = "85";  
      rr = "18";  
      bp = "105/70";
      gcs = "15";
      comment = "School-age normal ranges. Airway patent, normal respiratory effort, warm peripheries, GCS 15.";
    } else {
      weight = Math.round((a * 3) + 10);
      hr = "75";  
      rr = "16";  
      bp = "115/75";
      gcs = "15";
      comment = "Adolescent normal ranges. Speaking in full sentences, chest clear, peripheries warm, GCS 15.";
    }

    const adrenalineDoseMg = (0.01 * weight).toFixed(2);
    const adrenalineDoseMl = (0.1 * weight).toFixed(1);
    const amiodaroneDoseMg = (5 * weight).toFixed(0);
    const fluidBolusMl = (20 * weight).toFixed(0);
    const atropineDoseMg = Math.max(0.1, 0.02 * weight).toFixed(2);

    return {
      weight,
      hr,
      rr,
      bp,
      gcs,
      comment,
      dosages: {
        adrenalineMg: `${adrenalineDoseMg} mg`,
        adrenalineMl: `${adrenalineDoseMl} mL (1:10k)`,
        amiodaroneMg: `${amiodaroneDoseMg} mg`,
        fluidBolusMl: `${fluidBolusMl} mL`,
        atropineMg: `${atropineDoseMg} mg`
      }
    };
  };

  const handleMarkAsNormal = async () => {
    if (isNormalToggled) {
      if (backupCase) {
        setCurrentCase(backupCase);
        setIsNormalToggled(false);
        await syncDischargeSummary(backupCase);
      }
    } else {
      setBackupCase(JSON.parse(JSON.stringify(currentCase)));
      
      const age = currentCase.patient.age;
      const isTrauma = currentCase.patient.caseType === "Trauma";
      let normalCase: ClinicalCase;
      
      if (currentCase.isPediatric) {
        const params = getPalsNormalParameters(age);
        setPediatricWeight(params.weight);
        
        normalCase = {
          ...currentCase,
          vitals: {
            bp: params.bp,
            hr: params.hr,
            spo2: "99",
            rr: params.rr,
            temp: "98.1",
            gcs: "15",
            gcs_e: "4",
            gcs_v: "5",
            gcs_m: "6",
            grbs: "95",
            avpu: "Alert",
            painScore: "0"
          },
          sampleHistory: {
            ...currentCase.sampleHistory,
            symptoms: "Asymptomatic. Parents deny active distress, feeding well, playful baseline.",
            allergies: currentCase.sampleHistory.allergies || "NKDA (No Known Drug Allergies)",
            medications: currentCase.sampleHistory.medications || "None",
            pastHistory: currentCase.sampleHistory.pastHistory || "No significant pediatric medical or surgical history.",
            lastMeal: "Light oral fluids and snack approx 2.5 hours ago, tolerated well without vomiting.",
            events: isTrauma 
              ? "Minor mechanical fall from standing height onto carpet. No loss of consciousness, no vomiting, no active crying." 
              : "",
            socialHistory: "Lives with parents, active child with reassuring milestones.",
            familyHistory: "Unremarkable. No family history of premature CAD or hereditary diseases.",
            psychiatricFlags: "No behavioral or interaction flags. Excellent parental bonding."
          },
          primaryAssessment: {
            airway: isTrauma 
              ? "Patent and self-maintained. Cervical spine collar applied and secure. No stridor or secretions."
              : "Patent and self-maintained. Speaking and babbling happily, no stridor, no drooling.",
            airwayStatus: "Normal",
            breathing: `Symmetrical chest rise, normal work of breathing, respiratory rate ${params.rr}/min. Vesicular breath sounds. No retractions or grunting.`,
            breathingStatus: "Normal",
            circulation: `Peripheries warm and pink, capillary refill < 2s. Heart rate ${params.hr} bpm, pulses strong and regular. No active external hemorrhage.`,
            circulationStatus: "Normal",
            disability: "Alert, active, tracking objects. Pupils equal, round, and reactive. GCS 15 (E4V5M6), normal motor tone.",
            disabilityStatus: "Normal",
            exposure: isTrauma
              ? "Fully exposed. Log roll completed with spine precautions: no midline spinal tenderness, no visible ecchymosis, deformities, or active wounds."
              : "Fully exposed. No visible rashes, petechiae, or injuries. Soft, non-tender abdomen, warm skin.",
            exposureStatus: "Normal"
          },
          secondaryAssessment: `Secondary Pediatric Survey (Weight: ${params.weight} kg, Case Type: ${currentCase.patient.caseType}):\nHEENT: Normocephalic, no skull depression. Pupils equal and reactive. Tympanic membranes clear, throat normal.\nNeck: Supple, no midline cervical tenderness, normal range of motion.\nCardiovascular: S1 S2 heard clearly, regular rhythm, no murmurs. Pulses strong.\nRespiratory: Lungs clear, normal air entry bilaterally, no work of breathing or retractions.\nAbdomen: Soft, non-distended, active bowel sounds, no guarding.\nGenitourinary: Normal external anatomy, no diaper rash.\nMusculoskeletal: Normal bulk and tone, no deformities, extremity movements active and symmetrical.\nNeurological: Normal age-appropriate reflexes, alert and cooperative, GCS 15.`,
          progressNotes: `Patient evaluated and found clinically stable. Pediatric vitals and physical exam parameters are completely normal for age based on PALS criteria. Recommended for discharge with standard parental safe-return instructions.`,
          ipsgChecklist: {
            ipsg1IdentifiersVerified: true,
            ipsg2ReadBackPerformed: true,
            ipsg3HighAlertDoubleChecked: true,
            ipsg4TimeOutPerformed: false,
            ipsg5HandHygieneComplied: true,
            ipsg6FallRiskAssessed: "Low"
          },
          vulnerableAssessment: {
            isVulnerable: true,
            vulnerableType: "Pediatric",
            nutritionalScreenPassed: true,
            functionalAssessmentScore: "Assisted",
            abuseScreenNegative: true
          }
        };
      } else {
        // Adult Mark as Normal
        normalCase = {
          ...currentCase,
          vitals: {
            bp: "120/80",
            hr: "72",
            spo2: "98",
            rr: "16",
            temp: "98.2",
            gcs: "15",
            gcs_e: "4",
            gcs_v: "5",
            gcs_m: "6",
            grbs: "100",
            avpu: "Alert",
            painScore: "0"
          },
          sampleHistory: {
            ...currentCase.sampleHistory,
            symptoms: "Asymptomatic. Patient describes feeling completely back to baseline.",
            allergies: currentCase.sampleHistory.allergies || "NKDA (No Known Drug Allergies)",
            medications: currentCase.sampleHistory.medications || "None",
            pastHistory: currentCase.sampleHistory.pastHistory || "No significant medical or surgical history.",
            lastMeal: "Light lunch approx 3 hours ago, tolerated well without nausea.",
            events: isTrauma
              ? "Slipped on flat ground. No head injury, no loss of consciousness, no neck pain, ambulating normally."
              : "Presented for routine baseline screening and standard clinical clearance.",
            socialHistory: "Non-smoker, rare social alcohol use, lives at home, active lifestyle.",
            familyHistory: "No history of premature coronary artery disease or sudden cardiac death.",
            psychiatricFlags: "No active cognitive, psychiatric, or psychological flags."
          },
          primaryAssessment: {
            airway: isTrauma
              ? "Patent and self-maintained. Cervical spine collar in-situ and secure, no stridor, no secretions, airway clear."
              : "Patent and self-maintained. Speaking clearly in full sentences without stridor, hoarseness, or voice changes.",
            airwayStatus: "Normal",
            breathing: "Symmetrical chest expansion, equal bilateral air entry, vesicular breath sounds. No wheezing, crackles, or accessory muscle use. RR 16/min.",
            breathingStatus: "Normal",
            circulation: "Peripheries warm, capillary refill < 2s. Radial pulses strong and regular. No active external hemorrhage, blood pressure stable.",
            circulationStatus: "Normal",
            disability: "Pupils equal, round, and reactive to light (PEARLA). Alert, oriented x3. Moving all four limbs with 5/5 strength. GCS 15 (E4V5M6).",
            disabilityStatus: "Normal",
            exposure: isTrauma
              ? "Exposed fully. Log roll completed under spine precautions: no spine tenderness, no step-off. Pelvis stable. No visible lacerations, bruising, or fractures."
              : "Fully exposed. No visible rashes, bruises, wounds or deformities. Soft non-tender abdomen, body temperature stable.",
            exposureStatus: "Normal"
          },
          secondaryAssessment: `Secondary Head-to-Toe Survey (Case Type: ${currentCase.patient.caseType}):\nHEENT: Normocephalic, pupils equal and reactive. Oral mucosa moist, throat clear.\nNeck: Supple, no thyroid enlargement, no cervical spine tenderness.\nCardiovascular: S1 S2 heard clearly, regular rhythm, no murmurs. HR is 72 bpm, peripheral pulses intact.\nRespiratory: Lungs clear to auscultation bilaterally, normal breath sounds. RR 16/min.\nAbdomen: Soft, non-distended, non-tender, active bowel sounds. No guarding or rebound.\nMusculoskeletal: Full range of motion in all joints, no swelling, distal perfusion intact.\nNeurological: Cranial nerves II-XII intact, sensation normal, motor strength 5/5 throughout. GCS 15.`,
          progressNotes: "Patient evaluated and found completely stable. Normal vital signs, patent airway, clear chest, and benign physical examination. All safety criteria met. Safe for discharge.",
          ipsgChecklist: {
            ipsg1IdentifiersVerified: true,
            ipsg2ReadBackPerformed: true,
            ipsg3HighAlertDoubleChecked: true,
            ipsg4TimeOutPerformed: false,
            ipsg5HandHygieneComplied: true,
            ipsg6FallRiskAssessed: "Low"
          },
          vulnerableAssessment: {
            isVulnerable: false,
            vulnerableType: "",
            nutritionalScreenPassed: true,
            functionalAssessmentScore: "Independent",
            abuseScreenNegative: true
          }
        };
      }
      setCurrentCase(normalCase);
      setIsNormalToggled(true);
      setNormalMarkedBanner(true);
      setTimeout(() => {
        setNormalMarkedBanner(false);
      }, 4000);

      // Auto-update discharge summary in background
      await syncDischargeSummary(normalCase);
    }
  };

  // AI states
  const [isDictating, setIsDictating] = useState(false);
  const [smartDictationText, setSmartDictationText] = useState("");
  const [showDictationModal, setShowDictationModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dictationSuccess, setDictationSuccess] = useState<boolean>(false);

  // Indian Languages Multilingual Dictation States
  const [dictationLang, setDictationLang] = useState("en-IN");
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = React.useRef<any>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const isListeningActiveRef = React.useRef(false);
  const timerRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      // Clean up speech recognition, media recorder, and timer on unmount
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    // Universal MediaRecorder Pipeline (ErMate STT primary via /api/voice/transcribe)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const supportedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", "audio/wav"];
      const mimeType = supportedTypes.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const actualMime = recorder.mimeType || mimeType;
        const ext = actualMime.includes("mp4") ? "mp4" : actualMime.includes("ogg") ? "ogg" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

        setIsListening(false);
        isListeningActiveRef.current = false;
        setIsDictating(false);

        if (audioBlob.size > 500) {
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, `dictation.${ext}`);
            formData.append("language_code", dictationLang);

            const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success && data.transcript) {
              setSmartDictationText(prev => prev ? (prev.trim() + " " + data.transcript.trim()) : data.transcript.trim());
            }
          } catch (e) {
            console.error("Server transcription error:", e);
          }
        }
      };

      setRecordingSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      recorder.start();
      setIsListening(true);
      isListeningActiveRef.current = true;
      setIsDictating(true);
    } catch (micErr) {
      console.error("Microphone access failed:", micErr);
      alert("Could not access microphone. Please check browser microphone permissions.");
      setIsListening(false);
      isListeningActiveRef.current = false;
      setIsDictating(false);
    }
  };

  const stopRecording = () => {
    isListeningActiveRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsListening(false);
    setIsDictating(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Automated JCI/NABH Discharge Summary Sync status
  const [dischargeSyncStatus, setDischargeSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("synced");

  const syncDischargeSummary = async (caseToSync: ClinicalCase) => {
    // GATE: never generate a discharge summary before disposition is set.
    // Without this, every save/dictation/normal-toggle generates a
    // discharge summary for patients who just arrived — wasted API
    // calls, premature data, and PHI sent to the AI model before there
    // is any legitimate reason to.
    const hasDisposition = Boolean(
      caseToSync.dispositionDetails?.dispositionType ||
      caseToSync.dispositionAndPlan?.dispositionStatus ||
      caseToSync.dischargeInfo?.dispositionStatus
    );
    if (!hasDisposition) {
      console.log("[syncDischargeSummary] Skipped — disposition not yet set.");
      setDischargeSyncStatus("idle");
      return caseToSync;
    }

    setDischargeSyncStatus("syncing");
    try {
      const response = await fetch("/api/ai-discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseData: caseToSync })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const existingDischarge: DischargeInfo = caseToSync.dischargeInfo || {
          primaryDiagnosis: "",
          secondaryDiagnosis: "",
          conditionAtDischarge: "",
          dischargeMedications: "",
          followUpPlan: "",
          patientInstructions: ""
        };
        const generated = {
          ...existingDischarge,
          primaryDiagnosis: existingDischarge.primaryDiagnosis || resData.data.primaryDiagnosis || caseToSync.provisionalPrimaryDiagnosis || caseToSync.patient.presentingComplaint || "",
          secondaryDiagnosis: existingDischarge.secondaryDiagnosis || resData.data.secondaryDiagnosis || caseToSync.sampleHistory?.pastHistory || "",
          conditionAtDischarge: existingDischarge.conditionAtDischarge || resData.data.conditionAtDischarge || "",
          dischargeMedications: existingDischarge.dischargeMedications || resData.data.dischargeMedications || (caseToSync.treatments && caseToSync.treatments.length > 0 ? caseToSync.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose || ""} (${t.route || ""}) - ${t.timeGiven || "Given in ER"}`).join("\n") : ""),
          followUpPlan: existingDischarge.followUpPlan || resData.data.followUpPlan || "",
          patientInstructions: existingDischarge.patientInstructions || resData.data.patientInstructions || "",
          courseInHospital: existingDischarge.courseInHospital || resData.data.courseInHospital || caseToSync.progressNotes || "",
          investigationsResults: existingDischarge.investigationsResults || (caseToSync.investigations && caseToSync.investigations.length > 0 ? caseToSync.investigations.map(i => `${i.testName}: ${i.result || "Done"}`).join("\n") : ""),
          presentingComplaints: existingDischarge.presentingComplaints || caseToSync.patient.presentingComplaint || "",
          historyOfPresentIllness: existingDischarge.historyOfPresentIllness || caseToSync.sampleHistory?.events || caseToSync.sampleHistory?.symptoms || "",
          pastMedicalHistory: existingDischarge.pastMedicalHistory || caseToSync.sampleHistory?.pastHistory || "",
          allergies: existingDischarge.allergies || caseToSync.sampleHistory?.allergies || "",
          arrivalHr: existingDischarge.arrivalHr || caseToSync.vitals.hr || "",
          arrivalBp: existingDischarge.arrivalBp || caseToSync.vitals.bp || "",
          arrivalRr: existingDischarge.arrivalRr || caseToSync.vitals.rr || "",
          arrivalSpo2: existingDischarge.arrivalSpo2 || caseToSync.vitals.spo2 || "",
          arrivalGcs: existingDischarge.arrivalGcs || caseToSync.vitals.gcs || "",
          arrivalTemp: existingDischarge.arrivalTemp || caseToSync.vitals.temp || "",
          arrivalGrbs: existingDischarge.arrivalGrbs || caseToSync.vitals.grbs || "",
          arrivalPainScore: existingDischarge.arrivalPainScore || caseToSync.vitals.painScore || "",
          dischargeHr: existingDischarge.dischargeHr || caseToSync.dispositionDetails?.dischargeVitals?.hr || "",
          dischargeBp: existingDischarge.dischargeBp || caseToSync.dispositionDetails?.dischargeVitals?.bp || "",
          dischargeRr: existingDischarge.dischargeRr || caseToSync.dispositionDetails?.dischargeVitals?.rr || "",
          dischargeSpo2: existingDischarge.dischargeSpo2 || caseToSync.dispositionDetails?.dischargeVitals?.spo2 || "",
          dischargeGcs: existingDischarge.dischargeGcs || caseToSync.dispositionDetails?.dischargeVitals?.gcs || "",
          emResidentName: existingDischarge.emResidentName || caseToSync.dispositionDetails?.residentName || "",
          emConsultantName: existingDischarge.emConsultantName || caseToSync.dispositionDetails?.consultantName || "",
          aiDrafted: true,
          aiGenerated: !resData.simulated
        };
        
        const finalizedCase = {
          ...caseToSync,
          dischargeInfo: generated
        };
        
        setCurrentCase(finalizedCase);
        onSaveCase(finalizedCase);
        setDischargeSyncStatus("synced");
        return finalizedCase;
      } else {
        setDischargeSyncStatus("error");
      }
    } catch (err) {
      console.error("Discharge sync error:", err);
      setDischargeSyncStatus("error");
    }
    return caseToSync;
  };

  // Scanning states
  const [ocrText, setOcrText] = useState("");
  const [showScanModal, setShowScanModal] = useState(false);

  // Add Treatment state
  const [newDrug, setNewDrug] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newRoute, setNewRoute] = useState("IV");

  // Add Investigation state
  const [newTest, setNewTest] = useState("");
  const [newResult, setNewResult] = useState("");

  // Add Infusion state
  const [newInfusionFluid, setNewInfusionFluid] = useState("");
  const [newInfusionDose, setNewInfusionDose] = useState("");
  const [newInfusionDilution, setNewInfusionDilution] = useState("");
  const [newInfusionRate, setNewInfusionRate] = useState("");

  const handleAddInfusion = () => {
    if (!newInfusionFluid.trim()) return;
    const item = {
      id: "inf-" + Date.now(),
      fluidName: newInfusionFluid,
      dose: newInfusionDose || "N/A",
      dilution: newInfusionDilution || "N/A",
      rate: newInfusionRate || "N/A"
    };
    setCurrentCase(prev => ({
      ...prev,
      infusions: [...(prev.infusions || []), item]
    }));
    setNewInfusionFluid("");
    setNewInfusionDose("");
    setNewInfusionDilution("");
    setNewInfusionRate("");
  };

  const handleDeleteInfusion = (id: string) => {
    setCurrentCase(prev => ({
      ...prev,
      infusions: (prev.infusions || []).filter(item => item.id !== id)
    }));
  };

  const updateVitals = (field: keyof PatientVitals, value: string) => {
    setCurrentCase(prev => {
      const updatedVitals = { ...prev.vitals, [field]: value };
      const triageResult = classifyEmergencyTriage(prev.patient.age, prev.patient.presentingComplaint, updatedVitals);
      return {
        ...prev,
        vitals: updatedVitals,
        patient: {
          ...prev.patient,
          triageCategory: triageResult.category
        }
      };
    });
  };

  const updateHistory = (field: keyof SampleHistory, value: string) => {
    setCurrentCase(prev => ({
      ...prev,
      sampleHistory: { ...prev.sampleHistory, [field]: value }
    }));
  };

  const updatePrimary = (field: keyof PrimaryAssessment, value: string) => {
    setCurrentCase(prev => ({
      ...prev,
      primaryAssessment: { ...prev.primaryAssessment, [field]: value }
    }));
  };

  const updatePrimaryStatus = (field: "airwayStatus" | "breathingStatus" | "circulationStatus" | "disabilityStatus" | "exposureStatus", value: "Normal" | "Abnormal") => {
    setCurrentCase(prev => ({
      ...prev,
      primaryAssessment: { ...prev.primaryAssessment, [field]: value }
    }));
  };

  const updatePediatricDetails = (field: keyof PediatricDetails, value: any) => {
    setCurrentCase(prev => ({
      ...prev,
      pediatricDetails: {
        ...(prev.pediatricDetails || {}),
        [field]: value
      }
    }));
  };

  const isVitalsAbnormal = (field: keyof PatientVitals, val: string) => {
    if (!val) return false;
    const num = parseFloat(val);
    if (isNaN(num)) return false;

    if (currentCase.isPediatric) {
      switch (field) {
        case "hr": return num < 70 || num > 120;
        case "rr": return num < 18 || num > 30;
        case "temp": return num < 96.8 || num > 100.0;
        case "spo2": return num < 94;
        default: return false;
      }
    } else {
      switch (field) {
        case "hr": return num < 60 || num > 100;
        case "rr": return num < 12 || num > 20;
        case "temp": return num < 96.8 || num > 99.5;
        case "spo2": return num < 94;
        default: return false;
      }
    }
  };

  // Add Treatment Log
  const handleAddTreatment = () => {
    if (!newDrug.trim()) return;
    const newItem: TreatmentItem = {
      id: "t-" + Date.now(),
      drugName: newDrug,
      dose: newDose || "N/A",
      route: newRoute,
      timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ipsgVerified: true
    };
    setCurrentCase(prev => ({
      ...prev,
      treatments: [...prev.treatments, newItem]
    }));
    setNewDrug("");
    setNewDose("");
  };

  const handleDeleteTreatment = (id: string) => {
    setCurrentCase(prev => ({
      ...prev,
      treatments: prev.treatments.filter(item => item.id !== id)
    }));
  };

  // Add Investigation Log
  const handleAddInvestigation = () => {
    if (!newTest.trim()) return;
    const newItem: InvestigationItem = {
      id: "i-" + Date.now(),
      testName: newTest,
      result: newResult || "Pending",
      orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resultTime: newResult ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pending"
    };
    setCurrentCase(prev => ({
      ...prev,
      investigations: [...prev.investigations, newItem]
    }));
    setNewTest("");
    setNewResult("");
  };

  const handleDeleteInvestigation = (id: string) => {
    setCurrentCase(prev => ({
      ...prev,
      investigations: prev.investigations.filter(item => item.id !== id)
    }));
  };

  const handleOrderPanel = (panelName: string) => {
    let tests: string[] = [];
    if (panelName === "ADULT SEIZURE PANEL") {
      tests = ["CBC", "CRP", "LFT", "RFT", "ELECTROLYTES", "UREA", "CALCIUM", "MAGNESIUM", "PHOSPHORUS"];
    } else if (panelName === "PEDIA MINI PANEL") {
      tests = ["CBC", "CRP", "CREATININE", "LFT MINIS", "ELECTROLYTES"];
    } else if (panelName === "PA PANEL PEDIATRICS SURGERY") {
      tests = ["CBC", "CRP", "RFT", "HIV ANTIGEN AND ANTIBODY", "HBSAG", "ANTI HCV", "LFT MINI PANEL"];
    } else if (panelName === "PEDIATRIC FEBRILE SEIZURE PANEL") {
      tests = ["CBC", "CRP", "RFT", "LFT", "ELECTROLYTES", "UREA", "CALCIUM", "PHOSPHORUS", "MAGNESIUM", "ESR", "CULTURE AND SENSITIVITY BLOOD"];
    }

    if (tests.length === 0) return;

    // 1. Update text area for labs ordered
    const currentLabsStr = currentCase.investigationLabsOrdered || "";
    const updatedLabsStr = currentLabsStr.trim()
      ? `${currentLabsStr.trim()}, ${tests.join(", ")}`
      : tests.join(", ");

    // 2. Add as individual line items with "Pending" result
    const newItems: InvestigationItem[] = tests.map((test, index) => ({
      id: `i-panel-${Date.now()}-${index}`,
      testName: test,
      result: "Pending",
      orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resultTime: "Pending"
    }));

    setCurrentCase(prev => ({
      ...prev,
      investigationLabsOrdered: updatedLabsStr,
      investigations: [...prev.investigations, ...newItems]
    }));
  };

  // Section Normal Definitions for Per-Section and Global Mark Normal
  const SECTION_NORMALS = {
    primarySurvey: {
      airway: 'Patent',
      airwayStatus: 'Normal' as const,
      breathing: 'RR 16/min. SpO₂ 98% on room air. Work of breathing normal. Air entry bilaterally equal.',
      breathingStatus: 'Normal' as const,
      circulation: 'CRT < 2 seconds. HR 80/min regular. BP 120/80 mmHg. Peripheral pulses normal. Warm peripheries.',
      circulationStatus: 'Normal' as const,
      disability: 'GCS 15/15 (E4V5M6). Pupils 3mm bilaterally equal and reactive to light.',
      disabilityStatus: 'Normal' as const,
      exposure: 'Temperature 37°C (98.6°F). No obvious injuries or rashes.',
      exposureStatus: 'Normal' as const,
    },
    secondarySurvey: `General: No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.
CVS: S1 S2 heard. No murmurs. JVP normal.
Chest / RS: Normal chest expansion. Air entry bilaterally equal. Normal vesicular breath sounds. No added sounds.
Abdomen: Abdomen soft. Non-tender. No distension. No organomegaly. Bowel sounds present.
CNS: Conscious and oriented. Moving all four limbs. No focal neurological deficit.
Extremities: No deformity. No peripheral oedema. Peripheral pulses present.`,
    psychological: 'No features of depression, anxiety, psychosis, agitation, suicidal ideation, or substance use. Behaviour appropriate.'
  };

  const handleSurveyChange = (fieldPath: string, value: any) => {
    setCurrentCase(prev => {
      const isTrauma = prev.patient.caseType === "Trauma";
      const currentSurvey: PrimarySurvey = prev.primaryAssessment?.survey || getInitialPrimarySurvey(prev.patient.caseType);
      
      const newSurvey: PrimarySurvey = JSON.parse(JSON.stringify(currentSurvey));
      const parts = fieldPath.split(".");
      let target: any = newSurvey;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;

      const newVitals = { ...prev.vitals };
      if (fieldPath === "breathing.rr" && value) newVitals.rr = String(value);
      if (fieldPath === "breathing.spo2" && value) newVitals.spo2 = String(value);
      if (fieldPath === "circulation.hr" && value) newVitals.hr = String(value);
      if (fieldPath === "circulation.sbp" || fieldPath === "circulation.dbp") {
        const sbp = fieldPath === "circulation.sbp" ? value : newSurvey.circulation.sbp;
        const dbp = fieldPath === "circulation.dbp" ? value : newSurvey.circulation.dbp;
        if (sbp || dbp) newVitals.bp = `${sbp || '120'}/${dbp || '80'}`;
      }
      if (fieldPath === "disability.gcsTotal" && value) newVitals.gcs = String(value);
      if (fieldPath === "disability.grbs" && value) newVitals.grbs = String(value);
      if (fieldPath === "exposure.temp" && value) newVitals.temp = String(value);

      return {
        ...prev,
        vitals: newVitals,
        primaryAssessment: {
          ...prev.primaryAssessment,
          survey: newSurvey,
          airway: `Airway ${newSurvey.airway.status}${newSurvey.airway.intervention ? `, Intervention: ${newSurvey.airway.intervention}` : ''}${isTrauma ? `, C-Spine: ${newSurvey.airway.cSpine}` : ''}`,
          breathing: `RR: ${newSurvey.breathing.rr || '16'}/min, SpO2: ${newSurvey.breathing.spo2 || '98'}% on ${newSurvey.breathing.o2Delivery || 'Room air'}, Work: ${newSurvey.breathing.workOfBreathing || 'normal'}, Air Entry: ${newSurvey.breathing.airEntry || 'Bilaterally equal'}, Sounds: ${newSurvey.breathing.addedSounds || 'Clear'}`,
          circulation: `HR: ${newSurvey.circulation.hr || '80'}/min ${newSurvey.circulation.rhythm || 'regular'}, BP: ${newSurvey.circulation.sbp || '120'}/${newSurvey.circulation.dbp || '80'} mmHg, CRT: ${newSurvey.circulation.crt || '<2sec'}, Pulses: ${newSurvey.circulation.peripheralPulses || 'normal'}, Skin: ${newSurvey.circulation.skinPerfusion || 'Warm + dry'}`,
          disability: `GCS: ${newSurvey.disability.gcsTotal || '15'}/15 (E${newSurvey.disability.gcsE || '4'}V${newSurvey.disability.gcsV || '5'}M${newSurvey.disability.gcsM || '6'}), Pupils: ${newSurvey.disability.pupilSizeR || '3'}mm R / ${newSurvey.disability.pupilSizeL || '3'}mm L (${newSurvey.disability.pupilReaction || 'reactive'}), GRBS: ${newSurvey.disability.grbs || 'N/A'}`,
          exposure: `Temp: ${newSurvey.exposure.temp || '37.0'}°C, Skin: ${newSurvey.exposure.skin || 'Clear'}${isTrauma ? `, Logroll: ${newSurvey.exposure.logRoll || 'Spine clear'}, Pelvis: ${newSurvey.exposure.pelvis || 'stable'}` : ''}`
        }
      };
    });
  };

  const handleInterpretABG = async () => {
    const abg = currentCase.primaryAssessment?.survey?.adjuncts?.abg;
    if (!abg) return;

    const hasValues = ["ph", "pco2", "po2", "hco3", "lactate", "sao2"].some(k => !!(abg as any)[k]);
    if (!hasValues) {
      alert("Please enter some ABG values first.");
      return;
    }

    try {
      const parts = [];
      if (abg.ph) parts.push(`pH: ${abg.ph}`);
      if (abg.pco2) parts.push(`pCO2: ${abg.pco2}`);
      if (abg.po2) parts.push(`pO2: ${abg.po2}`);
      if (abg.hco3) parts.push(`HCO3: ${abg.hco3}`);
      if (abg.be) parts.push(`BE: ${abg.be}`);
      if (abg.lactate) parts.push(`Lactate: ${abg.lactate}`);
      if (abg.sao2) parts.push(`SaO2: ${abg.sao2}%`);
      if (abg.na) parts.push(`Na: ${abg.na}`);
      if (abg.k) parts.push(`K: ${abg.k}`);
      if (abg.cl) parts.push(`Cl: ${abg.cl}`);
      if (abg.glucose) parts.push(`Glucose: ${abg.glucose}`);
      const abgString = parts.join(", ");

      const response = await fetch("/api/interpret-abg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abgValues: abgString,
          patientContext: {
            age: currentCase.patient.age,
            sex: currentCase.patient.gender,
            presenting_complaint: currentCase.patient.presentingComplaint,
            vitals: JSON.stringify(currentCase.vitals)
          }
        })
      });

      if (!response.ok) throw new Error("Failed to interpret ABG");
      const data = await response.json();
      
      setCurrentCase(prev => {
        const prevSurvey = prev.primaryAssessment?.survey || getInitialPrimarySurvey(prev.patient.caseType);
        return {
          ...prev,
          primaryAssessment: {
            ...prev.primaryAssessment,
            survey: {
              ...prevSurvey,
              adjuncts: {
                ...prevSurvey.adjuncts,
                abg: {
                  ...prevSurvey.adjuncts?.abg,
                  finalDiagnosis: data.interpretation
                }
              }
            }
          }
        };
      });
    } catch (err) {
      console.error(err);
      alert("Failed to interpret ABG. Please try again.");
    }
  };

  const markPrimarySurveyNormal = () => {
    const initialSurvey = getInitialPrimarySurvey(currentCase.patient.caseType);
    setCurrentCase(prev => {
      const prevSurvey = prev.primaryAssessment?.survey || {};
      const adjuncts = (prev.primaryAssessment?.survey as any)?.adjuncts || {};
      const newSurvey = {
        ...initialSurvey,
        airway: { ...initialSurvey.airway, cSpine: "not_applicable" },
        breathing: { ...initialSurvey.breathing, chestWall: "Normal", rr: "16", spo2: "98" },
        circulation: { ...initialSurvey.circulation, bleeding: "Nil", ivAccess: "18G", hr: "80", sbp: "120", dbp: "80" },
        disability: { ...initialSurvey.disability, focalDeficit: "None", grbs: "100" },
        exposure: { ...initialSurvey.exposure, skin: "Normal", temp: "37.0" },
        adjuncts: adjuncts
      };
      return {
        ...prev,
        vitals: {
          ...prev.vitals,
          rr: "16",
          spo2: "98",
          hr: "80",
          bp: "120/80",
          gcs: "15",
          temp: "37.0"
        },
        primaryAssessment: {
          ...prev.primaryAssessment,
          survey: newSurvey as any
        }
      };
    });
    setNormalMarkedBanner(true);
    setTimeout(() => setNormalMarkedBanner(false), 4000);
  };

  const markSecondarySurveyNormal = () => {
    setCurrentCase(prev => ({
      ...prev,
      secondaryAssessment: SECTION_NORMALS.secondarySurvey
    }));
    setNormalMarkedBanner(true);
    setTimeout(() => setNormalMarkedBanner(false), 4000);
  };

  const markPsychNormal = () => {
    setCurrentCase(prev => ({
      ...prev,
      sampleHistory: {
        ...prev.sampleHistory,
        psychiatricFlags: SECTION_NORMALS.psychological
      }
    }));
    setNormalMarkedBanner(true);
    setTimeout(() => setNormalMarkedBanner(false), 4000);
  };

  // Toggle treatment IPSG check
  const toggleIpsgMedicationCheck = (id: string) => {
    setCurrentCase(prev => ({
      ...prev,
      treatments: prev.treatments.map(t => t.id === id ? { ...t, ipsgVerified: !t.ipsgVerified } : t)
    }));
  };

  // AI Decision Support trigger
  const runClinicalDecisionSupport = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/clinical-decision-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: currentCase.patient,
          history: currentCase.sampleHistory,
          vitals: currentCase.vitals,
          primaryAssessment: currentCase.primaryAssessment
        })
      });
      const resData = await response.json();
      if (resData.success || resData.data) {
        setCurrentCase(prev => ({
          ...prev,
          differentials: resData.data
        }));
      } else {
        alert(resData.error || "Clinical assistant busy — try again in a moment");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Voice Dictation trigger
  const handleVoiceSubmit = async () => {
    if (!smartDictationText.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/voice-dictation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          speechText: smartDictationText,
          aiCredits: profile?.aiCredits
        })
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to process voice dictation.");
      }

      if (resData.success && resData.data) {
        // Enforce credit update on successful parse
        if (onSaveProfile && profile && resData.remainingCredits !== undefined) {
          onSaveProfile({
            ...profile,
            aiCredits: resData.remainingCredits
          });
        }

        const parsed = resData.data;

        // Map investigations
        let newInvestigations = [...currentCase.investigations];
        if (parsed.investigations && Array.isArray(parsed.investigations)) {
          parsed.investigations.forEach((testName: string) => {
            if (testName && !newInvestigations.some(inv => inv.testName.toLowerCase() === testName.toLowerCase())) {
              newInvestigations.push({
                id: "inv-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                testName: testName,
                result: "Pending",
                orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                resultTime: ""
              });
            }
          });
        }

        // Map treatments/medications
        let newTreatments = [...currentCase.treatments];
        if (parsed.treatments && Array.isArray(parsed.treatments)) {
          parsed.treatments.forEach((tx: any) => {
            if (tx && tx.drugName && !newTreatments.some(item => item.drugName.toLowerCase() === tx.drugName.toLowerCase())) {
              newTreatments.push({
                id: "tx-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                drugName: tx.drugName,
                dose: tx.dose || "As directed",
                route: tx.route || "IV",
                timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                ipsgVerified: false
              });
            }
          });
        }

        const updatedCase: ClinicalCase = {
          ...currentCase,
          patient: {
            ...currentCase.patient,
            name: parsed.patientName || currentCase.patient.name,
            age: parsed.age || currentCase.patient.age,
            gender: parsed.gender || parsed.sex || currentCase.patient.gender,
            presentingComplaint: parsed.presentingComplaint || parsed.chiefComplaint || currentCase.patient.presentingComplaint
          },
          vitals: {
            ...currentCase.vitals,
            bp: parsed.vitals?.bp || currentCase.vitals.bp,
            hr: parsed.vitals?.hr || currentCase.vitals.hr,
            spo2: parsed.vitals?.spo2 || currentCase.vitals.spo2,
            rr: parsed.vitals?.rr || currentCase.vitals.rr,
            temp: parsed.vitals?.temp || currentCase.vitals.temp,
            gcs: parsed.vitals?.gcs || currentCase.vitals.gcs
          },
          sampleHistory: {
            ...currentCase.sampleHistory,
            symptoms: parsed.sampleHistory?.symptoms || parsed.symptoms || currentCase.sampleHistory.symptoms,
            allergies: parsed.sampleHistory?.allergies || parsed.allergies || currentCase.sampleHistory.allergies,
            medications: parsed.sampleHistory?.medications || (Array.isArray(parsed.medications) ? parsed.medications.join(", ") : parsed.medications) || currentCase.sampleHistory.medications,
            pastHistory: parsed.sampleHistory?.pastHistory || parsed.pastMedicalHistory || currentCase.sampleHistory.pastHistory,
            lastMeal: parsed.sampleHistory?.lastMeal || currentCase.sampleHistory.lastMeal,
            events: parsed.sampleHistory?.events || parsed.events || currentCase.sampleHistory.events
          },
          investigations: newInvestigations,
          treatments: newTreatments,

          treatment: {
            ...currentCase.treatment,
            medications: mergeUnique(currentCase.treatment?.medications, parsed.treatment?.prescribedMedications || (Array.isArray(parsed.treatment) ? parsed.treatment : undefined)),
            infusions: mergeUnique(currentCase.treatment?.infusions, parsed.treatment?.prescribedInfusions),
            otherNotes: parsed.treatment?.treatmentNotes
              ? `${currentCase.treatment?.otherNotes ? currentCase.treatment.otherNotes + "\n" : ""}${parsed.treatment.treatmentNotes}`
              : currentCase.treatment?.otherNotes,
          },

          dispositionAndPlan: {
            ...currentCase.dispositionAndPlan,
            dispositionStatus: parsed.disposition?.dispositionStatus || (typeof parsed.disposition === "string" ? parsed.disposition : undefined) || currentCase.dispositionAndPlan?.dispositionStatus,
            destinationUnit: parsed.disposition?.destinationUnit || currentCase.dispositionAndPlan?.destinationUnit,
            consultsRequested: mergeUnique(currentCase.dispositionAndPlan?.consultsRequested, parsed.disposition?.consultsRequested),
            pendingInvestigations: mergeUnique(currentCase.dispositionAndPlan?.pendingInvestigations, parsed.disposition?.pendingReports),
            followUpAdvice: parsed.disposition?.followUp || currentCase.dispositionAndPlan?.followUpAdvice,
          },

          ...(currentCase.isPediatric
            ? {
                pediatricDetails: {
                  ...currentCase.pediatricDetails,
                  patientWeight: parsed.pediatricDetails?.patientWeight || currentCase.pediatricDetails?.patientWeight,
                  immunizationHistory: parsed.pediatricDetails?.immunizationHistory || currentCase.pediatricDetails?.immunizationHistory,
                  birthHistory: parsed.pediatricDetails?.birthHistory || currentCase.pediatricDetails?.birthHistory,
                  feedingHistory: parsed.pediatricDetails?.feedingHistory || currentCase.pediatricDetails?.feedingHistory,
                  developmentalHistory: parsed.pediatricDetails?.developmentalHistory || currentCase.pediatricDetails?.developmentalHistory,
                  patAppearance: parsed.pediatricDetails?.patAppearance || currentCase.pediatricDetails?.patAppearance,
                  patWorkOfBreathing: parsed.pediatricDetails?.patWorkOfBreathing || currentCase.pediatricDetails?.patWorkOfBreathing,
                  patCirculation: parsed.pediatricDetails?.patCirculation || currentCase.pediatricDetails?.patCirculation,
                  historySignsSymptoms: parsed.sampleHistory?.symptoms || parsed.symptoms || currentCase.pediatricDetails?.historySignsSymptoms || "",
                  historyAllergies: parsed.sampleHistory?.allergies || parsed.allergies || currentCase.pediatricDetails?.historyAllergies || "",
                  historyMedications: parsed.sampleHistory?.medications || (Array.isArray(parsed.medications) ? parsed.medications.join(", ") : parsed.medications) || currentCase.pediatricDetails?.historyMedications || "",
                  historyPastMedical: parsed.sampleHistory?.pastHistory || parsed.pastMedicalHistory || currentCase.pediatricDetails?.historyPastMedical || "",
                  historyLastMeal: parsed.sampleHistory?.lastMeal || currentCase.pediatricDetails?.historyLastMeal || "",
                  historyEvents: parsed.sampleHistory?.events || parsed.events || currentCase.pediatricDetails?.historyEvents || "",
                  presentingComplaints: parsed.presentingComplaint || parsed.chiefComplaint || currentCase.pediatricDetails?.presentingComplaints || ""
                },
              }
            : {}),
        };

        if (currentCase.isPediatric) {
          updatedCase.pediatricDetails = {
            ...(currentCase.pediatricDetails || {}),
            historySignsSymptoms: parsed.sampleHistory?.symptoms || currentCase.pediatricDetails?.historySignsSymptoms || "",
            historyAllergies: parsed.sampleHistory?.allergies || currentCase.pediatricDetails?.historyAllergies || "",
            historyMedications: parsed.sampleHistory?.medications || currentCase.pediatricDetails?.historyMedications || "",
            historyPastMedical: parsed.sampleHistory?.pastHistory || currentCase.pediatricDetails?.historyPastMedical || "",
            historyLastMeal: parsed.sampleHistory?.lastMeal || currentCase.pediatricDetails?.historyLastMeal || "",
            historyEvents: parsed.sampleHistory?.events || currentCase.pediatricDetails?.historyEvents || "",
            presentingComplaints: parsed.presentingComplaint || currentCase.pediatricDetails?.presentingComplaints || ""
          };
        }

        // Recalculate triage category based on updated clinical information
        const triageResult = classifyEmergencyTriage(updatedCase.patient.age, updatedCase.patient.presentingComplaint, updatedCase.vitals);
        updatedCase.patient.triageCategory = triageResult.category;

        setCurrentCase(updatedCase);
        onSaveCase(updatedCase);
        setShowDictationModal(false);
        setSmartDictationText("");
        setDictationSuccess(true);
        setTimeout(() => {
          setDictationSuccess(false);
        }, 8000);

        // Auto-update discharge summary in background
        await syncDischargeSummary(updatedCase);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to process voice dictation.");
    } finally {
      setAiLoading(false);
    }
  };

  // AI Document Scanning Simulation trigger
  const handleOcrSubmit = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/document-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageText: ocrText })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const parsed = resData.data;
        const updatedPatient = {
          ...currentCase.patient,
          name: parsed.patientName || currentCase.patient.name,
          age: parsed.age || currentCase.patient.age
        };
        const triageResult = classifyEmergencyTriage(updatedPatient.age, updatedPatient.presentingComplaint, currentCase.vitals);
        const updatedCase: ClinicalCase = {
          ...currentCase,
          patient: {
            ...updatedPatient,
            triageCategory: triageResult.category
          },
          sampleHistory: {
            ...currentCase.sampleHistory,
            allergies: parsed.allergies || currentCase.sampleHistory.allergies,
            medications: parsed.medications || currentCase.sampleHistory.medications,
            pastHistory: parsed.pastHistory || currentCase.sampleHistory.pastHistory,
            events: parsed.extractedSummary || currentCase.sampleHistory.events
          }
        };

        setCurrentCase(updatedCase);
        onSaveCase(updatedCase);
        setShowScanModal(false);
        setOcrText("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Clinical Rounds helper methods
  const fetchRoundsDebrief = async (selectedLens: typeof roundsLens) => {
    setRoundsLoading(true);
    setRoundsLens(selectedLens);
    setRoundsSavedToMemory(false);
    
    try {
      const response = await fetch("/api/rounds-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: currentCase,
          lens: selectedLens
        })
      });
      const data = await response.json();
      if (data.success && data.data) {
        setRoundsContent(data.data.content);
        setRoundsKeyTakeaway(data.data.keyTakeaway);
        setRoundsMemoryKey(data.data.memoryKey);
        setRoundsSuggestedQuestions(data.data.suggestedQuestions || []);
      } else if (data.data) {
        setRoundsContent(data.data.content);
        setRoundsKeyTakeaway(data.data.keyTakeaway);
        setRoundsMemoryKey(data.data.memoryKey);
        setRoundsSuggestedQuestions(data.data.suggestedQuestions || []);
      }
    } catch (err) {
      console.error("Error fetching rounds debrief:", err);
    } finally {
      setRoundsLoading(false);
    }
  };

  const handleRoundsChatSend = async (customMessage?: string) => {
    const msgToSend = customMessage || roundsUserMessage;
    if (!msgToSend.trim()) return;

    const updatedHistory = [...roundsChatHistory, { role: "user" as const, text: msgToSend }];
    setRoundsChatHistory(updatedHistory);
    setRoundsUserMessage("");
    setRoundsChatLoading(true);

    try {
      const response = await fetch("/api/rounds-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: currentCase,
          lens: "rounds-chat",
          userMessage: msgToSend,
          chatHistory: roundsChatHistory
        })
      });
      const data = await response.json();
      let replyContent = "";
      if (data.success && data.data) {
        replyContent = data.data.content;
        if (data.data.suggestedQuestions) {
          setRoundsSuggestedQuestions(data.data.suggestedQuestions);
        }
      } else if (data.data) {
        replyContent = data.data.content;
      }

      if (replyContent) {
        const finalHistory = [...updatedHistory, { role: "model" as const, text: replyContent }];
        setRoundsChatHistory(finalHistory);

        // Persist to Discussion format & Firestore via onSaveCase
        try {
          const convertedMsgs = finalHistory.map((h, idx) => ({
            id: "rounds-" + idx + "-" + Date.now(),
            sender: h.role === "model" ? ("ai" as const) : ("user" as const),
            text: h.text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }));

          if (onSaveCase) {
            onSaveCase({ ...currentCase, discussionMessages: convertedMsgs });
          }
        } catch (e) {
          console.warn("Error saving rounds chat history:", e);
        }
      }
    } catch (err) {
      console.error("Error sending rounds chat message:", err);
    } finally {
      setRoundsChatLoading(false);
    }
  };

  const [roundsDraftToast, setRoundsDraftToast] = useState(false);

  const handleSaveRoundsDraft = () => {
    if (!currentCase || !roundsChatHistory.length) return;

    try {
      const convertedMsgs = roundsChatHistory.map((h, idx) => ({
        id: "rounds-" + idx + "-" + Date.now(),
        sender: h.role === "model" ? ("ai" as const) : ("user" as const),
        text: h.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }));

      if (onSaveCase) {
        onSaveCase({ ...currentCase, discussionMessages: convertedMsgs });
      }
      setRoundsDraftToast(true);
      setTimeout(() => setRoundsDraftToast(false), 3000);
    } catch (err) {
      console.error("Error saving rounds draft:", err);
    }
  };

  const saveCaseToClinicalMemory = (customPearl?: string) => {
    try {
      const existingStr = localStorage.getItem("clinical_memory_log") || "[]";
      const existing = JSON.parse(existingStr);
      
      const newEntry = {
        id: "mem-" + Date.now(),
        caseId: currentCase.id,
        patientName: currentCase.patient.name,
        age: currentCase.patient.age,
        gender: currentCase.patient.gender,
        presentingComplaint: currentCase.patient.presentingComplaint,
        diagnosis: currentCase.provisionalPrimaryDiagnosis || currentCase.dischargeInfo?.primaryDiagnosis || "Acute presentation",
        caseType: currentCase.patient.caseType,
        isPediatric: currentCase.isPediatric,
        savedAt: new Date().toISOString(),
        memoryPearl: customPearl || roundsMemoryKey || `${currentCase.patient.name} presenting with ${currentCase.patient.presentingComplaint || "acute symptoms"} was successfully stabilized.`,
        physicianReflections: roundsReflections
      };

      // Check if already logged for this case ID
      const existsIdx = existing.findIndex((e: any) => e.caseId === currentCase.id);
      if (existsIdx >= 0) {
        existing[existsIdx] = {
          ...existing[existsIdx],
          memoryPearl: customPearl || roundsMemoryKey || existing[existsIdx].memoryPearl,
          physicianReflections: roundsReflections || existing[existsIdx].physicianReflections
        };
      } else {
        existing.push(newEntry);
      }

      localStorage.setItem("clinical_memory_log", JSON.stringify(existing));
      setRoundsSavedToMemory(true);
    } catch (err) {
      console.error("Error saving clinical memory:", err);
    }
  };

  // Commit to backend (Save)
  const handleSave = async () => {
    // Audit & sanitize clinical fields before saving
    const ageNum = currentCase.patient.age;
    const isPeds = currentCase.isPediatric || (ageNum !== null && recomputeIsPediatric(ageNum));
    
    const formattedVitals = {
      ...currentCase.vitals,
      temp: currentCase.vitals.temp ? formatTemperature(currentCase.vitals.temp) : currentCase.vitals.temp
    };

    const formattedTreatments = deduplicateMeds(currentCase.treatments).map(t => ({
      ...t,
      route: validateMedRoute(t.drugName, t.route)
    }));

    const formattedDocName = formatDoctorName(currentCase.doctorName);

    const caseToSave: ClinicalCase = {
      ...currentCase,
      isPediatric: isPeds,
      vitals: formattedVitals,
      treatments: formattedTreatments,
      doctorName: formattedDocName
    };

    setCurrentCase(caseToSave);
    onSaveCase(caseToSave);
    const saved = Math.max(2, 18 - caseToSave.timeSpentMin);
    setSaveBanner({ show: true, minutesSaved: saved });
    setTimeout(() => {
      setSaveBanner(null);
    }, 5000);
    
    // Auto-update discharge summary in background
    await syncDischargeSummary(caseToSave);

    // Auto-populate first principles learning for the saved modal and trigger the Post-Save Debrief Nudge
    fetchRoundsDebrief("first-principles");
    /* setShowPostSaveModal(true) removed */;
  };

  const handleSaveFromDisposition = async () => {
    await handleSave();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDispositionSaveMessage(`Case Sheet saved to Dashboard successfully at ${timeStr}`);
    setTimeout(() => {
      setDispositionSaveMessage(null);
      onBack();
    }, 1500);
  };

  // Calculated composite GCS based on subscale variables
  const calculatedGcs = (parseInt(currentCase.vitals.gcs_e) || 4) + (parseInt(currentCase.vitals.gcs_v) || 5) + (parseInt(currentCase.vitals.gcs_m) || 6);

  const [copiedCaseText, setCopiedCaseText] = useState(false);

  const getFormattedCaseSheetText = () => {
    const mlcText = currentCase.patient.isMlc 
      ? `YES (Incident: ${currentCase.patient.mlcDetails?.natureOfIncident || 'N/A'}, Station: ${currentCase.patient.mlcDetails?.policeStation || 'N/A'}, GD Entry: ${currentCase.patient.mlcDetails?.ddEntryNo || 'N/A'}, Brought By: ${currentCase.patient.mlcDetails?.informantBroughtBy || 'Self'})`
      : 'NO';

    const pediatricText = currentCase.isPediatric
      ? `\n**Pediatric Assessment Triangle (PAT):**
- **Appearance (TICLS):** Tone: ${currentCase.pediatricDetails?.patAppearanceTone || "N/A"}, Interactivity: ${currentCase.pediatricDetails?.patAppearanceInteractivity || "N/A"}, Consolability: ${currentCase.pediatricDetails?.patAppearanceConsolability || "N/A"}, Look/Gaze: ${currentCase.pediatricDetails?.patAppearanceLookGaze || "N/A"}, Speech/Cry: ${currentCase.pediatricDetails?.patAppearanceSpeechCry || "N/A"}
- **Work of Breathing:** ${currentCase.pediatricDetails?.patWorkOfBreathing || "N/A"}
- **Circulation to Skin:** ${currentCase.pediatricDetails?.patCirculation || "N/A"}
- **Birth History:** ${currentCase.pediatricDetails?.birthHistory || "N/A"}
- **Feeding History:** ${currentCase.pediatricDetails?.feedingHistory || "N/A"}
- **Developmental History:** ${currentCase.pediatricDetails?.developmentalHistory || "N/A"}
- **Immunizations:** ${currentCase.pediatricDetails?.immunizationHistory || "N/A"}
- **Brought By / Informant:** ${currentCase.pediatricDetails?.broughtBy || "N/A"} / ${currentCase.pediatricDetails?.informant || "N/A"}
- **Weight:** ${currentCase.pediatricDetails?.patientWeight || (currentCase.pediatricDetails as any)?.weight || "N/A"} kg\n` : "";

    const treatmentsText = currentCase.treatments.length > 0
      ? currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose} (${t.route}) - Logged at ${t.timeGiven}`).join("\n")
      : 'No medications or treatments logged.';

    const infusionsText = (currentCase.infusions && currentCase.infusions.length > 0)
      ? currentCase.infusions.map((inf, idx) => `${idx + 1}. ${inf.fluidName} - Dose: ${inf.dose}, Dilution: ${inf.dilution}, Rate: ${inf.rate}`).join("\n")
      : 'No active infusions or IV fluids logged.';

    const proceduresText = [
      ...(currentCase.proceduresChecked || []).map(p => {
        if (p === 'foleys') return "Foley's Catheterization";
        if (p === 'ng_tube') return "NG Tube Insertion";
        if (p === 'gastric_lavage') return "Gastric Lavage";
        if (p === 'suturing') return "Wound Suturing/Closure";
        if (p === 'irrigation') return "Wound Irrigation";
        if (p === 'splinting') return "Fracture Splinting";
        if (p === 'reduction') return "Joint Reduction";
        return p;
      }),
      currentCase.otherProcedures ? `Other Procedures: ${currentCase.otherProcedures}` : ""
    ].filter(Boolean).join(", ") || 'No procedures performed.';

    const investigationsText = currentCase.investigations.length > 0
      ? currentCase.investigations.map((inv, idx) => `${idx + 1}. ${inv.testName} (Status: ${inv.result}, Ordered: ${inv.orderTime})`).join("\n")
      : 'No diagnostic investigations logged for this case.';

    return `**INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD**
--------------------------------------------------
**Patient Name:** ${currentCase.patient.name}
**Age/Sex:** ${currentCase.patient.age || "N/A"} years / ${currentCase.patient.gender}
**Address:** Chunangamvely, Aluva, Ernakulam, Kerala - 683 112
**Phone Number:** ${currentCase.patient.phone || "Not Provided"}
**Date & Time of Arrival:** ${currentCase.patient.dateOpened}
**Date & Time of Accident:** ${currentCase.patient.mlcDetails?.dateTimeOfIncident || "N/A"}
**Place of Accident:** ${currentCase.patient.mlcDetails?.placeOfIncident || "N/A"}
**Nature of Accident:** ${currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}
**Mechanism of Injury:** ${currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}
**Brought By:** ${currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}
**Informant:** ${currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}
**Identification Mark:** ${currentCase.patient.mlcDetails?.identificationMark || "Black mole over face/neck"}
 
**Chief Complaints / Presenting Complaint:**
- ${currentCase.patient.presentingComplaint || "None"}
${pediatricText}
**Primary Survey (ABCDE):**
- **Airway (A)** → ${currentCase.primaryAssessment.airway || "Patent"} / ${currentCase.primaryAssessment.airwayStatus || "Normal"}, **Intervention:** ${currentCase.primaryAssessment.airway === "Patent" ? "None" : "Oral airway / Collar"}
- **Breathing (B)** → **RR:** ${currentCase.vitals.rr || "N/A"}, **SPO2:** ${currentCase.vitals.spo2 || "N/A"}%, **Work of breathing:** ${currentCase.primaryAssessment.breathing || "Normal"}, **Air entry:** Symmetrical bilaterally, **CCT:** Normal, **Subcutaneous emphysema:** Absent, **EFAST:** Negative, **Intervention:** None.
- **Circulation (C)** → **CRT:** < 2s, **HR:** ${currentCase.vitals.hr || "N/A"} bpm, **BP:** ${currentCase.vitals.bp || "N/A"} mmHg, **Distended Neck Veins:** No, **PCT:** Normal, **Long bone deformity:** None, **FAST:** Negative, **Interventions:** IV access.
- **Disability (D)** → **AVPU/GCS:** ${currentCase.vitals.avpu || "Alert"} / ${calculatedGcs}/15 (E${currentCase.vitals.gcs_e || "4"} V${currentCase.vitals.gcs_v || "5"} M${currentCase.vitals.gcs_m || "6"}), **Pupils:** Equal and Reactive, **GRBS:** ${currentCase.vitals.grbs || "N/A"} mg/dL
- **Exposure (E)** → **Temp:** ${currentCase.vitals.temp || "N/A"} °F, **Logroll:** Completed (No spinal tenderness), **Local Examination:** ${currentCase.primaryAssessment.exposure || "Unremarkable"}

**Adjuvants to Primary:**
- **ECG:** ${currentCase.primaryAssessment.survey?.circulation?.ecg || "Normal sinus rhythm, no acute ST-T changes."}
- **VBG/ABG:** Not done.
- **Bedside Echo / EFAST:** ${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : "Not done."}

**History (SAMPLE):**
- **S - Signs & Symptoms:** ${currentCase.sampleHistory.symptoms || "None"}
- **A - Allergies:** ${currentCase.sampleHistory.allergies || "NKDA (No Known Drug Allergies)"}
- **M - Medications:** ${currentCase.sampleHistory.medications || "None"}
- **P - Past History:** ${currentCase.sampleHistory.pastHistory || "None"}
- **L - Last Meal:** ${currentCase.sampleHistory.lastMeal || "N/A"}
- **E - Events:** ${currentCase.sampleHistory.events || "None"}
- **Family / Gynae History:** ${currentCase.sampleHistory.familyHistory || "Unremarkable"}
- **LMP:** ${currentCase.isPediatric ? "N/A" : "Normal / Not applicable"}

**Secondary Survey (Systemic & General Examination):**
${(() => {
  const sec = parseSecondaryAssessment(currentCase.secondaryAssessment || "");
  return `- **General Examination:** ${sec.General || "Pallor: Absent, Icterus: Absent, Clubbing: Absent, Lymphadenopathy: None, Thyroid: Normal, Varicose Veins: None."}
- **Systemic Examination (CVS, CHEST, Abdomen, CNS):**
  - **CVS:** ${sec.CVS || `S1, S2: Normal, Pulse: Regular ${currentCase.vitals.hr || "75"} bpm, Apex Beat: Normal, localized in the 5th intercostal space, midclavicular line. Precordial Heave: Absent, Added Sounds: None, Murmurs: None`}
  - **CHEST / RS:** ${sec.RS || `Expansion: Equal bilaterally, Percussion: Resonant bilaterally, Breath Sounds: Vesicular, equal bilaterally, Vocal Resonance: Normal, Added Sounds: None.`}
  - **Abdomen (PA):** ${sec.PA || `Umbilical: Central, no abnormalities, Organomegaly: None, Percussion: Normal tympany, no dullness. Bowel Sounds: Normal, active in all quadrants, External Genitalia: Normal, no abnormalities. Hernial Orifices: No bulging, Per Rectal: No tenderness, normal tone, Per Vaginal: Normal findings.`}
  - **CNS:** ${sec.CNS || `Higher Mental Functions: Normal, alert and oriented, Cranial Nerves: Intact (I-XII), Sensory System: Normal, intact to light touch, pain, and temperature, Motor System: Normal muscle tone, strength 5/5 in all limbs, Reflex: Normal deep tendon reflexes (2+), no pathological reflexes, Romberg Sign: Negative, Cerebellar Signs: No dysmetria, normal finger-nose test, Signs of Meningeal Irritation: None, Gait: Normal, steady, no ataxia, Carotid Bruit: None.`}
- **Extremities and Back:** ${sec.Extremities || `No visible abnormalities at the time of examination.`}`;
})()}
- **Psychological Assessment:**
  - **Suicidal Ideation:** ${currentCase.psychologicalAssessment?.suicidalIdeation ? "YES ⚠️" : "No."}
  - **Self-Harm History:** ${currentCase.psychologicalAssessment?.selfHarmHistory ? "YES ⚠️" : "No."}
  - **Intent to Harm Others:** ${currentCase.psychologicalAssessment?.intentToHarmOthers ? "YES ⚠️" : "No."}
  - **Substance Abuse:** ${currentCase.psychologicalAssessment?.substanceAbuse ? "Yes." : "No."}
  - **Psychiatric History:** ${currentCase.psychologicalAssessment?.psychiatricHistory ? "Yes." : "No."}
  - **Prior mental health treatment:** ${currentCase.psychologicalAssessment?.currentlyOnPsychiatricTreatment ? "Yes." : "No."}
  - **Additional Observations:** ${currentCase.psychologicalAssessment?.notes || "Nil"}

**Investigations:**
${investigationsText}

**Treatment & Medications:**
- **Treatment Plan:**
${treatmentsText}
- **IV Fluids & Infusions:**
${infusionsText}
- **Procedures Performed:**
${proceduresText}

**Notes (Continuous Progress Notes Log):**
${currentCase.progressNotes || "No progress notes recorded."}

**Disposition:**
- **Disposition:** ${currentCase.dispositionDetails?.dispositionType || "Discharge"} (ICU, Room, Ward, Referral, DAMA)
- **Differential Diagnosis:** ${currentCase.differentials.length > 0 ? currentCase.differentials.map((d, idx) => `${idx + 1}. ${d.diagnosis} (${d.status})`).join("\n") : "None recorded"}
- **EM Resident:** ${currentCase.dispositionDetails?.residentName || "Dr. Thomas"}
- **EM Consultant:** ${currentCase.dispositionDetails?.consultantName || currentCase.consultantName || "Duty Consultant"}

--------------------------------------------------
**Hospital Information:**

`;
  };

  const getFormattedCaseSheetHtml = () => {
    const mlcText = currentCase.patient.isMlc 
      ? `YES (Incident: ${currentCase.patient.mlcDetails?.natureOfIncident || 'N/A'}, Station: ${currentCase.patient.mlcDetails?.policeStation || 'N/A'}, GD Entry: ${currentCase.patient.mlcDetails?.ddEntryNo || 'N/A'}, Brought By: ${currentCase.patient.mlcDetails?.informantBroughtBy || 'Self'})`
      : 'NO';

    const pediatricHtml = currentCase.isPediatric
      ? `
      <div style="margin-top: 15px; margin-bottom: 15px; border-left: 3px solid #8b5cf6; padding-left: 10px;">
        <h4 style="margin: 0 0 5px 0;">Pediatric Assessment</h4>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>Appearance (TICLS):</strong> Tone: ${currentCase.pediatricDetails?.patAppearanceTone || "N/A"}, Interactivity: ${currentCase.pediatricDetails?.patAppearanceInteractivity || "N/A"}, Consolability: ${currentCase.pediatricDetails?.patAppearanceConsolability || "N/A"}, Look/Gaze: ${currentCase.pediatricDetails?.patAppearanceLookGaze || "N/A"}, Speech/Cry: ${currentCase.pediatricDetails?.patAppearanceSpeechCry || "N/A"}</li>
          <li><strong>Work of Breathing:</strong> ${currentCase.pediatricDetails?.patWorkOfBreathing || "N/A"}</li>
          <li><strong>Circulation to Skin:</strong> ${currentCase.pediatricDetails?.patCirculation || "N/A"}</li>
          <li><strong>Birth History:</strong> ${currentCase.pediatricDetails?.birthHistory || "N/A"}</li>
          <li><strong>Feeding History:</strong> ${currentCase.pediatricDetails?.feedingHistory || "N/A"}</li>
          <li><strong>Developmental History:</strong> ${currentCase.pediatricDetails?.developmentalHistory || "N/A"}</li>
          <li><strong>Immunizations:</strong> ${currentCase.pediatricDetails?.immunizationHistory || "N/A"}</li>
          <li><strong>Brought By / Informant:</strong> ${currentCase.pediatricDetails?.broughtBy || "N/A"} / ${currentCase.pediatricDetails?.informant || "N/A"}</li>
          <li><strong>Weight:</strong> ${currentCase.pediatricDetails?.patientWeight || (currentCase.pediatricDetails as any)?.weight || "N/A"} kg</li>
        </ul>
      </div>
      ` : "";

    const treatmentsText = currentCase.treatments.length > 0
      ? currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose} (${t.route}) - Logged at ${t.timeGiven}`).join("<br/>")
      : 'No medications or treatments logged.';

    const infusionsText = (currentCase.infusions && currentCase.infusions.length > 0)
      ? currentCase.infusions.map((inf, idx) => `${idx + 1}. ${inf.fluidName} - Dose: ${inf.dose}, Dilution: ${inf.dilution}, Rate: ${inf.rate}`).join("<br/>")
      : 'No active infusions or IV fluids logged.';

    const proceduresText = [
      ...(currentCase.proceduresChecked || []).map(p => {
        if (p === 'foleys') return "Foley's Catheterization";
        if (p === 'ng_tube') return "NG Tube Insertion";
        if (p === 'gastric_lavage') return "Gastric Lavage";
        if (p === 'suturing') return "Wound Suturing/Closure";
        if (p === 'irrigation') return "Wound Irrigation";
        if (p === 'splinting') return "Fracture Splinting";
        if (p === 'reduction') return "Joint Reduction";
        return p;
      }),
      currentCase.otherProcedures ? `Other Procedures: ${currentCase.otherProcedures}` : ""
    ].filter(Boolean).join(", ") || 'No procedures performed.';

    const investigationsHtml = currentCase.investigations.length > 0
      ? `<ul>` + currentCase.investigations.map((inv) => `<li><strong>${inv.testName}</strong> (Status: ${inv.result}, Ordered: ${inv.orderTime})</li>`).join("") + `</ul>`
      : '<p>No diagnostic investigations logged for this case.</p>';

    return `<h3><strong>INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD</strong></h3>
<hr/>
<strong>Patient Name:</strong> ${currentCase.patient.name}<br/>
<strong>Age/Sex:</strong> ${currentCase.patient.age || "N/A"} years / ${currentCase.patient.gender}<br/>
<strong>Address:</strong> Chunangamvely, Aluva, Ernakulam, Kerala - 683 112<br/>
<strong>Phone Number:</strong> ${currentCase.patient.phone || "Not Provided"}<br/>
<strong>Date & Time of Arrival:</strong> ${currentCase.patient.dateOpened}<br/>
<strong>Date & Time of Accident:</strong> ${currentCase.patient.mlcDetails?.dateTimeOfIncident || "N/A"}<br/>
<strong>Place of Accident:</strong> ${currentCase.patient.mlcDetails?.placeOfIncident || "N/A"}<br/>
<strong>Nature of Accident:</strong> ${currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}<br/>
<strong>Mechanism of Injury:</strong> ${currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}<br/>
<strong>Brought By:</strong> ${currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}<br/>
<strong>Informant:</strong> ${currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}<br/>
<strong>Identification Mark:</strong> ${currentCase.patient.mlcDetails?.identificationMark || "Black mole over face/neck"}<br/>
<br/>
<strong>Chief Complaints / Presenting Complaint:</strong><br/>
<ul>
  <li>${currentCase.patient.presentingComplaint || "None"}</li>
</ul>
${pediatricHtml}
<strong>Primary Survey (ABCDE):</strong><br/>
<ul>
  <li><strong>Airway (A)</strong> → ${currentCase.primaryAssessment.airway || "Patent"} / ${currentCase.primaryAssessment.airwayStatus || "Normal"}, <strong>Intervention:</strong> ${currentCase.primaryAssessment.airway === "Patent" ? "None" : "Oral airway / Collar"}</li>
  <li><strong>Breathing (B)</strong> → <strong>RR:</strong> ${currentCase.vitals.rr || "N/A"}, <strong>SPO2:</strong> ${currentCase.vitals.spo2 || "N/A"}%, <strong>Work of breathing:</strong> ${currentCase.primaryAssessment.breathing || "Normal"}, <strong>Air entry:</strong> Symmetrical bilaterally, <strong>CCT:</strong> Normal, <strong>Subcutaneous emphysema:</strong> Absent, <strong>EFAST:</strong> Negative, <strong>Intervention:</strong> None.</li>
  <li><strong>Circulation (C)</strong> → <strong>CRT:</strong> &lt; 2s, <strong>HR:</strong> ${currentCase.vitals.hr || "N/A"} bpm, <strong>BP:</strong> ${currentCase.vitals.bp || "N/A"} mmHg, <strong>Distended Neck Veins:</strong> No, <strong>PCT:</strong> Normal, <strong>Long bone deformity:</strong> None, <strong>FAST:</strong> Negative, <strong>Interventions:</strong> IV access.</li>
  <li><strong>Disability (D)</strong> → <strong>AVPU/GCS:</strong> ${currentCase.vitals.avpu || "Alert"} / ${calculatedGcs}/15 (E${currentCase.vitals.gcs_e || "4"} V${currentCase.vitals.gcs_v || "5"} M${currentCase.vitals.gcs_m || "6"}), <strong>Pupils:</strong> Equal and Reactive, <strong>GRBS:</strong> ${currentCase.vitals.grbs || "N/A"} mg/dL</li>
  <li><strong>Exposure (E)</strong> → <strong>Temp:</strong> ${currentCase.vitals.temp || "N/A"} °F, <strong>Logroll:</strong> Completed (No spinal tenderness), <strong>Local Examination:</strong> ${currentCase.primaryAssessment.exposure || "Unremarkable"}</li>
</ul>
<br/>
<strong>Adjuvants to Primary:</strong>
<ul>
  <li><strong>ECG:</strong> ${currentCase.primaryAssessment.survey?.circulation?.ecg || "Normal sinus rhythm, no acute ST-T changes."}</li>
  <li><strong>VBG/ABG:</strong> Not done.</li>
  <li><strong>Bedside Echo / EFAST:</strong> ${currentCase.primaryAssessment.survey?.circulation?.efast ? 'Pericardial: ' + currentCase.primaryAssessment.survey.circulation.efast.pericardial + ', RUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.ruq + ', LUQ: ' + currentCase.primaryAssessment.survey.circulation.efast.luq + ', Suprapubic: ' + currentCase.primaryAssessment.survey.circulation.efast.suprapubic : "Not done."}</li>
</ul>
</ul>
<br/>
<strong>History (SAMPLE):</strong><br/>
<ul>
  <li><strong>S - Signs & Symptoms:</strong> ${currentCase.sampleHistory.symptoms || "None"}</li>
  <li><strong>A - Allergies:</strong> ${currentCase.sampleHistory.allergies || "NKDA (No Known Drug Allergies)"}</li>
  <li><strong>M - Medications:</strong> ${currentCase.sampleHistory.medications || "None"}</li>
  <li><strong>P - Past History:</strong> ${currentCase.sampleHistory.pastHistory || "None"}</li>
  <li><strong>L - Last Meal:</strong> ${currentCase.sampleHistory.lastMeal || "N/A"}</li>
  <li><strong>E - Events:</strong> ${currentCase.sampleHistory.events || "None"}</li>
  <li><strong>Family / Gynae History:</strong> ${currentCase.sampleHistory.familyHistory || "Unremarkable"}</li>
  <li><strong>LMP:</strong> ${currentCase.isPediatric ? "N/A" : "Normal / Not applicable"}</li>
</ul>
<br/>
<strong>Secondary Survey (Systemic & General Examination):</strong><br/>
${(() => {
  const sec = parseSecondaryAssessment(currentCase.secondaryAssessment || "");
  return `<strong>General Examination:</strong>
<ul>
  <li>${sec.General || "Pallor: Absent, Icterus: Absent, Clubbing: Absent, Lymphadenopathy: None, Thyroid: Normal, Varicose Veins: None."}</li>
</ul>
<strong>Systemic Examination:</strong>
<ul>
  <li><strong>CVS:</strong> ${sec.CVS || `S1, S2: Normal, Pulse: Regular ${currentCase.vitals.hr || "75"} bpm, Apex Beat: Normal, localized in the 5th intercostal space, midclavicular line. Precordial Heave: Absent, Added Sounds: None, Murmurs: None`}</li>
  <li><strong>CHEST / RS:</strong> ${sec.RS || `Expansion: Equal bilaterally, Percussion: Resonant bilaterally, Breath Sounds: Vesicular, equal bilaterally, Vocal Resonance: Normal, Added Sounds: None.`}</li>
  <li><strong>Abdomen (PA):</strong> ${sec.PA || `Umbilical: Central, no abnormalities, Organomegaly: None, Percussion: Normal tympany, no dullness. Bowel Sounds: Normal, active in all quadrants, External Genitalia: Normal, no abnormalities. Hernial Orifices: No bulging, Per Rectal: No tenderness, normal tone, Per Vaginal: Normal findings.`}</li>
  <li><strong>CNS:</strong> ${sec.CNS || `Higher Mental Functions: Normal, alert and oriented, Cranial Nerves: Intact (I-XII), Sensory System: Normal, intact to light touch, pain, and temperature, Motor System: Normal muscle tone, strength 5/5 in all limbs, Reflex: Normal deep tendon reflexes (2+), no pathological reflexes, Romberg Sign: Negative, Cerebellar Signs: No dysmetria, normal finger-nose test, Signs of Meningeal Irritation: None, Gait: Normal, steady, no ataxia, Carotid Bruit: None.`}</li>
</ul>
<strong>Extremities and Back:</strong> ${sec.Extremities || "No visible abnormalities at the time of examination."}<br/>`;
})()}
<br/>
<strong>Psychological Assessment:</strong>
<ul>
  <li><strong>Suicidal Ideation:</strong> ${currentCase.psychologicalAssessment?.suicidalIdeation ? "YES ⚠️" : "No."}</li>
  <li><strong>Self-Harm History:</strong> ${currentCase.psychologicalAssessment?.selfHarmHistory ? "YES ⚠️" : "No."}</li>
  <li><strong>Intent to Harm Others:</strong> ${currentCase.psychologicalAssessment?.intentToHarmOthers ? "YES ⚠️" : "No."}</li>
  <li><strong>Substance Abuse:</strong> ${currentCase.psychologicalAssessment?.substanceAbuse ? "Yes." : "No."}</li>
  <li><strong>Psychiatric History:</strong> ${currentCase.psychologicalAssessment?.psychiatricHistory ? "Yes." : "No."}</li>
  <li><strong>Prior treatment:</strong> ${currentCase.psychologicalAssessment?.currentlyOnPsychiatricTreatment ? "Yes." : "No."}</li>
  <li><strong>Observations:</strong> ${currentCase.psychologicalAssessment?.notes || "Nil"}</li>
</ul>
<br/>
<strong>Investigations:</strong><br/>
${investigationsHtml}
<br/>
<strong>Treatment & Medications:</strong><br/>
<strong>Treatment Plan:</strong><br/>
${treatmentsText}<br/>
<br/>
<strong>IV FLUIDS & INFUSIONS:</strong><br/>
${infusionsText}<br/>
<br/>
<strong>PROCEDURES PERFORMED:</strong><br/>
${proceduresText}<br/>
<br/>
<strong>CONTINUOUS PROGRESS NOTES LOG:</strong><br/>
${currentCase.progressNotes || "No progress notes recorded."}<br/>
<br/>
<strong>Disposition:</strong><br/>
<ul>
  <li><strong>Disposition:</strong> ${currentCase.dispositionDetails?.dispositionType || "Discharge"} (ICU, Room, Ward, Referral, DAMA)</li>
  <li><strong>Differential Diagnosis:</strong> ${currentCase.differentials.length > 0 ? currentCase.differentials.map((d, idx) => `${idx + 1}. ${d.diagnosis} (${d.status})`).join("<br/>") : "None recorded"}</li>
  <li><strong>EM Resident:</strong> ${currentCase.dispositionDetails?.residentName || "Dr. Thomas"}</li>
  <li><strong>EM Consultant:</strong> ${currentCase.dispositionDetails?.consultantName || currentCase.consultantName || "Duty Consultant"}</li>
</ul>
<br/>
<hr/>
<strong>Hospital Information:</strong><br/>
<br/>
`;
  };

  const handleCopyCaseSheet = () => {
    const plainText = getFormattedCaseSheetText();
    const htmlText = getFormattedCaseSheetHtml();

    try {
      if (typeof ClipboardItem !== "undefined") {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([htmlText], { type: "text/html" })
        });
        navigator.clipboard.write([clipboardItem]).then(() => {
          setCopiedCaseText(true);
          setTimeout(() => setCopiedCaseText(false), 2000);
        }).catch(err => {
          console.warn("ClipboardItem write failed, using writeText fallback:", err);
          navigator.clipboard.writeText(plainText).then(() => {
            setCopiedCaseText(true);
            setTimeout(() => setCopiedCaseText(false), 2000);
          });
        });
      } else {
        navigator.clipboard.writeText(plainText).then(() => {
          setCopiedCaseText(true);
          setTimeout(() => setCopiedCaseText(false), 2000);
        });
      }
    } catch (err) {
      console.warn("Clipboard API exception, using writeText fallback:", err);
      navigator.clipboard.writeText(plainText).then(() => {
        setCopiedCaseText(true);
        setTimeout(() => setCopiedCaseText(false), 2000);
      });
    }
  };

  const handleDownloadCaseSheet = () => {
    const text = getFormattedCaseSheetText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Case_Sheet_${currentCase.patient.name.replace(/\s+/g, "_")}_${currentCase.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Update accreditation safety items
  const updateIpsg = (field: keyof IpsgChecklist, value: any) => {
    setCurrentCase(prev => ({
      ...prev,
      ipsgChecklist: {
        ipsg1IdentifiersVerified: false,
        ipsg2ReadBackPerformed: false,
        ipsg3HighAlertDoubleChecked: false,
        ipsg4TimeOutPerformed: false,
        ipsg5HandHygieneComplied: false,
        ipsg6FallRiskAssessed: "Low",
        ...prev.ipsgChecklist,
        [field]: value
      }
    }));
  };

  const updateVulnerable = (field: keyof VulnerableAssessment, value: any) => {
    setCurrentCase(prev => ({
      ...prev,
      vulnerableAssessment: {
        isVulnerable: false,
        vulnerableType: "",
        nutritionalScreenPassed: false,
        functionalAssessmentScore: "Independent",
        abuseScreenNegative: false,
        ...prev.vulnerableAssessment,
        [field]: value
      }
    }));
  };

  const updateConsentTimeOut = (field: keyof ConsentTimeOut, value: any) => {
    setCurrentCase(prev => ({
      ...prev,
      consentTimeOut: {
        procedureConsentObtained: false,
        procedureTimeOutPerformed: false,
        ...prev.consentTimeOut,
        [field]: value
      }
    }));
  };

  const updateDisposition = (field: keyof DispositionDetails, value: any) => {
    setCurrentCase(prev => ({
      ...prev,
      dispositionDetails: {
        dispositionType: "Discharge",
        durationInEr: "",
        residentName: "",
        consultantName: "",
        observationNotes: "",
        ...prev.dispositionDetails,
        [field]: value
      }
    }));
  };

  return (
    <div className="w-full pb-28 sm:pb-36">
      {/* Global Header (Back Button & Patient Info) */}
      <div className="max-w-7xl mx-auto px-2 sm:px-0 mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            Cases List
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white text-sm">{currentCase.patient.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentCase.patient.age || "N/A"}y / {currentCase.patient.gender}</span>
            {currentCase.patient.uhid && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-medium ml-1 border-l border-slate-300 dark:border-slate-700 pl-2">
                UHID: {currentCase.patient.uhid}
              </span>
            )}
          </div>
          {onReturnToScribe && (
            <button
              onClick={onReturnToScribe}
              className="flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/25 dark:text-purple-300 text-[10px] font-bold rounded border border-purple-100 dark:border-purple-900 transition-all uppercase shrink-0"
            >
              <Mic className="w-3 h-3 text-purple-500 animate-pulse" />
              Resume Dictation
            </button>
          )}
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 font-mono font-bold animate-pulse-slow">
          {currentCase.status}
        </span>
      </div>

      {/* Persistent "Not Yet Triaged" Warning Chip  */}
      {isTriageCategoryPending(currentCase.patient.triageCategory) && (
        <div className="max-w-7xl mx-auto mb-4 bg-amber-500/15 dark:bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-pulse no-print">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider block">
                ⚠️ NOT YET TRIAGED
              </span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                Patient triage category is currently pending. Select a priority level to complete triage:
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { label: "P1 (Resuscitative)", cat: "P1 (Resuscitative)" },
              { label: "P2 (Emergent)", cat: "P2 (Emergent)" },
              { label: "P3 (Urgent)", cat: "P3 (Urgent)" },
              { label: "P4 (Non-Urgent)", cat: "P4 (Non-Urgent)" }
            ].map((item) => (
              <button
                key={item.cat}
                type="button"
                onClick={() => {
                  setCurrentCase(prev => ({
                    ...prev,
                    patient: { ...prev.patient, triageCategory: item.cat as any }
                  }));
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-xs"
              >
                Set {item.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive UI Screen  */}
      <div className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto no-print" id="case-sheet-container">
      
      {/* Left Column: Demographics & Abnormal Vitals Monitor  */}
      {(activeTab === "triage" || activeTab === "trends") && (
      <div className="w-full xl:w-80 space-y-4 shrink-0 animate-fade-in">

        {/* ER CASE QUICK-SWITCHER WIDGET  */}
        <div className="bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 relative no-print shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
              ER Active Queue
            </span>
            {(() => {
              const otherCases = (allCases || []).filter(c => c.id !== currentCase.id);
              const pendingCount = otherCases.filter(c => getCasePendingStatus(c).isPending).length;
              if (pendingCount > 0) {
                return (
                  <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/25 animate-pulse-slow">
                    {pendingCount} Pending Case{pendingCount > 1 ? "s" : ""}
                  </span>
                );
              }
              return null;
            })()}
          </div>

          <div className="relative">
            <button
              onClick={() => setCaseSwitcherOpen(!caseSwitcherOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all text-left shadow-xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-purple-500 shrink-0 animate-pulse" />
                <span className="truncate">Quick Switch Patient...</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-all shrink-0 ${caseSwitcherOpen ? "rotate-180" : ""}`} />
            </button>

            {caseSwitcherOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setCaseSwitcherOpen(false)}
                />
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-slide-down">
                  
                  {/* Action: Register / Attend New Patient  */}
                  {onStartNewTriage && (
                    <button
                      onClick={() => {
                        setCaseSwitcherOpen(false);
                        // Save current progress
                        onSaveCase(currentCase);
                        // Trigger new triage
                        onStartNewTriage();
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4 bg-emerald-100 dark:bg-emerald-950 p-0.5 rounded-full" />
                      <span>+ Register & Attend New Case</span>
                    </button>
                  )}

                  {/* List of other cases  */}
                  {(() => {
                    const otherCases = (allCases || []).filter(c => c.id !== currentCase.id);
                    if (otherCases.length === 0) {
                      return (
                        <div className="p-3 text-center text-[11px] text-slate-400 font-medium">
                          No other active cases in ER
                        </div>
                      );
                    }
                    return otherCases.map((oc) => {
                      const oStatus = getCasePendingStatus(oc);
                      return (
                        <button
                          key={oc.id}
                          onClick={() => {
                            setCaseSwitcherOpen(false);
                            // 1. Save current progress
                            onSaveCase(currentCase);
                            // 2. Select the other case
                            if (onSelectCase) {
                              onSelectCase(oc.id);
                            }
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all block space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                              {oc.patient.name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {oc.id}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{oc.patient.gender} • {oc.patient.age}y</span>
                            <span className={`font-mono font-bold text-[9px] ${
                              String(oc.patient.triageCategory || "").includes("P1") 
                                ? "text-rose-500" 
                                : String(oc.patient.triageCategory || "").includes("P2")
                                ? "text-amber-500"
                                : "text-emerald-500"
                            }`}>
                              {String(oc.patient.triageCategory || "P2").split(" ")[0]}
                            </span>
                          </div>

                          {/* Pending Sections Details  */}
                          {oStatus.isPending ? (
                            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded p-1.5 text-[9.5px] text-amber-700 dark:text-amber-400 font-medium space-y-0.5">
                              <div className="flex items-center justify-between font-bold">
                                <span>⚠️ {oStatus.pendingCount} section{oStatus.pendingCount > 1 ? "s" : ""} pending</span>
                                <span className="text-[8px] uppercase tracking-wide">Incomplete</span>
                              </div>
                              <p className="text-[8.5px] text-slate-500 dark:text-slate-400 truncate font-mono">
                                {oStatus.pendingSections.join(", ")}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded p-1.5 text-[9.5px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              <span>All sections complete</span>
                            </div>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MLC WARNING CARD (From user screenshot: Yellow Medico-Legal Warning Header)  */}
        {currentCase.patient.isMlc && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-extrabold uppercase tracking-wide">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-600 animate-pulse shrink-0" />
              <span>MEDICO-LEGAL CASE (MLC)</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
              <p><strong className="text-amber-800 dark:text-amber-500">Nature:</strong> {currentCase.patient.mlcDetails?.natureOfIncident || "Not Specified"}</p>
              <p><strong className="text-amber-800 dark:text-amber-500">Intimated Station:</strong> {currentCase.patient.mlcDetails?.policeStation || "Not Specified"}</p>
              <p><strong className="text-amber-800 dark:text-amber-500">Station GD Entry:</strong> {currentCase.patient.mlcDetails?.ddEntryNo || "Not Specified"}</p>
              <p><strong className="text-amber-800 dark:text-amber-500">Brought By:</strong> {currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}</p>
            </div>
          </div>
        )}

        {/* Patient Profile Brief Card  */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          {isEditingDemographics ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center border-b pb-1.5 mb-1.5 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">Edit Demographics</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingDemographics(false);
                    onSaveCase(currentCase);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2 py-1 rounded text-[11px] transition-colors"
                >
                  Save Changes
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Patient Name</label>
                  <input
                    type="text"
                    value={currentCase.patient.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, name: val } }));
                    }}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Age (Years)</label>
                    <input
                      type="number"
                      value={currentCase.patient.age || ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : 0;
                        const newIsPeds = recomputeIsPediatric(val);
                        setCurrentCase(prev => {
                          if (newIsPeds && !prev.isPediatric) {
                            // removed
                          }
                          return { ...prev, patient: { ...prev.patient, age: val }, isPediatric: newIsPeds };
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Gender</label>
                    <select
                      value={currentCase.patient.gender}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, gender: val } }));
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={currentCase.patient.phone || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, phone: val } }));
                    }}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">UHID / CR</label>
                    <input
                      type="text"
                      value={currentCase.patient.uhid || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, uhid: val } }));
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Arrival</label>
                    <select
                      value={currentCase.patient.arrivalMode || "Walk-in"}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, arrivalMode: val } }));
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="Walk-in">Walk-in</option>
                      <option value="Ambulance">Ambulance</option>
                      <option value="Referred">Referred</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Case Type</label>
                  <select
                    value={currentCase.patient.caseType || "Medical"}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, caseType: val } }));
                    }}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Trauma">Trauma</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Presenting Complaint</label>
                  <textarea
                    rows={2}
                    value={currentCase.patient.presentingComplaint || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, presentingComplaint: val } }));
                    }}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-display text-slate-800 dark:text-white leading-tight">
                      {currentCase.patient.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsEditingDemographics(true)}
                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Edit Demographic Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {currentCase.patient.uhid && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold mt-0.5">
                      UHID: {currentCase.patient.uhid}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] bg-slate-50 border dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                      {currentCase.patient.age || "N/A"} years
                    </span>
                    <span className="text-[10px] bg-slate-50 border dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                      {currentCase.patient.gender}
                    </span>
                  </div>
                </div>
                
                {isTriageCategoryPending(currentCase.patient.triageCategory) && (
                  <span className="text-[9px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider animate-pulse shadow-sm">
                    ⚠ Not Yet Triaged
                  </span>
                )}
                {currentCase.isPediatric ? (
                  <span className="text-[9px] font-extrabold bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-200 px-2 py-0.5 rounded uppercase">
                    Pediatric PALS
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 px-2 py-0.5 rounded uppercase">
                    Adult ATLS
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-900 font-mono">
                <div>
                  <span className="font-semibold text-slate-400">Complaint:</span> {currentCase.patient.presentingComplaint}
                </div>
                <div className="flex justify-between">
                  <span>Case Type:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{currentCase.patient.caseType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Triage Category:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{currentCase.patient.triageCategory?.toString().split(" ")[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span>Arrival Mode:</span>
                  <span>{currentCase.patient.arrivalMode}</span>
                </div>
                {currentCase.patient.phone && (
                  <div className="flex justify-between text-[10px]">
                    <span>Phone:</span>
                    <span>{currentCase.patient.phone}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Dynamic Vitals Panel with Abnormal Threshold Alerts & Pain scale (5th vital sign)  */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-900 pb-2">
            <span className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Vitals Monitor
            </span>
            <button
              type="button"
              onClick={() => setActiveTab("trends")}
              className="text-[9px] bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-slate-900 dark:text-blue-400 font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Trend Charts
            </button>
          </h3>

          <div className="space-y-2.5">
          {/* Vitals Reference Box  */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-3">
            {currentCase.patient.age === 0 || currentCase.patient.age === null ? (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">General — confirm age for precise range</span>
                Universal Adult Reference: HR 60-100, RR 12-20, BP 120/80
              </div>
            ) : currentCase.patient.age < 16 ? (
              <div className="text-xs text-sky-700 dark:text-sky-300">
                <span className="font-bold text-sky-800 dark:text-sky-200 block mb-1">Pediatric PALS Reference (Age {currentCase.patient.age})</span>
                {getPalsNormalParameters(currentCase.patient.age).comment}
                <div className="text-[10px] mt-1 opacity-70">Note: PALS defines pediatric age up to 18, but ErMate cuts at 16 for adult routing.</div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Universal Adult Reference</span>
                Universal Adult Reference: HR 60-100, RR 12-20, BP 120/80
              </div>
            )}
          </div>
            {[
              { field: "bp", label: "BP (mmHg)", placeholder: "120/80" },
              { field: "hr", label: "Heart Rate (bpm)", placeholder: "80" },
              { field: "spo2", label: "SpO2 (%)", placeholder: "98" },
              { field: "rr", label: "Resp Rate (/min)", placeholder: "16" },
              { field: "temp", label: "Temp (°F)", placeholder: "98.6" },
              { field: "grbs", label: "GRBS (mg/dL)", placeholder: "100" },
            ].map((vit) => {
              const val = currentCase.vitals[vit.field as keyof PatientVitals] || "";
              const abnormal = isVitalsAbnormal(vit.field as keyof PatientVitals, val);
              
              return (
                <div key={vit.field} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 font-medium">{vit.label}</span>
                  <input
                    type="text"
                    placeholder={vit.placeholder}
                    value={val}
                    onChange={(e) => updateVitals(vit.field as keyof PatientVitals, e.target.value)}
                    className={`w-28 px-2 py-1 text-right text-xs font-mono rounded border transition-all ${
                      abnormal
                        ? "bg-rose-50 border-rose-300 text-rose-700 font-bold dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                    }`}
                  />
                </div>
              );
            })}

            {/* GCS Interactive Subscale Widget  */}
            <div className="border-t border-slate-100 dark:border-slate-900 pt-2 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">GCS Score:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded text-[11px]">
                  {calculatedGcs}/15
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1">
                <div>
                  <span className="block text-[8px] font-extrabold text-slate-400 text-center uppercase">Eye (E)</span>
                  <select
                    value={currentCase.vitals.gcs_e || "4"}
                    onChange={(e) => updateVitals("gcs_e", e.target.value)}
                    className="w-full text-center px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono"
                  >
                    <option value="4">E4</option>
                    <option value="3">E3</option>
                    <option value="2">E2</option>
                    <option value="1">E1</option>
                  </select>
                </div>
                <div>
                  <span className="block text-[8px] font-extrabold text-slate-400 text-center uppercase">Verbal (V)</span>
                  <select
                    value={currentCase.vitals.gcs_v || "5"}
                    onChange={(e) => updateVitals("gcs_v", e.target.value)}
                    className="w-full text-center px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono"
                  >
                    <option value="5">V5</option>
                    <option value="4">V4</option>
                    <option value="3">V3</option>
                    <option value="2">V2</option>
                    <option value="1">V1</option>
                  </select>
                </div>
                <div>
                  <span className="block text-[8px] font-extrabold text-slate-400 text-center uppercase">Motor (M)</span>
                  <select
                    value={currentCase.vitals.gcs_m || "6"}
                    onChange={(e) => updateVitals("gcs_m", e.target.value)}
                    className="w-full text-center px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono"
                  >
                    <option value="6">M6</option>
                    <option value="5">M5</option>
                    <option value="4">M4</option>
                    <option value="3">M3</option>
                    <option value="2">M2</option>
                    <option value="1">M1</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pain score (5th vital sign - JCI Mandate)  */}
            <div className="border-t border-slate-100 dark:border-slate-900 pt-2 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Pain Score:</span>
                <span className="font-mono font-bold text-rose-500 dark:text-rose-400">
                  {currentCase.vitals.painScore || "0"}/10
                </span>
              </div>
              <div className="pt-1">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={currentCase.vitals.painScore || "0"}
                  onChange={(e) => updateVitals("painScore", e.target.value)}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                  <span>0 - None</span>
                  <span>5 - Mod</span>
                  <span>10 - Sev</span>
                </div>
              </div>
            </div>

            {currentCase.isPediatric && (
              <div className="flex items-center justify-between gap-2 border-t border-dashed border-slate-100 dark:border-slate-800 pt-2.5">
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                  PALS Est. Weight
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={pediatricWeight}
                    placeholder={`Est: ${getAPLSEstimate(currentCase.patient.age)}`}
                    onChange={(e) => setPediatricWeight(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2 py-1 text-right text-xs font-mono font-bold rounded border bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/20 dark:border-sky-900 dark:text-sky-300 focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">kg</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      )}
      {/* Right Column: Case Sheets Tabbed Flow  */}
      <div className="flex-1 flex flex-col space-y-4">
        
        {/* Top Action Toolbar: Primary Actions  */}
        <div className="bg-white dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider font-mono">Primary Actions:</span>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('quick-voice-scribe-section')?.scrollIntoView({ behavior: 'smooth' });
                  const textarea = document.getElementById('scribe-textarea');
                  if (textarea) textarea.focus();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs cursor-pointer"
                title="Navigate directly to the real-time Voice Scribe Dictation Desk"
              >
                <Mic className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                Direct Voice Scribe
              </button>

              {onDiscussCase && (
                <button
                  type="button"
                  onClick={() => onDiscussCase(currentCase)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs cursor-pointer"
                  title="Discuss this active case with AI Clinical Assistant"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-200" />
                  Discuss Case
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowScanModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                Scan Document
              </button>
              {onDeleteCase && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the case for "${currentCase.patient.name}"? This action cannot be undone.`)) {
                      onDeleteCase(currentCase.id);
                      onBack();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  title="Delete Case"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Case
                </button>
              )}
            </div>

            {/* Case Type Toggle  */}
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 items-center">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">TYPE:</span>
              <button
                type="button"
                onClick={() => {
                  setCurrentCase(prev => ({
                    ...prev,
                    patient: { ...prev.patient, caseType: "Medical" }
                  }));
                  setIsNormalToggled(false);
                }}
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  currentCase.patient.caseType === "Medical"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Medical
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentCase(prev => ({
                    ...prev,
                    patient: { ...prev.patient, caseType: "Trauma" }
                  }));
                  setIsNormalToggled(false);
                }}
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  currentCase.patient.caseType === "Trauma"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Trauma
              </button>
            </div>
          </div>
        </div>

        {/* Save Confirmed Banner  */}
        {saveBanner?.show && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl flex items-center justify-between no-print">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Case records updated and successfully committed to database!
            </div>
            <div className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-full font-mono font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Saved ~{saveBanner.minutesSaved} minutes!
            </div>
          </div>
        )}

        {/* Normal Findings Applied Banner  */}
        {normalMarkedBanner && (
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-300 p-4 rounded-xl flex items-center justify-between animate-fade-in no-print">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle className="w-4.5 h-4.5 text-sky-500 shrink-0" />
              <span>
                Standard {currentCase.isPediatric ? "Pediatric PALS" : "Adult ATLS"} ({currentCase.patient.caseType}) normal findings successfully mapped to all fields!
              </span>
            </div>
            <div className="text-[10px] bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 px-2.5 py-1 rounded-full font-mono font-bold">
              {currentCase.isPediatric ? "Peds Vitals & Survey Active" : "Adult Vitals & Survey Active"}
            </div>
          </div>
        )}

        {/* Success Banner after Voice dictation parses  */}
        {dictationSuccess && (
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 p-4 rounded-xl flex items-center justify-between animate-fade-in no-print">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <Sparkles className="w-4.5 h-4.5 text-purple-600 animate-pulse shrink-0" />
              <span>
                <strong>Clinical Scribe Complete:</strong> Dictated findings were parsed, translated, and automatically mapped to patient demographics, vitals, and SAMPLE clinical history!
              </span>
            </div>
            <div className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-2.5 py-1 rounded-full font-mono font-bold shrink-0">
              Auto-Filled Case Sheet ⚡
            </div>
          </div>
        )}

        {/* Quick Direct Voice Scribe Desk  */}
        <div 
          id="quick-voice-scribe-section" 
          className="bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/10 dark:to-indigo-950/10 border border-purple-200 dark:border-purple-900/40 rounded-xl p-5 shadow-xs space-y-4 no-print"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-purple-600 text-white p-2 rounded-lg shadow-sm">
                <Mic className="w-4 h-4 animate-pulse-slow" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5 font-display">
                  ErMate Direct Voice Scribe
                  <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono">
                    AI Multilingual
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Directly dictate patient presentation, symptoms, or vitals.
                </p>
              </div>
            </div>

            {/* Language Selector  */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Input:</span>
              <select
                value={dictationLang}
                onChange={(e) => {
                  setDictationLang(e.target.value);
                  if (isListening) stopRecording();
                }}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="ml-IN">Malayalam (മലയാളം)</option>
                <option value="bn-IN">Bengali (বাংলা)</option>
                <option value="mr-IN">Marathi (మరాठी)</option>
                <option value="gu-IN">Gujarati (ગુજરાતી)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {/* Dictation Box  */}
            <div className="relative">
              <textarea
                id="scribe-textarea"
                rows={4}
                value={smartDictationText}
                onChange={(e) => setSmartDictationText(e.target.value)}
                placeholder='Speak or type here... (e.g. "Patient is a 52-year-old male with radiating chest pain and heavy sweating. History of high BP. Vitals: BP is 130/80, heart rate is 88.")'
                className="w-full pr-14 pl-4 py-3 bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60 rounded-xl text-xs font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-100 shadow-inner"
              />
              
              {/* Standardized ErMate Voice Recorder inside the dictation box  */}
              <div className="absolute right-3.5 bottom-3.5">
                <VoiceRecorder
                  renderMode="compact-button"
                  onTranscript={(text) => {
                    setSmartDictationText(prev => prev ? (prev.trim() + " " + text.trim()) : text.trim());
                  }}
                />
              </div>
            </div>

            {/* Bottom action row  */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 font-medium">
                  ⚡ Use multilingual voice dictation to auto-fill the whole case sheet instantly via ErMate Saaras v3.
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSmartDictationText("");
                    if (isListening) stopRecording();
                  }}
                  className="px-4 py-2 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-xl text-xs font-bold text-center transition-all cursor-pointer bg-white dark:bg-slate-900"
                >
                  Clear Notes
                </button>
                <button
                  type="button"
                  disabled={aiLoading || !smartDictationText.trim()}
                  onClick={async () => {
                    if (isListening) stopRecording();
                    await handleVoiceSubmit();
                  }}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-950/40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Capture & Auto-Fill
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Clinical Section Navigation Bar (Prominent & Responsive)  */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 dark:bg-slate-950/98 backdrop-blur-md border-t-2 border-slate-300 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] px-2 py-2.5 sm:px-4 sm:py-3.5 no-print">
          <div className="max-w-7xl mx-auto w-full flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 py-1 px-1">
            {[
              { id: "triage", label: "Triage", icon: AlertTriangle },
              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },
              { id: "primary-survey", label: "Primary Survey", icon: Activity },
              { id: "history", label: "History (SAMPLE)", icon: Clock },
              { id: "secondary-survey", label: "Secondary Survey", icon: Eye },
              { id: "investigations", label: "Investigations", icon: FileCheck },
              { id: "treatment", label: "Treatment", icon: Heart },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "disposition", label: "Disposition", icon: LogOut },
              { id: "trends", label: "Vitals Trends", icon: TrendingUp },
              { id: "rounds", label: "Rounds & Debrief", icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`text-xs sm:text-sm font-extrabold px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl transition-all shrink-0 flex items-center gap-2 whitespace-nowrap cursor-pointer touch-manipulation min-h-[42px] sm:min-h-[46px] ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md ring-2 ring-blue-400/50 scale-[1.02]"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isActive ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                  <span className="tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content area  */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm min-h-[350px]">
          
          {/* Triage Tab  */}
          {activeTab === "triage" && (
            <div className="space-y-6 animate-fade-in text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 opacity-75" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                Triage & Patient Registration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
                Use the left panel to update demographics, set the emergency triage category, manage medico-legal (MLC) details, and record initial vital signs.
              </p>
            </div>
          )}

          {/* Chief Complaints & Editable Demographics  */}
          {activeTab === "complaints" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="border-b pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    Chief Complaints & Patient Demographics
                  </h3>
                  <p className="text-[10px] text-slate-400">Review and edit primary patient demographics and presenting complaints.</p>
                </div>
                <SaveSectionButton onSave={handleSave} />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-5 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-slate-500 font-semibold">Presenting Chief Complaint</label>
                    <span className="text-[10px] text-slate-400">Microphone dictation supported</span>
                  </div>
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={currentCase.patient.presentingComplaint || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, presentingComplaint: val } }));
                      }}
                      placeholder="Enter chief complaint details here..."
                      className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white leading-relaxed"
                    />
                    <div className="absolute right-2 bottom-3">
                      <VoiceRecorder
                        renderMode="compact-button"
                        onTranscript={(text) => {
                          setCurrentCase(prev => ({
                            ...prev,
                            patient: {
                              ...prev.patient,
                              presentingComplaint: (prev.patient.presentingComplaint ? prev.patient.presentingComplaint + " " : "") + text
                            }
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Patient Demographics & Disposition Tab (Accreditation Level)  */}
          {activeTab === "disposition" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>

              {currentCase.isPediatric && (
                <PediatricDispositionSection
                  state={{
                    provisionalDiagnosis: currentCase.pediatricDetails?.dispositionProvisionalDiagnosis || "",
                    conditionAtShift: currentCase.pediatricDetails?.dispositionConditionAtShift || "",
                    dispositionType: (currentCase as any).disposition?.dispositionType || "Ward",
                    differentialDiagnosis: currentCase.differentials ? currentCase.differentials.map((d: any) => d.diagnosis).join(", ") : "",
                    emResident: currentCase.pediatricDetails?.dispositionEmResident || currentCase.doctorName || "",
                    emConsultant: currentCase.pediatricDetails?.dispositionEmConsultant || ""
                  }}
                  onChange={s => setCurrentCase(prev => {
                    let updatedDisposition = (prev as any).disposition || { recommendedSpecialty: "", estimatedStayHrs: 0, dispositionType: "Ward" };
                    return {
                    ...prev,
                    pediatricDetails: {
                      ...(prev.pediatricDetails || {}),
                      dispositionProvisionalDiagnosis: s.provisionalDiagnosis,
                      dispositionConditionAtShift: s.conditionAtShift,
                      dispositionEmResident: s.emResident,
                      dispositionEmConsultant: s.emConsultant
                    },
                    disposition: {
                      ...updatedDisposition,
                      dispositionType: s.dispositionType as any
                    }
                  } as ClinicalCase;
                  })}
                />
              )}

              {/* NABH Mandated Disposition & Log Panel  */}
              <div className="border-t border-slate-150 dark:border-slate-850 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">
                  <LogOut className="w-4 h-4 text-emerald-500" />
                  NABH Clinical Disposition & Logs
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Disposition Mode
                    </label>
                    <select
                      value={currentCase.dispositionDetails?.dispositionType || "Discharge"}
                      onChange={(e) => updateDisposition("dispositionType", e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
                    >
                      <option value="Discharge">Discharge</option>
                      <option value="Admit">Admit to Ward / ICU</option>
                      <option value="Refer">Refer to Higher Center</option>
                      <option value="LAMA">LAMA (Left Against Medical Advice)</option>
                      <option value="Absconded">Absconded</option>
                      <option value="Death">Brought Dead / ER Exitus</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Duration in ER (Hours/Mins)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1 hr 45 mins"
                      value={currentCase.dispositionDetails?.durationInEr || ""}
                      onChange={(e) => updateDisposition("durationInEr", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                        Resident Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Thomas"
                        value={currentCase.dispositionDetails?.residentName || "Dr. Thomas"}
                        onChange={(e) => updateDisposition("residentName", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                        Consultant Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Duty Consultant"
                        value={currentCase.dispositionDetails?.consultantName || ""}
                        onChange={(e) => updateDisposition("consultantName", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    ER Observation Notes & Disposition Plan
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide specific notes regarding clinical stability, observation milestones in ER, and safety handover instructions."
                    value={currentCase.dispositionDetails?.observationNotes || ""}
                    onChange={(e) => updateDisposition("observationNotes", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>

                {/* Condition at Time of Shift  */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Condition at Time of Shift
                  </label>
                  <div className="flex gap-2">
                    {["Stable", "Unstable"].map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setCurrentCase(prev => ({ ...prev, conditionAtShift: cond as any }))}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                          currentCase.conditionAtShift === cond
                            ? cond === "Stable"
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-rose-600 border-rose-600 text-white animate-pulse"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {cond === "Stable" ? "✓ Stable" : "⚠ Unstable"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Handover & Save Actions  */}
                <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  {dispositionSaveMessage && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold animate-fade-in shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{dispositionSaveMessage}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full font-mono">
                        Committed
                      </span>
                    </div>
                  )}

                  <div className="bg-blue-50/60 dark:bg-slate-900/60 border border-blue-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                        <Save className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Save Case Sheet to Dashboard
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Commits all demographics, vitals, primary survey, SAMPLE history, treatments, investigations, and disposition notes to your case dashboard.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSaveFromDisposition}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Save Case Sheet to Dashboard
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToDischarge(currentCase.id)}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" /> Generate Discharge Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(true)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" /> View Case Sheet PDF
                    </button>
                  </div>
                </div>

                {/* OPEN CASES - TAP TO SWITCH  */}
                {allCases && allCases.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 no-print mt-6">
                    <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                      Open Cases - Tap to Switch
                    </h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {allCases.map((c) => {
                        const isActive = c.id === currentCase.id;
                        let filledFields = 0;
                        if (c.sampleHistory.symptoms) filledFields++;
                        if (c.sampleHistory.allergies) filledFields++;
                        if (c.sampleHistory.medications) filledFields++;
                        if (c.progressNotes) filledFields++;
                        if (c.treatments.length > 0) filledFields++;
                        if (c.investigations.length > 0) filledFields++;
                        const progressPct = Math.round((filledFields / 6) * 100);
                        
                        return (
                          <div
                            key={c.id}
                            onClick={() => onSelectCase && onSelectCase(c.id)}
                            className={`min-w-[180px] p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                              isActive
                                ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:border-slate-350 dark:hover:border-slate-750 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs truncate max-w-[100px]">
                                  {c.patient.name}
                                </span>
                                <span className={`text-[8px] font-bold px-1 py-0.2 rounded font-mono ${
                                  isActive 
                                    ? "bg-blue-500 text-white" 
                                    : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                                }`}>
                                  {c.id}
                                </span>
                              </div>
                              <span className={`text-[10px] block mt-1 ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                                {c.patient.age || "N/A"} y/o • {c.patient.gender} • {c.patient.caseType}
                              </span>
                            </div>

                            <div className="mt-3.5 space-y-1">
                              <div className="flex justify-between text-[9px] font-mono font-bold">
                                <span>Progress</span>
                                <span>{progressPct > 0 ? `${progressPct}%` : "Just started"}</span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isActive ? "bg-white" : "bg-blue-500"}`} 
                                  style={{ width: `${Math.max(10, progressPct)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pediatrics Sheet Tab  */}

          {/* Vitals Trends Tab  */}
          {activeTab === "trends" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
                    Patient Vital Signs Trends Tracker
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Continuous logging and graphical monitoring of patient stability over the stay duration.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium font-mono">Status:</span>
                  {(parseInt(currentCase.vitals.hr) > 110 || parseInt(currentCase.vitals.spo2) < 94 || parseInt(currentCase.vitals.rr) > 24 || parseFloat(currentCase.vitals.temp) > 101.3) ? (
                    <span className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      CLINICAL ALARM: UNSTABLE
                    </span>
                  ) : (
                    <span className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-900/50">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      HEMODYNAMICALLY STABLE
                    </span>
                  )}
                </div>
              </div>

              {/* Vitals Charts Bento Grid  */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Chart 1: Heart Rate  */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Heart Rate Trend
                    </h4>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                      Current: {currentCase.vitals.hr} bpm
                    </span>
                  </div>
                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getVitalsHistoryData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <YAxis domain={[40, 160]} tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                          labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                        />
                        <Line type="monotone" dataKey="hr" name="HR" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Blood Pressure  */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Blood Pressure Trend
                    </h4>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                      Current: {currentCase.vitals.bp} mmHg
                    </span>
                  </div>
                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getVitalsHistoryData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <YAxis domain={[40, 200]} tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                          labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', marginTop: '5px' }} />
                        <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Oxygen Saturation  */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Oxygen Saturation (SpO2)
                    </h4>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${parseInt(currentCase.vitals.spo2) < 94 ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500"}`}>
                      Current: {currentCase.vitals.spo2}%
                    </span>
                  </div>
                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getVitalsHistoryData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <YAxis domain={[80, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                          labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                        />
                        <Line type="monotone" dataKey="spo2" name="SpO2" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Log Vitals form and log history block  */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                
                {/* Form to log new entries  */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <PlusCircle className="w-4 h-4 text-blue-500" />
                    Log Periodic Vitals Reading
                  </h4>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Timestamp</label>
                        <input
                          type="text"
                          value={logTime}
                          onChange={(e) => setLogTime(e.target.value)}
                          placeholder="11:30 AM"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">BP (mmHg)</label>
                        <input
                          type="text"
                          value={logBp}
                          onChange={(e) => setLogBp(e.target.value)}
                          placeholder="120/80"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">HR (bpm)</label>
                        <input
                          type="number"
                          value={logHr}
                          onChange={(e) => setLogHr(e.target.value)}
                          placeholder="80"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">SpO2 (%)</label>
                        <input
                          type="number"
                          value={logSpo2}
                          onChange={(e) => setLogSpo2(e.target.value)}
                          placeholder="98"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Resp Rate (/min)</label>
                        <input
                          type="number"
                          value={logRr}
                          onChange={(e) => setLogRr(e.target.value)}
                          placeholder="16"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Temp (°F)</label>
                        <input
                          type="text"
                          value={logTemp}
                          onChange={(e) => setLogTemp(e.target.value)}
                          placeholder="98.6"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogVitalsTrend}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Log Vital Reading
                    </button>
                  </div>
                </div>

                {/* Vitals Log Timeline / Table  */}
                <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Vitals Log History
                    </h4>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-2 py-0.5 rounded">
                      {getVitalsHistoryData().length} entries recorded
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                          <th className="py-2 pl-2">Time</th>
                          <th className="py-2">BP</th>
                          <th className="py-2">HR (bpm)</th>
                          <th className="py-2">SpO2</th>
                          <th className="py-2">RR (/min)</th>
                          <th className="py-2 pr-2">Temp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-xs text-slate-700 dark:text-slate-300 font-mono">
                        {getVitalsHistoryData().map((rec, idx) => {
                          const isRecent = idx === getVitalsHistoryData().length - 1;
                          return (
                            <tr key={idx} className={`hover:bg-white/40 dark:hover:bg-slate-950/20 ${isRecent ? "bg-blue-50/30 dark:bg-blue-950/10 font-bold" : ""}`}>
                              <td className="py-2.5 pl-2 text-slate-500 dark:text-slate-400 font-semibold">{rec.timestamp}</td>
                              <td className="py-2.5">{rec.bp}</td>
                              <td className="py-2.5">
                                <span className={parseInt(rec.hr.toString()) > 100 || parseInt(rec.hr.toString()) < 60 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                                  {rec.hr}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className={parseInt(rec.spo2.toString()) < 94 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                                  {rec.spo2}%
                                </span>
                              </td>
                              <td className="py-2.5">{rec.rr}</td>
                              <td className="py-2.5 pr-2">{rec.temp}°F</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          
          {/* SAMPLE History Tab  */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>

              {currentCase.isPediatric && (
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 rounded-xl p-4 mb-4">
                  <h4 className="font-extrabold text-sm text-sky-800 dark:text-sky-300 uppercase tracking-wide border-b border-sky-100 dark:border-sky-900 pb-2 mb-3">Focused Pediatric History</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-500 uppercase">Brought By / Informant</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Brought by..." value={(currentCase.pediatricDetails || {}).broughtBy || ""} onChange={(e) => updatePediatricDetails("broughtBy", e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                        <input type="text" placeholder="Informant..." value={(currentCase.pediatricDetails || {}).informant || ""} onChange={(e) => updatePediatricDetails("informant", e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-500 uppercase">Immunization History</label>
                      <input type="text" placeholder="Up to date?" value={(currentCase.pediatricDetails || {}).immunizationHistory || ""} onChange={(e) => updatePediatricDetails("immunizationHistory", e.target.value)} className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-500 uppercase">Birth History</label>
                      <input type="text" placeholder="Term/Preterm, NICU stay..." value={(currentCase.pediatricDetails || {}).birthHistory || ""} onChange={(e) => updatePediatricDetails("birthHistory", e.target.value)} className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-500 uppercase">Feeding & Development</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Feeding..." value={(currentCase.pediatricDetails || {}).feedingHistory || ""} onChange={(e) => updatePediatricDetails("feedingHistory", e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                        <input type="text" placeholder="Developmental milestones..." value={(currentCase.pediatricDetails || {}).developmentalHistory || ""} onChange={(e) => updatePediatricDetails("developmentalHistory", e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              )}


<div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">SAMPLE History Module</h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-2 py-0.5 rounded">ATLS / PALS Guideline Standard</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { field: "symptoms", label: "S - Signs & Symptoms" },
                  { field: "allergies", label: "A - Allergies (drug/food)" },
                  { field: "medications", label: "M - Outpatient Medications" },
                  { field: "pastHistory", label: "P - Past Medical/Surgical History" },
                  { field: "lastMeal", label: "L - Last Oral Intake (Meal/Fluid)" },
                  { field: "events", label: "E - Events / Environment (Preceding Trauma / Precipitants)" },
                ].map((item) => (
                  <div key={item.field} className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {item.label}
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={currentCase.sampleHistory[item.field as keyof SampleHistory] || ""}
                        onChange={(e) => updateHistory(item.field as keyof SampleHistory, e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => updateHistory(item.field as keyof SampleHistory, (currentCase.sampleHistory[item.field as keyof SampleHistory] || "") + " " + txt)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Extra Medical details  */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Social History
                  </label>
                  <textarea
                    rows={2}
                    value={currentCase.sampleHistory.socialHistory || ""}
                    onChange={(e) => updateHistory("socialHistory", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Family History
                  </label>
                  <textarea
                    rows={2}
                    value={currentCase.sampleHistory.familyHistory || ""}
                    onChange={(e) => updateHistory("familyHistory", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Psychological Assessment
                    </label>
                    <button
                      type="button"
                      onClick={markPsychNormal}
                      className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 rounded transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      Mark Normal
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={currentCase.sampleHistory.psychiatricFlags || ""}
                    onChange={(e) => updateHistory("psychiatricFlags", e.target.value)}
                    placeholder="Psychological / Mental health assessment findings..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          
          {/* Primary Assessment ABCDE Tab  */}
          {activeTab === "primary-survey" && (
            <div className="space-y-4">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>

              {currentCase.isPediatric && (
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 rounded-xl p-4 space-y-4 mb-4">
                  <PediatricAssessmentTriangle
                    state={{
                      appearance: {
                        tone: currentCase.pediatricDetails?.patAppearanceTone || "",
                        interactivity: currentCase.pediatricDetails?.patAppearanceInteractivity || "",
                        consolability: currentCase.pediatricDetails?.patAppearanceConsolability || "",
                        lookGaze: currentCase.pediatricDetails?.patAppearanceLookGaze || "",
                        speechCry: currentCase.pediatricDetails?.patAppearanceSpeechCry || ""
                      },
                      workOfBreathing: currentCase.pediatricDetails?.patWorkOfBreathing ? currentCase.pediatricDetails.patWorkOfBreathing.split(", ").filter(Boolean) : [],
                      circulationToSkin: currentCase.pediatricDetails?.patCirculation ? currentCase.pediatricDetails.patCirculation.split(", ").filter(Boolean) : []
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        patAppearanceTone: s.appearance.tone,
                        patAppearanceInteractivity: s.appearance.interactivity,
                        patAppearanceConsolability: s.appearance.consolability,
                        patAppearanceLookGaze: s.appearance.lookGaze,
                        patAppearanceSpeechCry: s.appearance.speechCry,
                        patWorkOfBreathing: s.workOfBreathing.join(", "),
                        patCirculation: s.circulationToSkin.join(", ")
                      }
                    }))}
                  />
                </div>
              )}


              {currentCase.isPediatric ? (
                <div className="space-y-4">
                  <PediatricAirwaySection
                    state={{
                      cry: currentCase.pediatricDetails?.airwayCry || "",
                      airwayStatus: currentCase.pediatricDetails?.airwayStatus || "",
                      intervention: currentCase.pediatricDetails?.airwayIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        airwayCry: s.cry as any,
                        airwayStatus: s.airwayStatus as any,
                        airwayIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricBreathingSection
                    state={{
                      rr: currentCase.pediatricDetails?.breathingRr || "",
                      spo2: currentCase.pediatricDetails?.breathingSpo2 || "",
                      wobFindings: currentCase.pediatricDetails?.breathingWob ? currentCase.pediatricDetails.breathingWob.split(",").filter(Boolean) : [],
                      abnormalPositioning: currentCase.pediatricDetails?.breathingAbnormalPositioning ? [currentCase.pediatricDetails.breathingAbnormalPositioning] : [],
                      airEntry: currentCase.pediatricDetails?.breathingAirEntry || "",
                      subcutaneousEmphysema: currentCase.pediatricDetails?.breathingSubcutaneousEmphysema || "",
                      intervention: currentCase.pediatricDetails?.breathingIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        breathingRr: s.rr,
                        breathingSpo2: s.spo2,
                        breathingWob: s.wobFindings.join(","),
                        breathingAbnormalPositioning: s.abnormalPositioning[0] as any || "",
                        breathingAirEntry: s.airEntry as any,
                        breathingSubcutaneousEmphysema: s.subcutaneousEmphysema as any,
                        breathingIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricCirculationSection
                    state={{
                      crt: currentCase.pediatricDetails?.circulationCrt || "",
                      hr: currentCase.pediatricDetails?.circulationHr || "",
                      bp: currentCase.pediatricDetails?.circulationBp || "",
                      skinColorTemp: currentCase.pediatricDetails?.circulationSkinColorTemp || "",
                      distendedNeckVeins: currentCase.pediatricDetails?.circulationDistendedNeckVeins || "",
                      intervention: currentCase.pediatricDetails?.circulationIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        circulationCrt: s.crt as any,
                        circulationHr: s.hr,
                        circulationBp: s.bp,
                        circulationSkinColorTemp: s.skinColorTemp,
                        circulationDistendedNeckVeins: s.distendedNeckVeins as any,
                        circulationIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricDisabilitySection
                    state={{
                      avpuGcs: currentCase.pediatricDetails?.disabilityAvpuGcs || "",
                      pupils: currentCase.pediatricDetails?.disabilityPupils || "",
                      abnormalResponses: currentCase.pediatricDetails?.disabilityAbnormalResponses || "",
                      grbs: currentCase.pediatricDetails?.disabilityGrbs || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        disabilityAvpuGcs: s.avpuGcs,
                        disabilityPupils: s.pupils,
                        disabilityAbnormalResponses: s.abnormalResponses,
                        disabilityGrbs: s.grbs
                      }
                    }))}
                  />
                  <PediatricExposureSection
                    state={{
                      temperature: currentCase.pediatricDetails?.exposureTemp || "",
                      traumaLogroll: currentCase.pediatricDetails?.exposureTraumaLogroll || "",
                      signsOfTrauma: currentCase.pediatricDetails?.exposureSignsOfTrauma ? currentCase.pediatricDetails.exposureSignsOfTrauma.split(",").filter(Boolean) : [],
                      infectionBleedingEvidence: currentCase.pediatricDetails?.exposureEvidenceInfectionBleeding || "",
                      longBoneDeformities: currentCase.pediatricDetails?.exposureLongBoneDeformities || "",
                      extremitiesFindings: currentCase.pediatricDetails?.exposureExtremitiesCheck || "",
                      extremitiesImmobilized: currentCase.pediatricDetails?.exposureImmobilizeInjuredLimbs || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        exposureTemp: s.temperature,
                        exposureTraumaLogroll: s.traumaLogroll,
                        exposureSignsOfTrauma: s.signsOfTrauma.join(","),
                        exposureEvidenceInfectionBleeding: s.infectionBleedingEvidence,
                        exposureLongBoneDeformities: s.longBoneDeformities as any,
                        exposureExtremitiesCheck: s.extremitiesFindings,
                        exposureImmobilizeInjuredLimbs: s.extremitiesImmobilized as any
                      }
                    }))}
                  />
                  <IsolatedPrimarySurveyAdjuncts
                    data={currentCase.primaryAssessment?.survey || getInitialPrimarySurvey(currentCase.patient.caseType)}
                    onChange={handleSurveyChange}
                    onInterpretABG={handleInterpretABG}
                  />
                </div>
              ) : (
                <PrimarySurveySection
                  data={currentCase.primaryAssessment?.survey || getInitialPrimarySurvey(currentCase.patient.caseType)}
                  onChange={handleSurveyChange}
                  caseType={currentCase.patient.caseType}
                  onMarkNormal={markPrimarySurveyNormal}
                  onInterpretABG={handleInterpretABG}
                  vitals={currentCase.vitals}
                  onUpdateVitals={updateVitals}
                />
              )}
            </div>
          )}

          {/* Secondary Assessment head-to-toe Exam Tab  */}
          {activeTab === "secondary-survey" && (
            <div className="space-y-4">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
              {currentCase.isPediatric ? (
                <div className="space-y-4">
                  <PediatricFocusedPhysicalExam
                    state={{
                      heent: currentCase.pediatricDetails?.focusedHeent || "",
                      respiratory: currentCase.pediatricDetails?.focusedRespiratory || "",
                      cardiovascular: currentCase.pediatricDetails?.focusedCardiovascular || "",
                      abdomen: currentCase.pediatricDetails?.focusedAbdomen || "",
                      back: currentCase.pediatricDetails?.focusedBack || "",
                      extremities: currentCase.pediatricDetails?.focusedExtremities || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        focusedHeent: s.heent,
                        focusedRespiratory: s.respiratory,
                        focusedCardiovascular: s.cardiovascular,
                        focusedAbdomen: s.abdomen,
                        focusedBack: s.back,
                        focusedExtremities: s.extremities
                      }
                    }))}
                  />
                  <PediatricGeneralExamSection
                    state={{
                      pallor: currentCase.pediatricDetails?.examHeent?.includes("Pallor") || false,
                      icterus: currentCase.pediatricDetails?.examHeent?.includes("Icterus") || false,
                      cyanosis: currentCase.pediatricDetails?.examHeent?.includes("Cyanosis") || false,
                      clubbing: currentCase.pediatricDetails?.examHeent?.includes("Clubbing") || false,
                      lymphadenopathy: currentCase.pediatricDetails?.examHeent?.includes("Lymphadenopathy") || false,
                      edema: currentCase.pediatricDetails?.examHeent?.includes("Edema") || false
                    }}
                    onChange={s => {
                       const findings = [];
                       if (s.pallor) findings.push("Pallor");
                       if (s.icterus) findings.push("Icterus");
                       if (s.cyanosis) findings.push("Cyanosis");
                       if (s.clubbing) findings.push("Clubbing");
                       if (s.lymphadenopathy) findings.push("Lymphadenopathy");
                       if (s.edema) findings.push("Edema");
                       setCurrentCase(prev => ({
                         ...prev,
                         pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           examHeent: findings.length > 0 ? findings.join(", ") : "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."
                         }
                       }));
                    }}
                  />
                  <PediatricQuickNormalPresets
                    onApply={(section, text) => {
                      setCurrentCase(prev => ({
                        ...prev,
                        pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           ...(section === 'general' ? { examHeent: text } : {}),
                           ...(section === 'heent' ? { focusedHeent: text } : {}),
                           ...(section === 'respiratory' ? { focusedRespiratory: text } : {}),
                           ...(section === 'cardiovascular' ? { focusedCardiovascular: text } : {}),
                           ...(section === 'abdomen' ? { focusedAbdomen: text } : {}),
                           ...(section === 'back' ? { focusedBack: text } : {}),
                           ...(section === 'extremities' ? { focusedExtremities: text } : {})
                        }
                      }));
                    }}
                    onFillAll={() => {
                      setCurrentCase(prev => ({
                        ...prev,
                        pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           examHeent: PEDIATRIC_NORMAL_PRESETS.general,
                           focusedHeent: PEDIATRIC_NORMAL_PRESETS.heent,
                           focusedRespiratory: PEDIATRIC_NORMAL_PRESETS.respiratory,
                           focusedCardiovascular: PEDIATRIC_NORMAL_PRESETS.cardiovascular,
                           focusedAbdomen: PEDIATRIC_NORMAL_PRESETS.abdomen,
                           focusedBack: PEDIATRIC_NORMAL_PRESETS.back,
                           focusedExtremities: PEDIATRIC_NORMAL_PRESETS.extremities
                        }
                      }));
                    }}
                  />
                </div>
              ) : (
                <>
                  <SecondarySurveySection
                    secondaryAssessment={currentCase.secondaryAssessment || ""}
                    onChange={(val) => setCurrentCase(prev => ({ ...prev, secondaryAssessment: val }))}
                    onMarkNormal={markSecondarySurveyNormal}
                  />
                  {/* Normal Exam Presets (from user adult normal template)  */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wide">
                      Quick Normal Presets (Adult Normal & Trauma Case Sheet Format)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Click a preset to instantly append standard JCI/NABH-compliant normal findings to the clinical review of systems:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        {
                          label: "Normal CNS",
                          text: "CNS: Higher Mental Functions: Normal, alert and oriented; Cranial Nerves: Intact (I-XII); Sensory System: Normal, intact to light touch, pain, and temperature; Motor System: Normal muscle tone, strength 5/5 in all limbs; Reflexes: Normal deep tendon reflexes (2+), no pathological reflexes; Romberg Sign: Negative; Cerebellar Signs: Normal."
                        },
                        {
                          label: "Normal CVS",
                          text: "CVS: S1 S2 heard, no murmurs, no gallops, peripheral pulses felt equally bilateral."
                        },
                        {
                          label: "Normal Respiratory (RS)",
                          text: "RS: Bilateral normal vesicular breath sounds, chest symmetrical, no added sounds (wheeze/crepitations)."
                        },
                        {
                          label: "Normal P/A (Abdomen)",
                          text: "P/A: Soft, non-tender, non-distended, no organomegaly, bowel sounds present."
                        },
                        {
                          label: "Normal Extremities",
                          text: "Extremities: No clubbing, cyanosis, edema. Normal range of motion, peripheral pulses 2+ and symmetric."
                        },
                        {
                          label: "General Examination",
                          text: "General: Patient is conscious, cooperative, comfortably seated. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."
                        }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentCase(prev => ({
                              ...prev,
                              secondaryAssessment: (prev.secondaryAssessment || "") + "\n\n" + preset.text
                            }));
                          }}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors"
                        >
                          + {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                           const cns = "CNS: Higher Mental Functions: Normal, alert and oriented; Cranial Nerves: Intact (I-XII); Sensory System: Normal, intact to light touch, pain, and temperature; Motor System: Normal muscle tone, strength 5/5 in all limbs; Reflexes: Normal deep tendon reflexes (2+), no pathological reflexes; Romberg Sign: Negative; Cerebellar Signs: Normal.";
                           const cvs = "CVS: S1 S2 heard, no murmurs, no gallops, peripheral pulses felt equally bilateral.";
                           const rs = "RS: Bilateral normal vesicular breath sounds, chest symmetrical, no added sounds (wheeze/crepitations).";
                           const pa = "P/A: Soft, non-tender, non-distended, no organomegaly, bowel sounds present.";
                           const ext = "Extremities: No clubbing, cyanosis, edema. Normal range of motion, peripheral pulses 2+ and symmetric.";
                           const gen = "General: Patient is conscious, cooperative, comfortably seated. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.";
                           setCurrentCase(prev => ({
                              ...prev,
                              secondaryAssessment: [gen, cns, cvs, rs, pa, ext].join("\n\n")
                           }));
                        }}
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 font-medium rounded transition-colors"
                      >
                        🚀 Fill All Normal Findings
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* JCI/NABH Accreditation & Patient Safety Tab  */}
          {activeTab === "disposition" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="border-b pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    JCI & NABH Accreditation Audit Form
                  </h3>
                  <p className="text-[10px] text-slate-400">Mandated safety metrics and checklist audits.</p>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                  <Shield className="w-3.5 h-3.5" /> JCI IPSG Compliant
                </span>
              </div>

              {/* IPSG Checklist Block  */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800">
                  <ClipboardCheck className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    International Patient Safety Goals (IPSG) Checklist
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* IPSG Checkboxes  */}
                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.ipsgChecklist?.ipsg1IdentifiersVerified || false}
                        onChange={(e) => updateIpsg("ipsg1IdentifiersVerified", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">IPSG 1: Identify Patient Correctly</span>
                        <span className="text-[10px] text-slate-400">Dual identifiers (Name + UHID barcode/tag) verified prior to any care.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.ipsgChecklist?.ipsg2ReadBackPerformed || false}
                        onChange={(e) => updateIpsg("ipsg2ReadBackPerformed", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">IPSG 2: Improve Effective Communication</span>
                        <span className="text-[10px] text-slate-400">Verbal/Telephone order Read-Back procedure completed and documented.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.ipsgChecklist?.ipsg3HighAlertDoubleChecked || false}
                        onChange={(e) => updateIpsg("ipsg3HighAlertDoubleChecked", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">IPSG 3: Safety of High-Alert Medications</span>
                        <span className="text-[10px] text-slate-400">Concentrated electrolytes, insulin, heparin double-checked by second nurse.</span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.ipsgChecklist?.ipsg5HandHygieneComplied || false}
                        onChange={(e) => updateIpsg("ipsg5HandHygieneComplied", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">IPSG 5: Reduce Risk of Healthcare Infections</span>
                        <span className="text-[10px] text-slate-400">Hand Hygiene (WHO 5-Moments) complied with before and after contact.</span>
                      </div>
                    </label>

                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-200 mb-1">IPSG 6: Reduce Risk of Falls</span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1.5 rounded-lg border">
                        <span className="text-[10px] text-slate-400 pr-2">Fall Risk Score:</span>
                        {["Low", "Medium", "High"].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateIpsg("ipsg6FallRiskAssessed", r as any)}
                            className={`text-[10px] px-2.5 py-1 rounded font-bold transition-all ${
                              currentCase.ipsgChecklist?.ipsg6FallRiskAssessed === r
                                ? r === "High"
                                  ? "bg-rose-600 text-white"
                                  : r === "Medium"
                                  ? "bg-amber-500 text-white"
                                  : "bg-emerald-600 text-white"
                                : "bg-slate-50 dark:bg-slate-900 text-slate-400"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vulnerable Patient Assessment & Abuse Screen  */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">
                <div className="flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800 justify-between flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4.5 h-4.5 text-indigo-600" />
                    <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Vulnerable Patient Screening Panel
                    </h4>
                  </div>
                  {currentCase.patient.age !== null && (currentCase.patient.age > 65 || currentCase.patient.age < 12) && (
                    <span className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900 animate-pulse-slow">
                      ⚠ Age Vulnerability Flagged ({currentCase.patient.age} y/o)
                    </span>
                  )}
                </div>

                {currentCase.patient.age !== null && (currentCase.patient.age > 65 || currentCase.patient.age < 12) && (
                  <div className="text-[10px] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 p-2.5 rounded-lg">
                    <span className="font-bold">Standard Directive:</span> Patients aged &gt; 65 years or &lt; 12 years are automatically categorized as clinical vulnerable groups. Complete all 7 indicators below.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-3">
                    <label className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-700 dark:text-slate-200">Is Vulnerable Group Patient?</span>
                      <button
                        type="button"
                        onClick={() => updateVulnerable("isVulnerable", !currentCase.vulnerableAssessment?.isVulnerable)}
                        className={`text-[10px] px-2.5 py-1 rounded font-extrabold transition-all ${
                          currentCase.vulnerableAssessment?.isVulnerable || (currentCase.patient.age !== null && (currentCase.patient.age > 65 || currentCase.patient.age < 12))
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                        }`}
                      >
                        {currentCase.vulnerableAssessment?.isVulnerable || (currentCase.patient.age !== null && (currentCase.patient.age > 65 || currentCase.patient.age < 12)) ? "YES" : "NO"}
                      </button>
                    </label>

                    {(currentCase.vulnerableAssessment?.isVulnerable || (currentCase.patient.age !== null && (currentCase.patient.age > 65 || currentCase.patient.age < 12))) && (
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">Vulnerable Group Type</label>
                        <select
                          value={currentCase.vulnerableAssessment?.vulnerableType || (currentCase.patient.age !== null && currentCase.patient.age < 12 ? "Pediatric" : currentCase.patient.age !== null && currentCase.patient.age > 65 ? "Geriatric" : "Pediatric")}
                          onChange={(e) => updateVulnerable("vulnerableType", e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs"
                        >
                          <option value="Pediatric">Pediatric (Under 12)</option>
                          <option value="Geriatric">Geriatric (Over 65)</option>
                          <option value="Pregnant">Pregnant / Peripartum</option>
                          <option value="Physically Challenged">Physically/Mentally Challenged</option>
                          <option value="Unconscious">Unconscious / Unattended</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-200 mb-1">Functional Assessment Grade</span>
                      <select
                        value={currentCase.vulnerableAssessment?.functionalAssessmentScore || "Independent"}
                        onChange={(e) => updateVulnerable("functionalAssessmentScore", e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs"
                      >
                        <option value="Independent">Independent (Fully ambulatory)</option>
                        <option value="Assisted">Assisted (Needs helper for ADLs)</option>
                        <option value="Dependent">Dependent (Requires complete care)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.nutritionalScreenPassed || false}
                        onChange={(e) => updateVulnerable("nutritionalScreenPassed", e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">Nutritional Screening Passed</span>
                        <span className="text-[10px] text-slate-400">Nutritional compromise screened: no active cachexia or severe feeding difficulty.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.abuseScreenNegative || false}
                        onChange={(e) => updateVulnerable("abuseScreenNegative", e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">Abuse & Neglect Screening Negative</span>
                        <span className="text-[10px] text-slate-400">No signs of non-accidental trauma, neglect, or clinical abuse.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 7 JCI/NABH Mandatory Indicators Grid  */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950 space-y-3">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>MANDATORY DETAILED SCREENING QUESTIONS (Word Document Format)</span>
                    <span className="text-[9px] text-slate-400 font-normal">If any is YES, perform detailed assessment</span>
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.victimOfAbuse || false}
                        onChange={(e) => updateVulnerable("victimOfAbuse", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">1. Abuse, Violence or Assault?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Victim of family violence, elder abuse, child abuse, neglect, rape, physical abuse, assault.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.severePainDistress || false}
                        onChange={(e) => updateVulnerable("severePainDistress", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">2. Severe Pain or Distress?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Presenting with extreme visceral/trauma pain or severe psychological distress.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.isAlertOriented === false}
                        onChange={(e) => updateVulnerable("isAlertOriented", !e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">3. Impaired Mental Alertness?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Patient is disoriented to time, place, or person; cannot provide reliable history.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.suicidalIdeationRisk || false}
                        onChange={(e) => updateVulnerable("suicidalIdeationRisk", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">4. Suicidal Ideation / Psychiatric Risk?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Active suicidal thoughts, self-harm markers, or critical psychiatric flags.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.confusionAgitation || false}
                        onChange={(e) => updateVulnerable("confusionAgitation", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">5. Active Confusion or Agitation?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Exhibiting clinical delirium, severe restless agitation, or combativeness.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.needsMobilityAssistance || false}
                        onChange={(e) => updateVulnerable("needsMobilityAssistance", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">6. Needs Assistance with ADLs/Mobility?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Patient requires help with transfer, standing, or basic activities of daily living.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 col-span-1 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={currentCase.vulnerableAssessment?.recentFall || false}
                        onChange={(e) => updateVulnerable("recentFall", e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-700 dark:text-slate-200">7. Recent Fall Incidents?</span>
                        <span className="text-[10px] text-slate-400 leading-tight">Has experienced a fall recently or presents with extreme postural instability/gait imbalance.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Procedure Consent & Time-Out (IPSG 4 Surgery / Procedure Checklist)  */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800">
                  <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
                  <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    IPSG 4: Informed Consent & Surgical/Procedure Time-Out
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100">
                    <input
                      type="checkbox"
                      checked={currentCase.consentTimeOut?.procedureConsentObtained || false}
                      onChange={(e) => updateConsentTimeOut("procedureConsentObtained", e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-200">Written Informed Consent Verified</span>
                      <span className="text-[10px] text-slate-400">Verified written or emergency bedside clinical consent form is signed.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100">
                    <input
                      type="checkbox"
                      checked={currentCase.consentTimeOut?.procedureTimeOutPerformed || false}
                      onChange={(e) => updateConsentTimeOut("procedureTimeOutPerformed", e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-200">Procedure "Time-Out" Completed</span>
                      <span className="text-[10px] text-slate-400">Verbal confirmation of patient, side, site, and procedure immediately before start.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Investigations (Labs & Imaging) Tab  */}
          {activeTab === "investigations" && (
            <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">Lab & Imaging Investigations Log</h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-mono font-bold">OCR Sync Ready</span>
              </div>

              {/* Quick Investigation Panels (from user template screenshots)  */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 border-b pb-2 border-slate-150 dark:border-slate-800">
                  <ClipboardCheck className="w-4.5 h-4.5 text-blue-600" />
                  <span className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Standard JCI/NABH Investigation Panels (Auto-Order Sets)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    {
                      name: "ADULT SEIZURE PANEL",
                      desc: "CBC, CRP, LFT, RFT, ELECTROLYTES, UREA, CALCIUM, MAGNESIUM, PHOSPHORUS",
                      color: "from-blue-50 to-indigo-50 border-blue-200 text-blue-700 dark:from-blue-950/20 dark:to-indigo-950/10 dark:border-blue-900 dark:text-blue-300",
                    },
                    {
                      name: "PEDIA MINI PANEL",
                      desc: "CBC, CRP, CREATININE, LFT MINIS, ELECTROLYTES",
                      color: "from-sky-50 to-teal-50 border-sky-200 text-sky-700 dark:from-sky-950/20 dark:to-teal-950/10 dark:border-sky-900 dark:text-sky-300",
                    },
                    {
                      name: "PA PANEL PEDIATRICS SURGERY",
                      desc: "CBC, CRP, RFT, HIV ANTIGEN/ANTIBODY, HBSAG, ANTI HCV, LFT MINI",
                      color: "from-amber-50 to-orange-50 border-amber-200 text-amber-700 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-900 dark:text-amber-300",
                    },
                    {
                      name: "PEDIATRIC FEBRILE SEIZURE PANEL",
                      desc: "CBC, CRP, RFT, LFT, ELECTROLYTES, UREA, CALCIUM, PHOSPHORUS, MAGNESIUM, ESR, BLOOD CS",
                      color: "from-purple-50 to-pink-50 border-purple-200 text-purple-700 dark:from-purple-950/20 dark:to-pink-950/10 dark:border-purple-900 dark:text-purple-300",
                    }
                  ].map((panel) => (
                    <button
                      key={panel.name}
                      type="button"
                      onClick={() => handleOrderPanel(panel.name)}
                      className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-850 bg-gradient-to-br transition-all hover:scale-[1.01] hover:shadow-xs flex flex-col justify-between h-full group"
                    >
                      <div>
                        <span className="font-extrabold text-[10px] block uppercase tracking-wider text-slate-800 dark:text-slate-200">{panel.name}</span>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-1 leading-normal">{panel.desc}</p>
                      </div>
                      <span className="text-[8px] font-bold uppercase mt-2 bg-blue-50 dark:bg-slate-850 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded self-start border border-blue-200 dark:border-blue-900 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                        + Auto-Order Panel
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigations Ordered Checklist (Extracted from Voice Scribe)  */}
              {currentCase.investigationsOrdered && currentCase.investigationsOrdered.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      Investigations Ordered (Checklist)
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 font-bold bg-white dark:bg-slate-950 px-2 py-0.5 rounded border">
                      {currentCase.investigationsOrdered.length} Ordered
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {currentCase.investigationsOrdered.map((inv, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={inv.status === "COMPLETED"}
                            onChange={() => {
                              const updated = [...(currentCase.investigationsOrdered || [])];
                              updated[idx] = {
                                ...updated[idx],
                                status: updated[idx].status === "COMPLETED" ? "ORDERED" : "COMPLETED"
                              };
                              setCurrentCase(prev => ({ ...prev, investigationsOrdered: updated }));
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span className={`font-semibold ${inv.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>
                            {inv.name}
                          </span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                          inv.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {inv.status || "ORDERED"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigation Results Table (Structured with Abnormal Flags)  */}
              {currentCase.investigationResults && currentCase.investigationResults.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Extracted Blood & Lab Results Table
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 font-bold bg-white dark:bg-slate-950 px-2 py-0.5 rounded border">
                      {currentCase.investigationResults.filter(r => r.isAbnormal || r.flag === "HIGH" || r.flag === "LOW" || r.flag === "ABNORMAL").length} Abnormal(s) Flagged
                    </span>
                  </div>

                  <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[10px]">
                          <th className="p-2.5">Test Parameter</th>
                          <th className="p-2.5">Result / Value</th>
                          <th className="p-2.5">Unit</th>
                          <th className="p-2.5">Reference Range</th>
                          <th className="p-2.5 text-right">Flag / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-mono">
                        {currentCase.investigationResults.map((res, idx) => {
                          const isAbnormal = res.isAbnormal || res.flag === "HIGH" || res.flag === "LOW" || res.flag === "ABNORMAL";
                          const arrow = res.flag === "HIGH" ? "↑" : res.flag === "LOW" ? "↓" : isAbnormal ? "⚠" : "";
                          
                          return (
                            <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/10 ${isAbnormal ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}`}>
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{res.name}</td>
                              <td className="p-2.5 font-bold">
                                <span className={isAbnormal ? "text-rose-600 dark:text-rose-400 flex items-center gap-1 font-black text-xs" : "text-slate-700 dark:text-slate-300"}>
                                  {res.value} {arrow && <span className="text-xs font-black">{arrow}</span>}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500">{res.unit || "—"}</td>
                              <td className="p-2.5 text-slate-400">{res.referenceRange || "Standard"}</td>
                              <td className="p-2.5 text-right">
                                {isAbnormal ? (
                                  <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded text-[10px] font-extrabold border border-rose-200 dark:border-rose-900">
                                    {res.flag || "ABNORMAL"} {arrow}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200 dark:border-emerald-900">
                                    NORMAL
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lab/Imaging Text fields  */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Labs Ordered
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="e.g. CBC, Troponin, ABG, Renal panel..."
                      value={currentCase.investigationLabsOrdered || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationLabsOrdered: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, investigationLabsOrdered: (prev.investigationLabsOrdered || "") + " " + txt }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Imaging/Radiology
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="e.g. Chest X-Ray, Bedside US, Head CT..."
                      value={currentCase.investigationImaging || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationImaging: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, investigationImaging: (prev.investigationImaging || "") + " " + txt }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Results/Findings Summary
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="e.g. Troponin positive, X-ray clear..."
                      value={currentCase.investigationResultsSummary || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationResultsSummary: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, investigationResultsSummary: (prev.investigationResultsSummary || "") + " " + txt }))} />
                  </div>
                </div>
              </div>

              {/* Provisional Diagnoses  */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t pt-4 border-slate-150 dark:border-slate-850">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Provisional Primary Diagnosis
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="Primary diagnostic impression..."
                      value={currentCase.provisionalPrimaryDiagnosis || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, provisionalPrimaryDiagnosis: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, provisionalPrimaryDiagnosis: (prev.provisionalPrimaryDiagnosis || "") + " " + txt }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Provisional Differential Diagnoses
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="Alternative differentials considered..."
                      value={currentCase.provisionalDifferentialDiagnoses || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, provisionalDifferentialDiagnoses: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, provisionalDifferentialDiagnoses: (prev.provisionalDifferentialDiagnoses || "") + " " + txt }))} />
                  </div>
                </div>
              </div>

              {/* Add form  */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Test/Order Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Troponin T, Chest X-ray"
                    value={newTest}
                    onChange={(e) => setNewTest(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Findings/Result</label>
                  <input
                    type="text"
                    placeholder="e.g. Negative, Infiltrate in RLL, or Pending"
                    value={newResult}
                    onChange={(e) => setNewResult(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddInvestigation}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Order
                </button>
              </div>

              {/* Table list  */}
              <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[10px]">
                      <th className="p-3">Order Name</th>
                      <th className="p-3">Result / Findings</th>
                      <th className="p-3">Time Ordered</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                    {currentCase.investigations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 font-medium">No diagnostic investigations logged for this case.</td>
                      </tr>
                    ) : (
                      currentCase.investigations.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{item.testName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              item.result === "Pending" 
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20" 
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/20"
                            }`}>
                              {item.result}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono">{item.orderTime}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteInvestigation(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Treatment Logs & Resuscitation Dosages Tab with IPSG Drug Double-Checks  */}
          {activeTab === "treatment" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide font-display">Medications & Procedures Handover Log</h3>
                {currentCase.isPediatric && (
                  <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded font-mono font-bold">PALS Calcs Active</span>
                )}
              </div>

              {/* Drug calculators if Pediatric  */}
              {currentCase.isPediatric && (
                <div className="bg-sky-50/50 dark:bg-sky-950/10 border border-sky-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-sky-100/50 dark:border-sky-900/30 pb-1.5 mb-1">
                    <h4 className="font-bold text-sky-800 dark:text-sky-300">PALS Pediatric Emergency Dosing Quick Calculator</h4>
                    <span className="bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">
                      Weight: {pediatricWeight === "" ? getAPLSEstimate(currentCase.patient.age) : pediatricWeight} kg
                    </span>
                  </div>
                  <p className="text-slate-500 text-[10px] leading-snug">Based on standard weight calculation. Confirm patient actual weight on admission.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono leading-relaxed pt-1">
                    <div className="bg-white dark:bg-slate-900 border border-sky-100/60 p-2 rounded hover:shadow-sm transition-all">
                      <span className="font-semibold text-sky-600 block text-[10px]">Adrenaline (1:10k)</span>
                      <p className="text-slate-700 dark:text-slate-300 font-bold mt-0.5 text-xs">{(0.1 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(1)} mL IV/IO</p>
                      <span className="text-[9px] text-slate-400 block mt-0.5">0.1 mL/kg (0.01 mg/kg)</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-sky-100/60 p-2 rounded hover:shadow-sm transition-all">
                      <span className="font-semibold text-sky-600 block text-[10px]">Amiodarone Bolus</span>
                      <p className="text-slate-700 dark:text-slate-300 font-bold mt-0.5 text-xs">{(5 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(0)} mg IV/IO</p>
                      <span className="text-[9px] text-slate-400 block mt-0.5">5 mg/kg</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-sky-100/60 p-2 rounded hover:shadow-sm transition-all">
                      <span className="font-semibold text-sky-600 block text-[10px]">Fluid Bolus (NS/LR)</span>
                      <p className="text-slate-700 dark:text-slate-300 font-bold mt-0.5 text-xs">{(20 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(0)} mL IV/IO</p>
                      <span className="text-[9px] text-slate-400 block mt-0.5">20 mL/kg</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-sky-100/60 p-2 rounded hover:shadow-sm transition-all">
                      <span className="font-semibold text-sky-600 block text-[10px]">Atropine IV/IO</span>
                      <p className="text-slate-700 dark:text-slate-300 font-bold mt-0.5 text-xs">{Math.max(0.1, 0.02 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(2)} mg</p>
                      <span className="text-[9px] text-slate-400 block mt-0.5">0.02 mg/kg (min 0.1 mg)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted & Prescribed Medications Section (from Voice Scribe AI Extraction)  */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Extracted & Prescribed Medications
                    </h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold font-mono">
                    {((currentCase.medications && currentCase.medications.length) || (currentCase.sampleHistory.medications ? 1 : 0))} Active Item(s)
                  </span>
                </div>

                {currentCase.medications && currentCase.medications.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {currentCase.medications.map((med, idx) => {
                      const medStr = typeof med === "string" 
                        ? med 
                        : `${med.drugName} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim();
                      const doseOnly = typeof med === "object" ? med.dose || "Stat" : "Stat";
                      const routeOnly = typeof med === "object" ? med.route || "IV" : "IV";

                      return (
                        <div key={idx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-emerald-200 dark:border-emerald-800">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{medStr}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Dose, Route, & Frequency mapped</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newTr: TreatmentItem = {
                                id: `t-extracted-${Date.now()}-${idx}`,
                                drugName: medStr,
                                dose: doseOnly,
                                route: routeOnly,
                                timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                ipsgVerified: true
                              };
                              if (!currentCase.treatments.some(t => t.drugName.toLowerCase() === medStr.toLowerCase())) {
                                setCurrentCase(prev => ({ ...prev, treatments: [...prev.treatments, newTr] }));
                              }
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 shrink-0 cursor-pointer"
                          >
                            + Log to Flowsheet
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                    {currentCase.sampleHistory.medications ? (
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Outpatient History: {currentCase.sampleHistory.medications}
                      </span>
                    ) : (
                      "No medications extracted yet. Dictate drug orders in Voice Scribe (e.g. 'Give Ecosprin 325mg, Heparin 5000 IU') to auto-populate here."
                    )}
                  </div>
                )}
              </div>

              {/* Add form  */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Medication / Procedure</label>
                  <input
                    type="text"
                    placeholder="e.g. Adrenaline, Intubation"
                    value={newDrug}
                    onChange={(e) => setNewDrug(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Dose / Setting</label>
                  <input
                    type="text"
                    placeholder="e.g. 0.5mg, size 7.5 ETT"
                    value={newDose}
                    onChange={(e) => setNewDose(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Route of Admin</label>
                  <select
                    value={newRoute}
                    onChange={(e) => setNewRoute(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    <option value="IV">IV (Intravenous)</option>
                    <option value="IM">IM (Intramuscular)</option>
                    <option value="IO">IO (Intraosseous)</option>
                    <option value="PO">PO (Oral)</option>
                    <option value="PR">PR (Rectal)</option>
                    <option value="SC">SC (Subcutaneous)</option>
                    <option value="Procedure">Procedure Log</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddTreatment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Treatment
                </button>
              </div>

              {/* Table list with IPSG High-alert Verification Tags (JCI standard)  */}
              <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[10px]">
                      <th className="p-3">Treatment / Intervention</th>
                      <th className="p-3">Dose</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">IPSG Double Check</th>
                      <th className="p-3">Time Logged</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                    {currentCase.treatments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 font-medium">No medications or therapeutic procedures logged for this case.</td>
                      </tr>
                    ) : (
                      deduplicateMeds(currentCase.treatments).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{item.drugName}</td>
                          <td className="p-3 font-mono">{item.dose}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 font-mono">
                              {validateMedRoute(item.drugName, item.route)}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleIpsgMedicationCheck(item.id)}
                              className={`text-[10px] px-2 py-0.5 rounded font-extrabold flex items-center gap-1.5 transition-all ${
                                item.ipsgVerified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                              }`}
                            >
                              {item.ipsgVerified ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-emerald-600" /> Double Verified
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-rose-500" /> Pending Verification
                                </>
                              )}
                            </button>
                          </td>
                          <td className="p-3 text-slate-400 font-mono">{item.timeGiven}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteTreatment(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Other Medications  */}
              <div className="space-y-1 mt-4">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Other / Outpatient Medications Notes
                </label>
                <div className="flex gap-1.5">
                  <textarea
                    rows={2}
                    placeholder="Provide any additional notes or outpatient prescriptions..."
                    value={currentCase.otherMedications || ""}
                    onChange={(e) => setCurrentCase(prev => ({ ...prev, otherMedications: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                  />
                  <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, otherMedications: (prev.otherMedications || "") + " " + txt }))} />
                </div>
              </div>

              {/* Infusions & IV Fluids Log  */}
              <div className="pt-4 border-t border-slate-150 dark:border-slate-850 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                  Infusions & IV Fluids Log
                </h4>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-1.5">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Fluid / Drug Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Normal Saline, RL, Dopamine"
                      value={newInfusionFluid}
                      onChange={(e) => setNewInfusionFluid(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Dose</label>
                    <input
                      type="text"
                      placeholder="e.g. 500 mL, 5 mcg/kg"
                      value={newInfusionDose}
                      onChange={(e) => setNewInfusionDose(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Dilution</label>
                    <input
                      type="text"
                      placeholder="e.g. In 50ml NS, Neat"
                      value={newInfusionDilution}
                      onChange={(e) => setNewInfusionDilution(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Rate</label>
                    <input
                      type="text"
                      placeholder="e.g. 100 mL/hr, 5 mL/hr"
                      value={newInfusionRate}
                      onChange={(e) => setNewInfusionRate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInfusion}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Infusion
                  </button>
                </div>

                {/* Infusion List Table  */}
                <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-800 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[9px]">
                        <th className="p-2.5">Fluid / Drug</th>
                        <th className="p-2.5">Dose</th>
                        <th className="p-2.5">Dilution</th>
                        <th className="p-2.5">Rate</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                      {(!currentCase.infusions || currentCase.infusions.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-slate-400 font-mono text-[11px] bg-white dark:bg-slate-950">No active IV fluids or drug infusions logged.</td>
                        </tr>
                      ) : (
                        currentCase.infusions.map((inf) => (
                          <tr key={inf.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950">{inf.fluidName}</td>
                            <td className="p-2.5 font-mono bg-white dark:bg-slate-950">{inf.dose}</td>
                            <td className="p-2.5 text-slate-500 bg-white dark:bg-slate-950">{inf.dilution}</td>
                            <td className="p-2.5 font-mono text-emerald-600 font-bold bg-white dark:bg-slate-950">{inf.rate}</td>
                            <td className="p-2.5 text-right bg-white dark:bg-slate-950">
                              <button
                                type="button"
                                onClick={() => handleDeleteInfusion(inf.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Procedures Checkboxes  */}
              <div className="pt-4 border-t border-slate-150 dark:border-slate-850 space-y-3 text-xs">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                  Procedures Checked / Performed
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-850 rounded-xl">
                  {/* GU Section  */}
                  <div className="space-y-2">
                    <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block border-b pb-1 border-indigo-100 dark:border-indigo-900">GU</span>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("foleys") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "foleys"] : list.filter(x => x !== "foleys");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      Foley's Catheterization
                    </label>
                  </div>

                  {/* GI Section  */}
                  <div className="space-y-2">
                    <span className="font-bold text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider block border-b pb-1 border-blue-100 dark:border-blue-900">GI</span>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("ng_tube") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "ng_tube"] : list.filter(x => x !== "ng_tube");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        NG Tube Insertion
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("gastric_lavage") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "gastric_lavage"] : list.filter(x => x !== "gastric_lavage");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Gastric Lavage
                      </label>
                    </div>
                  </div>

                  {/* Wound Section  */}
                  <div className="space-y-2">
                    <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block border-b pb-1 border-emerald-100 dark:border-emerald-900">Wound</span>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("suturing") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "suturing"] : list.filter(x => x !== "suturing");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        Wound Suturing / Closure
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("irrigation") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "irrigation"] : list.filter(x => x !== "irrigation");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        Wound Irrigation
                      </label>
                    </div>
                  </div>

                  {/* Ortho Section  */}
                  <div className="space-y-2">
                    <span className="font-bold text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider block border-b pb-1 border-amber-100 dark:border-amber-900">Ortho</span>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("splinting") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "splinting"] : list.filter(x => x !== "splinting");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        Fracture Splinting
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={currentCase.proceduresChecked?.includes("reduction") || false}
                          onChange={(e) => {
                            const list = currentCase.proceduresChecked || [];
                            const updated = e.target.checked ? [...list, "reduction"] : list.filter(x => x !== "reduction");
                            setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        Joint Reduction
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Other / Custom Procedures Notes
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="e.g. Bedside FAST scan, reduction of minor subluxation..."
                      value={currentCase.otherProcedures || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, otherProcedures: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                    />
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, otherProcedures: (prev.otherProcedures || "") + " " + txt }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Notes Tab  */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 uppercase tracking-wide">Continuous Progress Notes Log</h3>
              
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Time-stamped Clinical Notes & Observations (NABH Continuous Record mandate)
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={10}
                    placeholder="e.g. 09:15 - Patient reports reduction in chest pain post-Aspirin. Vitals stable. Bilateral lungs clear. Re-ECG ordered..."
                    value={currentCase.progressNotes || ""}
                    onChange={(e) => setCurrentCase(prev => ({ ...prev, progressNotes: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setCurrentCase(prev => ({ ...prev, progressNotes: (prev.progressNotes || "") + " " + txt }))} />
                </div>
              </div>
            </div>
          )}

          {/* AI Clinical Decision Support Tab  */}
          {activeTab === "treatment" && (
            <div className="space-y-6 mt-8 pt-8 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>
<div className="border-b pb-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">ErMate Differential & CDS Support</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Evaluate diagnostic differentials and citations using secure LLM models.</p>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={runClinicalDecisionSupport}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Analyzing Records...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Generate Differential
                    </>
                  )}
                </button>
              </div>

              {/* Disclaimer Alert  */}
              <div className="bg-amber-50/50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60 p-4 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Clinical Disclaimer:</span> ErMate recommendations are intended as a decision support aid only. All diagnostic decisions, medical prescriptions, and interventions must remain under the direct supervision and approval of licensed clinical physicians.
                </div>
              </div>

              {/* Results  */}
              {currentCase.differentials.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Sparkles className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No differential list generated yet</p>
                  <p className="text-xs text-slate-400 mt-1">Tap 'Generate Differential' above to let the ErMate engine audit patient vitals and SAMPLE history.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentCase.differentials.map((diff, index) => (
                    <div 
                      key={index}
                      className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                            diff.status === "CONSISTENT"
                              ? "bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300"
                              : diff.status === "POSSIBLE"
                              ? "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300"
                              : "bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {diff.status}
                          </span>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">{diff.diagnosis}</h4>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                        {diff.reasoning}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-[11px] font-mono">
                        {/* Next Steps  */}
                        <div className="space-y-1 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
                          <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Next steps / Suggested Orders</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400 mt-1">
                            {diff.nextSteps.map((step, idx) => <li key={idx}>{step}</li>)}
                          </ul>
                        </div>

                        {/* Citations  */}
                        <div className="space-y-1 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
                          <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Guideline References / Citations</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400 mt-1">
                            {diff.citations.map((cite, idx) => <li key={idx}>{cite}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clinical Rounds & Case Debrief Tab  */}
          {activeTab === "rounds" && (
            <div className="space-y-6 animate-fade-in text-xs">
              
              {/* Header block  */}
              <div className="border-b pb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Unlimited Clinical Rounds & 7-Lens Case Debrief
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Challenge clinical heuristics, investigate underlying physiology, and record private career learning portfolios.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                    Pedagogy Mentor Active
                  </span>
                </div>
              </div>

              {/* How To Use & Purpose Guide Box  */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-850 rounded-2xl p-4 md:p-5 text-xs text-indigo-950 dark:text-indigo-100 space-y-3 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
                        How to Use Rounds & Debrief (Clinical Mentor Guide)
                      </h4>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                        Interactive ER teaching rounds designed to challenge clinical decision making and deepen emergency medicine expertise.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRoundsGuide(!showRoundsGuide)}
                    className="px-2.5 py-1 text-[10px] font-bold bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {showRoundsGuide ? "Hide Instructions" : "Show Instructions"}
                  </button>
                </div>

                {showRoundsGuide && (
                  <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                    <div className="space-y-1.5 bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                        What is this section for?
                      </span>
                      <p className="text-slate-700 dark:text-slate-300">
                        This is an <strong>interactive AI Clinical Mentor</strong>. Instead of just taking notes, it acts like a senior Emergency Physician on rounds—helping you stress-test diagnoses, avoid missed red flags, review underlying pathophysiology, and stay updated on guidelines.
                      </p>
                    </div>

                    <div className="space-y-1.5 bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
                        4-Step Workflow:
                      </span>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 font-medium">
                        <li><strong>Pick a Lens</strong> below (e.g. <em>Devil's Advocate</em> to catch biases or <em>Rare but Real</em> for mimics).</li>
                        <li><strong>Review AI Analysis</strong> generated specifically for this patient's vitals & presentation.</li>
                        <li><strong>Ask in Chat</strong> below to discuss alternative scenarios, drug choices, or diagnostic criteria.</li>
                        <li><strong>Save Takeaways</strong> to preserve key clinical pearls in your personal learning log.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              {/* Lens Selection Bar  */}
              <div className="flex overflow-x-auto scrollbar-thin pb-2 gap-1.5 no-print">
                {[
                  { id: "first-principles", label: "First Principles", icon: Brain, desc: "Fundamental physiological deconstruction" },
                  { id: "devils-advocate", label: "Devil's Advocate", icon: ShieldAlert, desc: "Critical cognitive biases & mimics" },
                  { id: "pathophysiology", label: "Pathophysiology", icon: Activity, desc: "Stepwise biological progression" },
                  { id: "rare-but-real", label: "Rare but Real", icon: AlertTriangle, desc: "Life-threatening atypical mimics" },
                  { id: "guidelines", label: "Guidelines", icon: FileCheck, desc: "Society guideline recommendations" },
                  { id: "disease-snapshot", label: "Disease Snapshot", icon: Eye, desc: "Dense clinical cheat-sheet" },
                  { id: "full-debrief", label: "Full Debrief", icon: Award, desc: "Comprehensive performance review" },
                  { id: "cause-of-death", label: "Cause of Death", icon: Skull, desc: "Whole-story mortality & cause deconstruction" },
                ].map((lens) => {
                  const Icon = lens.icon;
                  const isActive = roundsLens === lens.id;
                  return (
                    <button
                      key={lens.id}
                      onClick={() => fetchRoundsDebrief(lens.id as any)}
                      className={`px-3 py-2.5 rounded-xl border text-left shrink-0 transition-all flex flex-col justify-between min-w-[130px] md:min-w-[145px] ${
                        isActive
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                      }`}
                      title={lens.desc}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-indigo-500"}`} />
                        <span className="font-extrabold text-[10.5px] uppercase tracking-wide">{lens.label}</span>
                      </div>
                      <span className={`text-[9px] ${isActive ? "text-indigo-100" : "text-slate-400"} truncate max-w-[125px]`}>
                        {lens.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Main Content Layout  */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Clinical Debrief & Rounds Chat (2 Columns)  */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Analysis Content Panel  */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 shadow-xs">
                    
                    {roundsLoading ? (
                      <div className="py-16 text-center space-y-3">
                        <Brain className="w-10 h-10 text-indigo-500 animate-pulse mx-auto" />
                        <p className="text-xs font-mono text-slate-500 animate-pulse">
                          Emergency Medicine Educator analyzing clinical markers...
                        </p>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> Deconstructing through {roundsLens.replace("-", " ")} lens
                        </div>
                      </div>
                    ) : roundsContent ? (
                      <div className="space-y-4 animate-fade-in">
                        
                        <div className="flex items-center justify-between border-b border-slate-250 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                              Active Case Lens: {roundsLens.replace("-", " ")}
                            </h4>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">
                            Case reference ID: {currentCase.id.slice(0, 8)}
                          </span>
                        </div>

                        {/* Custom formatted Markdown container  */}
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-text">
                          {(() => {
                            return roundsContent.split("\n").map((line, idx) => {
                              if (line.startsWith("###")) {
                                return (
                                  <h4 key={idx} className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2 first:mt-0 font-display flex items-center gap-1.5 border-b pb-1">
                                    {line.replace("###", "").trim()}
                                  </h4>
                                );
                              }
                              if (line.startsWith("##")) {
                                return (
                                  <h3 key={idx} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-5 mb-2 first:mt-0 font-display">
                                    {line.replace("##", "").trim()}
                                  </h3>
                                );
                              }
                              if (line.startsWith("* **") || line.startsWith("- **")) {
                                const content = line.replace(/^[\*\-]\s+/, "");
                                return (
                                  <div key={idx} className="pl-4 py-1 flex items-start gap-2">
                                    <span className="text-indigo-500 mt-1">•</span>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                      {content.split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-slate-800 dark:text-slate-100">{part}</strong> : part)}
                                    </p>
                                  </div>
                                );
                              }
                              if (line.startsWith("*") || line.startsWith("-")) {
                                return (
                                  <div key={idx} className="pl-4 py-0.5 flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="text-indigo-400 mt-1">•</span>
                                    <p className="text-xs leading-relaxed">{line.replace(/^[\*\-]\s+/, "")}</p>
                                  </div>
                                );
                              }
                              if (line.trim() === "") {
                                return <div key={idx} className="h-1.5" />;
                              }
                              return (
                                <p key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed py-0.5 select-text">
                                  {line.split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-slate-800 dark:text-slate-100">{part}</strong> : part)}
                                </p>
                              );
                            });
                          })()}
                        </div>

                      </div>
                    ) : (
                      <div className="py-16 text-center space-y-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <Brain className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide">
                            Initiate Emergency Medicine Clinical Rounds
                          </h4>
                          <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                            Deconstruct pathophysiology, review society guidelines, and explore critical diagnostic mimics. Choose a lens above or click below to start.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchRoundsDebrief("first-principles")}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 mx-auto"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Start First Principles rounds
                        </button>
                      </div>
                    )}

                  </div>

                  {/* Interactive Rounds Mentor Chat (Unlimited)  */}
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4.5 h-4.5 text-indigo-500" />
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[11px]">
                            Unlimited Rounds Educator Chat
                          </h4>
                          <p className="text-[10px] text-slate-400">Ask any case-related drug-dosing, management or physiological questions.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveRoundsDraft}
                        className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Save rounds chat draft to patient record"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Save as Draft</span>
                      </button>
                    </div>

                    {roundsDraftToast && (
                      <div className="bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center justify-between animate-fade-in shadow-sm">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-white" />
                          <span>Rounds chat saved as draft to patient record successfully!</span>
                        </span>
                        <span className="text-[9px] uppercase font-mono bg-emerald-700 px-2 py-0.5 rounded-full tracking-wider">Synced</span>
                      </div>
                    )}

                    {/* Chat logs  */}
                    <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin pr-1">
                      {roundsChatHistory.length === 0 && (
                        <div className="py-4 text-center text-slate-400 text-[11px] bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                          👨‍⚕️ Ask our attending educator for follow-ups! Tap an AI-suggested question below or type your own.
                        </div>
                      )}
                      {roundsChatHistory.map((chat, idx) => (
                        <div
                          key={idx}
                          className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
                              chat.role === "user"
                                ? "bg-indigo-600 text-white font-medium rounded-tr-none shadow-xs"
                                : "bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none font-mono leading-relaxed whitespace-pre-wrap select-text"
                            }`}
                          >
                            {chat.role === "user" ? (
                              chat.text
                            ) : (
                              // Fast inline markdown renderer for chat response
                              chat.text.split("\n").map((line, lIdx) => {
                                if (line.startsWith("###")) {
                                  return <strong key={lIdx} className="block text-slate-900 dark:text-white font-bold mt-2 first:mt-0">{line.replace("###", "").trim()}</strong>;
                                }
                                if (line.trim() === "") return <div key={lIdx} className="h-1.5" />;
                                return (
                                  <p key={lIdx} className="py-0.5">
                                    {line.split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-slate-900 dark:text-white">{part}</strong> : part)}
                                  </p>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ))}
                      {roundsChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl rounded-tl-none p-3.5 max-w-[80%] flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                            <span className="text-[11px] font-mono text-slate-400">Attending formulating response...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dynamic follow-up chips generated by AI  */}
                    {roundsSuggestedQuestions && roundsSuggestedQuestions.length > 0 && (
                      <div className="space-y-1.5 pt-1.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                          Suggested Rounds Follow-up Questions:
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {roundsSuggestedQuestions.slice(0, 3).map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setRoundsUserMessage(q);
                                handleRoundsChatSend(q);
                              }}
                              className="text-left px-3 py-2 bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/45 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 rounded-xl transition-all font-sans font-medium flex items-center justify-between"
                            >
                              <span>{q}</span>
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chat Input  */}
                    <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                      
                      {/* 3-Dots Menu Button (More Actions)  */}
                      <div className="relative" ref={roundsMoreMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowRoundsMoreMenu(!showRoundsMoreMenu)}
                          className={`p-2 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 h-9 w-9 cursor-pointer ${showRoundsMoreMenu ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                          title="More Actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Popup Dropdown Menu  */}
                        {showRoundsMoreMenu && (
                          <div className="absolute left-0 bottom-full mb-2 z-50 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 animate-fade-in flex flex-col space-y-0.5">
                            <div className="px-2.5 py-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/85 mb-1">
                              Rounds Actions
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                handleSaveRoundsDraft();
                                setShowRoundsMoreMenu(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <BookmarkCheck className="w-4 h-4 text-emerald-500" />
                              <span>Save Chat Draft</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRoundsChatHistory([]);
                                setShowRoundsMoreMenu(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                              <span>Clear Conversation</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Main Textarea  */}
                      <div className="flex-1">
                        <textarea
                          ref={roundsTextareaRef}
                          rows={1}
                          value={roundsUserMessage}
                          onChange={(e) => setRoundsUserMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleRoundsChatSend();
                            }
                          }}
                          placeholder="Ask educator: 'Explain target perfusion pressure', 'Calculate weight dosage'..."
                          className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none px-1 py-2 resize-none max-h-[160px] overflow-y-auto leading-relaxed"
                        />
                      </div>

                      {/* Right side actions: WhatsApp-style dynamic Mic/Send toggle  */}
                      <div className="flex items-center gap-1 shrink-0 pb-0.5">
                        {roundsUserMessage.trim() === "" ? (
                          <VoiceRecorder 
                            renderMode="compact-button"
                            onTranscript={(txt) => setRoundsUserMessage(prev => prev ? `${prev} ${txt}` : txt)} 
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRoundsChatSend()}
                            disabled={roundsChatLoading}
                            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                            title="Send message"
                          >
                            <Send className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>

                    </div>

                  </div>

                </div>

                {/* Right Side: High-Yield Summary & Private Clinical Memory Portfolio  */}
                <div className="space-y-6">
                  
                  {/* High-Yield Key Takeaway Box  */}
                  {roundsKeyTakeaway && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/15 dark:to-orange-950/5 border border-amber-200/50 dark:border-amber-900/30 p-4.5 rounded-2xl space-y-2 animate-fade-in shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 font-mono uppercase tracking-widest">
                          High-Yield Clinical Takeaway
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-850 dark:text-slate-200 leading-relaxed font-sans select-text">
                        {roundsKeyTakeaway}
                      </p>
                    </div>
                  )}

                  {/* HIPAA Private Clinical Memory Sync  */}
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-1.5 border-b pb-2">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[11px]">
                        Secure Clinical Career Memory
                      </h4>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Log this patient presentation's core physiological lesson to your lifelong, private learning ledger for self-reflection and professional progress logs.
                    </p>

                    {/* Core Pearl Textarea  */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wide">
                        Core Learning Pearl (Editable)
                      </label>
                      <textarea
                        rows={3}
                        value={roundsMemoryKey}
                        onChange={(e) => setRoundsMemoryKey(e.target.value)}
                        placeholder="e.g. Always evaluate cardiac etiology in patients with atypical respiratory complaints."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed"
                      />
                    </div>

                    {/* Physician reflections notebooks  */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wide">
                        Private Physician Reflections (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={roundsReflections}
                        onChange={(e) => setRoundsReflections(e.target.value)}
                        placeholder="Write personal takeaways: clinical pitfalls, confidence ratings, or follow-up references..."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed"
                      />
                    </div>

                    {/* Sync Action  */}
                    <button
                      type="button"
                      onClick={() => saveCaseToClinicalMemory()}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        roundsSavedToMemory
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {roundsSavedToMemory ? (
                        <>
                          <Check className="w-4 h-4 font-extrabold" /> Logged to Clinical Memory! 📓
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" /> Sync to Lifelong Clinical Ledger
                        </>
                      )}
                    </button>

                    <div className="text-[9px] font-semibold text-slate-400 text-center font-mono flex items-center justify-center gap-1">
                      🔒 HIPAA compliant · Fully secure & stored offline
                    </div>

                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

        {/* Export + Finalize Actions Toolbar (End of Workflow)  */}
        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 no-print mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Group 3: Export Actions  */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">Export Actions:</span>
              <button
                type="button"
                onClick={handleCopyCaseSheet}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  copiedCaseText
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                }`}
                title="Copy Case Sheet to Clipboard to paste directly into hospital EMR"
              >
                {copiedCaseText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCaseText ? "Copied to EMR!" : "Copy to EMR"}
              </button>

              <button
                type="button"
                onClick={() => onViewPrintSheet ? onViewPrintSheet(currentCase.id) : setShowPdfModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition-all"
                title="Preview Case Sheet as official printable PDF document"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                View PDF
              </button>

              <button
                type="button"
                onClick={handleDownloadCaseSheet}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition-all"
                title="Download Case Sheet as plain text file"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>

              <button
                type="button"
                onClick={() => triggerPrintWithTip()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>

            {/* Group 4: Finalize Actions  */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">Finalize:</span>
              <button
                type="button"
                onClick={() => onNavigateToDischarge(currentCase.id)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl transition-all"
              >
                Discharge Flow
              </button>
              {dischargeSyncStatus === "syncing" && (
                <span className="text-[10px] text-purple-700 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 px-2.5 py-1 rounded-full font-mono font-bold animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-purple-600" />
                  Syncing Discharge...
                </span>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Save Draft</span>
              </button>
              {onDeleteCase && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the case for "${currentCase.patient.name}"? This action cannot be undone.`)) {
                      onDeleteCase(currentCase.id);
                      onBack();
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Case</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => { await handleSave(); onBack(); }}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border border-emerald-500/50"
              >
                <Save className="w-4 h-4 text-emerald-200" />
                <span>Save & Go to Dashboard</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clinical Reference Widget  */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2.5 no-print">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <BookOpen className="w-3.5 h-3.5" />
            Clinical Resuscitation Card
          </div>
          {currentCase.isPediatric ? (
            <div className="space-y-2 font-mono text-[10px] text-slate-500">
              <div className="border-b border-slate-200/50 pb-1">
                <strong className="text-sky-600 dark:text-sky-400">PALS Resuscitation Dose:</strong> Adrenaline 1:10,000 is <span className="font-bold text-slate-800 dark:text-slate-200">0.01 mg/kg (0.1 mL/kg) IV/IO</span>.
                <div className="mt-1 bg-sky-50/50 dark:bg-sky-950/10 p-1 rounded border border-sky-100/50 dark:border-sky-900/30 text-[9px] text-sky-700 dark:text-sky-300 font-semibold">
                  Calculated Dose ({pediatricWeight === "" ? getAPLSEstimate(currentCase.patient.age) : pediatricWeight} kg): <span className="font-bold font-mono">{(0.01 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(2)} mg ({(0.1 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)).toFixed(1)} mL)</span>
                </div>
              </div>
              <div>
                <strong className="text-sky-600 dark:text-sky-400">Defibrillation Energy:</strong> First shock: <span className="font-bold">2 J/kg</span>. Second: <span className="font-bold">4 J/kg</span>.
                <div className="mt-1 bg-sky-50/50 dark:bg-sky-950/10 p-1 rounded border border-sky-100/50 dark:border-sky-900/30 text-[9px] text-sky-700 dark:text-sky-300 font-semibold">
                  Energy ({pediatricWeight === "" ? getAPLSEstimate(currentCase.patient.age) : pediatricWeight} kg): <span className="font-bold font-mono">{2 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)} J / {4 * (pediatricWeight === "" ? (getAPLSEstimate(currentCase.patient.age) as number) : pediatricWeight)} J</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 font-mono text-[10px] text-slate-500">
              <p className="border-b border-slate-200/50 pb-1">
                <strong className="text-rose-600 dark:text-rose-400">ATLS ABCDE Check:</strong> A (Airway + Collar), B (Breathing), C (Circulation/Hemorrhage), D (Disability), E (Exposure).
              </p>
              <p>
                <strong className="text-rose-600 dark:text-rose-400">Anaphylaxis Protocol:</strong> Adrenaline 1:1000 is <span className="font-bold text-slate-800 dark:text-slate-200">0.5 mg IM</span> given in the lateral thigh.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 1. Voice Dictation Modal Simulation  */}
      {showDictationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold font-display text-slate-800 dark:text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-purple-600 animate-pulse" />
                Smart Multilingual Dictation (ErMate Translate)
              </h3>
              <button 
                onClick={() => {
                  stopRecording();
                  setShowDictationModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {/* Language Selection  */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Select Dictation / Speech Language
                </label>
                <select
                  value={dictationLang}
                  onChange={(e) => {
                    setDictationLang(e.target.value);
                    if (isListening) {
                      stopRecording();
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="en-IN">English (India) - Universal</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                  <option value="ml-IN">Malayalam (മലയാളം)</option>
                  <option value="bn-IN">Bengali (বাংলা)</option>
                  <option value="mr-IN">Marathi (मराठी)</option>
                  <option value="gu-IN">Gujarati (ગુજરાતી)</option>
                </select>
              </div>

              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Speech Dictation Input (Transcribes spoken words live)
              </label>
              
              <div className="relative">
                <textarea
                  rows={5}
                  placeholder='Speak or paste medical history dictation (e.g., "Patient is a 45-year-old male who came with chest pain for 2 hours, radiating to the left arm. He has a history of hypertension...")'
                  value={smartDictationText}
                  onChange={(e) => setSmartDictationText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
                
                {/* Voice toggle button  */}
                <button
                  onClick={toggleRecording}
                  className={`absolute right-3 bottom-3 p-2.5 rounded-full shadow-md transition-all ${
                    isListening 
                      ? "bg-rose-500 text-white animate-pulse" 
                      : "bg-purple-600 text-white hover:bg-purple-700 hover:scale-105"
                  }`}
                  title={isListening ? "Stop Recording" : "Start Live Mic Dictation"}
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
              </div>

              {isListening && (
                <p className="text-[11px] text-rose-500 font-bold animate-pulse text-center flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  Listening in {dictationLang === "hi-IN" ? "Hindi" : dictationLang === "ta-IN" ? "Tamil" : dictationLang === "te-IN" ? "Telugu" : dictationLang === "en-IN" ? "English" : "selected language"}... Speak now.
                  <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-black font-mono ml-1.5">
                    {formatRecordingTime(recordingSeconds)}
                  </span>
                </p>
              )}

              {/* Indian Language quick-simulate buttons  */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Test Indian Languages (Preloaded Demo Scenarios)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDictationLang("hi-IN");
                      setSmartDictationText("मरीज 52 साल का पुरुष है, उसे छाती में बहुत तेज दर्द हो रहा है। दर्द बाएं हाथ में फैल रहा है और पसीना आ रहा है। इतिहास में उच्च रक्तचाप है, वर्तमान दवा एम्लोडिपाइन है। आखिरी भोजन 4 घंटे पहले था। कोई एलर्जी नहीं है।");
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold transition-all"
                  >
                    🇮🇳 Hindi (मरीज 52...)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDictationLang("ta-IN");
                      setSmartDictationText("நோயாளிக்கு வயது 58, ஆண். கடந்த இரண்டு மணி நேரமாக கடுமையான நெஞ்சு வலி உள்ளது. இந்த வலி இடது கைகு பரவுகிறது. அவருக்கு உயர் இரத்த அழுத்தம் உள்ளது. அவர் மாத்திரை அஸ்ஸோசின் சாப்பிடுகிறார். அலர்ஜி எதுவும் இல்லை.");
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold transition-all"
                  >
                    🇮🇳 Tamil (நோயாளிக்கு...)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDictationLang("te-IN");
                      setSmartDictationText("రోగి వయస్సు 50 సంవత్సరాలు, పురుషుడు. గత రెండు గంటలుగా తీవ్రమైన ఛాతీ నొప్పి ఉంది. నొప్పి ఎడమ చేతికి వ్యాపిస్తోంది. బిపి ఎక్కువ ఉంది. ఆహారం 3 గంటల క్రితం తిన్నాడు.");
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold transition-all"
                  >
                    🇮🇳 Telugu (రోగి వయస్సు...)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDictationLang("en-IN");
                      setSmartDictationText("Patient is experiencing heavy chest tightness, patient bole ki bohot sweating ho rahi hai and pain left arm me jaa raha hai. Hyperlipidemia ki history hai, and no active allergies. Dinner completed 2 hours ago.");
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold transition-all"
                  >
                    🇮🇳 Mixed Hinglish Demo
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 border-t pt-3.5">
              <span className="text-[10px] text-slate-400 font-semibold font-mono flex items-center gap-1">
                🇮🇳 Translate & Map Active
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopRecording();
                    setShowDictationModal(false);
                  }}
                  className="px-4 py-2 border rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={async () => {
                    stopRecording();
                    await handleVoiceSubmit();
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Process with ErMate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Document Scanning Modal Simulation  */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold font-display text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Document Scanner & Clinical OCR Engine
              </h3>
              <button 
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Simulate Image OCR Input
              </label>
              
              <textarea
                rows={5}
                placeholder="Paste pre-scanned clinical report text here to simulate OCR processing (e.g. 'Lab report for Arthur Pendelton, age 62. Cardiac Troponin T is Positive at 0.45 ng/mL. Past history of hyperlipidemia.')"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOcrText("Patient: Arthur Pendelton. Lab results: Blood Sugar: 142 mg/dL. Troponin T: Positive (0.45 ng/mL). Medications: Lisinopril, Atorvastatin.")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold"
                >
                  Load Mock Lab Report
                </button>
                <button
                  type="button"
                  onClick={() => setOcrText("Discharge Summary from external clinic: Chloe Harrison, age 6. Severe wheezing on presentation, diagnosed with Asthma exacerbation. Allergic to Amoxicillin. Meds: Salbutamol inhaler.")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold"
                >
                  Load Mock Referral Summary
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3.5">
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 border rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleOcrSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Run OCR & Map Fields"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive UI Screen Close  */}
      </div>

      {/* Printable Document - Hidden on screen, shown only when printing  */}
      <div className="hidden print:block p-8 md:p-10 font-sans leading-relaxed text-[11px] text-slate-900 bg-white space-y-5 select-text max-w-full print:p-0">
        
        {currentCase.isPediatric ? (
          // BEAUTIFUL PEDIATRIC PRINT RECORD
          <div className="space-y-4">
            {/* Header section matching clinical template layout  */}
            <div className="border-b-4 border-double border-slate-800 pb-3 text-center space-y-1">
              <h2 className="text-sm md:text-base font-extrabold tracking-wide uppercase font-serif text-slate-950">
                <strong>{displayHospitalName}</strong>
              </h2>
              <p className="text-[10px] text-slate-600 tracking-wide uppercase font-semibold">
                <strong>Clinical Department of Emergency Medicine & Pediatrics Division</strong>
              </p>
              <div className="text-[9px] text-slate-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1">
                <span><strong>{displayHospitalAddress}</strong></span>
                <span>•</span>
                <span><strong>24x7 ER Hotline Available</strong></span>
              </div>
              <h1 className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white py-1 px-4 rounded-md inline-block mt-2">
                <strong>PEDIATRIC INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT RECORD</strong>
              </h1>
            </div>

            {/* Demographics  */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 border border-slate-300 p-3 rounded-xl bg-slate-50/40 text-[10px]">
              <div className="space-y-1">
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Patient Name:</strong></span>
                  <span className="font-bold text-slate-950 uppercase"><strong>{currentCase.patient.name}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Age/Sex:</strong></span>
                  <span className="font-bold text-slate-850"><strong>{currentCase.patient.age || "N/A"} Years / {currentCase.patient.gender}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Weight:</strong></span>
                  <span className="font-bold text-slate-950"><strong>{pediatricWeight === "" ? getAPLSEstimate(currentCase.patient.age) : pediatricWeight} kg</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Address:</strong></span>
                  <span className="font-semibold text-slate-850 text-right text-[9px]"><strong>{currentCase.pediatricDetails?.address || "Chunangamvely, Aluva, Ernakulam, Kerala - 683 112"}</strong></span>
                </p>
                <p className="flex justify-between">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Identification Mark:</strong></span>
                  <span className="font-bold text-slate-950"><strong>{currentCase.pediatricDetails?.identificationMark || "None"}</strong></span>
                </p>
              </div>
              <div className="space-y-1 border-l pl-4">
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Date & Time of Arrival:</strong></span>
                  <span className="font-semibold text-slate-850 font-mono"><strong>{currentCase.patient.dateOpened}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Date & Time of Incident:</strong></span>
                  <span className="font-semibold text-slate-850 font-mono"><strong>{currentCase.pediatricDetails?.dateTimeOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Place of Incident:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.pediatricDetails?.placeOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Nature / Mechanism:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.pediatricDetails?.natureOfIncident || "N/A"} / {currentCase.pediatricDetails?.mechanismOfInjury || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Brought By / Informant:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.pediatricDetails?.broughtBy || "N/A"} / {currentCase.pediatricDetails?.informant || "N/A"}</strong></span>
                </p>
              </div>
            </div>

            {/* Presenting Complaints  */}
            <div className="space-y-1 text-[10px]">
              <span className="font-black text-slate-950 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Presenting Complaints</strong>
              </span>
              <p className="p-2 bg-slate-50 rounded whitespace-pre-wrap text-[10px]">
                {currentCase.pediatricDetails?.presentingComplaints || currentCase.patient.presentingComplaint || "None reported"}
              </p>
            </div>

            {/* Primary Assessment Triangle (PAT)  */}
            <div className="space-y-1.5 text-[10px]">
              <span className="font-black text-slate-950 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Pediatric Assessment Triangle (PAT)</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-2 text-[10px]">
                <div>
                  <strong className="text-slate-700 block mb-1 underline">Appearance (TICLS)</strong>
                  <div className="grid grid-cols-2 gap-2">
                    <p><strong>Tone:</strong> {currentCase.pediatricDetails?.patAppearanceTone || "Normal spontaneous tone"}</p>
                    <p><strong>Interactivity:</strong> {currentCase.pediatricDetails?.patAppearanceInteractivity || "Normal alert interactivity"}</p>
                    <p><strong>Consolability:</strong> {currentCase.pediatricDetails?.patAppearanceConsolability || "Easily consolable by parent"}</p>
                    <p><strong>Look/Gaze:</strong> {currentCase.pediatricDetails?.patAppearanceLookGaze || "Makes normal eye contact"}</p>
                    <p className="col-span-2"><strong>Speech/Cry:</strong> {currentCase.pediatricDetails?.patAppearanceSpeechCry || "Age-appropriate vocalizations"}</p>
                  </div>
                </div>
                <div>
                  <strong className="text-orange-700 block mb-1 underline">Work of Breathing</strong>
                  <p>{currentCase.pediatricDetails?.patWorkOfBreathing || "Normal, no distress"}</p>
                </div>
                <div>
                  <strong className="text-red-700 block mb-1 underline">Circulation to Skin</strong>
                  <p>{currentCase.pediatricDetails?.patCirculation || "Pink, warm"}</p>
                </div>
              </div>
            </div>

            {/* ABCD Vital Assessment  */}
            <div className="space-y-1.5 text-[10px]">
              <span className="font-black text-slate-950 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Primary Survey (Airway, Breathing, Circulation, Disability, Exposure)</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1.5 text-[10px]">
                <p>
                  <strong>Airway Status:</strong> {currentCase.pediatricDetails?.airwayStatus || "Patent"} | 
                  <strong> Cry Quality:</strong> {currentCase.pediatricDetails?.airwayCry || "Good"} | 
                  <strong> Intervention:</strong> {currentCase.pediatricDetails?.airwayIntervention || "None"}
                </p>
                <p>
                  <strong>Breathing (RR- {currentCase.vitals.rr || "N/A"} | SpO2- {currentCase.vitals.spo2 || "N/A"}%):</strong> 
                  Work of Breathing: {currentCase.pediatricDetails?.breathingWob || "Normal"} | 
                  Abnormal Positioning: {currentCase.pediatricDetails?.breathingAbnormalPositioning || "NO"} | 
                  Air Entry: {currentCase.pediatricDetails?.breathingAirEntry || "Normal"} | 
                  Subcutaneous Emphysema: {currentCase.pediatricDetails?.breathingSubcutaneousEmphysema || "NO"} | 
                  Intervention: {currentCase.pediatricDetails?.breathingIntervention || "None"}
                </p>
                <p>
                  <strong>Circulation (HR- {currentCase.vitals.hr || "N/A"} | BP- {currentCase.vitals.bp || "N/A"}):</strong> 
                  CRT: {currentCase.pediatricDetails?.circulationCrt || "Normal"} | 
                  Distended Neck Veins: {currentCase.pediatricDetails?.circulationDistendedNeckVeins || "NO"} | 
                  Skin Color/Temp: {currentCase.pediatricDetails?.circulationSkinColorTemp || "Pink, warm"} | 
                  Intervention: {currentCase.pediatricDetails?.circulationIntervention || "None"}
                </p>
                <p>
                  <strong>Disability & Neurological:</strong> 
                  AVPU/GCS: {currentCase.pediatricDetails?.disabilityAvpuGcs || "Alert / GCS 15"} | 
                  Pupils: {currentCase.pediatricDetails?.disabilityPupils || "Equal and reactive"} | 
                  Abnormal Responses: {currentCase.pediatricDetails?.disabilityAbnormalResponses || "None"} | 
                  GRBS: {currentCase.vitals.grbs || "N/A"} mg/dL
                </p>
                <p>
                  <strong>Exposure & Spine Check:</strong> 
                  Temp: {currentCase.vitals.temp || "N/A"} °F | 
                  Trauma Survey (Logroll): {currentCase.pediatricDetails?.exposureTraumaLogroll || "Completed. No midline spinal tenderness."} | 
                  Signs of Trauma: {currentCase.pediatricDetails?.exposureSignsOfTrauma || "None"} | 
                  Evidence of Infection/Bleeding: {currentCase.pediatricDetails?.exposureEvidenceInfectionBleeding || "None"} | 
                  Deformities: {currentCase.pediatricDetails?.exposureLongBoneDeformities || "NO"} | 
                  Extremities: {currentCase.pediatricDetails?.exposureExtremitiesCheck || "No abnormalities"} | 
                  Immobilize: {currentCase.pediatricDetails?.exposureImmobilizeInjuredLimbs || "NO"}
                </p>
                <p>
                  <strong>Adjuvant / EFAST Ultrasound:</strong> 
                  Heart: {currentCase.pediatricDetails?.adjuvantEfastHeart || "No effusion"} | 
                  Abdomen: {currentCase.pediatricDetails?.adjuvantEfastAbdomen || "No free fluid"} | 
                  Lungs: {currentCase.pediatricDetails?.adjuvantEfastLungs || "Normal lung sliding"} | 
                  Pelvis: {currentCase.pediatricDetails?.adjuvantEfastPelvis || "Stable"}
                </p>
              </div>
            </div>

            {/* Secondary Survey History & Examination  */}
            <div className="space-y-1.5 text-[10px]">
              <span className="font-black text-slate-950 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Secondary Assessment (Focused Pediatric History & Examination)</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-2 text-[10px]">
                <p><strong>Signs & Symptoms:</strong> {currentCase.pediatricDetails?.historySignsSymptoms || currentCase.sampleHistory?.symptoms || "None"}</p>
                <p><strong>Allergies:</strong> {currentCase.pediatricDetails?.historyAllergies || currentCase.sampleHistory?.allergies || "NKDA (No Known Drug Allergies)"}</p>
                <p><strong>Medications:</strong> {currentCase.pediatricDetails?.historyMedications || currentCase.sampleHistory?.medications || "None"}</p>
                <p><strong>Past Medical History:</strong> {currentCase.pediatricDetails?.historyPastMedical || currentCase.sampleHistory?.pastHistory || "Unremarkable developmental history"}</p>
                <p><strong>Last Meal:</strong> {currentCase.pediatricDetails?.historyLastMeal || currentCase.sampleHistory?.lastMeal || "Light oral fluids"}</p>
                {((currentCase.pediatricDetails?.historyEvents &&
                   currentCase.pediatricDetails.historyEvents.trim() &&
                   !["none", "n/a", "nil", "refer to complaints"].includes(currentCase.pediatricDetails.historyEvents.trim().toLowerCase())) ||
                  (currentCase.sampleHistory?.events &&
                   currentCase.sampleHistory.events.trim() &&
                   !["none", "n/a", "nil", "refer to complaints"].includes(currentCase.sampleHistory.events.trim().toLowerCase()))) && (
                  <p><strong>Preceding Events / Trauma:</strong> {currentCase.pediatricDetails?.historyEvents || currentCase.sampleHistory?.events}</p>
                )}
                <p className="border-t pt-1.5 mt-1"><strong>HEENT:</strong> {currentCase.pediatricDetails?.examHeent || "Normocephalic, pupils equal and reactive"}</p>
                <p><strong>Respiratory:</strong> {currentCase.pediatricDetails?.examRespiratory || "Lungs clear, symmetrical breath sounds"}</p>
                <p><strong>Cardiovascular:</strong> {currentCase.pediatricDetails?.examCardiovascular || "S1 S2 heard clearly, normal rhythm"}</p>
                <p><strong>Abdomen:</strong> {currentCase.pediatricDetails?.examAbdomen || "Soft, non-tender, non-distended"}</p>
                <p><strong>Back / Spine:</strong> {currentCase.pediatricDetails?.examBack || "No spinal tenderness"}</p>
                <p><strong>Extremities:</strong> {currentCase.pediatricDetails?.examExtremities || "Full range of motion, no deformities"}</p>
              </div>
            </div>

            {/* Course, Diagnosis & Disposition  */}
            <div className="space-y-1.5 text-[10px]">
              <span className="font-black text-slate-950 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Course, Treatment, & Provisional Diagnosis</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1.5 text-[10px]">
                <p><strong>Hospital Clinical Course:</strong> {currentCase.pediatricDetails?.courseInHospital || "Evaluated and monitored in ED"}</p>
                <p><strong>Treatment Given in Hospital:</strong> {currentCase.pediatricDetails?.treatmentGiven || "Observation and reassuring counseling"}</p>
                <p><strong>Provisional Diagnosis at Discharge/Shift:</strong> <strong>{currentCase.pediatricDetails?.provisionalDiagnosisDischarge || "Clinically stable child"}</strong></p>
                <p><strong>Differential Diagnosis:</strong> {currentCase.pediatricDetails?.differentialDiagnosis || "None"}</p>
              </div>
            </div>

            {/* Disposition & Clinicians  */}
            <div className="grid grid-cols-3 gap-4 border border-slate-300 p-3 rounded-xl bg-slate-50/40 text-[10px] mt-4">
              <div>
                <strong>Disposition / Condition:</strong> {currentCase.pediatricDetails?.disposition || "Ward"} / {currentCase.pediatricDetails?.conditionAtShift || "Stable"}
              </div>
              <div>
                <strong>EM Resident:</strong> {currentCase.pediatricDetails?.emResident || "Dr. Thomas"}
              </div>
              <div>
                <strong>EM Consultant:</strong> {currentCase.pediatricDetails?.emConsultant || currentCase.consultantName || "Duty Consultant"}
              </div>
            </div>
          </div>
        ) : (
          // STANDARD ADULT PRINT RECORD
          <>
            {/* Header section matching clinical template layout  */}
            <div className="border-b-4 border-double border-slate-800 pb-3 text-center space-y-1">
              <h2 className="text-sm md:text-base font-extrabold tracking-wide uppercase font-serif text-slate-950">
                <strong>{displayHospitalName}</strong>
              </h2>
              <p className="text-[10px] text-slate-600 tracking-wide uppercase font-semibold">
                <strong>Clinical Department of Emergency Medicine & Trauma Services</strong>
              </p>
              <div className="text-[9px] text-slate-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1">
                <span><strong>{displayHospitalAddress}</strong></span>
                <span>•</span>
                <span><strong>24x7 ER Hotline Available</strong></span>
              </div>
              <h1 className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white py-1 px-4 rounded-md inline-block mt-2">
                <strong>INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD</strong>
              </h1>
            </div>

            {/* Patient Demographics & MLC info  */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 border border-slate-300 p-3.5 rounded-xl bg-slate-50/40 text-[10px]">
              <div className="space-y-1">
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Patient Name:</strong></span>
                  <span className="font-bold text-slate-950 uppercase"><strong>{currentCase.patient.name}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Age/Sex:</strong></span>
                  <span className="font-bold text-slate-850"><strong>{currentCase.patient.age || "N/A"} Years / {currentCase.patient.gender}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Address:</strong></span>
                  <span className="font-semibold text-slate-850 text-right"><strong>Chunangamvely, Aluva, Ernakulam, Kerala - 683 112</strong></span>
                </p>
                <p className="flex justify-between">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Phone Number:</strong></span>
                  <span className="font-bold font-mono text-slate-950"><strong>{currentCase.patient.phone || "Not Provided"}</strong></span>
                </p>
              </div>
              <div className="space-y-1 border-l pl-4">
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Date & Time of Arrival:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.dateOpened}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Date & Time of Accident:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.dateTimeOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Place of Accident:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.placeOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Nature of Accident:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Mechanism of Injury:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.natureOfIncident || "N/A"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Brought By:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}</strong></span>
                </p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Informant:</strong></span>
                  <span className="font-semibold text-slate-850"><strong>{currentCase.patient.mlcDetails?.informantBroughtBy || "Self"}</strong></span>
                </p>
                <p className="flex justify-between">
                  <span className="font-extrabold text-slate-500 uppercase"><strong>Identification Mark:</strong></span>
                  <span className="font-bold text-slate-850"><strong>{currentCase.patient.mlcDetails?.identificationMark || "Black mole over face/neck"}</strong></span>
                </p>
              </div>
            </div>

            {/* Presenting Complaint  */}
            <div className="space-y-1">
              <span className="font-black text-[10px] text-slate-900 block uppercase tracking-wide border-b pb-0.5 border-slate-300">
                <strong>Presenting Complaint</strong>
              </span>
              <p className="p-2 bg-slate-50 rounded whitespace-pre-wrap text-[10px]">
                {currentCase.patient.presentingComplaint || "None"}
              </p>
            </div>

            {/* Primary Assessment  */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Primary Assessment</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1.5 text-[10px]">
                <p><strong>Airway</strong> → {currentCase.primaryAssessment.airway || "Patent"} / {currentCase.primaryAssessment.airwayStatus || "Normal"}, <strong>Intervention-</strong> {currentCase.primaryAssessment.airway === "Patent" ? "None" : "Oral airway / Collar"}</p>
                <p><strong>Breathing</strong> → <strong>RR-</strong> {currentCase.vitals.rr || "N/A"}, <strong>SPO2-</strong> {currentCase.vitals.spo2 || "N/A"}%, <strong>Work of breathing-</strong> {currentCase.primaryAssessment.breathing || "Normal"}, <strong>Air entry-</strong> Symmetrical bilaterally, <strong>CCT-</strong> Normal, <strong>Subcutaneous emphysema-</strong> Absent, <strong>EFAST-</strong> Negative, <strong>Intervention-</strong> None.</p>
                <p><strong>Circulation</strong> → <strong>CRT-</strong> &lt; 2s, <strong>HR-</strong> {currentCase.vitals.hr || "N/A"} bpm, <strong>BP-</strong> {currentCase.vitals.bp || "N/A"} mmHg, <strong>Distended Neck Veins-</strong> No, <strong>PCT-</strong> Normal, <strong>Long bone deformity-</strong> None, <strong>FAST-</strong> Negative, <strong>Interventions-</strong> IV access.</p>
                <p><strong>Disability</strong> → <strong>AVPU/GCS-</strong> {currentCase.vitals.avpu || "Alert"} / {calculatedGcs}/15 (E{currentCase.vitals.gcs_e || "4"} V{currentCase.vitals.gcs_v || "5"} M{currentCase.vitals.gcs_m || "6"}), <strong>Pupils-</strong> Equal and Reactive, <strong>GRBS-</strong> {currentCase.vitals.grbs || "N/A"} mg/dL</p>
                <p><strong>Exposure</strong> → <strong>Temp-</strong> {currentCase.vitals.temp || "N/A"} °F, <strong>Logroll</strong> - Completed (No spinal tenderness), <strong>Local Examination-</strong> {currentCase.primaryAssessment.exposure || "Unremarkable"}</p>
              </div>
            </div>

            {/* Adjuvants to Primary  */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Adjuvants to Primary</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1 text-[10px]">
                <p><strong>ECG:</strong> Normal sinus rhythm, no acute ST-T changes.</p>
                <p><strong>VBG - PH:</strong> 7.38 | <strong>PCO2:</strong> 40 mmHg | <strong>HC03:</strong> 24 mEq/L | <strong>HB:</strong> 14.2 g/dL | <strong>GLU:</strong> 105 mg/dL | <strong>LAC:</strong> 1.1 mmol/L | <strong>NA:</strong> 138 mEq/L | <strong>K:</strong> 4.1 mEq/L | <strong>CR:</strong> 0.9 mg/dL</p>
                <p><strong>Bed side Screening Echo:</strong> 1. Good LVM, IVC Collapsing, No B-lines, No RWMA, No RA RV strain.</p>
              </div>
            </div>

            {/* History of Present Illness  */}
            <div className="space-y-1">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>History of Present Illness</strong>
              </span>
              <p className="p-2 bg-slate-50 rounded whitespace-pre-wrap text-[10px]">
                {currentCase.sampleHistory.symptoms || currentCase.patient.presentingComplaint || "None reported"}
              </p>
            </div>

            {/* Secondary Survey  */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Secondary Survey</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1 text-[10px]">
                <p><strong>Signs and Symptoms:</strong> {currentCase.sampleHistory.symptoms || "None"}</p>
                <p><strong>Past medical history:</strong> {currentCase.sampleHistory.pastHistory || "None"}</p>
                {currentCase.sampleHistory.events && currentCase.sampleHistory.events.trim() && !["none", "n/a", "nil"].includes(currentCase.sampleHistory.events.trim().toLowerCase()) && (
                  <p><strong>Preceding Events / Trauma:</strong> {currentCase.sampleHistory.events}</p>
                )}
                <p><strong>Surgical history:</strong> None reported.</p>
                <p><strong>Family / Gynae History:</strong> {currentCase.sampleHistory.familyHistory || "Unremarkable"}</p>
                <p><strong>LMP:</strong> {currentCase.isPediatric ? "N/A" : "Normal / Not applicable"}</p>
                <p><strong>Allergies:</strong> {currentCase.sampleHistory.allergies || "NKDA (No Known Drug Allergies)"}</p>
              </div>
            </div>

            {/* General Examination & Systemic Examination  */}
            {(() => {
              const sec = parseSecondaryAssessment(currentCase.secondaryAssessment || "");
              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                        <strong>General Examination</strong>
                      </span>
                      <p className="p-2 bg-slate-50 rounded text-[10px] leading-relaxed">
                        {sec.General || "Pallor: Absent, Icterus: Absent, Clubbing: Absent, Lymphadenopathy: None, Thyroid: Normal, Varicose Veins: None. (P/I/C/C/L/E)"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                        <strong>Extremities and Back</strong>
                      </span>
                      <p className="p-2 bg-slate-50 rounded text-[10px] leading-relaxed">
                        {sec.Extremities || "No visible abnormalities at the time of examination."}
                      </p>
                    </div>
                  </div>

                  {/* Systemic Examination  */}
                  <div className="space-y-1.5">
                    <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                      <strong>Systemic Examination</strong>
                    </span>
                    <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1.5 text-[10px]">
                      <p><strong>CVS:</strong> {sec.CVS || `- S1, S2: Normal, Pulse: Regular ${currentCase.vitals.hr || "75"} bpm, Apex Beat: Normal, localized in the 5th intercostal space, midclavicular line. Precordial Heave: Absent, Added Sounds: None, Murmurs: None`}</p>
                      <p><strong>CHEST / RS:</strong> {sec.RS || `- Expansion: Equal bilaterally, Percussion: Resonant bilaterally, Breath Sounds: Vesicular, equal bilaterally, Vocal Resonance: Normal, Added Sounds: None.`}</p>
                      <p><strong>Abdomen (PA):</strong> {sec.PA || `- Umbilical: Central, no abnormalities, Organomegaly: None, Percussion: Normal tympany, no dullness. Bowel Sounds: Normal, active in all quadrants, External Genitalia: Normal, no abnormalities. Hernial Orifices: No bulging, Per Rectal: No tenderness, normal tone, Per Vaginal: Normal findings.`}</p>
                      <p><strong>CNS:</strong> {sec.CNS || `- Higher Mental Functions: Normal, alert and oriented, Cranial Nerves: Intact (I-XII), Sensory System: Normal, intact to light touch, pain, and temperature, Motor System: Normal muscle tone, strength 5/5 in all limbs, Reflex: Normal deep tendon reflexes (2+), no pathological reflexes, Romberg Sign: Negative, Cerebellar Signs: No dysmetria, normal finger-nose test, Signs of Meningeal Irritation: None, Gait: Normal, steady, no ataxia, Carotid Bruit: None.`}</p>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Psychological Assessment  */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Psychological Assessment</strong>
              </span>
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/20 space-y-1 text-[10px]">
                <p>1. <strong>Have you been feeling persistently low, excessively worried, angry, or finding it hard to focus lately?:</strong> No.</p>
                <p>2. <strong>Have you noticed hearing or seeing things that others don't, or feeling unusually energetic or restless for long periods?:</strong> No.</p>
                <p>3. <strong>Do you regularly use alcohol, tobacco, or any other substances (including recreational or non-prescribed drugs)?:</strong> No.</p>
                <p>4. <strong>Is the individual currently feeling confused or agitated?:</strong> No.</p>
                <p>5. <strong>Have you ever had thoughts of ending your life, or have you ever attempted to harm yourself?:</strong> No.</p>
                <p>6. <strong>Have you ever received treatment or support for mental health, psychological issues, or substance use problems?:</strong> No.</p>
                <p>7. <strong>Additional Observations:</strong> Nil</p>
              </div>
            </div>

            {/* Investigations  */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Investigations</strong>
              </span>
              <div className="grid grid-cols-2 gap-4 text-[9px] font-mono">
                <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
                  <p><strong>ER BASIC:</strong> CBC, URE</p>
                  <p><strong>ER ADVANCE:</strong> CBC, CRP, RFT, LFT, URE, S.ELECTROLYTES</p>
                  <p><strong>NSTEMI PANEL:</strong> CBC, CRP, RFT, S.ELECTROLYTES, URE</p>
                  <p><strong>ACUTE STROKE CODE 7:</strong> CBC, BLOOD GROUPING WITH ANTIBODY SCREENING, LFT, S.ELECTROLYTES, PT INR, URE, CT ANGIOGRAM, MRI SINGLE SEQUENCE, X RAY CHEST AP, HIV ANTIGEN AND ANTIBODY, HBSAG, ANTI HCV</p>
                  <p><strong>STEMI PANEL:</strong> CBC, CRP, RFT, LFT, S.ELECTROLYTES, URE, BLOOD GROUPING WITH ANTIBODY SCREENING, HBSAG, ANTI HCV, HIV ANTIGEN AND ANTIBODY</p>
                </div>
                <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
                  <p><strong>PA PANEL EMERGENCY:</strong> LFT, CBC, CRP, RFT, S.ELECTROLYTES, PT INR, BLOOD GROUPING WITH ANTIBODY SCREENING, ANTI HCV, HBSAG, X RAY CHEST AP</p>
                  <p><strong>ADULT SEIZURE PANEL:</strong> CBC, CRP, LFT, RFT, S.ELECTROLYTES, URE, CALCIUM, MAGNESIUM, PHOSPHORUS</p>
                  <p><strong>PEDIA MINI PANEL:</strong> CBC, CRP, CREATININE, LFT MINI, S.ELECTROLYTES</p>
                  <p><strong>PA PANEL PEDIATRICS SURGERY:</strong> CBC, CRP, RFT, HIV ANTIGEN AND ANTIBODY, HBSAG, ANTI HCV, LFT MINI PANEL</p>
                  <p><strong>PEDIATRIC FEBRILE SEIZURE PANEL:</strong> CBC, CRP, RFT, LFT, S.ELECTROLYTES, URE, CALCIUM, PHOSPHORUS, MAGNESIUM, ESR, CULTURE AND SENSITIVITY BLOOD</p>
                </div>
              </div>
            </div>

            {/* Treatment Plan & Active Meds  */}
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div className="space-y-1">
                <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                  <strong>Treatment Plan - Medications & Infusions</strong>
                </span>
                <div className="p-2 border rounded whitespace-pre-wrap font-mono">
                  <strong>Active Medications Given:</strong>{"\n"}{currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose} (${t.route})`).join("\n") || "None logged"}
                  {"\n\n"}<strong>Active Infusions:</strong>{"\n"}{currentCase.infusions?.map((inf, idx) => `${idx + 1}. ${inf.fluidName} - Dose: ${inf.dose}, Dilution: ${inf.dilution}, Rate: ${inf.rate}`).join("\n") || "None logged"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                  <strong>Procedures Checked / Performed</strong>
                </span>
                <div className="p-2 border rounded font-mono">
                  <strong>Procedures Done:</strong> {[
                    ...(currentCase.proceduresChecked || []).map(p => {
                      if (p === 'foleys') return "Foley's Catheterization";
                      if (p === 'ng_tube') return "NG Tube Insertion";
                      if (p === 'gastric_lavage') return "Gastric Lavage";
                      if (p === 'suturing') return "Wound Suturing/Closure";
                      if (p === 'irrigation') return "Wound Irrigation";
                      if (p === 'splinting') return "Fracture Splinting";
                      if (p === 'reduction') return "Joint Reduction";
                      return p;
                    }),
                    currentCase.otherProcedures ? `Other Procedures: ${currentCase.otherProcedures}` : ""
                  ].filter(Boolean).join(", ") || 'No procedures performed.'}
                </div>
              </div>
            </div>

            {/* Progress Notes  */}
            <div className="space-y-1">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Continuous Progress Notes Log</strong>
              </span>
              <p className="p-2 bg-slate-50 rounded whitespace-pre-wrap text-[10px]">
                {currentCase.progressNotes || "No progress notes recorded."}
              </p>
            </div>

            {/* Disposition & Clinicians  */}
            <div className="grid grid-cols-3 gap-4 border border-slate-300 p-3.5 rounded-xl bg-slate-50/40 text-[10px] mt-4">
              <div>
                <strong>Disposition:</strong> {currentCase.dispositionDetails?.dispositionType || "Discharge"}
                <p className="text-[9px] text-slate-500 mt-0.5">(ICU, Room, Ward, Referral, DAMA)</p>
              </div>
              <div>
                <strong>EM Resident:</strong> {currentCase.dispositionDetails?.residentName || "Dr. Thomas"}
              </div>
              <div>
                <strong>EM Consultant:</strong> {currentCase.dispositionDetails?.consultantName || currentCase.consultantName || "Duty Consultant"}
              </div>
            </div>
          </>
        )}

      </div>

      {/* 3. Post-Save Clinical Debrief Nudge Modal  */}
      {showPostSaveModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-6">
            
            {/* Success Banner  */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold font-display text-slate-800 dark:text-white">
                Case Successfully Saved & Committed! 🎉
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Patient <strong>{currentCase.patient.name}</strong> ({currentCase.patient.age}y {currentCase.patient.gender}) has been securely logged. The discharge summary was synced in the background.
              </p>
            </div>

            {/* Post-save nudge content  */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 font-mono uppercase tracking-widest">
                    Quick Post-Save Clinical Lenses
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Select any lens for immediate debrief</span>
              </div>

              {/* Grid of 3 quick lenses  */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "first-principles" as const, label: "First Principles", icon: Brain, desc: "Physiologic deconstruction" },
                  { id: "devils-advocate" as const, label: "Devil's Advocate", icon: ShieldAlert, desc: "Mimics & cognitive safety" },
                  { id: "rare-but-real" as const, label: "Rare but Real", icon: AlertTriangle, desc: "Atypical red flags" }
                ].map((lens) => {
                  const Icon = lens.icon;
                  return (
                    <button
                      key={lens.id}
                      onClick={() => {
                        fetchRoundsDebrief(lens.id);
                        setActiveTab("rounds");
                        setShowPostSaveModal(false);
                      }}
                      className="p-3 bg-white hover:bg-indigo-50/50 dark:bg-slate-950 dark:hover:bg-indigo-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-left transition-all hover:scale-[1.02] flex flex-col justify-between h-24 shadow-xs"
                    >
                      <div className="w-7 h-7 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[10px] text-slate-800 dark:text-white uppercase tracking-wide truncate">{lens.label}</h4>
                        <p className="text-[8px] text-slate-400 line-clamp-2 mt-0.5">{lens.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Clinical Memory Save  */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 dark:from-indigo-950/15 dark:to-blue-950/5 border border-indigo-150 dark:border-indigo-900/30 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-indigo-950 dark:text-indigo-400 uppercase tracking-wide text-[10px]">
                  Clinical Memory Portfolio Logging
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm">
                  Automatically extract this case's core medical pearl and save it to your private career diary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  saveCaseToClinicalMemory();
                }}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 ${
                  roundsSavedToMemory
                    ? "bg-emerald-500 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {roundsSavedToMemory ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Logged! 📓
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5" /> Log Case Pearl
                  </>
                )}
              </button>
            </div>

            {/* Modal Actions  */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPostSaveModal(false);
                  onBack(); // Return to cases/dashboard
                }}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Dismiss & Exit Case
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("rounds");
                  setShowPostSaveModal(false);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                Open 7-Lens Rounds <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* View Case Sheet PDF Modal Preview Overlay  */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
            {/* Modal Top Control Header  */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Clinical Case Sheet PDF Preview</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {currentCase.patient.name} · UHID: {currentCase.patient.uhid || "N/A"} · Case ID: {currentCase.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCaseSheet}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download raw case sheet text"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Text
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrintWithTip()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Print / Save as PDF document"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Container  */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div className="bg-white text-slate-900 p-6 md:p-10 rounded-xl shadow-lg border border-slate-200 w-full max-w-3xl font-sans text-[11px] leading-relaxed space-y-5 select-text">
                {/* Header section matching clinical template layout  */}
                <div className="border-b-4 border-double border-slate-800 pb-3 text-center space-y-1">
                  <h2 className="text-sm md:text-base font-extrabold tracking-wide uppercase font-serif text-slate-950">
                    <strong>{displayHospitalName}</strong>
                  </h2>
                  <p className="text-[10px] text-slate-600 tracking-wide uppercase font-semibold">
                    <strong>Clinical Department of Emergency Medicine & Trauma Center</strong>
                  </p>
                  <div className="text-[9px] text-slate-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <span><strong>{displayHospitalAddress}</strong></span>
                    <span>•</span>
                    <span><strong>24x7 ER Hotline Available</strong></span>
                  </div>
                  <h1 className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white py-1 px-4 rounded-md inline-block mt-2">
                    <strong>EMERGENCY DEPARTMENT INITIAL ASSESSMENT & CASE RECORD</strong>
                  </h1>
                </div>

                {/* Patient Demographics Box  */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 border border-slate-300 p-3 rounded-xl bg-slate-50/40 text-[10px]">
                  <div className="space-y-1">
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">Patient Name:</span>
                      <span className="font-bold text-slate-950 uppercase">{currentCase.patient.name}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">Age/Sex:</span>
                      <span className="font-bold text-slate-850">{currentCase.patient.age || "N/A"} Yrs / {currentCase.patient.gender}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">UHID:</span>
                      <span className="font-mono font-bold text-slate-900">{currentCase.patient.uhid || "N/A"}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-extrabold text-slate-500 uppercase">Triage Category:</span>
                      <span className="font-bold text-indigo-700">{currentCase.patient.triageCategory}</span>
                    </p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">Date/Time Opened:</span>
                      <span className="font-semibold text-slate-850 font-mono">{currentCase.patient.dateOpened}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">Case Type:</span>
                      <span className="font-semibold text-slate-850">{currentCase.patient.caseType}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-extrabold text-slate-500 uppercase">Doctor On Duty:</span>
                      <span className="font-bold text-slate-900">{formatDoctorName(currentCase.doctorName)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-extrabold text-slate-500 uppercase">MLC Status:</span>
                      <span className="font-bold text-slate-850">{currentCase.patient.isMlc ? "YES (MLC Registered)" : "NO"}</span>
                    </p>
                  </div>
                </div>

                {/* Presenting Complaints & Vitals  */}
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase border-b border-slate-300 pb-0.5 text-[10px]">
                    Presenting Complaint & Initial Vitals
                  </h4>
                  <p className="p-2 bg-slate-50 rounded text-slate-800">
                    {currentCase.patient.presentingComplaint || "No complaint recorded."}
                  </p>
                  <div className="grid grid-cols-5 gap-2 p-2 bg-slate-100/60 rounded text-center text-[10px] font-mono">
                    <div><span className="text-slate-500 block text-[8px] uppercase">BP</span><strong>{currentCase.vitals.bp || "N/A"}</strong></div>
                    <div><span className="text-slate-500 block text-[8px] uppercase">HR</span><strong>{currentCase.vitals.hr || "N/A"} bpm</strong></div>
                    <div><span className="text-slate-500 block text-[8px] uppercase">SpO2</span><strong>{currentCase.vitals.spo2 || "N/A"}%</strong></div>
                    <div><span className="text-slate-500 block text-[8px] uppercase">RR</span><strong>{currentCase.vitals.rr || "N/A"}/m</strong></div>
                    <div><span className="text-slate-500 block text-[8px] uppercase">Temp</span><strong>{formatTemperature(currentCase.vitals.temp)}</strong></div>
                  </div>
                </div>

                {/* Primary Survey (ABCDE)  */}
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 uppercase border-b border-slate-300 pb-0.5 text-[10px]">
                    Primary Survey (ABCDE Assessment)
                  </h4>
                  <div className="space-y-1 text-[10px] bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p><strong>Airway:</strong> {currentCase.primaryAssessment.airway || "Patent and clear"}</p>
                    <p><strong>Breathing:</strong> {currentCase.primaryAssessment.breathing || "Bilateral breath sounds present"}</p>
                    <p><strong>Circulation:</strong> {currentCase.primaryAssessment.circulation || "Peripheral pulses palpable, CRT < 2 sec"}</p>
                    <p><strong>Disability:</strong> {currentCase.primaryAssessment.disability || "Alert, GCS 15/15"}</p>
                    <p><strong>Exposure:</strong> {currentCase.primaryAssessment.exposure || "No external trauma or injuries noted"}</p>
                  </div>
                </div>

                {/* SAMPLE History  */}
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 uppercase border-b border-slate-300 pb-0.5 text-[10px]">
                    SAMPLE History & Clinical Evolution
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p><strong>Symptoms:</strong> {currentCase.sampleHistory.symptoms || "As presenting complaint"}</p>
                    <p><strong>Allergies:</strong> {currentCase.sampleHistory.allergies || "NKDA"}</p>
                    <p><strong>Medications:</strong> {currentCase.sampleHistory.medications || "Nil regular"}</p>
                    <p><strong>Past Medical History:</strong> {currentCase.sampleHistory.pastHistory || "None reported"}</p>
                    <p className="col-span-2"><strong>Events & Course:</strong> {currentCase.sampleHistory.events || currentCase.progressNotes || "Stabilized in Emergency Ward."}</p>
                  </div>
                </div>

                {/* Treatments Administered  */}
                {currentCase.treatments && currentCase.treatments.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-black text-slate-900 uppercase border-b border-slate-300 pb-0.5 text-[10px]">
                      Emergency Treatments & Medications Given
                    </h4>
                    <table className="w-full border-collapse border border-slate-200 text-[10px] text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold">
                          <th className="p-1.5 border border-slate-200">Medication / Procedure</th>
                          <th className="p-1.5 border border-slate-200">Dose</th>
                          <th className="p-1.5 border border-slate-200">Route</th>
                          <th className="p-1.5 border border-slate-200">Time Given</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deduplicateMeds(currentCase.treatments).map((t, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="p-1.5 border border-slate-200 font-bold">{t.drugName}</td>
                            <td className="p-1.5 border border-slate-200">{t.dose}</td>
                            <td className="p-1.5 border border-slate-200">{validateMedRoute(t.drugName, t.route)}</td>
                            <td className="p-1.5 border border-slate-200 font-mono">{t.timeGiven}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Disposition & Signatures  */}
                <div className="space-y-2 pt-2 border-t border-slate-300">
                  <div className="flex justify-between text-[10px]">
                    <p><strong>Disposition Outcome:</strong> <span className="uppercase font-bold text-indigo-800">{currentCase.dispositionDetails?.dispositionType || "Discharged"}</span></p>
                    <p><strong>Condition at Transfer/Shift:</strong> <span className="font-bold">{currentCase.conditionAtShift || "Stable"}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-6 text-[10px] text-center border-t border-slate-200">
                    <div>
                      <p className="font-bold border-b border-slate-400 pb-1 max-w-[180px] mx-auto">{formatDoctorName(currentCase.dispositionDetails?.residentName || currentCase.doctorName)}</p>
                      <p className="text-slate-500 text-[9px] mt-0.5">Resident Emergency Physician Signature</p>
                    </div>
                    <div>
                      <p className="font-bold border-b border-slate-400 pb-1 max-w-[180px] mx-auto">{formatDoctorName(currentCase.dispositionDetails?.consultantName || currentCase.consultantName || "Dr. Consultant EM")}</p>
                      <p className="text-slate-500 text-[9px] mt-0.5">Consultant / Attending Physician Signature</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
