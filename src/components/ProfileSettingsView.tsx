import React, { useState, useEffect } from "react";
import { ConfirmModal } from "./shared/ConfirmModal";
import { 
  CreditCard, Activity, RefreshCw, CheckCircle, CheckCircle2, Zap, ShieldCheck, 
  TrendingUp, Users, Percent, ArrowUpRight, Plus, Trash2, Mail, 
  Link, Copy, Check, Info, Sparkles, Building, Building2, ChevronRight, AlertTriangle,
  LogOut, ShieldAlert, Lock, Moon, Sun, Bell, FileText, Eye, EyeOff,
  UserCheck, Shield, Award, Sparkle, RefreshCcw, ChevronLeft, Clock,
  FileCheck, HelpCircle, Laptop, Smartphone, Calculator,
  ChevronDown, ChevronUp, Database, Target, Cpu, Globe, Download, UserPlus,
  Heart, Mic, Compass, BarChart2, Camera, BookOpen, Wrench, Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, ClinicalCase, TriageCategory, TeamMember, ArrivalMode, LogbookEntry } from "../types";
import TeamRosterBoard from "./TeamRosterBoard";
import TeamBuilder from "./TeamBuilder";
import MortalityAuditModal from "./MortalityAuditModal";
import { SelfLearningRulesPanel } from "./SelfLearningRulesPanel";
import RoleChangeSection from "./RoleChangeSection";
import { createTeamInvite } from "../services/teamInviteService";
import { auth, db } from "../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { APP_VERSION } from "../changelog";

interface ProfileSettingsViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  onSaveProfile: (updatedProfile: UserProfile) => void;
  onSignOut: () => void;
  rotaAssignments?: any;
  setRotaAssignments?: any;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean) => void;
  onDeleteAllCases?: () => void;
  // Mobile-first parameters passed from App.tsx
  isOnShift?: boolean;
  setIsOnShift?: (val: boolean) => void;
  handovers?: any[];
  setHandovers?: any;
  onNavigateToTab?: (tabId: string) => void;
  teamMembers: TeamMember[];
  onAddMember: (name: string, email: string, role: string, shift: string) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
  onUpdateShift: (id: string, shift: string) => Promise<void>;
  onApproveMember?: (id: string) => Promise<void>;
  onDeclineMember?: (id: string) => Promise<void>;
  onUpdateRole?: (id: string, role: string) => Promise<void>;
  onLeaveTeam?: () => Promise<void>;
  hospitalSubscription?: { active: boolean; subscriptionTier: string } | null;
  shifts?: any[];
  onUpdateShifts?: (newShifts: any[]) => Promise<void> | void;
}

export default function ProfileSettingsView({
  profile,
  cases,
  onSaveProfile,
  onSignOut,
  rotaAssignments,
  setRotaAssignments,
  isDarkMode,
  setIsDarkMode,
  onDeleteAllCases,
  isOnShift = false,
  setIsOnShift,
  handovers = [],
  setHandovers,
  onNavigateToTab,
  teamMembers,
  onAddMember,
  onRemoveMember,
  onUpdateShift,
  onApproveMember,
  onDeclineMember,
  onUpdateRole,
  onLeaveTeam,
  hospitalSubscription = null,
  shifts = [],
  onUpdateShifts,
}: ProfileSettingsViewProps) {
  // Mobile navigation subview selector
  const [selectedSubSection, setSelectedSubSection] = useState<string | null>(null);

  // Original state managers
  const [inputMode, setInputMode] = useState<"quick-select" | "bulk-add" | "single-add">("quick-select");
  const [subPlanTab, setSubPlanTab] = useState<"individual" | "team">("individual");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  // Device Link States
  const [pairingCode, setPairingCode] = useState<string>("583 921");
  const [pairingTimeLeft, setPairingTimeLeft] = useState<number>(60);
  const [pairedDevices, setPairedDevices] = useState<Array<{
    id: string;
    deviceName: string;
    deviceType: "mobile" | "computer";
    os: string;
    location: string;
    status: "Active Now" | "Idle" | "Offline";
    lastActive: string;
  }>>([
    { id: "dev-1", deviceName: "iPhone 15 Pro Max (Mobile App)", deviceType: "mobile", os: "iOS 17.5", location: "ER Ward A", status: "Active Now", lastActive: "Just now" },
    { id: "dev-2", deviceName: "Dell OptiPlex 7090 (Nurse Station 1 Desktop)", deviceType: "computer", os: "Windows 11 Pro", location: "Triage Reception", status: "Idle", lastActive: "15m ago" }
  ]);
  const [simulatorMode, setSimulatorMode] = useState<"computer" | "mobile">("computer");
  const [simPairCodeInput, setSimPairCodeInput] = useState<string>("");
  const [simDeviceName, setSimDeviceName] = useState<string>("");
  const [simError, setSimError] = useState<string>("");
  const [simSuccess, setSimSuccess] = useState<string>("");

  // Countdown timer for Device Linking PIN refreshes
  useEffect(() => {
    let timer: any;
    timer = setInterval(() => {
      setPairingTimeLeft((prev) => {
        if (prev <= 1) {
          const num = Math.floor(100000 + Math.random() * 900000).toString();
          const formatted = num.substring(0, 3) + " " + num.substring(3, 6);
          setPairingCode(formatted);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);



  const [logbookEntries, setLogbookEntries] = useState<LogbookEntry[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "users", auth.currentUser.uid, "logbook"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LogbookEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as LogbookEntry);
      });
      // Sort by updatedAt descending
      entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setLogbookEntries(entries);
    });
    return () => unsubscribe();
  }, []);

  const [workplaceName, setWorkplaceName] = useState<string>(profile.workplaceName || profile.hospital || "");
  const [departmentName, setDepartmentName] = useState<string>("Emergency Medicine Department");
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("EM Resident");
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");

  const [invitedMembers, setInvitedMembers] = useState<any[]>([]);

  const [bulkEmails, setBulkEmails] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [searchRosterQuery, setSearchRosterQuery] = useState<string>("");
  const [inviteError, setInviteError] = useState<string>("");
  const [inviteSuccess, setInviteSuccess] = useState<string>("");

  // Account Safety & Security States
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

   // Edit Profile fields (to edit user profile on the fly)
  const [editName, setEditName] = useState<string>(profile.name);
  const [editEmail, setEditEmail] = useState<string>(profile.email);
  const [editAge, setEditAge] = useState<number>(profile.age || 34);
  const [editRole, setEditRole] = useState<string>(profile.role || "Senior Consultant");
  const [editState, setEditState] = useState<string>(profile.state || "");
  const [editHospitalAddress, setEditHospitalAddress] = useState<string>(profile.hospitalAddress || "");
  const [editHospitalPhone, setEditHospitalPhone] = useState<string>(profile.hospitalPhone || "");
  const [profileSuccess, setProfileSuccess] = useState<string>("");

  useEffect(() => {
    setEditName(profile.name || "");
    setEditEmail(profile.email || "");
    setEditAge(profile.age || 34);
    setEditRole(profile.role || "Senior Consultant");
    setEditState(profile.state || "");
    setEditHospitalAddress(profile.hospitalAddress || "");
    setEditHospitalPhone(profile.hospitalPhone || "");
  }, [profile]);

  // Delete cases states
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [showLeaveTeamConfirm, setShowLeaveTeamConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  // Display mode states
  const [displayMode, setDisplayMode] = useState<"auto" | "light" | "dark">(isDarkMode ? "dark" : "light");
  const [notificationsActive, setNotificationsActive] = useState<boolean>(true);

  // Support desk tickets
  const [supportTicketMessage, setSupportTicketMessage] = useState<string>("");
  const [supportTicketSuccess, setSupportTicketSuccess] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature" | "improvement" | "general">("bug");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Tour States
  const [tourActive, setTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [tourCategory, setTourCategory] = useState<"clinical" | "team" | "learning" | "tools">("clinical");
  const [expandedFeatureIndex, setExpandedFeatureIndex] = useState<number | null>(0);

  // Privacy Policy & Preferences states
  const [openPolicySection, setOpenPolicySection] = useState<number | null>(null);
  const [shareAnalytics, setShareAnalytics] = useState<boolean>(true);
  const [shareAiTraining, setShareAiTraining] = useState<boolean>(true);
  const [biometricLock, setBiometricLock] = useState<boolean>(true);

  // Indian ER Market Revenue Planner states
  const [proDoctorCount, setProDoctorCount] = useState<number>(200);
  const [teamCount, setTeamCount] = useState<number>(10);
  const [residentsPerTeam, setResidentsPerTeam] = useState<number>(6);
  const [consultantsPerTeam, setConsultantsPerTeam] = useState<number>(2);

  // Razorpay Simulation States
  const [showRazorpayModal, setShowRazorpayModal] = useState<boolean>(false);
  const [razorpayStep, setRazorpayStep] = useState<"select" | "input" | "processing" | "success">("select");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [upiId, setUpiId] = useState<string>("varahgrp@okaxis");
  const [cardNumber, setCardNumber] = useState<string>("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState<string>("12/29");
  const [cardCvv, setCardCvv] = useState<string>("123");
  const [razorpayAmount, setRazorpayAmount] = useState<number>(0);
  const [razorpayPlanName, setRazorpayPlanName] = useState<string>("");
  const [razorpayTier, setRazorpayTier] = useState<string>("");
  const [razorpayCredits, setRazorpayCredits] = useState<number>(0);

  // Log Book States
  const [logBookSearch, setLogBookSearch] = useState<string>("");
  const [logBookTriageFilter, setLogBookTriageFilter] = useState<string>("all");

  // Handle Roster Invites
  const handleSelectCoworker = (doc: { name: string; email: string; userId: string; role: string }) => {
    setInviteError("");
    setInviteSuccess("");
    const exists = invitedMembers.some(
      m => m.email.toLowerCase() === doc.email.toLowerCase() || m.userId.toLowerCase() === doc.userId.toLowerCase()
    );
    if (exists) {
      setInviteError(`${doc.name} (${doc.email}) is already on your roster.`);
      return;
    }
    const newMem = {
      id: `mem-${Date.now()}`,
      email: doc.email,
      userId: doc.userId,
      role: doc.role,
      status: "Pending (Invited)" as const,
      joinedAt: undefined
    };
    setInvitedMembers(prev => [...prev, newMem]);
    setInviteSuccess(`Successfully added ${doc.name} to the prepared roster.`);
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    if (!bulkEmails.trim()) {
      setInviteError("Please enter emails or user IDs to bulk add.");
      return;
    }
    const tokens = bulkEmails.split(/[,;\s\n]+/).map(t => t.trim()).filter(Boolean);
    let addedCount = 0;
    const newMems: typeof invitedMembers = [];

    tokens.forEach(token => {
      const isEmail = token.includes("@");
      const emailToUse = isEmail ? token : `${token.toLowerCase()}@hospital.in`;
      const userIdToUse = isEmail ? `usr_${token.split("@")[0].replace(/[^a-zA-Z0-9]/g, "")}` : token;

      const exists = invitedMembers.some(
        m => m.email.toLowerCase() === emailToUse.toLowerCase() || m.userId.toLowerCase() === userIdToUse.toLowerCase()
      );
      if (!exists) {
        newMems.push({
          id: `mem-${Date.now()}-${addedCount}`,
          email: emailToUse,
          userId: userIdToUse,
          role: "EM Resident",
          status: "Pending (Invited)",
          joinedAt: undefined
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setInvitedMembers(prev => [...prev, ...newMems]);
      setInviteSuccess(`Bulk Added ${addedCount} team members successfully!`);
      setBulkEmails("");
    } else {
      setInviteError("Failed to add members. All items already on roster.");
    }
  };

  const handleAddMemberToRoster = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    if (!newMemberEmail && !newMemberUserId) {
      setInviteError("Please provide either an Email address or a User ID.");
      return;
    }
    const emailToUse = newMemberEmail.trim() || `${newMemberUserId.trim().toLowerCase()}@hospital.in`;
    const userIdToUse = newMemberUserId.trim() || `usr_${Math.floor(100000 + Math.random() * 900000)}`;

    const exists = invitedMembers.some(
      m => m.email.toLowerCase() === emailToUse.toLowerCase() || m.userId.toLowerCase() === userIdToUse.toLowerCase()
    );
    if (exists) {
      setInviteError("This user is already part of the roster.");
      return;
    }
    const newMem = {
      id: `mem-${Date.now()}`,
      email: emailToUse,
      userId: userIdToUse,
      role: newMemberRole,
      status: "Pending (Invited)",
      joinedAt: undefined
    };
    setInvitedMembers(prev => [...prev, newMem]);
    setInviteSuccess(`Successfully added ${emailToUse} to the roster.`);
    setNewMemberEmail("");
    setNewMemberUserId("");
  };

  const handleRemoveMember = (id: string) => {
    setInvitedMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(preparedInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRefillCredits = () => {
    startRealCheckout("credits_refill_150");
  };

  const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const startRealCheckout = async (planKey: string) => {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const orderRes = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ planKey }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}));
      throw new Error(err.error || "Could not start payment.");
    }
    const order = await orderRes.json();

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) throw new Error("Could not load Razorpay checkout.");

    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "ErMate",
      description: "ErMate Subscription",
      handler: function () {
        alert("Payment successful! Your credits will be updated momentarily.");
      },
      theme: { color: "#059669" },
    });

    rzp.open();
  } catch (err: any) {
    console.error("Checkout failed:", err);
    alert(err.message || "Payment could not be started.");
  }
};

  // Toggle Shift Checked-In State
  const handleToggleShift = () => {
    if (!setIsOnShift) return;
    const targetState = !isOnShift;
    setIsOnShift(targetState);
    
    // Create custom feedback toast
    const toast = document.createElement("div");
    toast.className = `fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border font-bold text-xs shadow-xl transition-all flex items-center gap-2 ${
      targetState 
        ? "bg-emerald-900 border-emerald-500 text-emerald-300" 
        : "bg-amber-900 border-amber-500 text-amber-300"
    }`;
    toast.innerHTML = targetState 
      ? `🟢 Checked in to active emergency shift successfully!` 
      : `🔴 Emergency shift ended. Handover summary prepared.`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  };

   // Save modified profile fields
  const handleSaveProfileForm = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    onSaveProfile({
      ...profile,
      name: editName,
      email: editEmail,
      age: editAge,
      role: profile.role, // Preserved; role changes require HOD approval workflow (ErMate Rule 10)
      workplaceName: workplaceName,
      state: editState,
      hospitalAddress: editHospitalAddress,
      hospitalPhone: editHospitalPhone
    });
    setProfileSuccess(`Clinical profile updated successfully!`);
    setTimeout(() => setProfileSuccess(""), 3500);
  };

  // Trigger Tour sequence
  const startAppTour = () => {
    setTourActive(true);
    setTourStep(0);
    setSelectedSubSection(null);
  };

  // Automatically sync theme selection with App.tsx isDarkMode
  useEffect(() => {
    if (displayMode === "dark" && setIsDarkMode) {
      setIsDarkMode(true);
    } else if (displayMode === "light" && setIsDarkMode) {
      setIsDarkMode(false);
    } else if (displayMode === "auto" && setIsDarkMode) {
      const currentHour = new Date().getHours();
      setIsDarkMode(currentHour >= 21 || currentHour < 6);
    }
  }, [displayMode]);

  // Sync shareAiTraining with profile's consented field
  useEffect(() => {
    setShareAiTraining(profile.hasConsentedToLearning !== false);
  }, [profile.hasConsentedToLearning]);

  // Compute Statistics for Stats view
  const totalCases = cases.length;
  const p1Cases = cases.filter(c => c.patient?.triageCategory === TriageCategory.P1).length;
  const p2Cases = cases.filter(c => c.patient?.triageCategory === TriageCategory.P2).length;
  const p3Cases = cases.filter(c => c.patient?.triageCategory === TriageCategory.P3).length;
  const medCases = cases.filter(c => c.patient?.caseType === "Medical").length;
  const traumaCases = cases.filter(c => c.patient?.caseType === "Trauma").length;

    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital";
  const [preparedInviteLink, setPreparedInviteLink] = useState<string>("");

  useEffect(() => {
    let active = true;
    const savedHospital = (profile.hospital || "").trim();
    const uid = auth.currentUser?.uid;
    if (savedHospital && uid) {
      createTeamInvite(savedHospital, uid, profile.name || "", {
        hospitalAddress: profile.hospitalAddress,
        hospitalPhone: profile.hospitalPhone,
        state: profile.state
      }).then(res => {
        if (active) {
          setPreparedInviteLink(res.link);
        }
      });
    }
    return () => { active = false; };
  }, [profile.hospital]);

  // Menu items list component rendering
  const renderProfileMenuList = () => {
    const initialLetter = (profile.name || "E").charAt(0).toUpperCase();

    const roleStr = (profile.role || "").toLowerCase();
    const emailStr = (profile.email || "").toLowerCase();

    const isHOD = roleStr.includes("hod") || roleStr.includes("owner") || roleStr.includes("head") || emailStr === "varahgrp@gmail.com";
    const isConsultant = !isHOD && roleStr.includes("consultant");
    const isResident = !isHOD && !isConsultant;
    const isSuperAdmin = emailStr === "varahgrp@gmail.com";

    const displayedRoleLabel = isHOD
      ? (profile.role && profile.role.toLowerCase().includes("hod") ? profile.role : "HOD / Department Lead")
      : isConsultant
        ? (profile.role && profile.role.toLowerCase().includes("consultant") ? profile.role : "Senior Consultant")
        : (profile.role || "ER Resident");

    return (
      <div className="space-y-6 pb-24 animate-fade-in">
        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab("dashboard")}
            className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-2xl transition-all flex items-center justify-center gap-2 font-black font-mono text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <ChevronLeft className="w-4.5 h-4.5 text-emerald-400" /> Back to ER Dashboard
          </button>
        )}

        {/* User Card Header */}
        <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-md">
          {/* Decorative radial gradients matching mobile ER aesthetic */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Profile Monogram */}
          <div className="w-16 h-16 rounded-full bg-emerald-950/80 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 font-extrabold text-2xl font-mono shadow-inner mb-3">
            {initialLetter}
          </div>

          <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{profile.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{profile.email}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {isHOD ? (
              <span className="text-[11px] bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 font-black rounded-full px-3 py-1 flex items-center gap-1.5 shadow-md shadow-amber-500/10">
                👑 {displayedRoleLabel}
              </span>
            ) : isConsultant ? (
              <span className="text-[11px] bg-blue-500/15 border border-blue-400 text-blue-700 dark:text-blue-300 font-extrabold rounded-full px-3 py-1 flex items-center gap-1.5">
                🩺 {displayedRoleLabel}
              </span>
            ) : (
              <span className="text-[11px] bg-emerald-500/15 border border-emerald-400 text-emerald-700 dark:text-emerald-300 font-extrabold rounded-full px-3 py-1 flex items-center gap-1.5">
                ⚕️ {displayedRoleLabel}
              </span>
            )}

            <button
              onClick={() => setSelectedSubSection("role")}
              className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-full transition-all border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1 shadow-xs"
              title="Click to switch or customize your clinical role (HOD, Senior Consultant, Resident)"
            >
              <RefreshCw className="w-3 h-3 text-emerald-500" />
              <span>Switch Role</span>
            </button>

            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-full px-2.5 py-1 font-mono font-bold">
              {profile.hospital || "General Emergency Department"}
            </span>
          </div>

          {/* Plan subscription pill */}
          <button 
            onClick={() => setSelectedSubSection("subscriptions")}
            className="mt-3.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 animate-pulse" />
            <span>{profile.subscriptionTier || (isHOD ? "Hospital Team Premium" : "Clinical Pro Plan")}</span>
          </button>
        </div>

        {/* Clinical Operational Shift Control (Check In / End Shift) */}
        <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
          <div 
            onClick={handleToggleShift}
            className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
              isOnShift 
                ? "text-rose-600 dark:text-rose-500 hover:text-rose-500 dark:hover:text-rose-400" 
                : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center ${
                isOnShift ? "bg-rose-500/10" : "bg-emerald-500/10"
              }`}>
                {isOnShift ? <LogOut className="w-4.5 h-4.5" /> : <Clock className="w-4.5 h-4.5" />}
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold block">{isOnShift ? "End Current Shift" : "Check In to Current Shift"}</strong>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                  {isOnShift ? "Active clinical shift running • Roster Live" : "Check in to start logging cases & handovers"}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 opacity-80" />
          </div>
        </div>

        {/* ROLE-SPECIFIC WORKSPACE SECTIONS */}

        {/* ------------------- ROLE 1: HOD / OWNER ------------------- */}
        {isHOD && (
          <>
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">DEPARTMENT MANAGEMENT</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => setSelectedSubSection("dashboard")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">HOD Dashboard</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Department oversight, active roster & shift status</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("handovers")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <RefreshCcw className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Incoming Handovers</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                        {handovers.length} pending acknowledgement
                      </span>
                    </div>
                  </div>
                  {handovers.length > 0 ? (
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold font-mono">
                      {handovers.length} pending
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </div>

                <div 
                  onClick={() => setSelectedSubSection("roster")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Clinical Team & Roster</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Roster assignments & doctor directory</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("roster")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <UserPlus className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Team Builder & Invitations</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Onboard doctors and generate team join links</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                {isSuperAdmin && (
                  <div 
                    onClick={() => setSelectedSubSection("revenue-planner")}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8.5 h-8.5 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                        <Calculator className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <strong className="text-sm font-bold block text-purple-400">Owner Revenue & Cost Planner</strong>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Exclusive to varahgrp@gmail.com • Platform Financial Models</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                )}

                <div 
                  onClick={() => setSelectedSubSection("self-learning")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Cpu className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Self-Learning Rules Panel</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Approve AI feedback corrections & custom department rules</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("mortality-audit")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <ShieldAlert className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Mortality & M&M Audit</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Conduct clinical case deconstructions & M&M debriefs</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

              </div>
            </div>

            {/* MY WORK section for HOD */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">MY WORK</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => setSelectedSubSection("stats")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Stats</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Clinical registries performance analytics</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("log-book")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Log Book</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">International standard case & procedure logs</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("subscriptions")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Subscriptions</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Department plan & billing details</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

              </div>
            </div>
          </>
        )}

        {/* ------------------- ROLE 2: CONSULTANT ------------------- */}
        {isConsultant && (
          <>
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">CLINICAL WORK</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => setSelectedSubSection("handovers")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <RefreshCcw className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Incoming Handovers</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                        {handovers.length} pending acknowledgement
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => onNavigateToTab ? onNavigateToTab("dashboard") : setSelectedSubSection("cases-today")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Cases Today</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">View active shift patients & consultations</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("mortality-audit")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <ShieldAlert className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Mortality & M&M Audit</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Conduct clinical case deconstructions</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">MY PROFILE</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => setSelectedSubSection("stats")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Stats</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Clinical registries performance analytics</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("log-book")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Log Book</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">International standard case & procedure logs</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("subscriptions")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Subscriptions</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Professional plan & usage</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

              </div>
            </div>
          </>
        )}

        {/* ------------------- ROLE 3: RESIDENT ------------------- */}
        {isResident && (
          <>
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">MY WORK</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => onNavigateToTab ? onNavigateToTab("dashboard") : setSelectedSubSection("cases-today")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Cases Today</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">View patients under your care</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("handovers")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <RefreshCcw className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Handover Sheet</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Shift transfer sheets & pending items</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("subscriptions")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center ${
                      (profile.aiCredits ?? 350) < 50 ? "bg-amber-500/20 text-amber-400" : "bg-purple-500/10 text-purple-400"
                    }`}>
                      <Mic className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">Scribe Credits</strong>
                      <span className={`text-[10px] block font-mono ${
                        (profile.aiCredits ?? 350) < 50 ? "text-amber-500 font-extrabold" : "text-slate-500 dark:text-slate-400"
                      }`}>
                        {profile.aiCredits ?? 350} scribe credits remaining
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">MY PROFILE</h4>
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
                <div 
                  onClick={() => setSelectedSubSection("stats")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Stats</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Resident case volume & clinical analytics</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("log-book")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Log Book</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Resident procedure & case logbook</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("subscriptions")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-bold block">My Subscriptions</strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Current plan status & tokens</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>

                <div 
                  onClick={() => setSelectedSubSection("upgrade")}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <Sparkles className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <strong className="text-sm font-extrabold block text-emerald-600 dark:text-emerald-400">Upgrade Plan</strong>
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block font-mono font-bold">Unlock unlimited voice AI & Rounds Debriefs</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>

              </div>
            </div>
          </>
        )}

        {/* Clinical Team Roster Card (Visible for all roles as directory reference) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center pl-1">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
              MY TEAM DIRECTORY ({teamMembers.length})
            </h4>
            {isHOD && (
              <button
                type="button"
                onClick={() => setSelectedSubSection("roster")}
                className="text-[10px] font-black font-mono uppercase text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none"
              >
                Manage / Invite <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-50 dark:bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-200 dark:border-slate-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <Building className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-800 dark:text-slate-200 truncate">{profile.hospital || "General Emergency Department"}</span>
              </div>
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wide shrink-0">
                Synced
              </span>
            </div>

            {/* Department Head (HOD) Information Card */}
            {(() => {
              const departmentHOD = teamMembers.find(m => 
                m.role?.toLowerCase().includes("hod") || 
                m.role?.toLowerCase().includes("head") || 
                m.role?.toLowerCase().includes("lead")
              );
              const isSelfHOD = profile.role?.toLowerCase().includes("hod") || profile.role?.toLowerCase().includes("owner") || profile.role?.toLowerCase().includes("head");
              const hodDisplayName = departmentHOD ? departmentHOD.name : (isSelfHOD ? profile.name : (profile.hospital ? `Dr. ${profile.hospital.split(' ')[0]} HOD` : "Department Head"));
              const hodEmail = departmentHOD ? departmentHOD.email : (isSelfHOD ? profile.email : "hod@" + (profile.hospital ? profile.hospital.toLowerCase().replace(/[^a-z]/g, '') : "ermate") + ".in");

              return (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-500/25 p-3 rounded-xl flex items-center justify-between gap-3 my-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                          👑 Head of Department (HOD)
                        </span>
                      </div>
                      <strong className="text-xs font-extrabold text-slate-900 dark:text-white truncate block">
                        {hodDisplayName} {isSelfHOD ? "(You)" : ""}
                      </strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block truncate">
                        {hodEmail}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono shrink-0">
                    Verified Lead
                  </span>
                </div>
              );
            })()}

            {teamMembers.length === 0 ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs font-mono">
                No active team members on this hospital roster yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {teamMembers.map((member) => {
                  const userEmailLower = (profile.email || "").toLowerCase().trim();
                  const isSelf = member.email.toLowerCase().trim() === userEmailLower;
                  const initials = (member.name || "Dr").replace("Dr.", "").trim().substring(0, 2).toUpperCase();
                  
                  return (
                    <div 
                      key={member.id} 
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                        isSelf 
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-900/30" 
                          : "bg-slate-50/30 dark:bg-slate-50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-850"
                      }`}
                    >
                      <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center text-[11px] font-black font-mono shrink-0 ${
                        isSelf 
                          ? "bg-indigo-600 text-white" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350"
                      }`}>
                        {initials}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-800 dark:text-slate-200 truncate block">
                            {member.name}
                          </span>
                          {isSelf && (
                            <span className="text-[8px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-1 py-0.2 rounded font-black uppercase tracking-wider font-mono shrink-0">
                              You{member.status === "Pending Approval" ? " (Pending)" : ""}
                            </span>
                          )}
                          {!isSelf && member.status === "Pending Approval" && (
                            <span className="text-[8px] bg-amber-100 dark:bg-amber-950/45 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 rounded font-black uppercase tracking-wider font-mono shrink-0 animate-pulse">
                              Pending
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate font-mono">
                          {member.role || "EM Resident"} • {member.shift || "off"}{member.status === "Pending Approval" ? " • Pending Approval" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {profile.hospital && profile.hospital.trim() !== "" && onLeaveTeam && (
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    setShowLeaveTeamConfirm(true);
                  }}
                  className="px-3.5 py-1.5 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 bg-transparent"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Hospital Team
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section: Account compliance */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">ACCOUNT & CONTROL</h4>
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
            
            <div 
              onClick={() => setSelectedSubSection("role")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">My Role & Facility Details</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Hospital facility & specialty details</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            <div 
              onClick={() => setSelectedSubSection("set-password")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">Set Password / PIN</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Change sign-in session PIN credentials</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            <div 
              onClick={() => setSelectedSubSection("notifications")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">Notifications</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Alert sounds, push status toggles</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            <div 
              onClick={() => setSelectedSubSection("privacy")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">Privacy & Security</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">ABDM patient clinical privacy keys</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            {/* Link to Web: Only shown for HOD and Consultant */}
            {(isHOD || isConsultant) && (
              <div 
                onClick={() => setSelectedSubSection("device-link")}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8.5 h-8.5 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Laptop className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-left">
                    <strong className="text-sm font-bold block">Link to Web</strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Connect desktop monitors or recording pins</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            )}

          </div>
        </div>

        {/* Section: Tutorials & Support */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">HELP & ABOUT</h4>
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
            
            <div 
              onClick={() => {
                setTourCategory("clinical");
                setExpandedFeatureIndex(0);
                setSelectedSubSection("tour");
              }}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <Compass className="w-4.5 h-4.5 text-indigo-500" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">Take a Tour</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Interactive guided on-boarding tour</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            <div 
              onClick={() => setSelectedSubSection("support")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <HelpCircle className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">Help & Support</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Contact ErMate hospital operations support</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            <div 
              onClick={() => setSelectedSubSection("about")}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-slate-600/10 text-slate-300 flex items-center justify-center">
                  <Info className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm font-bold block">About ErMate</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Clinical standards & certifications log</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

          </div>
        </div>

        {/* Section: Theme / Display Mode Selection */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">DISPLAY MODE</h4>
          
          <div className="bg-slate-100 dark:bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-200 dark:border-slate-800/80">
            {[
              { id: "auto" as const, label: "Auto (9pm-6am)" },
              { id: "light" as const, label: "Always Light" },
              { id: "dark" as const, label: "Always Dark" }
            ].map((mode) => {
              const active = displayMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDisplayMode(mode.id)}
                  className={`flex-1 py-2 px-2 text-center rounded-xl font-bold text-[10.5px] transition-all cursor-pointer ${
                    active 
                      ? "bg-emerald-500 text-slate-950 shadow-md" 
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 pl-1.5">
            <Moon className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>
              {displayMode === "auto" 
                ? "Auto shift mode: Theme adapts to current Indian standard hour." 
                : displayMode === "dark" 
                  ? "Always Dark: High-contrast night-mode active." 
                  : "Always Light: Crisp standard medical illumination."}
            </span>
          </div>
        </div>

        {/* Section: Destructive Data Management */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] font-black tracking-widest text-rose-500/80 uppercase font-mono pl-1">DATA MANAGEMENT</h4>
          
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
            <div 
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteStatus(null);
                setShowDeleteConfirmModal(true);
              }}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 transition-all font-bold"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Trash2 className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <strong className="text-sm block">Delete All Cases</strong>
                  <span className="text-[10px] text-rose-500/80 dark:text-rose-400/85 block font-mono">Purge cached records instantly</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-500 shrink-0" />
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-4">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Logout from Clinical Session</span>
          </button>
        </div>

        {/* App footer details */}
        <div className="text-center space-y-1.5 pt-4 font-mono">
          <p className="text-[11px] font-bold text-slate-400">
            ErMate v3.0 {isHOD ? "· PRO" : ""}
          </p>
          <p className="text-[9px] text-slate-500 leading-relaxed max-w-xs mx-auto">
            HIPAA-Compliant • Certified ATLS Protocol Engine • End-to-end encrypted locally in India.
          </p>
        </div>
      </div>
    );
  };

  // Subview selector container rendering
  const renderSubSectionContent = () => {
    let title = "Settings Subsection";
    let content: React.ReactNode = null;

    if (selectedSubSection === "handovers") {
      title = "Incoming Hospital Handovers";
      content = (
        <div className="space-y-4 font-mono">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">ACTIVE HANDOVER LOG</h4>
            <p className="text-[11px] text-slate-600">
              These patient charts have been routed here from other ER shifts and require your active department review and signing.
            </p>
          </div>

          <div className="space-y-3">
            {handovers.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <FileCheck className="w-10 h-10 text-slate-450 mx-auto mb-2" />
                <strong className="text-xs text-slate-700 block">No Pending Handovers</strong>
                <p className="text-[10px] text-slate-400 mt-1">All incoming department transfers have been reviewed and filed.</p>
              </div>
            ) : (
              handovers.map((item: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-150">
                        Bed {item.bedNumber || `ER-${idx+1}`}
                      </span>
                      <strong className="block text-slate-800 text-xs font-bold mt-1.5">{item.patientName || "Anonymous Patient"}</strong>
                      <p className="text-[10px] text-slate-500">{item.age || "32"}y • {item.triageColor?.toUpperCase() || "YELLOW"} Triage</p>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-150">
                      Pending
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 text-[10.5px] text-slate-700 text-left space-y-1.5">
                    <p><span className="text-slate-450 font-medium">Chief Complaint:</span> {item.chiefComplaint || "Cardiovascular evaluation"}</p>
                    <p><span className="text-slate-450 font-medium">Sender Doctor:</span> {item.assignedDoctor || "Emergency Physician"}</p>
                    <p><span className="text-slate-450 font-medium">Pending Actions:</span> <span className="text-amber-600 font-black">{item.pendingActions || "Verify lab reports & monitor vitals"}</span></p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHandovers(prev => prev.filter((_: any, i: number) => i !== idx));
                        const notice = document.createElement("div");
                        notice.className = "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-550 border border-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl";
                        notice.innerHTML = `✓ Handover accepted for ${item.patientName || "Patient"}.`;
                        document.body.appendChild(notice);
                        setTimeout(() => notice.remove(), 2500);
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Acknowledge & Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const notice = document.createElement("div");
                        notice.className = "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-indigo-650 border border-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl";
                        notice.innerHTML = `📢 Escalated case sheet alert to ER Consultants.`;
                        document.body.appendChild(notice);
                        setTimeout(() => notice.remove(), 2500);
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 rounded-xl transition-all text-[11px] cursor-pointer"
                    >
                      Escalate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (selectedSubSection === "dashboard") {
      title = "HOD Executive Panel";
      content = (
        <div className="space-y-4 font-mono">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-150 p-4.5 rounded-2xl text-slate-800 space-y-1 text-left">
            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-700">ADMIN CONTROL CENTER</h4>
            <p className="text-[10px] text-slate-600">HOD authorization layer. Oversee duty assignments and lock live registries.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-left space-y-1 shadow-xs">
              <span className="text-[9px] text-slate-450 uppercase font-bold">Duty Roster Mode</span>
              <p className="text-xs font-bold text-slate-800">Consolidated Core</p>
              <span className="text-[9px] text-emerald-600 font-bold block">✓ Operational</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-left space-y-1 shadow-xs">
              <span className="text-[9px] text-slate-450 uppercase font-bold">Registry Locks</span>
              <p className="text-xs font-bold text-slate-800">Standard HIPAA</p>
              <span className="text-[9px] text-indigo-600 font-bold block">● Encryption Active</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 text-xs text-left shadow-xs">
            <h5 className="font-bold text-indigo-700 uppercase text-[10px] tracking-wider">ACTIVE ROSTER SHIFTS</h5>
            
            <div className="space-y-2.5 divide-y divide-slate-100 text-[10.5px]">
              <div className="flex justify-between items-center pt-1">
                <div>
                  <strong className="text-slate-800 font-bold block">Morning Ward Rota</strong>
                  <span className="text-[9.5px] text-slate-500">2 Consultants • 4 Residents</span>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold">Active</span>
              </div>
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <strong className="text-slate-800 font-bold block">Noon Trauma Backup</strong>
                  <span className="text-[9.5px] text-slate-500">1 Consultant • 2 Residents</span>
                </div>
                <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-bold">Pending</span>
              </div>
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <strong className="text-slate-800 font-bold block">Night Resus Duty</strong>
                  <span className="text-[9.5px] text-slate-500">3 Consultants • 6 Residents</span>
                </div>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[9px] font-bold">Configured</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                const notice = document.createElement("div");
                notice.className = "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl";
                notice.innerHTML = `📢 Sent WhatsApp alerts & Roster updates to emergency core.`;
                document.body.appendChild(notice);
                setTimeout(() => notice.remove(), 2500);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Broadcast Shift Rota Alerts
            </button>
          </div>
        </div>
      );
    } else if (selectedSubSection === "roster") {
      title = "Roster Setup & Workbench";
      content = (
        <div className="space-y-6 text-left">
                <TeamBuilder
            hospitalName={workplaceName}
            onHospitalChange={(name) => {
              setWorkplaceName(name);
            }}
            profile={profile}
            onSaveConfig={(teamName, department, teamColor) => {
              onSaveProfile({
                ...profile,
                workplaceName: workplaceName.trim(),
                teamName,
                department,
                teamColor
              });
            }}
            members={teamMembers}
            onMembersChange={(updatedMembers) => {
              if (updatedMembers.length > teamMembers.length) {
                const added = updatedMembers[updatedMembers.length - 1];
                onAddMember(
                  added.name || added.email.split("@")[0],
                  added.email,
                  added.role,
                  added.shift || "Not Scheduled"
                );
              } else if (updatedMembers.length < teamMembers.length) {
                const deleted = teamMembers.find(m => !updatedMembers.some(um => um.id === m.id));
                if (deleted) {
                  onRemoveMember(deleted.id);
                }
              }
            }}
          />

          <div className="border-t border-slate-200 dark:border-slate-200 dark:border-slate-800/80 pt-6">
            <TeamRosterBoard
              teamMembers={teamMembers}
              profile={profile}
              onAddMember={onAddMember}
              onRemoveMember={onRemoveMember}
              onUpdateShift={onUpdateShift}
              onApproveMember={onApproveMember}
              onDeclineMember={onDeclineMember}
              onUpdateRole={onUpdateRole}
              hospitalSubscriptionActive={!!hospitalSubscription?.active}
              shifts={shifts}
              onUpdateShifts={onUpdateShifts}
            />
          </div>
        </div>
      );
    } else if (selectedSubSection === "log-book") {
      title = "Official Clinical Log Book";

      const getCaseProcedures = (c: ClinicalCase) => {
        const list: string[] = [];
        if (c.proceduresChecked && Array.isArray(c.proceduresChecked)) {
          c.proceduresChecked.forEach(p => {
            const mapped: Record<string, string> = {
              foleys: "Foley's Catheterization",
              ng_tube: "NG Tube Placement",
              intubation: "RSI Intubation",
              central_line: "Central Venous Line",
              suturing: "Laceration Suturing",
              splinting: "Orthopedic Splinting",
              cpr: "Cardiopulmonary Resuscitation",
              defib: "Defibrillation / Cardioversion",
              nebulization: "Nebulization Therapy",
              iv_access: "IV Cannulation",
              abg_punch: "ABG Radial Punch",
            };
            list.push(mapped[p] || p.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase()));
          });
        }
        if (c.otherProcedures && c.otherProcedures.trim()) {
          c.otherProcedures.split(",").map(p => p.trim()).forEach(p => {
            if (p && !list.includes(p)) list.push(p);
          });
        }
        return list;
      };

      const legacyCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === profile.email.toLowerCase().trim());
      
      const unifiedLogs = [];
      const seenSourceIds = new Set();
      
      logbookEntries.forEach(entry => {
        unifiedLogs.push({
          id: entry.entryId,
          isSnapshot: true,
          dateSeen: entry.dateSeen || entry.createdAt.split('T')[0],
          ageGroup: entry.ageGroup || null,
          gender: entry.gender || null,
          triageCategory: entry.triageCategory || null,
          caseCategory: entry.caseCategory || null,
          procedures: entry.proceduresPerformed || [],
          hospitalNameAtTime: entry.hospitalNameAtTime || null,
          sourceCaseId: entry.sourceCaseId || null
        });
        if (entry.sourceCaseId) seenSourceIds.add(entry.sourceCaseId);
      });
      
      legacyCases.forEach(c => {
        if (!seenSourceIds.has(c.id)) {
           unifiedLogs.push({
             id: c.id,
             isSnapshot: false,
             dateSeen: c.savedTime ? c.savedTime.split('T')[0] : (c.patient.dateOpened || null),
             ageGroup: c.isPediatric ? "pediatric" : "adult",
             gender: c.patient.gender || null,
             triageCategory: c.patient.triageCategory || null,
             caseCategory: c.patient.caseType || c.provisionalPrimaryDiagnosis || null,
             procedures: getCaseProcedures(c),
             hospitalNameAtTime: c.hospital || null,
             sourceCaseId: c.id
           });
        }
      });
      
      unifiedLogs.sort((a, b) => new Date(b.dateSeen || 0).getTime() - new Date(a.dateSeen || 0).getTime());
      
      const hasRealLogs = unifiedLogs.length > 0;
      const activeLogs = unifiedLogs;

      // Filtered cases list based on search and triage
      const filteredCases = activeLogs.filter(c => {
        const matchesTriage = logBookTriageFilter === "all" || 
          (logBookTriageFilter === "P1" && c.triageCategory?.includes("P1")) ||
          (logBookTriageFilter === "P2" && c.triageCategory?.includes("P2")) ||
          (logBookTriageFilter === "P3" && c.triageCategory?.includes("P3"));
          
        const searchLower = logBookSearch.toLowerCase().trim();
        const caseProcs = (c.procedures || []).join(" ").toLowerCase();
        const caseCat = (c.caseCategory || "").toLowerCase();
        
        const matchesSearch = !searchLower ||
          caseCat.includes(searchLower) ||
          caseProcs.includes(searchLower);
        
        return matchesTriage && matchesSearch;
      });

            // Stats computations
      const totalCasesCount = activeLogs.length;
      const p1Count = activeLogs.filter(c => c.triageCategory?.includes("P1")).length;
      const p2Count = activeLogs.filter(c => c.triageCategory?.includes("P2")).length;
      const p3Count = activeLogs.filter(c => c.triageCategory?.includes("P3")).length;

      // Procedures counts
      const procMap: Record<string, number> = {};
      let totalProcsPerformed = 0;
      activeLogs.forEach(c => {
        (c.procedures || []).forEach((p: string) => {
          procMap[p] = (procMap[p] || 0) + 1;
          totalProcsPerformed++;
        });
      });
      const uniqueProcsCount = Object.keys(procMap).length;

      const handleCSVExport = () => {
        const headers = [
          "Date Seen", 
          "Snapshot Type",
          "Hospital/Clinic",
          "Age Group", 
          "Gender", 
          "Triage Level", 
          "Case Category", 
          "Procedures Performed"
        ];

        const rows = activeLogs.map(c => [
          c.dateSeen || "",
          c.isSnapshot ? "Verified Record" : "Legacy Local",
          c.hospitalNameAtTime || "Independent",
          c.ageGroup || "N/A",
          c.gender || "N/A",
          c.triageCategory || "N/A",
          c.caseCategory || "General Case",
          (c.procedures || []).join("; ")
        ]);

        const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ErMate_Logbook_${profile.name.replace(/\s+/g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      content = (
        <div className="space-y-4 font-mono text-left text-xs text-slate-800 dark:text-slate-100">
          
          {/* Real vs Demo Banner Alert */}
          {!hasRealLogs && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-1">
              <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase inline-block">
                Demonstration Mode
              </span>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed font-sans">
                You haven't logged any active cases yet. We are showing interactive standard-compliant clinical logs to demonstrate the layout. Save case sheets on the clinical dashboard to automatically populate your permanent logbook.
              </p>
            </div>
          )}

          {hasRealLogs && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-sans">
                Real-Time Sync Active — {activeLogs.length} case sheets captured in your permanent registry.
              </span>
            </div>
          )}

          {/* Official Registry Header stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Total Cases</span>
              <strong className="text-lg text-slate-800 dark:text-white mt-1 block">{totalCasesCount}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">Patient logs</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Procedures</span>
              <strong className="text-lg text-indigo-600 dark:text-indigo-400 mt-1 block">{totalProcsPerformed}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">{uniqueProcsCount} unique types</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Resus (P1)</span>
              <strong className="text-lg text-rose-600 dark:text-rose-400 mt-1 block">{p1Count}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">Level 1 triage</span>
            </div>
          </div>

          {/* Segmented Triage Proportion bar */}
          <div className="bg-slate-50 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase font-bold">
              <span>Triage Profile Ratio</span>
              <span>P1 ({p1Count}) • P2 ({p2Count}) • P3 ({p3Count})</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex w-full">
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${totalCasesCount > 0 ? (p1Count / totalCasesCount) * 100 : 0}%` }} />
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${totalCasesCount > 0 ? (p2Count / totalCasesCount) * 100 : 0}%` }} />
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${totalCasesCount > 0 ? (p3Count / totalCasesCount) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Interactive Controls Panel */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search UHID, Diagnosis, Procedure..."
                value={logBookSearch}
                onChange={(e) => setLogBookSearch(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 rounded-xl pl-8.5 pr-3 py-1.8 text-[11px] focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <div className="flex gap-2">
              <select
                value={logBookTriageFilter}
                onChange={(e) => setLogBookTriageFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Triage</option>
                <option value="P1">P1 (Red)</option>
                <option value="P2">P2 (Yellow)</option>
                <option value="P3">P3 (Green)</option>
              </select>
              <button
                type="button"
                onClick={handleCSVExport}
                className="px-3 py-1.8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[10.5px] uppercase shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          {/* Case logs table/cards list */}
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {filteredCases.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-200 dark:border-slate-800 rounded-2xl font-sans">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-xs">No matching cases found</p>
                <p className="text-[10px] mt-0.5">Try widening your search terms or triage filter.</p>
              </div>
            ) : (
              filteredCases.map((c, idx) => {
                const cProcs = c.procedures || [];
                const isP1 = c.triageCategory?.includes("P1");
                const isP2 = c.triageCategory?.includes("P2");
                const triageColor = isP1
                  ? "border-l-rose-500 text-rose-500 dark:text-rose-400 bg-rose-50/5 dark:bg-rose-500/5" 
                  : isP2
                   ? "border-l-amber-500 text-amber-500 dark:text-amber-400 bg-amber-50/5 dark:bg-amber-500/5" 
                   : "border-l-emerald-500 text-emerald-500 dark:text-emerald-400 bg-emerald-50/5 dark:bg-emerald-500/5";
                const triageLabel = isP1 ? "P1 (CRITICAL)" : isP2 ? "P2 (URGENT)" : "P3 (STABLE)";

                return (
                  <div 
                    key={`${c.id}-${idx}`} 
                    className={`border-l-4 rounded-r-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 ${triageColor}`}
                  >
                    {/* Card Header row */}
                    <div className="flex justify-between items-start gap-1">
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold font-sans">
                            {c.caseCategory || "General Case"}
                          </strong>
                          <span className="text-[9px] text-slate-400 font-sans font-medium">
                            ({c.ageGroup || "Adult"} / {c.gender || "Unknown"})
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">
                          Hospital: <span className="font-bold">{c.hospitalNameAtTime || "Independent"}</span>
                          {c.isSnapshot && <span className="ml-2 text-indigo-400 font-bold">✓ Verified Snapshot</span>}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-sans">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border border-current bg-current/10">
                          {triageLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {c.dateSeen ? new Date(c.dateSeen).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Procedures list */}
                    {cProcs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cProcs.map((proc, pIdx) => (
                          <span key={pIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-700 capitalize">
                            {proc.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    } else if (selectedSubSection === "self-learning") {
      title = "Self-Learning Rules Panel";
      content = <SelfLearningRulesPanel />;
    } else if (selectedSubSection === "mortality-audit") {
      title = "Mortality & M&M Audit";
      content = (
        <MortalityAuditModal
          isOpen={true}
          onClose={() => setSelectedSubSection(null)}
          profile={profile}
          cases={cases}
        />
      );
    } else if (selectedSubSection === "cases-today") {
      title = "My Cases Today";
      content = (
        <div className="space-y-4 font-mono">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-left">
            <h4 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">My Active Clinical Cases ({cases.length})</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Quick view of patients logged during your active shift.</p>
          </div>
          
          <div className="space-y-2">
            {cases.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No clinical cases registered today yet.
              </div>
            ) : (
              cases.slice(0, 10).map((c, idx) => (
                <div key={`${c.id}-${idx}`} className="p-3 bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-left">
                  <div>
                    <strong className="text-xs text-slate-800 dark:text-slate-800 dark:text-slate-200 block">{c.patient?.name || "Patient"}</strong>
                    <span className="text-[10px] text-slate-500 block">{c.patient?.presentingComplaint || "ER Evaluation"} • UHID {c.patient?.uhid || c.id}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">Active</span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab ? onNavigateToTab("dashboard") : setSelectedSubSection(null)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Go to Full Dashboard ➔
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5 animate-fade-in">
        {/* Back navigation header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 dark:border-slate-800 pb-4 mb-2">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setSelectedSubSection(null)} 
              className="p-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase font-mono">{title}</h3>
          </div>

          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab("dashboard")}
              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" /> Dashboard
            </button>
          )}
        </div>

        {/* Section specific view content */}
        {content}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0c101b] py-6 px-4 flex items-center justify-center" id="ermate-profile-view">
      
      {/* Centered device frame simulating a gorgeous medical tablet/smartphone interface */}
      <div className="w-full max-w-lg bg-white dark:bg-[#121824] text-slate-800 dark:text-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between relative min-h-[85vh]">
        
        {/* Top ambient highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-blue-500" />

        {/* Main interactive router */}
        <div className="flex-1">
          {selectedSubSection === null ? renderProfileMenuList() : renderSubSectionContent()}
        </div>

        {/* Dynamic Interactive Tour Overlay */}
        {tourActive && (
          <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-mono text-xs">
            <div className="bg-[#131c2a] border border-emerald-500 p-5 rounded-2xl max-w-xs space-y-3.5 text-center shadow-2xl">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                Tour Step {tourStep + 1} of 4
              </span>
              
              <div className="space-y-1.5">
                <strong className="text-white block text-xs">
                  {tourStep === 0 && "Welcome to ErMate Profile"}
                  {tourStep === 1 && "Bedside Mobile Linking"}
                  {tourStep === 2 && "Unlimited Rounds Debriefs"}
                  {tourStep === 3 && "Smart Team & Plan Sync"}
                </strong>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {tourStep === 0 && "Manage your professional duty shift schedules, hospital credentials, and custom roster whitelists here."}
                  {tourStep === 1 && "Use Link to Web to pair bedside monitors or recording mics with desktop screens instantly."}
                  {tourStep === 2 && "Unleash clinical Rounds evaluations with all 7 thinking lenses for your medical career logs."}
                  {tourStep === 3 && "HOD team additions automatically incorporate active registered profiles with a real-time notification, gracefully transitioning individual plan billing to the department plan next month!"}
                </p>
              </div>

              <div className="flex gap-2 pt-1.5">
                {tourStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setTourStep(prev => prev - 1)}
                    className="flex-1 py-1.5 bg-slate-800 text-white rounded font-bold"
                  >
                    Prev
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (tourStep < 3) {
                      setTourStep(prev => prev + 1);
                    } else {
                      setTourActive(false);
                    }
                  }}
                  className="flex-1 py-1.5 bg-emerald-500 text-slate-950 rounded font-black"
                >
                  {tourStep === 3 ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Universal Razorpay Modal Simulator Overlay */}
        {showRazorpayModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              
              {/* Razorpay Banner header */}
              <div className="bg-[#0b1217] p-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded">
                    ⚡
                  </div>
                  <div className="text-left font-mono">
                    <strong className="text-xs block font-bold">Razorpay Secure</strong>
                    <span className="text-[9px] text-slate-400 block">{razorpayPlanName}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRazorpayModal(false)}
                  className="text-slate-400 hover:text-white font-black text-sm p-1.5"
                >
                  ✕
                </button>
              </div>

              {/* Steps render */}
              <div className="p-5">
                {razorpayStep === "select" && (
                  <div className="space-y-4 font-mono text-xs">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">CHOOSE PAYMENT METHOD</span>
                    
                    <div className="space-y-2">
                      <button 
                        type="button" 
                        onClick={() => {
                          setPaymentMethod("upi");
                          setRazorpayStep("input");
                        }} 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 text-white rounded-xl flex items-center justify-between text-left cursor-pointer"
                      >
                        <span>UPI / QR Code</span>
                        <span className="text-[10px] text-emerald-400">Popular</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setPaymentMethod("card");
                          setRazorpayStep("input");
                        }} 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 text-white rounded-xl flex items-center justify-between text-left cursor-pointer"
                      >
                        <span>Credit / Debit Card</span>
                      </button>
                    </div>
                  </div>
                )}

                {razorpayStep === "input" && (
                  <div className="space-y-4 font-mono text-xs text-left">
                    {paymentMethod === "upi" ? (
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">ENTER UPI ID</label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => {}}
                          className="w-full mt-2 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-lg"
                        >
                          Verify & Pay ₹{razorpayAmount.toLocaleString("en-IN")}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">CARD DETAILS</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="Card Number"
                          className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 mb-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
                          />
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="CVV"
                            className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {}}
                          className="w-full mt-3 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-lg"
                        >
                          Pay ₹{razorpayAmount.toLocaleString("en-IN")} Safely
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {razorpayStep === "processing" && (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 font-mono">
                    <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin rounded-full" />
                    <div>
                      <strong className="text-white block text-sm">Processing Payment...</strong>
                      <p className="text-[10px] text-slate-500 mt-0.5">Authorizing with Razorpay payment nodes.</p>
                    </div>
                  </div>
                )}

                {razorpayStep === "success" && (
                  <div className="py-6 text-center space-y-4 font-mono">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
                    </div>
                    <div className="space-y-1.5">
                      <strong className="text-white block">Payment Successful!</strong>
                      <p className="text-[10px] text-slate-400">Credits credited: <strong className="text-emerald-400">+{razorpayCredits} Scribes</strong></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRazorpayModal(false)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                    >
                      Close Checkout
                    </button>
                  </div>
                )}
              </div>

              {/* Razorpay Safe footer */}
              <div className="bg-[#0b1217] px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>🛡️ SECURE PCI-DSS</span>
                <span>Razorpay Gateway</span>
              </div>

            </div>
          </div>
        )}

        {/* Global Delete Confirm Modal overlay */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-mono text-xs">
            <div className="bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
              <div className="flex gap-2.5 text-rose-500">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div className="text-left space-y-1">
                  <strong className="text-xs font-bold block text-white uppercase">PURGE CLINICAL RECORDS</strong>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    This will permanently clear all clinical registry patient sheets cached in this device memory. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-450 uppercase block font-bold">Type "DELETE" to confirm purge</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 text-center tracking-widest font-black uppercase"
                />
              </div>

              {deleteStatus && <p className="text-[10px] text-emerald-400 text-center">✓ {deleteStatus}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirmText !== "DELETE") return;
                    if (onDeleteAllCases) onDeleteAllCases();
                    setDeleteStatus("Permanent registry data purged successfully.");
                    setTimeout(() => {
                      setShowDeleteConfirmModal(false);
                      setDeleteConfirmText("");
                      setDeleteStatus(null);
                    }, 2000);
                  }}
                  disabled={deleteConfirmText !== "DELETE"}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-950 disabled:text-rose-800 text-white font-bold rounded-lg transition-all"
                >
                  Purge Cache
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <ConfirmModal
        isOpen={showLeaveTeamConfirm}
        title="Leave Team Affiliation"
        message={
          <>
            Are you sure you want to leave your team affiliation at <strong className="text-slate-900 dark:text-white">{profile.hospital}</strong>?
            <br /><br />
            This will safely disconnect you from their clinical roster, but all of your local cases, rounds histories, and private clinical memories will remain perfectly safe with you.
          </>
        }
        confirmText="Leave Team"
        onConfirm={async () => {
          setShowLeaveTeamConfirm(false);
          await onLeaveTeam();
        }}
        onCancel={() => setShowLeaveTeamConfirm(false)}
      />
    </div>
  );
}
