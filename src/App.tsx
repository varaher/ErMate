import { resolveWorkspaceForUser } from "./utils/workspaceResolver";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { 
  Activity, Sparkles, BookOpen, User, Clock, ShieldAlert, 
  Settings, HelpCircle, FileWarning,  Trophy, ClipboardList, Zap, Moon, Sun, Users,
  Search, X, TrendingUp, Bell, BellRing, Trash2, Check, Mic, ShieldCheck, RefreshCw,
  Download, Smartphone, Building2, UserCheck, CheckCircle2, Terminal, MessageSquare,
  MoreHorizontal, Wrench, Award
} from "lucide-react";

import { 
  ClinicalCase, UserProfile, PatientDemographics, PatientVitals, 
  DischargeInfo, TriageCategory, ArrivalMode, HandoverRecord, TeamMember, QuickPastePatient, HandoverPatient,
  VitalsRecord, PrimarySurvey, getInitialPrimarySurvey, isPendingApprovalStatus, isActiveMembershipStatus
} from "./types";
import { isCaseEligibleFor24hArchive, filterActiveNonArchivedCases, isCaseArchived } from "./utils/caseLifecycle";
import { saveHandoverPatient } from "./utils/handoverUtils";
import { triggerPrintWithTip } from "./utils/printWithTip";
import { getNormalizedRole } from "./utils/roleUtils";

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
const ToolsView = React.lazy(() => import("./components/ToolsView"));
const MoreView = React.lazy(() => import("./components/MoreView"));
import NewPatientEntryMenu, { type EntryMethod, isTriageCategoryPending } from "./components/NewPatientEntryMenu";
import { validateTeamInvite } from "./services/teamInviteService";
import { createQuickDischargeCase } from "./components/QuickDischargeIntake";
import ConsentModal from "./components/ConsentModal";
import { BoundChatModal } from "./components/BoundChatModal";
import { ROTA_SHIFTS } from "./components/TeamRosterBoard";
import { MlcCertificatesView } from "./components/MlcCertificatesView";
import { parseSecondaryAssessmentToSurvey } from "./components/SecondarySurveySection";
import PWABadge from "./components/PWABadge";
import { APP_VERSION, CHANGELOG } from "./changelog";
import { HeaderUpdateButton } from "./hooks/useAppUpdate";
import { GlobalRefreshButton } from "./components/shared/GlobalRefreshButton";
import { updateChatMessage, appendChatMessage, linkScribeSessionAndCase, verifyTwoSidedLink } from "./services/scribeChatStorage";
import { deduplicateConsultations } from "./utils/consultationNormalization";
import { isEstablishedCaseSheet } from "./utils/establishedCaseCheck";
import { resolveDutyWindow } from "./utils/dutyWindow";
import { allocateOrValidateBed } from "./utils/bedAllocation";
import { generateInternalCaseId, reserveNextDisplaySequence, getDisplayCaseId } from "./utils/caseIdentity";
import {
  startDutySession,
  endDutySession,
  subscribeActiveDutySession,
  isActiveDutySessionNow,
  type DutySessionRecord,
} from "./services/dutySessionService";

import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { sanitizeForFirestore } from "./utils/firestoreSanitizer";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  runTransaction
} from "firebase/firestore";
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
  const processedArchiveIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem("ermate_notifications", JSON.stringify(notifications));
    } catch (err) {
      console.error("Failed to save notifications to localStorage", err);
    }
  }, [notifications]);

  // Confirms an update actually landed after a reload triggered by
// handleUpdateApp. Relies on APP_VERSION being bumped on every deploy —
// see the standing deploy rule in AGENTS.md. If APP_VERSION isn't
// bumped, this will incorrectly report "Update Didn't Apply" even on a
// successful deploy — that's a signal to check the version bump, not a
// bug in this check itself.
useEffect(() => {
  const pendingVer = sessionStorage.getItem("ermate_update_confirm_pending");
  if (pendingVer) {
    sessionStorage.removeItem("ermate_update_confirm_pending");
    if (pendingVer === APP_VERSION) {
      triggerNotification("Updated ✓", `ErMate is now running v${APP_VERSION}.`, "success");
    } else {
      triggerNotification("Update Didn't Apply", `Still on v${APP_VERSION}. Please try again or refresh manually.`, "warning");
    }
  }
}, []);

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
  const [isUpdatingApp, setIsUpdatingApp] = useState<boolean>(false);

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
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    
    const targetVer = remoteVersion || currentVersion || APP_VERSION;
    localStorage.setItem("ermate_last_seen_version", targetVer);
    localStorage.setItem("ermate_app_known_version", targetVer);
    localStorage.setItem(`ermate_seen_version_${APP_VERSION}`, "true");
    sessionStorage.removeItem("ermate_dismissed_update_version");
    sessionStorage.setItem("ermate_update_confirm_pending", targetVer);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        if (registrations.length === 0) {
          window.location.reload();
          return;
        }
        for (const registration of registrations) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.update();
        }
        // The reload will happen naturally via 'controllerchange' listener in useAppUpdate.tsx
      }).catch(() => {
        setIsUpdatingApp(false);
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
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "analytics" | "admin" | "handover" | "cases" | "learn" | "profile" | "emdrugs" | "directory" | "mlc" | "tools" | "more" | "team" | "logbook"
  >("dashboard");
  const [discussionModalCase, setDiscussionModalCase] = useState<ClinicalCase | null>(null);

  const handleSaveDiscussionHistory = (caseId: string, messages: any[]) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, discussionMessages: messages } : c));
    setDiscussionModalCase(prev => prev && prev.id === caseId ? { ...prev, discussionMessages: messages } : prev);
  };
  const [showVoiceScribeChat, setShowVoiceScribeChat] = useState<boolean>(false);
  const [voiceScribeCaseId, setVoiceScribeCaseId] = useState<string | null>(null);
  const [voiceScribeSessionId, setVoiceScribeSessionId] = useState<string | null>(null);
  // NEW — entry-choice popup and discussion-mode flag for the merged
  // ErMate Assistant. See handleVoiceScribeEntryClick / handleStartFreeDiscussion.
  const [showVoiceScribeEntryChoice, setShowVoiceScribeEntryChoice] = useState<boolean>(false);
  const [voiceScribeDiscussionMode, setVoiceScribeDiscussionMode] = useState<boolean>(false);
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
  
  // Preview Case Sheet State (in-memory review before Firestore write)
  const [previewCase, setPreviewCase] = useState<ClinicalCase | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [pendingPreviewContext, setPendingPreviewContext] = useState<{
    msgId?: string;
    caseId: string;
    contributingMsgIds: string[];
    scribeSessionId?: string | null;
  } | null>(null);

  // Preview Discharge Summary State (in-memory review before Firestore write)
  const [previewDischargeCase, setPreviewDischargeCase] = useState<ClinicalCase | null>(null);
  const [isDischargePreviewMode, setIsDischargePreviewMode] = useState<boolean>(false);
  const [pendingDischargePreviewContext, setPendingDischargePreviewContext] = useState<{
    msgId?: string;
    caseId: string;
    contributingMsgIds: string[];
    scribeSessionId?: string | null;
  } | null>(null);
  
  // Manual Data Refresh & Dirty Tracking State
  const [isCaseSheetDirty, setIsCaseSheetDirty] = useState<boolean>(false);
  const [isScribeBusy, setIsScribeBusy] = useState<boolean>(false);
  const [caseRefreshTimestamp, setCaseRefreshTimestamp] = useState<number>(0);
  const [scribeRefreshTrigger, setScribeRefreshTrigger] = useState<number>(0);
  const caseSheetActionsRef = useRef<{ save: () => Promise<void>; discard: () => void } | null>(null);

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
    hospital: "",
    aiCredits: 100,
    streak: 1,
    subscriptionTier: "Free Standard"
  });

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Shift & Team states
  const [activeDutySession, setActiveDutySession] = useState<DutySessionRecord | null>(() => {
    try {
      const saved = localStorage.getItem("ermate_activeDutySession");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && isActiveDutySessionNow(parsed, new Date())) return parsed;
      }
    } catch (e) {}
    return null;
  });

  const activeDutySessionIdRef = useRef<string | null>(
    activeDutySession?.id ?? null
  );

  const [isOnShift, setIsOnShift] = useState<boolean>(() => {
    try {
      const savedSession = localStorage.getItem("ermate_activeDutySession");
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && isActiveDutySessionNow(parsed, new Date())) {
          return true;
        }
      }
    } catch(e) {}
    return false;
  });

  // Real-time cross-device synchronization for active duty session
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = subscribeActiveDutySession(uid, (session) => {
      activeDutySessionIdRef.current = session?.id ?? null;
      setActiveDutySession(session);
      if (session && isActiveDutySessionNow(session, new Date())) {
        setIsOnShift(true);
      } else {
        setIsOnShift(false);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  // Authoritative clock-based automatic expiry & visibility/focus listener
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!activeDutySession) {
      setIsOnShift(false);
      return;
    }

    const sessionId = activeDutySession.id;

    const recheckValidity = () => {
      const now = new Date();
      if (!isActiveDutySessionNow(activeDutySession, now)) {
        if (activeDutySessionIdRef.current === sessionId) {
          setIsOnShift(false);
        }

        if (uid && activeDutySession.status === "active") {
          endDutySession(uid, sessionId).catch(() => {});
        }

        return false;
      }

      if (activeDutySessionIdRef.current === sessionId) {
        setIsOnShift(true);
      }
      return true;
    };

    // Immediate check on mount/session update
    const isValid = recheckValidity();
    if (!isValid) return;

    // Schedule exact timeout for duty end
    const endMs = new Date(activeDutySession.end).getTime();
    const remainingMs = endMs - Date.now();
    let timerId: any = null;

    if (remainingMs > 0) {
      timerId = setTimeout(() => {
        if (activeDutySessionIdRef.current === sessionId) {
          setIsOnShift(false);
        }

        if (uid) {
          endDutySession(uid, sessionId).catch(() => {});
        }
      }, remainingMs);
    } else {
      if (activeDutySessionIdRef.current === sessionId) {
        setIsOnShift(false);
      }

      if (uid) {
        endDutySession(uid, sessionId).catch(() => {});
      }
    }

    // Re-evaluate on window focus & document visibility change (mobile background / laptop lid sleep)
    const handleActivity = () => {
      recheckValidity();
    };

    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [activeDutySession, auth.currentUser?.uid]);

  const handleStartDutySession = async (shift: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const session = await startDutySession(uid, shift, {
      hospital: profile.hospital,
      hospitalId: (profile as any)?.hospitalId,
    });
    if (!session) {
      triggerNotification(
        "Shift Inactive",
        `The ${shift?.name || "selected"} shift (${shift?.time || ""}) is not active at the current time.`,
        "warning"
      );
      return;
    }
    // Set authoritative session without optimistic forcing
    activeDutySessionIdRef.current = session.id;
    setActiveDutySession(session);
  };

  const handleEndDutySession = async () => {
    const uid = auth.currentUser?.uid;
    const sessionId = activeDutySession?.id;

    if (!uid || !sessionId) return;

    const didEnd = await endDutySession(uid, sessionId);

    // Clear local state only if THIS exact session was actually ended
    // and has not meanwhile been replaced by another device/session.
    if (
      didEnd &&
      activeDutySessionIdRef.current === sessionId
    ) {
      activeDutySessionIdRef.current = null;
      setActiveDutySession(null);
      setIsOnShift(false);
    }
  };

  /**
   * Canonical Case-Creation Duty Provenance Resolver (ErMate — Patch D3A)
   *
   * ClinicalCase shift provenance must describe a REAL confirmed Actual Duty Session.
   * If there is no valid Actual Duty Session:
   *   - DO NOT infer from team rota
   *   - DO NOT invent Morning
   *   - DO NOT create fake shift provenance
   *
   * Only two semantic outcomes:
   * A. Valid Actual Duty: return real metadata
   * B. No Valid Actual Duty: return null
   */
  const getCaseCreationDutyMetadata = (
    sessionOverride?: DutySessionRecord | null
  ): {
    shiftId: string;
    shiftDate: string;
    shiftName: string;
    baseShiftId: string;
  } | null => {
    const sessionToUse =
      sessionOverride !== undefined
        ? sessionOverride
        : activeDutySession;

    if (
      !sessionToUse ||
      !isActiveDutySessionNow(sessionToUse, new Date())
    ) {
      return null;
    }

    const baseShiftId = sessionToUse.shiftId || "custom";
    const cleanBase = baseShiftId.startsWith("shift_") ? baseShiftId.replace(/^shift_/, "") : baseShiftId;
    const shiftDate = sessionToUse.dutyDateKey;
    const compactDate = shiftDate.replace(/-/g, "");
    const shiftId = `shift_${cleanBase}_${compactDate}`;
    const shiftName = sessionToUse.shiftName || (cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1));

    return {
      shiftId,
      shiftDate,
      shiftName,
      baseShiftId: cleanBase,
    };
  };

  /**
   * Canonical Duty-Bound Current Clinician Assignment Resolver (ErMate — Patch D4A)
   *
   * Resolves the operational current clinician assignment and duty session:
   * - currentAssigneeUid: Auth UID of clinician currently responsible
   * - currentAssigneeEmail: current clinician email
   * - currentAssigneeName: current clinician display name
   * - currentAssignmentDutySessionId: exact Actual Duty Session during which responsibility was accepted
   * - currentAssignmentDutyDateKey: that session's canonical dutyDateKey
   * - currentAssignmentShiftId: raw Actual Duty Session shift ID (e.g. "morning", "evening", "night", "d1")
   * - currentAssignmentAt: ISO timestamp when this assignment/takeover occurred
   *
   * If there is no valid Actual Duty Session active right now:
   * - The clinician assignment fields (uid, email, name, at) are still recorded
   * - The duty session fields (dutySessionId, dutyDateKey, shiftId) are omitted (never fabricated)
   */
  const getCurrentAssignmentMetadata = (
    clinicianOverride?: { uid?: string; email?: string; name?: string },
    sessionOverride?: DutySessionRecord | null,
    assignmentTimestamp?: string
  ): {
    currentAssigneeUid: string;
    currentAssigneeEmail: string;
    currentAssigneeName: string;
    currentAssignmentAt: string;
    currentAssignmentDutySessionId?: string;
    currentAssignmentDutyDateKey?: string;
    currentAssignmentShiftId?: string;
  } => {
    const sessionToUse =
      sessionOverride !== undefined
        ? sessionOverride
        : activeDutySession;

    const isSessionActive =
      sessionToUse && isActiveDutySessionNow(sessionToUse, new Date());

    const rawShiftId = isSessionActive
      ? (sessionToUse.shiftId || "custom").trim().toLowerCase().replace(/^shift_/, "")
      : undefined;

    const editName = (profile?.name || "").startsWith("Dr. ")
      ? profile.name
      : "Dr. " + (profile?.name || "Doctor");

    return {
      currentAssigneeUid: clinicianOverride?.uid || auth.currentUser?.uid || "uid_priya",
      currentAssigneeEmail: clinicianOverride?.email || profile?.email || auth.currentUser?.email || "",
      currentAssigneeName: clinicianOverride?.name || editName,
      currentAssignmentAt: assignmentTimestamp || new Date().toISOString(),
      ...(isSessionActive && rawShiftId && sessionToUse
        ? {
            currentAssignmentDutySessionId: sessionToUse.id,
            currentAssignmentDutyDateKey: sessionToUse.dutyDateKey,
            currentAssignmentShiftId: rawShiftId,
          }
        : {}),
    };
  };
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

  // Hospital ER physical numbered-bed capacity.
  // Example: 30 means base locations 1..30.
  // MATE derives 1/1A/1B ... 30/30A/30B from this value.
  const [erPhysicalBedCapacity, setErPhysicalBedCapacity] =
    useState<number | null>(null);
  const [hospitalSubscription, setHospitalSubscription] = useState<{ active: boolean; subscriptionTier: string } | null>(null);

  // Normalized clinical role for role-based navigation and permissions
  const userNormalizedRole = React.useMemo(() => {
    return getNormalizedRole({
      email: profile?.email,
      role: profile?.role,
      hospital: profile?.hospital,
      membershipRole: teamMembers.find(m => m.email.toLowerCase().trim() === (profile?.email || "").toLowerCase().trim())?.role
    });
  }, [profile?.email, profile?.role, profile?.hospital, teamMembers]);

// Auth state listener with real-time UserProfile sync.
//
// SECURITY:
// - Firebase Auth establishes identity.
// - users/{uid} is profile/display state, not membership authority.
// - Hospital/team authority comes from trusted team_members/backend flows.
// - Missing profiles are created atomically so signup and auth bootstrap
//   cannot overwrite each other.
useEffect(() => {
  let unsubscribeProfile:
    (() => void) | null = null;

  /*
   * Prevent an older asynchronous auth callback
   * from changing state after Firebase identity
   * has already changed.
   */
  let authGeneration = 0;

  const unsubscribeAuth =
    onAuthStateChanged(
      auth,
      async (user) => {
        const generation =
          ++authGeneration;

        /*
         * Remove any listener belonging to the
         * previously authenticated user.
         */
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        setAuthLoading(true);

        /*
         * Firebase says there is no signed-in user.
         */
        if (!user) {
          setIsLoggedIn(false);
          setProfile(null as any);

          setCases([]);
          setHandovers([]);
          setQuickPasteList([]);
          setTeamMembers([]);
          setShifts([]);
          setHospitalSubscription(null);

          setAuthLoading(false);
          return;
        }

        const authenticatedEmail =
          String(user.email || "")
            .trim()
            .toLowerCase();

        /*
         * ErMate requires an authenticated email
         * identity.
         *
         * Never fabricate doctor@ermate.in or another
         * identity if Firebase supplies no email.
         */
        if (!authenticatedEmail) {
          console.warn(
            "Authenticated Firebase user has no email address."
          );

          /*
           * Do not leave Firebase authenticated while
           * showing the ErMate login screen.
           */
          await signOut(auth).catch(
            () => undefined
          );

          setIsLoggedIn(false);
          setProfile(null as any);
          setAuthLoading(false);

          return;
        }

        const profileDocRef =
          doc(
            db,
            "users",
            user.uid
          );

        const rawName =
          String(
            user.displayName ||
            authenticatedEmail.split("@")[0] ||
            "Doctor"
          ).trim();

        const formattedName =
          rawName.startsWith("Dr.")
            ? rawName
            : `Dr. ${rawName}`;

        /*
         * Safe standalone defaults only.
         *
         * These values grant:
         * - no hospital membership
         * - no HOD/leadership authority
         * - no paid entitlement
         */
        const safeInitialProfile:
          UserProfile = {
          name: formattedName,
          email: authenticatedEmail,

          role: "EM Resident",
          hospital: "",

          aiCredits: 100,
          streak: 1,

          subscriptionTier:
            "Free Standard"
        };

        let currentProfile:
          UserProfile;

        try {
          /*
           * Atomic CREATE-IF-MISSING.
           *
           * Signup may be writing users/{uid} at
           * almost exactly the same time that
           * onAuthStateChanged runs.
           *
           * The transaction re-checks the document
           * before writing, so App.tsx cannot overwrite
           * a profile SignUpView just created.
           */
          currentProfile =
            await runTransaction(
              db,
              async (transaction) => {
                const latestSnap =
                  await transaction.get(
                    profileDocRef
                  );

                if (
                  latestSnap.exists()
                ) {
                  return latestSnap.data() as UserProfile;
                }

                transaction.set(
                  profileDocRef,
                  safeInitialProfile,
                  {
                    merge: true
                  }
                );

                return safeInitialProfile;
              }
            );

          /*
           * Ignore stale asynchronous results if the
           * Firebase identity changed meanwhile.
           */
          if (
            generation !== authGeneration
          ) {
            return;
          }

          setProfile(
            currentProfile
          );

          setIsLoggedIn(true);
        } catch (err) {
          console.warn(
            "Profile bootstrap unavailable; using safe local fallback:",
            err
          );

          if (
            generation !== authGeneration
          ) {
            return;
          }

          /*
           * Local fallback only.
           *
           * It does not grant hospital membership
           * or backend permissions.
           */
          currentProfile =
            safeInitialProfile;

          setProfile(
            currentProfile
          );

          setIsLoggedIn(true);
        }

        if (
          generation !== authGeneration
        ) {
          return;
        }

        /*
         * Real-time UserProfile listener.
         */
        unsubscribeProfile =
          onSnapshot(
            profileDocRef,

            (snapshot) => {
              if (
                generation !==
                authGeneration
              ) {
                return;
              }

              if (
                !snapshot.exists()
              ) {
                return;
              }

              const data = snapshot.data() as (UserProfile & {
                teamAddedNotification?: {
                  title: string;
                  message: string;
                  timestamp: string;
                  acknowledged: boolean;
                };
              });

              if (
                data.teamAddedNotification &&
                !data.teamAddedNotification
                  .acknowledged
              ) {
                triggerNotification(
                  data.teamAddedNotification
                    .title,

                  data.teamAddedNotification
                    .message,

                  "success"
                );

                /*
                 * Notification acknowledgement changes
                 * no membership/authority fields.
                 */
                updateDoc(
                  profileDocRef,
                  {
                    "teamAddedNotification.acknowledged":
                      true
                  }
                ).catch((error) => {
                  console.warn(
                    "Error acknowledging team notification:",
                    error
                  );
                });
              }

              setProfile(data);
            },

            (error) => {
              if (
                generation !==
                authGeneration
              ) {
                return;
              }

              console.warn(
                "Profile onSnapshot unavailable:",
                error?.message ||
                error
              );
            }
          );

        setAuthLoading(false);
      }
    );

  return () => {
    authGeneration++;

    unsubscribeAuth();

    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }
  };
}, []);

  // A2: Restore invitation after email verification / login on the same device
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;
    if (typeof sessionStorage === "undefined") return;

    const storedToken = sessionStorage.getItem("ermate_pending_invite_token");
    const storedHospital = sessionStorage.getItem("ermate_pending_invite_hospital");

    if (storedToken && storedToken.trim()) {
      const cleanToken = storedToken.trim();
      validateTeamInvite(cleanToken)
        .then((result) => {
          if (result.valid && result.hospital) {
            setActiveInviteToken(cleanToken);
            setInitialHospital(result.hospital);
          } else {
            // Invalid, expired, revoked, or max uses exceeded
            sessionStorage.removeItem("ermate_pending_invite_token");
            sessionStorage.removeItem("ermate_pending_invite_hospital");
            setActiveInviteToken("");
            setInitialHospital("");
          }
        })
        .catch((err) => {
          console.warn("Could not revalidate pending invite on login:", err);
        });
    }
  }, [isLoggedIn]);

  // B3 & B6: 24-Hour Incomplete Case Soft-Archive Engine (Never Hard-Delete)
  useEffect(() => {
    if (!isLoggedIn || !cases || cases.length === 0) return;

    const runArchiveAudit = async () => {
      const now = new Date();
      const eligibleCases = cases.filter((c) => isCaseEligibleFor24hArchive(c, now));
      if (eligibleCases.length === 0) return;

      for (const c of eligibleCases) {
        if (processedArchiveIdsRef.current.has(c.id)) continue;
        processedArchiveIdsRef.current.add(c.id);

        try {
          const nowIso = now.toISOString();
          await updateDoc(doc(db, "cases", c.id), {
            archivedAt: nowIso,
            archivedBy: "system",
            archiveReason: "incomplete_case_24h"
          });
          // Optimistically update local case state
          setCases((prev) =>
            prev.map((existing) =>
              existing.id === c.id
                ? {
                    ...existing,
                    archivedAt: nowIso,
                    archivedBy: "system",
                    archiveReason: "incomplete_case_24h"
                  }
                : existing
            )
          );
        } catch (err) {
          console.error("Failed to soft-archive case:", c.id, err);
          processedArchiveIdsRef.current.delete(c.id);
        }
      }
    };

    runArchiveAudit();
    const interval = setInterval(runArchiveAudit, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, cases]);

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
         const itemToSave = {
  ...item,

  // Independent-workspace seed.
  // Creator identity must come from Firebase Auth.
  hospital: profile.hospital || "",

  createdByUid:
    auth.currentUser?.uid || "",

  createdByEmail:
    auth.currentUser?.email ||
    profile.email ||
    "",

  updatedAt:
    new Date().toISOString()
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
// READ-ONLY in the browser.
// Membership creation, activation, removal and role authority are handled
// only by the trusted /api/team backend.
let unsubscribeTeam: () => void = () => {};

if (userHospital && userHospital.trim()) {
  const teamQuery = query(
    collection(db, "team_members"),
    where("hospital", "==", userHospital)
  );

  unsubscribeTeam = onSnapshot(
    teamQuery,
    (snapshot) => {
      const loadedTeam: TeamMember[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TeamMember;

        loadedTeam.push({
          ...data,
          id: data.id || docSnap.id
        });
      });

      const filteredTeam = loadedTeam.filter((member) => {
        const memberHospital = (member.hospital || "")
          .trim()
          .toLowerCase();

        return memberHospital === userHospitalLower;
      });

      setTeamMembers(filteredTeam);
    },
    (error) => {
      console.warn(
        "Team members listener unavailable:",
        error?.message || error
      );

      setTeamMembers([]);
    }
  );
} else {
  // Independent users must not enumerate hospital membership records.
  setTeamMembers([]);
}

    // Stream Hospital Subscription & Shifts Configuration
    let unsubscribeSub: () => void = () => {};
let unsubscribeShifts: () => void = () => {};
let unsubscribeShiftMembership: () => void = () => {};

    const hospitalSlug = userHospitalLower.replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "");
    if (hospitalSlug && hospitalSlug.trim().length > 0) {
      const subDocRef = doc(db, "hospital_subscriptions", hospitalSlug);
    unsubscribeSub = onSnapshot(
  subDocRef,
  (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();

      setHospitalSubscription({
        active: data.active === true,
        subscriptionTier:
          data.subscriptionTier || "Free Standard"
      });
    } else {
      // READ-ONLY client:
      // Hospital subscriptions are created/activated only by trusted
      // backend/admin workflows. The browser must never self-create one.
      setHospitalSubscription(null);
    }
  },
  (error) => {
    console.warn(
      "Subscription onSnapshot unavailable:",
      error?.message || error
    );

    setHospitalSubscription(null);
  }
);
     
    } else {
      setHospitalSubscription(null);
     
    }
// Hospital shift configuration must follow the canonical
// team_members/{uid} membership, never users/{uid}.hospital.
if (auth.currentUser) {
  const selfMembershipRef = doc(
    db,
    "team_members",
    auth.currentUser.uid
  );

  unsubscribeShiftMembership = onSnapshot(
    selfMembershipRef,
    (memberSnapshot) => {
      // Stop listening to any previous hospital shift document.
      unsubscribeShifts();
      unsubscribeShifts = () => {};

      if (!memberSnapshot.exists()) {
        setShifts(ROTA_SHIFTS);
        return;
      }

      const membership = memberSnapshot.data() as any;

      const membershipStatus =
        String(membership.status || "");

      const isActiveMembership =
        isActiveMembershipStatus(membershipStatus);

      const isVerifiedMembership =
        membership.membershipVerified === true;

      const trustedHospitalId =
        typeof membership.hospitalId === "string" &&
        membership.hospitalId.trim()
          ? membership.hospitalId.trim()
          : (
              typeof membership.hospital === "string"
                ? membership.hospital.trim()
                : ""
            );

      if (
        !isActiveMembership ||
        !isVerifiedMembership ||
        !trustedHospitalId
      ) {
        setShifts(ROTA_SHIFTS);
        setErPhysicalBedCapacity(null);
        return;
      }

      const shiftDocRef = doc(
        db,
        "hospital_shifts",
        trustedHospitalId
      );

      unsubscribeShifts = onSnapshot(
        shiftDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setShifts(ROTA_SHIFTS);
            setErPhysicalBedCapacity(null);
            return;
          }

          const data = snapshot.data();

          if (Array.isArray(data.shifts)) {
            setShifts(data.shifts);
          } else {
            setShifts(ROTA_SHIFTS);
          }

          const storedCapacity = Number(data.erPhysicalBedCapacity);
          if (
            Number.isInteger(storedCapacity) &&
            storedCapacity > 0
          ) {
            setErPhysicalBedCapacity(storedCapacity);
          } else {
            setErPhysicalBedCapacity(null);
          }
        },
        (error) => {
          console.error(
            "Error fetching hospital shifts:",
            error
          );

          setShifts(ROTA_SHIFTS);
          setErPhysicalBedCapacity(null);
        }
      );
    },
    (error) => {
      console.warn(
        "Trusted membership unavailable for shifts:",
        error?.message || error
      );

      setShifts(ROTA_SHIFTS);
      setErPhysicalBedCapacity(null);
    }
  );
} else {
  setShifts(ROTA_SHIFTS);
  setErPhysicalBedCapacity(null);
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
      unsubscribeShiftMembership();
      unsubscribeShifts();
      unsubscribeContributions();
    };
  }, [isLoggedIn, profile?.hospital, profile?.email, profile?.subscriptionTier]);

  // View controllers
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseSheetInitialTab, setCaseSheetInitialTab] = useState<string | null>(null);
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
// P0 rule: hard deletion is reserved for the platform admin.
// Normal clinicians must never remove the case locally if Firestore denies it.
const handleDeleteCase = async (caseId: string) => {
  const currentEmail = (auth.currentUser?.email || "")
    .trim()
    .toLowerCase();

  const isPlatformAdminUser =
    currentEmail === "varahgrp@gmail.com";

  if (!isPlatformAdminUser) {
    triggerNotification(
      "Deletion Restricted",
      "Clinical cases cannot be permanently deleted by normal users.",
      "warning"
    );
    return;
  }

  try {
    const targetCase = cases.find(c => c.id === caseId);

    console.log("[Delete] Path: cases/" + caseId);

    await deleteDoc(doc(db, "cases", caseId));

    // Platform-admin cleanup of legacy department mirror if present.
    const deptId =
      targetCase?.departmentId ||
      profile.hospital ||
      "er";

    try {
      await deleteDoc(
        doc(db, "departments", deptId, "cases", caseId)
      );
    } catch (subErr) {
      console.warn(
        "Department mirror delete skipped or unavailable:",
        subErr
      );
    }

    // Update UI only AFTER Firestore deletion succeeded.
    setCases(prev =>
      prev.filter(c => c.id !== caseId)
    );

    if (selectedCaseId === caseId) {
      setSelectedCaseId(null);
    }

    triggerNotification(
      "Case Deleted",
      "The case was permanently deleted by the platform administrator.",
      "info"
    );
  } catch (err: any) {
    console.error("[Delete Case Error]", err);

    // IMPORTANT:
    // Do NOT remove the case from local state when deletion fails.
    triggerNotification(
      "Delete Failed",
      "The case was not deleted. Your clinical record remains unchanged.",
      "warning"
    );
  }
};


// Delete all cases
// P0 rule: bulk hard deletion is platform-admin only.
const handleDeleteAllCases = async () => {
  const currentEmail = (auth.currentUser?.email || "")
    .trim()
    .toLowerCase();

  const isPlatformAdminUser =
    currentEmail === "varahgrp@gmail.com";

  if (!isPlatformAdminUser) {
    triggerNotification(
      "Deletion Restricted",
      "Bulk permanent deletion of clinical cases is not permitted.",
      "warning"
    );
    return;
  }

  try {
    const currentCases = [...cases];

    for (const c of currentCases) {
      console.log("[Delete All] Path: cases/" + c.id);

      await deleteDoc(doc(db, "cases", c.id));

      const deptId =
        c.departmentId ||
        profile.hospital ||
        "er";

      try {
        await deleteDoc(
          doc(db, "departments", deptId, "cases", c.id)
        );
      } catch (subErr) {
        console.warn(
          "Department mirror delete skipped:",
          subErr
        );
      }
    }

    // Clear UI only after all primary deletions succeeded.
    setCases([]);
    setSelectedCaseId(null);

    triggerNotification(
      "Cases Deleted",
      "All selected cases were permanently deleted by the platform administrator.",
      "info"
    );
  } catch (err: any) {
    console.error("[Delete All Cases Error]", err);

    // Never falsely clear the UI when deletion failed.
    triggerNotification(
      "Delete Failed",
      "One or more cases could not be deleted. Reload to confirm the current records.",
      "warning"
    );
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
  const handleTriageSubmit = async (
    demographics: PatientDemographics, 
    vitals: PatientVitals,
    bedNo?: string
  ) => {
    const isPeds = demographics.age !== null && demographics.age <= 16;
    
    // Phase 2: Resolve workspace ownership securely
    if (!auth.currentUser) throw new Error("Not authenticated");
    const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
    
    // Resolve case creation duty provenance dynamically (ErMate — Patch D3A)
    const creationDuty = getCaseCreationDutyMetadata();
    
    const consultantOnShift = creationDuty
      ? teamMembers.find(
          m => ((m.role || "").toLowerCase().includes("consultant") || (m.role || "").toLowerCase().includes("hod") || (m.role || "").toLowerCase().includes("lead")) && m.shift === creationDuty.baseShiftId
        )
      : null;
    const consultantId = consultantOnShift ? consultantOnShift.id : undefined;
    const consultantName = consultantOnShift ? (consultantOnShift.name || undefined) : undefined;
    const createdByUid = auth.currentUser?.uid || "uid_priya";
    const createdByRoleVal = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const hospitalSlug = (profile.hospital || "general-er").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

    const parseNullableInt = (value: string | undefined | null): number | null => {
      const parsed = parseInt(value ?? "", 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const parseNullableFloat = (value: string | undefined | null): number | null => {
      const parsed = parseFloat(value ?? "");
      return Number.isFinite(parsed) ? parsed : null;
    };

    const hasInitialVitals = [
      vitals.bp,
      vitals.hr,
      vitals.spo2,
      vitals.rr,
      vitals.temp,
    ].some(value => typeof value === "string" && value.trim() !== "");

    const internalCaseId = generateInternalCaseId();
    let displayCaseId: string | undefined = undefined;
    try {
      const reserved = await reserveNextDisplaySequence(db);
      displayCaseId = reserved.displayId;
    } catch (seqErr: any) {
      console.error("[handleTriageSubmit] Failed to reserve displayId sequence:", seqErr);
      triggerNotification("Registration Error", seqErr?.message || "Could not reserve daily case ID.", "warning");
      return;
    }

    const newCase: ClinicalCase = {
      id: internalCaseId,
      ...(displayCaseId ? { displayId: displayCaseId } : {}),
      ...(bedNo ? { bedNo } : {}),
      workspaceType: workspace.workspaceType,
      ownerUid: workspace.ownerUid,
      hospitalId: workspace.hospitalId,
      createdBy: createdByUid,
      createdByUid: auth.currentUser?.uid || createdByUid,
      createdByName: (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor"),
      createdByRole: createdByRoleVal,
      ...(creationDuty
        ? {
            shiftId: creationDuty.shiftId,
            shiftDate: creationDuty.shiftDate,
            shiftName: creationDuty.shiftName,
          }
        : {}),
      ...(consultantId ? { consultantId } : {}),
      ...(consultantName ? { consultantName } : {}),
      departmentId: hospitalSlug,
      createdAt: new Date().toISOString(),
      currentAssigneeUid: auth.currentUser?.uid || createdByUid,
      currentAssigneeEmail: profile.email,
      currentAssigneeName: (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor"),
      currentAssignmentAt: new Date().toISOString(),
      ...(creationDuty && activeDutySession
        ? {
            currentAssignmentDutySessionId: activeDutySession.id,
            currentAssignmentDutyDateKey: activeDutySession.dutyDateKey,
            currentAssignmentShiftId: creationDuty.baseShiftId,
          }
        : {}),
      patient: {
        ...demographics,
        ...(bedNo ? { bed: bedNo } : {}),
      },
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
        ipsg1IdentifiersVerified: null,
        ipsg2ReadBackPerformed: null,
        ipsg3HighAlertDoubleChecked: null,
        ipsg4TimeOutPerformed: null,
        ipsg5HandHygieneComplied: null,
        ipsg6FallRiskAssessed: null
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
        durationInEr: "",
        residentName: "Dr. " + profile.name,
        consultantName: "Dr. " + profile.name,
        observationNotes: ""
      } as any,
      vitalsHistory: hasInitialVitals
        ? [
            {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              bp: vitals.bp || "",
              systolic: parseNullableInt(vitals.bp?.split("/")[0]),
              diastolic: parseNullableInt(vitals.bp?.split("/")[1]),
              hr: parseNullableInt(vitals.hr),
              spo2: parseNullableInt(vitals.spo2),
              rr: parseNullableInt(vitals.rr),
              temp: parseNullableFloat(vitals.temp)
            }
          ]
        : []
    };

    try {
      await setDoc(doc(db, "cases", newCase.id), sanitizeForFirestore(newCase), { merge: true });
    } catch (err: any) {
      console.error("Error saving triaged case:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
      triggerNotification("Save Failed", "Unable to save this case. Please try again.", "warning");
      return;
    }

    setCases(prev => [newCase, ...prev.filter(c => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setActiveFormMode(null);
    checkConsentOnCaseSaved();
  };

  // Save changes inside Case Sheet View
  const handleSaveCase = async (updatedCase: ClinicalCase) => {
    const previousCase = cases.find(c => c.id === updatedCase.id);
    
    // Phase 2: If this is a brand new case (like from Quick Discharge), resolve workspace securely.
    // If it's an existing case, preserve its existing ownership metadata.
    let workspaceMetadata = {
      workspaceType: updatedCase.workspaceType,
      ownerUid: updatedCase.ownerUid,
      hospitalId: updatedCase.hospitalId
    };

    if (!previousCase && !updatedCase.workspaceType) {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
      workspaceMetadata = {
        workspaceType: workspace.workspaceType,
        ownerUid: workspace.ownerUid,
        hospitalId: workspace.hospitalId
      };
    } else if (previousCase) {
      workspaceMetadata = {
        workspaceType: previousCase.workspaceType || updatedCase.workspaceType,
        ownerUid: previousCase.ownerUid || updatedCase.ownerUid || null,
        hospitalId: previousCase.hospitalId || updatedCase.hospitalId || null
      };
    }

    const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const editUid = auth.currentUser?.uid || "uid_priya";
    const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

    const isBrandNewCase = !previousCase;
    const creationDuty = isBrandNewCase ? getCaseCreationDutyMetadata() : null;

    // Resolve shift provenance (Patch D3A):
    // 1. Existing case: preserve previousCase provenance exactly (even if undefined/absent)
    // 2. New case with pre-assigned provenance: preserve updatedCase provenance
    // 3. New case without provenance: stamp creationDuty ONLY if a valid Actual Duty Session exists
    // 4. Otherwise: leave fields absent (never infer or fabricate)
    const resolvedShiftProvenance = previousCase
      ? {
          ...(previousCase.shiftId !== undefined ? { shiftId: previousCase.shiftId } : {}),
          ...(previousCase.shiftDate !== undefined ? { shiftDate: previousCase.shiftDate } : {}),
          ...(previousCase.shiftName !== undefined ? { shiftName: previousCase.shiftName } : {}),
        }
      : {
          ...(updatedCase.shiftId !== undefined
            ? { shiftId: updatedCase.shiftId }
            : creationDuty ? { shiftId: creationDuty.shiftId } : {}),
          ...(updatedCase.shiftDate !== undefined
            ? { shiftDate: updatedCase.shiftDate }
            : creationDuty ? { shiftDate: creationDuty.shiftDate } : {}),
          ...(updatedCase.shiftName !== undefined
            ? { shiftName: updatedCase.shiftName }
            : creationDuty ? { shiftName: creationDuty.shiftName } : {}),
        };

    // Resolve current clinician assignment & duty session (ErMate — Patch D4A):
    // 1. Is it a takeover / transfer to a different clinician?
    //    Detected if updatedCase explicitly specifies a new currentAssigneeUid/Email,
    //    or if updatedCase.doctorEmail differs from previousCase.doctorEmail.
    // 2. Is it a brand new case?
    //    Stamp the creator as current assignee with their active duty session (if active).
    // 3. Is it an existing case being edited by the same clinician?
    //    Preserve the existing currentAssignee* and currentAssignment* fields strictly without mutation.
    const isClinicianTakeover = Boolean(
      previousCase && (
        (updatedCase.currentAssigneeUid && previousCase.currentAssigneeUid && updatedCase.currentAssigneeUid !== previousCase.currentAssigneeUid) ||
        (updatedCase.doctorEmail && previousCase.doctorEmail && updatedCase.doctorEmail.toLowerCase().trim() !== previousCase.doctorEmail.toLowerCase().trim()) ||
        (updatedCase.currentAssigneeEmail && previousCase.currentAssigneeEmail && updatedCase.currentAssigneeEmail.toLowerCase().trim() !== previousCase.currentAssigneeEmail.toLowerCase().trim())
      )
    );

    const activeDutySessionValid = activeDutySession && isActiveDutySessionNow(activeDutySession, new Date());
    const rawShiftId = activeDutySessionValid
      ? (activeDutySession.shiftId || "custom").trim().toLowerCase().replace(/^shift_/, "")
      : null;

    // Hospital Takeover Gate (ErMate — Patch D4B):
    // An explicit takeover/reassignment of an existing hospital patient to the logged-in clinician
    // must succeed ONLY when that clinician has a valid Actual Duty Session active right now.
    // Off-duty or expired-duty takeover attempts are aborted before any Firestore write.
    const isHospitalScopedCase = Boolean(
      previousCase && (
        previousCase.workspaceType === "hospital" ||
        (previousCase.workspaceType !== "individual" && Boolean(previousCase.hospitalId || previousCase.hospital || workspaceMetadata.hospitalId || workspaceMetadata.workspaceType === "hospital"))
      )
    );

    if (previousCase && isHospitalScopedCase && isClinicianTakeover && !activeDutySessionValid) {
      triggerNotification("Duty Session Required", "Start your current duty before taking handover.", "warning");
      return;
    }

    let resolvedCurrentAssignment: Partial<ClinicalCase> = {};

    if (isBrandNewCase) {
      const assigneeUid = updatedCase.currentAssigneeUid || auth.currentUser?.uid || editUid;
      const assigneeEmail = updatedCase.currentAssigneeEmail || updatedCase.doctorEmail || profile.email;
      const assigneeName = updatedCase.currentAssigneeName || updatedCase.doctorName || editName;
      const assignedAt = updatedCase.currentAssignmentAt || new Date().toISOString();

      resolvedCurrentAssignment = {
        currentAssigneeUid: assigneeUid,
        currentAssigneeEmail: assigneeEmail,
        currentAssigneeName: assigneeName,
        currentAssignmentAt: assignedAt,
        ...(activeDutySessionValid && rawShiftId && activeDutySession
          ? {
              currentAssignmentDutySessionId: activeDutySession.id,
              currentAssignmentDutyDateKey: activeDutySession.dutyDateKey,
              currentAssignmentShiftId: rawShiftId,
            }
          : (updatedCase.currentAssignmentDutySessionId
              ? {
                  currentAssignmentDutySessionId: updatedCase.currentAssignmentDutySessionId,
                  currentAssignmentDutyDateKey: updatedCase.currentAssignmentDutyDateKey,
                  currentAssignmentShiftId: updatedCase.currentAssignmentShiftId,
                }
              : {})),
      };
    } else if (isClinicianTakeover) {
      const assigneeUid = auth.currentUser?.uid || updatedCase.currentAssigneeUid || editUid;
      const assigneeEmail = updatedCase.doctorEmail || profile.email || updatedCase.currentAssigneeEmail;
      const assigneeName = updatedCase.doctorName || editName || updatedCase.currentAssigneeName;
      const assignedAt = new Date().toISOString();

      resolvedCurrentAssignment = {
        currentAssigneeUid: assigneeUid,
        currentAssigneeEmail: assigneeEmail,
        currentAssigneeName: assigneeName,
        currentAssignmentAt: assignedAt,
        ...(activeDutySessionValid && rawShiftId && activeDutySession
          ? {
              currentAssignmentDutySessionId: activeDutySession.id,
              currentAssignmentDutyDateKey: activeDutySession.dutyDateKey,
              currentAssignmentShiftId: rawShiftId,
            }
          : {}),
      };
    } else {
      resolvedCurrentAssignment = {
        ...(previousCase.currentAssigneeUid !== undefined ? { currentAssigneeUid: previousCase.currentAssigneeUid } : (updatedCase.currentAssigneeUid !== undefined ? { currentAssigneeUid: updatedCase.currentAssigneeUid } : {})),
        ...(previousCase.currentAssigneeEmail !== undefined ? { currentAssigneeEmail: previousCase.currentAssigneeEmail } : (updatedCase.currentAssigneeEmail !== undefined ? { currentAssigneeEmail: updatedCase.currentAssigneeEmail } : {})),
        ...(previousCase.currentAssigneeName !== undefined ? { currentAssigneeName: previousCase.currentAssigneeName } : (updatedCase.currentAssigneeName !== undefined ? { currentAssigneeName: updatedCase.currentAssigneeName } : {})),
        ...(previousCase.currentAssignmentDutySessionId !== undefined ? { currentAssignmentDutySessionId: previousCase.currentAssignmentDutySessionId } : (updatedCase.currentAssignmentDutySessionId !== undefined ? { currentAssignmentDutySessionId: updatedCase.currentAssignmentDutySessionId } : {})),
        ...(previousCase.currentAssignmentDutyDateKey !== undefined ? { currentAssignmentDutyDateKey: previousCase.currentAssignmentDutyDateKey } : (updatedCase.currentAssignmentDutyDateKey !== undefined ? { currentAssignmentDutyDateKey: updatedCase.currentAssignmentDutyDateKey } : {})),
        ...(previousCase.currentAssignmentShiftId !== undefined ? { currentAssignmentShiftId: previousCase.currentAssignmentShiftId } : (updatedCase.currentAssignmentShiftId !== undefined ? { currentAssignmentShiftId: updatedCase.currentAssignmentShiftId } : {})),
        ...(previousCase.currentAssignmentAt !== undefined ? { currentAssignmentAt: previousCase.currentAssignmentAt } : (updatedCase.currentAssignmentAt !== undefined ? { currentAssignmentAt: updatedCase.currentAssignmentAt } : {})),
      };
    }

    let displayIdToUse = previousCase?.displayId || updatedCase.displayId;
    if (isBrandNewCase && (!displayIdToUse || !/^[0-9]{9}$/.test(displayIdToUse))) {
      try {
        const reserved = await reserveNextDisplaySequence(db);
        displayIdToUse = reserved.displayId;
      } catch (err: any) {
        console.error("[handleSaveCase] Failed to reserve displayId sequence:", err);
        triggerNotification("Registration Error", err?.message || "Could not reserve daily case ID.", "warning");
        return;
      }
    }

    const caseToSave: ClinicalCase = {
      ...(previousCase || {}),
      ...updatedCase,
      id: previousCase?.id || updatedCase.id || generateInternalCaseId(),
      ...(displayIdToUse ? { displayId: displayIdToUse } : {}),
      ...resolvedShiftProvenance,
      ...resolvedCurrentAssignment,
      patient: {
        ...(previousCase?.patient || {}),
        ...updatedCase.patient,
        triageCategory: (updatedCase.patient?.triageCategory && !isTriageCategoryPending(updatedCase.patient.triageCategory))
          ? updatedCase.patient.triageCategory
          : (previousCase?.patient?.triageCategory || updatedCase.patient?.triageCategory || undefined),
      },
      vitals: {
        ...(previousCase?.vitals || {}),
        ...updatedCase.vitals,
      },
      sampleHistory: {
        ...(previousCase?.sampleHistory || {}),
        ...updatedCase.sampleHistory,
      },
      primaryAssessment: {
        ...(previousCase?.primaryAssessment || {}),
        ...updatedCase.primaryAssessment,
      },
      adjuncts: {
        ...(previousCase?.adjuncts || {}),
        ...updatedCase.adjuncts,
      },
      dischargeInfo: (() => {
        const di = updatedCase.dischargeInfo !== undefined ? updatedCase.dischargeInfo : previousCase?.dischargeInfo;
        if (!di) return null;
        // If discharge summary is prepared or finalized, mark as updated after preparation so clinician can review
        return {
          ...di,
          caseUpdatedAfterPreparation: true
        };
      })(),
      workspaceType: workspaceMetadata.workspaceType,
      ownerUid: workspaceMetadata.ownerUid,
      hospitalId: workspaceMetadata.hospitalId,
      hospital: updatedCase.hospital || profile.hospital,
      doctorEmail: updatedCase.doctorEmail || profile.email,
      doctorName: updatedCase.doctorName || profile.name || "Emergency Doctor",
      createdBy: (updatedCase as any).createdBy || auth.currentUser?.uid,
      createdByUid: previousCase ? previousCase.createdByUid : (auth.currentUser?.uid || undefined),
      lastEditedBy: editUid,
      lastEditedByName: editName,
      lastEditedByRole: editRole,
      lastEditedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "cases", caseToSave.id), sanitizeForFirestore(caseToSave), { merge: true });
      
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

      // Phase 3A: Trusted Logbook Snapshot Service
      // Sync logbook for UID attribution
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          await fetch("/api/logbook/sync-case", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ caseId: caseToSave.id })
          }).catch(err => console.warn("Logbook sync failed silently", err));
        }
      } catch (syncErr) {
        console.warn("Logbook sync encountered error", syncErr);
      }

    } catch (err: any) {
      console.error("Error saving case or audit trail:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
      throw err;
    }
    setCases(prev => {
      const exists = prev.some(c => c.id === caseToSave.id);
      if (exists) return prev.map(c => c.id === caseToSave.id ? caseToSave : c);
      return [caseToSave, ...prev];
    });
    checkConsentOnCaseSaved();
  };

  /**
   * Canonical low-level discharge persistence helper.
   * Receives explicit target ClinicalCase and dischargeInfo.
   * Persists dischargeInfo to cases/{caseId} and creates addendum audit log.
   * Returns updated ClinicalCase only after primary case write succeeds.
   * Throws on primary persistence failure so callers know definitively whether it succeeded.
   */
  const persistDischargeInfo = async (
    targetCase: ClinicalCase,
    dischargeInfo: DischargeInfo
  ): Promise<ClinicalCase> => {
    const editRole = (profile.role || "").toLowerCase().includes("hod") ? "hod" : ((profile.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const editUid = auth.currentUser?.uid || "uid_priya";
    const editName = (profile.name || "").startsWith("Dr. ") ? profile.name : "Dr. " + (profile.name || "Doctor");

    // Preserve patient operational status - Discharge Summary finalization must not alter ClinicalCase.status
    const updated: ClinicalCase = {
      ...targetCase,
      dischargeInfo,
      status: targetCase.status,
      hospital: targetCase.hospital || profile.hospital,
      lastEditedBy: editUid,
      lastEditedByName: editName,
      lastEditedByRole: editRole,
      lastEditedAt: new Date().toISOString()
    };

    // 1. Primary write to Firestore cases collection - MUST throw on failure
    await setDoc(doc(db, "cases", updated.id), sanitizeForFirestore(updated), { merge: true });

    // 2. Secondary department index write if applicable
    if (updated.departmentId) {
      try {
        await setDoc(doc(db, "departments", updated.departmentId, "cases", updated.id), sanitizeForFirestore(updated), { merge: true });
      } catch (deptErr) {
        console.warn("Secondary department index write for discharge failed (primary case persisted):", deptErr);
      }
    }

    // 3. Add audit log to addenda subcollection
    try {
      const addendumId = "add-" + Math.floor(100000 + Math.random() * 900000);
      const addendumRef = doc(db, "cases", updated.id, "addenda", addendumId);
      const auditLog = {
        id: addendumId,
        type: "discharge",
        editedBy: editUid,
        editedByName: editName,
        editedByRole: editRole,
        fieldsChanged: ["dischargeInfo"],
        previousValues: { summaryStatus: targetCase.dischargeInfo?.summaryStatus || "DRAFT" },
        newValues: { summaryStatus: dischargeInfo.summaryStatus },
        addedAt: new Date().toISOString(),
        addedBy: editUid // for rules create constraint
      };
      await setDoc(addendumRef, auditLog);
    } catch (auditErr) {
      console.warn("Discharge addendum audit write failed (primary case was persisted):", auditErr);
    }

    // 4. Update in-memory cases state
    setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
    checkConsentOnCaseSaved();

    return updated;
  };

  // Finalize discharge summary
  const handleSaveDischarge = async (dischargeInfo: DischargeInfo) => {
    if (!showDischargeSummaryId) return;
    const targetCase = cases.find(c => c.id === showDischargeSummaryId);
    if (targetCase) {
      try {
        await persistDischargeInfo(targetCase, dischargeInfo);
      } catch (err: any) {
        console.error("Error updating discharge summary in Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
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

  /**
   * Assign or update physical ER bed for a ClinicalCase.
   * Validates occupancy, normalizes bed, and saves to Firestore with merge: true.
   * Does NOT modify case ID or create new cases/sessions.
   */
  const handleAssignBedToCase = async (
    caseId: string,
    bedInput: string
  ): Promise<{ success: boolean; error?: string; assignedBed?: string }> => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    const allocation = allocateOrValidateBed(
      bedInput,
      filterActiveNonArchivedCases(cases),
      erPhysicalBedCapacity || 30,
      caseId
    );

    if (!allocation.success || !allocation.canonicalBed) {
      return {
        success: false,
        error: allocation.error || "Unable to allocate requested bed.",
      };
    }

    const canonicalBed = allocation.canonicalBed;

    try {
      const user = auth.currentUser;
      await setDoc(
        doc(db, "cases", caseId),
        sanitizeForFirestore({
          bedNo: canonicalBed,
          ...(targetCase.patient ? { patient: { ...targetCase.patient, bed: canonicalBed } } : {}),
          lastEditedBy: user?.uid || "system",
          lastEditedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      // Update local state immediately
      setCases(prev =>
        prev.map(c => (c.id === caseId ? {
          ...c,
          bedNo: canonicalBed,
          patient: c.patient ? { ...c.patient, bed: canonicalBed } : c.patient
        } : c))
      );

      triggerNotification(
        "Bed Assigned",
        `Patient ${targetCase.patient?.name || targetCase.id} assigned to Bed ${canonicalBed}.`,
        "success"
      );

      return { success: true, assignedBed: canonicalBed };
    } catch (err: any) {
      console.error("[handleAssignBedToCase] Error saving bed:", err);
      handleFirestoreError(err, OperationType.WRITE, "cases");
      return { success: false, error: "Failed to persist bed assignment to Firestore." };
    }
  };

  const handleStartVoiceScribe = (caseId?: string) => {
    setVoiceScribeCaseId(caseId || null);
    if (caseId) {
      const match = cases.find(c => c.id === caseId);
      setVoiceScribeSessionId(match?.scribeSessionId || null);
    } else {
      setVoiceScribeSessionId(null);
    }
    setVoiceScribeDiscussionMode(false);
    setShowVoiceScribeChat(true);
  };

  const handleOpenMateBadge = () => {
    // If clinician is currently viewing an active Case Sheet, bind MATE to that patient context safely
    if (selectedCaseId) {
      setVoiceScribeCaseId(selectedCaseId);
      const match = cases.find(c => c.id === selectedCaseId);
      setVoiceScribeSessionId(match?.scribeSessionId || null);
    } else {
      // Dashboard with no specific patient selected: open conversationally with no forced case context
      setVoiceScribeCaseId(null);
      setVoiceScribeSessionId(null);
    }
    setVoiceScribeDiscussionMode(false);
    setShowVoiceScribeChat(true);
  };

  // NEW — invoked when the doctor taps the Voice Scribe entry point with
  // no case already selected (i.e. from the Dashboard card). Shows a
  // small choice instead of immediately starting a new-patient dictation,
  // per the doctor's explicit request that the discussion-only mode live
  // inside the existing Voice Scribe entry point.
  const handleVoiceScribeEntryClick = () => {
    setShowVoiceScribeEntryChoice(true);
  };

  const handleStartNewPatientDictation = () => {
    setShowVoiceScribeEntryChoice(false);
    setVoiceScribeSessionId(null);
    handleStartVoiceScribe();
  };

  const handleStartFreeDiscussion = () => {
    setShowVoiceScribeEntryChoice(false);
    setVoiceScribeDiscussionMode(true);
    setVoiceScribeCaseId(null);
    setVoiceScribeSessionId(null);
    setShowVoiceScribeChat(true);
  };

  /**
   * Pure in-memory helper to merge extracted clinical data into a ClinicalCase draft.
   * Performs ZERO Firestore writes or external mutations.
   */
  const buildExtractedCaseDraft = (
    existingMatch: ClinicalCase | null,
    extracted: any,
    context?: {
      caseId?: string;
      displayId?: string;
      workspaceMetadata?: any;
      profile?: any;
      currentUser?: any;
      teamMembers?: any[];
      activeDutySession?: DutySessionRecord | null;
    }
  ): ClinicalCase => {
    const newCaseId = context?.caseId || existingMatch?.id || generateInternalCaseId();
    const resolvedDisplayId = existingMatch?.displayId || (context as any)?.displayId || extracted.displayId || undefined;
    const workspaceMetadata = context?.workspaceMetadata || {};
    const prof = context?.profile || profile || {};
    const user = context?.currentUser || auth.currentUser;
    const members = context?.teamMembers || teamMembers || [];

    // Resolve case creation duty provenance dynamically (ErMate — Patch D3)
    const creationDuty = getCaseCreationDutyMetadata(
      context?.activeDutySession !== undefined ? context.activeDutySession : activeDutySession
    );
    
    const consultantOnShift = (!existingMatch && creationDuty)
      ? members.find(
          (m: any) => ((m.role || "").toLowerCase().includes("consultant") || (m.role || "").toLowerCase().includes("hod") || (m.role || "").toLowerCase().includes("lead")) && m.shift === creationDuty.baseShiftId
        )
      : null;
    const resolvedConsultantId = existingMatch?.consultantId || consultantOnShift?.id || undefined;
    const resolvedConsultantName = extracted.emConsultant || existingMatch?.consultantName || (consultantOnShift ? consultantOnShift.name : undefined);
    const createdByUid = user?.uid || "uid_priya";
    const createdByRoleVal = (prof.role || "").toLowerCase().includes("hod") ? "hod" : ((prof.role || "").toLowerCase().includes("consultant") ? "consultant" : "resident");
    const hospitalSlug = (prof.hospital || "general-er").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Robust parsing helpers to completely prevent NaN values in Firestore
    const parsedAge = (extracted.age !== null && extracted.age !== undefined && String(extracted.age).trim() !== "") ? Number(extracted.age) : null;
    const isAgeValid = parsedAge !== null && !isNaN(parsedAge);
    const finalAge = isAgeValid ? parsedAge : null;
    
    let resolvedAge = existingMatch?.patient.age || null;
    let resolvedIsPediatric = existingMatch ? Boolean(existingMatch.isPediatric) : false;

    if (finalAge !== null) {
      resolvedAge = finalAge;
      resolvedIsPediatric = finalAge <= 16;
    }

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

    const rawDocName = prof.name || user?.displayName || (prof.email ? prof.email.split("@")[0] : "Doctor");
    const docFormattedName = rawDocName.startsWith("Dr. ") ? rawDocName : "Dr. " + rawDocName;

    // Resolve shift provenance (Patch D3A):
    // 1. Existing case: preserve existingMatch provenance (even if undefined/absent)
    // 2. New case: stamp creationDuty ONLY if a valid Actual Duty Session exists
    // 3. Otherwise: leave fields absent
    const provenanceFields = existingMatch
      ? {
          ...(existingMatch.shiftId !== undefined ? { shiftId: existingMatch.shiftId } : {}),
          ...(existingMatch.shiftDate !== undefined ? { shiftDate: existingMatch.shiftDate } : {}),
          ...(existingMatch.shiftName !== undefined ? { shiftName: existingMatch.shiftName } : {}),
        }
      : creationDuty
      ? {
          shiftId: creationDuty.shiftId,
          shiftDate: creationDuty.shiftDate,
          shiftName: creationDuty.shiftName,
        }
      : {};

    // Resolve current clinician assignment & duty session (Patch D4A):
    const dutySessionToUse = context?.activeDutySession !== undefined ? context.activeDutySession : activeDutySession;
    const isSessionActive = dutySessionToUse && isActiveDutySessionNow(dutySessionToUse, new Date());
    const rawAssignmentShiftId = isSessionActive
      ? (dutySessionToUse.shiftId || "custom").trim().toLowerCase().replace(/^shift_/, "")
      : undefined;

    const assignmentFields = existingMatch
      ? {
          ...(existingMatch.currentAssigneeUid !== undefined ? { currentAssigneeUid: existingMatch.currentAssigneeUid } : {}),
          ...(existingMatch.currentAssigneeEmail !== undefined ? { currentAssigneeEmail: existingMatch.currentAssigneeEmail } : {}),
          ...(existingMatch.currentAssigneeName !== undefined ? { currentAssigneeName: existingMatch.currentAssigneeName } : {}),
          ...(existingMatch.currentAssignmentDutySessionId !== undefined ? { currentAssignmentDutySessionId: existingMatch.currentAssignmentDutySessionId } : {}),
          ...(existingMatch.currentAssignmentDutyDateKey !== undefined ? { currentAssignmentDutyDateKey: existingMatch.currentAssignmentDutyDateKey } : {}),
          ...(existingMatch.currentAssignmentShiftId !== undefined ? { currentAssignmentShiftId: existingMatch.currentAssignmentShiftId } : {}),
          ...(existingMatch.currentAssignmentAt !== undefined ? { currentAssignmentAt: existingMatch.currentAssignmentAt } : {}),
        }
      : {
          currentAssigneeUid: user?.uid,
          currentAssigneeEmail: prof.email || user?.email || "",
          currentAssigneeName: docFormattedName,
          currentAssignmentAt: new Date().toISOString(),
          ...(isSessionActive && rawAssignmentShiftId && dutySessionToUse
            ? {
                currentAssignmentDutySessionId: dutySessionToUse.id,
                currentAssignmentDutyDateKey: dutySessionToUse.dutyDateKey,
                currentAssignmentShiftId: rawAssignmentShiftId,
              }
            : {}),
        };

    const newCase: ClinicalCase = {
      ...(existingMatch || {}),
      id: newCaseId,
      ...(resolvedDisplayId ? { displayId: resolvedDisplayId } : {}),
      ...(extracted.bedNo || existingMatch?.bedNo ? { bedNo: extracted.bedNo || existingMatch?.bedNo } : {}),
      workspaceType: existingMatch?.workspaceType || workspaceMetadata.workspaceType,
      ownerUid: existingMatch?.ownerUid || workspaceMetadata.ownerUid || null,
      hospitalId: existingMatch?.hospitalId || workspaceMetadata.hospitalId || null,
      createdBy: existingMatch?.createdBy || createdByUid,
      createdByUid: existingMatch ? existingMatch.createdByUid : user?.uid,
      createdByName: existingMatch?.createdByName || docFormattedName,
      createdByRole: existingMatch?.createdByRole || createdByRoleVal,
      ...provenanceFields,
      ...assignmentFields,
      ...(resolvedConsultantId ? { consultantId: resolvedConsultantId } : {}),
      ...(resolvedConsultantName ? { consultantName: resolvedConsultantName } : {}),
      departmentId: existingMatch?.departmentId || hospitalSlug,
      createdAt: existingMatch?.createdAt || new Date().toISOString(),
      patient: {
        ...(existingMatch?.patient || {}),
        ...(extracted.bedNo || existingMatch?.bedNo || existingMatch?.patient?.bed ? { bed: extracted.bedNo || existingMatch?.bedNo || existingMatch?.patient?.bed } : {}),
        name: extracted.patientName || existingMatch?.patient.name || "",
        age: resolvedAge,
        gender: extracted.gender || existingMatch?.patient.gender || "",
        presentingComplaint: extracted.presentingComplaint || existingMatch?.patient.presentingComplaint || "Not documented",
        triageCategory: (extracted.triageCategory && !isTriageCategoryPending(extracted.triageCategory))
          ? extracted.triageCategory
          : (existingMatch?.patient.triageCategory || extracted.triageCategory || undefined),
        arrivalMode: extracted.arrivalMode || existingMatch?.patient.arrivalMode || undefined,
        dateOpened: existingMatch?.patient.dateOpened || (new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })),
        uhid: existingMatch?.patient.uhid || ("UHID-" + Math.floor(100000 + Math.random() * 900000)),
        caseType: extracted.caseType || existingMatch?.patient.caseType || undefined,
        isMlc: (extracted.mlcDetails && extracted.mlcDetails.mlcConfirmedByClinician && typeof extracted.mlcDetails.isMlc === 'boolean') ? extracted.mlcDetails.isMlc : (existingMatch?.patient.isMlc ?? false),
        mlcDetails: extracted.mlcDetails ? {
          ...(existingMatch?.patient.mlcDetails || {}),
          natureOfIncident: extracted.mlcDetails.natureOfIncident || existingMatch?.patient.mlcDetails?.natureOfIncident,
          placeOfIncident: extracted.mlcDetails.placeOfIncident || existingMatch?.patient.mlcDetails?.placeOfIncident,
          dateTimeOfIncident: extracted.mlcDetails.dateTimeOfIncident || existingMatch?.patient.mlcDetails?.dateTimeOfIncident,
          identificationMark: extracted.mlcDetails.identificationMark || existingMatch?.patient.mlcDetails?.identificationMark,
          informantBroughtBy: [extracted.mlcDetails.broughtBy, extracted.mlcDetails.informant].filter(Boolean).join(" / ") || existingMatch?.patient.mlcDetails?.informantBroughtBy,
        } : existingMatch?.patient.mlcDetails
      },
      vitals: {
        ...(existingMatch?.vitals || {}),
        bp: extracted.vitals?.bp || existingMatch?.vitals.bp || "",
        hr: extracted.vitals?.hr || existingMatch?.vitals.hr || "",
        spo2: extracted.vitals?.spo2 || existingMatch?.vitals.spo2 || "",
        rr: extracted.vitals?.rr || existingMatch?.vitals.rr || "",
        temp: extracted.vitals?.temp || existingMatch?.vitals.temp || "",
        gcs: extracted.vitals?.gcs || existingMatch?.vitals.gcs || "",
        gcs_e: extracted.vitals?.gcs_e || existingMatch?.vitals.gcs_e || "",
        gcs_v: extracted.vitals?.gcs_v || existingMatch?.vitals.gcs_v || "",
        gcs_m: extracted.vitals?.gcs_m || existingMatch?.vitals.gcs_m || "",
        grbs: extracted.vitals?.grbs || existingMatch?.vitals.grbs || "",
        avpu: extracted.vitals?.avpu || existingMatch?.vitals.avpu || "",
        painScore: extracted.vitals?.painScore || existingMatch?.vitals.painScore || ""
      },
      sampleHistory: {
        ...(existingMatch?.sampleHistory || {}),
        symptoms: extracted.sampleHistory?.symptoms || (Array.isArray(extracted.symptoms) ? extracted.symptoms.join(", ") : extracted.symptoms) || existingMatch?.sampleHistory.symptoms || "",
        allergies: extracted.sampleHistory?.allergies || extracted.allergies || existingMatch?.sampleHistory.allergies || "",
        medications: (() => {
          const rawM = extracted.sampleHistory?.medications ?? extracted.currentMedications ?? extracted.medications ?? existingMatch?.sampleHistory.medications;
          if (Array.isArray(rawM)) return rawM.map((m: any) => typeof m === 'string' ? m : (m?.drugName || m?.name || "")).filter(Boolean).join(", ");
          if (typeof rawM === 'string') return rawM;
          return "";
        })(),
        pastHistory: extracted.sampleHistory?.pastHistory || extracted.pastMedicalHistory || extracted.pastHistory || existingMatch?.sampleHistory.pastHistory || "",
        lastMeal: extracted.sampleHistory?.lastMeal || extracted.lastMeal || existingMatch?.sampleHistory.lastMeal || "",
        events: extracted.sampleHistory?.events || extracted.events || extracted.hpi || existingMatch?.sampleHistory.events || "",
        socialHistory: extracted.sampleHistory?.socialHistory || extracted.socialHistory || existingMatch?.sampleHistory?.socialHistory || "",
        familyHistory: extracted.sampleHistory?.familyHistory || extracted.familyHistory || existingMatch?.sampleHistory?.familyHistory || "",
        psychiatricFlags: extracted.sampleHistory?.psychiatricFlags || extracted.psychiatricFlags || existingMatch?.sampleHistory?.psychiatricFlags || ""
      },
      primaryAssessment: (() => {
        const existingPA: any = existingMatch?.primaryAssessment || {};
        const extractedPA: any = extracted.primaryAssessment || {};
        const existingSurvey: PrimarySurvey = existingPA.survey || getInitialPrimarySurvey(extracted.caseType || existingMatch?.patient?.caseType);
        
        // Resolve ABG / VBG
        const rawVbgValues: any[] = extracted.vbgAbg?.values || [];
        const findVal = (p: string) => {
          const item = rawVbgValues.find((v: any) => v.param === p);
          return item !== undefined && item.value !== null && item.value !== undefined ? String(item.value) : undefined;
        };

        const existingAbg = existingSurvey.adjuncts?.abg || {};
        const incomingAbg = extracted.adjuncts?.abg || extracted.abg || {};
        const newPh = findVal("ph") ?? (extracted.abgPh ? String(extracted.abgPh) : (incomingAbg.ph ? String(incomingAbg.ph) : undefined));
        const newPco2 = findVal("pco2") ?? (extracted.abgPco2 ? String(extracted.abgPco2) : (incomingAbg.pco2 ? String(incomingAbg.pco2) : undefined));
        const newPo2 = findVal("po2") ?? (extracted.abgPo2 ? String(extracted.abgPo2) : (incomingAbg.po2 ? String(incomingAbg.po2) : undefined));
        const newHco3 = findVal("hco3") ?? (extracted.abgHco3 ? String(extracted.abgHco3) : (incomingAbg.hco3 ? String(incomingAbg.hco3) : undefined));
        const newBe = findVal("be") ?? (extracted.abgBe ? String(extracted.abgBe) : (incomingAbg.be ? String(incomingAbg.be) : undefined));
        const newLactate = findVal("lactate") ?? (extracted.abgLactate ? String(extracted.abgLactate) : (incomingAbg.lactate ? String(incomingAbg.lactate) : undefined));
        const newSao2 = findVal("sao2") ?? (extracted.abgSao2 ? String(extracted.abgSao2) : (incomingAbg.sao2 ? String(incomingAbg.sao2) : undefined));
        const newFio2 = findVal("fio2") ?? (extracted.abgFio2 ? String(extracted.abgFio2) : (incomingAbg.fio2 ? String(incomingAbg.fio2) : undefined));
        const newNa = findVal("na") ?? (extracted.abgNa ? String(extracted.abgNa) : (incomingAbg.na ? String(incomingAbg.na) : undefined));
        const newK = findVal("k") ?? (extracted.abgK ? String(extracted.abgK) : (incomingAbg.k ? String(incomingAbg.k) : undefined));
        const newCl = findVal("cl") ?? (extracted.abgCl ? String(extracted.abgCl) : (incomingAbg.cl ? String(incomingAbg.cl) : undefined));
        const newHb = findVal("hb") ?? (extracted.abgHb ? String(extracted.abgHb) : (incomingAbg.hb ? String(incomingAbg.hb) : undefined));
        const newAnionGap = findVal("anionGap") ?? (extracted.abgAnionGap ? String(extracted.abgAnionGap) : (incomingAbg.ag || incomingAbg.anionGap ? String(incomingAbg.ag || incomingAbg.anionGap) : undefined));
        const newGlucose = findVal("glucose") ?? (extracted.abgGlucose ? String(extracted.abgGlucose) : (incomingAbg.glucose ? String(incomingAbg.glucose) : undefined));
        const newAa = findVal("aa") ?? (extracted.abgAa ? String(extracted.abgAa) : (incomingAbg.aa || incomingAbg.aaGradient ? String(incomingAbg.aa || incomingAbg.aaGradient) : undefined));

        const resolvedSampleType = extracted.vbgAbg?.type
          ? (extracted.vbgAbg.type === "VBG" ? "Venous (VBG)" : "Arterial (ABG)")
          : (incomingAbg.sampleType || existingAbg.sampleType || undefined);

        const mergedAbg = {
          ...existingAbg,
          ...(resolvedSampleType ? { sampleType: resolvedSampleType } : {}),
          ph: newPh ?? existingAbg.ph,
          pco2: newPco2 ?? existingAbg.pco2,
          po2: newPo2 ?? existingAbg.po2,
          hco3: newHco3 ?? existingAbg.hco3,
          be: newBe ?? existingAbg.be,
          lactate: newLactate ?? existingAbg.lactate,
          sao2: newSao2 ?? existingAbg.sao2,
          fio2: newFio2 ?? existingAbg.fio2,
          na: newNa ?? existingAbg.na,
          k: newK ?? existingAbg.k,
          cl: newCl ?? existingAbg.cl,
          hb: newHb ?? existingAbg.hb,
          ag: newAnionGap ?? existingAbg.ag ?? (existingAbg as any).anionGap,
          glucose: newGlucose ?? existingAbg.glucose,
          aa: newAa ?? existingAbg.aa,
          finalDiagnosis: extracted.abgDiagnosis || incomingAbg.finalDiagnosis || existingAbg.finalDiagnosis,
          clinicalInterpretation: extracted.abgInterpretation || incomingAbg.clinicalInterpretation || existingAbg.clinicalInterpretation,
          ...(incomingAbg.interpretation ? { interpretation: incomingAbg.interpretation } : {}),
        };

        // Resolve ECG
        const existingEcgNotes = existingSurvey.adjuncts?.ecgNotes || existingMatch?.adjuncts?.ecgNotes || existingMatch?.adjuncts?.ecgFindings || "";
        const incomingEcg = extracted.ecg || extracted.ecgNotes || extracted.ecgFindings || "";
        const mergedEcgNotes = (() => {
          if (!incomingEcg) return existingEcgNotes;
          if (!existingEcgNotes) return incomingEcg;
          if (existingEcgNotes.toLowerCase().includes(incomingEcg.toLowerCase())) return existingEcgNotes;
          return `${existingEcgNotes} | ${incomingEcg}`;
        })();

        // Resolve EFAST
        const existingEfastNotes = existingSurvey.adjuncts?.efastNotes || existingMatch?.adjuncts?.efastNotes || "";
        const incomingEfastParts = extracted.fastFindings ? [
          extracted.fastFindings.heart ? `Heart: ${extracted.fastFindings.heart}` : null,
          extracted.fastFindings.abdomen ? `Abdomen: ${extracted.fastFindings.abdomen}` : null,
          extracted.fastFindings.pelvis ? `Pelvis: ${extracted.fastFindings.pelvis}` : null,
          extracted.fastFindings.bladder ? `Bladder: ${extracted.fastFindings.bladder}` : null,
          extracted.fastFindings.suprapubic ? `Suprapubic: ${extracted.fastFindings.suprapubic}` : null,
          extracted.fastFindings.lungs ? `Lungs: ${extracted.fastFindings.lungs}` : null,
        ].filter(Boolean) : [];
        const incomingEfast = incomingEfastParts.length > 0 ? incomingEfastParts.join(", ") : (extracted.efastNotes || "");
        const mergedEfastNotes = (() => {
          if (!incomingEfast) return existingEfastNotes;
          if (!existingEfastNotes) return incomingEfast;
          if (existingEfastNotes.toLowerCase().includes(incomingEfast.toLowerCase())) return existingEfastNotes;
          return `${existingEfastNotes} | ${incomingEfast}`;
        })();

        // Resolve Echo
        const existingEchoNotes = existingSurvey.adjuncts?.echoNotes || existingSurvey.adjuncts?.echoFindings || existingMatch?.adjuncts?.echoNotes || existingMatch?.adjuncts?.echoFindings || "";
        const incomingEcho = extracted.echo || extracted.echoNotes || extracted.echoFindings || "";
        const mergedEchoNotes = (() => {
          if (!incomingEcho) return existingEchoNotes;
          if (!existingEchoNotes) return incomingEcho;
          if (existingEchoNotes.toLowerCase().includes(incomingEcho.toLowerCase())) return existingEchoNotes;
          return `${existingEchoNotes} | ${incomingEcho}`;
        })();

        // Build updated survey
        const updatedSurvey: PrimarySurvey = {
          ...existingSurvey,
          ...(extractedPA.survey || {}),
          adjuncts: {
            ...(existingSurvey.adjuncts || {}),
            abg: mergedAbg,
            // Preserve manual dropdowns (ecgStatus, efastStatus, echoStatus) - NEVER overwrite!
            ecgStatus: existingSurvey.adjuncts?.ecgStatus,
            ecgNotes: mergedEcgNotes,
            efastStatus: existingSurvey.adjuncts?.efastStatus,
            efastNotes: mergedEfastNotes,
            echoStatus: existingSurvey.adjuncts?.echoStatus,
            echoNotes: mergedEchoNotes,
            echoFindings: mergedEchoNotes,
          }
        };

        return {
          ...existingPA,
          ...extractedPA,
          survey: updatedSurvey,
          airway: extractedPA.airway || extracted.airway || existingPA.airway || "",
          airwayStatus: extractedPA.airwayStatus || extracted.airwayStatus || existingPA.airwayStatus || "",
          breathing: extractedPA.breathing || extracted.breathing || existingPA.breathing || "",
          breathingStatus: extractedPA.breathingStatus || extracted.breathingStatus || existingPA.breathingStatus || "",
          circulation: extractedPA.circulation || extracted.circulation || existingPA.circulation || "",
          circulationStatus: extractedPA.circulationStatus || extracted.circulationStatus || existingPA.circulationStatus || "",
          disability: extractedPA.disability || extracted.disability || existingPA.disability || "",
          disabilityStatus: extractedPA.disabilityStatus || extracted.disabilityStatus || existingPA.disabilityStatus || "",
          exposure: extractedPA.exposure || extracted.exposure || existingPA.exposure || "",
          exposureStatus: extractedPA.exposureStatus || extracted.exposureStatus || existingPA.exposureStatus || ""
        };
      })(),
      secondarySurvey: (() => {
        const baseSurvey: Record<string, string> = { ...(existingMatch?.secondarySurvey || {}) };
        if (extracted.secondarySurvey && typeof extracted.secondarySurvey === 'object') {
          for (const [k, v] of Object.entries(extracted.secondarySurvey)) {
            if (v && typeof v === 'string' && v.trim()) {
              baseSurvey[k.toLowerCase()] = v.trim();
            }
          }
        }
        if (extracted.secondaryAssessment && typeof extracted.secondaryAssessment === 'string') {
          const parsed = parseSecondaryAssessmentToSurvey(extracted.secondaryAssessment);
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === 'string' && v.trim()) {
              baseSurvey[k.toLowerCase()] = v.trim();
            }
          }
        }
        return Object.keys(baseSurvey).length > 0 ? baseSurvey : undefined;
      })(),
      secondaryAssessment: (() => {
        const baseSurvey: Record<string, string> = { ...(existingMatch?.secondarySurvey || {}) };
        if (extracted.secondarySurvey && typeof extracted.secondarySurvey === 'object') {
          for (const [k, v] of Object.entries(extracted.secondarySurvey)) {
            if (v && typeof v === 'string' && v.trim()) {
              baseSurvey[k.toLowerCase()] = v.trim();
            }
          }
        }
        if (extracted.secondaryAssessment && typeof extracted.secondaryAssessment === 'string') {
          const parsed = parseSecondaryAssessmentToSurvey(extracted.secondaryAssessment);
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === 'string' && v.trim()) {
              baseSurvey[k.toLowerCase()] = v.trim();
            }
          }
        } else if (existingMatch?.secondaryAssessment) {
          const parsed = parseSecondaryAssessmentToSurvey(existingMatch.secondaryAssessment);
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === 'string' && v.trim() && !baseSurvey[k.toLowerCase()]) {
              baseSurvey[k.toLowerCase()] = v.trim();
            }
          }
        }
        const parts: string[] = [];
        if (baseSurvey.general) parts.push(`General: ${baseSurvey.general}`);
        if (baseSurvey.cvs) parts.push(`CVS: ${baseSurvey.cvs}`);
        if (baseSurvey.respiratory) parts.push(`RS: ${baseSurvey.respiratory}`);
        if (baseSurvey.abdomen) parts.push(`PA: ${baseSurvey.abdomen}`);
        if (baseSurvey.cns) parts.push(`CNS: ${baseSurvey.cns}`);
        if (baseSurvey.extremities) parts.push(`Extremities: ${baseSurvey.extremities}`);
        if (parts.length > 0) return parts.join("\n");
        return extracted.secondaryAssessment || existingMatch?.secondaryAssessment || "";
      })(),
      investigations: (() => {
        const existingInv = existingMatch?.investigations || [];
        const newInv = extracted.investigations || (extracted.labs ? extracted.labs.map((l: any, i: number) => ({ id: `inv-${Date.now()}-${i}`, testName: l.name || l, result: l.value || "Ordered", orderTime: new Date().toLocaleTimeString(), resultTime: "Pending", isAbnormal: false })) : []);
        if (!newInv || newInv.length === 0) return existingInv;
        const merged = [...existingInv];
        for (const item of newInv) {
          const exists = merged.some(m => m.testName.toLowerCase() === (item.testName || "").toLowerCase());
          if (!exists) {
            merged.push(item);
          }
        }
        return merged;
      })(),
      investigationImaging: (() => {
        const existingImg = existingMatch?.investigationImaging || "";
        const newImg = extracted.investigationImaging || (extracted.imaging ? (Array.isArray(extracted.imaging) ? extracted.imaging.map((i: any) => typeof i === 'string' ? i : (i.value ? `${i.name}: ${i.value}` : i.name)).join(", ") : extracted.imaging) : "");
        if (!newImg) return existingImg;
        if (!existingImg) return newImg;
        if (existingImg.includes(newImg)) return existingImg;
        return `${existingImg}, ${newImg}`;
      })(),
      investigationLabsOrdered: (() => {
        const existingLabs = existingMatch?.investigationLabsOrdered || "";
        const newLabs = extracted.investigationLabsOrdered || (extracted.labs ? (Array.isArray(extracted.labs) ? extracted.labs.map((l: any) => typeof l === 'string' ? l : (l.value ? `${l.name}: ${l.value}` : l.name)).join(", ") : extracted.labs) : "");
        if (!newLabs) return existingLabs;
        if (!existingLabs) return newLabs;
        if (existingLabs.includes(newLabs)) return existingLabs;
        return `${existingLabs}, ${newLabs}`;
      })(),
      treatments: (() => {
        const existingTrt = existingMatch?.treatments || [];
        const newTrt = (extracted.treatments ? extracted.treatments.map((t: any) => ({ ...t, provenance: t.provenance || "scribe" })) : null) || (extracted.treatmentGiven ? extracted.treatmentGiven.map((t: any, i: number) => ({ id: `trt-${Date.now()}-${i}`, drugName: typeof t === 'string' ? t : (t.drugName || t.name || ""), dose: typeof t === 'string' ? "" : (t.dose || ""), route: typeof t === 'string' ? "" : (t.route || ""), instruction: typeof t === 'string' ? "" : (t.instruction || ""), timeGiven: typeof t === 'string' ? "" : (t.timeGiven || ""), ipsgVerified: false, provenance: "scribe" as const })) : []);
        if (!newTrt || newTrt.length === 0) return existingTrt;
        const merged = [...existingTrt];
        for (const item of newTrt) {
          const exists = merged.some(m => m.drugName.toLowerCase() === (item.drugName || "").toLowerCase() && (!item.dose || m.dose === item.dose));
          if (!exists) {
            merged.push(item);
          }
        }
        return merged;
      })(),
      treatmentNotes: extracted.treatmentNotes || existingMatch?.treatmentNotes || undefined,
      proceduresChecked: existingMatch?.proceduresChecked || undefined,
      otherProcedures: existingMatch?.otherProcedures || undefined,
      procedureNotes: Array.isArray(existingMatch?.procedureNotes) ? existingMatch.procedureNotes : [],
      provisionalPrimaryDiagnosis: extracted.diagnosis || existingMatch?.provisionalPrimaryDiagnosis || undefined,
      progressNotes: (() => {
        const existingNotes = (existingMatch?.progressNotes || "").trim();
        const cleanExisting = (existingNotes === "Case created via ErMate Voice Scribe dictation.") ? "" : existingNotes;

        // If there is NO existing established case sheet / no existingMatch:
        // Initial Scribe dictation maps strictly into structured initial Case Sheet.
        // It must NOT enter progressNotes / Clinical Notes / Addendum.
        if (!existingMatch || !isEstablishedCaseSheet(existingMatch)) {
          return cleanExisting;
        }

        // Collect new updates to append
        const updatesToAppend: string[] = [];

        // 1. Check extracted.clinicianUpdates
        if (Array.isArray(extracted.clinicianUpdates) && extracted.clinicianUpdates.length > 0) {
          for (const item of extracted.clinicianUpdates) {
            const text = (typeof item === 'string' ? item : item?.text || "").trim();
            if (!text) continue;
            if (/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(text)) continue;
            if (cleanExisting.includes(text) || updatesToAppend.some(u => u.includes(text))) continue;
            const time = (typeof item === 'object' && item.timestamp) ? item.timestamp : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            updatesToAppend.push(`[${time}] — ${text}`);
          }
        } else if (extracted.clinicianUpdateText && typeof extracted.clinicianUpdateText === "string") {
          const text = extracted.clinicianUpdateText.trim();
          if (text && !cleanExisting.includes(text) && !/^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon)[\s!.]*$/i.test(text)) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            updatesToAppend.push(`[${time}] — ${text}`);
          }
        }

        // 2. Check extracted.chronologicalNotes
        if (Array.isArray(extracted.chronologicalNotes) && extracted.chronologicalNotes.length > 0) {
          for (const note of extracted.chronologicalNotes) {
            const entry = (typeof note === 'string' ? note : (note?.entry || note?.text || "")).trim();
            if (!entry) continue;
            if (cleanExisting.includes(entry) || updatesToAppend.some(u => u.includes(entry))) continue;
            const time = (typeof note === 'object' && note.timestamp) ? note.timestamp : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            updatesToAppend.push(`[${time}] — ${entry}`);
          }
        }

        // 3. Check direct extracted.progressNotes
        if (extracted.progressNotes && typeof extracted.progressNotes === "string") {
          const directNote = extracted.progressNotes.trim();
          if (directNote && directNote !== "Case created via ErMate Voice Scribe dictation." && !cleanExisting.includes(directNote) && !updatesToAppend.some(u => u.includes(directNote))) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            updatesToAppend.push(`[${time}] — ${directNote}`);
          }
        }

        if (updatesToAppend.length > 0) {
          return cleanExisting ? `${cleanExisting}\n\n${updatesToAppend.join("\n")}` : updatesToAppend.join("\n");
        }

        return cleanExisting;
      })(),
      dispositionAndPlan: {
        ...(existingMatch?.dispositionAndPlan || {}),
        consultsRequested: deduplicateConsultations([
          ...(existingMatch?.dispositionAndPlan?.consultsRequested || []),
          ...((existingMatch as any)?.consultsRequested || []),
          ...(extracted.consultations || []),
          ...(extracted.consultsRequested || []),
          ...(extracted.dispositionAndPlan?.consultsRequested || [])
        ]),
        managementPlan: (() => {
          const existingPlan = existingMatch?.dispositionAndPlan?.managementPlan || "";
          const newPlan = extracted.managementPlan || (Array.isArray(extracted.plan) ? extracted.plan.join("; ") : (extracted.plan || ""));
          if (!newPlan) return existingPlan;
          if (!existingPlan) return newPlan;
          if (existingPlan.includes(newPlan)) return existingPlan;
          return `${existingPlan}; ${newPlan}`;
        })(),
        followUpAdvice: extracted.followUpAdvice || existingMatch?.dispositionAndPlan?.followUpAdvice || undefined,
        dispositionStatus: extracted.dispositionType || existingMatch?.dispositionAndPlan?.dispositionStatus || undefined,
      },
      conditionAtShift: (extracted.conditionAtShift || existingMatch?.conditionAtShift || undefined) as any,
      dischargeInfo: existingMatch?.dischargeInfo ? {
        ...existingMatch.dischargeInfo,
        caseUpdatedAfterPreparation: true
      } : null,
      differentials: (() => {
        const existingDiffs = existingMatch?.differentials || [];
        if (!extracted.differentialDiagnosis) return existingDiffs;
        const newDiff = { diagnosis: extracted.differentialDiagnosis, status: "POSSIBLE" as const, reasoning: "", citations: [], nextSteps: [] };
        if (existingDiffs.some(d => d.diagnosis.toLowerCase() === newDiff.diagnosis.toLowerCase())) {
          return existingDiffs;
        }
        return [...existingDiffs, newDiff];
      })(),
      isPediatric: resolvedIsPediatric,
      pediatricDetails: (() => {
        const existingPed = existingMatch?.pediatricDetails || {};
        const incomingPed = extracted.pediatricDetails || {};
        const hasIncoming = Boolean(extracted.pediatricDetails || extracted.patientWeight || extracted.weight);
        if (!hasIncoming && !existingMatch?.pediatricDetails) {
          return undefined;
        }
        const mergedPed = { ...existingPed, ...incomingPed };
        const rawWeight = incomingPed.patientWeight ?? incomingPed.weight ?? extracted.patientWeight ?? extracted.weight ?? existingPed.patientWeight ?? existingPed.weight;
        if (rawWeight !== undefined && rawWeight !== null && String(rawWeight).trim() !== "") {
          mergedPed.patientWeight = String(rawWeight).trim();
          mergedPed.weight = String(rawWeight).trim();
        }
        return Object.keys(mergedPed).length > 0 ? mergedPed : undefined;
      })(),
      status: "Active",
      savedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeSpentMin: 1,
      doctorEmail: prof.email || user?.email || "",
      doctorName: docFormattedName,
      hospital: prof.hospital,
      ipsgChecklist: existingMatch?.ipsgChecklist || {
        ipsg1IdentifiersVerified: null,
        ipsg2ReadBackPerformed: null,
        ipsg3HighAlertDoubleChecked: null,
        ipsg4TimeOutPerformed: null,
        ipsg5HandHygieneComplied: null,
        ipsg6FallRiskAssessed: null
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
      dispositionDetails: (() => {
        const existingDisp = existingMatch?.dispositionDetails;
        const incomingObs = (typeof extracted.disposition === "string" ? extracted.disposition.trim() : "");
        const existingObs = (existingDisp?.observationNotes || "").trim();
        const mergedObs = (() => {
          if (!incomingObs) return existingObs;
          if (!existingObs) return incomingObs;
          if (existingObs.toLowerCase().includes(incomingObs.toLowerCase())) return existingObs;
          return `${existingObs} | ${incomingObs}`;
        })();

        const resolvedResident = extracted.emResident || existingDisp?.residentName || docFormattedName;
        const resolvedConsultant = extracted.emConsultant || existingDisp?.consultantName || resolvedConsultantName;

        return {
          ...(existingDisp || {}),
          ...(extracted.dispositionType ? { dispositionType: extracted.dispositionType } : {}),
          durationInEr: existingDisp?.durationInEr || "",
          residentName: resolvedResident,
          consultantName: resolvedConsultant,
          observationNotes: mergedObs
        } as any;
      })(),
      adjuncts: {
        ...(existingMatch?.adjuncts || {}),
        ecgDone: (extracted.ecg ? "true" : undefined) || existingMatch?.adjuncts?.ecgDone,
        ecgNotes: (() => {
          const existingEcgNotes = existingMatch?.adjuncts?.ecgNotes || existingMatch?.adjuncts?.ecgFindings || "";
          const incomingEcg = extracted.ecg || extracted.ecgNotes || extracted.ecgFindings || "";
          if (!incomingEcg) return existingEcgNotes;
          if (!existingEcgNotes) return incomingEcg;
          if (existingEcgNotes.toLowerCase().includes(incomingEcg.toLowerCase())) return existingEcgNotes;
          return `${existingEcgNotes} | ${incomingEcg}`;
        })(),
        echoDone: (extracted.echo ? "true" : undefined) || existingMatch?.adjuncts?.echoDone,
        echoFindings: (() => {
          const existingEchoNotes = existingMatch?.adjuncts?.echoNotes || existingMatch?.adjuncts?.echoFindings || "";
          const incomingEcho = extracted.echo || extracted.echoNotes || extracted.echoFindings || "";
          if (!incomingEcho) return existingEchoNotes;
          if (!existingEchoNotes) return incomingEcho;
          if (existingEchoNotes.toLowerCase().includes(incomingEcho.toLowerCase())) return existingEchoNotes;
          return `${existingEchoNotes} | ${incomingEcho}`;
        })(),
        echoNotes: (() => {
          const existingEchoNotes = existingMatch?.adjuncts?.echoNotes || existingMatch?.adjuncts?.echoFindings || "";
          const incomingEcho = extracted.echo || extracted.echoNotes || extracted.echoFindings || "";
          if (!incomingEcho) return existingEchoNotes;
          if (!existingEchoNotes) return incomingEcho;
          if (existingEchoNotes.toLowerCase().includes(incomingEcho.toLowerCase())) return existingEchoNotes;
          return `${existingEchoNotes} | ${incomingEcho}`;
        })(),
        ...(extracted.fastFindings ? (() => {
          const f = extracted.fastFindings;
          const parts = [
            f.heart ? `Heart: ${f.heart}` : null,
            f.abdomen ? `Abdomen: ${f.abdomen}` : null,
            f.pelvis ? `Pelvis: ${f.pelvis}` : null,
            f.bladder ? `Bladder: ${f.bladder}` : null,
            f.suprapubic ? `Suprapubic: ${f.suprapubic}` : null,
            f.lungs ? `Lungs: ${f.lungs}` : null,
          ].filter(Boolean);
          const notes = parts.length > 0 ? parts.join(", ") : (extracted.efastNotes || "");
          return notes ? {
            efastNotes: [existingMatch?.adjuncts?.efastNotes, notes].filter(Boolean).join(" | "),
          } : {};
        })() : (extracted.efastNotes ? {
          efastNotes: [existingMatch?.adjuncts?.efastNotes, extracted.efastNotes].filter(Boolean).join(" | "),
        } : {})),
        ...(extracted.vbgAbg?.values?.length > 0 ? {
          abgStatus: "done",
          abgSampleType: extracted.vbgAbg.type === "VBG" ? "Venous (VBG)" : (extracted.vbgAbg.type === "ABG" ? "Arterial (ABG)" : existingMatch?.adjuncts?.abgSampleType),
          abgPh: extracted.vbgAbg.values.find((v: any) => v.param === "ph")?.value ?? existingMatch?.adjuncts?.abgPh,
          abgPco2: extracted.vbgAbg.values.find((v: any) => v.param === "pco2")?.value ?? existingMatch?.adjuncts?.abgPco2,
          abgHco3: extracted.vbgAbg.values.find((v: any) => v.param === "hco3")?.value ?? existingMatch?.adjuncts?.abgHco3,
          abgLactate: extracted.vbgAbg.values.find((v: any) => v.param === "lactate")?.value ?? existingMatch?.adjuncts?.abgLactate,
          abgNa: extracted.vbgAbg.values.find((v: any) => v.param === "na")?.value ?? existingMatch?.adjuncts?.abgNa,
          abgK: extracted.vbgAbg.values.find((v: any) => v.param === "k")?.value ?? existingMatch?.adjuncts?.abgK,
          abgCl: extracted.vbgAbg.values.find((v: any) => v.param === "cl")?.value ?? existingMatch?.adjuncts?.abgCl,
          abgPo2: extracted.vbgAbg.values.find((v: any) => v.param === "po2")?.value ?? existingMatch?.adjuncts?.abgPo2,
          abgHb: extracted.vbgAbg.values.find((v: any) => v.param === "hb")?.value ?? existingMatch?.adjuncts?.abgHb,
          abgBe: extracted.vbgAbg.values.find((v: any) => v.param === "be")?.value ?? existingMatch?.adjuncts?.abgBe,
          abgAnionGap: extracted.vbgAbg.values.find((v: any) => v.param === "anionGap")?.value ?? existingMatch?.adjuncts?.abgAnionGap,
          abgGlucose: extracted.vbgAbg.values.find((v: any) => v.param === "glucose")?.value ?? existingMatch?.adjuncts?.abgGlucose,
          abgSao2: extracted.vbgAbg.values.find((v: any) => v.param === "sao2")?.value ?? existingMatch?.adjuncts?.abgSao2,
          abgFio2: extracted.vbgAbg.values.find((v: any) => v.param === "fio2")?.value ?? existingMatch?.adjuncts?.abgFio2,
          abgAa: extracted.vbgAbg.values.find((v: any) => v.param === "aa")?.value ?? existingMatch?.adjuncts?.abgAa,
        } : {}),
      },
      vitalsHistory: (() => {
        const existingHist = existingMatch?.vitalsHistory || [];
        const hasNewVitals = Boolean(
          extracted.vitals &&
          (extracted.vitals.bp || extracted.vitals.hr || extracted.vitals.spo2 || extracted.vitals.rr || extracted.vitals.temp)
        );
        // LOCKED RULE: If no new vitals are dictated, do not create a new vitalsHistory entry.
        // Return existing history as-is (empty array if none exists).
        if (!hasNewVitals) {
          return existingHist;
        }

        const rawBp = extracted.vitals?.bp ? String(extracted.vitals.bp).trim() : "";
        const bpParts = rawBp ? rawBp.split("/") : [];
        const sysVal = bpParts[0] && !isNaN(parseInt(bpParts[0], 10)) ? parseInt(bpParts[0], 10) : null;
        const diaVal = bpParts[1] && !isNaN(parseInt(bpParts[1], 10)) ? parseInt(bpParts[1], 10) : null;
        const hrVal = extracted.vitals?.hr && !isNaN(parseInt(extracted.vitals.hr, 10)) ? parseInt(extracted.vitals.hr, 10) : null;
        const spo2Val = extracted.vitals?.spo2 && !isNaN(parseInt(extracted.vitals.spo2, 10)) ? parseInt(extracted.vitals.spo2, 10) : null;
        const rrVal = extracted.vitals?.rr && !isNaN(parseInt(extracted.vitals.rr, 10)) ? parseInt(extracted.vitals.rr, 10) : null;
        const tempVal = extracted.vitals?.temp && !isNaN(parseFloat(extracted.vitals.temp)) ? parseFloat(extracted.vitals.temp) : null;

        const newRecord: VitalsRecord = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bp: rawBp,
          systolic: sysVal,
          diastolic: diaVal,
          hr: hrVal,
          spo2: spo2Val,
          rr: rrVal,
          temp: tempVal
        };

        return existingHist.length > 0 ? [...existingHist, newRecord] : [newRecord];
      })(),
    };

    return newCase;
  };

  const handleSaveExtractedVoiceCase = async (
    extracted: any, 
    options?: { autoNavigate?: boolean; existingCaseId?: string | null }
  ): Promise<string> => {
    const shouldNavigate = options?.autoNavigate !== false;
    const existingId = options?.existingCaseId;
    let newCaseId = existingId;
    let reservedDisplayId: string | undefined = undefined;

    if (!newCaseId) {
      newCaseId = generateInternalCaseId();
      try {
        const reserved = await reserveNextDisplaySequence(db);
        reservedDisplayId = reserved.displayId;
      } catch (err: any) {
        console.error("[handleSaveExtractedVoiceCase] Failed to reserve displayId sequence:", err);
        triggerNotification("Registration Error", err?.message || "Could not reserve daily case ID.", "warning");
        throw err;
      }
    }
    let existingMatch = cases.find(c => c.id === newCaseId) || null;
    if (!existingMatch && existingId) {
      try {
        const snap = await getDoc(doc(db, "cases", existingId));
        if (snap.exists()) {
          existingMatch = snap.data() as ClinicalCase;
        }
      } catch (e) {
        console.warn("Could not load existing case for voice extraction:", e);
      }
    }
    
    let workspaceMetadata: any = {};
    if (!existingMatch) {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
      workspaceMetadata = {
        workspaceType: workspace.workspaceType,
        ownerUid: workspace.ownerUid,
        hospitalId: workspace.hospitalId,
      };
    }

    const newCase = buildExtractedCaseDraft(existingMatch || null, extracted, {
      caseId: newCaseId,
      ...(reservedDisplayId ? { displayId: reservedDisplayId } : {}),
      workspaceMetadata,
      profile,
      currentUser: auth.currentUser,
      teamMembers,
    });

    try {
      const cleanCase = sanitizeForFirestore(newCase);
      await setDoc(doc(db, "cases", newCase.id), cleanCase, { merge: true });
      if (newCase.departmentId) {
        try {
          await setDoc(doc(db, "departments", newCase.departmentId, "cases", newCase.id), cleanCase, { merge: true });
        } catch (deptErr) {
          console.warn("Secondary department index write failed (primary case was persisted):", deptErr);
        }
      }
    } catch (err: any) {
      console.error("Error saving extracted voice case:", err);
      if (!err?.message?.includes("offline") && !err?.message?.includes("unavailable")) {
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
      triggerNotification("Save Failed", "Unable to save this case. Please try again.", "warning");
      throw err;
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
      triggerNotification("Case Sheet Ready", "Case Sheet prepared successfully.", "success");
    } else {
      triggerNotification("Case Sheet Extracted", `Case sheet extracted and saved. Voice case (${newCase.patient.name}) updated in Emergency Dashboard.`, "info");
    }

    checkConsentOnCaseSaved();
    return newCaseId;
  };

  /**
   * MATE / Voice Scribe ensure draft case:
   * Establishes a draft ClinicalCase shell linked to a Scribe session on explicit new-patient intent.
   */
  const handleEnsureDraftCase = async (
    sessionId: string,
    options?: { bedNo?: string }
  ): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    if (!sessionId) {
      throw new Error("Missing Scribe session ID");
    }

    const requestedBedNo =
      typeof options?.bedNo === "string" && options.bedNo.trim()
        ? options.bedNo.trim()
        : null;

    const upsertCaseLocally = (caseItem: ClinicalCase) => {
      setCases(prev => {
        const idx = prev.findIndex(c => c.id === caseItem.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = caseItem;
          return next;
        }
        return [caseItem, ...prev];
      });
    };

    const linkAndVerify = async (caseId: string): Promise<boolean> => {
      try {
        const linkResult = await linkScribeSessionAndCase(sessionId, caseId);
        const verified =
          linkResult.success && (await verifyTwoSidedLink(sessionId, caseId));

        if (!verified) {
          console.warn(
            "[handleEnsureDraftCase] Two-sided Scribe link pending:",
            linkResult.error || "verification incomplete"
          );
          triggerNotification(
            "Scribe Link Pending",
            "Draft case was saved, but Scribe history linkage is still pending.",
            "warning"
          );
        }

        return verified;
      } catch (linkErr: any) {
        console.error(
          "[handleEnsureDraftCase] Failed to establish two-sided Scribe link:",
          linkErr
        );
        triggerNotification(
          "Scribe Link Pending",
          "Draft case was saved, but Scribe history linkage is still pending.",
          "warning"
        );
        return false;
      }
    };

    /*
     * 1. Read current session from Firestore first.
     * The session is authoritative for an already-established link.
     * If parent case context and session linkage disagree, fail closed.
     */
    const sessionSnap = await getDoc(doc(db, "scribeSessions", sessionId));
    if (!sessionSnap.exists()) {
      throw new Error("Scribe session not found");
    }

    const sessionData = sessionSnap.data();
    const linkedCaseId =
      typeof sessionData?.linkedCaseId === "string" && sessionData.linkedCaseId.trim()
        ? sessionData.linkedCaseId.trim()
        : null;

    if (voiceScribeCaseId && linkedCaseId && voiceScribeCaseId !== linkedCaseId) {
      throw new Error(
        "Scribe session/case mismatch detected. Draft creation stopped."
      );
    }

    /*
     * 2. Idempotent recovery / existing linked case:
     * If this session is already linked to a case, reuse that ClinicalCase.
     */
    if (linkedCaseId) {
      let linkedCase = cases.find(c => c.id === linkedCaseId) || null;
      if (!linkedCase) {
        const linkedCaseSnap = await getDoc(doc(db, "cases", linkedCaseId));
        if (!linkedCaseSnap.exists()) {
          throw new Error("Scribe session points to a ClinicalCase that does not exist.");
        }
        linkedCase = {
          ...(linkedCaseSnap.data() as ClinicalCase),
          id: linkedCaseId,
        };
      }

      if (requestedBedNo) {
        const existingBedNo =
          typeof linkedCase.bedNo === "string" && linkedCase.bedNo.trim()
            ? linkedCase.bedNo.trim()
            : null;

        if (existingBedNo && existingBedNo !== requestedBedNo) {
          throw new Error(
            `Existing case is already assigned to Bed ${existingBedNo}; refusing to reassign it automatically to Bed ${requestedBedNo}.`
          );
        }

        if (!existingBedNo) {
          await setDoc(
            doc(db, "cases", linkedCaseId),
            sanitizeForFirestore({
              bedNo: requestedBedNo,
              lastEditedBy: user.uid,
              lastEditedAt: new Date().toISOString(),
            }),
            { merge: true }
          );

          linkedCase = {
            ...linkedCase,
            bedNo: requestedBedNo,
            lastEditedBy: user.uid,
            lastEditedAt: new Date().toISOString(),
          };
        }
      }

      upsertCaseLocally(linkedCase);
      await linkAndVerify(linkedCaseId);
      setVoiceScribeCaseId(linkedCaseId);
      return linkedCaseId;
    }

    /*
     * 3. Existing case context in App:
     * If App already has a case context but session is not yet linked,
     * attach this session to that exact existing case. Never create duplicate.
     */
    if (voiceScribeCaseId) {
      let existingCase = cases.find(c => c.id === voiceScribeCaseId) || null;
      if (!existingCase) {
        const existingCaseSnap = await getDoc(doc(db, "cases", voiceScribeCaseId));
        if (!existingCaseSnap.exists()) {
          throw new Error("Current Scribe case context does not exist in Firestore.");
        }
        existingCase = {
          ...(existingCaseSnap.data() as ClinicalCase),
          id: voiceScribeCaseId,
        };
      }

      if (requestedBedNo) {
        const existingBedNo =
          typeof existingCase.bedNo === "string" && existingCase.bedNo.trim()
            ? existingCase.bedNo.trim()
            : null;

        if (existingBedNo && existingBedNo !== requestedBedNo) {
          throw new Error(
            `Current case is already assigned to Bed ${existingBedNo}; refusing to reassign it automatically to Bed ${requestedBedNo}.`
          );
        }

        if (!existingBedNo) {
          await setDoc(
            doc(db, "cases", voiceScribeCaseId),
            sanitizeForFirestore({
              bedNo: requestedBedNo,
              lastEditedBy: user.uid,
              lastEditedAt: new Date().toISOString(),
            }),
            { merge: true }
          );

          existingCase = {
            ...existingCase,
            bedNo: requestedBedNo,
            lastEditedBy: user.uid,
            lastEditedAt: new Date().toISOString(),
          };
        }
      }

      upsertCaseLocally(existingCase);
      await linkAndVerify(voiceScribeCaseId);
      setVoiceScribeCaseId(voiceScribeCaseId);
      return voiceScribeCaseId;
    }

    /*
     * 4. Check if cases array already has a case linked via scribeSessionId
     */
    const existingBySession = cases.find(c => c.scribeSessionId === sessionId);
    if (existingBySession) {
      if (requestedBedNo) {
        const existingBedNo =
          typeof existingBySession.bedNo === "string" && existingBySession.bedNo.trim()
            ? existingBySession.bedNo.trim()
            : null;

        if (existingBedNo && existingBedNo !== requestedBedNo) {
          throw new Error(
            `Existing case is already assigned to Bed ${existingBedNo}; refusing to reassign it automatically to Bed ${requestedBedNo}.`
          );
        }

        if (!existingBedNo) {
          existingBySession.bedNo = requestedBedNo;
          await setDoc(
            doc(db, "cases", existingBySession.id),
            sanitizeForFirestore({
              bedNo: requestedBedNo,
              lastEditedBy: user.uid,
              lastEditedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        }
      }
      upsertCaseLocally(existingBySession);
      await linkAndVerify(existingBySession.id);
      setVoiceScribeCaseId(existingBySession.id);
      return existingBySession.id;
    }

    /*
     * 5. Brand new intake: create minimal ClinicalCase shell using buildExtractedCaseDraft
     */
    const workspace = await resolveWorkspaceForUser(user.uid);
    const newCaseId = generateInternalCaseId();
    let displayCaseId: string | undefined = undefined;
    try {
      const reserved = await reserveNextDisplaySequence(db);
      displayCaseId = reserved.displayId;
    } catch (seqErr: any) {
      console.error("[handleEnsureDraftCase] Failed to reserve displayId sequence:", seqErr);
      triggerNotification("Registration Error", seqErr?.message || "Could not reserve daily case ID.", "warning");
      throw seqErr;
    }

    const draftCase = buildExtractedCaseDraft(null, {
      bedNo: requestedBedNo || "",
      displayId: displayCaseId,
    }, {
      caseId: newCaseId,
      displayId: displayCaseId,
      workspaceMetadata: {
        workspaceType: workspace.workspaceType,
        ownerUid: workspace.ownerUid,
        hospitalId: workspace.hospitalId,
      },
      profile,
      currentUser: user,
      teamMembers,
    });

    draftCase.scribeSessionId = sessionId;
    draftCase.bedNo = requestedBedNo || draftCase.bedNo || "";
    if (displayCaseId) {
      draftCase.displayId = displayCaseId;
    }

    const cleanCase = sanitizeForFirestore(draftCase);
    await setDoc(doc(db, "cases", draftCase.id), cleanCase, { merge: true });

    upsertCaseLocally(draftCase);

    await linkAndVerify(draftCase.id);

    setVoiceScribeCaseId(draftCase.id);
    return newCaseId;
  };

  /**
   * Preview Case Sheet handler:
   * Merges extracted clinical data into an in-memory draft with ZERO Firestore writes.
   * Directs clinician into CaseSheetView in preview mode.
   */
  const handlePreviewCaseSheet = async (
    extracted: any, 
    options?: {
      existingCaseId?: string | null;
      msgId?: string;
      contributingMsgIds?: string[];
      scribeSessionId?: string | null;
    }
  ) => {
    const existingId = options?.existingCaseId || voiceScribeCaseId || generateInternalCaseId();
    let existingMatch = cases.find(c => c.id === existingId) || null;
    if (!existingMatch && existingId) {
      try {
        const snap = await getDoc(doc(db, "cases", existingId));
        if (snap.exists()) {
          existingMatch = snap.data() as ClinicalCase;
        }
      } catch (e) {
        console.warn("Could not load existing case for preview:", e);
      }
    }

    let workspaceMetadata: any = {};
    if (!existingMatch && auth.currentUser) {
      try {
        const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
        workspaceMetadata = {
          workspaceType: workspace.workspaceType,
          ownerUid: workspace.ownerUid,
          hospitalId: workspace.hospitalId,
        };
      } catch (e) {
        console.warn("Could not resolve workspace for preview:", e);
      }
    } else if (existingMatch) {
      workspaceMetadata = {
        workspaceType: existingMatch.workspaceType,
        ownerUid: existingMatch.ownerUid,
        hospitalId: existingMatch.hospitalId,
      };
    }

    const draftCase = buildExtractedCaseDraft(existingMatch, extracted, {
      caseId: existingId,
      workspaceMetadata,
      profile,
      currentUser: auth.currentUser,
      teamMembers,
    });

    if (options?.msgId) {
      setPendingPreviewContext({
        msgId: options.msgId,
        caseId: existingId,
        contributingMsgIds: options.contributingMsgIds || (options.msgId ? [options.msgId] : []),
        scribeSessionId: options.scribeSessionId || null,
      });
    } else {
      setPendingPreviewContext(null);
    }

    setPreviewCase(draftCase);
    setIsPreviewMode(true);
    setSelectedCaseId(existingId);
    setShowVoiceScribeChat(false);
  };

  /**
   * Preview Discharge Summary handler:
   * Merges extracted clinical data into an in-memory draft with ZERO Firestore writes.
   * Directs clinician into DischargeSummaryView in preview mode.
   */
  const handlePreviewDischargeSummary = async (
    extracted: any,
    options?: {
      existingCaseId?: string | null;
      msgId?: string;
      contributingMsgIds?: string[];
      scribeSessionId?: string | null;
    }
  ) => {
    const existingId = options?.existingCaseId || voiceScribeCaseId || generateInternalCaseId();
    let existingMatch = cases.find(c => c.id === existingId) || null;
    if (!existingMatch && existingId) {
      try {
        const snap = await getDoc(doc(db, "cases", existingId));
        if (snap.exists()) {
          existingMatch = snap.data() as ClinicalCase;
        }
      } catch (e) {
        console.warn("Could not load existing case for discharge preview:", e);
      }
    }

    let workspaceMetadata: any = {};
    if (!existingMatch && auth.currentUser) {
      try {
        const workspace = await resolveWorkspaceForUser(auth.currentUser.uid);
        workspaceMetadata = {
          workspaceType: workspace.workspaceType,
          ownerUid: workspace.ownerUid,
          hospitalId: workspace.hospitalId,
        };
      } catch (e) {
        console.warn("Could not resolve workspace for discharge preview:", e);
      }
    } else if (existingMatch) {
      workspaceMetadata = {
        workspaceType: existingMatch.workspaceType,
        ownerUid: existingMatch.ownerUid,
        hospitalId: existingMatch.hospitalId,
      };
    }

    const draftCase = buildExtractedCaseDraft(existingMatch, extracted, {
      caseId: existingId,
      workspaceMetadata,
      profile,
      currentUser: auth.currentUser,
      teamMembers,
    });

    setPreviewDischargeCase(draftCase);
    setIsDischargePreviewMode(true);
    setShowDischargeSummaryId(existingId);
    setShowVoiceScribeChat(false);

    setPendingDischargePreviewContext({
      caseId: existingId,
      msgId: options?.msgId,
      contributingMsgIds: options?.contributingMsgIds || (options?.msgId ? [options.msgId] : []),
      scribeSessionId: options?.scribeSessionId || null,
    });
  };

  /**
   * Apply Preview Discharge Summary handler:
   * Clinician reviewed the preview (and optionally made in-memory modifications).
   * Persists reviewed dischargeInfo using canonical persistDischargeInfo helper.
   * If there is no persisted ClinicalCase yet: fails closed with "Apply the Case Sheet first...".
   * On success: marks all contributing messages dischargeApplied: true.
   * Handles partial message flag sync failure honestly without false claims of full success.
   * Returns clinician to the exact same Scribe session without losing state.
   */
  const handleApplyPreviewDischarge = async (reviewedDischargeInfo: DischargeInfo): Promise<void> => {
    if (!auth.currentUser) {
      triggerNotification("Authentication Required", "Please sign in to save this discharge summary.", "warning");
      throw new Error("Not authenticated");
    }

    const targetCaseId = pendingDischargePreviewContext?.caseId || showDischargeSummaryId;
    if (!targetCaseId) {
      triggerNotification("Error", "Missing target case for discharge summary.", "warning");
      return;
    }

    // Check for existing persisted ClinicalCase
    let persistedCase = cases.find(c => c.id === targetCaseId) || null;
    if (!persistedCase && targetCaseId) {
      try {
        const snap = await getDoc(doc(db, "cases", targetCaseId));
        if (snap.exists()) {
          persistedCase = snap.data() as ClinicalCase;
        }
      } catch (e) {
        console.warn("Could not check Firestore for persisted case:", e);
      }
    }

    // Fail closed if case record is not yet established
    if (!persistedCase) {
      triggerNotification(
        "Apply Case Sheet First",
        "Apply the Case Sheet first to establish the patient record.",
        "warning"
      );
      throw new Error("Apply the Case Sheet first to establish the patient record.");
    }

    try {
      // 1. Persist dischargeInfo using canonical persistence helper (throws if primary write fails)
      await persistDischargeInfo(persistedCase, reviewedDischargeInfo);

      // 2. Mark all contributing messages as dischargeApplied in the authoritative Scribe session
      const targetSessionId = pendingDischargePreviewContext?.scribeSessionId;
      const contributingIds = pendingDischargePreviewContext?.contributingMsgIds || [];

      const successfulMsgIds: string[] = [];
      const failedMsgIds: string[] = [];

      if (targetSessionId && contributingIds.length > 0) {
        for (const mId of contributingIds) {
          try {
            await updateChatMessage(targetSessionId, mId, { dischargeApplied: true }, { isSession: true });
            successfulMsgIds.push(mId);
          } catch (chatErr) {
            console.warn(`Could not update dischargeApplied state for message ${mId}:`, chatErr);
            failedMsgIds.push(mId);
          }
        }
      }

      // 3. Update local scribeMessages state ONLY for successfully updated messages
      // Failed message IDs remain unapplied so they are recoverable and retryable
      setScribeMessages(prev => {
        return prev.map(m => {
          if (successfulMsgIds.includes(m.id)) {
            return { ...m, dischargeApplied: true };
          }
          return m;
        });
      });

      // 4. Honest reporting of sync outcome
      const syncComplete = contributingIds.length === 0 || (
        Boolean(targetSessionId) &&
        failedMsgIds.length === 0 &&
        successfulMsgIds.length === contributingIds.length
      );
      const statusText = syncComplete
        ? "✓ Discharge Summary updated successfully."
        : "Discharge Summary saved — Scribe status sync pending.";

      const confMsgId = `conf-discharge-applied-${Date.now()}`;
      const confMsg = {
        id: confMsgId,
        role: "assistant" as const,
        type: "text" as const,
        content: statusText,
        timestamp: new Date().toISOString(),
      };

      setScribeMessages(prev => {
        if (prev.some(m => m.id === confMsgId)) return prev;
        return [
          ...prev,
          {
            id: confMsgId,
            sender: "ai",
            text: statusText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: "dictation",
          }
        ];
      });

      if (targetSessionId) {
        appendChatMessage(targetSessionId, confMsg, { isSession: true }).catch(err => {
          console.warn("Could not persist discharge confirmation message to chat session:", err);
        });
      }

      triggerNotification(
        syncComplete ? "Discharge Summary Updated" : "Discharge Summary Saved",
        statusText,
        syncComplete ? "success" : "info"
      );

      // 5. Clean up discharge preview states and return to same Scribe session
      setIsDischargePreviewMode(false);
      setPreviewDischargeCase(null);
      setPendingDischargePreviewContext(null);
      setShowDischargeSummaryId(null);
      setShowVoiceScribeChat(true);
    } catch (err: any) {
      console.error("Failed to apply discharge summary preview:", err);
      if (!err?.message?.includes("Apply the Case Sheet first to establish the patient record")) {
        triggerNotification("Save Failed", "Unable to update discharge summary. Please try again.", "warning");
      }
      throw err;
    }
  };

  /**
   * Apply Preview Case Sheet handler:
   * Clinician reviewed the preview (and optionally made in-memory modifications).
   * Persists reviewed draft using the canonical authenticated Firestore path.
   * Updates authoritative scribe session chat status only upon successful persistence.
   * Handles multiple contributing messages and reports partial sync results honestly.
   */
  const handleApplyPreviewCase = async (reviewedCase: ClinicalCase): Promise<void> => {
    if (!auth.currentUser) {
      triggerNotification("Authentication Required", "Please sign in to save this case.", "warning");
      throw new Error("Not authenticated");
    }

    // Ensure caseUpdatedAfterPreparation is maintained if the case already had a prepared or drafted dischargeInfo
    const existingCase = cases.find(c => c.id === reviewedCase.id);
    const creationDuty = !existingCase && !reviewedCase.shiftId ? getCaseCreationDutyMetadata() : null;

    const resolvedProvenance = existingCase
      ? {
          ...(existingCase.shiftId !== undefined ? { shiftId: existingCase.shiftId } : {}),
          ...(existingCase.shiftDate !== undefined ? { shiftDate: existingCase.shiftDate } : {}),
          ...(existingCase.shiftName !== undefined ? { shiftName: existingCase.shiftName } : {}),
        }
      : {
          ...(reviewedCase.shiftId !== undefined
            ? { shiftId: reviewedCase.shiftId }
            : creationDuty ? { shiftId: creationDuty.shiftId } : {}),
          ...(reviewedCase.shiftDate !== undefined
            ? { shiftDate: reviewedCase.shiftDate }
            : creationDuty ? { shiftDate: creationDuty.shiftDate } : {}),
          ...(reviewedCase.shiftName !== undefined
            ? { shiftName: reviewedCase.shiftName }
            : creationDuty ? { shiftName: creationDuty.shiftName } : {}),
        };

    // Resolve current clinician assignment & duty session (Patch D4A):
    const resolvedAssignment = existingCase
      ? {
          ...(existingCase.currentAssigneeUid !== undefined ? { currentAssigneeUid: existingCase.currentAssigneeUid } : {}),
          ...(existingCase.currentAssigneeEmail !== undefined ? { currentAssigneeEmail: existingCase.currentAssigneeEmail } : {}),
          ...(existingCase.currentAssigneeName !== undefined ? { currentAssigneeName: existingCase.currentAssigneeName } : {}),
          ...(existingCase.currentAssignmentDutySessionId !== undefined ? { currentAssignmentDutySessionId: existingCase.currentAssignmentDutySessionId } : {}),
          ...(existingCase.currentAssignmentDutyDateKey !== undefined ? { currentAssignmentDutyDateKey: existingCase.currentAssignmentDutyDateKey } : {}),
          ...(existingCase.currentAssignmentShiftId !== undefined ? { currentAssignmentShiftId: existingCase.currentAssignmentShiftId } : {}),
          ...(existingCase.currentAssignmentAt !== undefined ? { currentAssignmentAt: existingCase.currentAssignmentAt } : {}),
        }
      : {
          currentAssigneeUid: reviewedCase.currentAssigneeUid || auth.currentUser?.uid,
          currentAssigneeEmail: reviewedCase.currentAssigneeEmail || reviewedCase.doctorEmail || profile.email,
          currentAssigneeName: reviewedCase.currentAssigneeName || reviewedCase.doctorName || profile.name || "Doctor",
          currentAssignmentAt: reviewedCase.currentAssignmentAt || new Date().toISOString(),
          ...(reviewedCase.currentAssignmentDutySessionId
            ? {
                currentAssignmentDutySessionId: reviewedCase.currentAssignmentDutySessionId,
                currentAssignmentDutyDateKey: reviewedCase.currentAssignmentDutyDateKey,
                currentAssignmentShiftId: reviewedCase.currentAssignmentShiftId,
              }
            : (creationDuty && activeDutySession ? {
                currentAssignmentDutySessionId: activeDutySession.id,
                currentAssignmentDutyDateKey: activeDutySession.dutyDateKey,
                currentAssignmentShiftId: creationDuty.baseShiftId,
              } : {})),
        };

    const caseToPersist: ClinicalCase = {
      ...reviewedCase,
      ...resolvedProvenance,
      ...resolvedAssignment,
      dischargeInfo: reviewedCase.dischargeInfo ? {
        ...reviewedCase.dischargeInfo,
        caseUpdatedAfterPreparation: true
      } : null
    };

    if (!existingCase && (!caseToPersist.displayId || !/^[0-9]{9}$/.test(caseToPersist.displayId))) {
      try {
        const reserved = await reserveNextDisplaySequence(db);
        caseToPersist.displayId = reserved.displayId;
      } catch (seqErr: any) {
        console.error("[handleApplyPreviewCase] Failed to reserve displayId sequence:", seqErr);
        triggerNotification("Registration Error", seqErr?.message || "Could not reserve daily case ID.", "warning");
        throw seqErr;
      }
    }

    try {
      const cleanCase = sanitizeForFirestore(caseToPersist);
      await setDoc(doc(db, "cases", caseToPersist.id), cleanCase, { merge: true });
      if (caseToPersist.departmentId) {
        try {
          await setDoc(doc(db, "departments", caseToPersist.departmentId, "cases", caseToPersist.id), cleanCase, { merge: true });
        } catch (deptErr) {
          console.warn("Secondary department index write failed (primary case was persisted):", deptErr);
        }
      }
    } catch (err: any) {
      console.error("Error saving preview case:", err);
      if (!err?.message?.includes("offline") && !err?.message?.includes("unavailable")) {
        handleFirestoreError(err, OperationType.WRITE, "cases");
      }
      triggerNotification("Save Failed", "Unable to save this case. Please try again.", "warning");
      throw err;
    }

    // Attempt two-sided linkage between Scribe session and the newly created/persisted ClinicalCase
    let linkSuccess = false;
    const sourceSessionId = pendingPreviewContext?.scribeSessionId;
    if (sourceSessionId) {
      try {
        const linkResult = await linkScribeSessionAndCase(sourceSessionId, caseToPersist.id);
        if (linkResult.success) {
          linkSuccess = await verifyTwoSidedLink(sourceSessionId, caseToPersist.id);
        } else {
          console.warn("[handleApplyPreviewCase] linkScribeSessionAndCase returned unsuccessful:", linkResult.error);
        }
      } catch (linkErr) {
        console.warn("[handleApplyPreviewCase] Scribe session linking failed:", linkErr);
        linkSuccess = false;
      }
    }

    // Attach scribeSessionId to local case object if link succeeded
    const finalSavedCase: ClinicalCase = (sourceSessionId && linkSuccess)
      ? { ...caseToPersist, scribeSessionId: sourceSessionId }
      : caseToPersist;

    // Update in-memory cases list
    setCases(prev => {
      const idx = prev.findIndex(c => c.id === finalSavedCase.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = finalSavedCase;
        return copy;
      }
      return [finalSavedCase, ...prev];
    });

    // Update scribe chat messages in authoritative Scribe session
    const targetSessionId = sourceSessionId;
    const contributingIds = pendingPreviewContext?.contributingMsgIds || (pendingPreviewContext?.msgId ? [pendingPreviewContext.msgId] : []);

    const successfulMsgIds: string[] = [];
    const failedMsgIds: string[] = [];

    if (targetSessionId && contributingIds.length > 0) {
      for (const mId of contributingIds) {
        try {
          await updateChatMessage(targetSessionId, mId, { extractionApplied: true }, { isSession: true });
          successfulMsgIds.push(mId);
        } catch (chatErr) {
          console.warn(`Could not update extractionApplied state for message ${mId}:`, chatErr);
          failedMsgIds.push(mId);
        }
      }
    }

    const syncComplete = contributingIds.length === 0 || (
      Boolean(targetSessionId) &&
      failedMsgIds.length === 0 &&
      successfulMsgIds.length === contributingIds.length
    );

    const isWorkflowSuccess = (sourceSessionId ? linkSuccess : true) && syncComplete;
    const statusText = !isWorkflowSuccess
      ? (sourceSessionId && !linkSuccess
          ? "Case Sheet saved — Scribe link pending."
          : "Case Sheet saved — Scribe status sync pending.")
      : "✓ Case Sheet prepared successfully.";

    // Generate ONE single confirmation ID for both Firestore chat append and local scribeMessages
    const confId = `conf-case-sheet-${Date.now()}`;

    if (targetSessionId) {
      const confirmationMsg = {
        id: confId,
        role: "assistant" as const,
        type: "text" as const,
        content: statusText,
        timestamp: new Date().toISOString(),
      };
      await appendChatMessage(targetSessionId, confirmationMsg, { isSession: true }).catch(err => {
        console.warn("Could not persist case sheet confirmation message to chat session:", err);
      });
    }

    // Update local scribeMessages state ONLY for successfully updated messages
    setScribeMessages(prev => {
      const updated = prev.map(m => {
        if (successfulMsgIds.includes(m.id)) {
          return { ...m, extractionApplied: true };
        }
        return m;
      });
      if (!updated.some(m => m.id === confId)) {
        updated.push({
          id: confId,
          sender: "ai",
          text: statusText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "dictation",
        });
      }
      return updated;
    });

    setSavedBanner({
      visible: true,
      patientName: reviewedCase.patient.name,
      caseId: reviewedCase.id
    });

    // Background logbook sync
    if (auth.currentUser) {
      auth.currentUser.getIdToken().then(token => {
        fetch("/api/logbook/sync-case", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            caseData: finalSavedCase,
            sourceType: "active_case"
          })
        }).catch(err => console.warn("Background logbook sync error:", err));
      }).catch(err => console.warn("Failed to get token for logbook sync:", err));
    }

    triggerNotification(
      isWorkflowSuccess ? "Case Sheet Ready" : "Case Sheet Saved",
      statusText,
      isWorkflowSuccess ? "success" : "info"
    );
    checkConsentOnCaseSaved();

    // Reset preview states and transition to standard case sheet view
    setIsPreviewMode(false);
    setPreviewCase(null);
    setPendingPreviewContext(null);
    setSelectedCaseId(reviewedCase.id);
    setVoiceScribeCaseId(reviewedCase.id);
    if (sourceSessionId && linkSuccess) {
      setVoiceScribeSessionId(sourceSessionId);
    }
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
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/team/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to leave previous hospital team");
      }
      
      setShowAffiliationConflictModal(false);
      setShowRoleSelectionModal(true);
    } catch (err: any) {
      console.error("Error leaving old hospital:", err);
      alert(err.message || "Failed to leave previous hospital team. Please try again.");
    }
  };
const handleRoleSelectionSubmit = async () => {
  if (!auth.currentUser || !initialHospital) return;

  try {
    const activeInviteToken =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(
            "ermate_pending_invite_token"
          )
        : "";

    if (!activeInviteToken) {
      throw new Error(
        "You must have a valid invitation link to join a department."
      );
    }

    const idToken =
      await auth.currentUser.getIdToken(true);

    const res = await fetch(
      "/api/team/accept-invite",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token: activeInviteToken
        })
      }
    );

    if (!res.ok) {
      const errorData =
        await res.json().catch(() => ({}));

      throw new Error(
        errorData.error ||
        "Failed to accept invite"
      );
    }

    if (
  typeof sessionStorage !==
  "undefined"
) {
  sessionStorage.removeItem(
    "ermate_pending_invite_token"
  );

  sessionStorage.removeItem(
    "ermate_pending_invite_hospital"
  );
}
    // IMPORTANT:
    // Do not invent hospital, role or subscription state
    // in the browser. Re-read the server-written profile.
    const profileDocRef = doc(
      db,
      "users",
      auth.currentUser.uid
    );

    const refreshedProfile =
      await getDoc(profileDocRef);

    if (refreshedProfile.exists()) {
      setProfile(
        refreshedProfile.data() as UserProfile
      );
    }

    setShowRoleSelectionModal(false);

    triggerNotification(
      "Joined Department",
      `Successfully joined ${initialHospital}.`,
      "success"
    );
  } catch (err: any) {
    console.error(
      "Error updating hospital affiliation:",
      err
    );

    alert(
      err?.message ||
      "Failed to update affiliation. Please try again."
    );
  }
};

 const handleApproveTeamMember = async (memberId: string) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const currentEmail =
      (auth.currentUser.email || "")
        .trim()
        .toLowerCase();

    const isPlatformAdminUser =
      currentEmail === "varahgrp@gmail.com";

    const approvalPayload: {
      memberId: string;
      hospitalId?: string;
      hospitalName?: string;
    } = {
      memberId
    };

    /*
     * Normal HOD:
     *   Send only memberId.
     *   Backend derives hospital authority from the HOD's
     *   verified team_members/{uid} record.
     *
     * Platform admin:
     *   Must explicitly confirm which hospital receives
     *   this clinician. Never silently trust the applicant.
     */
    if (isPlatformAdminUser) {
      const targetSnap = await getDoc(
        doc(db, "team_members", memberId)
      );

      if (!targetSnap.exists()) {
        throw new Error(
          "Pending clinician membership record was not found."
        );
      }

      const targetData = targetSnap.data();

      const requestedHospitalId =
        typeof targetData.hospitalId === "string"
          ? targetData.hospitalId.trim()
          : "";

      const requestedHospitalName =
        typeof targetData.hospitalName === "string" &&
        targetData.hospitalName.trim()
          ? targetData.hospitalName.trim()
          : (
              typeof targetData.hospital === "string"
                ? targetData.hospital.trim()
                : ""
            );

      const selectedHospitalId =
        window.prompt(
          "Platform Admin Approval\n\n" +
          "Confirm the canonical hospital ID for this clinician:",
          requestedHospitalId
        )?.trim() || "";

      if (!selectedHospitalId) {
        triggerNotification(
          "Approval Cancelled",
          "No hospital ID was confirmed.",
          "info"
        );
        return;
      }

      const selectedHospitalName =
        window.prompt(
          "Platform Admin Approval\n\n" +
          "Confirm the hospital display name:",
          requestedHospitalName
        )?.trim() || "";

      if (!selectedHospitalName) {
        triggerNotification(
          "Approval Cancelled",
          "No hospital name was confirmed.",
          "info"
        );
        return;
      }

      const confirmed = window.confirm(
        "Approve this clinician into:\n\n" +
        selectedHospitalName +
        "\nHospital ID: " +
        selectedHospitalId +
        "\n\nContinue?"
      );

      if (!confirmed) {
        triggerNotification(
          "Approval Cancelled",
          "Clinician approval was not submitted.",
          "info"
        );
        return;
      }

      approvalPayload.hospitalId =
        selectedHospitalId;

      approvalPayload.hospitalName =
        selectedHospitalName;
    }

    // Refresh token immediately before the privileged request.
    const idToken =
      await auth.currentUser.getIdToken(true);

    const res = await fetch(
      "/api/team/approve-member",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(
          approvalPayload
        )
      }
    );

    if (!res.ok) {
      const errorData =
        await res.json().catch(() => ({}));

      throw new Error(
        errorData.error ||
        "Failed to approve member"
      );
    }

    triggerNotification(
      "Clinician Approved",
      "The clinician registration has been approved. They are now active on the team.",
      "success"
    );
  } catch (err: any) {
    console.error(
      "Error approving member:",
      err
    );

    triggerNotification(
      "Approval Failed",
      err?.message ||
        "Failed to approve clinician.",
      "warning"
    );
  }
};
const handleDeclineTeamMember = async (memberId: string) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const idToken = await auth.currentUser.getIdToken();

    const res = await fetch("/api/team/decline-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ memberId })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));

      throw new Error(
        errorData.error || "Failed to decline member"
      );
    }

    triggerNotification(
      "Request Declined",
      "The registration request was successfully declined.",
      "info"
    );
  } catch (err: any) {
    console.error("Error declining member:", err);

    triggerNotification(
      "Decline Failed",
      err?.message || "Failed to decline request.",
      "warning"
    );
  }
};
 const handleLeaveTeam = async () => {
  if (!auth.currentUser) return;

  try {
    const idToken = await auth.currentUser.getIdToken();

    const res = await fetch("/api/team/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));

      throw new Error(
        errorData.error || "Failed to leave team."
      );
    }

    triggerNotification(
      "Left Department",
      "You have successfully left your previous hospital team. You are now on a Standalone Standard plan.",
      "info"
    );
  } catch (err: any) {
    console.error("Error leaving team:", err);

    alert(
      err?.message || "Failed to leave team."
    );
  }
};

const handleCancelJoinRequest = async () => {
  if (!auth.currentUser) return;

  try {
    const idToken = await auth.currentUser.getIdToken();

   const res = await fetch("/api/team/cancel-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));

      throw new Error(
        errorData.error || "Failed to cancel request."
      );
    }

    triggerNotification(
      "Request Cancelled",
      "Your request to join the hospital team has been cancelled.",
      "info"
    );
  } catch (err: any) {
    console.error("Error cancelling request:", err);

    triggerNotification(
      "Cancellation Failed",
      err?.message || "Failed to cancel join request.",
      "warning"
    );
  }
};

  // Roster Management Handlers
  const handleAddTeamMember = async (
  name: string,
  email: string,
  role: string,
  shift: string
) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const currentEmail =
      (auth.currentUser.email || "")
        .trim()
        .toLowerCase();

    const isPlatformAdmin =
      currentEmail === "varahgrp@gmail.com";

    const requestBody: any = {
      invitedEmail: email.trim().toLowerCase(),
      role,
      maxUses: 1
    };

    /*
     * Normal HOD:
     * Hospital authority is derived by the backend
     * from team_members/{uid}.
     *
     * Platform admin:
     * Backend intentionally requires an explicit
     * hospitalId + hospitalName.
     */
    if (isPlatformAdmin) {
      const adminProfileSnap =
        await getDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid
          )
        );

      if (!adminProfileSnap.exists()) {
        throw new Error(
          "Platform administrator profile could not be loaded."
        );
      }

      const adminProfile =
        adminProfileSnap.data() as any;

      const hospitalId =
        String(
          adminProfile.hospitalId || ""
        ).trim();

      const hospitalName =
        String(
          adminProfile.hospital ||
          adminProfile.hospitalName ||
          ""
        ).trim();

      /*
       * Never manufacture hospitalId from the
       * display hospital name.
       */
      if (!hospitalId || !hospitalName) {
        throw new Error(
          "The current platform-admin profile does not have a canonical hospitalId and hospitalName."
        );
      }

      requestBody.hospitalId =
        hospitalId;

      requestBody.hospitalName =
        hospitalName;
    }

    const idToken =
      await auth.currentUser.getIdToken(true);

    const res = await fetch(
      "/api/team/create-invite",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${idToken}`
        },

        body: JSON.stringify(
          requestBody
        )
      }
    );

    if (!res.ok) {
      const errData =
        await res
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.error ||
        "Failed to generate invite"
      );
    }

    const data =
      await res.json();

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://ermate.hospital";

    const link =
      `${origin}/join/${data.token}`;

    triggerNotification(
      "Invite Generated",
      `Secure invite link created for ${email}. Please share this link: ${link}`,
      "success"
    );

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .catch(() => {});
    }
  } catch (err: any) {
    console.error(
      "Error creating invite:",
      err
    );

    alert(
      err.message ||
      "Failed to create invite."
    );
  }
};

  const handleRemoveTeamMember = async (id: string) => {
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/team/remove-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ memberId: id })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove member");
      }
      triggerNotification("Roster Updated", "Removed clinician from the team roster.", "info");
    } catch (err: any) {
      console.error("Error removing team member:", err);
      alert(err.message || "Could not remove member.");
      throw err;
    }
  };

 const handleUpdateTeamMemberShift = async (
  id: string,
  shift: string
) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    await updateDoc(
      doc(db, "team_members", id),
      {
        shift,
        updatedAt: new Date().toISOString()
      }
    );

    triggerNotification(
      "Shift Updated",
      "Updated assigned clinician shift.",
      "info"
    );
  } catch (err: any) {
    console.error(
      "Error updating team member shift:",
      err
    );

    handleFirestoreError(
      err,
      OperationType.WRITE,
      "team_members"
    );

    throw err;
  }
};
 const handleUpdateTeamMemberRole = async (
  id: string,
  role: string
) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const idToken = await auth.currentUser.getIdToken();

    const res = await fetch("/api/team/update-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        memberId: id,
        role
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));

      throw new Error(
        errorData.error || "Failed to update role"
      );
    }

    triggerNotification(
      "Role Updated ✓",
      `Clinical role updated to "${role}".`,
      "success"
    );
  } catch (err: any) {
    console.error(
      "Error updating team member role:",
      err
    );

    triggerNotification(
      "Action Restricted 🔒",
      err?.message || "Failed to update role.",
      "warning"
    );

    throw err;
  }
};
 const handleUpdateHospitalShifts = async (
  newShifts: any[]
) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const uid = auth.currentUser.uid;

    // Hospital authority comes only from canonical membership.
    const memberRef = doc(
      db,
      "team_members",
      uid
    );

    const memberSnap =
      await getDoc(memberRef);

    if (!memberSnap.exists()) {
      throw new Error(
        "No verified hospital membership found."
      );
    }

    const membership =
      memberSnap.data() as any;

    const membershipStatus =
      String(membership.status || "");

    const isActive =
      isActiveMembershipStatus(membershipStatus);

    const isVerified =
      membership.membershipVerified === true;

    if (!isActive || !isVerified) {
      throw new Error(
        "Your hospital membership is not active and verified."
      );
    }

    const normalizedRole =
      String(membership.role || "")
        .trim()
        .toLowerCase();

    const isHospitalHod = [
      "hod",
      "hod / department lead",
      "hod / shift lead"
    ].includes(normalizedRole);

    const isPlatformAdmin =
      (auth.currentUser.email || "")
        .trim()
        .toLowerCase() ===
      "varahgrp@gmail.com";

    if (!isHospitalHod && !isPlatformAdmin) {
      throw new Error(
        "Only the authorized HOD can configure department shift times."
      );
    }

    const trustedHospitalId =
      typeof membership.hospitalId === "string" &&
      membership.hospitalId.trim()
        ? membership.hospitalId.trim()
        : (
            typeof membership.hospital === "string"
              ? membership.hospital.trim()
              : ""
          );

    if (!trustedHospitalId) {
      throw new Error(
        "No trusted hospital identifier is available."
      );
    }

    const hospitalLabel =
      (
        typeof membership.hospitalName === "string" &&
        membership.hospitalName.trim()
      )
        ? membership.hospitalName.trim()
        : (
            typeof membership.hospital === "string" &&
            membership.hospital.trim()
              ? membership.hospital.trim()
              : trustedHospitalId
          );

    await setDoc(
      doc(
        db,
        "hospital_shifts",
        trustedHospitalId
      ),
      sanitizeForFirestore({
        id: trustedHospitalId,
        hospitalId: trustedHospitalId,
        hospital: hospitalLabel,
        shifts: newShifts,
        updatedAt: new Date().toISOString(),
        updatedByUid: uid,
        updatedByEmail:
          auth.currentUser.email || ""
      }),
      { merge: true }
    );

    triggerNotification(
      "Roster Configured",
      "Shift rota times updated successfully.",
      "success"
    );
  } catch (err: any) {
    console.error(
      "Error updating hospital shifts:",
      err
    );

    triggerNotification(
      "Shift Update Failed",
      err?.message ||
        "Failed to update shift times.",
      "warning"
    );
  }
};

  // Handle user profile save to Firestore
// Protected authority/billing fields cannot be changed from profile editing.
const handleSaveProfile = async (newProfile: UserProfile) => {
  if (!auth.currentUser) {
    triggerNotification(
      "Save Failed",
      "You must be signed in to update your profile.",
      "warning"
    );
    return;
  }

  // Preserve all protected values from the currently trusted profile.
  // Role changes happen through /api/team/update-role.
  // Hospital assignment happens through trusted membership workflows.
  // Credits/subscription are never self-edited here.
  const profileToSave: UserProfile = {
    ...newProfile,

    email:
      auth.currentUser.email ||
      profile.email ||
      newProfile.email,

    hospital:
      profile.hospital || "",

    hospitalLabel:
      newProfile.hospitalLabel ||
      newProfile.workplaceName ||
      profile.hospitalLabel ||
      profile.hospital ||
      "",

    role:
      profile.role || "EM Resident",

    aiCredits:
      profile.aiCredits,

    subscriptionTier:
      profile.subscriptionTier || "Free Standard",

    streak:
      profile.streak
  };

  try {
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      sanitizeForFirestore(profileToSave),
      { merge: true }
    );

    // Update local UI only after Firestore save succeeds.
    setProfile(profileToSave);

    // Optional Cloud SQL mirror.
    // Only send the already-protected values, never raw newProfile authority fields.
    try {
      const idToken =
        await auth.currentUser.getIdToken(true);

      const res = await fetch("/api/sql/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: auth.currentUser.uid,
          email: profileToSave.email,
          name: profileToSave.name,
          role: profileToSave.role,
          hospital: profileToSave.hospital,
          aiCredits: profileToSave.aiCredits,
          streak: profileToSave.streak,
          subscriptionTier:
            profileToSave.subscriptionTier,
          hasConsentedToLearning:
            profileToSave.hasConsentedToLearning
        })
      });

      if (!res.ok) {
        console.warn(
          "Cloud SQL profile mirror returned:",
          res.status
        );
      }
    } catch (syncErr) {
      // Firestore remains source for this profile save.
      console.warn(
        "Failed to sync profile change with Cloud SQL:",
        syncErr
      );
    }
  } catch (err: any) {
    console.error(
      "Error saving profile to Firestore:",
      err
    );

    triggerNotification(
      "Save Failed",
      "Your profile changes could not be saved.",
      "warning"
    );
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
      const existingItem =
  previousList.find(p => p.id === item.id);

const existingCreatedByUid =
  (existingItem as any)?.createdByUid;

const itemToSave = {
  ...item,

  // Existing Quick Paste records keep their original tenant.
  // A newly-created item is assigned only to the current workspace.
  hospital:
    existingItem
      ? (existingItem.hospital || "")
      : (profile.hospital || ""),

  // Creator identity is immutable.
  // Do not claim ownership of an old legacy record that had no UID.
  ...(existingItem
    ? (
        existingCreatedByUid
          ? { createdByUid: existingCreatedByUid }
          : {}
      )
    : {
        createdByUid:
          auth.currentUser?.uid || ""
      }),

  ...(existingItem
    ? (
        existingItem.createdByEmail
          ? {
              createdByEmail:
                existingItem.createdByEmail
            }
          : {}
      )
    : {
        createdByEmail:
          auth.currentUser?.email ||
          profile.email ||
          ""
      }),

  updatedAt:
    new Date().toISOString()
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
    const signingOutUid =
      auth.currentUser?.uid || "";

    // 1. Unmount logged-in / patient-facing views first.
    setIsLoggedIn(false);
    setLoginScreenMode("login");
    setSelectedCaseId(null);
    setViewCaseSheetPrintId(null);
    setActiveFormMode(null);
    setShowDischargeSummaryId(null);

    // 2. Clear Scribe / discussion state containing case context.
    setShowVoiceScribeChat(false);
    setVoiceScribeCaseId(null);
    setShowVoiceScribeEntryChoice(false);
    setVoiceScribeDiscussionMode(false);
    setDiscussionModalCase(null);
    setIsScribeBusy(false);

    setScribeMessages([
      {
        id: "msg-1",
        sender: "ai",
        text:
          "ErMate is ready.\n\n🎙️ Dictate your case in your native language\n📄 Scan a referral letter\n💬 Ask a clinical question\n\nEvidence-based. Built for Indian ERs.",
        timestamp: new Date().toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
      }
    ]);

    // 3. Clear unsaved / preview patient-specific state.
    setPendingNewCase(null);
    setPreviewCase(null);
    setIsPreviewMode(false);
    setPendingPreviewContext(null);
    setQuickDischargeCase(null);
    setShowQuickDischarge(false);
    setIsCaseSheetDirty(false);

    setSavedBanner({
      visible: false,
      patientName: "",
      caseId: ""
    });

    // 4. Clear authenticated application data.
    setProfile(null as any);
    setCases([]);
    setHandovers([]);
    setQuickPasteList([]);
    setTeamMembers([]);
    setShifts([]);
    setHospitalSubscription(null);

    // Shift state is account-specific on a shared device.
    setIsOnShift(false);
    setShowShiftCheckIn(true);

    // 5. Remove locally cached patient/account-specific data.
    try {
      localStorage.removeItem(
        "ermate_quick_paste_list"
      );

      localStorage.removeItem(
        "ermate_isOnShift"
      );

      localStorage.removeItem(
        "ermate_shiftDate"
      );

      localStorage.removeItem(
        "ermate_shiftDismissed"
      );

      // Safe now and also prepares for the newer
      // scribeSessions architecture that will be restored later.
      if (signingOutUid) {
        localStorage.removeItem(
          `ermate:scribeSession:${signingOutUid}`
        );
      }

      sessionStorage.removeItem(
        "ermate_pending_invite_token"
      );

      sessionStorage.removeItem(
        "ermate_pending_invite_hospital"
      );
    } catch (storageErr) {
      console.warn(
        "Unable to clear local sign-out state:",
        storageErr
      );
    }

    // 6. Finally terminate Firebase authentication.
    await signOut(auth);
  } catch (err) {
    console.error(
      "Error signing out:",
      err
    );
  }
};
  // Direct tab navigating
  const navigateToTab = (tabId: string) => {
    setActiveTab(tabId as any);
    setSelectedCaseId(null);
    setCaseSheetInitialTab(null);
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
           onSignUp={() => {
  // Firebase Auth/onAuthStateChanged is the
  // only source of truth for session state.
  //
  // Do NOT set isLoggedIn true or false here.
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

  // Manual View-Specific Data Refresh handler
  const handleManualRefresh = async () => {
    // 1. Voice Scribe Chat / ErMate Assistant View
    if (showVoiceScribeChat) {
      setScribeRefreshTrigger(Date.now());
    }

    // 2. Editable Case Sheet View
    if (selectedCaseId && !activeFormMode && !showDischargeSummaryId) {
      try {
        const caseDocRef = doc(db, "cases", selectedCaseId);
        const snap = await getDoc(caseDocRef);
        if (snap.exists()) {
          const freshCase = snap.data() as ClinicalCase;
          setCases(prev => prev.map(c => c.id === selectedCaseId ? freshCase : c));
        }
        setCaseRefreshTimestamp(Date.now());
      } catch (err) {
        console.error("Failed to refresh active case:", err);
        throw err;
      }
      return;
    }

    // 3. Read-Only Printable Case Sheet View
    if (viewCaseSheetPrintId) {
      try {
        const caseDocRef = doc(db, "cases", viewCaseSheetPrintId);
        const snap = await getDoc(caseDocRef);
        if (snap.exists()) {
          const freshCase = snap.data() as ClinicalCase;
          setCases(prev => prev.map(c => c.id === viewCaseSheetPrintId ? freshCase : c));
        }
      } catch (err) {
        console.error("Failed to refresh print case view:", err);
        throw err;
      }
      return;
    }

    // 4. Discharge Summary View
    if (showDischargeSummaryId) {
      try {
        const caseDocRef = doc(db, "cases", showDischargeSummaryId);
        const snap = await getDoc(caseDocRef);
        if (snap.exists()) {
          const freshCase = snap.data() as ClinicalCase;
          setCases(prev => prev.map(c => c.id === showDischargeSummaryId ? freshCase : c));
        }
      } catch (err) {
        console.error("Failed to refresh discharge case:", err);
        throw err;
      }
      return;
    }

    // 5. Shift Handover View
    if (activeTab === "handover") {
      try {
        const userHospital = profile?.hospital || "";
        const userHospitalLower = userHospital.trim().toLowerCase();
        const handoversQuery = userHospital
          ? query(collection(db, "handovers"), where("hospital", "==", userHospital))
          : (profile?.email ? query(collection(db, "handovers"), where("senderEmail", "==", profile.email)) : collection(db, "handovers"));
        const snapshot = await getDocs(handoversQuery);
        const loadedHandovers: HandoverRecord[] = [];
        snapshot.forEach((d) => {
          loadedHandovers.push(d.data() as HandoverRecord);
        });
        const filtered = loadedHandovers.filter(h => {
          const hHosp = (h.hospital || "").trim().toLowerCase();
          const curEmail = (profile?.email || auth.currentUser?.email || "").trim().toLowerCase();
          const sEmail = (h.senderEmail || "").trim().toLowerCase();
          return (userHospitalLower && hHosp === userHospitalLower) || (curEmail && sEmail === curEmail);
        });
        setHandovers(filtered.sort((a, b) => b.id.localeCompare(a.id)));
      } catch (err) {
        console.error("Failed to refresh handovers:", err);
        throw err;
      }
      return;
    }

    // 6. Default: All other views (Dashboard, Cases, Logbook, Analytics, Tools, Team, etc.)
    try {
      const userHospital = profile?.hospital || "";
      const userHospitalLower = userHospital.trim().toLowerCase();
      const casesQuery = userHospital
        ? query(collection(db, "cases"), where("hospital", "==", userHospital))
        : (profile?.email ? query(collection(db, "cases"), where("doctorEmail", "==", profile.email)) : collection(db, "cases"));
      const snapshot = await getDocs(casesQuery);
      const loadedCases: ClinicalCase[] = [];
      snapshot.forEach((d) => {
        loadedCases.push(d.data() as ClinicalCase);
      });
      const filteredCases = loadedCases.filter(c => {
        if (!c || !c.id) return false;
        const currentEmail = (profile?.email || auth.currentUser?.email || "").trim().toLowerCase();
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

      // If on profile tab, also refresh user profile doc
      if (activeTab === "profile" && auth.currentUser) {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        }
      }
    } catch (err) {
      console.error("Failed to refresh cases data:", err);
      throw err;
    }
  };

  // Compute global search matches
  const searchTerm = searchQuery.trim().toLowerCase();
  const matchedCases = searchTerm
    ? cases.filter(c => 
        c.patient.name.toLowerCase().includes(searchTerm) ||
        (c.displayId && c.displayId.toLowerCase().includes(searchTerm)) ||
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
         <HeaderUpdateButton hasUpdate={appUpdateBanner} onApplyUpdate={handleUpdateApp} />
              <GlobalRefreshButton
                onRefresh={handleManualRefresh}
                isDirty={isCaseSheetDirty && Boolean(selectedCaseId && !activeFormMode && !showDischargeSummaryId)}
                isVoiceBusy={isScribeBusy}
                onSaveAndRefresh={async () => {
                  if (caseSheetActionsRef.current?.save) {
                    await caseSheetActionsRef.current.save();
                  }
                }}
                onDiscardAndRefresh={() => {
                  if (caseSheetActionsRef.current?.discard) {
                    caseSheetActionsRef.current.discard();
                  }
                }}
              />
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
                                {c.displayId || c.id}
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
         <HeaderUpdateButton hasUpdate={appUpdateBanner} onApplyUpdate={handleUpdateApp} />

            {/* Global Refresh Button */}
            <GlobalRefreshButton
              onRefresh={handleManualRefresh}
              isDirty={isCaseSheetDirty && Boolean(selectedCaseId && !activeFormMode && !showDischargeSummaryId)}
              isVoiceBusy={isScribeBusy}
              onSaveAndRefresh={async () => {
                if (caseSheetActionsRef.current?.save) {
                  await caseSheetActionsRef.current.save();
                }
              }}
              onDiscardAndRefresh={() => {
                if (caseSheetActionsRef.current?.discard) {
                  caseSheetActionsRef.current.discard();
                }
              }}
            />

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
            
            // Dynamic role-based navigation tabs
            const getRoleNavTabs = () => {
              switch (userNormalizedRole) {
                case "resident":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users, activeClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/15" },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award, activeClass: "bg-amber-600 text-white shadow-sm shadow-amber-600/15" },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal, activeClass: "bg-slate-700 text-white shadow-sm shadow-slate-700/15" },
                  ];
                case "consultant":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
                    { id: "cases", label: "Cases", mobileLabel: "Cases", icon: ClipboardList, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users, activeClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/15" },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award, activeClass: "bg-amber-600 text-white shadow-sm shadow-amber-600/15" },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal, activeClass: "bg-slate-700 text-white shadow-sm shadow-slate-700/15" },
                  ];
                case "hod":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
                    { id: "cases", label: "Cases", mobileLabel: "Cases", icon: ClipboardList, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users, activeClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/15" },
                    { id: "team", label: "Department Team", mobileLabel: "Team", icon: Building2, activeClass: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/15" },
                    { id: "analytics", label: "Analytics", mobileLabel: "Analytics", icon: TrendingUp, activeClass: "bg-rose-600 text-white shadow-sm shadow-rose-600/15" },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award, activeClass: "bg-amber-600 text-white shadow-sm shadow-amber-600/15" },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal, activeClass: "bg-slate-700 text-white shadow-sm shadow-slate-700/15" },
                  ];
                case "independent":
                default:
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15" },
                    { id: "cases", label: "My Cases", mobileLabel: "My Cases", icon: ClipboardList, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award, activeClass: "bg-amber-600 text-white shadow-sm shadow-amber-600/15" },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen, activeClass: "bg-purple-600 text-white shadow-sm shadow-purple-600/15" },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench, activeClass: "bg-teal-600 text-white shadow-sm shadow-teal-600/15" },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal, activeClass: "bg-slate-700 text-white shadow-sm shadow-slate-700/15" },
                  ];
              }
            };

            const baseTabs = getRoleNavTabs();
            return isAdminUser 
              ? [...baseTabs, { id: "admin", label: "Admin Panel", mobileLabel: "Admin", icon: ShieldCheck, activeClass: "bg-slate-900 text-white shadow-sm shadow-slate-900/15" }]
              : baseTabs;
          })().map((tab) => {
            const Icon = tab.icon;
            const isAnyModalActive = Boolean(selectedCaseId || viewCaseSheetPrintId || activeFormMode || showDischargeSummaryId || showPediatricCalculator || showPocketMirror || showQuickDischarge);
            const active = !isAnyModalActive && (
              activeTab === tab.id ||
              (tab.id === "tools" && ["tools", "emdrugs"].includes(activeTab)) ||
              (tab.id === "more" && ["more", "profile", "directory", "mlc"].includes(activeTab))
            );
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`text-xs px-4 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
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
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1 overflow-x-auto scrollbar-none">
          {(() => {
            const isAdminUser = profile?.email?.toLowerCase().trim() === "varahgrp@gmail.com" || auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com";
            const getRoleNavTabs = () => {
              switch (userNormalizedRole) {
                case "resident":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal },
                  ];
                case "consultant":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity },
                    { id: "cases", label: "Cases", mobileLabel: "Cases", icon: ClipboardList },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal },
                  ];
                case "hod":
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity },
                    { id: "cases", label: "Cases", mobileLabel: "Cases", icon: ClipboardList },
                    { id: "handover", label: "Handover", mobileLabel: "Handover", icon: Users },
                    { id: "team", label: "Department Team", mobileLabel: "Team", icon: Building2 },
                    { id: "analytics", label: "Analytics", mobileLabel: "Analytics", icon: TrendingUp },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal },
                  ];
                case "independent":
                default:
                  return [
                    { id: "dashboard", label: "Dashboard", mobileLabel: "Dashboard", icon: Activity },
                    { id: "cases", label: "My Cases", mobileLabel: "My Cases", icon: ClipboardList },
                    { id: "logbook", label: "My Log Book", mobileLabel: "Log Book", icon: Award },
                    { id: "learn", label: "Learn", mobileLabel: "Learn", icon: BookOpen },
                    { id: "tools", label: "Tools", mobileLabel: "Tools", icon: Wrench },
                    { id: "more", label: "More", mobileLabel: "More", icon: MoreHorizontal },
                  ];
              }
            };
            const baseTabs = getRoleNavTabs();
            return isAdminUser 
              ? [...baseTabs, { id: "admin", label: "Admin Panel", mobileLabel: "Admin", icon: ShieldCheck }]
              : baseTabs;
          })().map((tab) => {
            const Icon = tab.icon;
            const isAnyModalActive = Boolean(selectedCaseId || viewCaseSheetPrintId || activeFormMode || showDischargeSummaryId || showPediatricCalculator || showPocketMirror || showQuickDischarge);
            const active = !isAnyModalActive && (
              activeTab === tab.id ||
              (tab.id === "tools" && ["tools", "emdrugs"].includes(activeTab)) ||
              (tab.id === "more" && ["more", "profile", "directory", "mlc"].includes(activeTab))
            );
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 min-w-[48px] h-full py-2 transition-all relative select-none cursor-pointer ${
                  active 
                    ? "text-indigo-600 dark:text-indigo-400 font-extrabold" 
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
                }`}
              >
                {active && (
                  <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
                <Icon className={`w-4.5 h-4.5 ${active ? "scale-105" : ""} transition-transform`} />
                <span className="text-[9.5px] mt-1 font-sans truncate max-w-[56px] text-center leading-tight">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Render Space */}
      <main className={`flex-1 p-4 md:p-6 pb-24 md:pb-6 transition-all duration-200 ${showVoiceScribeChat ? "md:mr-[420px] lg:mr-[440px]" : ""}`}>
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
            const isPendingApproval = myTeamMember && isPendingApprovalStatus(myTeamMember.status);

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
            const isPendingApproval = myTeamMember && isPendingApprovalStatus(myTeamMember.status);
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
                  onClick={() => {
                    setInitialHospital("");
                    setActiveInviteToken("");
                    if (typeof sessionStorage !== "undefined") {
                      sessionStorage.removeItem("ermate_pending_invite_token");
                      sessionStorage.removeItem("ermate_pending_invite_hospital");
                    }
                  }}
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
              activeCases={filterActiveNonArchivedCases(cases)}
              physicalBedCapacity={erPhysicalBedCapacity || 30}
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
              const matched = (isPreviewMode && previewCase && previewCase.id === selectedCaseId)
                ? previewCase
                : (cases.find(c => c.id === selectedCaseId) || (pendingNewCase?.id === selectedCaseId ? pendingNewCase : null));
              if (!matched) return <p>Case not found</p>;
              return (
                <CaseSheetView
                  initialCase={matched}
                  initialTab={caseSheetInitialTab as any}
                  allCases={cases}
                  onSelectCase={handleSelectCase}
                  onViewPrintSheet={handleViewPrintSheet}
                  onBack={() => {
                    if (isPreviewMode) {
                      setIsPreviewMode(false);
                      setPreviewCase(null);
                      setPendingPreviewContext(null);
                      setSelectedCaseId(null);
                      setShowVoiceScribeChat(true);
                      return;
                    }
                    setPendingNewCase(null);
                    setSelectedCaseId(null);
                  }}
                  onSaveCase={handleSaveCase}
                  onNavigateToDischarge={handleNavigateToDischarge}
                  onStartNewTriage={() => {
                    if (isPreviewMode) {
                      setIsPreviewMode(false);
                      setPreviewCase(null);
                      setPendingPreviewContext(null);
                    }
                    setActiveFormMode("quick");
                    setSelectedCaseId(null);
                  }}
                  profile={profile}
                  onSaveProfile={handleSaveProfile}
                  onReturnToScribe={(caseId?: string) => {
                    if (isPreviewMode) {
                      setIsPreviewMode(false);
                      setPreviewCase(null);
                      setPendingPreviewContext(null);
                    }
                    const targetCaseId = caseId || selectedCaseId;
                    if (targetCaseId) {
                      setVoiceScribeCaseId(targetCaseId);
                      const match = cases.find(c => c.id === targetCaseId);
                      setVoiceScribeSessionId(match?.scribeSessionId || null);
                    } else {
                      setVoiceScribeCaseId(null);
                      setVoiceScribeSessionId(null);
                    }
                    setShowVoiceScribeChat(true);
                  }}
                  hasActiveScribeSession={Boolean((selectedCaseId && voiceScribeCaseId === selectedCaseId) || scribeMessages.length > 1)}
                  onDiscussCase={(c) => setDiscussionModalCase(c)}
                  isPreview={isPreviewMode}
                  onApplyPreview={handleApplyPreviewCase}
                  onDirtyChange={setIsCaseSheetDirty}
                  caseRefreshTimestamp={caseRefreshTimestamp}
                  onRegisterActions={(actions) => {
                    caseSheetActionsRef.current = actions;
                  }}
                />
              );
            })()
          )}

          {/* 3. Discharge Summary View */}
          {showDischargeSummaryId && !selectedCaseId && !activeFormMode && !showQuickDischarge && (
            (() => {
              const matched = isDischargePreviewMode && previewDischargeCase
                ? previewDischargeCase
                : (cases.find(c => c.id === showDischargeSummaryId) || (quickDischargeCase?.id === showDischargeSummaryId ? quickDischargeCase : null));
              if (!matched) return <p className="p-6 text-slate-400">Case not found</p>;
              return (
                <DischargeSummaryView
                  currentCase={matched}
                  previewMode={isDischargePreviewMode}
                  onApplyPreviewDischarge={handleApplyPreviewDischarge}
                  onBack={() => {
                    if (isDischargePreviewMode) {
                      setIsDischargePreviewMode(false);
                      setPreviewDischargeCase(null);
                      setShowDischargeSummaryId(null);
                      setShowVoiceScribeChat(true);
                      return;
                    }
                    setShowDischargeSummaryId(null);
                    setQuickDischargeCase(null);
                  }}
                  onSaveDischarge={handleSaveDischarge}
                  profile={profile}
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
              onCaseReady={async (minimalCase) => {
                try {
                  const creationDuty = getCaseCreationDutyMetadata();
                  const caseToSave = {
                    ...minimalCase,
                    ...(creationDuty ? {
                      shiftId: minimalCase.shiftId || creationDuty.shiftId,
                      shiftDate: minimalCase.shiftDate || creationDuty.shiftDate,
                      shiftName: minimalCase.shiftName || creationDuty.shiftName,
                    } : {}),
                  };
                  await handleSaveCase(caseToSave);
                  setShowQuickDischarge(false);
                  setQuickDischargeCase(caseToSave);
                  setShowDischargeSummaryId(caseToSave.id);
                } catch (err) {
                  console.error("Failed to persist quick discharge case:", err);
                  triggerNotification("Save Failed", "Unable to save this case. Please try again.", "warning");
                }
              }}
              onCancel={() => setShowQuickDischarge(false)}
            />
          )}

          {/* Pediatric Drug Calculator View */}
          {showPediatricCalculator && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            <PediatricDrugCalculatorView
              onBack={() => setShowPediatricCalculator(false)}
            />
          )}

          {/* Pocket Mirror & Pupil Inspector View */}
          {showPocketMirror && !selectedCaseId && !activeFormMode && !showDischargeSummaryId && (
            <PocketMirrorView
              onBack={() => setShowPocketMirror(false)}
            />
          )}

          {/* 6. Main Tab Views */}
          {!selectedCaseId && !viewCaseSheetPrintId && !activeFormMode && !showDischargeSummaryId && !showPediatricCalculator && !showPocketMirror && !showQuickDischarge && (
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
                  onStartVoiceScribe={handleVoiceScribeEntryClick}
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
                  onAssignBed={handleAssignBedToCase}
                  physicalBedCapacity={erPhysicalBedCapacity || 30}
                  isDarkMode={isDarkMode}
                  teamMembers={teamMembers}
                  onAddMember={handleAddTeamMember}
                  onRemoveMember={handleRemoveTeamMember}
                  onUpdateShift={handleUpdateTeamMemberShift}
                  onApproveMember={handleApproveTeamMember}
                  onDeclineMember={handleDeclineTeamMember}
                  onUpdateRole={handleUpdateTeamMemberRole}
                  shifts={shifts}
                  activeDutySession={activeDutySession}
                  onStartDutySession={handleStartDutySession}
                  onEndDutySession={handleEndDutySession}
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
                  onStartFullFlow={() => setShowEntryMenu(true)}
                  onStartQuickCase={() => setActiveFormMode("quick")}
                  onNavigateToTab={navigateToTab}
                  onDeleteCase={handleDeleteCase}
                  onDeleteAllCases={handleDeleteAllCases}
                  onDiscussCase={(c) => setDiscussionModalCase(c)}
                  onAssignBed={handleAssignBedToCase}
                  physicalBedCapacity={erPhysicalBedCapacity || 30}
                  isIndependent={userNormalizedRole === "independent"}
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

              {activeTab === "tools" && (
                <ToolsView
                  onNavigateToTab={navigateToTab}
                  isDarkMode={isDarkMode}
                />
              )}

              {activeTab === "more" && (
                <MoreView
                  profile={profile}
                  normalizedRole={userNormalizedRole}
                  onNavigateToTab={navigateToTab}
                  isDarkMode={isDarkMode}
                  onOpenUpdatesModal={() => setShowUpdatesModal(true)}
                />
              )}

              {activeTab === "learn" && <LearnView onNavigateToTab={navigateToTab} isDarkMode={isDarkMode} />}

              {activeTab === "team" && (
                <ProfileSettingsView
                  initialSubSection="team"
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
                  onStartDutySession={handleStartDutySession}
                  onEndDutySession={handleEndDutySession}
                />
              )}

              {activeTab === "logbook" && (
                <ProfileSettingsView
                  initialSubSection="logbook"
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
                  onStartDutySession={handleStartDutySession}
                  onEndDutySession={handleEndDutySession}
                />
              )}

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
                  onStartDutySession={handleStartDutySession}
                  onEndDutySession={handleEndDutySession}
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

      {/* Floating MATE Badge */}
      {isLoggedIn && !showVoiceScribeChat && !viewCaseSheetPrintId && (
        <button
          type="button"
          onClick={handleOpenMateBadge}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-mono text-xs font-black rounded-full shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-indigo-400/30 group no-print select-none"
          title="Open MATE Assistant"
          aria-label="Open MATE Assistant"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <Sparkles className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
          <span className="tracking-wider">MATE</span>
        </button>
      )}

      {/* Persistent Floating MATE Sidecar Drawer */}
      {showVoiceScribeChat && (
        <aside
          aria-label="MATE Assistant Drawer"
          className="fixed top-0 left-0 right-0 bottom-16 md:bottom-0 md:left-auto md:w-[420px] lg:w-[440px] z-30 md:z-50 bg-white dark:bg-slate-950 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 no-print"
        >
          <VoiceScribeChatView
            isSidecar={true}
            caseId={voiceScribeCaseId}
            caseData={voiceScribeCaseId ? (cases.find(c => c.id === voiceScribeCaseId) || null) : null}
            sessionId={voiceScribeSessionId}
            onSessionIdChange={setVoiceScribeSessionId}
            allCases={filterActiveNonArchivedCases(cases)}
            physicalBedCapacity={erPhysicalBedCapacity || 30}
            onSwitchCase={(newCaseId) => {
              setVoiceScribeCaseId(newCaseId);
              const match = cases.find(c => c.id === newCaseId);
              if (match?.scribeSessionId) {
                setVoiceScribeSessionId(match.scribeSessionId);
              }
            }}
            onNewChat={() => {
              // Hard patient-context boundary:
              // a new Scribe session must not inherit the previous patient's case.
              setVoiceScribeCaseId(null);
              setVoiceScribeSessionId(null);
              setPendingPreviewContext(null);
              setPreviewCase(null);
              setIsPreviewMode(false);
            }}
            initialEntryMode={voiceScribeDiscussionMode ? "discussion" : "case"}
            refreshTrigger={scribeRefreshTrigger}
            onBusyChange={setIsScribeBusy}
            onBack={() => {
              setShowVoiceScribeChat(false);
            }}
            onOpenCaseSheet={(cId) => {
              setVoiceScribeDiscussionMode(false);
              setIsPreviewMode(false);
              setPreviewCase(null);
              setPendingPreviewContext(null);
              setSelectedCaseId(cId);
              setVoiceScribeCaseId(cId);
              setCaseSheetInitialTab(null);
            }}
            onOpenCaseSection={(cId, sectionId) => {
              setVoiceScribeDiscussionMode(false);
              setIsPreviewMode(false);
              setPreviewCase(null);
              setPendingPreviewContext(null);
              setSelectedCaseId(cId);
              setVoiceScribeCaseId(cId);
              setCaseSheetInitialTab(sectionId);
            }}
            onNavigateToTab={navigateToTab}
            onPreviewCaseSheet={handlePreviewCaseSheet}
            onPreviewDischargeSummary={handlePreviewDischargeSummary}
            onRequestRoundsCase={(unappliedExtraction) => {
              const targetId = voiceScribeCaseId || selectedCaseId;
              const existingCase = targetId ? cases.find(c => c.id === targetId) : null;
              const hasExtraction = unappliedExtraction && Object.keys(unappliedExtraction).length > 0;
              if (!existingCase && !hasExtraction) {
                return null;
              }
              return buildExtractedCaseDraft(existingCase, unappliedExtraction || {}, {
                caseId: existingCase?.id || targetId || ("draft-rounds-" + Date.now()),
                profile,
                currentUser: auth.currentUser,
                teamMembers,
              });
            }}
            onEnsureDraftCase={handleEnsureDraftCase}
            onSaveExtractedCase={handleSaveExtractedVoiceCase}
            onPrepareDischarge={async (extraction, msgId, chatCaseId) => {
              const targetCaseId = chatCaseId || voiceScribeCaseId || selectedCaseId;
              if (!targetCaseId) return;
              
              const existingCase = cases.find(c => c.id === targetCaseId);

              try {
                if (existingCase) {
                  // Ensure any new details are persisted to the existing case before opening discharge summary
                  await handleSaveExtractedVoiceCase(extraction, { existingCaseId: targetCaseId, autoNavigate: false });
                } else {
                  // No case saved yet, create the minimal quick discharge case
                  const minimalCase = createQuickDischargeCase(
                    extraction,
                    profile?.email || auth?.currentUser?.email || "doctor@ermate.ai",
                    profile?.hospital || "General Hospital"
                  );
                  // Override generic CASE-XXXX id to preserve the active link with the chat session
                  minimalCase.id = targetCaseId;
                  const creationDuty = getCaseCreationDutyMetadata();
                  if (creationDuty) {
                    minimalCase.shiftId = minimalCase.shiftId || creationDuty.shiftId;
                    minimalCase.shiftDate = minimalCase.shiftDate || creationDuty.shiftDate;
                    minimalCase.shiftName = minimalCase.shiftName || creationDuty.shiftName;
                  }
                  
                  await handleSaveCase(minimalCase);
                  setQuickDischargeCase(minimalCase);
                }
              } catch (err) {
                console.error("Failed to prepare discharge:", err);
                throw err; // Propagate the error so the UI can show failure
              }
              
              setShowVoiceScribeChat(false);
              setSelectedCaseId(targetCaseId);
              setShowDischargeSummaryId(targetCaseId);
              triggerNotification("Discharge Summary Ready", "Discharge Summary prepared successfully.", "success");
            }}
            profile={profile}
            onSaveProfile={handleSaveProfile}
            messages={scribeMessages}
            onUpdateMessages={setScribeMessages}
          />
        </aside>
      )}

      {/* New Patient Entry Method Selection Menu */}
      {showEntryMenu && (
        <NewPatientEntryMenu
          currentUserName={profile?.name || "Duty Doctor"}
          hospitalName={profile?.hospital || "Emergency Dept"}
          onClose={() => setShowEntryMenu(false)}
          onSelect={async (method: EntryMethod, newCase: ClinicalCase) => {
            setShowEntryMenu(false);
            
            if (method === "triage") {
              setActiveFormMode("full");
              return;
            }

            const creationDuty = getCaseCreationDutyMetadata();
            const caseToSave = {
              ...newCase,
              ...(creationDuty ? {
                shiftId: newCase.shiftId || creationDuty.shiftId,
                shiftDate: newCase.shiftDate || creationDuty.shiftDate,
                shiftName: newCase.shiftName || creationDuty.shiftName,
              } : (newCase.shiftId ? {
                shiftId: newCase.shiftId,
                shiftDate: newCase.shiftDate,
                shiftName: newCase.shiftName,
              } : {})),
              hospital: newCase.hospital || profile.hospital,
              doctorEmail: newCase.doctorEmail || profile.email,
              doctorName: newCase.doctorName || profile.name || "Emergency Doctor",
            };

            try {
              await handleSaveCase(caseToSave);

              switch (method) {
                case "speak":
                  handleStartVoiceScribe(caseToSave.id);
                  break;
                case "type":
                case "adult-direct":
                case "pediatric-direct":
                  setPendingNewCase(caseToSave);
                  setSelectedCaseId(caseToSave.id);
                  break;
              }
            } catch (err) {
              console.error("Failed to persist new case:", err);
              triggerNotification("Save Failed", "Unable to save this case. Please try again.", "warning");
            }
          }}
        />
      )}

      {/* NEW — Voice Scribe entry-choice popup: shown when the doctor taps
          the Voice Scribe card with no case already selected. Lets them
          choose between the existing "dictate a new patient" flow and the
          new no-case "discuss a case" flow, per explicit request that this
          choice live inside the existing Voice Scribe entry point. */}
      {showVoiceScribeEntryChoice && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowVoiceScribeEntryChoice(false)}
        >
          <div
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1 mb-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">ErMate Assistant</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">What would you like to do?</p>
            </div>

            <button
              type="button"
              onClick={handleStartNewPatientDictation}
              className="w-full p-4 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl text-left transition-all flex items-start gap-3"
            >
              <div className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                <Mic className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Dictate a New Patient</span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">Speak the case — ErMate extracts and saves it to a case sheet.</span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleStartFreeDiscussion}
              className="w-full p-4 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-xl text-left transition-all flex items-start gap-3"
            >
              <div className="p-2 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                <MessageSquare className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Discuss a Case</span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">Paste or describe any case to discuss — nothing is saved as a patient record.</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowVoiceScribeEntryChoice(false)}
              className="w-full py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
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
                    disabled={isUpdatingApp}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${isUpdatingApp ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                    <span>{isUpdatingApp ? 'Updating...' : 'Update now'}</span>
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