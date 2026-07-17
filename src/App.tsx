import React, { useState, useEffect } from "react";
import { 
  Activity, Sparkles, BookOpen, User, Clock, ShieldAlert, 
  Settings, HelpCircle, Trophy, ClipboardList, Zap, Moon, Sun, Users,
  Search, X, TrendingUp
} from "lucide-react";

import { 
  ClinicalCase, UserProfile, PatientDemographics, PatientVitals, 
  DischargeInfo, TriageCategory, ArrivalMode, HandoverRecord
} from "./types";

import DashboardView from "./components/DashboardView";
import CasesListView from "./components/CasesListView";
import CaseSheetView from "./components/CaseSheetView";
import DischargeSummaryView from "./components/DischargeSummaryView";
import TriageForm from "./components/TriageForm";
import LearnView from "./components/LearnView";
import HandoverChatView from "./components/HandoverChatView";
import ProfileSettingsView from "./components/ProfileSettingsView";
import MockLoginView from "./components/MockLoginView";
import VoiceScribeChatView from "./components/VoiceScribeChatView";
import SignUpView from "./components/SignUpView";
import ForgotPasswordView from "./components/ForgotPasswordView";
import PediatricDrugCalculatorView from "./components/PediatricDrugCalculatorView";
import AnalyticsView from "./components/AnalyticsView";
import HandoverView from "./components/HandoverView";
import PocketMirrorView from "./components/PocketMirrorView";

import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";

interface StaticReference {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
}

const LOCAL_REFERENCES: StaticReference[] = [
  {
    id: "ref-anaphylaxis",
    title: "Anaphylaxis Emergency Protocol",
    category: "Resuscitation / Immunology",
    summary: "Immediate intramuscular epinephrine is life-saving. Secure airway early, administer high-flow oxygen, and support blood pressure with aggressive IV fluid resuscitation.",
    keyPoints: [
      "Epinephrine: 0.3-0.5 mg IM (1:1000) in anterolateral thigh. Repeat every 5-15 mins.",
      "IV Resuscitation: 1-2 Litres Normal Saline bolus for hypotension.",
      "Bronchospasm: Nebulized Salbutamol 2.5-5 mg for refractory wheezing.",
      "Antihistamines: Diphenhydramine 25-50 mg IV plus Famotidine 20 mg IV.",
      "Steroids: Methylprednisolone 125 mg IV or Hydrocortisone 200 mg IV."
    ]
  },
  {
    id: "ref-stemi",
    title: "Acute STEMI Reperfusion Algorithm",
    category: "Cardiology",
    summary: "Time-critical myocardial salvage. Perform 12-lead ECG within 10 minutes of arrival. Select reperfusion strategy based on PCI availability.",
    keyPoints: [
      "ECG: 12-lead ECG read by physician within 10 minutes of presentation.",
      "Antiplatelets: Aspirin 325 mg chewed and swallowed, Clopidogrel 300-600 mg loading dose.",
      "Anticoagulation: Unfractionated Heparin 60 U/kg bolus (max 4000U), then 12 U/kg/hr infusion.",
      "PCI: Primary PCI door-to-balloon time target of < 90 minutes.",
      "Fibrinolysis: If PCI is unavailable within 120 minutes, deliver thrombolytics within 30 minutes."
    ]
  },
  {
    id: "ref-stroke",
    title: "Acute Ischemic Stroke (tPA Protocol)",
    category: "Neurology",
    summary: "Brain-saving time window. Establish Last Known Normal (LKN) time, check blood glucose, and perform non-contrast head CT to rule out hemorrhage.",
    keyPoints: [
      "LKN: Confirm onset of focal neurological deficits is within 4.5 hours.",
      "CT Brain: Emergency non-contrast CT head to exclude intracranial hemorrhage.",
      "Blood Pressure: Keep BP < 185/110 mmHg before thrombolysis, maintain < 180/105 mmHg after.",
      "tPA: Alteplase 0.9 mg/kg (max 90 mg) or Tenecteplase 0.25 mg/kg (max 25 mg) over 1 min.",
      "Avoid Anticoagulants: Do not give heparin, aspirin, or clopidogrel for 24 hours post-tPA."
    ]
  },
  {
    id: "ref-dka",
    title: "Diabetic Ketoacidosis (DKA) Protocol",
    category: "Endocrinology",
    summary: "Manage dehydration, correct electrolyte disturbances, and shut down ketone production with continuous insulin infusion.",
    keyPoints: [
      "Fluid Bolus: 1-1.5 Litres Normal Saline (0.9% NaCl) in the first hour.",
      "Insulin: Continuous regular insulin infusion at 0.1 U/kg/hour (delay if K < 3.3 mEq/L).",
      "Potassium: Add 20-30 mEq K per litre of fluid when serum K falls below 5.2 mEq/L.",
      "Glucose Target: When glucose drops to 250 mg/dL, add 5% dextrose (D5 1/2NS) and reduce insulin rate to 0.02-0.05 U/kg/hour.",
      "Anion Gap: Continue insulin infusion until anion gap is closed (< 12) and bicarbonate >= 18."
    ]
  },
  {
    id: "ref-pals",
    title: "Pediatric PALS Cardiac Arrest",
    category: "Pediatric Resuscitation",
    summary: "Ensure high-quality CPR, correct reversible causes, and administer epinephrine early in non-shockable rhythms.",
    keyPoints: [
      "CPR Quality: Push hard (1/3 chest depth) and fast (100-120 bpm). Allow full chest recoil.",
      "Defibrillation: First shock 2 J/kg, second shock 4 J/kg, subsequent shocks >= 4 J/kg.",
      "Epinephrine: 0.01 mg/kg (1:10,000) IV/IO every 3-5 minutes.",
      "Amiodarone: 5 mg/kg IV/IO bolus (up to 3 times) for refractory VF/pVT.",
      "Reversible Causes: Search for Hypovolemia, Hypoxia, Hydrogen ion (acidosis), Hypoglycemia, Hypo/Hyperkalemia, Hypothermia, Tension pneumothorax."
    ]
  },
  {
    id: "ref-atls",
    title: "ATLS Trauma Primary Survey",
    category: "Trauma / Surgery",
    summary: "A systematic approach to identifying and managing life-threatening injuries sequentially.",
    keyPoints: [
      "A - Airway: Assess patency, chin-lift/jaw-thrust, secure airway with in-line cervical spine stabilization.",
      "B - Breathing: Auscultate lungs, check chest wall expansion, treat tension pneumothorax with needle decompression.",
      "C - Circulation: Identify external hemorrhage, apply pressure, insert 2 large-bore IVs, administer warm crystalloid.",
      "D - Disability: Check pupil size and responsiveness, calculate GCS, assess lateralizing neuro signs.",
      "E - Exposure: Completely undress patient, inspect for occult injuries, prevent hypothermia with warm blankets."
    ]
  }
];

export default function App() {
  // Session authentication state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginScreenMode, setLoginScreenMode] = useState<"login" | "signup" | "forgot_password">("login");

  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "analytics" | "handover" | "cases" | "learn" | "profile">("dashboard");
  const [showVoiceScribeChat, setShowVoiceScribeChat] = useState<boolean>(false);
  const [scribeMessages, setScribeMessages] = useState<any[]>([
    {
      id: "msg-1",
      sender: "ai",
      text: "Hello! I am your ErMate AI Scribe assistant. 🎙️\n\nI function as both a standard scribe and a medical consult chat. You can ask me *anything*—from drug dosages to diagnostic guidelines—and I will immediately provide answers with official references from **Tintinalli's**, **Rosen's**, **Harrison's**, **WikEM**, and **UpToDate**.\n\nTo dictate naturally, tap the microphone or type below. To scan a hospital transfer or reference letter, click the **Scan Doc** button next to the input field! 📄",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [showPediatricCalculator, setShowPediatricCalculator] = useState<boolean>(false);
  const [showPocketMirror, setShowPocketMirror] = useState<boolean>(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // App data states
  const [profile, setProfile] = useState<UserProfile>({
    name: "Varah",
    email: "varahgrp@gmail.com",
    role: "Senior Consultant",
    hospital: "Varah Group Emergency Care",
    aiCredits: 350,
    streak: 5,
    subscriptionTier: "Enterprise Platinum"
  });

  // Shift & Team states
  const [isOnShift, setIsOnShift] = useState<boolean>(false);
  const [showShiftCheckIn, setShowShiftCheckIn] = useState<boolean>(true);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);

  const [rotaAssignments, setRotaAssignments] = useState<Array<{
    day: number;
    shift: "Morning" | "Evening" | "Night";
    doctorName?: string;
    doctorEmail?: string;
    status?: "planned" | "actual" | "gap";
  }>>([
    { day: 1, shift: "Morning", doctorName: "Dr. Vipin Kumar", doctorEmail: "dr.vipin@gmail.com", status: "actual" },
    { day: 1, shift: "Evening", doctorName: "Dr. Priya Nair", doctorEmail: "priya.nair@gmail.com", status: "actual" },
    { day: 1, shift: "Night", doctorName: "Dr. Sanjay Verma", doctorEmail: "sanjay.verma@gmail.com", status: "actual" },
    { day: 14, shift: "Morning", doctorName: "Dr. Priya Nair", doctorEmail: "priya.nair@gmail.com", status: "actual" },
    { day: 14, shift: "Evening", doctorName: "Dr. Sanjay Verma", doctorEmail: "sanjay.verma@gmail.com", status: "actual" },
    { day: 14, shift: "Night", doctorName: "Dr. Vipin Kumar", doctorEmail: "dr.vipin@gmail.com", status: "gap" }, // Gap!
    { day: 15, shift: "Morning", doctorName: "Dr. Priya Nair", doctorEmail: "priya.nair@gmail.com", status: "planned" },
    { day: 15, shift: "Evening", doctorName: "", doctorEmail: "", status: "planned" }, // Open slot!
  ]);

  const [activeShiftDoctors, setActiveShiftDoctors] = useState<Array<{
    id: string;
    name: string;
    role: string;
    caseCount: number;
    timeOnShift: string;
  }>>([
    { id: "doc-priya", name: "Dr. Priya Nair", role: "Senior Consultant", caseCount: 4, timeOnShift: "3h 20m" },
    { id: "doc-rahul", name: "Dr. Rahul", role: "EM Resident", caseCount: 3, timeOnShift: "3h 20m" },
    { id: "doc-sanjay", name: "Dr. Sanjay Verma", role: "EM Resident", caseCount: 2, timeOnShift: "1h 10m" },
  ]);

  const [cases, setCases] = useState<ClinicalCase[]>([]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setIsLoggedIn(true);
        // Fetch user profile from `/users/{uid}`
        const profileDocRef = doc(db, "users", user.uid);
        try {
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
          } else {
            // Create profile if doesn't exist yet
            const initialProfile: UserProfile = {
              name: user.displayName || user.email?.split("@")[0] || "Doctor",
              email: user.email || "doctor@ermate.in",
              role: "Senior Consultant",
              hospital: "Varah Group Emergency Care",
              aiCredits: 350,
              streak: 5,
              subscriptionTier: "Enterprise Platinum"
            };
            await setDoc(profileDocRef, initialProfile);
            setProfile(initialProfile);
          }
        } catch (err) {
          console.error("Error reading profile:", err);
        }
      } else {
        setIsLoggedIn(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore sync for cases & handovers when logged in
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    // Stream Cases
    const casesQuery = collection(db, "cases");
    const unsubscribeCases = onSnapshot(casesQuery, async (snapshot) => {
      const loadedCases: ClinicalCase[] = [];
      snapshot.forEach((doc) => {
        loadedCases.push(doc.data() as ClinicalCase);
      });
      
      // If there are no cases in Firestore, seed the defaults so the dashboard looks great!
      if (loadedCases.length === 0) {
        // Default seed cases
        const defaultCases: ClinicalCase[] = [
          {
            id: "C-9041",
            patient: {
              name: "Arthur Pendelton",
              age: 62,
              gender: "Male",
              presentingComplaint: "Crushing retrosternal chest pain radiating to the left arm for 3 hours, associated with diaphoresis.",
              triageCategory: TriageCategory.P1,
              arrivalMode: ArrivalMode.Ambulance,
              dateOpened: "09:12 AM | Jul 09",
              uhid: "UHID-904128",
              phone: "+91 94451 09281",
              isMlc: false,
              caseType: "Medical"
            },
            vitals: {
              bp: "145/95",
              hr: "108",
              spo2: "93",
              rr: "20",
              temp: "98.8",
              gcs: "15",
              gcs_e: "4",
              gcs_v: "5",
              gcs_m: "6",
              grbs: "142",
              avpu: "Alert",
              painScore: "8"
            },
            sampleHistory: {
              symptoms: "Chest pain, shortness of breath, left arm numbness.",
              allergies: "NKDA",
              medications: "Metoprolol 50mg, Aspirin 75mg",
              pastHistory: "Hypertension, Hyperlipidemia",
              lastMeal: "Light breakfast 2 hours ago",
              events: "Pain started suddenly while drinking tea.",
              socialHistory: "Active smoker (1 pack/day), social drinker.",
              familyHistory: "Father died of MI at age 55.",
              psychiatricFlags: "None"
            },
            primaryAssessment: {
              airway: "Patent, speaking in full sentences.",
              airwayStatus: "Normal",
              breathing: "Symmetrical chest rise, bilateral breath sounds equal.",
              breathingStatus: "Normal",
              circulation: "Tachycardic, warm skin, peripheral pulses strong.",
              circulationStatus: "Normal",
              disability: "Pupils equal and reactive, GCS 15.",
              disabilityStatus: "Normal",
              exposure: "No sign of trauma, warm skin.",
              exposureStatus: "Normal"
            },
            secondaryAssessment: "Aorta non-tender, neck veins not distended, lungs clear to auscultation. ECG reveals 2mm ST-elevation in V1-V4 (Antero-septal STEMI). Cardiac enzymes pending.",
            investigations: [
              { id: "i-1", testName: "12-Lead ECG", result: "2mm ST-segment elevation in V1-V4.", orderTime: "09:15 AM", resultTime: "09:18 AM" },
              { id: "i-2", testName: "Troponin T", result: "0.45 ng/mL (Elevated).", orderTime: "09:15 AM", resultTime: "09:35 AM" }
            ],
            treatments: [
              { id: "t-1", drugName: "Aspirin", dose: "300mg", route: "PO (Chew)", timeGiven: "09:15 AM", ipsgVerified: true },
              { id: "t-2", drugName: "Clopidogrel", dose: "300mg", route: "PO", timeGiven: "09:15 AM", ipsgVerified: true },
              { id: "t-3", drugName: "Glyceryl Trinitrate (GTN)", dose: "0.4mg", route: "SL (Sublingual)", timeGiven: "09:16 AM", ipsgVerified: true },
              { id: "t-4", drugName: "Morphine", dose: "2mg", route: "IV", timeGiven: "09:20 AM", ipsgVerified: true }
            ],
            progressNotes: "Patient was triaged as P1 immediately upon arrival. STEMI protocol activated. Primary PCI team notified at Varah Group Cath Lab. Patient's chest pain decreased from 8/10 to 3/10 after NTG and Morphine. Transfer to Cath Lab arranged.",
            dischargeInfo: null,
            differentials: [
              {
                diagnosis: "Acute Antero-septal Myocardial Infarction",
                status: "CONSISTENT",
                reasoning: "ST-elevation in V1-V4 and elevated Troponin T.",
                citations: ["ACC/AHA STEMI Guidelines"],
                nextSteps: ["Immediate coronary angiography/PCI"]
              },
              {
                diagnosis: "Acute Pericarditis",
                status: "LESS LIKELY",
                reasoning: "Chest pain is not positional or pleuritic.",
                citations: [],
                nextSteps: []
              }
            ],
            isPediatric: false,
            status: "Active",
            savedTime: "09:12 AM",
            timeSpentMin: 45,
            doctorEmail: auth.currentUser?.email || "doctor@ermate.in",
            doctorName: "Dr. " + (auth.currentUser?.displayName || "Physician"),
            ipsgChecklist: {
              ipsg1IdentifiersVerified: true,
              ipsg2ReadBackPerformed: true,
              ipsg3HighAlertDoubleChecked: true,
              ipsg4TimeOutPerformed: true,
              ipsg5HandHygieneComplied: true,
              ipsg6FallRiskAssessed: "Low"
            },
            vulnerableAssessment: {
              isVulnerable: false,
              vulnerableType: "",
              nutritionalScreenPassed: true,
              functionalAssessmentScore: "Independent",
              abuseScreenNegative: true
            },
            consentTimeOut: {
              procedureConsentObtained: true,
              procedureTimeOutPerformed: true
            },
            dispositionDetails: {
              dispositionType: "Admit",
              durationInEr: "45 mins",
              residentName: "Dr. Rajesh Patel",
              consultantName: "Dr. Varah",
              observationNotes: "Anteroseptal STEMI. Transporting to Cath Lab with cardiac monitor and emergency drugs."
            },
            vitalsHistory: [
              { timestamp: "09:12 AM", bp: "145/95", systolic: 145, diastolic: 95, hr: 108, spo2: 93, rr: 20, temp: 98.8 },
              { timestamp: "09:25 AM", bp: "128/80", systolic: 128, diastolic: 80, hr: 94, spo2: 97, rr: 18, temp: 98.6 }
            ]
          }
        ];
        
        for (const c of defaultCases) {
          try {
            await setDoc(doc(db, "cases", c.id), c);
          } catch (err) {
            console.error("Error seeding default case:", err);
          }
        }
      } else {
        setCases(loadedCases);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "cases");
    });

    // Stream Handovers
    const handoversQuery = collection(db, "handovers");
    const unsubscribeHandovers = onSnapshot(handoversQuery, async (snapshot) => {
      const loadedHandovers: HandoverRecord[] = [];
      snapshot.forEach((doc) => {
        loadedHandovers.push(doc.data() as HandoverRecord);
      });
      
      // If there are no handovers in Firestore, seed the defaults!
      if (loadedHandovers.length === 0) {
        const defaultHandovers: HandoverRecord[] = [
          {
            id: "H-8210",
            senderName: "Dr. Priya Nair",
            senderEmail: "priya.nair@gmail.com",
            timestamp: "06:15 AM | Jul 14",
            caseCount: 3,
            patientsText: "Bed 3: Abdulahad (Chest pain)\nBed 7: Siya Sibi (Abdominal pain)\nBed 9: Pradeep (Fever)",
            acknowledgedBy: "Dr. Sanjay Verma",
            acknowledgedTime: "06:22 AM | Jul 14"
          }
        ];
        for (const h of defaultHandovers) {
          try {
            await setDoc(doc(db, "handovers", h.id), h);
          } catch (err) {
            console.error("Error seeding default handover:", err);
          }
        }
      } else {
        setHandovers(loadedHandovers.sort((a, b) => b.id.localeCompare(a.id)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "handovers");
    });

    return () => {
      unsubscribeCases();
      unsubscribeHandovers();
    };
  }, [isLoggedIn]);

  // View controllers
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeFormMode, setActiveFormMode] = useState<"full" | "quick" | null>(null);
  const [showDischargeSummaryId, setShowDischargeSummaryId] = useState<string | null>(null);
  const [showHandoverChat, setShowHandoverChat] = useState<boolean>(false);

  // Global Search & Reference Lookup States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResultsOpen, setSearchResultsOpen] = useState<boolean>(false);
  const [selectedReferenceDetail, setSelectedReferenceDetail] = useState<any | null>(null);
  const [customReferenceQuery, setCustomReferenceQuery] = useState<string>("");
  const [customReferenceLoading, setCustomReferenceLoading] = useState<boolean>(false);
  const [customReferenceResult, setCustomReferenceResult] = useState<any | null>(null);
  const [customReferenceError, setCustomReferenceError] = useState<string>("");

  const handleQueryAIReference = async (queryText: string) => {
    if (!queryText.trim()) return;
    setCustomReferenceQuery(queryText);
    setSelectedReferenceDetail({ id: "custom", title: `Clinical Query: "${queryText}"`, category: "AI Direct Consult" });
    setCustomReferenceLoading(true);
    setCustomReferenceError("");
    setCustomReferenceResult(null);

    try {
      const response = await fetch("/api/em-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });
      const data = await response.json();
      if (data.success && data.data) {
        setCustomReferenceResult(data.data);
      } else if (data.data) {
        setCustomReferenceResult(data.data);
      } else {
        setCustomReferenceError("Could not retrieve guidelines. Please try again.");
      }
    } catch (err) {
      setCustomReferenceError("Failed to connect to clinical library system.");
    } finally {
      setCustomReferenceLoading(false);
    }
  };

  // Real-time Clock Simulator
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Select a case for the Case Sheet view
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
    setShowHandoverChat(false);
  };

  // Delete a case
  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteDoc(doc(db, "cases", caseId));
    } catch (err: any) {
      console.error("Error deleting case:", err);
      handleFirestoreError(err, OperationType.DELETE, "cases");
    }
    setCases(prev => prev.filter(c => c.id !== caseId));
    if (selectedCaseId === caseId) setSelectedCaseId(null);
  };

  // Submit triage / registration form
  const handleTriageSubmit = async (demographics: PatientDemographics, vitals: PatientVitals) => {
    const isPeds = demographics.age !== null && demographics.age <= 16;
    const newCase: ClinicalCase = {
      id: "C-" + Math.floor(1000 + Math.random() * 9000),
      patient: demographics,
      vitals,
      sampleHistory: {
        symptoms: demographics.presentingComplaint,
        allergies: "",
        medications: "",
        pastHistory: "",
        lastMeal: "",
        events: "",
        socialHistory: "",
        familyHistory: "",
        psychiatricFlags: ""
      },
      primaryAssessment: {
        airway: "",
        airwayStatus: "Normal",
        breathing: "",
        breathingStatus: "Normal",
        circulation: "",
        circulationStatus: "Normal",
        disability: "",
        disabilityStatus: "Normal",
        exposure: "",
        exposureStatus: "Normal"
      },
      secondaryAssessment: "",
      investigations: [],
      treatments: [],
      progressNotes: "",
      dischargeInfo: null,
      differentials: [],
      isPediatric: isPeds,
      status: activeFormMode === "quick" ? "Active" : "Triage",
      savedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeSpentMin: 1, // Start timer
      doctorEmail: profile.email,
      doctorName: "Dr. " + profile.name,
      ipsgChecklist: {
        ipsg1IdentifiersVerified: true,
        ipsg2ReadBackPerformed: false,
        ipsg3HighAlertDoubleChecked: false,
        ipsg4TimeOutPerformed: false,
        ipsg5HandHygieneComplied: true,
        ipsg6FallRiskAssessed: "Low"
      },
      vulnerableAssessment: {
        isVulnerable: isPeds,
        vulnerableType: isPeds ? "Pediatric" : "",
        nutritionalScreenPassed: true,
        functionalAssessmentScore: isPeds ? "Assisted" : "Independent",
        abuseScreenNegative: true
      },
      consentTimeOut: {
        procedureConsentObtained: false,
        procedureTimeOutPerformed: false
      },
      dispositionDetails: {
        dispositionType: "Discharge",
        durationInEr: "",
        residentName: "Dr. Varah",
        consultantName: "Dr. Varah",
        observationNotes: ""
      },
      vitalsHistory: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bp: vitals.bp || "120/80",
          systolic: parseInt(vitals.bp?.split("/")[0]) || 120,
          diastolic: parseInt(vitals.bp?.split("/")[1]) || 80,
          hr: parseInt(vitals.hr) || 80,
          spo2: parseInt(vitals.spo2) || 98,
          rr: parseInt(vitals.rr) || 16,
          temp: parseFloat(vitals.temp) || 98.6
        }
      ]
    };

    try {
      await setDoc(doc(db, "cases", newCase.id), newCase);
    } catch (err: any) {
      console.error("Error saving triaged case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setActiveFormMode(null);
  };

  // Save changes inside Case Sheet View
  const handleSaveCase = async (updatedCase: ClinicalCase) => {
    try {
      await setDoc(doc(db, "cases", updatedCase.id), updatedCase);
    } catch (err: any) {
      console.error("Error saving case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
  };

  // Finalize discharge summary
  const handleSaveDischarge = async (dischargeInfo: DischargeInfo) => {
    if (!showDischargeSummaryId) return;
    const targetCase = cases.find(c => c.id === showDischargeSummaryId);
    if (targetCase) {
      const updated = {
        ...targetCase,
        dischargeInfo,
        status: "Discharged" as const
      };
      try {
        await setDoc(doc(db, "cases", updated.id), updated);
      } catch (err: any) {
        console.error("Error updating discharge summary in Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
    }
    setCases(prev => prev.map(c => {
      if (c.id === showDischargeSummaryId) {
        return {
          ...c,
          dischargeInfo,
          status: "Discharged"
        };
      }
      return c;
    }));
  };

  // Trigger discharge flow for active case
  const handleNavigateToDischarge = (caseId: string) => {
    setShowDischargeSummaryId(caseId);
    setSelectedCaseId(null);
    setActiveFormMode(null);
    setShowHandoverChat(false);
    setShowVoiceScribeChat(false);
  };

  const handleStartVoiceScribe = () => {
    setShowVoiceScribeChat(true);
    setSelectedCaseId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
    setShowHandoverChat(false);
  };

  const handleSaveExtractedVoiceCase = async (extracted: any) => {
    const newCaseId = "C-" + Math.floor(1000 + Math.random() * 9000);
    const newCase: ClinicalCase = {
      id: newCaseId,
      patient: {
        name: extracted.patientName || "Extracted Voice Patient",
        age: extracted.age || null,
        gender: extracted.gender || "Male",
        presentingComplaint: extracted.presentingComplaint || "Dictated presentation transcript.",
        triageCategory: extracted.triageCategory || TriageCategory.P2,
        arrivalMode: extracted.arrivalMode || ArrivalMode.WalkIn,
        dateOpened: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        uhid: "UHID-" + Math.floor(100000 + Math.random() * 900000),
        caseType: extracted.caseType || "Medical",
        isMlc: false
      },
      vitals: {
        bp: extracted.vitals?.bp || "",
        hr: extracted.vitals?.hr || "",
        spo2: extracted.vitals?.spo2 || "",
        rr: extracted.vitals?.rr || "",
        temp: extracted.vitals?.temp || "",
        gcs: extracted.vitals?.gcs || "15",
        gcs_e: extracted.vitals?.gcs_e || "4",
        gcs_v: extracted.vitals?.gcs_v || "5",
        gcs_m: extracted.vitals?.gcs_m || "6",
        grbs: extracted.vitals?.grbs || "",
        avpu: extracted.vitals?.avpu || "Alert",
        painScore: extracted.vitals?.painScore || "0"
      },
      sampleHistory: {
        symptoms: extracted.sampleHistory?.symptoms || "",
        allergies: extracted.sampleHistory?.allergies || "",
        medications: extracted.sampleHistory?.medications || "",
        pastHistory: extracted.sampleHistory?.pastHistory || "",
        lastMeal: extracted.sampleHistory?.lastMeal || "",
        events: extracted.sampleHistory?.events || "",
        socialHistory: "",
        familyHistory: "",
        psychiatricFlags: ""
      },
      primaryAssessment: {
        airway: extracted.primaryAssessment?.airway || "",
        airwayStatus: extracted.primaryAssessment?.airwayStatus || "Normal",
        breathing: extracted.primaryAssessment?.breathing || "",
        breathingStatus: extracted.primaryAssessment?.breathingStatus || "Normal",
        circulation: extracted.primaryAssessment?.circulation || "",
        circulationStatus: extracted.primaryAssessment?.circulationStatus || "Normal",
        disability: extracted.primaryAssessment?.disability || "",
        disabilityStatus: extracted.primaryAssessment?.disabilityStatus || "Normal",
        exposure: extracted.primaryAssessment?.exposure || "",
        exposureStatus: extracted.primaryAssessment?.exposureStatus || "Normal"
      },
      secondaryAssessment: extracted.secondaryAssessment || "",
      investigations: extracted.investigations || [],
      treatments: extracted.treatments || [],
      progressNotes: extracted.progressNotes || "Case created via GPT Voice Scribe dictation.",
      dischargeInfo: null,
      differentials: [],
      isPediatric: extracted.age !== null && extracted.age <= 12,
      status: "Active",
      savedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeSpentMin: 1,
      doctorEmail: profile.email,
      doctorName: "Dr. " + profile.name,
      ipsgChecklist: {
        ipsg1IdentifiersVerified: true,
        ipsg2ReadBackPerformed: false,
        ipsg3HighAlertDoubleChecked: false,
        ipsg4TimeOutPerformed: false,
        ipsg5HandHygieneComplied: true,
        ipsg6FallRiskAssessed: "Low"
      },
      vulnerableAssessment: {
        isVulnerable: extracted.age !== null && (extracted.age < 16 || extracted.age > 65),
        vulnerableType: extracted.age !== null && extracted.age < 16 ? "Pediatric" : extracted.age !== null && extracted.age > 65 ? "Geriatric" : "",
        nutritionalScreenPassed: true,
        functionalAssessmentScore: "Independent",
        abuseScreenNegative: true
      },
      consentTimeOut: {
        procedureConsentObtained: false,
        procedureTimeOutPerformed: false
      },
      dispositionDetails: {
        dispositionType: "Discharge",
        durationInEr: "",
        residentName: "Dr. Varah",
        consultantName: "Dr. Varah",
        observationNotes: ""
      },
      vitalsHistory: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bp: extracted.vitals?.bp || "120/80",
          systolic: parseInt(extracted.vitals?.bp?.split("/")[0]) || 120,
          diastolic: parseInt(extracted.vitals?.bp?.split("/")[1]) || 80,
          hr: parseInt(extracted.vitals?.hr) || 80,
          spo2: parseInt(extracted.vitals?.spo2) || 98,
          rr: parseInt(extracted.vitals?.rr) || 16,
          temp: parseFloat(extracted.vitals?.temp) || 98.6
        }
      ]
    };

    try {
      await setDoc(doc(db, "cases", newCase.id), newCase);
    } catch (err: any) {
      console.error("Error saving extracted voice case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCaseId);
    setShowVoiceScribeChat(false);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
    setShowHandoverChat(false);
  };

  // Handle user profile save to Firestore
  const handleSaveProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), newProfile);
      } catch (err) {
        console.error("Error saving profile to Firestore:", err);
      }
    }
  };

  // Intercept and persist handovers to Firestore
  const customSetHandovers = async (value: React.SetStateAction<HandoverRecord[]>) => {
    let newHandovers: HandoverRecord[] = [];
    if (typeof value === "function") {
      newHandovers = (value as Function)(handovers);
    } else {
      newHandovers = value;
    }

    for (const record of newHandovers) {
      const existing = handovers.find(h => h.id === record.id);
      if (!existing) {
        try {
          await setDoc(doc(db, "handovers", record.id), record);
        } catch (err) {
          console.error("Error adding handover to Firestore:", err);
        }
      } else if (existing.acknowledgedBy !== record.acknowledgedBy || existing.acknowledgedTime !== record.acknowledgedTime) {
        try {
          await setDoc(doc(db, "handovers", record.id), record);
        } catch (err) {
          console.error("Error updating handover in Firestore:", err);
        }
      }
    }

    for (const record of handovers) {
      const stillExists = newHandovers.find(h => h.id === record.id);
      if (!stillExists) {
        try {
          await deleteDoc(doc(db, "handovers", record.id));
        } catch (err) {
          console.error("Error deleting handover from Firestore:", err);
        }
      }
    }

    setHandovers(newHandovers);
  };

  // Secure sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setLoginScreenMode("login");
      setIsOnShift(false);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // Direct tab navigating
  const navigateToTab = (tabId: string) => {
    setActiveTab(tabId as any);
    setSelectedCaseId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
    setShowHandoverChat(false);
    setShowVoiceScribeChat(false);
  };

  if (!isLoggedIn) {
    const currentTheme = isDarkMode ? "dark" : "emerald";
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-emerald-50/20'} flex flex-col justify-center relative overflow-hidden transition-colors duration-200`}>
        {loginScreenMode === "signup" ? (
          <SignUpView
            theme={currentTheme}
            onSignUp={(newProfile) => {
              setProfile(newProfile);
              setIsLoggedIn(true);
              setActiveTab("dashboard");
              setLoginScreenMode("login");
            }}
            onBackToLogin={() => setLoginScreenMode("login")}
          />
        ) : loginScreenMode === "forgot_password" ? (
          <ForgotPasswordView
            theme={currentTheme}
            onBackToLogin={() => setLoginScreenMode("login")}
          />
        ) : (
          <MockLoginView
            theme={currentTheme}
            onLogin={(loggedInProfile) => {
              setProfile(loggedInProfile);
              setIsLoggedIn(true);
              setActiveTab("dashboard");
            }}
            onSignUpClick={() => setLoginScreenMode("signup")}
            onForgotPasswordClick={() => setLoginScreenMode("forgot_password")}
          />
        )}
      </div>
    );
  }

  // Compute global search matches
  const query = searchQuery.trim().toLowerCase();
  const matchedCases = query
    ? cases.filter(c => 
        c.patient.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        (c.patient.uhid && c.patient.uhid.toLowerCase().includes(query)) ||
        c.patient.presentingComplaint.toLowerCase().includes(query)
      )
    : [];

  const matchedReferences = query
    ? LOCAL_REFERENCES.filter(r => 
        r.title.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.summary.toLowerCase().includes(query) ||
        r.keyPoints.some(pt => pt.toLowerCase().includes(query))
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-850 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Upper Navigation & Branding Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 md:px-6 shadow-xs sticky top-0 z-40 no-print relative">
        {/* Colorful top border line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-600" />
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mt-0.5">
          
          {/* Logo & branding */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-2 bg-gradient-to-br from-emerald-500 via-teal-500 to-purple-600 rounded-xl text-white shadow-sm flex items-center justify-center">
              <Activity className="w-5.5 h-5.5 animate-pulse-slow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black font-display tracking-tight text-slate-900 dark:text-white">ErMate</span>
                <span className="text-[10px] bg-gradient-to-r from-emerald-500 to-purple-600 text-white px-1.5 py-0.5 rounded font-mono font-bold shadow-xs">EMR v2.5</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium font-mono">ErMate :- The Scribe Companion for ER</p>
            </div>
          </div>

          {/* Global Search input */}
          <div className="relative flex-1 max-w-xs md:max-w-sm lg:max-w-md mx-2 z-50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, ID, UHID, or protocol..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchResultsOpen(true);
                }}
                onFocus={() => setSearchResultsOpen(true)}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResultsOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown of results */}
            {searchResultsOpen && searchQuery.trim().length > 0 && (
              <>
                {/* Overlay click catcher */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setSearchResultsOpen(false)}
                />
                
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 animate-fade-in select-none">
                  
                  {/* Category: Patients / Case IDs */}
                  {matchedCases.length > 0 && (
                    <div className="p-2.5">
                      <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono px-2 mb-1.5">
                        Matched ER Patients ({matchedCases.length})
                      </span>
                      <div className="space-y-1">
                        {matchedCases.map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              handleSelectCase(c.id);
                              setSearchQuery("");
                              setSearchResultsOpen(false);
                            }}
                            className="flex items-center justify-between p-2 hover:bg-blue-50/60 dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-all"
                          >
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {c.patient.name}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate">
                                Age {c.patient.age || "N/A"} • {c.patient.gender} • Complaint: {c.patient.presentingComplaint}
                              </span>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1 ml-2">
                              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-extrabold">
                                {c.id}
                              </span>
                              <span className={`text-[8px] font-bold px-1 rounded-sm uppercase tracking-wide ${
                                c.patient.triageCategory.startsWith("P1") 
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  : c.patient.triageCategory.startsWith("P2")
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}>
                                {c.patient.triageCategory.split(" ")[0]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category: Clinical Reference Protocols */}
                  {matchedReferences.length > 0 && (
                    <div className="p-2.5">
                      <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono px-2 mb-1.5">
                        Clinical Reference Protocols ({matchedReferences.length})
                      </span>
                      <div className="space-y-1">
                        {matchedReferences.map(r => (
                          <div
                            key={r.id}
                            onClick={() => {
                              setSelectedReferenceDetail(r);
                              setSearchQuery("");
                              setSearchResultsOpen(false);
                            }}
                            className="flex items-start gap-2.5 p-2 hover:bg-purple-50/60 dark:hover:bg-purple-950/15 rounded-lg cursor-pointer transition-all"
                          >
                            <BookOpen className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                                {r.title}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate">
                                {r.category} • {r.summary}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search fallback block */}
                  <div className="p-2 flex flex-col gap-1.5 bg-slate-50/60 dark:bg-slate-900/30">
                    <button
                      type="button"
                      onClick={() => {
                        handleQueryAIReference(searchQuery);
                        setSearchQuery("");
                        setSearchResultsOpen(false);
                      }}
                      className="w-full py-2 px-3 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 text-left rounded-lg text-xs font-bold flex items-center gap-2 text-slate-600 dark:text-slate-300 transition-all border border-dashed border-slate-200 dark:border-slate-800"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      <span>Ask Gemini EM Reference for <strong className="text-blue-700 dark:text-blue-400">"{searchQuery}"</strong></span>
                    </button>
                  </div>
                  
                  {matchedCases.length === 0 && matchedReferences.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No direct matches for "{searchQuery}". Try searching for chest pain, sepsis, STEMI, or specific patients.
                    </div>
                  )}
                  
                </div>
              </>
            )}
          </div>

          {/* Quick Stats Panel */}
          <div className="hidden lg:flex items-center gap-6 text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>ER Registry: <strong className="text-slate-700 dark:text-slate-300">{cases.length} patients</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>System Clock: <strong className="text-slate-700 dark:text-slate-300">{currentTime}</strong></span>
            </div>
          </div>

          {/* Theme toggles & Profile shortcut */}
          <div className="flex items-center gap-2">
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Quick credentials link */}
            <div 
              onClick={() => navigateToTab("profile")}
              className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl cursor-pointer transition-all border border-slate-100 dark:border-slate-800"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-bold text-xs flex items-center justify-center font-mono uppercase">
                VM
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-[11px] font-bold leading-tight">Dr. {profile.name}</span>
                <span className="block text-[9px] text-slate-400 tracking-wider">Enterprise Scribe</span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Tab Navigation bar (Desktop Only) */}
      <nav className="hidden md:block bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-1 px-4 overflow-x-auto scrollbar-none no-print">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
            { id: "analytics", label: "Analytics", icon: TrendingUp, activeClass: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/15" },
            { id: "handover", label: "Handover", icon: Users, activeClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/15" },
            { id: "cases", label: "Cases Registry", icon: ClipboardList, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
            { id: "learn", label: "Learn & Reference", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
            { id: "profile", label: "Team & Subscriptions", icon: Settings, activeClass: "bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-600/15" },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror;
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`text-xs px-4 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                  active
                    ? tab.activeClass
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile-Optimized Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 pb-safe z-40 no-print shadow-lg">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
          {[
            { id: "dashboard" as const, label: "Home", icon: Activity },
            { id: "cases" as const, label: "Cases", icon: ClipboardList },
            { id: "handover" as const, label: "Handover", icon: Users },
            { id: "learn" as const, label: "Learn", icon: BookOpen },
            { id: "profile" as const, label: "Team & Set", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror;
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-2.5 transition-all relative select-none ${
                  active 
                    ? "text-indigo-600 dark:text-indigo-400 font-extrabold" 
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
                }`}
              >
                {active && (
                  <span className="absolute top-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
                <Icon className={`w-5 h-5 ${active ? "scale-105" : ""} transition-transform`} />
                <span className="text-[10px] mt-1 font-sans">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Render Space */}
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto">
          
          {/* 1. Triage Form View */}
          {activeFormMode && (
            <TriageForm
              onBack={() => setActiveFormMode(null)}
              onSubmit={handleTriageSubmit}
              initialMode={activeFormMode}
            />
          )}

          {/* 2. Full Case Sheet View */}
          {selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && (
            (() => {
              const matched = cases.find(c => c.id === selectedCaseId);
              if (!matched) return <p>Case not found</p>;
              return (
                <CaseSheetView
                  initialCase={matched}
                  allCases={cases}
                  onSelectCase={handleSelectCase}
                  onBack={() => setSelectedCaseId(null)}
                  onSaveCase={handleSaveCase}
                  onNavigateToDischarge={handleNavigateToDischarge}
                  onStartNewTriage={() => {
                    setActiveFormMode("quick");
                    setSelectedCaseId(null);
                  }}
                  profile={profile}
                  onSaveProfile={handleSaveProfile}
                  onReturnToScribe={() => {
                    setShowVoiceScribeChat(true);
                    setSelectedCaseId(null);
                  }}
                  hasActiveScribeSession={scribeMessages.length > 1}
                />
              );
            })()
          )}

          {/* 3. Discharge Summary View */}
          {showDischargeSummaryId && !selectedCaseId && !activeFormMode && !showHandoverChat && (
            (() => {
              const matched = cases.find(c => c.id === showDischargeSummaryId);
              if (!matched) return <p>Case not found</p>;
              return (
                <DischargeSummaryView
                  currentCase={matched}
                  onBack={() => setShowDischargeSummaryId(null)}
                  onSaveDischarge={handleSaveDischarge}
                />
              );
            })()
          )}

          {/* 4. Shift Handover Chat View */}
          {showHandoverChat && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            <HandoverChatView 
              onBack={() => setShowHandoverChat(false)} 
            />
          )}

          {/* 5. Voice Scribe Chat View */}
          {showVoiceScribeChat && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && (
            <VoiceScribeChatView
              onBack={() => setShowVoiceScribeChat(false)}
              onSaveExtractedCase={handleSaveExtractedVoiceCase}
              profile={profile}
              onSaveProfile={handleSaveProfile}
              messages={scribeMessages}
              onUpdateMessages={setScribeMessages}
            />
          )}

          {/* Pediatric Drug Calculator View */}
          {showPediatricCalculator && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && !showVoiceScribeChat && (
            <PediatricDrugCalculatorView
              onBack={() => setShowPediatricCalculator(false)}
            />
          )}

          {/* Pocket Mirror & Pupil Inspector View */}
          {showPocketMirror && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && !showVoiceScribeChat && (
            <PocketMirrorView
              onBack={() => setShowPocketMirror(false)}
            />
          )}

          {/* 6. Main Tab Views */}
          {!selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showHandoverChat && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror && (
            <>
              {activeTab === "dashboard" && (
                <DashboardView
                  profile={profile}
                  cases={cases}
                  onStartFullFlow={() => setActiveFormMode("full")}
                  onStartQuickCase={() => setActiveFormMode("quick")}
                  onSelectCase={handleSelectCase}
                  onNavigateToDischarge={handleNavigateToDischarge}
                  onNavigateToTab={navigateToTab}
                  onStartHandoverChat={() => setShowHandoverChat(true)}
                  onStartVoiceScribe={handleStartVoiceScribe}
                  onOpenPediatricCalculator={() => setShowPediatricCalculator(true)}
                  onOpenPocketMirror={() => setShowPocketMirror(true)}
                  isOnShift={isOnShift}
                  setIsOnShift={setIsOnShift}
                  showShiftCheckIn={showShiftCheckIn}
                  setShowShiftCheckIn={setShowShiftCheckIn}
                  handovers={handovers}
                  setHandovers={customSetHandovers}
                  rotaAssignments={rotaAssignments}
                  setRotaAssignments={setRotaAssignments}
                  activeShiftDoctors={activeShiftDoctors}
                  setActiveShiftDoctors={setActiveShiftDoctors}
                  onSaveCase={handleSaveCase}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsView
                  cases={cases}
                  profile={profile}
                  onNavigateToTab={navigateToTab}
                />
              )}

              {activeTab === "handover" && (
                <HandoverView
                  cases={cases}
                  profile={profile}
                  handovers={handovers}
                  setHandovers={customSetHandovers}
                  onNavigateToTab={navigateToTab}
                />
              )}

              {activeTab === "cases" && (
                <CasesListView
                  cases={cases}
                  onSelectCase={handleSelectCase}
                  onDeleteCase={handleDeleteCase}
                  onStartFullFlow={() => setActiveFormMode("full")}
                  onStartQuickCase={() => setActiveFormMode("quick")}
                  onNavigateToTab={navigateToTab}
                />
              )}

              {activeTab === "learn" && <LearnView onNavigateToTab={navigateToTab} />}

              {activeTab === "profile" && (
                <ProfileSettingsView
                  profile={profile}
                  cases={cases}
                  onSaveProfile={handleSaveProfile}
                  onSignOut={handleSignOut}
                  rotaAssignments={rotaAssignments}
                  setRotaAssignments={setRotaAssignments}
                  isDarkMode={isDarkMode}
                  setIsDarkMode={setIsDarkMode}
                  onDeleteAllCases={() => setCases([])}
                  isOnShift={isOnShift}
                  setIsOnShift={setIsOnShift}
                  handovers={handovers}
                  setHandovers={customSetHandovers}
                  onNavigateToTab={navigateToTab}
                />
              )}
            </>
          )}

        </div>
      </main>

      {/* Simple Footer details */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-4 px-4 text-center text-[11px] text-slate-400 no-print mt-auto">
        <p>© 2026 Varah Group Medical Systems. All Rights Reserved. Complies with ATLS & PALS Clinical Guidelines.</p>
      </footer>

      {/* Global Search Protocol & Reference Overlay Modal */}
      {selectedReferenceDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div 
            className="fixed inset-0" 
            onClick={() => {
              setSelectedReferenceDetail(null);
              setCustomReferenceResult(null);
              setCustomReferenceError("");
            }}
          />
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-10">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {selectedReferenceDetail.title}
                  </h3>
                  <span className="text-[10px] bg-purple-100/70 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider mt-1 inline-block">
                    {selectedReferenceDetail.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReferenceDetail(null);
                  setCustomReferenceResult(null);
                  setCustomReferenceError("");
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {selectedReferenceDetail.id !== "custom" ? (
                // Local Preloaded Protocols
                <>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                      Clinical Overview Summary
                    </span>
                    <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {selectedReferenceDetail.summary}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono block mb-1">
                      Protocol Action Checklist & Dosages
                    </span>
                    <div className="space-y-2.5">
                      {selectedReferenceDetail.keyPoints.map((pt: string, idx: number) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl hover:border-slate-250 dark:hover:border-slate-750 transition-all"
                        >
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black flex items-center justify-center font-mono shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5">
                            {pt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                // Dynamic AI Consulting Reference
                <div className="space-y-4">
                  {customReferenceLoading && (
                    <div className="py-12 text-center space-y-4">
                      <Sparkles className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin-slow mx-auto" />
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Consulting Clinical Reference Registries...
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 max-w-sm mx-auto leading-relaxed">
                          Gemini is indexing standard ATLS, PALS, and AHA resuscitation guidelines for: "{customReferenceQuery}"
                        </p>
                      </div>
                    </div>
                  )}

                  {customReferenceError && (
                    <div className="p-4 bg-rose-50 border border-rose-150 text-rose-700 rounded-xl text-xs font-medium">
                      {customReferenceError}
                    </div>
                  )}

                  {customReferenceResult && (
                    <div className="space-y-4 animate-fade-in">
                      {/* Answer markdown prose */}
                      <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
                        {customReferenceResult.answer}
                      </div>

                      {/* Teaching Point Callout */}
                      {customReferenceResult.keyTeachingPoint && (
                        <div className="bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/50 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 font-mono uppercase tracking-wider">
                            High-Yield Clinical Pearl
                          </span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                            {customReferenceResult.keyTeachingPoint}
                          </p>
                        </div>
                      )}

                      {/* Citations */}
                      {customReferenceResult.citations && customReferenceResult.citations.length > 0 && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1.5">
                            Standard Sources & Guidelines:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {customReferenceResult.citations.map((cite: string, index: number) => (
                              <span 
                                key={index} 
                                className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 text-[9px] font-mono px-2 py-0.5 rounded"
                              >
                                {cite}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedReferenceDetail(null);
                  setCustomReferenceResult(null);
                  setCustomReferenceError("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 text-xs font-bold rounded-xl transition-all"
              >
                Dismiss Sheet
              </button>
              {selectedReferenceDetail.id !== "custom" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReferenceDetail(null);
                    navigateToTab("learn");
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  Explore in Reference Suite
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
