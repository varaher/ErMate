import React, { useState, useEffect, useRef, Suspense } from "react";
import { 
  Activity, Sparkles, BookOpen, User, Clock, ShieldAlert, 
  Settings, HelpCircle, FileWarning,  Trophy, ClipboardList, Zap, Moon, Sun, Users,
  Search, X, TrendingUp, Bell, BellRing, Trash2, Check, Mic, ShieldCheck, RefreshCw,
  Download, Smartphone, Building2, UserCheck, CheckCircle2, Terminal
} from "lucide-react";

import { 
  ClinicalCase, UserProfile, PatientDemographics, PatientVitals, 
  DischargeInfo, TriageCategory, ArrivalMode, HandoverRecord, TeamMember, QuickPastePatient, HandoverPatient
} from "./types";
import { saveHandoverPatient } from "./utils/handoverUtils";
import { triggerPrintWithTip } from "./utils/printWithTip";

import DashboardView from "./components/DashboardView";
const CasesListView = React.lazy(() => import("./components/CasesListView"));
const CaseSheetView = React.lazy(() => import("./components/CaseSheetView"));
const CaseSheetPrintView = React.lazy(() => import("./components/CaseSheetPrintView"));
const DischargeSummaryView = React.lazy(() => import("./components/DischargeSummaryView"));
const TriageForm = React.lazy(() => import("./components/TriageForm"));
const LearnView = React.lazy(() => import("./components/LearnView"));
const ProfileSettingsView = React.lazy(() => import("./components/ProfileSettingsView"));
const MockLoginView = React.lazy(() => import("./components/MockLoginView"));
const VoiceScribeChatView = React.lazy(() => import("./components/VoiceScribeChatView"));
const SignUpView = React.lazy(() => import("./components/SignUpView"));
const ForgotPasswordView = React.lazy(() => import("./components/ForgotPasswordView"));
const PediatricDrugCalculatorView = React.lazy(() => import("./components/PediatricDrugCalculatorView"));
const ErGuideView = React.lazy(() => import("./components/ErGuideView"));
const AnalyticsView = React.lazy(() => import("./components/AnalyticsView"));
const HandoverView = React.lazy(() => import("./components/HandoverView"));
const PocketMirrorView = React.lazy(() => import("./components/PocketMirrorView"));
const QuickDischargeIntake = React.lazy(() => import("./components/QuickDischargeIntake"));
const AdminPanelView = React.lazy(() => import("./components/AdminPanelView"));
const DoctorsDirectoryView = React.lazy(() => import("./components/DoctorsDirectoryView"));
import NewPatientEntryMenu, { type EntryMethod } from "./components/NewPatientEntryMenu";
import { validateTeamInvite } from "./services/teamInviteService";
import ConsentModal from "./components/ConsentModal";
import { BoundChatModal } from "./components/BoundChatModal";
import { ROTA_SHIFTS } from "./components/TeamRosterBoard";
import { MlcCertificatesView } from "./components/MlcCertificatesView";
import PWABadge from "./components/PWABadge";
import { APP_VERSION, CHANGELOG } from "./changelog";
import { HeaderUpdateButton } from "./hooks/useAppUpdate";

import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { sanitizeForFirestore } from "./utils/firestoreSanitizer";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, addDoc, onSnapshot, query, where } from "firebase/firestore";

interface StaticReference {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
}

const DEFAULT_QUICK_PASTE_PATIENTS: QuickPastePatient[] = [];

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

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  timestamp: string;
  read: boolean;
  linkView?: string;
}

export default function App() {
  // Real-time Notification States
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem("ermate_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; type: "info" | "success" | "warning" }>>([]);
  const [pendingContributionsCount, setPendingContributionsCount] = useState<number>(0);

  const isInitialCases = React.useRef(true);
  const isInitialHandovers = React.useRef(true);
  const isInitialContributions = React.useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem("ermate_notifications", JSON.stringify(notifications));
    } catch (err) {
      console.error("Failed to save notifications to localStorage", err);
    }
  }, [notifications]);

  const triggerNotification = (title: string, message: string, type: "info" | "success" | "warning" = "info", linkView?: string) => {
    const id = "notif-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" });
    
    // Add to persistent notification list
    const newNotif: AppNotification = {
      id,
      title,
      message,
      type,
      timestamp,
      read: false,
      linkView
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // keep last 50

    // Add to active floating toasts list
    const toastId = "toast-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id: toastId, title, message, type }]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 5000);
  };

  // Session authentication state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginScreenMode, setLoginScreenMode] = useState<"login" | "signup" | "forgot_password">("login");
  const [initialHospital, setInitialHospital] = useState<string>("");
  const [initialRole, setInitialRole] = useState<"Resident" | "Consultant" | "HOD">("Resident");
  const [activeInviteToken, setActiveInviteToken] = useState<string>("");
  const [inviteValidationError, setInviteValidationError] = useState<string>("");

  // Parse and validate invite links on page load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    
    if (path.includes("/join/")) {
      const token = path.split("/join/")[1]?.split("?")[0]?.replace(/\/+$/, "");
      if (token) {
        validateTeamInvite(token).then(result => {
          if (result.valid && result.hospital) {
            setInitialHospital(result.hospital);
            setActiveInviteToken(token);
            setInviteValidationError("");
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("ermate_pending_invite_token", token);
              sessionStorage.setItem("ermate_pending_invite_hospital", result.hospital);
            }
            setLoginScreenMode("signup");
          } else {
            setInviteValidationError(result.error || "Invalid or expired invitation link.");
            setLoginScreenMode("signup");
          }
        });
      }
    } else if (path.endsWith("/join")) {
      setLoginScreenMode("signup");
    }
  }, []);

  // Helper to compare semver strings (e.g. "2.10.0" vs "2.9.0")
  const isHigherVersion = (vNew: string, vCurrent: string): boolean => {
    if (!vNew || !vCurrent) return false;
    const cleanNew = vNew.replace(/^v/, '');
    const cleanCurrent = vCurrent.replace(/^v/, '');
    if (cleanNew === cleanCurrent) return false;
    const partsNew = cleanNew.split('.').map(n => parseInt(n, 10) || 0);
    const partsCurr = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(partsNew.length, partsCurr.length); i++) {
      const n = partsNew[i] || 0;
      const c = partsCurr[i] || 0;
      if (n > c) return true;
      if (n < c) return false;
    }
    return false;
  };

  // Updates and Announcements Modal state & Version Tracking
  const [showUpdatesModal, setShowUpdatesModal] = useState<boolean>(false);
  const [currentVersion, setCurrentVersion] = useState<string>(APP_VERSION);
  const [remoteVersion, setRemoteVersion] = useState<string>(APP_VERSION);
  const [appUpdateBanner, setAppUpdateBanner] = useState<boolean>(false);
  const [isForceUpdate, setIsForceUpdate] = useState<boolean>(false);

  // Auto-dismiss update banner after 10 seconds (unless force update)
  useEffect(() => {
    if (appUpdateBanner && !isForceUpdate) {
      const timer = setTimeout(() => {
        setAppUpdateBanner(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [appUpdateBanner, isForceUpdate]);

  // Version check logic: compares server version to installed APP_VERSION
  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/version");
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          const serverVersion = data.version || APP_VERSION;
          setCurrentVersion(serverVersion);
          setRemoteVersion(serverVersion);

          // Mark current APP_VERSION as seen
          localStorage.setItem("ermate_last_seen_version", APP_VERSION);
          localStorage.setItem("ermate_app_known_version", APP_VERSION);

          if (isHigherVersion(serverVersion, APP_VERSION)) {
            const dismissedSession = sessionStorage.getItem("ermate_dismissed_update_version");
            if (dismissedSession !== serverVersion) {
              setAppUpdateBanner(true);
            }
          } else {
            setAppUpdateBanner(false);
          }
        }
      } catch (err) {
        localStorage.setItem("ermate_last_seen_version", APP_VERSION);
        localStorage.setItem("ermate_app_known_version", APP_VERSION);
        setAppUpdateBanner(false);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000);

    // Optional Firestore real-time version check for team / HOD pushed updates
    const unsubFirestoreVersion = onSnapshot(
      doc(db, "app_config", "version"),
      (docSnap) => {
        if (docSnap.exists() && isMounted) {
          const data = docSnap.data();
          const remoteVer = data.current || APP_VERSION;
          const force = !!data.forceUpdate;
          setCurrentVersion(remoteVer);
          setRemoteVersion(remoteVer);
          setIsForceUpdate(force);

          if (isHigherVersion(remoteVer, APP_VERSION)) {
            const dismissedSession = sessionStorage.getItem("ermate_dismissed_update_version");
            if (dismissedSession !== remoteVer) {
              setAppUpdateBanner(true);
            }
          } else {
            setAppUpdateBanner(false);
          }
        }
      },
      () => {}
    );

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubFirestoreVersion();
    };
  }, []);

  // Update handlers
  const handleUpdateApp = () => {
    const targetVer = remoteVersion || currentVersion || APP_VERSION;
    localStorage.setItem("ermate_last_seen_version", targetVer);
    localStorage.setItem("ermate_app_known_version", targetVer);
    localStorage.setItem(`ermate_seen_version_${APP_VERSION}`, "true");
    sessionStorage.removeItem("ermate_dismissed_update_version");
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
        window.location.reload();
      }).catch(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const handleLaterApp = () => {
    localStorage.setItem(`ermate_seen_version_${APP_VERSION}`, "true");
    localStorage.setItem("ermate_last_seen_version", APP_VERSION);
    localStorage.setItem("ermate_app_known_version", APP_VERSION);
    sessionStorage.setItem("ermate_dismissed_update_version", remoteVersion || APP_VERSION);
    setAppUpdateBanner(false);
    setShowUpdatesModal(false);
  };

  // Consent Modal state
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [consentFirstCaseTrigger, setConsentFirstCaseTrigger] = useState<boolean>(false);

  // Join Flow and Modals states
  const [showAffiliationConflictModal, setShowAffiliationConflictModal] = useState<boolean>(false);
  const [showRoleSelectionModal, setShowRoleSelectionModal] = useState<boolean>(false);
  const [pendingJoinRole, setPendingJoinRole] = useState<"EM Resident" | "Senior Consultant">("EM Resident");

  // Automatically trigger release popup ONCE per release version on login
  useEffect(() => {
    if (isLoggedIn) {
      const seenKey = `ermate_seen_version_${APP_VERSION}`;
      const seen = localStorage.getItem(seenKey);
      if (!seen) {
        setShowUpdatesModal(true);
        localStorage.setItem(seenKey, "true");
        localStorage.setItem("ermate_seen_version_2_5_0", "true");
      }
    }
  }, [isLoggedIn]);

  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "analytics" | "admin" | "handover" | "cases" | "learn" | "profile" | "emdrugs" | "directory" | "mlc">("dashboard");
  const [discussionModalCase, setDiscussionModalCase] = useState<ClinicalCase | null>(null);

  const handleSaveDiscussionHistory = (caseId: string, messages: any[]) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, discussionMessages: messages } : c));
    setDiscussionModalCase(prev => prev && prev.id === caseId ? { ...prev, discussionMessages: messages } : prev);
  };
  const [showVoiceScribeChat, setShowVoiceScribeChat] = useState<boolean>(false);
  const [voiceScribeCaseId, setVoiceScribeCaseId] = useState<string | null>(null);
  const [scribeMessages, setScribeMessages] = useState<any[]>([
    {
      id: "msg-1",
      sender: "ai",
      text: "ErMate is ready.\n\n🎙️ Dictate your case in your native language\n📄 Scan a referral letter\n💬 Ask a clinical question\n\nEvidence-based. Built for Indian ERs.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [showPediatricCalculator, setShowPediatricCalculator] = useState<boolean>(false);
  const [showPocketMirror, setShowPocketMirror] = useState<boolean>(false);
  const [showQuickDischarge, setShowQuickDischarge] = useState<boolean>(false);
  const [quickDischargeCase, setQuickDischargeCase] = useState<ClinicalCase | null>(null);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("ermate_theme") === "dark";
  });

  // PWA Install States & Event Listeners
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if app is running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent browser's automatic mini-infobar on mobile
      e.preventDefault();
      // Store the event so we can trigger it upon clicking
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      triggerNotification(
        "Application Installed",
        "ErMate has been downloaded and installed on your device successfully!",
        "success"
      );
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else {
      // Show custom user manual install info (especially for iOS Safari and other systems)
      setShowInstallModal(true);
    }
  };

  // App data states
  const [profile, setProfile] = useState<UserProfile>({
    name: "Emergency Physician",
    email: "",
    role: "EM Resident",
    hospital: "Emergency Department",
    aiCredits: 100,
    streak: 1,
    subscriptionTier: "Free Standard"
  });

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Shift & Team states
  const [isOnShift, setIsOnShift] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ermate_isOnShift');
      const savedDate = localStorage.getItem('ermate_shiftDate');
      if (saved === 'true' && savedDate === new Date().toDateString()) {
        return true;
      }
    } catch(e) {}
    return false;
  });
  const [showShiftCheckIn, setShowShiftCheckIn] = useState<boolean>(() => {
    try {
      const savedDismissed = localStorage.getItem('ermate_shiftDismissed');
      const savedDate = localStorage.getItem('ermate_shiftDate');
      if (savedDismissed === 'true' && savedDate === new Date().toDateString()) {
        return false; // already dismissed today
      }
    } catch(e) {}
    return true; // show by default
  });

  useEffect(() => {
    try {
      localStorage.setItem('ermate_isOnShift', isOnShift ? 'true' : 'false');
      localStorage.setItem('ermate_shiftDate', new Date().toDateString());
    } catch(e) {}
  }, [isOnShift]);

  useEffect(() => {
    try {
      if (!showShiftCheckIn) {
        localStorage.setItem('ermate_shiftDismissed', 'true');
        localStorage.setItem('ermate_shiftDate', new Date().toDateString());
      }
    } catch(e) {}
  }, [showShiftCheckIn]);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [quickPasteList, setQuickPasteList] = useState<QuickPastePatient[]>(() => {
    const saved = localStorage.getItem("ermate_quick_paste_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error parsing saved quick paste list:", e);
      }
    }
    return DEFAULT_QUICK_PASTE_PATIENTS;
  });
  const quickPasteListRef = useRef<QuickPastePatient[]>([]);
  useEffect(() => {
    quickPasteListRef.current = quickPasteList;
  }, [quickPasteList]);

  const [rotaAssignments, setRotaAssignments] = useState<Array<{
    day: number;
    shift: "Morning" | "Evening" | "Night";
    doctorName?: string;
    doctorEmail?: string;
    status?: "planned" | "actual" | "gap";
  }>>([]);

  const [activeShiftDoctors, setActiveShiftDoctors] = useState<Array<{
    id: string;
    name: string;
    role: string;
    caseCount: number;
    timeOnShift: string;
  }>>([]);

  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [savedBanner, setSavedBanner] = useState<{
    visible: boolean;
    patientName: string;
    caseId: string;
  }>({
    visible: false,
    patientName: "",
    caseId: ""
  });

  useEffect(() => {
    if (savedBanner.visible) {
      const timer = setTimeout(() => {
        setSavedBanner(prev => ({ ...prev, visible: false }));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [savedBanner.visible]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [hospitalSubscription, setHospitalSubscription] = useState<{ active: boolean; subscriptionTier: string } | null>(null);

  // Auth state listener with real-time onSnapshot for UserProfile and team invite sync
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        const profileDocRef = doc(db, "users", user.uid);
        try {
          const profileSnap = await getDoc(profileDocRef);
          let currentProfile: UserProfile;

          if (!profileSnap.exists()) {
            // Check if there is a pending team invite for this new user
            const emailClean = (user.email || "").trim().toLowerCase();
            const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
            const memberDocRef = doc(db, "team_members", memberId);
            const memberSnap = await getDoc(memberDocRef);

            let initialHospital = "";
            let initialTier = "Free Standard";
            let initialRole = "Senior Consultant";

            if (memberSnap.exists()) {
              const mData = memberSnap.data();
              initialHospital = mData.hospital || initialHospital;
              initialRole = mData.role || initialRole;
              initialTier = "Hospital Team Premium (Department Covered)";

              // Update team member status to Active (Joined)
              await updateDoc(memberDocRef, {
                status: "Active (Joined)",
                updatedAt: new Date().toISOString()
              });
            }

            const initialProfile: UserProfile = {
              name: user.displayName || "Dr. " + (user.email?.split("@")[0] || "Doctor"),
              email: user.email || "doctor@ermate.in",
              role: initialRole,
              hospital: initialHospital,
              aiCredits: 350,
              streak: 5,
              subscriptionTier: initialTier
            };

            if (memberSnap.exists()) {
              (initialProfile as any).teamAddedNotification = {
                title: "Welcome to Your Team!",
                message: `You have been automatically incorporated into the team at ${initialHospital}. Your workspace and shifts are fully synchronized!`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
                acknowledged: false
              };
            }

            await setDoc(profileDocRef, initialProfile);
            currentProfile = initialProfile;
          } else {
            currentProfile = profileSnap.data() as UserProfile;
            // Unblock UI immediately for existing users!
            setProfile(currentProfile);
            setIsLoggedIn(true);
            setAuthLoading(false);

            // For existing profiles, check if they have a pending team invite that wasn't incorporated yet
            const emailClean = (user.email || "").trim().toLowerCase();
            const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
            const memberDocRef = doc(db, "team_members", memberId);
            getDoc(memberDocRef).then(async (memberSnap) => {

            if (memberSnap.exists()) {
              const mData = memberSnap.data();
              if (mData.status === "Pending Invite" || currentProfile.hospital !== mData.hospital) {
                const isIndividualPlan = currentProfile.subscriptionTier?.toLowerCase().includes("pro") || currentProfile.subscriptionTier?.toLowerCase().includes("individual");

                let updatedTier = currentProfile.subscriptionTier || "Free Standard";
                let nextBillingTier = (currentProfile as any).nextBillingTier || "";
                let subscriptionTransitionPending = (currentProfile as any).subscriptionTransitionPending || false;
                let subscriptionTransitionMessage = (currentProfile as any).subscriptionTransitionMessage || "";

                if (isIndividualPlan) {
                  nextBillingTier = "Hospital Team Premium (Department Covered)";
                  subscriptionTransitionPending = true;
                  subscriptionTransitionMessage = "From next month, your individual plan transitions to your hospital's shared Department Plan (no further individual charges).";
                } else {
                  updatedTier = "Hospital Team Premium (Department Covered)";
                }

                await updateDoc(profileDocRef, {
                  hospital: mData.hospital,
                  subscriptionTier: updatedTier,
                  nextBillingTier,
                  subscriptionTransitionPending,
                  subscriptionTransitionMessage,
                  teamAddedNotification: {
                    title: "Added to Team!",
                    message: `You have been added to the team at ${mData.hospital} by your HOD. Your clinical workspace and roster are now synced!`,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
                    acknowledged: false
                  }
                });

                await updateDoc(memberDocRef, {
                  status: "Active (Joined)",
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }).catch(e => console.warn("Background invite check failed:", e));
          }
          setProfile(currentProfile);
          setIsLoggedIn(true);
          setAuthLoading(false);
        } catch (err) {
          console.warn("Offline or error checking profile/invites, using fallback profile:", err);
          const fallbackProfile: UserProfile = {
            name: user.displayName || "Dr. " + (user.email?.split("@")[0] || "Doctor"),
            email: user.email || "doctor@ermate.in",
            role: "Senior Consultant",
            hospital: "",
            aiCredits: 350,
            streak: 5,
            subscriptionTier: "Hospital Team Premium (Department Covered)"
          };
          setProfile(fallbackProfile);
          setIsLoggedIn(true);
        }

        // Set up real-time onSnapshot listener for UserProfile
        unsubscribeProfile = onSnapshot(profileDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile & {
              teamAddedNotification?: {
                title: string;
                message: string;
                timestamp: string;
                acknowledged: boolean;
              }
            };

            // Process real-time team added notification
            if (data.teamAddedNotification && !data.teamAddedNotification.acknowledged) {
              triggerNotification(
                data.teamAddedNotification.title,
                data.teamAddedNotification.message,
                "success"
              );

              // Acknowledge notification
              updateDoc(profileDocRef, {
                "teamAddedNotification.acknowledged": true
              }).catch(e => console.warn("Error acknowledging team notification:", e));
            }

            setProfile(data);
          }
        }, (error) => {
          console.warn("Profile onSnapshot offline warning:", error?.message || error);
        });

      } else {
        setIsLoggedIn(false);
        setProfile(null as any);
        setCases([]);
        setHandovers([]);
        setQuickPasteList([]);
        setTeamMembers([]);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Real-time Firestore sync for cases & handovers when logged in
  useEffect(() => {
    if (!isLoggedIn || !profile) return;

    isInitialCases.current = true;
    isInitialHandovers.current = true;

    const userHospital = profile.hospital || "";
    const userHospitalLower = userHospital.trim().toLowerCase();
    const docName = (profile.name || "").startsWith("Dr. ") ? profile.name : `Dr. ${profile.name || "Physician"}`;

    // Stream Cases
    const casesQuery = userHospital ? query(collection(db, "cases"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "cases"), where("doctorEmail", "==", profile.email)) : collection(db, "cases"));
    const unsubscribeCases = onSnapshot(casesQuery, async (snapshot) => {
      const loadedCases: ClinicalCase[] = [];
      snapshot.forEach((doc) => {
        loadedCases.push(doc.data() as ClinicalCase);
      });
      
      const filteredCases = loadedCases.filter(c => {
        if (!c || !c.id) return false;

        // Exact account match (UID or Email) OR exact hospital name match (no fuzzy substring matching)
        const currentEmail = (profile.email || auth.currentUser?.email || "").trim().toLowerCase();
        const currentUid = auth.currentUser?.uid;
        const isMyCase = Boolean(
          (currentUid && (c.lastEditedBy === currentUid || (c as any).createdByUid === currentUid)) ||
          (currentEmail && c.doctorEmail && c.doctorEmail.trim().toLowerCase() === currentEmail)
        );
        if (isMyCase) return true;

        const caseHospitalLower = (c.hospital || "").trim().toLowerCase();
        return userHospitalLower ? caseHospitalLower === userHospitalLower : true;
      });

        const uniqueMap = new Map<string, ClinicalCase>();
        filteredCases.forEach(c => {
          if (c && c.id && !uniqueMap.has(c.id)) {
            uniqueMap.set(c.id, c);
          }
        });
        setCases(Array.from(uniqueMap.values()));

        // Real-time alert for updates made by other users
        if (!isInitialCases.current) {
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as ClinicalCase;
            const caseHospital = (data.hospital || "").trim().toLowerCase();
            const isOurHospital = caseHospital === userHospitalLower;
            const isByOtherDoctor = data.doctorEmail !== profile.email;

            if (isOurHospital && isByOtherDoctor) {
              if (change.type === "added") {
                triggerNotification(
                  "New ER Patient Admitted",
                  `Patient ${data.patient.name} (${data.id}) was admitted by ${data.doctorName || "another clinician"}.`,
                  "success"
                );
              } else if (change.type === "modified") {
                triggerNotification(
                  "Patient Case Updated",
                  `Patient file for ${data.patient.name} (${data.id}) was updated by ${data.doctorName || "another clinician"}.`,
                  "info"
                );
              } else if (change.type === "removed") {
                triggerNotification(
                  "Patient Case Removed",
                  `Patient file for ${data.patient.name} (${data.id}) was removed.`,
                  "warning"
                );
              }
            }
          });
        }
        isInitialCases.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "cases");
    });

    // Stream Handovers
    const handoversQuery = userHospital ? query(collection(db, "handovers"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "handovers"), where("senderEmail", "==", profile.email)) : collection(db, "handovers"));
    const unsubscribeHandovers = onSnapshot(handoversQuery, async (snapshot) => {
      const loadedHandovers: HandoverRecord[] = [];
      snapshot.forEach((doc) => {
        loadedHandovers.push(doc.data() as HandoverRecord);
      });
      
      const filteredHandovers = loadedHandovers.filter(h => {
        const handoverHospital = (h.hospital || "").trim().toLowerCase();
        const currentEmail = (profile.email || auth.currentUser?.email || "").trim().toLowerCase();
        const senderEmail = (h.senderEmail || "").trim().toLowerCase();
        return (userHospitalLower && handoverHospital === userHospitalLower) || (currentEmail && senderEmail === currentEmail);
      });

      setHandovers(filteredHandovers.sort((a, b) => b.id.localeCompare(a.id)));

        // Real-time alert for updates made by other users
        if (!isInitialHandovers.current) {
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as HandoverRecord;
            const handoverHospital = (data.hospital || "").trim().toLowerCase();
            const isOurHospital = handoverHospital === userHospitalLower;

            if (isOurHospital) {
              if (change.type === "added" && data.senderEmail !== profile.email) {
                triggerNotification(
                  "New Shift Handover Received",
                  `A new shift handover (${data.id}) was sent by ${data.senderName}.`,
                  "success"
                );
              } else if (change.type === "modified") {
                if (data.acknowledgedBy && data.acknowledgedBy !== profile.name) {
                  triggerNotification(
                    "Handover Acknowledged",
                    `Shift handover ${data.id} was acknowledged by ${data.acknowledgedBy}.`,
                    "info"
                  );
                }
              }
            }
          });
        }
        isInitialHandovers.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "handovers");
    });

    // Stream Quick Paste Patients (Synced Handover Roster across Desktop and Mobile)
    const quickPasteQuery = userHospital ? query(collection(db, "quick_paste_patients"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "quick_paste_patients"), where("createdByEmail", "==", profile.email)) : collection(db, "quick_paste_patients"));
    const unsubscribeQuickPaste = onSnapshot(quickPasteQuery, async (snapshot) => {
      const loadedQuickPaste: QuickPastePatient[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as QuickPastePatient;
        loadedQuickPaste.push({
          ...data,
          id: data.id || docSnap.id
        });
      });

      const filteredQuickPaste = loadedQuickPaste.filter(item => {
        const itemHospital = (item.hospital || "").trim().toLowerCase();
        const itemEmail = (item.createdByEmail || "").trim().toLowerCase();
        const currentEmail = (profile.email || auth.currentUser?.email || "").trim().toLowerCase();
        return (userHospitalLower && itemHospital === userHospitalLower) || (currentEmail && itemEmail === currentEmail) || (!item.hospital && !item.createdByEmail);
      });

      filteredQuickPaste.sort((a, b) => (b.updatedAt || b.id || "").localeCompare(a.updatedAt || a.id || ""));
      setQuickPasteList(filteredQuickPaste);
      localStorage.setItem("ermate_quick_paste_list", JSON.stringify(filteredQuickPaste));

      if (filteredQuickPaste.length === 0 && !profileRef.current?.hospital) {
        // Seed initial or local items to Firestore if first time
        const currentItems = quickPasteListRef.current.length > 0 ? quickPasteListRef.current : DEFAULT_QUICK_PASTE_PATIENTS;
        for (const item of currentItems) {
          const itemToSave: QuickPastePatient = {
            ...item,
            hospital: item.hospital || profile.hospital || "",
            createdByEmail: item.createdByEmail || profile.email || auth.currentUser?.email || undefined,
            updatedAt: new Date().toISOString()
          };
          try {
            await setDoc(doc(db, "quick_paste_patients", itemToSave.id), itemToSave);
          } catch (err) {
            console.error("Error seeding quick paste patient to Firestore:", err);
          }
        }
        if (auth.currentUser) {
          try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), { seededQuickPaste: true });
          } catch (e) {
            console.warn("Error updating seededQuickPaste:", e);
          }
        }
      }
    }, (error) => {
      console.error("Error streaming quick paste patients:", error);
    });

    // Stream Team Members
    const teamQuery = userHospital ? query(collection(db, "team_members"), where("hospital", "==", userHospital)) : collection(db, "team_members");
    const unsubscribeTeam = onSnapshot(teamQuery, async (snapshot) => {
      const DEMO_EMAILS = [
        "dr.vipin@gmail.com",
        "priya.nair@gmail.com",
        "sanjay.verma@gmail.com",
        "dr.ananya@gmail.com",
        "dr.jenkins@gmail.com",
        "chloe.harrison@gmail.com",
        "robert.miller@gmail.com"
      ];

      const loadedTeam: TeamMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TeamMember;
        const emailLower = (data.email || "").toLowerCase().trim();
        const idLower = (data.id || docSnap.id).toLowerCase();

        if (DEMO_EMAILS.includes(emailLower) || idLower.startsWith("mem-vipin") || idLower.startsWith("mem-priya") || idLower.startsWith("mem-sanjay") || idLower.startsWith("mem-ananya") || ["mem-1", "mem-2", "mem-3", "mem-4"].includes(idLower)) {
          // Permanently purge demo documents from Firestore database
          deleteDoc(doc(db, "team_members", docSnap.id)).catch(() => {});
        } else {
          loadedTeam.push(data);
        }
      });

      const filteredTeam = loadedTeam.filter(m => {
        const memberHospital = (m.hospital || "").trim().toLowerCase();
        return userHospitalLower ? memberHospital === userHospitalLower : true;
      });

      // If logged in user is not in the team list, let's automatically add them to the team list so they are displayed!
      const currentEmail = (profile?.email || "").toLowerCase().trim();
      const existingMember = currentEmail ? loadedTeam.find(m => m.email.toLowerCase().trim() === currentEmail) : undefined;
      const hasSelf = currentEmail ? filteredTeam.some(m => m.email.toLowerCase().trim() === currentEmail) : true;
      if (!hasSelf && profile?.email) {
        const selfMember: TeamMember = {
          id: existingMember?.id || `mem-${profile.email.replace(/[^a-zA-Z0-9]/g, "-")}`,
          name: profile.name || existingMember?.name || "Physician",
          email: profile.email || existingMember?.email || "",
          role: profile.role || existingMember?.role || "EM Resident",
          status: "Active (Joined)",
          shift: existingMember?.shift || "morning",
          hospital: userHospital || existingMember?.hospital || ""
        };
        try {
          await setDoc(doc(db, "team_members", selfMember.id), sanitizeForFirestore(selfMember), { merge: true });
        } catch (err) {
          console.error("Error auto-adding self to team list:", err);
        }
      }
      setTeamMembers(filteredTeam);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "team_members");
    });

    // Stream Hospital Subscription & Shifts Configuration
    let unsubscribeSub: () => void = () => {};
    let unsubscribeShifts: () => void = () => {};

    const hospitalSlug = userHospitalLower.replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "");
    if (hospitalSlug && hospitalSlug.trim().length > 0) {
      const subDocRef = doc(db, "hospital_subscriptions", hospitalSlug);
      unsubscribeSub = onSnapshot(subDocRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setHospitalSubscription({
            active: data.active,
            subscriptionTier: data.subscriptionTier
          });
        } else {
          // If snapshot doesn't exist, check if current profile has a team plan.
          const tier = profile?.subscriptionTier || "Free Plan";
          const isTeamPlan = tier.toLowerCase().includes("team") || tier.toLowerCase().includes("enterprise");
          if (isTeamPlan) {
            // Auto initialize the hospital subscription so all members benefit!
            const initialSub = {
              id: hospitalSlug,
              hospital: userHospital,
              subscriptionTier: tier,
              active: true,
              updatedAt: new Date().toISOString()
            };
            try {
              await setDoc(subDocRef, initialSub);
              setHospitalSubscription({
                active: true,
                subscriptionTier: tier
              });
            } catch (err) {
              console.error("Error creating hospital subscription:", err);
            }
          } else {
            setHospitalSubscription(null);
          }
        }
      }, (error) => {
        console.warn("Subscription onSnapshot offline warning:", error?.message || error);
        setHospitalSubscription(null);
      });

      const shiftDocRef = doc(db, "hospital_shifts", hospitalSlug);
      unsubscribeShifts = onSnapshot(shiftDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.shifts && Array.isArray(data.shifts)) {
            setShifts(data.shifts);
          } else {
            setShifts(ROTA_SHIFTS);
          }
        } else {
          setShifts(ROTA_SHIFTS);
        }
      }, (error) => {
        console.error("Error fetching hospital shifts:", error);
        setShifts(ROTA_SHIFTS);
      });
    } else {
      setHospitalSubscription(null);
      setShifts(ROTA_SHIFTS);
    }

    // Stream Clinical Contributions for Peer Review Notifications
    const contributionsQuery = userHospital ? query(collection(db, "contributions"), where("hospital", "==", userHospital)) : collection(db, "contributions");
    const unsubscribeContributions = onSnapshot(contributionsQuery, (snapshot) => {
      const loadedContributions: any[] = [];
      snapshot.forEach((docSnap) => {
        loadedContributions.push({ ...docSnap.data(), firestoreDocId: docSnap.id });
      });

      const pendingCount = loadedContributions.filter(c => c.status === "pending").length;
      setPendingContributionsCount(pendingCount);

      if (!isInitialContributions.current) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (change.type === "added" && data.status === "pending") {
            const submitter = data.submittedBy || "A clinician";
            const title = data.title || "Clinical Mnemonic";
            triggerNotification(
              "💡 New Mnemonic Awaiting Peer Review",
              `"${title}" was submitted by ${submitter}. Tap to review & approve.`,
              "info",
              "learn"
            );
          } else if (change.type === "modified" && data.status === "approved") {
            const isSelf = (data.submitterEmail || "").toLowerCase().trim() === (profile.email || "").toLowerCase().trim();
            if (isSelf) {
              triggerNotification(
                "🎉 Contribution Approved & Published!",
                `Your clinical mnemonic "${data.title}" has been reviewed and published to the global directory!`,
                "success",
                "learn"
              );
            }
          }
        });
      } else {
        isInitialContributions.current = false;
      }
    }, (error) => {
      console.error("Error listening to contributions:", error);
    });

    return () => {
      unsubscribeCases();
      unsubscribeHandovers();
      unsubscribeQuickPaste();
      unsubscribeTeam();
      unsubscribeSub();
      unsubscribeShifts();
      unsubscribeContributions();
    };
  }, [isLoggedIn, profile?.hospital, profile?.email, profile?.subscriptionTier]);

  // View controllers
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [pendingNewCase, setPendingNewCase] = useState<ClinicalCase | null>(null);
  const [viewCaseSheetPrintId, setViewCaseSheetPrintId] = useState<string | null>(null);
  const [activeFormMode, setActiveFormMode] = useState<"full" | "quick" | null>(null);
  const [showEntryMenu, setShowEntryMenu] = useState<boolean>(false);
  const [showDischargeSummaryId, setShowDischargeSummaryId] = useState<string | null>(null);
  const [handoverSubTab, setHandoverSubTab] = useState<"registry" | "quickpaste">("registry");

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
      localStorage.setItem("ermate_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("ermate_theme", "light");
    }
  }, [isDarkMode]);

  // Select a case for the Case Sheet view (Editable Form)
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setViewCaseSheetPrintId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
  };

  // Open read-only, print-styled Case Sheet view
  const handleViewPrintSheet = (caseId: string) => {
    setViewCaseSheetPrintId(caseId);
    setSelectedCaseId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
  };

  // Delete a case
  const handleDeleteCase = async (caseId: string) => {
    try {
      const targetCase = cases.find(c => c.id === caseId);
      console.log('[Delete] Path: cases/' + caseId);
      await deleteDoc(doc(db, "cases", caseId));
      
      // Also delete from department subcollection if applicable
      const deptId = targetCase?.departmentId || profile.hospital || "er";
      try {
        await deleteDoc(doc(db, "departments", deptId, "cases", caseId));
      } catch (subErr) {
        // Silently handle if subcollection entry doesn't exist
      }

      setCases(prev => prev.filter(c => c.id !== caseId));
      if (selectedCaseId === caseId) {
        setSelectedCaseId(null);
      }
      triggerNotification("Success", "Case deleted successfully.", "info");
    } catch (err: any) {
      console.error("[Delete Case Error]", err);
      // Ensure removal from UI even if network/offline
      setCases(prev => prev.filter(c => c.id !== caseId));
      if (selectedCaseId === caseId) {
        setSelectedCaseId(null);
      }
      triggerNotification("Deleted", "Case removed from board.", "info");
    }
  };

  // Delete all cases for this hospital from Firestore permanently
  const handleDeleteAllCases = async () => {
    try {
      const currentCases = [...cases];
      for (const c of currentCases) {
        console.log('[Delete All] Path: cases/' + c.id);
        await deleteDoc(doc(db, "cases", c.id));
        const deptId = c.departmentId || profile.hospital || "er";
        try {
          await deleteDoc(doc(db, "departments", deptId, "cases", c.id));
        } catch (e) {}
      }
      setCases([]);
      setSelectedCaseId(null);
      triggerNotification("Success", "All cases cleared.", "info");
    } catch (err: any) {
      console.error("[Delete All Cases Error]", err);
      setCases([]);
      setSelectedCaseId(null);
    }
  };

  // Helper to trigger learning consent flow if user hasn't made a decision yet
  const checkConsentOnCaseSaved = () => {
    if (profile && profile.hasConsentedToLearning === undefined) {
      setConsentFirstCaseTrigger(true);
      setShowConsentModal(true);
    }
  };

  // Submit triage / registration form
  const handleTriageSubmit = async (demographics: PatientDemographics, vitals: PatientVitals) => {
    const isPeds = demographics.age !== null && demographics.age <= 16;
    
    // Calculate shift and creation context fields dynamically
    const todayDateStr = new Date().toISOString().split('T')[0];
    const todayDateCompact = todayDateStr.replace(/-/g, '');
    const currentUserMember = teamMembers.find(
      m => (m.email || "").toLowerCase().trim() === (profile.email || "").toLowerCase().trim()
    );
    const activeUserShiftId = currentUserMember?.shift || "morning";
    const activeShiftName = activeUserShiftId.charAt(0).toUpperCase() + activeUserShiftId.slice(1);
    const computedShiftId = `shift_${activeUserShiftId}_${todayDateCompact}`;
    
    const consultantOnShift = teamMembers.find(
      m => ((m.role || "").toLowerCase().includes("consultant") || (m.role || "").toLowerCase().includes("hod") || (m.role || "").toLowerCase().includes("lead")) && m.shift === activeUserShiftId
    );
    const consultantId = consultantOnShift ? consultantOnShift.id : "uid_nirmal";
    const consultantName = consultantOnShift ? consultantOnShift.name || "Dr. Nirmal" : "Dr. Nirmal";
    const createdByUid = auth.currentUser?.uid || "uid_priya";
    const createdByRoleVal = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const hospitalSlug = (profile.hospital || "general-er").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

    const newCase: ClinicalCase = {
      id: "C-" + Math.floor(1000 + Math.random() * 9000),
      createdBy: createdByUid,
      createdByName: (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor"),
      createdByRole: createdByRoleVal,
      shiftId: computedShiftId,
      shiftDate: todayDateStr,
      shiftName: activeShiftName,
      consultantId,
      consultantName,
      departmentId: hospitalSlug,
      createdAt: new Date().toISOString(),
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
      hospital: profile.hospital,
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
        residentName: "Dr. " + profile.name,
        consultantName: "Dr. " + profile.name,
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
      await setDoc(doc(db, "cases", newCase.id), sanitizeForFirestore(newCase));
    } catch (err: any) {
      console.error("Error saving triaged case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }

    setCases(prev => [newCase, ...prev.filter(c => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setActiveFormMode(null);
    checkConsentOnCaseSaved();
  };

  // Save changes inside Case Sheet View
  const handleSaveCase = async (updatedCase: ClinicalCase) => {
    const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const editUid = auth.currentUser?.uid || "uid_priya";
    const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

    const caseToSave: ClinicalCase = {
      ...updatedCase,
      hospital: updatedCase.hospital || profile.hospital,
      doctorEmail: updatedCase.doctorEmail || profile.email,
      doctorName: updatedCase.doctorName || profile.name || "Emergency Doctor",
      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      lastEditedBy: editUid,
      lastEditedByName: editName,
      lastEditedByRole: editRole,
      lastEditedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave));
      
      // Determine changed fields across all patient sections (Demographics, Vitals, Primary Survey, SAMPLE history, Treatments, Labs, Differentials, Notes, Disposition, Pediatric)
      const previousCase = cases.find(c => c.id === updatedCase.id);
      const changedKeys: string[] = [];
      const prevVals: any = {};
      const newValData: any = {};
      
      if (previousCase) {
        if (JSON.stringify(previousCase.patient) !== JSON.stringify(updatedCase.patient)) {
          changedKeys.push("patient");
          prevVals.patient = previousCase.patient;
          newValData.patient = updatedCase.patient;
        }
        if (JSON.stringify(previousCase.vitals) !== JSON.stringify(updatedCase.vitals)) {
          changedKeys.push("vitals");
          prevVals.vitals = previousCase.vitals || {};
          newValData.vitals = updatedCase.vitals || {};
        }
        if (JSON.stringify(previousCase.primaryAssessment) !== JSON.stringify(updatedCase.primaryAssessment)) {
          changedKeys.push("primaryAssessment");
          prevVals.primaryAssessment = previousCase.primaryAssessment || {};
          newValData.primaryAssessment = updatedCase.primaryAssessment || {};
        }
        if (JSON.stringify(previousCase.sampleHistory) !== JSON.stringify(updatedCase.sampleHistory)) {
          changedKeys.push("sampleHistory");
          prevVals.sampleHistory = previousCase.sampleHistory || {};
          newValData.sampleHistory = updatedCase.sampleHistory || {};
        }
        if (JSON.stringify(previousCase.treatments) !== JSON.stringify(updatedCase.treatments)) {
          changedKeys.push("treatments");
          prevVals.treatments = previousCase.treatments || [];
          newValData.treatments = updatedCase.treatments || [];
        }
        if (JSON.stringify(previousCase.investigations) !== JSON.stringify(updatedCase.investigations)) {
          changedKeys.push("investigations");
          prevVals.investigations = previousCase.investigations || [];
          newValData.investigations = updatedCase.investigations || [];
        }
        if (JSON.stringify(previousCase.differentials) !== JSON.stringify(updatedCase.differentials)) {
          changedKeys.push("differentials");
          prevVals.differentials = previousCase.differentials || [];
          newValData.differentials = updatedCase.differentials || [];
        }
        if (previousCase.progressNotes !== updatedCase.progressNotes) {
          changedKeys.push("progressNotes");
          prevVals.progressNotes = previousCase.progressNotes || "";
          newValData.progressNotes = updatedCase.progressNotes || "";
        }
        if (JSON.stringify(previousCase.dispositionDetails) !== JSON.stringify(updatedCase.dispositionDetails)) {
          changedKeys.push("dispositionDetails");
          prevVals.dispositionDetails = previousCase.dispositionDetails || {};
          newValData.dispositionDetails = updatedCase.dispositionDetails || {};
        }
        if (JSON.stringify(previousCase.pediatricDetails) !== JSON.stringify(updatedCase.pediatricDetails)) {
          changedKeys.push("pediatricDetails");
          prevVals.pediatricDetails = previousCase.pediatricDetails || {};
          newValData.pediatricDetails = updatedCase.pediatricDetails || {};
        }
      }

      // Add audit log to addenda subcollection
      const addendumId = "add-" + Math.floor(100000 + Math.random() * 900000);
      const addendumRef = doc(db, "cases", caseToSave.id, "addenda", addendumId);
      const auditLog = {
        id: addendumId,
        type: "edit",
        editedBy: editUid,
        editedByName: editName,
        editedByRole: editRole,
        fieldsChanged: changedKeys.length > 0 ? changedKeys : ["caseData"],
        previousValues: prevVals,
        newValues: newValData,
        addedAt: new Date().toISOString(),
        addedBy: editUid // for rules create constraint
      };
      await setDoc(addendumRef, auditLog);
    } catch (err: any) {
      console.error("Error saving case or audit trail:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
    }
    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });
    checkConsentOnCaseSaved();
  };

  // Finalize discharge summary
  const handleSaveDischarge = async (dischargeInfo: DischargeInfo) => {
    if (!showDischargeSummaryId) return;
    const targetCase = cases.find(c => c.id === showDischargeSummaryId);
    if (targetCase) {
      const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
      const editUid = auth.currentUser?.uid || "uid_priya";
      const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

      const updated: ClinicalCase = {
        ...targetCase,
        dischargeInfo,
        status: "Discharged" as const,
        hospital: targetCase.hospital || profile.hospital,
        lastEditedBy: editUid,
        lastEditedByName: editName,
        lastEditedByRole: editRole,
        lastEditedAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, "cases", updated.id), sanitizeForFirestore(updated));

        // Add audit log to addenda subcollection
        const addendumId = "add-" + Math.floor(100000 + Math.random() * 900000);
        const addendumRef = doc(db, "cases", updated.id, "addenda", addendumId);
        const auditLog = {
          id: addendumId,
          type: "discharge",
          editedBy: editUid,
          editedByName: editName,
          editedByRole: editRole,
          fieldsChanged: ["dischargeInfo", "status"],
          previousValues: { status: targetCase.status },
          newValues: { status: "Discharged" },
          addedAt: new Date().toISOString(),
          addedBy: editUid // for rules create constraint
        };
        await setDoc(addendumRef, auditLog);
      } catch (err: any) {
        console.error("Error updating discharge summary in Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
      setCases(prev => prev.map(c => c.id === showDischargeSummaryId ? updated : c));
      checkConsentOnCaseSaved();
    }
  };

  // Trigger discharge flow for active case
  const handleNavigateToDischarge = (caseId: string) => {
    setShowDischargeSummaryId(caseId);
    setSelectedCaseId(null);
    setViewCaseSheetPrintId(null);
    setActiveFormMode(null);
    setShowVoiceScribeChat(false);
  };

  const handleStartVoiceScribe = (caseId?: string) => {
    setVoiceScribeCaseId(caseId || null);
    setShowVoiceScribeChat(true);
    setSelectedCaseId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
  };

  const handleSaveExtractedVoiceCase = async (
    extracted: any, 
    options?: { autoNavigate?: boolean; existingCaseId?: string | null }
  ): Promise<string> => {
    const shouldNavigate = options?.autoNavigate !== false;
    const existingId = options?.existingCaseId;
    const newCaseId = existingId || ("C-" + Math.floor(1000 + Math.random() * 9000));
    
    // Calculate shift and creation context fields dynamically
    const todayDateStr = new Date().toISOString().split('T')[0];
    const todayDateCompact = todayDateStr.replace(/-/g, '');
    const currentUserMember = teamMembers.find(
      m => (m.email || "").toLowerCase().trim() === (profile.email || "").toLowerCase().trim()
    );
    const activeUserShiftId = currentUserMember?.shift || "morning";
    const activeShiftName = activeUserShiftId.charAt(0).toUpperCase() + activeUserShiftId.slice(1);
    const computedShiftId = `shift_${activeUserShiftId}_${todayDateCompact}`;
    
    const consultantOnShift = teamMembers.find(
      m => ((m.role || "").toLowerCase().includes("consultant") || (m.role || "").toLowerCase().includes("hod") || (m.role || "").toLowerCase().includes("lead")) && m.shift === activeUserShiftId
    );
    const consultantId = consultantOnShift ? consultantOnShift.id : "uid_nirmal";
    const consultantName = consultantOnShift ? consultantOnShift.name || "Dr. Nirmal" : "Dr. Nirmal";
    const createdByUid = auth.currentUser?.uid || "uid_priya";
    const createdByRoleVal = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const hospitalSlug = (profile.hospital || "general-er").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Robust parsing helpers to completely prevent NaN values in Firestore
    const parsedAge = (extracted.age !== null && extracted.age !== undefined && extracted.age !== "") ? Number(extracted.age) : null;
    const isAgeValid = parsedAge !== null && !isNaN(parsedAge);
    const finalAge = isAgeValid ? parsedAge : null;

    const safeParseInt = (val: any, fallback: number): number => {
      if (val === undefined || val === null || val === "") return fallback;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? fallback : parsed;
    };

    const safeParseFloat = (val: any, fallback: number): number => {
      if (val === undefined || val === null || val === "") return fallback;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? fallback : parsed;
    };

    const bpParts = (extracted.vitals?.bp || "120/80").split("/");
    const systolicVal = safeParseInt(bpParts[0], 120);
    const diastolicVal = safeParseInt(bpParts[1], 80);

    const existingMatch = cases.find(c => c.id === newCaseId);

    const rawDocName = profile.name || auth.currentUser?.displayName || (profile.email ? profile.email.split("@")[0] : "Doctor");
    const docFormattedName = rawDocName.startsWith("Dr. ") ? rawDocName : "Dr. " + rawDocName;

    const newCase: ClinicalCase = {
      id: newCaseId,
      createdBy: existingMatch?.createdBy || createdByUid,
      createdByName: existingMatch?.createdByName || docFormattedName,
      createdByRole: existingMatch?.createdByRole || createdByRoleVal,
      shiftId: existingMatch?.shiftId || computedShiftId,
      shiftDate: existingMatch?.shiftDate || todayDateStr,
      shiftName: existingMatch?.shiftName || activeShiftName,
      consultantId: existingMatch?.consultantId || consultantId,
      consultantName: existingMatch?.consultantName || consultantName,
      departmentId: existingMatch?.departmentId || hospitalSlug,
      createdAt: existingMatch?.createdAt || new Date().toISOString(),
      patient: {
        name: extracted.patientName || existingMatch?.patient.name || "Extracted Voice Patient",
        age: finalAge !== null ? finalAge : existingMatch?.patient.age || null,
        gender: extracted.gender || existingMatch?.patient.gender || "Male",
        presentingComplaint: extracted.presentingComplaint || existingMatch?.patient.presentingComplaint || "Dictated presentation transcript.",
        triageCategory: extracted.triageCategory || existingMatch?.patient.triageCategory || TriageCategory.P2,
        arrivalMode: extracted.arrivalMode || existingMatch?.patient.arrivalMode || ArrivalMode.WalkIn,
        dateOpened: existingMatch?.patient.dateOpened || (new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })),
        uhid: existingMatch?.patient.uhid || ("UHID-" + Math.floor(100000 + Math.random() * 900000)),
        caseType: extracted.caseType || existingMatch?.patient.caseType || "Medical",
        isMlc: false
      },
      vitals: {
        bp: extracted.vitals?.bp || existingMatch?.vitals.bp || "",
        hr: extracted.vitals?.hr || existingMatch?.vitals.hr || "",
        spo2: extracted.vitals?.spo2 || existingMatch?.vitals.spo2 || "",
        rr: extracted.vitals?.rr || existingMatch?.vitals.rr || "",
        temp: extracted.vitals?.temp || existingMatch?.vitals.temp || "",
        gcs: extracted.vitals?.gcs || existingMatch?.vitals.gcs || "15",
        gcs_e: extracted.vitals?.gcs_e || existingMatch?.vitals.gcs_e || "4",
        gcs_v: extracted.vitals?.gcs_v || existingMatch?.vitals.gcs_v || "5",
        gcs_m: extracted.vitals?.gcs_m || existingMatch?.vitals.gcs_m || "6",
        grbs: extracted.vitals?.grbs || existingMatch?.vitals.grbs || "",
        avpu: extracted.vitals?.avpu || existingMatch?.vitals.avpu || "Alert",
        painScore: extracted.vitals?.painScore || existingMatch?.vitals.painScore || "0"
      },
      sampleHistory: {
        symptoms: extracted.sampleHistory?.symptoms || (Array.isArray(extracted.symptoms) ? extracted.symptoms.join(", ") : extracted.symptoms) || existingMatch?.sampleHistory.symptoms || "",
        allergies: extracted.sampleHistory?.allergies || extracted.allergies || existingMatch?.sampleHistory.allergies || "",
        medications: extracted.sampleHistory?.medications || extracted.medications || existingMatch?.sampleHistory.medications || "",
        pastHistory: extracted.sampleHistory?.pastHistory || extracted.pastMedicalHistory || extracted.pastHistory || existingMatch?.sampleHistory.pastHistory || "",
        lastMeal: extracted.sampleHistory?.lastMeal || extracted.lastMeal || existingMatch?.sampleHistory.lastMeal || "",
        events: extracted.sampleHistory?.events || extracted.events || existingMatch?.sampleHistory.events || "",
        socialHistory: extracted.sampleHistory?.socialHistory || extracted.socialHistory || existingMatch?.sampleHistory?.socialHistory || "",
        familyHistory: extracted.sampleHistory?.familyHistory || extracted.familyHistory || existingMatch?.sampleHistory?.familyHistory || "",
        psychiatricFlags: extracted.sampleHistory?.psychiatricFlags || extracted.psychiatricFlags || existingMatch?.sampleHistory?.psychiatricFlags || ""
      },
      primaryAssessment: {
        ...(existingMatch?.primaryAssessment || {}),
        ...(extracted.primaryAssessment || {}),
        airway: extracted.primaryAssessment?.airway || extracted.airway || existingMatch?.primaryAssessment.airway || "",
        airwayStatus: extracted.primaryAssessment?.airwayStatus || extracted.airwayStatus || existingMatch?.primaryAssessment.airwayStatus || "Normal",
        breathing: extracted.primaryAssessment?.breathing || extracted.breathing || existingMatch?.primaryAssessment.breathing || "",
        breathingStatus: extracted.primaryAssessment?.breathingStatus || extracted.breathingStatus || existingMatch?.primaryAssessment.breathingStatus || "Normal",
        circulation: extracted.primaryAssessment?.circulation || extracted.circulation || existingMatch?.primaryAssessment.circulation || "",
        circulationStatus: extracted.primaryAssessment?.circulationStatus || extracted.circulationStatus || existingMatch?.primaryAssessment.circulationStatus || "Normal",
        disability: extracted.primaryAssessment?.disability || extracted.disability || existingMatch?.primaryAssessment.disability || "",
        disabilityStatus: extracted.primaryAssessment?.disabilityStatus || extracted.disabilityStatus || existingMatch?.primaryAssessment.disabilityStatus || "Normal",
        exposure: extracted.primaryAssessment?.exposure || extracted.exposure || existingMatch?.primaryAssessment.exposure || "",
        exposureStatus: extracted.primaryAssessment?.exposureStatus || extracted.exposureStatus || existingMatch?.primaryAssessment.exposureStatus || "Normal"
      },
      secondaryAssessment: extracted.secondaryAssessment || (extracted.secondarySurvey ? Object.entries(extracted.secondarySurvey).map(([k,v]) => `${k.toUpperCase()}: ${v}`).join("\n") : null) || existingMatch?.secondaryAssessment || "",
      investigations: extracted.investigations || (extracted.labs ? extracted.labs.map((l: any, i: number) => ({ id: `inv-${Date.now()}-${i}`, testName: l.name || l, result: l.value || "Ordered", orderTime: new Date().toLocaleTimeString(), resultTime: "Pending", isAbnormal: false })) : null) || existingMatch?.investigations || [],
      treatments: extracted.treatments || (extracted.treatmentGiven ? extracted.treatmentGiven.map((t: any, i: number) => ({ id: `trt-${Date.now()}-${i}`, drugName: t.name || t, dose: "Stat", route: "IV", timeGiven: new Date().toLocaleTimeString(), ipsgVerified: true })) : null) || existingMatch?.treatments || [],
      progressNotes: extracted.progressNotes || (extracted.chronologicalNotes ? extracted.chronologicalNotes.map((n: any) => n.entry).join("\n") : null) || existingMatch?.progressNotes || "Case created via ErMate Voice Scribe dictation.",
      dischargeInfo: null,
      differentials: existingMatch?.differentials || [],
      isPediatric: extracted.isPediatric !== undefined ? Boolean(extracted.isPediatric) : (finalAge !== null && finalAge <= 16),
      pediatricDetails: extracted.pediatricDetails || existingMatch?.pediatricDetails || undefined,
      status: "Active",
      savedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeSpentMin: 1,
      doctorEmail: profile.email || auth.currentUser?.email || "",
      doctorName: docFormattedName,
      hospital: profile.hospital,
      ipsgChecklist: existingMatch?.ipsgChecklist || {
        ipsg1IdentifiersVerified: true,
        ipsg2ReadBackPerformed: false,
        ipsg3HighAlertDoubleChecked: false,
        ipsg4TimeOutPerformed: false,
        ipsg5HandHygieneComplied: true,
        ipsg6FallRiskAssessed: "Low"
      },
      vulnerableAssessment: existingMatch?.vulnerableAssessment || {
        isVulnerable: finalAge !== null && (finalAge < 16 || finalAge > 65),
        vulnerableType: finalAge !== null && finalAge < 16 ? "Pediatric" : finalAge !== null && finalAge > 65 ? "Geriatric" : "",
        nutritionalScreenPassed: true,
        functionalAssessmentScore: "Independent",
        abuseScreenNegative: true
      },
      consentTimeOut: existingMatch?.consentTimeOut || {
        procedureConsentObtained: false,
        procedureTimeOutPerformed: false
      },
      dispositionDetails: existingMatch?.dispositionDetails || {
        dispositionType: "Discharge",
        durationInEr: "",
        residentName: docFormattedName,
        consultantName: consultantName,
        observationNotes: ""
      },
      vitalsHistory: existingMatch?.vitalsHistory || [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bp: extracted.vitals?.bp || "120/80",
          systolic: systolicVal,
          diastolic: diastolicVal,
          hr: safeParseInt(extracted.vitals?.hr, 80),
          spo2: safeParseInt(extracted.vitals?.spo2, 98),
          rr: safeParseInt(extracted.vitals?.rr, 16),
          temp: safeParseFloat(extracted.vitals?.temp, 98.6)
        }
      ]
    };

    try {
      const cleanCase = sanitizeForFirestore(newCase);
      await setDoc(doc(db, "cases", newCase.id), cleanCase, { merge: true });
      if (newCase.departmentId) {
        await setDoc(doc(db, "departments", newCase.departmentId, "cases", newCase.id), cleanCase, { merge: true });
      }
    } catch (err: any) {
      console.error("Error saving extracted voice case:", err);
      if (!err?.message?.includes("offline") && !err?.message?.includes("unavailable")) {
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
    }

    setCases(prev => {
      const idx = prev.findIndex(c => c.id === newCase.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newCase;
        return copy;
      }
      return [newCase, ...prev];
    });

    setSavedBanner({
      visible: true,
      patientName: newCase.patient.name,
      caseId: newCase.id
    });

    if (shouldNavigate) {
      setSelectedCaseId(newCaseId);
      setShowVoiceScribeChat(false);
      setActiveFormMode(null);
      setShowDischargeSummaryId(null);
    } else {
      triggerNotification("Case Sheet Extracted", `Case sheet extracted and saved. Voice case (${newCase.patient.name}) updated in Emergency Dashboard.`, "info");
    }

    checkConsentOnCaseSaved();
    return newCaseId;
  };

  // Accepting Joining Offers (e.g., from share links)
  const handleAcceptJoinOffer = async () => {
    if (!auth.currentUser || !initialHospital) return;
    try {
      // Enforce: one user id or email id valid for one team, but allow switching with confirmation
      if (profile.hospital && profile.hospital.trim() !== "" && profile.hospital.toLowerCase().trim() !== initialHospital.toLowerCase().trim()) {
        setShowAffiliationConflictModal(true);
      } else {
        setShowRoleSelectionModal(true);
      }
    } catch (err) {
      console.error("Error accepting join offer:", err);
    }
  };

  const handleConfirmLeaveAndJoin = async () => {
    if (!auth.currentUser || !initialHospital) return;
    try {
      const emailClean = (profile.email || "").trim().toLowerCase();
      const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
      
      // Delete old membership
      await deleteDoc(doc(db, "team_members", memberId));
      
      setShowAffiliationConflictModal(false);
      setShowRoleSelectionModal(true);
    } catch (err) {
      console.error("Error leaving old hospital:", err);
      alert("Failed to leave previous hospital team. Please try again.");
    }
  };

  const handleRoleSelectionSubmit = async () => {
    if (!auth.currentUser || !initialHospital) return;
    try {
      const emailClean = (profile.email || "").trim().toLowerCase();
      const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
      const memberDocRef = doc(db, "team_members", memberId);
      
      // Create new pending membership in new department
      await setDoc(memberDocRef, {
        id: memberId,
        name: profile.name,
        email: emailClean,
        role: pendingJoinRole,
        status: "Pending Approval",
        shift: "off",
        hospital: initialHospital,
        invitedAt: new Date().toISOString()
      }, { merge: true });

      // Update user's profile hospital and subscription tier
      const profileDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(profileDocRef, {
        hospital: initialHospital,
        subscriptionTier: "Hospital Team Premium (Department Covered)"
      });

      setShowRoleSelectionModal(false);
      sessionStorage.removeItem("ermate_pending_invite_hospital");
      setInitialHospital("");
      
      triggerNotification(
        "Request Sent ✓",
        `Your request to join ${initialHospital} as an ${pendingJoinRole} has been sent to the HOD.`,
        "success"
      );
    } catch (err) {
      console.error("Error submitting role selection:", err);
      alert("Failed to submit request. Please try again.");
    }
  };

  const handleApproveTeamMember = async (memberId: string) => {
    try {
      const memberDocRef = doc(db, "team_members", memberId);
      await updateDoc(memberDocRef, {
        status: "Active (Joined)",
        joinedAt: new Date().toISOString()
      });
      
      triggerNotification(
        "Clinician Approved",
        "The clinician registration has been approved. They are now active on your team.",
        "success"
      );
    } catch (err) {
      console.error("Error approving member:", err);
    }
  };

  const handleDeclineTeamMember = async (memberId: string) => {
    try {
      const memberDocRef = doc(db, "team_members", memberId);
      const snap = await getDoc(memberDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const userEmail = data.email || "";
        
        // Find corresponding user and revert them
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail.trim().toLowerCase()));
        const userSnap = await getDocs(q);
        if (!userSnap.empty) {
          const userDocRef = doc(db, "users", userSnap.docs[0].id);
          await updateDoc(userDocRef, {
            hospital: "",
            subscriptionTier: "Free Standard"
          });
        }
      }
      
      await deleteDoc(memberDocRef);
      triggerNotification(
        "Request Declined",
        "The registration request was successfully declined.",
        "info"
      );
    } catch (err) {
      console.error("Error declining member:", err);
    }
  };

  const handleLeaveTeam = async () => {
    if (!auth.currentUser) return;
    try {
      const emailClean = (profile.email || "").trim().toLowerCase();
      const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
      
      // Delete their team member doc
      await deleteDoc(doc(db, "team_members", memberId));
      
      // Reset user profile back to default
      const profileDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(profileDocRef, {
        hospital: "",
        subscriptionTier: "Free Standard"
      });
      
      triggerNotification(
        "Left Department",
        "You have successfully left your previous hospital team. You are now on a Standalone Standard plan.",
        "info"
      );
    } catch (err) {
      console.error("Error leaving team:", err);
    }
  };

  const handleCancelJoinRequest = async () => {
    if (!auth.currentUser) return;
    try {
      const emailClean = (profile.email || "").trim().toLowerCase();
      const memberId = `mem-${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}`;
      
      await deleteDoc(doc(db, "team_members", memberId));
      
      const profileDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(profileDocRef, {
        hospital: "",
        subscriptionTier: "Free Standard"
      });
      
      triggerNotification(
        "Request Cancelled",
        "Your request to join the hospital team has been cancelled.",
        "info"
      );
    } catch (err) {
      console.error("Error cancelling request:", err);
    }
  };

  // Roster Management Handlers
  const handleAddTeamMember = async (name: string, email: string, role: string, shift: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const memberId = `mem-${cleanEmail.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const newMember: TeamMember = {
      id: memberId,
      name: name || "",
      email: cleanEmail,
      role: role || "",
      status: "Pending Invite",
      shift: shift || "",
      hospital: profile.hospital || ""
    };

    try {
      // 1. Check if email is already in the roster of a different hospital to prevent misuse
      const rosterRef = collection(db, "team_members");
      const rosterQuery = query(rosterRef, where("email", "==", cleanEmail));
      const rosterSnapshot = await getDocs(rosterQuery);

      if (!rosterSnapshot.empty) {
        const existingRosterDoc = rosterSnapshot.docs[0].data() as TeamMember;
        if (existingRosterDoc.hospital && existingRosterDoc.hospital.toLowerCase().trim() !== (profile.hospital || "").toLowerCase().trim()) {
          throw new Error(`This email is already registered on the team roster for "${existingRosterDoc.hospital}". A clinician can only belong to one hospital team.`);
        }
      }

      // 2. Check if user is already registered in ErMate by email query
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", cleanEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // User has already registered! Incorporate automatically
        const userDocSnap = querySnapshot.docs[0];
        const userUid = userDocSnap.id;
        const userData = userDocSnap.data() as UserProfile & {
          nextBillingTier?: string;
          subscriptionTransitionPending?: boolean;
          subscriptionTransitionMessage?: string;
          teamAddedNotification?: {
            title: string;
            message: string;
            timestamp: string;
            acknowledged: boolean;
          };
        };

        if (userData.hospital && userData.hospital.toLowerCase().trim() !== (profile.hospital || "").toLowerCase().trim()) {
          throw new Error(`This user is already registered and affiliated with another hospital ("${userData.hospital}"). A user can only belong to one hospital team.`);
        }

        const currentTier = userData.subscriptionTier || "Free Plan";
        const isIndividualPlan = currentTier.toLowerCase().includes("pro") || currentTier.toLowerCase().includes("individual");

        let updatedTier = currentTier;
        let nextBillingTier = userData.nextBillingTier || "";
        let subscriptionTransitionPending = userData.subscriptionTransitionPending || false;
        let subscriptionTransitionMessage = userData.subscriptionTransitionMessage || "";

        if (isIndividualPlan) {
          // If individual plan, transition from next following month
          nextBillingTier = "Hospital Team Premium (Department Covered)";
          subscriptionTransitionPending = true;
          subscriptionTransitionMessage = "From next month, your individual plan transitions to your hospital's shared Department Plan (no further individual charges).";
        } else {
          // If free plan, upgrade immediately
          updatedTier = "Hospital Team Premium (Department Covered)";
        }

        const teamAddedNotification = {
          title: "Added to Team!",
          message: `You have been added to the team at ${profile.hospital} by your HOD. Your clinical workspace and roster are now synced!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
          acknowledged: false
        };

        // Update the registered user profile
        await setDoc(doc(db, "users", userUid), {
          ...userData,
          hospital: profile.hospital,
          subscriptionTier: updatedTier,
          nextBillingTier,
          subscriptionTransitionPending,
          subscriptionTransitionMessage,
          teamAddedNotification
        });

        // Set roster status to Active (Joined)
        newMember.status = "Active (Joined)";
        await setDoc(doc(db, "team_members", memberId), sanitizeForFirestore(newMember));

        triggerNotification("User Auto-Synced", `${name} is already registered! They have been incorporated into the team and subscription updated successfully.`, "success");
      } else {
        // User doesn't have an account registration yet, add as pending invite
        await setDoc(doc(db, "team_members", memberId), sanitizeForFirestore(newMember));
        triggerNotification("Roster Updated", `Added ${name} to the team roster. Pending registration.`, "info");
      }
    } catch (err: any) {
      console.error("Error adding team member to Firestore:", err);
      // If it's our own custom validation error, don't pass it to standard Firestore handler
      if (err.message && (err.message.includes("registered") || err.message.includes("belong to one"))) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, "team_members");
      throw err;
    }
  };

  const handleRemoveTeamMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, "team_members", id));
      triggerNotification("Roster Updated", "Removed clinician from the team roster.", "info");
    } catch (err: any) {
      console.error("Error removing team member from Firestore:", err);
      handleFirestoreError(err, OperationType.DELETE, "team_members");
      throw err;
    }
  };

  const handleUpdateTeamMemberShift = async (id: string, shift: string) => {
    try {
      await updateDoc(doc(db, "team_members", id), { shift });
      triggerNotification("Shift Updated", "Updated assigned clinician shift.", "info");
    } catch (err: any) {
      console.error("Error updating team member shift:", err);
      handleFirestoreError(err, OperationType.WRITE, "team_members");
      throw err;
    }
  };

  const handleUpdateTeamMemberRole = async (id: string, role: string) => {
    try {
      const userRole = (profile.role || "").toLowerCase();
      const callerEmail = (auth.currentUser?.email || profile.email || "").toLowerCase().trim();
      const isCallerHODOrOwner = userRole.includes("hod") || userRole.includes("owner") || callerEmail === "varahgrp@gmail.com";

      if (!isCallerHODOrOwner) {
        triggerNotification("Access Denied 🔒", "Only Department Head (HOD) or Owner can assign clinical roles.", "warning");
        return;
      }

      // Check member details
      const memberRef = doc(db, "team_members", id);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        triggerNotification("Error", "Team member record not found.", "warning");
        return;
      }

      const memberData = memberSnap.data();
      const memberEmail = (memberData.email || "").toLowerCase().trim();

      // Prevent self demotion/promotion unless Owner
      if (memberEmail && memberEmail === callerEmail && callerEmail !== "varahgrp@gmail.com") {
        triggerNotification("Action Restricted 🔒", "You cannot modify your own role designation. Another HOD must make this change.", "warning");
        return;
      }

      const previousRole = memberData.role || "Unassigned";

      // 1. Update team member role in Firebase team_members collection
      await updateDoc(memberRef, { role });
      
      // 2. Find the clinician's user profile in 'users' and update their profile role too
      if (memberEmail) {
        const q = query(collection(db, "users"), where("email", "==", memberEmail));
        const userSnap = await getDocs(q);
        if (!userSnap.empty) {
          const userDocRef = doc(db, "users", userSnap.docs[0].id);
          await updateDoc(userDocRef, { role });
        }
      }

      // 3. TASK 3 — Write audit log entry to roleChangeLog collection
      try {
        await addDoc(collection(db, "roleChangeLog"), {
          targetMemberId: id,
          targetEmail: memberEmail,
          targetName: memberData.name || memberEmail,
          previousRole: previousRole,
          newRole: role,
          changedByUid: auth.currentUser?.uid || "",
          changedByEmail: callerEmail,
          changedByName: profile.name || callerEmail,
          changedAt: new Date().toISOString(),
          hospital: profile.hospital || ""
        });
      } catch (logErr) {
        console.warn("[RoleAuditLog] Failed to log role change:", logErr);
      }

      triggerNotification("Role Updated ✓", `Clinical role for ${memberData.name || memberEmail} updated from "${previousRole}" to "${role}". Audit log recorded.`, "success");
    } catch (err: any) {
      console.error("Error updating team member role:", err);
      handleFirestoreError(err, OperationType.WRITE, "team_members");
      throw err;
    }
  };

  const handleUpdateHospitalShifts = async (newShifts: any[]) => {
    const userHospital = profile.hospital || "General Emergency Department";
    const userHospitalLower = userHospital.trim().toLowerCase();
    const hospitalSlug = userHospitalLower.replace(/[^a-z0-9]/g, "-");
    try {
      await setDoc(doc(db, "hospital_shifts", hospitalSlug), {
        id: hospitalSlug,
        hospital: userHospital,
        shifts: newShifts,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || ""
      });
      triggerNotification("Roster Configured", "Shift rota times updated successfully.", "success");
    } catch (err: any) {
      console.error("Error updating hospital shifts:", err);
      triggerNotification("Error", "Failed to update shift times.", "warning");
    }
  };

  // Handle user profile save to Firestore
  const handleSaveProfile = async (newProfile: UserProfile) => {
    // Guard against unauthorized self-role modification
    const currentRole = profile.role || "EM Resident";
    const userRoleLower = currentRole.toLowerCase();
    const isCallerHODOrOwner = userRoleLower.includes("hod") || userRoleLower.includes("owner") || auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com";

    const profileToSave: UserProfile = {
      ...newProfile,
      role: isCallerHODOrOwner ? newProfile.role : currentRole
    };

    setProfile(profileToSave);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), profileToSave);

        // Also update shared hospital subscription if the user upgraded to a team/enterprise plan
        const tier = newProfile.subscriptionTier || "Free Plan";
        const isTeamPlan = tier.toLowerCase().includes("team") || tier.toLowerCase().includes("enterprise");
        if (isTeamPlan && newProfile.hospital && newProfile.hospital.trim()) {
          const hospitalSlug = newProfile.hospital.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "");
          if (hospitalSlug) {
            await setDoc(doc(db, "hospital_subscriptions", hospitalSlug), {
              id: hospitalSlug,
              hospital: newProfile.hospital,
              subscriptionTier: tier,
              active: true,
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Sync with Cloud SQL (PostgreSQL) backend
        try {
          const idToken = await auth.currentUser.getIdToken(true);
          await fetch("/api/sql/sync-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              uid: auth.currentUser.uid,
              email: newProfile.email,
              name: newProfile.name,
              role: newProfile.role,
              hospital: newProfile.hospital,
              aiCredits: newProfile.aiCredits,
              streak: newProfile.streak,
              subscriptionTier: newProfile.subscriptionTier,
              hasConsentedToLearning: newProfile.hasConsentedToLearning
            })
          });
        } catch (e) {
          console.error("Failed to sync profile change with Cloud SQL:", e);
        }

      } catch (err) {
        console.error("Error saving profile to Firestore:", err);
      }
    }
  };

  // Process user's consent choice (Yes or Not right now)
  const handleConsentChoice = async (consented: boolean) => {
    if (profile) {
      const updatedProfile = {
        ...profile,
        hasConsentedToLearning: consented
      };
      await handleSaveProfile(updatedProfile);
    }
    setShowConsentModal(false);
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
      const recordToSave = {
        ...record,
        hospital: record.hospital || profile.hospital
      };
      if (!existing) {
        try {
          await setDoc(doc(db, "handovers", recordToSave.id), recordToSave);
        } catch (err) {
          console.error("Error adding handover to Firestore:", err);
        }
      } else if (existing.acknowledgedBy !== record.acknowledgedBy || existing.acknowledgedTime !== record.acknowledgedTime) {
        try {
          await setDoc(doc(db, "handovers", recordToSave.id), recordToSave);
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

  // Intercept and persist quick paste list (handover roster) to Firestore so desktop & mobile stay synced
  const customSetQuickPasteList = async (value: React.SetStateAction<QuickPastePatient[]>) => {
    const previousList = quickPasteListRef.current;
    let newList: QuickPastePatient[] = [];
    if (typeof value === "function") {
      newList = (value as Function)(previousList);
    } else {
      newList = value;
    }

    const processedList: QuickPastePatient[] = newList.map(item => {
      const existingItem = previousList.find(p => p.id === item.id);
      if (item.handoverCardData) {
        const updatedCardData = saveHandoverPatient(existingItem?.handoverCardData, item.handoverCardData);
        return {
          ...item,
          handoverCardData: updatedCardData
        };
      }
      return item;
    });

    setQuickPasteList(processedList);
    localStorage.setItem("ermate_quick_paste_list", JSON.stringify(processedList));

    // Save or update items in Firestore
    for (const item of processedList) {
      const itemToSave: QuickPastePatient = {
        ...item,
        hospital: item.hospital || profile.hospital || "",
        createdByEmail: item.createdByEmail || profile.email,
        updatedAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, "quick_paste_patients", itemToSave.id), itemToSave);
      } catch (err) {
        console.error("Error saving quick paste patient to Firestore:", err);
      }
    }

    // Delete items removed from newList
    for (const item of previousList) {
      const stillExists = newList.some(p => p.id === item.id);
      if (!stillExists) {
        try {
          await deleteDoc(doc(db, "quick_paste_patients", item.id));
        } catch (err) {
          console.error("Error deleting quick paste patient from Firestore:", err);
        }
      }
    }
  };

  // Secure sign out
  const handleSignOut = async () => {
    try {
      // 1. Switch views & unmount logged-in components FIRST before clearing data underneath them
      setIsLoggedIn(false);
      setLoginScreenMode("login");
      setSelectedCaseId(null);
      setViewCaseSheetPrintId(null);
      setActiveFormMode(null);
      setShowDischargeSummaryId(null);
      setShowVoiceScribeChat(false);

      // 2. Clear session state now that views are unmounted
      setProfile(null as any);
      setCases([]);
      setHandovers([]);
      setQuickPasteList([]);
      setTeamMembers([]);
      setShifts([]);
      setHospitalSubscription(null);

      // 3. Finally sign out of Firebase Auth
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // Direct tab navigating
  const navigateToTab = (tabId: string) => {
    setActiveTab(tabId as any);
    setSelectedCaseId(null);
    setViewCaseSheetPrintId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);
    setShowVoiceScribeChat(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Loading clinical session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const currentTheme = isDarkMode ? "dark" : "emerald";
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-slate-50 dark:bg-slate-900' : 'bg-emerald-50/20'} flex flex-col justify-center relative overflow-hidden transition-colors duration-200`}>
        {loginScreenMode === "signup" ? (
          <SignUpView
            theme={currentTheme}
            initialHospital={initialHospital}
            initialRole={initialRole}
            inviteToken={activeInviteToken}
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
  const searchTerm = searchQuery.trim().toLowerCase();
  const matchedCases = searchTerm
    ? cases.filter(c => 
        c.patient.name.toLowerCase().includes(searchTerm) ||
        c.id.toLowerCase().includes(searchTerm) ||
        (c.patient.uhid && c.patient.uhid.toLowerCase().includes(searchTerm)) ||
        c.patient.presentingComplaint.toLowerCase().includes(searchTerm)
      )
    : [];

  const matchedReferences = searchTerm
    ? LOCAL_REFERENCES.filter(r => 
        r.title.toLowerCase().includes(searchTerm) ||
        r.category.toLowerCase().includes(searchTerm) ||
        r.summary.toLowerCase().includes(searchTerm) ||
        r.keyPoints.some(pt => pt.toLowerCase().includes(searchTerm))
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 text-slate-850 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <PWABadge />
      
      {/* Upper Navigation & Branding Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 md:px-6 shadow-xs sticky top-0 z-40 no-print relative">
        {/* Colorful top border line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-600" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mt-0.5">
          
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            {/* Logo & branding */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 bg-gradient-to-br from-emerald-500 via-teal-500 to-purple-600 rounded-xl text-white shadow-sm flex items-center justify-center">
                <Activity className="w-5 h-5 md:w-5.5 md:h-5.5 animate-pulse-slow" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm md:text-base font-black font-display tracking-tight text-slate-900 dark:text-white">ErMate</span>
                  <span className="text-[9px] md:text-[10px] bg-gradient-to-r from-emerald-500 to-purple-600 text-white px-1 py-0.2 rounded font-mono font-bold shadow-xs">EMR v2.5</span>
                </div>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-medium font-mono">The Scribe Companion for ER</p>
              </div>
            </div>

            {/* Hospital Workplace Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
              <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Active Hospital:</span>
              <strong className="text-slate-800 dark:text-white font-bold">{profile?.hospital || "General Emergency Department"}</strong>
              {hospitalSubscription?.active && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold uppercase tracking-wider">
                  Team Licensed
                </span>
              )}
            </div>

            {/* Mobile-only action shortcuts */}
            <div className="flex md:hidden items-center gap-1.5">
              <HeaderUpdateButton hasUpdate={appUpdateBanner} onApplyUpdate={() => window.location.reload()} />
              <button
                onClick={() => setShowUpdatesModal(true)}
                className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400 transition-all"
                title="Updates & Release Notes"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
              </button>
              <button
                onClick={handleInstallApp}
                className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all"
                title="Download App"
              >
                <Download className="w-4 h-4" />
              </button>
              
              {/* Real-time Notifications Bell on Mobile */}
              <div className="relative">
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all relative"
                  title="Notifications"
                  id="notifications-bell-mobile"
                >
                  {notifications.some(n => !n.read) ? (
                    <>
                      <BellRing className="w-4 h-4 text-rose-500 animate-bounce" />
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-white dark:ring-slate-950" />
                    </>
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </button>

                {showNotificationsDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setShowNotificationsDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900 animate-fade-in select-none">
                      
                      {/* Header */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
                          <Activity className="w-3.5 h-3.5 text-emerald-500" />
                          <span>ER Clinician Alerts</span>
                        </span>
                        <div className="flex gap-2">
                          {notifications.some(n => !n.read) && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                              }}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Read All</span>
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifications([]);
                                setShowNotificationsDropdown(false);
                              }}
                              className="text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notification list */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 scrollbar-thin">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                            <Bell className="w-6 h-6 text-slate-300 dark:text-slate-700 animate-pulse-slow" />
                            <span className="font-bold text-slate-550">No notifications yet</span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">Updates from other clinicians will appear here in real-time.</span>
                          </div>
                        ) : (
                          notifications.map((notif) => {
                            const isUnread = !notif.read;
                            return (
                              <div 
                                key={notif.id}
                                onClick={() => {
                                  // Mark as read
                                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                  if (notif.linkView) {
                                    setActiveTab(notif.linkView as any);
                                    setSelectedCaseId(null);
                                    setActiveFormMode(null);
                                    setShowDischargeSummaryId(null);
                                    setShowVoiceScribeChat(false);
                                  }
                                  // Close dropdown
                                  setShowNotificationsDropdown(false);
                                }}
                                className={`p-3 text-left transition-all hover:bg-slate-50/80 dark:hover:bg-slate-50 dark:bg-slate-900/60 cursor-pointer flex gap-2.5 items-start ${
                                  isUnread ? "bg-slate-50/40 dark:bg-slate-50 dark:bg-slate-900/10 border-l-2 border-emerald-500" : ""
                                }`}
                              >
                                <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
                                  notif.type === "success" 
                                    ? "bg-emerald-500" 
                                    : notif.type === "warning"
                                    ? "bg-rose-500"
                                    : "bg-blue-500"
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[11px] block truncate ${isUnread ? "font-extrabold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>
                                      {notif.title}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[8px] text-slate-400 font-mono whitespace-nowrap">{notif.timestamp.split(" | ")[0]}</span>
                                      {isUnread && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent closing dropdown or triggering outer click
                                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                          }}
                                          className="p-0.5 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-all cursor-pointer"
                                          title="Mark as read"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug font-medium">
                                    {notif.message}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Global Search input */}
          <div className="relative w-full md:flex-1 md:max-w-xs lg:max-w-md md:mx-2 z-50">
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
                className="w-full bg-slate-100 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
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
                        {matchedCases.map((c, idx) => (
                          <div
                            key={`${c.id}-${idx}`}
                            onClick={() => {
                              handleSelectCase(c.id);
                              setSearchQuery("");
                              setSearchResultsOpen(false);
                            }}
                            className="flex items-center justify-between p-2 hover:bg-blue-50/60 dark:hover:bg-slate-50 dark:bg-slate-900 rounded-lg cursor-pointer transition-all"
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
                                {String(c.patient.triageCategory || "P2").split(" ")[0]}
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
                  <div className="p-2 flex flex-col gap-1.5 bg-slate-50/60 dark:bg-slate-50 dark:bg-slate-900/30">
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
                      <span>Ask ErMate EM Reference for <strong className="text-blue-700 dark:text-blue-400">"{searchQuery}"</strong></span>
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

          {/* Theme toggles & Profile shortcut (Desktop Only) */}
          <div className="hidden md:flex items-center gap-2">

            {/* Header Update Button (renders when update is waiting or banner active) */}
            <HeaderUpdateButton hasUpdate={appUpdateBanner} onApplyUpdate={() => window.location.reload()} />

            {/* What's New & Announcements Button */}
            <button
              onClick={() => setShowUpdatesModal(true)}
              className="p-1.5 px-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-200/50 dark:border-emerald-800/30 font-sans shadow-xs"
              title="What's New & System Announcements"
              id="whats-new-announcements-btn"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-500" />
              <span className="text-[10px] font-extrabold tracking-tight uppercase">v{currentVersion}</span>
              {appUpdateBanner && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </button>

            

            
            {/* PWA Download / Install App Option */}
            <button
              onClick={handleInstallApp}
              className="p-1.5 px-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200/50 dark:border-indigo-800/30 font-sans shadow-sm"
              title="Download ErMate on Mobile or Desktop"
              id="pwa-install-btn"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-extrabold tracking-tight uppercase hidden lg:inline">Download App</span>
              {!isInstalled && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
              )}
            </button>
            
            {/* Real-time Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all relative"
                title="Notifications"
                id="notifications-bell"
              >
                {notifications.some(n => !n.read) ? (
                  <>
                    <BellRing className="w-4.5 h-4.5 text-rose-500 animate-bounce" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
                  </>
                ) : (
                  <Bell className="w-4.5 h-4.5" />
                )}
              </button>

              {showNotificationsDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setShowNotificationsDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900 animate-fade-in select-none">
                    
                    {/* Header */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <span>ER Clinician Alerts</span>
                      </span>
                      <div className="flex gap-2">
                        {notifications.some(n => !n.read) && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Read All</span>
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotifications([]);
                              setShowNotificationsDropdown(false);
                            }}
                            className="text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                          <Bell className="w-6 h-6 text-slate-300 dark:text-slate-700 animate-pulse-slow" />
                          <span className="font-bold text-slate-550">No notifications yet</span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">Updates from other clinicians will appear here in real-time.</span>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const isUnread = !notif.read;
                          return (
                            <div 
                              key={notif.id}
                              onClick={() => {
                                // Mark as read
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                if (notif.linkView) {
                                  setActiveTab(notif.linkView as any);
                                  setSelectedCaseId(null);
                                  setActiveFormMode(null);
                                  setShowDischargeSummaryId(null);
                                  setShowVoiceScribeChat(false);
                                }
                                // Close dropdown
                                setShowNotificationsDropdown(false);
                              }}
                              className={`p-3 text-left transition-all hover:bg-slate-50/80 dark:hover:bg-slate-50 dark:bg-slate-900/60 cursor-pointer flex gap-2.5 items-start ${
                                isUnread ? "bg-slate-50/40 dark:bg-slate-50 dark:bg-slate-900/10 border-l-2 border-emerald-500" : ""
                              }`}
                            >
                              <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
                                notif.type === "success" 
                                  ? "bg-emerald-500" 
                                  : notif.type === "warning"
                                  ? "bg-rose-500"
                                  : "bg-blue-500"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[11px] block truncate ${isUnread ? "font-extrabold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>
                                    {notif.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[8px] text-slate-400 font-mono whitespace-nowrap">{notif.timestamp.split(" | ")[0]}</span>
                                    {isUnread && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent closing dropdown or triggering outer click
                                          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                        }}
                                        className="p-0.5 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-all cursor-pointer"
                                        title="Mark as read"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug font-medium">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

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
                <span className="block text-[11px] font-bold leading-tight">Dr. {profile?.name || "Physician"}</span>
                <span className="block text-[9px] text-slate-400 tracking-wider">Enterprise Scribe</span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Tab Navigation bar (Desktop Only) */}
      <nav className="hidden md:block bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-1 px-4 overflow-x-auto scrollbar-none no-print">
        <div className="max-w-7xl mx-auto flex gap-1">
          {(() => {
            const isAdminUser = profile?.email?.toLowerCase().trim() === "varahgrp@gmail.com" || auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com";
            return [
              { id: "dashboard", label: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
              { id: "analytics", label: "Analytics", icon: TrendingUp, activeClass: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/15" },
              ...(isAdminUser ? [{ id: "admin", label: "Admin & Cost Panel", icon: ShieldCheck, activeClass: "bg-slate-50 dark:bg-slate-900 text-white shadow-sm shadow-slate-900/15" }] : []),
              { id: "handover", label: "Handover", icon: Users, activeClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/15" },
              { id: "directory", label: "Directory", icon: Building2, activeClass: "bg-amber-600 text-white shadow-sm shadow-amber-600/15" },
              { id: "cases", label: "Cases Registry", icon: ClipboardList, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
              { id: "mlc", label: "MLC", icon: FileWarning, activeClass: "bg-orange-600 text-white shadow-sm shadow-orange-600/15" },
              { id: "emdrugs", label: "EM Drugs", icon: ShieldAlert, activeClass: "bg-red-600 text-white shadow-sm shadow-red-600/15" },
              { id: "learn", label: "Learn & Reference", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
              { id: "profile", label: "Team & Subscriptions", icon: Settings, activeClass: "bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-600/15" },
            ];
          })().map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id && !selectedCaseId && !viewCaseSheetPrintId && !activeFormMode && !showDischargeSummaryId && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror;
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`text-xs px-4 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                  active
                    ? tab.activeClass
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 dark:bg-slate-900"
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
            const active = activeTab === tab.id && !selectedCaseId && !viewCaseSheetPrintId && !activeFormMode && !showDischargeSummaryId && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror;
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

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest animate-pulse">Loading Module...</span>
          </div>
        }>
          
          {/* Verification Pending Block Screen */}
          {(() => {
            const myTeamMember = teamMembers.find(
              m => m.email.toLowerCase().trim() === (profile?.email || "").toLowerCase().trim()
            );
            const isPendingApproval = myTeamMember && myTeamMember.status === "Pending Approval";

            if (isPendingApproval && activeTab !== "profile") {
              const departmentHOD = teamMembers.find(m => m.role?.toLowerCase().includes("hod") || m.role?.toLowerCase().includes("lead"));
              const hodName = departmentHOD ? `Dr. ${departmentHOD.name}` : "the Clinical HOD";
              return (
                <div className="bg-white dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 text-center max-w-2xl mx-auto shadow-xl space-y-6 my-12 animate-fade-in" id="pending-approval-overlay">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Verification Pending
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Hospital Team: <span className="text-indigo-600 dark:text-indigo-400 font-bold font-sans">{profile?.hospital || "General Emergency Department"}</span>
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    Your credentials have been submitted and are currently waiting for onboarding verification by the Department HOD. Once approved, your profile will link, and your clinical shifts will sync immediately.
                  </p>
                  
                  <div className="bg-slate-50 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-mono">
                    📬 Request routed to <strong className="text-slate-700 dark:text-slate-200 font-sans">{hodName}</strong>. You will be notified when approved.
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelJoinRequest}
                      className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer bg-transparent"
                    >
                      Cancel Request
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToTab("profile")}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
                    >
                      View Team Directory
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Render Normal Workspace Views only if not pending approval (or if on profile page) */}
          {(() => {
            const myTeamMember = teamMembers.find(
              m => m.email.toLowerCase().trim() === (profile?.email || "").toLowerCase().trim()
            );
            const isPendingApproval = myTeamMember && myTeamMember.status === "Pending Approval";
            if (isPendingApproval && activeTab !== "profile") return null;

            return (
              <>
                {/* Pending Joining Offer Invite Banner */}
          {initialHospital && profile?.hospital?.trim().toLowerCase() !== initialHospital.trim().toLowerCase() && (
            <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-900 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in no-print">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-bold font-mono tracking-wider">
                    PENDING JOINING OFFER
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 font-display">
                  You've been invited to join the medical team at {initialHospital}
                </h3>
                <p className="text-xs leading-relaxed text-slate-550 dark:text-slate-400 font-medium max-w-3xl">
                  Accepting this offer will link your ErMate profile, synchronize your shifts with their central clinical roster, and cover your account under their shared department team license.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-end md:self-center">
                <button
                  onClick={() => setInitialHospital("")}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptJoinOffer}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  Accept Joining Offer
                </button>
              </div>
            </div>
          )}

          {/* 1. Triage Form View */}
          {activeFormMode && (
            <TriageForm
              onBack={() => setActiveFormMode(null)}
              onSubmit={handleTriageSubmit}
              initialMode={activeFormMode}
            />
          )}

          {/* 1.5. Read-Only Printable Case Sheet View */}
          {viewCaseSheetPrintId && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            (() => {
              const matched = cases.find(c => c.id === viewCaseSheetPrintId);
              if (!matched) return <p className="p-8 text-center text-slate-500 font-sans font-bold">Case record not found</p>;
              return (
                <CaseSheetPrintView
                  clinicalCase={matched}
                  onBack={() => setViewCaseSheetPrintId(null)}
                  onEdit={() => handleSelectCase(matched.id)}
                  onPrint={() => triggerPrintWithTip()}
                />
              );
            })()
          )}

          {/* 2. Full Case Sheet View (Editable Form) */}
          {selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            (() => {
              const matched = cases.find(c => c.id === selectedCaseId) || (pendingNewCase?.id === selectedCaseId ? pendingNewCase : null);
              if (!matched) return <p>Case not found</p>;
              return (
                <CaseSheetView
                  initialCase={matched}
                  allCases={cases}
                  onSelectCase={handleSelectCase}
                  onViewPrintSheet={handleViewPrintSheet}
                  onBack={() => {
                    setPendingNewCase(null);
                    setSelectedCaseId(null);
                  }}
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
                  onDiscussCase={(c) => setDiscussionModalCase(c)}
                  onDeleteCase={handleDeleteCase}
                />
              );
            })()
          )}

          {/* 3. Discharge Summary View */}
          {showDischargeSummaryId && !selectedCaseId && !activeFormMode && !showQuickDischarge && (
            (() => {
              const matched = cases.find(c => c.id === showDischargeSummaryId) || (quickDischargeCase?.id === showDischargeSummaryId ? quickDischargeCase : null);
              if (!matched) return <p className="p-6 text-slate-400">Case not found</p>;
              return (
                <DischargeSummaryView
                  currentCase={matched}
                  onBack={() => {
                    setShowDischargeSummaryId(null);
                    setQuickDischargeCase(null);
                  }}
                  onSaveDischarge={handleSaveDischarge}
                  profile={profile}
                  onDeleteCase={handleDeleteCase}
                />
              );
            })()
          )}

          {/* Quick Discharge Intake View */}
          {showQuickDischarge && !selectedCaseId && !activeFormMode && (
            <QuickDischargeIntake
              currentUserEmail={profile?.email || auth.currentUser?.email || "doctor@ermate.ai"}
              currentUserName={profile?.name || "Emergency Physician"}
              hospitalName={profile?.hospital || "General Hospital"}
              onCaseReady={(minimalCase) => {
                setShowQuickDischarge(false);
                handleSaveCase(minimalCase);
                setQuickDischargeCase(minimalCase);
                setShowDischargeSummaryId(minimalCase.id);
              }}
              onCancel={() => setShowQuickDischarge(false)}
            />
          )}

          {/* 5. Voice Scribe Chat View */}
          {showVoiceScribeChat && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            <VoiceScribeChatView
              caseId={voiceScribeCaseId}
              caseData={cases.find(c => c.id === voiceScribeCaseId) || (selectedCaseId ? cases.find(c => c.id === selectedCaseId) : null)}
              onBack={() => {
                setShowVoiceScribeChat(false);
                setVoiceScribeCaseId(null);
              }}
              onOpenCaseSheet={(cId) => {
                setShowVoiceScribeChat(false);
                setSelectedCaseId(cId);
              }}
              onSaveExtractedCase={handleSaveExtractedVoiceCase}
              profile={profile}
              onSaveProfile={handleSaveProfile}
              messages={scribeMessages}
              onUpdateMessages={setScribeMessages}
            />
          )}

          {/* Pediatric Drug Calculator View */}
          {showPediatricCalculator && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showVoiceScribeChat && (
            <PediatricDrugCalculatorView
              onBack={() => setShowPediatricCalculator(false)}
            />
          )}

          {/* Pocket Mirror & Pupil Inspector View */}
          {showPocketMirror && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && !showVoiceScribeChat && (
            <PocketMirrorView
              onBack={() => setShowPocketMirror(false)}
            />
          )}

          {/* 6. Main Tab Views */}
          {!selectedCaseId && !viewCaseSheetPrintId && !activeFormMode && !showDischargeSummaryId && !showVoiceScribeChat && !showPediatricCalculator && !showPocketMirror && !showQuickDischarge && (
            <>
              {activeTab === "dashboard" && (
                <DashboardView
                  profile={profile}
                  cases={cases}
                  pendingContributionsCount={pendingContributionsCount}
                  onDiscussCase={(c) => setDiscussionModalCase(c)}
                  onStartFullFlow={() => setShowEntryMenu(true)}
                  onStartQuickCase={() => setActiveFormMode("quick")}
                  onSelectCase={handleSelectCase}
                  onViewSheet={handleViewPrintSheet}
                  onNavigateToDischarge={handleNavigateToDischarge}
                  onNavigateToTab={navigateToTab}
                  onDeleteAllCases={handleDeleteAllCases}
                  onDeleteCase={handleDeleteCase}
                  onStartHandoverChat={() => {
                    setHandoverSubTab("quickpaste");
                    setActiveTab("handover");
                  }}
                  onStartHandoverSheet={() => {
                    setHandoverSubTab("registry");
                    setActiveTab("handover");
                  }}
                  onStartDischargeSummary={() => {
                    setShowQuickDischarge(true);
                  }}
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
                  isDarkMode={isDarkMode}
                  teamMembers={teamMembers}
                  onAddMember={handleAddTeamMember}
                  onRemoveMember={handleRemoveTeamMember}
                  onUpdateShift={handleUpdateTeamMemberShift}
                  onApproveMember={handleApproveTeamMember}
                  onDeclineMember={handleDeclineTeamMember}
                  onUpdateRole={handleUpdateTeamMemberRole}
                  shifts={shifts}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsView
                  cases={cases}
                  profile={profile}
                  onNavigateToTab={navigateToTab}
                  isDarkMode={isDarkMode}
                />
              )}

              {activeTab === "admin" && (
                (profile?.email?.toLowerCase().trim() === "varahgrp@gmail.com" || auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com") ? (
                  <AdminPanelView
                    currentProfile={profile}
                    cases={cases}
                    onNavigateToTab={navigateToTab}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center max-w-md mx-auto shadow-xl space-y-4 my-12 font-sans">
                    <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Admin Panel Restricted</h2>
                      <p className="text-xs text-slate-500">
                        This control center is exclusively authorized for <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">varahgrp@gmail.com</span>.
                      </p>
                    </div>
                    <button
                      onClick={() => navigateToTab("dashboard")}
                      className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-indigo-500 transition-all font-mono"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                )
              )}

              {activeTab === "handover" && (
                <HandoverView
                  cases={cases}
                  profile={profile}
                  handovers={handovers}
                  setHandovers={customSetHandovers}
                  onNavigateToTab={navigateToTab}
                  isDarkMode={isDarkMode}
                  activeSubTab={handoverSubTab}
                  setActiveSubTab={setHandoverSubTab}
                  quickPasteList={quickPasteList}
                  setQuickPasteList={customSetQuickPasteList}
                />
              )}

              {activeTab === "directory" && (
                <DoctorsDirectoryView
                  currentProfile={profile}
                  onNavigateToTab={navigateToTab}
                />
              )}

              {activeTab === "cases" && (
                <CasesListView
                  cases={cases}
                  onSelectCase={handleSelectCase}
                  onViewSheet={handleViewPrintSheet}
                  onNavigateToDischarge={handleNavigateToDischarge}
                  onDeleteCase={handleDeleteCase}
                  onStartFullFlow={() => setShowEntryMenu(true)}
                  onStartQuickCase={() => setActiveFormMode("quick")}
                  onNavigateToTab={navigateToTab}
                  onDeleteAllCases={handleDeleteAllCases}
                  onDiscussCase={(c) => setDiscussionModalCase(c)}
                />
              )}

              {activeTab === "mlc" && (
                <MlcCertificatesView
                  cases={cases.filter(c => c.patient?.isMlc)}
                  profile={profile}
                  onSelectCase={handleSelectCase}
                />
              )}
              {activeTab === "emdrugs" && (
                <ErGuideView
                  onBack={() => navigateToTab("dashboard")}
                  isDarkMode={isDarkMode}
                />
              )}

              {activeTab === "learn" && <LearnView onNavigateToTab={navigateToTab} isDarkMode={isDarkMode} />}

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
                  onDeleteAllCases={handleDeleteAllCases}
                  isOnShift={isOnShift}
                  setIsOnShift={setIsOnShift}
                  handovers={handovers}
                  setHandovers={customSetHandovers}
                  onNavigateToTab={navigateToTab}
                  teamMembers={teamMembers}
                  onAddMember={handleAddTeamMember}
                  onRemoveMember={handleRemoveTeamMember}
                  onUpdateShift={handleUpdateTeamMemberShift}
                  onApproveMember={handleApproveTeamMember}
                  onDeclineMember={handleDeclineTeamMember}
                  onUpdateRole={handleUpdateTeamMemberRole}
                  onLeaveTeam={handleLeaveTeam}
                  hospitalSubscription={hospitalSubscription}
                  shifts={shifts}
                  onUpdateShifts={handleUpdateHospitalShifts}
                />
              )}
            </>
          )}
              </>
            );
          })()}

        </Suspense>
        </div>
      </main>

      {/* New Patient Entry Method Selection Menu */}
      {showEntryMenu && (
        <NewPatientEntryMenu
          currentUserName={profile?.name || "Duty Doctor"}
          hospitalName={profile?.hospital || "Emergency Dept"}
          onClose={() => setShowEntryMenu(false)}
          onSelect={async (method: EntryMethod, newCase: ClinicalCase) => {
            setShowEntryMenu(false);
            
            // Optimistically add to cases so it's instantly available for CaseSheetView to render without refetch race conditions
            const caseToSave = {
              ...newCase,
              hospital: newCase.hospital || profile.hospital,
              doctorEmail: newCase.doctorEmail || profile.email,
              doctorName: newCase.doctorName || profile.name || "Emergency Doctor",
            };
            setCases(prev => [caseToSave, ...prev.filter(c => c.id !== newCase.id)]);
            
            // Do NOT await, let it save in background so UI navigates instantly!
            handleSaveCase(newCase).catch(console.error);

            switch (method) {
              case "triage":
                setActiveFormMode("full");
                break;
              case "speak":
                handleStartVoiceScribe(newCase.id);
                break;
              case "type":
              case "adult-direct":
              case "pediatric-direct":
                setPendingNewCase(caseToSave);
                setSelectedCaseId(newCase.id);
                break;
            }
          }}
        />
      )}

      {/* Simple Footer details */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-4 px-4 text-center text-[11px] text-slate-400 no-print mt-auto">
        <p>© 2026 ErMate Clinical Systems. All Rights Reserved. Complies with ATLS & PALS Clinical Guidelines.</p>
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
          <div className="bg-white dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-10">
            
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
                          ErMate is indexing standard ATLS, PALS, and AHA resuscitation guidelines for: "{customReferenceQuery}"
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
                      <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
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

      {/* System-wide Updates & Announcements Modal */}
      {showUpdatesModal && (
        <div 
          className="fixed inset-0 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          id="system-updates-modal"
        >
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-250 flex flex-col">
            {/* Header Banner */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900 text-white relative border-b border-emerald-500/30">
              <button 
                onClick={handleLaterApp}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-all bg-white/10 hover:bg-white/20 p-1.5 rounded-lg cursor-pointer"
                title="Dismiss (X)"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-widest font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {isHigherVersion(remoteVersion, APP_VERSION) ? "Update Available" : `Release Notes v${APP_VERSION}`}
                </span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-white font-sans flex items-center gap-1.5">
                {isHigherVersion(remoteVersion, APP_VERSION) ? (
                  <span>⚡ ErMate v{remoteVersion} Update Available (Installed: v{APP_VERSION})</span>
                ) : (
                  <span>⚡ What's New in ErMate v{APP_VERSION}</span>
                )}
              </h2>
            </div>

            {/* Updates Body */}
            <div className="p-5 space-y-3 text-slate-700 dark:text-slate-300">
              <ul className="space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {(CHANGELOG[remoteVersion] || CHANGELOG[APP_VERSION] || [
                  "Voice dictation is faster",
                  "Handover extraction improved",
                  "Normal exam fields auto-fill",
                  "Works offline seamlessly"
                ]).slice(0, 4).map((bullet, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              {isHigherVersion(remoteVersion, APP_VERSION) ? (
                <>
                  <button
                    type="button"
                    onClick={handleLaterApp}
                    className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Update now</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleLaterApp}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer text-center font-bold"
                >
                  Got it!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Learning & Privacy Consent Modal */}
      {showConsentModal && profile && (
        <ConsentModal
          isOpen={showConsentModal}
          profile={profile}
          isFirstCaseTrigger={consentFirstCaseTrigger}
          onConsent={handleConsentChoice}
          onClose={() => setShowConsentModal(false)}
        />
      )}

      {/* 1. Affiliation Conflict Modal */}
      {showAffiliationConflictModal && (
        <div 
          className="fixed inset-0 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          id="affiliation-conflict-modal"
        >
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 relative">
              <button 
                onClick={() => setShowAffiliationConflictModal(false)}
                className="absolute top-4 right-4 text-rose-850/65 dark:text-rose-400/80 hover:text-rose-900 dark:hover:text-rose-200 transition-all bg-rose-200/20 hover:bg-rose-200/45 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1 text-rose-700 dark:text-rose-450">
                <ShieldAlert className="w-5 h-5 animate-bounce" />
                <span className="text-[9px] font-mono tracking-widest font-extrabold uppercase bg-rose-500/15 px-2 py-0.5 rounded-full">Affiliation Conflict</span>
              </div>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white mt-1.5">Hospital Affiliation Warning</h2>
            </div>
            
            <div className="p-6 space-y-4 text-slate-700 dark:text-slate-300">
              <p className="text-xs font-semibold leading-normal">
                You are currently active on the roster for <span className="text-indigo-600 dark:text-indigo-400 font-bold">"{profile?.hospital || ""}"</span>. A clinician can only belong to one hospital team at a time.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-medium">
                Joining <span className="font-extrabold text-slate-800 dark:text-slate-200">"{initialHospital}"</span> will safely archive your membership at <span className="font-semibold">"{profile?.hospital || ""}"</span>. Your local medical cases, rounds history, and personal scribe notes will remain perfectly intact.
              </p>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAffiliationConflictModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer bg-transparent border-0"
              >
                Keep "{profile?.hospital || "Current Hospital"}"
              </button>
              <button
                onClick={handleConfirmLeaveAndJoin}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/15 cursor-pointer flex items-center gap-1.5"
              >
                Leave & Join New Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Role Selection / Onboarding Modal */}
      {showRoleSelectionModal && (
        <div 
          className="fixed inset-0 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          id="role-selection-modal"
        >
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white relative">
              <button 
                onClick={() => setShowRoleSelectionModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-all bg-white/10 hover:bg-white/25 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1 text-indigo-200">
                <UserCheck className="w-5 h-5" />
                <span className="text-[9px] font-mono tracking-widest font-extrabold uppercase bg-indigo-500/30 px-2 py-0.5 rounded-full">Roster Credentials</span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight mt-1.5">Select Department Position</h2>
              <p className="text-indigo-100 text-xs font-medium mt-0.5">Please specify your clinical designation at {initialHospital}.</p>
            </div>
            
            <div className="p-6 space-y-4 text-slate-700 dark:text-slate-300">
              <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase font-mono block mb-1">Select Designation</label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    role: "EM Resident" as const,
                    title: "Emergency Medicine Resident",
                    desc: "Full roster synchronization, shifts rota assignments, and team case handovers."
                  },
                  {
                    role: "Senior Consultant" as const,
                    title: "Senior Consultant",
                    desc: "All clinical features covered, with option to manage shifts or coordinate department teams."
                  }
                ].map((item) => (
                  <div
                    key={item.role}
                    onClick={() => setPendingJoinRole(item.role)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-left space-y-1.5 ${
                      pendingJoinRole === item.role
                        ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</strong>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        pendingJoinRole === item.role ? "border-indigo-600" : "border-slate-300"
                      }`}>
                        {pendingJoinRole === item.role && (
                          <div className="w-2 h-2 rounded-full bg-indigo-600" />
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-normal">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRoleSelectionModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer bg-transparent border-0"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleSelectionSubmit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/15 cursor-pointer flex items-center gap-1.5"
              >
                Submit Join Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Universal Download / Installation Guide Modal */}
      {showInstallModal && (
        <div 
          className="fixed inset-0 bg-slate-50 dark:bg-slate-900/70 backdrop-blur-xs z-55 flex items-center justify-center p-4 no-print"
          id="pwa-install-modal"
        >
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-250 flex flex-col max-h-[90vh]">
            
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white relative">
              <button 
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-all bg-white/10 hover:bg-white/25 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-5 h-5 text-indigo-300 animate-bounce" />
                <span className="text-[10px] font-mono tracking-widest font-extrabold uppercase bg-indigo-500/30 px-2.5 py-0.5 rounded-full">Device Download</span>
              </div>
              <h2 className="text-base font-black font-display tracking-tight">Download ErMate App</h2>
              <p className="text-indigo-100 text-xs mt-1 font-medium">Install ErMate Clinical Scribe on your smartphone, tablet, or desktop computer to run it full-screen with offline capabilities.</p>
            </div>

            {/* Modal Body with Guides */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 dark:text-slate-300 scrollbar-thin">
              
              {/* Direct Native Installer Option (if supported) */}
              {isInstallable && deferredPrompt ? (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-200/50 dark:border-indigo-800/30 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500 text-white shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300">Instant Installation Available</h4>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">Your current browser fully supports instant installation. Press the button below to download now.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleInstallApp();
                      setShowInstallModal(false);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                  >
                    Click to Install Instantly
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-800/20 rounded-xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-bold font-sans">Full Offline Caching & PWA Manifest are fully active on this domain!</span>
                </div>
              )}

              {/* Guide Tabs */}
              <div className="space-y-4">
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Platform Installation Manuals</span>
                
                {/* 1. iOS Safari (iPhone / iPad) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold">iOS</span>
                      Apple iPhone & iPad Safari
                    </span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                    <li>Open this website in your native <strong className="text-slate-800 dark:text-slate-200">Safari</strong> browser.</li>
                    <li>Tap the <strong className="text-indigo-600 dark:text-indigo-400">Share button</strong> <span className="inline-flex p-0.5 bg-slate-200 dark:bg-slate-850 rounded">📤</span> in Safari's bottom toolbar.</li>
                    <li>Scroll down the options menu and select <strong className="text-slate-800 dark:text-slate-200">"Add to Home Screen"</strong> <span className="inline-flex p-0.5 bg-slate-200 dark:bg-slate-850 rounded">➕</span>.</li>
                    <li>Tap <strong className="text-indigo-600 dark:text-indigo-400">"Add"</strong> at the top right of your screen. ErMate will immediately install as a native clinical icon!</li>
                  </ol>
                </div>

                {/* 2. Android (Chrome) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold">And</span>
                      Android Mobile Chrome
                    </span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                    <li>Tap the browser menu button <strong className="text-slate-800 dark:text-slate-200">(three dots ⁝)</strong> in the top-right corner.</li>
                    <li>Select <strong className="text-slate-800 dark:text-slate-200">"Install app"</strong> or <strong className="text-slate-800 dark:text-slate-200">"Add to Home screen"</strong> from the list.</li>
                    <li>Confirm the dialog prompt. The app will install and appear in your app drawer instantly.</li>
                  </ol>
                </div>

                {/* 3. Desktop (Chrome, Edge, Safari) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold">PC</span>
                      Desktop Computer (Chrome/Edge/Safari)
                    </span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                    <li><strong className="text-slate-800 dark:text-slate-200">Option A:</strong> Look at the right-side of your web browser's search URL bar. Click the <strong className="text-indigo-600 dark:text-indigo-400">Install / Download icon</strong> (often a monitor/plus symbol) to install instantly.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Option B:</strong> Click the browser menu button <strong className="text-slate-800 dark:text-slate-200">(three dots ⁝ or lines ☰)</strong>, select <strong className="text-slate-800 dark:text-slate-200">"Save and share"</strong>, and choose <strong className="text-slate-800 dark:text-slate-200">"Install App"</strong>.</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Got It, Thank You!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Case Confirmation Banner */}
      {savedBanner.visible && (
        <div className="fixed bottom-20 right-4 md:right-6 z-50 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-slide-up max-w-sm w-full">
          <div className="w-2.5 h-10 bg-emerald-500 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Case saved to Case Sheet</span>
            </div>
            <div className="text-xs text-slate-200 truncate font-semibold mt-0.5">
              {savedBanner.patientName ? `${savedBanner.patientName} · just now` : 'Just now'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedCaseId(savedBanner.caseId);
                setShowVoiceScribeChat(false);
                setActiveFormMode(null);
                setShowDischargeSummaryId(null);
                setSavedBanner(prev => ({ ...prev, visible: false }));
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-xs"
            >
              View case
            </button>
            <button
              onClick={() => setSavedBanner(prev => ({ ...prev, visible: false }))}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs flex gap-3 items-start animate-slide-in transition-all bg-white dark:bg-slate-950 ${
              toast.type === "success"
                ? "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-300"
                : toast.type === "warning"
                ? "border-rose-500/30 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/10 text-rose-800 dark:text-rose-300"
                : "border-blue-500/30 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/10 text-blue-800 dark:text-blue-300"
            }`}
          >
            <div className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full ${
              toast.type === "success"
                ? "bg-emerald-500"
                : toast.type === "warning"
                ? "bg-rose-500"
                : "bg-blue-500"
            }`} />
            <div className="flex-1">
              <span className="font-extrabold block text-slate-900 dark:text-white">
                {toast.title}
              </span>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-normal font-medium">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Patient Case Discussion Modal - Context-Bound Chat */}
      {discussionModalCase && (
        <BoundChatModal
          context={{
            type: 'case',
            id: discussionModalCase.id,
            data: discussionModalCase,
            canEdit: true,
            onRecordUpdated: (updatedFields) => {
              setCases(prev => prev.map(c => c.id === discussionModalCase.id ? { ...c, ...updatedFields } : c));
            }
          }}
          activeContexts={cases.map(c => ({
            type: 'case',
            id: c.id,
            data: c
          }))}
          onSelectContext={(ctx) => {
            if (ctx.data) {
              setDiscussionModalCase(ctx.data as ClinicalCase);
            }
          }}
          isOpen={!!discussionModalCase}
          onClose={() => setDiscussionModalCase(null)}
        />
      )}

    </div>
  );
}
