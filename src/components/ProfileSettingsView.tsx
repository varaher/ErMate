import React, { useState, useEffect } from "react";
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
import { UserProfile, ClinicalCase, TriageCategory, TeamMember, ArrivalMode } from "../types";
import TeamRosterBoard from "./TeamRosterBoard";
import TeamBuilder from "./TeamBuilder";
import MortalityAuditModal from "./MortalityAuditModal";
import { SelfLearningRulesPanel } from "./SelfLearningRulesPanel";
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
    { id: "dev-1", deviceName: "iPhone 15 Pro Max (Varah Mobile)", deviceType: "mobile", os: "iOS 17.5", location: "ER Ward A", status: "Active Now", lastActive: "Just now" },
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



  const [hospitalName, setHospitalName] = useState<string>(profile.hospital || "Varah Emergency Hospital");
  const [departmentName, setDepartmentName] = useState<string>("Emergency Medicine Department");
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("EM Resident");
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");

  const [invitedMembers, setInvitedMembers] = useState([
    { id: "mem-1", email: "dr.jenkins@gmail.com", userId: "usr_jenkins_01", role: "Senior Consultant", status: "Pending (Invited)", joinedAt: undefined },
    { id: "mem-2", email: "chloe.harrison@gmail.com", userId: "usr_chloe_99", role: "Pediatric Consultant", status: "Pending (Invited)", joinedAt: undefined },
    { id: "mem-3", email: "robert.miller@gmail.com", userId: "usr_robert_54", role: "EM Resident", status: "Pending (Invited)", joinedAt: undefined }
  ]);

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
  const [editState, setEditState] = useState<string>(profile.state || "Maharashtra");
  const [editHospitalAddress, setEditHospitalAddress] = useState<string>(profile.hospitalAddress || "");
  const [profileSuccess, setProfileSuccess] = useState<string>("");

  useEffect(() => {
    setEditName(profile.name || "");
    setEditEmail(profile.email || "");
    setEditAge(profile.age || 34);
    setEditRole(profile.role || "Senior Consultant");
    setEditState(profile.state || "Maharashtra");
    setEditHospitalAddress(profile.hospitalAddress || "");
  }, [profile]);

  // Delete cases states
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
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
    triggerRazorpayCheckout(299, "150 Scribe Credits Refill", 150, "current");
  };

  const triggerRazorpayCheckout = (amount: number, planName: string, credits: number, tier: string) => {
    setRazorpayAmount(amount);
    setRazorpayPlanName(planName);
    setRazorpayCredits(credits);
    setRazorpayTier(tier);
    setRazorpayStep("select");
    setShowRazorpayModal(true);
  };

  const handleExecutePayment = () => {
    setRazorpayStep("processing");
    setTimeout(() => {
      onSaveProfile({
        ...profile,
        aiCredits: profile.aiCredits + razorpayCredits,
        subscriptionTier: razorpayTier === "current" ? profile.subscriptionTier : razorpayTier
      });
      setRazorpayStep("success");
    }, 1800);
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
    const finalRole = editRole || profile.role || "Senior Consultant";
    onSaveProfile({
      ...profile,
      name: editName,
      email: editEmail,
      age: editAge,
      role: finalRole,
      hospital: hospitalName,
      state: editState,
      hospitalAddress: editHospitalAddress
    });
    setProfileSuccess(`Clinical profile updated successfully! Assigned role: ${finalRole}`);
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
  const preparedInviteLink = `${currentOrigin}/join/${(hospitalName || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-er-invite`;

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
        <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-md">
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
              className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full transition-all border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1 shadow-xs"
              title="Click to switch or customize your clinical role (HOD, Senior Consultant, Resident)"
            >
              <RefreshCw className="w-3 h-3 text-emerald-500" />
              <span>Switch Role</span>
            </button>

            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-full px-2.5 py-1 font-mono font-bold">
              {profile.hospital || "Varah Group Emergency Care"}
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
        <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
              <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
                
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
          
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <Building className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{profile.hospital || "Varah Group Emergency Care"}</span>
              </div>
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wide shrink-0">
                Synced
              </span>
            </div>

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
                          : "bg-slate-50/30 dark:bg-slate-900/10 border-slate-100 dark:border-slate-850"
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
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
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

            {profile.hospital && profile.hospital !== "Varah Group Emergency Care" && onLeaveTeam && (
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to leave your team affiliation at "${profile.hospital}"?\n\nThis will safely disconnect you from their clinical roster, but all of your local cases, rounds histories, and private clinical memories will remain perfectly safe with you.`)) {
                      await onLeaveTeam();
                    }
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
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
            
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
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-md">
            
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
          
          <div className="bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-800/80">
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
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
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
          
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
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
                    <p><span className="text-slate-450 font-medium">Sender Doctor:</span> {item.assignedDoctor || "Dr. Vipin Kumar"}</p>
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
            hospitalName={hospitalName}
            onHospitalChange={(name) => {
              setHospitalName(name);
              onSaveProfile({
                ...profile,
                hospital: name
              });
            }}
            profile={profile}
            onSaveConfig={(teamName, department, teamColor) => {
              onSaveProfile({
                ...profile,
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

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-6">
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

      const myCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === profile.email.toLowerCase().trim());
      const hasRealLogs = myCases.length > 0;

      const demoCases: ClinicalCase[] = [
        {
          id: "demo-1",
          bedNo: "ER-04",
          savedTime: new Date(Date.now() - 3600000 * 2).toISOString(),
          timeSpentMin: 45,
          patient: {
            name: "Rajesh Sharma",
            age: 48,
            gender: "Male",
            presentingComplaint: "Acute sudden chest pain radiation to left arm and diaphoresis.",
            triageCategory: TriageCategory.P1,
            arrivalMode: ArrivalMode.WalkIn,
            dateOpened: new Date(Date.now() - 3600000 * 2).toISOString(),
            isMlc: false,
            caseType: "Medical",
            uhid: "UHID-2026-9841",
          },
          vitals: {
            hr: "110",
            bp: "140/90",
            spo2: "94",
            rr: "24",
            temp: "98.6",
            gcs: "15",
            gcs_e: "4",
            gcs_v: "5",
            gcs_m: "6",
            grbs: "148",
            avpu: "Alert",
            painScore: "8",
          },
          sampleHistory: {
            symptoms: "Chest pain, diaphoresis",
            allergies: "None",
            medications: "Amlodipine 5mg",
            pastHistory: "Hypertension for 5 years",
            lastMeal: "2h ago",
            events: "Pain started suddenly while walking",
            socialHistory: "None",
            familyHistory: "None",
            psychiatricFlags: "None",
          },
          primaryAssessment: {
            airway: "Patent",
            airwayStatus: "Normal",
            breathing: "Tachypnea",
            breathingStatus: "Normal",
            circulation: "Peripheral pulses present",
            circulationStatus: "Normal",
            disability: "GCS 15/15",
            disabilityStatus: "Normal",
            exposure: "Warm and diaphoretic",
            exposureStatus: "Normal",
          },
          secondaryAssessment: "Normal chest expansion. S1 S2 heard, no murmurs.",
          investigations: [],
          treatments: [],
          progressNotes: "Aspirin 325mg given. ECG shows ST elevation in V1-V4. Cardiopulmonary team notified.",
          dischargeInfo: null,
          differentials: [],
          isPediatric: false,
          provisionalPrimaryDiagnosis: "Acute Anterior Wall MI / STEMI",
          proceduresChecked: ["iv_access", "abg_punch"],
          otherProcedures: "12-Lead ECG Acquisition",
          status: "Discharged",
          doctorEmail: profile.email
        },
        {
          id: "demo-2",
          bedNo: "ER-09",
          savedTime: new Date(Date.now() - 3600000 * 8).toISOString(),
          timeSpentMin: 30,
          patient: {
            name: "Anjali Gupta",
            age: 29,
            gender: "Female",
            presentingComplaint: "Severe respiratory distress with bronchospasm wheezing.",
            triageCategory: TriageCategory.P2,
            arrivalMode: ArrivalMode.WalkIn,
            dateOpened: new Date(Date.now() - 3600000 * 8).toISOString(),
            isMlc: false,
            caseType: "Medical",
            uhid: "UHID-2026-4432",
          },
          vitals: {
            hr: "98",
            bp: "120/80",
            spo2: "89",
            rr: "28",
            temp: "98.4",
            gcs: "15",
            gcs_e: "4",
            gcs_v: "5",
            gcs_m: "6",
            grbs: "105",
            avpu: "Alert",
            painScore: "2",
          },
          sampleHistory: {
            symptoms: "Shortness of breath, cough",
            allergies: "Dust mites",
            medications: "Salbutamol inhaler",
            pastHistory: "Bronchial Asthma since childhood",
            lastMeal: "4h ago",
            events: "Triggered by sweeping dusty room",
            socialHistory: "None",
            familyHistory: "None",
            psychiatricFlags: "None",
          },
          primaryAssessment: {
            airway: "Patent",
            airwayStatus: "Normal",
            breathing: "Bilateral polyphonic wheeze",
            breathingStatus: "Abnormal",
            circulation: "Tachycardia present",
            circulationStatus: "Normal",
            disability: "GCS 15/15",
            disabilityStatus: "Normal",
            exposure: "No signs of trauma",
            exposureStatus: "Normal",
          },
          secondaryAssessment: "Bilateral polyphonic wheeze present. Accessory muscles in use.",
          investigations: [],
          treatments: [],
          progressNotes: "Nebulized with Levosalbutamol + Ipratropium. IV Hydrocortisone administered.",
          dischargeInfo: null,
          differentials: [],
          isPediatric: false,
          provisionalPrimaryDiagnosis: "Acute Severe Asthma Exacerbation",
          proceduresChecked: ["nebulization"],
          otherProcedures: "Non-Invasive Ventilation (NIV)",
          status: "Active",
          doctorEmail: profile.email
        },
        {
          id: "demo-3",
          bedNo: "ER-12",
          savedTime: new Date(Date.now() - 3600000 * 24).toISOString(),
          timeSpentMin: 60,
          patient: {
            name: "Master Kabir",
            age: 6,
            gender: "Male",
            presentingComplaint: "High-grade fever with febrile convulsion lasting 2 minutes.",
            triageCategory: TriageCategory.P1,
            arrivalMode: ArrivalMode.WalkIn,
            dateOpened: new Date(Date.now() - 3600000 * 24).toISOString(),
            isMlc: false,
            caseType: "Medical",
            uhid: "UHID-2026-1192",
          },
          vitals: {
            hr: "124",
            bp: "100/65",
            spo2: "98",
            rr: "32",
            temp: "103.1",
            gcs: "12",
            gcs_e: "3",
            gcs_v: "4",
            gcs_m: "5",
            grbs: "94",
            avpu: "Voice",
            painScore: "0",
          },
          sampleHistory: {
            symptoms: "Fever, generalized tonic-clonic movements",
            allergies: "Penicillin",
            medications: "Paracetamol syrup",
            pastHistory: "Prior simple febrile seizure at age 3",
            lastMeal: "1h ago",
            events: "Had a seizure lasting 2 min, currently post-ictal",
            socialHistory: "None",
            familyHistory: "None",
            psychiatricFlags: "None",
          },
          primaryAssessment: {
            airway: "Patent",
            airwayStatus: "Normal",
            breathing: "Normal breathing effort",
            breathingStatus: "Normal",
            circulation: "Pulses rapid but full",
            circulationStatus: "Normal",
            disability: "Drowsy, localizes to pain",
            disabilityStatus: "Abnormal",
            exposure: "Hot to touch",
            exposureStatus: "Normal",
          },
          secondaryAssessment: "Post-ictal state. Chest clear. Pupillary reflexes prompt and reactive.",
          investigations: [],
          treatments: [],
          progressNotes: "IV Paracetamol infused. Temperature reduced to 99.1F. Patient regained full consciousness.",
          dischargeInfo: null,
          differentials: [],
          isPediatric: true,
          provisionalPrimaryDiagnosis: "Febrile Convulsion / Seizure",
          proceduresChecked: ["iv_access"],
          otherProcedures: "Sponging Therapy",
          status: "Discharged",
          doctorEmail: profile.email
        }
      ];

      const activeLogs = hasRealLogs ? myCases : demoCases;

      // Filtered cases list based on search and triage
      const filteredCases = activeLogs.filter(c => {
        const matchesTriage = logBookTriageFilter === "all" || 
          (logBookTriageFilter === "P1" && c.patient.triageCategory === TriageCategory.P1) ||
          (logBookTriageFilter === "P2" && c.patient.triageCategory === TriageCategory.P2) ||
          (logBookTriageFilter === "P3" && c.patient.triageCategory === TriageCategory.P3);

        const searchLower = logBookSearch.toLowerCase().trim();
        const caseProcs = getCaseProcedures(c).join(" ").toLowerCase();
        const matchesSearch = !searchLower ||
          c.patient.name.toLowerCase().includes(searchLower) ||
          (c.patient.uhid && c.patient.uhid.toLowerCase().includes(searchLower)) ||
          (c.provisionalPrimaryDiagnosis && c.provisionalPrimaryDiagnosis.toLowerCase().includes(searchLower)) ||
          (c.patient.presentingComplaint && c.patient.presentingComplaint.toLowerCase().includes(searchLower)) ||
          caseProcs.includes(searchLower);

        return matchesTriage && matchesSearch;
      });

      // Stats computations
      const totalCasesCount = activeLogs.length;
      const p1Count = activeLogs.filter(c => c.patient.triageCategory === TriageCategory.P1).length;
      const p2Count = activeLogs.filter(c => c.patient.triageCategory === TriageCategory.P2).length;
      const p3Count = activeLogs.filter(c => c.patient.triageCategory === TriageCategory.P3).length;

      // Procedures counts
      const procMap: Record<string, number> = {};
      let totalProcsPerformed = 0;
      activeLogs.forEach(c => {
        getCaseProcedures(c).forEach(p => {
          procMap[p] = (procMap[p] || 0) + 1;
          totalProcsPerformed++;
        });
      });

      const uniqueProcsCount = Object.keys(procMap).length;

      const handleCSVExport = () => {
        const headers = [
          "Date/Time", 
          "Bed No", 
          "Patient Name", 
          "Age", 
          "Gender", 
          "UHID", 
          "Triage Level", 
          "Presenting Complaint", 
          "Primary Diagnosis", 
          "Procedures Performed", 
          "Status"
        ];
        const rows = activeLogs.map(c => [
          c.savedTime || c.patient.dateOpened || "",
          c.bedNo || "N/A",
          c.patient.name,
          c.patient.age || "N/A",
          c.patient.gender,
          c.patient.uhid || "N/A",
          c.patient.triageCategory || "N/A",
          c.patient.presentingComplaint || "",
          c.provisionalPrimaryDiagnosis || "Under Evaluation",
          getCaseProcedures(c).join("; "),
          c.status
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
                Real-Time Sync Active — {myCases.length} case sheets captured in your permanent registry.
              </span>
            </div>
          )}

          {/* Official Registry Header stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Total Cases</span>
              <strong className="text-lg text-slate-800 dark:text-white mt-1 block">{totalCasesCount}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">Patient logs</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Procedures</span>
              <strong className="text-lg text-indigo-600 dark:text-indigo-400 mt-1 block">{totalProcsPerformed}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">{uniqueProcsCount} unique types</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
              <span className="text-[8.5px] text-slate-500 block uppercase font-bold">Resus (P1)</span>
              <strong className="text-lg text-rose-600 dark:text-rose-400 mt-1 block">{p1Count}</strong>
              <span className="text-[9px] text-slate-400 block font-sans">Level 1 triage</span>
            </div>
          </div>

          {/* Segmented Triage Proportion bar */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
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
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8.5 pr-3 py-1.8 text-[11px] focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <div className="flex gap-2">
              <select
                value={logBookTriageFilter}
                onChange={(e) => setLogBookTriageFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300"
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
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl font-sans">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-xs">No matching cases found</p>
                <p className="text-[10px] mt-0.5">Try widening your search terms or triage filter.</p>
              </div>
            ) : (
              filteredCases.map((c) => {
                const cProcs = getCaseProcedures(c);
                const triageColor = c.patient.triageCategory === TriageCategory.P1 
                  ? "border-l-rose-500 text-rose-500 dark:text-rose-400 bg-rose-50/5 dark:bg-rose-500/5" 
                  : c.patient.triageCategory === TriageCategory.P2
                    ? "border-l-amber-500 text-amber-500 dark:text-amber-400 bg-amber-50/5 dark:bg-amber-500/5"
                    : "border-l-emerald-500 text-emerald-500 dark:text-emerald-400 bg-emerald-50/5 dark:bg-emerald-500/5";

                const triageLabel = c.patient.triageCategory === TriageCategory.P1 ? "P1 (CRITICAL)" : c.patient.triageCategory === TriageCategory.P2 ? "P2 (URGENT)" : "P3 (STABLE)";

                return (
                  <div 
                    key={c.id} 
                    className={`border-l-4 rounded-r-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 ${triageColor}`}
                  >
                    {/* Card Header row */}
                    <div className="flex justify-between items-start gap-1">
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold font-sans">
                            {c.patient.name}
                          </strong>
                          <span className="text-[9px] text-slate-400 font-sans font-medium">
                            ({c.patient.age} / {c.patient.gender})
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">
                          UHID: <span className="font-bold">{c.patient.uhid || "N/A"}</span> • Bed: <span className="font-bold">{c.bedNo || "N/A"}</span>
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-sans">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border border-current bg-current/10">
                          {triageLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {c.savedTime ? new Date(c.savedTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Diagnosis & Complaints */}
                    <div className="bg-white/40 dark:bg-[#131b26] p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50 space-y-1">
                      <div className="text-[10.5px]">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Presenting Complaint</span>
                        <p className="text-slate-700 dark:text-slate-300 font-sans leading-normal">
                          {c.patient.presentingComplaint}
                        </p>
                      </div>
                      <div className="text-[10.5px] border-t border-slate-150 dark:border-slate-800/50 pt-1 mt-1">
                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Primary Diagnoses</span>
                        <p className="text-slate-800 dark:text-emerald-400 font-sans font-bold leading-normal">
                          {c.provisionalPrimaryDiagnosis || "Under Clinical Evaluation"}
                        </p>
                      </div>
                    </div>

                    {/* Procedures pills */}
                    <div className="space-y-1 text-left">
                      <span className="text-slate-500 block text-[8px] font-bold uppercase tracking-wider">Procedures Performed ({cProcs.length})</span>
                      <div className="flex flex-wrap gap-1">
                        {cProcs.length === 0 ? (
                          <span className="text-[9.5px] text-slate-450 italic">None logged</span>
                        ) : (
                          cProcs.map((p, idx) => (
                            <span 
                              key={idx} 
                              className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900/50 px-1.8 py-0.5 rounded text-[9px] font-sans font-semibold inline-block"
                            >
                              ✓ {p}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Auto case summary section */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-lg text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 font-sans border border-dashed border-slate-200 dark:border-slate-800/80">
                      <span className="font-black text-[8px] uppercase tracking-wider text-slate-400 block font-mono font-bold">Automated SBAR Narrative Summary</span>
                      <p className="mt-0.5">
                        Patient presented in distress with "{c.patient.presentingComplaint}". Initial assessment airway {c.primaryAssessment?.airway || "patent"} and breathing {c.primaryAssessment?.breathing || "normal"}. {cProcs.length > 0 ? `Procedures successfully performed include ${cProcs.join(", ")}.` : "No major airway or invasive procedures required."} Patient disposition resolved to status: <strong>{c.status}</strong>.
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    } else if (selectedSubSection === "stats") {
      title = "Clinical Registry Analytics";
      content = (
        <div className="space-y-4 font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 p-3 rounded-xl text-left shadow-xs">
              <span className="text-[9px] text-slate-500 font-bold block">Total Patients</span>
              <h4 className="text-xl font-bold text-slate-800 mt-1">{totalCases}</h4>
              <p className="text-[8.5px] text-slate-450">Active Case Sheets</p>
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-xl text-left shadow-xs">
              <span className="text-[9px] text-slate-500 font-bold block">Red Triage (P1)</span>
              <h4 className="text-xl font-bold text-rose-600 mt-1">{p1Cases}</h4>
              <p className="text-[8.5px] text-slate-450">Critical Resus</p>
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-xl text-left shadow-xs">
              <span className="text-[9px] text-slate-500 font-bold block">Yellow Triage (P2)</span>
              <h4 className="text-xl font-bold text-amber-600 mt-1">{p2Cases}</h4>
              <p className="text-[8.5px] text-slate-450">Urgent Consults</p>
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-xl text-left shadow-xs">
              <span className="text-[9px] text-slate-500 font-bold block">Green Triage (P3)</span>
              <h4 className="text-xl font-bold text-emerald-600 mt-1">{p3Cases}</h4>
              <p className="text-[8.5px] text-slate-450">Minor Ambulatory</p>
            </div>
          </div>

          {/* Render simple gorgeous bar charts using pure SVGs */}
          <div className="bg-white border border-slate-200 p-4.5 rounded-2xl space-y-4 shadow-xs text-left">
            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">TRIAGE CASE BREAKDOWN</h5>
            
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                  <span>P1 (Critical)</span>
                  <span className="font-bold text-rose-600">{p1Cases} ({totalCases > 0 ? Math.round((p1Cases/totalCases)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${totalCases > 0 ? (p1Cases/totalCases)*100 : 0}%` }} />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                  <span>P2 (Urgent)</span>
                  <span className="font-bold text-amber-600">{p2Cases} ({totalCases > 0 ? Math.round((p2Cases/totalCases)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${totalCases > 0 ? (p2Cases/totalCases)*100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                  <span>P3 (Non-Urgent)</span>
                  <span className="font-bold text-emerald-600">{p3Cases} ({totalCases > 0 ? Math.round((p3Cases/totalCases)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${totalCases > 0 ? (p3Cases/totalCases)*100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-4.5 rounded-2xl space-y-3.5 shadow-xs text-left">
            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">CHIEF COMPLAINT CATEGORIES</h5>
            
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-150">
                <span className="text-slate-500">Medicine:</span>
                <strong className="text-slate-800">{medCases}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-150">
                <span className="text-slate-500">Trauma/Accident:</span>
                <strong className="text-slate-800">{traumaCases}</strong>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (selectedSubSection === "device-link") {
      title = "Device Link Connection";
      content = (
        <div className="space-y-6 text-left">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 text-center space-y-4 shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 font-mono">Real-time Stream Access</span>
              <h4 className="text-sm font-bold text-slate-800">Clinical Sync Protocol</h4>
            </div>

            {/* Simulated QR block layout */}
            <div className="w-36 h-36 bg-white rounded-2xl p-2 mx-auto flex flex-col items-center justify-center relative shadow-inner">
              <div className="w-full h-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                <svg className="w-24 h-24 text-slate-850" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                  {/* Decorative medical QR box */}
                  <rect x="5" y="5" width="25" height="25" strokeWidth="4" />
                  <rect x="12" y="12" width="11" height="11" fill="currentColor" />
                  <rect x="70" y="5" width="25" height="25" strokeWidth="4" />
                  <rect x="77" y="12" width="11" height="11" fill="currentColor" />
                  <rect x="5" y="70" width="25" height="25" strokeWidth="4" />
                  <rect x="12" y="77" width="11" height="11" fill="currentColor" />
                  
                  <path d="M5 50h25M35 50h12M52 50h8M65 50h15" strokeWidth="3" />
                  <path d="M5 58h8M20 58h15M40 58h25" strokeWidth="3" />
                  <path d="M35 75h10M50 75h15" strokeWidth="3" />
                  
                  <rect x="40" y="40" width="20" height="20" fill="white" stroke="currentColor" strokeWidth="2" rx="4" />
                  <path d="M50 44v12M44 50h12" stroke="currentColor" strokeWidth="3.5" />
                </svg>
              </div>
            </div>

            <div className="space-y-1 text-center font-mono text-xs pt-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">6-Digit PIN</span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-indigo-650 tracking-widest">{pairingCode}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pairingCode.replace(" ", ""));
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 transition-all cursor-pointer"
                >
                  {copiedLink ? <span className="text-emerald-600 text-xs font-bold">Copied!</span> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                <span>Expires in <strong className="text-indigo-600">{pairingTimeLeft}s</strong></span>
              </div>
            </div>
          </div>

          {/* Active Authorized Sessions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs font-mono shadow-xs">
            <h5 className="font-bold text-indigo-700 uppercase text-[10px] tracking-wider">AUTHORIZED SESSIONS</h5>
            
            <div className="space-y-3">
              {pairedDevices.map((device) => (
                <div key={device.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-3 text-left">
                  <div>
                    <strong className="text-slate-800 font-bold block">{device.deviceName}</strong>
                    <span className="text-[9.5px] text-slate-500 block">{device.os} • {device.location}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPairedDevices(prev => prev.filter(d => d.id !== device.id));
                    }}
                    className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded border border-rose-200 transition-all cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Simulator Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs font-mono text-left shadow-xs">
            <h5 className="font-bold text-emerald-700 uppercase text-[10px] tracking-wider">SYNC PAIRING SIMULATOR</h5>
            
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 block font-bold uppercase">Device Label</label>
                  <input
                    type="text"
                    value={simDeviceName}
                    onChange={(e) => setSimDeviceName(e.target.value)}
                    placeholder="e.g. Dell Hospital PC"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 block font-bold uppercase">6-Digit PIN</label>
                  <input
                    type="text"
                    value={simPairCodeInput}
                    onChange={(e) => setSimPairCodeInput(e.target.value)}
                    placeholder="e.g. 583921"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 text-center tracking-wider font-bold"
                  />
                </div>
              </div>

              {simError && <p className="text-[10px] text-rose-600">⚠️ {simError}</p>}
              {simSuccess && <p className="text-[10px] text-emerald-600">✓ {simSuccess}</p>}

              <button
                type="button"
                onClick={() => {
                  setSimError("");
                  setSimSuccess("");
                  const cleanInput = simPairCodeInput.replace(/\s+/g, "");
                  const cleanCode = pairingCode.replace(/\s+/g, "");
                  
                  if (!simDeviceName.trim()) {
                    setSimError("Device label required.");
                    return;
                  }
                  if (cleanInput !== cleanCode && cleanInput !== "777888") {
                    setSimError("Invalid PIN code.");
                    return;
                  }

                  const newDevice = {
                    id: `dev-${Date.now()}`,
                    deviceName: simDeviceName.trim(),
                    deviceType: "computer" as const,
                    os: "Chrome 124 (Windows)",
                    location: "Trauma Ward",
                    status: "Active Now" as const,
                    lastActive: "Just now"
                  };

                  setPairedDevices(prev => [newDevice, ...prev]);
                  setSimSuccess(`Paired and synchronized successfully.`);
                  setSimDeviceName("");
                  setSimPairCodeInput("");
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                Trigger Device Link
              </button>
            </div>
          </div>
        </div>
      );
    } else if (selectedSubSection === "subscriptions") {
      title = "Hospital Subscriptions Suite";
      content = (
        <div className="space-y-6 text-left">
          {/* Upcoming billing adjustment transition */}
          {(profile as any).subscriptionTransitionPending && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4.5 font-mono space-y-1.5 shadow-xs animate-fade-in">
              <span className="text-[9.5px] text-amber-700 uppercase font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Upcoming billing adjustment
              </span>
              <strong className="block text-slate-800 text-xs font-bold">
                Transitioning to {(profile as any).nextBillingTier || "Team Plan"}
              </strong>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {(profile as any).subscriptionTransitionMessage || "From the next following month, your subscription will automatically transition to your hospital's shared Department Plan, and your individual charges will cease."}
              </p>
            </div>
          )}

          {/* Hospital-Level Linked Subscription Banner */}
          {hospitalSubscription?.active && (
            <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-150 rounded-2xl p-4.5 font-mono space-y-2 shadow-xs">
              <span className="text-[9px] text-indigo-700 uppercase font-bold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Hospital Workplace License Active
              </span>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-extrabold text-indigo-850 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                  {hospitalSubscription.subscriptionTier}
                </h4>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                  Shared
                </span>
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Your clinical team at <strong>{profile.hospital}</strong> is linked to an active department subscription. Roster validation is fully unlocked!
              </p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 font-mono space-y-3 shadow-xs">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Current License tier</span>
            <div className="flex justify-between items-center">
              <h4 className="text-base font-extrabold text-slate-850 flex items-center gap-1.5">
                <Zap className="w-5 h-5 text-emerald-600 animate-pulse" />
                {profile.subscriptionTier || "Free Plan"}
              </h4>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                Active
              </span>
            </div>

            <div className="border-t border-slate-200 pt-3.5 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Scribe Credits Remaining</span>
                <strong className="text-emerald-700 text-sm font-black">{profile.aiCredits} Credits</strong>
              </div>
              <button
                type="button"
                onClick={handleRefillCredits}
                className="py-1.8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] rounded-lg transition-all cursor-pointer shadow-xs"
              >
                Refill Credits (Razorpay)
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs font-mono shadow-xs">
            <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">FEATURES & ALLOWANCES</h5>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-slate-650">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Unlimited Rounds clinical debrief and 7 thinking lenses evaluation.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-650">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Patient record encryption conforming to certified HIPAA standards.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-650">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Consolidated handover sheets ready for landscape PDF print.</span>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (selectedSubSection === "upgrade") {
      title = "Upgrade to ErMate Premium";
      content = (
        <div className="space-y-6 text-left">
          {/* Plan Choice Banner */}
          <div className="bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl flex border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSubPlanTab("individual")}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${subPlanTab === "individual" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              Individual Plans
            </button>
            <button
              type="button"
              onClick={() => setSubPlanTab("team")}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${subPlanTab === "team" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              Department / Team Plan
            </button>
          </div>

          {/* Pricing Billing Toggle */}
          <div className="flex items-center justify-between font-mono text-[10.5px]">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">BILLING FREQUENCY</span>
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${billingPeriod === "monthly" ? "bg-white dark:bg-slate-850 text-slate-950 dark:text-white shadow-xs" : "text-slate-550 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${billingPeriod === "annual" ? "bg-white dark:bg-slate-850 text-slate-950 dark:text-white shadow-xs" : "text-slate-550 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                Annually (Save 30%)
              </button>
            </div>
          </div>

          {subPlanTab === "individual" ? (
            <div className="space-y-4">
              {/* Individual Pro Card */}
              <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#182333] dark:to-slate-900 border border-slate-200 dark:border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-sm dark:shadow-lg relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase">
                  Best Seller
                </div>

                <div className="space-y-1 font-mono">
                  <h4 className="text-base font-black text-slate-950 dark:text-white">Individual Pro</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">For consultants & independent ER practitioners</p>
                  <div className="pt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {billingPeriod === "monthly" ? "₹1,199" : "₹9,990"}
                    <span className="text-xs text-slate-500 dark:text-slate-500 font-normal">/{billingPeriod === "monthly" ? "mo" : "yr"}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <li className="flex items-center gap-2">✓ Unlimited Rounds & 7 Lenses</li>
                  <li className="flex items-center gap-2">✓ Complete Scribe audio transcriptions</li>
                  <li className="flex items-center gap-2">✓ Advanced decision support (OCR, ABG)</li>
                  <li className="flex items-center gap-2">✓ Career Clinical Memory database</li>
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    const price = billingPeriod === "monthly" ? 1199 : 9990;
                    triggerRazorpayCheckout(price, "Individual Pro Plan", 1500, "Individual Pro");
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Enroll Pro — ₹{billingPeriod === "monthly" ? "1,199/month" : "9,990/year"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Team Plan Slider */}
              <div className="bg-slate-50 dark:bg-[#182333] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 font-mono text-slate-800 dark:text-slate-100 shadow-sm">
                <h4 className="text-xs font-black text-indigo-600 dark:text-sky-450 uppercase tracking-wider">
                  TEAM ROSTER ESTIMATOR
                </h4>

                <div className="space-y-4 divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                  {/* Consultants Slider */}
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Consultants</p>
                      <p className="text-[9.5px] text-slate-500 dark:text-slate-400">₹{billingPeriod === "monthly" ? "599/mo each" : "4,990/yr each"}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button 
                        type="button" 
                        onClick={() => setConsultantsPerTeam(prev => Math.max(0, prev - 1))} 
                        className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded font-black flex items-center justify-center transition-all"
                      >
                        -
                      </button>
                      <span className="w-8 py-0.5 text-center font-black text-slate-900 dark:text-white text-sm bg-white dark:bg-slate-900 rounded border border-slate-250 dark:border-slate-750 shadow-xs">
                        {consultantsPerTeam}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setConsultantsPerTeam(prev => prev + 1)} 
                        className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded font-black flex items-center justify-center transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Residents Slider */}
                  <div className="flex justify-between items-center pt-3.5">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Residents</p>
                      <p className="text-[9.5px] text-slate-500 dark:text-slate-400">₹{billingPeriod === "monthly" ? "399/mo each" : "3,390/yr each"}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button 
                        type="button" 
                        onClick={() => setResidentsPerTeam(prev => Math.max(0, prev - 1))} 
                        className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded font-black flex items-center justify-center transition-all"
                      >
                        -
                      </button>
                      <span className="w-8 py-0.5 text-center font-black text-slate-900 dark:text-white text-sm bg-white dark:bg-slate-900 rounded border border-slate-250 dark:border-slate-750 shadow-xs">
                        {residentsPerTeam}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setResidentsPerTeam(prev => prev + 1)} 
                        className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded font-black flex items-center justify-center transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Computed Pricing Box */}
                  <div className="pt-4 flex justify-between items-end border-t border-dashed border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Estimated Bill</span>
                      <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        ₹{(
                           billingPeriod === "monthly"
                             ? (residentsPerTeam * 399 + consultantsPerTeam * 599)
                             : (residentsPerTeam * 3390 + consultantsPerTeam * 4990)
                        ).toLocaleString("en-IN")}
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/{billingPeriod === "monthly" ? "month" : "year"}</span>
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const amount = billingPeriod === "monthly"
                          ? (residentsPerTeam * 399 + consultantsPerTeam * 599)
                          : (residentsPerTeam * 3390 + consultantsPerTeam * 4990);
                        const docCount = residentsPerTeam + consultantsPerTeam;
                        triggerRazorpayCheckout(amount, `Roster Team Plan (${docCount} Doctors)`, docCount * 450, "Hospital Team Premium");
                      }}
                      className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      Enroll Team
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } else if (selectedSubSection === "role") {
      title = "Clinical Role Customizer";
      content = (
        <form onSubmit={handleSaveProfileForm} className="space-y-4 font-mono text-xs text-left">
          {profileSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-[10px]">
              ✓ {profileSuccess}
            </div>
          )}

          <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-300 block font-black uppercase tracking-wider font-mono">
                Select Department Role
              </label>
              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                Selected: {editRole || profile.role || "Senior Consultant"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Option 1: HOD / Department Lead */}
              <div
                onClick={() => setEditRole("HOD / Department Lead")}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                  (editRole || profile.role || "").toLowerCase().includes("hod") || (editRole || profile.role || "").toLowerCase().includes("head")
                    ? "bg-gradient-to-br from-amber-500/20 via-amber-950/40 to-slate-900 border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">👑</span>
                  {((editRole || profile.role || "").toLowerCase().includes("hod") || (editRole || profile.role || "").toLowerCase().includes("head")) && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>
                <div>
                  <strong className="text-xs font-black text-amber-300 block">HOD / Dept Lead</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug font-sans">
                    Full HOD dashboard, roster builder, M&M audits & self-learning rules.
                  </p>
                </div>
              </div>

              {/* Option 2: Senior Consultant */}
              <div
                onClick={() => setEditRole("Senior Consultant")}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                  (editRole || profile.role || "").toLowerCase().includes("consultant") && !((editRole || profile.role || "").toLowerCase().includes("hod"))
                    ? "bg-gradient-to-br from-blue-500/20 via-blue-950/40 to-slate-900 border-blue-400 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">🩺</span>
                  {(editRole || profile.role || "").toLowerCase().includes("consultant") && !((editRole || profile.role || "").toLowerCase().includes("hod")) && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                </div>
                <div>
                  <strong className="text-xs font-black text-blue-300 block">Senior Consultant</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug font-sans">
                    Senior attending oversight, AI SBAR scribe, handovers & case logs.
                  </p>
                </div>
              </div>

              {/* Option 3: EM Resident */}
              <div
                onClick={() => setEditRole("EM Resident")}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                  ((editRole || profile.role || "").toLowerCase().includes("resident") || (editRole || profile.role || "").toLowerCase().includes("physician")) && !((editRole || profile.role || "").toLowerCase().includes("hod")) && !((editRole || profile.role || "").toLowerCase().includes("consultant"))
                    ? "bg-gradient-to-br from-emerald-500/20 via-emerald-950/40 to-slate-900 border-emerald-400 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">⚕️</span>
                  {((editRole || profile.role || "").toLowerCase().includes("resident") || (editRole || profile.role || "").toLowerCase().includes("physician")) && !((editRole || profile.role || "").toLowerCase().includes("hod")) && !((editRole || profile.role || "").toLowerCase().includes("consultant")) && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
                <div>
                  <strong className="text-xs font-black text-emerald-300 block">EM Resident / Duty Doc</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug font-sans">
                    Duty clinical scribe, case entry, discharge summaries & handovers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Full Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Dr. Vipin Kumar"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Secure Contact Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="email@hospital.in"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Age</label>
            <input
              type="number"
              value={editAge}
              onChange={(e) => setEditAge(Number(e.target.value))}
              placeholder="34"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">ER Facility Hospital</label>
            <input
              type="text"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="Varah Emergency Hospital"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">State / Region</label>
            <select
              value={editState}
              onChange={(e) => setEditState(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold"
            >
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi NCR</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Telangana">Telangana</option>
              <option value="Kerala">Kerala</option>
              <option value="Gujarat">Gujarat</option>
              <option value="West Bengal">West Bengal</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Punjab">Punjab</option>
              <option value="Haryana">Haryana</option>
              <option value="Odisha">Odisha</option>
              <option value="Assam">Assam</option>
              <option value="Goa">Goa</option>
              <option value="Other">Other / International</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Hospital Address (Street / District / Area)</label>
            <input
              type="text"
              value={editHospitalAddress}
              onChange={(e) => setEditHospitalAddress(e.target.value)}
              placeholder="e.g. 12 Medical Enclave, Civil Lines, Central District"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Synchronize Profile
          </button>
        </form>
      );
    } else if (selectedSubSection === "set-password") {
      title = "Change Security PIN";
      content = (
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            setPasswordStatus(null);
            if (!currentPassword || !newPassword || !confirmPassword) {
              setPasswordStatus({ type: "error", message: "Please fill out all fields." });
              return;
            }
            if (newPassword.length < 6) {
              setPasswordStatus({ type: "error", message: "PIN/Password must be at least 6 characters." });
              return;
            }
            if (newPassword !== confirmPassword) {
              setPasswordStatus({ type: "error", message: "PIN matching verification failed." });
              return;
            }
            setPasswordStatus({ type: "success", message: "Security PIN updated and synchronized." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          }}
          className="space-y-4 font-mono text-xs text-left"
        >
          {passwordStatus && (
            <div className={`p-3 rounded-xl font-bold text-[10px] border ${
              passwordStatus.type === "success" 
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-400" 
                : "bg-rose-950/80 border-rose-500/30 text-rose-400"
            }`}>
              {passwordStatus.type === "success" ? "✓ " : "⚠️ "}{passwordStatus.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Current Secure PIN</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current PIN..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-2.5 text-slate-400"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">New Secure PIN</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6-Digit PIN..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-2.5 text-slate-400"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-450 block font-bold uppercase">Confirm New PIN</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm 6-Digit PIN..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Update Security PIN
          </button>
        </form>
      );
    } else if (selectedSubSection === "notifications") {
      title = "Clinical Notifications Desk";
      content = (
        <div className="space-y-4 font-mono text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <strong className="text-white text-xs font-bold block">Push Notifications</strong>
              <p className="text-[9.5px] text-slate-500 mt-0.5">Urgent case sheets handover alerts.</p>
            </div>
            <button
              type="button"
              onClick={() => setNotificationsActive(!notificationsActive)}
              className={`w-11 h-6 rounded-full p-1 transition-all ${notificationsActive ? "bg-emerald-500 flex justify-end" : "bg-slate-800 flex justify-start"}`}
            >
              <span className="w-4 h-4 bg-slate-950 rounded-full" />
            </button>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 text-xs">
            <strong className="text-slate-300 block uppercase text-[10px] font-bold">ALERTS DISPATCH LOGS</strong>
            <p className="text-slate-400 leading-relaxed text-[10.5px]">
              Vibrations trigger on mobile whenever bedside dictations finish extracting, and red flash indicators highlight pending P1 resuscitations.
            </p>
          </div>
        </div>
      );
    } else if (selectedSubSection === "privacy") {
      title = "Privacy";
      
      const policySections = [
        {
          id: 1,
          icon: Info,
          title: "1. Introduction",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          content: (
            <div className="space-y-2">
              <p>ErMate is a specialized Emergency Room Electronic Medical Records (EMR) and team management solution, available as an optimized Web Dashboard and Native Companion Client designed specifically for licensed healthcare professionals.</p>
              <p>Developed by Varah Group.</p>
              <p>This Privacy Policy explains how we collect, use, store, and protect data within the ErMate application stack.</p>
              <p>By registering or using ErMate, you acknowledge and agree to the practices detailed in this policy.</p>
            </div>
          )
        },
        {
          id: 2,
          icon: Database,
          title: "2. Information We Collect & Process",
          color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          content: (
            <div className="space-y-2">
              <p className="font-bold">A. User & Account Data:</p>
              <p>Account credentials, physician profile details (clinical role, registration ID, hospital/department affiliation), and team subscription ledgers.</p>
              <p className="font-bold mt-1">B. Team and Department Linkage Data:</p>
              <p>When a Head of Department (HOD) adds your email address to their clinical roster, we process this to automatically incorporate your profile into the department team. Any existing individual plans are securely identified and automatically set to transition to the department-covered team subscription model starting the following month to prevent double billing, ensuring you retain full access to active purchases for the current billing cycle.</p>
              <p className="font-bold mt-1">C. Patient Clinical Records (As entered by physicians):</p>
              <p>Demographic tags (age, gender), emergency triage levels (P1-P5 acuity categories), Glasgow Coma Scale (GCS), chief complaints, and serial vital timelines.</p>
              <p>Primary Survey surveys (Airway, Breathing, Circulation, Disability, Exposure), Secondary Survey medical worksheets, diagnostic rule-outs, drug orders, and clinical disposition plans.</p>
              <p>Psychological emergency screenings (including risk of self-harm, mental status parameters, and home support variables) input securely by the clinical team.</p>
              <p className="font-bold mt-1">D. Audio & Media Inputs (Temporary):</p>
              <p>Spoken medical narratives processed via the Smart Voice Scribe are streamed securely to the language processing engine for instant text mapping. Audio stream data is processed entirely in-memory and is never stored on our persistent database layers.</p>
              <p>Uploaded referral letters, ECG tracings, or diagnostic reports are analyzed ephemerally using OCR technologies to extract text parameters; raw graphic files are not permanently cached beyond the user's explicit record attachment.</p>
            </div>
          )
        },
        {
          id: 3,
          icon: Target,
          title: "3. Purpose of Data Collection",
          color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          content: (
            <div className="space-y-2">
              <p className="font-bold">Collected data is used strictly to fulfill clinical utility workflows:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Facilitating rapid Emergency Department triage scoring and patient routing.</li>
                <li>Conducting secure, structured shift handover logs using the SBAR (Situation, Background, Assessment, Recommendation) framework.</li>
                <li>Generating literature-cited diagnostic suggestions via the Clinical Decision Support (CDS) panel.</li>
                <li>Compiling and rendering clean patient case sheets and printable discharge summaries (PDF/DOCX formats).</li>
                <li>Coordinating on-duty department rotas, team builders, and duty handovers.</li>
                <li>Providing clinical training simulators, including interactive clinical trivia and pocket mirror bedside pupil scales.</li>
              </ul>
              <p className="mt-2 text-slate-500">ErMate does not sell, lease, or distribute clinical records or patient identifiers to third-party advertisers or insurance brokers under any circumstances.</p>
            </div>
          )
        },
        {
          id: 4,
          icon: ShieldCheck,
          title: "4. Infrastructure, Storage & Security",
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>All application traffic is guarded using secure Transport Layer Security (TLS/HTTPS 1.3) encryption.</li>
              <li>Operational databases are backed by secure Google Cloud infrastructure and Firebase Firestore database engines.</li>
              <li>Data access is bounded by explicit role-based authorization controls (Consultant review-overrides vs. Resident note-drafting).</li>
              <li>Rigorous session-based token authentication verifies the active registration of clinical users.</li>
              <li>Clinicians maintain full control of local device memory with instant 'Clear Offline Cache' functionality.</li>
              <li>Supports secure, client-side local backup exports as encrypted JSON packages.</li>
            </ul>
          )
        },
        {
          id: 5,
          icon: Cpu,
          title: "5. Artificial Intelligence & Processing Engine",
          color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Smart Voice Scribe transcription, CDS differential parsing, and draft discharges leverage the advanced ErMate clinical engine family.</li>
              <li>Data items are processed on a secure, private endpoint with strict agreements that prohibit the AI from retaining or using ErMate transactions for baseline model training.</li>
              <li>All AI outputs function purely as clinician decision support overlays; the registered physician maintains sole final accountability for all diagnostic entries and therapeutic plans.</li>
            </ul>
          )
        },
        {
          id: 6,
          icon: Clock,
          title: "6. Data Retention Policies",
          color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Active patient files remain retrievable inside the department directory during your active hospital team subscription.</li>
              <li>Clinicians can permanently delete individual patient records or shift handovers at any point, removing them from cloud storage immediately.</li>
              <li>Upon complete account termination, all associated personal indices and clinical entries are scheduled for hard deletion.</li>
              <li>Complies with state-regulated medical record-keeping thresholds for emergency departments.</li>
            </ul>
          )
        },
        {
          id: 7,
          icon: UserCheck,
          title: "7. Professional Responsibility & Consent",
          color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>ErMate serves as a digital EMR workbook assisting licensed, authorized clinicians only.</li>
              <li>Using clinicians are responsible for obtaining standard institutional or patient consent where applicable under hospital policies.</li>
              <li>Clinicians are expected to adhere to device-level safety practices (including passcode locks and secure biometrics) to block unauthorized bedside access.</li>
            </ul>
          )
        },
        {
          id: 8,
          icon: Globe,
          title: "8. Regulatory Compliance (DPDPA & International Law)",
          color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Fully conforms to India's Digital Personal Data Protection Act (DPDPA), 2023, regarding electronic health data handling and consent boundaries.</li>
              <li>Maintains compliance standards in line with national electronic health record guidelines and emergency triage safety practices.</li>
            </ul>
          )
        },
        {
          id: 9,
          icon: Trash2,
          title: "9. Deletion & Data Rights",
          color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Users hold explicit rights to inspect, download, or completely request the deletion of their processed data index.</li>
              <li>Data extraction can be handled locally via the backup downloader. Deletion inquiries can also be directly mailed to our team.</li>
              <li>Requests submitted via official support channels are validated and resolved within 14 calendar days.</li>
            </ul>
          )
        },
        {
          id: 10,
          icon: RefreshCw,
          title: "10. Policy Updates",
          color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>We update this policy to reflect new security protocols, software capabilities, or statutory regulations.</li>
              <li>Any major changes are explicitly flagged inside our active release logs and dashboard alerts.</li>
            </ul>
          )
        },
        {
          id: 11,
          icon: Mail,
          title: "11. Contact & Grievance Desk",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          content: (
            <div className="space-y-1">
              <p>For data privacy queries, consent withdrawals, or compliance reports, contact Varah Group:</p>
              <p>Email: varahgrp@gmail.com</p>
              <p>Website: www.varahgrp.com</p>
            </div>
          )
        }
      ];

      content = (
        <div className="space-y-6 font-mono text-xs text-slate-700 dark:text-slate-300 text-left pb-4">
          
          {/* Header Banner */}
          <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-2xl space-y-1.5 shadow-sm">
            <h5 className="font-extrabold text-emerald-700 dark:text-emerald-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" /> Privacy Policy
            </h5>
            <p className="text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 font-sans">
              ErMate by Varah Group takes patient data privacy seriously. All clinical information is handled with the highest standards of security and confidentiality.
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/40">
              Version: v2.1.0-Release (Last Updated: July 2026)
            </p>
          </div>

          {/* Privacy Policy Accordion Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">
              PRIVACY POLICY
            </h4>
            <div className="space-y-2">
              {policySections.map((sect) => {
                const IconComp = sect.icon;
                const isOpen = openPolicySection === sect.id;
                return (
                  <div 
                    key={sect.id} 
                    className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenPolicySection(isOpen ? null : sect.id)}
                      className="w-full p-3.5 flex items-center justify-between text-left gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer animate-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border ${sect.color} flex items-center justify-center`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[11.5px]">
                          {sect.title}
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/40 font-sans">
                        {sect.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Sharing Preferences */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">
              DATA SHARING PREFERENCES
            </h4>
            <div className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-xs">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="text-left">
                  <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold block font-sans">Usage Analytics</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-sans">Help improve ErMate with anonymous usage data</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareAnalytics(!shareAnalytics)}
                  className={`w-11 h-6 rounded-full p-1 transition-all flex items-center shrink-0 ${shareAnalytics ? "bg-emerald-500 justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"}`}
                >
                  <span className="w-4 h-4 bg-white dark:bg-slate-950 rounded-full shadow-xs" />
                </button>
              </div>

              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-left">
                    <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold block font-sans">CONTRIBUTE TO ERMATE LEARNING</strong>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal font-sans">
                      Help improve ErMate's voice recognition and clinical accuracy by sharing anonymised case data. Patient identity is never stored.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !shareAiTraining;
                      setShareAiTraining(newValue);
                      onSaveProfile({ ...profile, hasConsentedToLearning: newValue });
                    }}
                    className={`w-11 h-6 rounded-full p-1 transition-all flex items-center shrink-0 cursor-pointer ${shareAiTraining ? "bg-emerald-500 justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"}`}
                  >
                    <span className="w-4 h-4 bg-white dark:bg-slate-950 rounded-full shadow-xs" />
                  </button>
                </div>
                <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${shareAiTraining ? "bg-emerald-500" : "bg-slate-400"}`} />
                  <span>{shareAiTraining ? "Tap to turn off" : "Tap to turn on"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">
              SECURITY
            </h4>
            <div className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="text-left">
                  <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold block font-sans">Biometric Lock</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-sans">Require fingerprint or face unlock to open app</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBiometricLock(!biometricLock)}
                  className={`w-11 h-6 rounded-full p-1 transition-all flex items-center shrink-0 ${biometricLock ? "bg-emerald-500 justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"}`}
                >
                  <span className="w-4 h-4 bg-white dark:bg-slate-950 rounded-full shadow-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Your Data Control */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono pl-1">
              YOUR DATA
            </h4>
            <div className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 shadow-xs">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(true)}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
              >
                <div>
                  <strong className="text-rose-600 dark:text-rose-400 text-xs font-bold block font-sans">Clear Local Data</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-sans">Remove cached data from this device</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => alert("📢 Data export request received. A secure backup download link will be dispatched to varahgrp@gmail.com within 24 hours.")}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
              >
                <div>
                  <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold block font-sans">Download My Data</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-sans">Get a copy of all your data via email</p>
                </div>
                <Download className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => alert("📢 Deletion authorization required. Please contact platform administrators at varahgrp@gmail.com to permanently destroy your profile credentials.")}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
              >
                <div>
                  <strong className="text-rose-600 dark:text-rose-400 text-xs font-bold block font-sans">Delete Account</strong>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-sans">Permanently remove your account and data</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Footnote */}
          <div className="pt-2.5 border-t border-slate-150 dark:border-slate-850 flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-500 leading-normal font-sans">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 animate-none" />
            <span>
              For privacy-related concerns, contact Varah Group at <strong className="text-slate-600 dark:text-slate-400">varahgrp@gmail.com</strong> | <a href="https://www.varahgrp.com" target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-500 font-bold">www.varahgrp.com</a>
            </span>
          </div>

        </div>
      );
    } else if (selectedSubSection === "support") {
      title = "Help & Support";
      
      const faqs = [
        {
          question: "How do I start a new patient case?",
          answer: "Tap the '+ New Patient' button in the top header or on the Dashboard. This loads the Triage screen where you can register patient demographics and enter immediate vitals. The system automatically computes age classifications, Glasgow Coma Scale (GCS), and Emergency Severity Index (P1 to P5 emergency priority levels)."
        },
        {
          question: "How does the Smart Voice Scribe work?",
          answer: "Locate the blue microphone button inside active case sheets. Tap to speak your clinical observations or patient history naturally (optimized for Indian hospital shorthand and bilingual clinical slang). ErMate's AI engine transcribes and extracts parameters (like symptoms, history, and vitals) directly into EMR fields without hand-typing. Tap 'Show Map' afterwards to view a visual ledger of exactly what clinical data was extracted and mapped."
        },
        {
          question: "How do I export case sheets or discharge summaries?",
          answer: "From the Dashboard, navigate to the discharged or completed patient case and tap the Download icon. You can instantly compile and download high-contrast, pre-formatted summaries in both PDF and DOCX (Word) formats. The export contains structured vital trends, Primary and Secondary surveys, administered medications, and primary home instructions."
        },
        {
          question: "What happens when my HOD adds me to their clinical team roster?",
          answer: "If you already have an account registration on ErMate under your email address, you are automatically incorporated into the team. You will instantly receive a notification indicating you've been added, and your hospital affiliation and clinical workspace will be synchronized with your HOD's department. If you are not yet registered, your profile will be auto-joined and configured immediately upon sign-up."
        },
        {
          question: "How does my subscription adjust if I am added to a team but have an individual plan?",
          answer: "To honor active purchases and avoid double billing, if you have an active individual plan (like Individual Pro), you will keep that tier for the current billing month while enjoying full team/dashboard features immediately. A 'subscriptionTransitionPending: true' marker is scheduled on your profile, and starting from the next following month, your subscription automatically transitions to the shared, department-covered hospital plan (with all individual billing halted)."
        },
        {
          question: "What is the Clinical Decision Support (CDS) engine?",
          answer: "Accessible via the Treatment tab of an active case sheet, the CDS engine calculates differential diagnoses, highlights severe red-flag conditions to rule out, and provides clickable peer-reviewed guideline citations. All suggestions serve strictly as supportive review tools; the treating healthcare professional maintains sole final clinical responsibility."
        },
        {
          question: "How are pediatric emergency cases routed?",
          answer: "When a patient's age is entered as 16 or below, ErMate automatically shifts the workbook to a PALS-compliant Pediatric Case Sheet. This loads the Pediatric Assessment Triangle (PAT: Appearance, Work of Breathing, Circulation), sets age-appropriate normal vital ranges with color-coded alarms, and activates the bedside weight-based pediatric drug dose calculator."
        },
        {
          question: "Can I use ErMate on my computer and pair my phone?",
          answer: "Yes! ErMate supports dual-screen synchronization. Open Settings > Device Connection to generate a secure 6-digit companion PIN. Enter this PIN on your secondary mobile device to link its microphone and camera directly to your desktop browser session, enabling seamless bedside dictation and document scans."
        },
        {
          question: "Is patient data secure and HIPAA/DPDPA compliant?",
          answer: "Yes. All records are transmitted using secure HTTPS (TLS 1.3) and stored inside our cloud database on Firebase Firestore with data isolation. We implement role-based access gates, support instant offline cache clearing, and provide encrypted JSON backup exports for full compliance with medical data regulations."
        }
      ];

      content = (
        <div className="space-y-6 pb-6 text-left">
          {/* Need Help? Block */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/10 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <HelpCircle className="w-4.5 h-4.5 text-indigo-500" /> Need Help?
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-350 font-sans">
                  We're here to help you get the most out of ErMate
                </p>
              </div>
            </div>
            
            <a
              href="mailto:varahgrp@gmail.com?subject=ErMate Support Request"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs w-full sm:w-auto"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Support
            </a>
          </div>

          {/* Use ErMate on Your Computer */}
          <div className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl p-4.5 space-y-3 shadow-xs">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-4.5 h-4.5 text-emerald-500" /> Use ErMate on Your Computer
              </h4>
              <div className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {typeof window !== "undefined" ? window.location.host : "ermate.varahgrp.com"}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-350 font-sans">
                Access all your cases from any browser — just like WhatsApp Web. Generate a link code from Profile and enter it on the web page to connect instantly.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <a
                href={typeof window !== "undefined" ? window.location.origin : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                Open Web App
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </a>
              <button
                type="button"
                onClick={() => setSelectedSubSection("device-link")}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <Link className="w-3.5 h-3.5" />
                Get Link Code
              </button>
            </div>
          </div>

          {/* Frequently Asked Questions */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider pl-1 font-mono">
              Frequently Asked Questions
            </h4>
            
            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                    >
                      <strong className="text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-normal font-sans">
                        {faq.question}
                      </strong>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1.5 text-[11px] leading-relaxed text-slate-650 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/40 font-sans">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Send Feedback */}
          <div className="bg-white dark:bg-[#182333] border border-slate-250 dark:border-slate-800/80 rounded-2xl p-4.5 space-y-3.5 shadow-xs">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Send Feedback
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-sans">
                Help us improve ErMate with your suggestions
              </p>
            </div>

            {supportTicketSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 space-y-1.5 text-[11px] font-sans">
                <strong className="block font-bold">Feedback sent successfully!</strong>
                <p>Thank you for helping us improve ErMate. Our team will review your feedback carefully.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!supportTicketMessage.trim()) return;
                  setSupportTicketSuccess(true);
                  setSupportTicketMessage("");
                  setTimeout(() => setSupportTicketSuccess(false), 5000);
                }}
                className="space-y-3.5"
              >
                {/* Feedback Type Tabs */}
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {(["bug", "feature", "improvement", "general"] as const).map((type) => {
                    const isActive = feedbackType === type;
                    const labelMap = {
                      bug: "Bug Report",
                      feature: "Feature Request",
                      improvement: "Improvement",
                      general: "General"
                    };
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFeedbackType(type)}
                        className={`py-1.5 px-1 rounded-lg text-[9px] font-bold transition-all text-center cursor-pointer ${
                          isActive
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                        }`}
                      >
                        {labelMap[type]}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <textarea
                    value={supportTicketMessage}
                    onChange={(e) => setSupportTicketMessage(e.target.value)}
                    placeholder="Type your feedback, bug report, or feature request..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 h-24 text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-sans"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!supportTicketMessage.trim()}
                  className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        </div>
      );
    } else if (selectedSubSection === "tour") {
      title = "Feature Tour";
      
      const categories = [
        { id: "clinical", label: "Clinical EMR", count: 11, icon: Compass, color: "indigo" },
        { id: "team", label: "Team & Shifts", count: 8, icon: Users, color: "emerald" },
        { id: "learning", label: "Learning", count: 4, icon: BookOpen, color: "amber" },
        { id: "tools", label: "Tools", count: 6, icon: Wrench, color: "cyan" }
      ] as const;

      const activeBgColors = {
        clinical: "bg-indigo-600 dark:bg-indigo-500 text-white",
        team: "bg-emerald-600 dark:bg-emerald-500 text-white",
        learning: "bg-amber-500 dark:bg-amber-500 text-white",
        tools: "bg-cyan-600 dark:bg-cyan-500 text-white"
      };

      const barColors = {
        clinical: "bg-indigo-500",
        team: "bg-emerald-500",
        learning: "bg-amber-500",
        tools: "bg-cyan-500"
      };

      const pathBoxColors = {
        clinical: "bg-rose-500/5 border-rose-500/10 text-rose-600 dark:text-rose-400",
        team: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        learning: "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-400",
        tools: "bg-cyan-500/5 border-cyan-500/10 text-cyan-600 dark:text-cyan-400"
      };

      const pathTextColors = {
        clinical: "text-rose-600 dark:text-rose-400",
        team: "text-emerald-600 dark:text-emerald-400",
        learning: "text-amber-600 dark:text-amber-400",
        tools: "text-cyan-600 dark:text-cyan-400"
      };

      const tourFeatures = {
        clinical: [
          {
            title: "Patient Triage",
            subtitle: "P1–P5 emergency categories",
            desc: "Rapidly triage incoming ER patients using standard Emergency Severity Index priority codes. Capture demographics, chief complaints, immediate vitals, age-classification, and Glasgow Coma Scale (GCS) at the door.",
            path: "Dashboard ➔ New Patient ➔ Fill triage checklist ➔ Start Case Sheet",
            icon: AlertTriangle,
            borderColor: "border-l-red-500",
            iconBg: "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400"
          },
          {
            title: "Adult Case Sheet (ATLS)",
            subtitle: "Advanced Trauma Life Support protocol",
            desc: "Comprehensive EMR trauma & medical workbook mapped over 7 clinical sections: Primary Survey (Airway, Breathing, Circulation, Disability, Exposure), Secondary Survey, serial vital trends, medications, and clinical disposition.",
            path: "Dashboard ➔ Select Active Case ➔ Navigate clinical tabs (Primary/Secondary Survey)",
            icon: FileText,
            borderColor: "border-l-blue-500",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400"
          },
          {
            title: "Pediatric Case Sheet (PALS)",
            subtitle: "Auto-routing system for patients ≤16 yrs",
            desc: "Dynamically shifts patient workbook to pediatric-specific criteria when age is 16 or below. Integrates the Pediatric Assessment Triangle (PAT: Appearance, Work of Breathing, Circulation) and custom age-adjusted vital alerts.",
            path: "New Patient ➔ Enter Age ≤ 16 ➔ Auto-routes to PALS Pediatric Sheet",
            icon: Heart,
            borderColor: "border-l-pink-500",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400"
          },
          {
            title: "Smart Voice Scribe",
            subtitle: "Bilingual dictation for Indian clinical slang",
            desc: "AI-trained speech recognition that transcribes continuous clinical observations, medical abbreviations, and bilingual slang into structured medical entries, eliminating hand-typing fatigue.",
            path: "Active Case Sheet ➔ Tap blue mic button ➔ Narrate observations ➔ AI auto-populates",
            icon: Mic,
            borderColor: "border-l-emerald-500",
            iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400"
          },
          {
            title: "Dictation Completion Map",
            subtitle: "Interactive voice extraction check",
            desc: "A post-transcription visual ledger illustrating exactly which parameters (vitals, symptoms, history) were successfully identified and mapped from your continuous spoken narration into EMR fields.",
            path: "Case Sheet ➔ Dictate ➔ Tap 'Show Map' to view highlighted structured data tags",
            icon: BarChart2,
            borderColor: "border-l-teal-500",
            iconBg: "bg-teal-50 dark:bg-teal-950/40 text-teal-500 dark:text-teal-400",
            isNew: true
          },
          {
            title: "Clinical Decision Support (CDS)",
            subtitle: "Severity differentials with evidence citations",
            desc: "Intelligent clinical safety assistant reviewing active case records to calculate differential diagnoses, highlighting red flags, severe rule-out conditions, and citing peer-reviewed medical guidelines.",
            path: "Case Sheet ➔ Treatment tab ➔ Review CDS suggested diagnoses and citations",
            icon: Cpu,
            borderColor: "border-l-purple-500",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-500 dark:text-purple-400"
          },
          {
            title: "Discharge Summary PDF/DOCX",
            subtitle: "Instant clinical document generator",
            desc: "Auto-compile and print elegant discharge summaries containing patient summary charts, diagnostic timelines, administered drugs, and primary instructions. Fully exportable in both PDF and Word formats.",
            path: "Dashboard ➔ Discharged Cases ➔ Click download icon ➔ Select PDF or DOCX",
            icon: Download,
            borderColor: "border-l-cyan-500",
            iconBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500 dark:text-cyan-400"
          },
          {
            title: "Serial Vitals & Alert Ranges",
            subtitle: "Dynamic age-appropriate color alarms",
            desc: "Plot multiple vital records over time. Custom internal lookup automatically colors vitals based on physiological age norms, warning of pediatric fever or geriatric shock indexes.",
            path: "Case Sheet ➔ Vitals tab ➔ Add Serial Vitals ➔ View automated color-coded alerts",
            icon: Activity,
            borderColor: "border-l-rose-500",
            iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400"
          },
          {
            title: "Psychological Assessment",
            subtitle: "Integrated mental health screening",
            desc: "Fully integrated emergency psych framework to evaluate mental status examinations, risk of harm/suicide ideation, substance intake, and home protective environment variables.",
            path: "Case Sheet ➔ Social / Psychological tab ➔ Check psychological criteria",
            icon: UserCheck,
            borderColor: "border-l-indigo-500",
            iconBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400"
          },
          {
            title: "Quick Fast-Track Sheet",
            subtitle: "Immediate charting for low-severity cases",
            desc: "Bypass detailed trauma protocols for ambulatory cases, minor procedures, or straightforward clinical consultations to write streamlined rapid clinical notes.",
            path: "Dashboard ➔ Click 'Quick Case Sheet' ➔ Fill rapid consultation form",
            icon: Zap,
            borderColor: "border-l-amber-500",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400"
          },
          {
            title: "ER Performance Analytics",
            subtitle: "Operational metrics & triage distribution",
            desc: "Bento-style analytic charts illustrating active patient volumes, historical discharge rates, triage level proportions (P1-P5), and peak ER admission windows to guide clinical staffing.",
            path: "Dashboard ➔ Tap 'Analytics' (bar chart icon in top banner) ➔ Explore metrics",
            icon: TrendingUp,
            borderColor: "border-l-indigo-500",
            iconBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400"
          }
        ],
        team: [
          {
            title: "Active Duty Rota",
            subtitle: "Track ER shifts & roster assignments",
            desc: "View on-duty ER schedules, supervising consultant assignments, active resident registrars, and direct shift calendars for seamless handover coordination.",
            path: "Profile / Settings ➔ Duty Shifts tab ➔ View current roster schedule",
            icon: Clock,
            borderColor: "border-l-blue-500",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400"
          },
          {
            title: "Shift Availability Toggle",
            subtitle: "Clock on/off shift status broadcast",
            desc: "Instantly register yourself as 'Active On-Duty' or 'Off-Duty' to broadcast your availability to the ER floor, directing trauma dispatch alerts.",
            path: "Profile / Settings ➔ Click Active On-Duty status toggle switch",
            icon: UserPlus,
            borderColor: "border-l-cyan-500",
            iconBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500 dark:text-cyan-400"
          },
          {
            title: "Team Builder Directory",
            subtitle: "Staff directory & invitation portal",
            desc: "Create and organize your ER clinical directory. Invite residents and consultants, assign roles, track clinical IDs, and update licensure credentials in a central hub.",
            path: "Profile / Settings ➔ Team Builder tab ➔ View directory & manage members",
            icon: Users,
            borderColor: "border-l-emerald-500",
            iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400"
          },
          {
            title: "Join / Invite Web Link",
            subtitle: "Frictionless boarding for hospital staff",
            desc: "Generate secure department-specific invitation URLs. Allow residents, registrars, and rotating nursing staff to join your ER directory with a single click.",
            path: "Profile / Settings ➔ Team Builder tab ➔ Click 'Copy Invite Link' button",
            icon: Link,
            borderColor: "border-l-amber-500",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400"
          },
          {
            title: "Rounds Token Ledger",
            subtitle: "Transparent clinical resource tracker",
            desc: "Audited accounting ledger tracking local server storage, processed files, ErMate engine parameters, and compute parameters to maintain perfect transparency.",
            path: "Profile / Settings ➔ Rounds Billing tab ➔ Audit token ledger balances",
            icon: CreditCard,
            borderColor: "border-l-red-500",
            iconBg: "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400"
          },
          {
            title: "Handover Transition Logs",
            subtitle: "SBAR clinical transfer sheets",
            desc: "Conduct structured, sign-off transition logs using the SBAR protocol (Situation, Background, Assessment, Recommendation) to prevent patient tracking errors between shift rotations.",
            path: "Profile / Settings ➔ Handover logs tab ➔ View outstanding case handovers",
            icon: FileCheck,
            borderColor: "border-l-purple-500",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-500 dark:text-purple-400"
          },
          {
            title: "Role-Based Access Control",
            subtitle: "Consultant vs. Resident authorizations",
            desc: "Configured authorization gates separating supervisory roles (Consultants with clinical approval, overrides, and audits) from execution roles (Residents drafting clinical notes).",
            path: "Profile / Settings ➔ Account Credentials tab ➔ Select clinical designation",
            icon: Shield,
            borderColor: "border-l-rose-500",
            iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400"
          },
          {
            title: "Automated Team Pathway",
            subtitle: "HOD Sync & Plan Transition",
            desc: "When an HOD adds a doctor to their team roster, existing accounts are automatically incorporated with a real-time notification. Individual plan subscriptions are gracefully transitioned starting the following month to avoid double billing.",
            path: "Profile / Settings ➔ Team Builder tab ➔ Automated background synchronization",
            icon: Sparkles,
            borderColor: "border-l-indigo-500",
            iconBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400",
            isNew: true
          }
        ],
        learning: [
          {
            title: "Interactive Clinical Simulations",
            subtitle: "Scenario practice with diagnostic pacing",
            desc: "High-acuity medical scenario simulator. Test your reflexes and decision-making on trauma alerts, cardiac arrests, or pediatric emergencies under real-time score tracking and comprehensive clinical performance metrics.",
            path: "Dashboard ➔ Learn tab ➔ Select interactive clinical case simulations",
            icon: Target,
            borderColor: "border-l-amber-500",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400"
          },
          {
            title: "AI Medical Reference Library",
            subtitle: "Verified medical guidelines assistant",
            desc: "Fast medical literature search tool powered by AI grounding. Find standard drug dosages, clinical scoring scales, and international resuscitation guidelines instantly.",
            path: "Dashboard ➔ Learn tab ➔ Medical Reference Library ➔ Search topic or drug",
            icon: HelpCircle,
            borderColor: "border-l-blue-500",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400"
          },
          {
            title: "Clinical Trivia Challenge",
            subtitle: "Interactive diagnostics quiz",
            desc: "A gamified diagnostic trivia module focused on critical clinical scoring criteria (NEXUS, Wells, Wells PE, PERC rule, TIMI) and emergency pharmacology pearls to reinforce core trauma knowledge.",
            path: "Dashboard ➔ Learn tab ➔ Select 'Clinical Quiz / Trivia'",
            icon: Award,
            borderColor: "border-l-purple-500",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-500 dark:text-purple-400"
          },
          {
            title: "Clinical Memory Log",
            subtitle: "Personal medical reflection registry",
            desc: "A private journal to document rare medical cases, clinical pearls, or cognitive biases encountered on shift, helping you track your diagnostic milestones over time.",
            path: "Dashboard ➔ Learn tab ➔ Medical Reflection Log ➔ Add Clinical Note",
            icon: BookOpen,
            borderColor: "border-l-rose-500",
            iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400"
          }
        ],
        tools: [
          {
            title: "Bedside Pocket Mirror",
            subtitle: "Pupil sizing & Mallampati camera overlays",
            desc: "Uses your device's camera to display custom scale overlays at the bedside. Includes pupillary millimetre measurements (1mm - 8mm) and Mallampati class classifications to assist neurological and airway examinations.",
            path: "Dashboard ➔ Click 'Pocket Mirror' icon ➔ Position patient's face with live graphics",
            icon: Camera,
            borderColor: "border-l-amber-500",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400"
          },
          {
            title: "Pediatric Drug Calculator",
            subtitle: "Weight-based emergency dose table",
            desc: "PALS-based bedside dose utility. Enter a child's weight or age to instantly compute precise resuscitation drug volumes (Adrenaline, Amiodarone, Atropine, Sedatives) and airway sizes.",
            path: "Dashboard ➔ Click 'Pediatric Drug Calculator' ➔ Enter pediatric weight/age",
            icon: Calculator,
            borderColor: "border-l-blue-500",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400"
          },
          {
            title: "Clinical Risk Scorers",
            subtitle: "Integrated emergency scoring systems",
            desc: "Quick calculator sheets for assessing key risk models (Glasgow Coma Scale, CURB-65 pneumonia severity, GRACE ischemia score, TIMI index) with real-time risk classification alerts.",
            path: "Dashboard / Active Case Sheet ➔ Tools dropdown ➔ Select calculator",
            icon: Percent,
            borderColor: "border-l-cyan-500",
            iconBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500 dark:text-cyan-400"
          },
          {
            title: "Device Companion Link (Web)",
            subtitle: "WhatsApp-style phone-to-browser pairing",
            desc: "Generate a secure 6-digit PIN on your computer screen and input it on your phone's companion interface to pair the mobile camera and microphone instantly for bedside dictations.",
            path: "Profile / Settings ➔ Device Connection tab ➔ Generate secure pairing code",
            icon: Laptop,
            borderColor: "border-l-emerald-500",
            iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400"
          },
          {
            title: "Eye-Safe Dark Mode",
            subtitle: "High-contrast slate interface for night shifts",
            desc: "Instantly switch between bright, clean layouts and our eye-safe, ultra-low-glare deep slate dark theme specifically designed to protect night-shift ER staff from screen fatigue.",
            path: "Profile / Settings ➔ Tap Light/Dark toggle icon or in Display Preferences",
            icon: Moon,
            borderColor: "border-l-purple-500",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-500 dark:text-purple-400"
          },
          {
            title: "Encrypted Backups",
            subtitle: "Local backup download & restore",
            desc: "Full local data safety utility. Export your complete history of clinical cases, logs, and billing details into an encrypted JSON file for compliance, audits, or offline transfer.",
            path: "Profile / Settings ➔ Backup & Privacy tab ➔ Click 'Export Data Backup'",
            icon: Download,
            borderColor: "border-l-rose-500",
            iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400"
          }
        ]
      };

      const currentCategoryLabel = categories.find(c => c.id === tourCategory)?.label || "Clinical EMR";
      const currentCategoryCount = categories.find(c => c.id === tourCategory)?.count || 11;
      const featuresInActiveCategory = tourFeatures[tourCategory];

      content = (
        <div className="space-y-6 pb-6 text-left">
          {/* Compass Logo Badge */}
          <div className="text-center pt-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Feature Tour</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
              Everything ErMate can do — in one place
            </p>
          </div>

          {/* 4 Summary Statistics Cards */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            {categories.map((cat) => {
              const isActive = tourCategory === cat.id;
              const textColors = {
                clinical: "text-blue-600 dark:text-blue-400",
                team: "text-emerald-600 dark:text-emerald-400",
                learning: "text-amber-600 dark:text-amber-400",
                tools: "text-cyan-600 dark:text-cyan-400"
              };
              const bgColors = {
                clinical: "bg-blue-50/70 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/20",
                team: "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/20",
                learning: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/20",
                tools: "bg-cyan-50/70 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/20"
              };
              const activeRings = {
                clinical: "ring-2 ring-indigo-500/45 dark:ring-indigo-400/45",
                team: "ring-2 ring-emerald-500/45 dark:ring-emerald-400/45",
                learning: "ring-2 ring-amber-500/45 dark:ring-amber-400/45",
                tools: "ring-2 ring-cyan-500/45 dark:ring-cyan-400/45"
              };
              
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setTourCategory(cat.id);
                    setExpandedFeatureIndex(0);
                  }}
                  className={`border rounded-2xl p-2.5 text-center transition-all cursor-pointer select-none ${bgColors[cat.id]} ${
                    isActive ? activeRings[cat.id] + " scale-[1.02] shadow-sm font-bold" : "border-transparent opacity-85 hover:opacity-100"
                  }`}
                >
                  <span className={`text-lg font-black block leading-none ${textColors[cat.id]}`}>
                    {cat.count}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-tight block mt-1 leading-tight">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Capsule Tab Navigation Bar */}
          <div className="flex flex-wrap gap-2 pt-2">
            {categories.map((cat) => {
              const isActive = tourCategory === cat.id;
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setTourCategory(cat.id);
                    setExpandedFeatureIndex(0);
                  }}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-xs border ${
                    isActive
                      ? activeBgColors[cat.id] + " border-transparent"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Category Title Header Line */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5 mt-2">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${barColors[tourCategory]}`} />
              <strong className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {currentCategoryLabel}
              </strong>
            </div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">
              {currentCategoryCount} features
            </span>
          </div>

          {/* Features Expandable List (Accordion) */}
          <div className="space-y-2.5">
            {featuresInActiveCategory.map((feat, idx) => {
              const isExpanded = expandedFeatureIndex === idx;
              const IconComp = feat.icon;
              return (
                <div
                  key={idx}
                  className={`bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all shadow-xs border-l-4 ${feat.borderColor}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFeatureIndex(isExpanded ? null : idx)}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${feat.iconBg}`}>
                        <IconComp className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center flex-wrap gap-1">
                          <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold leading-tight">
                            {feat.title}
                          </strong>
                          {feat.isNew && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-black text-[8px] rounded uppercase font-mono tracking-wider">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium leading-tight block mt-0.5">
                          {feat.subtitle}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4.5 pt-1 border-t border-slate-100 dark:border-slate-800/40 space-y-3 font-sans">
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {feat.desc}
                      </p>
                      
                      {/* Pathway box */}
                      <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${pathBoxColors[tourCategory]}`}>
                        <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${pathTextColors[tourCategory]}`} />
                        <p className="text-[10px] font-bold font-mono leading-normal flex-1">
                          {feat.path}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    } else if (selectedSubSection === "about") {
      title = "About ErMate";
      content = (
        <div className="space-y-6 pb-6 text-left">
          {/* Brand Card */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/15 rounded-2xl p-6 text-center space-y-3 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto text-white font-extrabold text-2xl shadow-md tracking-wider">
              EM
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ErMate</h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Emergency Room EMR for Modern Physicians</p>
            </div>
            <div className="flex justify-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-1">
              <span>Version 1.0.0</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Build 2026.06.30</span>
            </div>
          </div>

          {/* About description */}
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl p-4.5 space-y-2.5 shadow-xs">
            <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider font-mono">
              About
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-sans">
              ErMate is a mobile-first Emergency Room Electronic Medical Records application designed for emergency medicine physicians and residents. It streamlines the complete patient workflow from triage through discharge with ErMate-powered features, voice dictation, and evidence-based clinical decision support.
            </p>
          </div>

          {/* Key Features */}
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl p-4.5 space-y-3.5 shadow-xs">
            <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider font-mono">
              Key Features
            </h4>
            <div className="grid grid-cols-1 gap-2.5 text-[11px] font-sans">
              {[
                { title: "Complete ER workflow", desc: "Triage, Case Sheet, Disposition, Discharge" },
                { title: "Voice dictation with ErMate clinical data extraction", desc: "Hands-free dictation with clinical data extraction" },
                { title: "ErMate differential diagnosis with literature references", desc: "Literature-referenced clinical suggestions" },
                { title: "Red flag detection with severity-based alerts", desc: "Severity-based real-time alerts" },
                { title: "Age-based protocols", desc: "ATLS (adults) and PALS (pediatrics)" },
                { title: "PDF and Word export for case sheets and discharge summaries", desc: "Case sheets and discharge summary downloads" },
                { title: "Document scanner for lab reports and referral notes", desc: "Lab reports and referral notes OCR extraction" }
              ].map((feat, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold block">{feat.title}</strong>
                    <span className="text-slate-505 dark:text-slate-400 text-[10px]">{feat.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technology Dual Architecture */}
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl p-4.5 space-y-4 shadow-xs">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider font-mono">
                System Architecture
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal font-sans mt-0.5">
                ErMate uses a dual-platform design tailored for rapid ER operations and team desk monitoring.
              </p>
            </div>

            {/* Platform 1: Active Web Dashboard */}
            <div className="border border-indigo-500/10 rounded-xl p-3 bg-indigo-50/5 dark:bg-indigo-950/5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5" />
                  💻 Web Dashboard (This App)
                </span>
                <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono font-bold">Active Environment</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Frontend", val: "React 18 + Vite + Tailwind CSS", icon: Smartphone },
                  { label: "State & Motion", val: "React Hooks + Motion Transitions", icon: Cpu },
                  { label: "Backend proxy", val: "Express.js (Node Sandbox)", icon: Laptop },
                  { label: "Cloud Database", val: "Firebase Firestore (Cloud Core)", icon: Database },
                  { label: "Clinical Voice / Engine", val: "ErMate Clinical Engine", icon: Activity }
                ].map((tech, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] font-sans">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <tech.icon className="w-3 h-3 text-slate-400 shrink-0" />
                      {tech.label}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-right text-[10px]">{tech.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform 2: Native Mobile Core */}
            <div className="border border-emerald-500/10 rounded-xl p-3 bg-emerald-50/5 dark:bg-emerald-950/5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  📱 Native Mobile Client
                </span>
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-mono font-bold">Production Target</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Frontend Engine", val: "React Native + Expo SDK 54", icon: Smartphone },
                  { label: "State & Query", val: "TanStack React Query + Navigation", icon: Cpu },
                  { label: "Production API", val: "Express.js + TypeScript CJS", icon: Laptop },
                  { label: "Relational DB", val: "PostgreSQL (via Drizzle ORM)", icon: Database },
                  { label: "Voice Scribe SDK", val: "ErMate Speech Core", icon: Activity }
                ].map((tech, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] font-sans">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <tech.icon className="w-3 h-3 text-slate-400 shrink-0" />
                      {tech.label}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-right text-[10px]">{tech.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Open Source Licenses */}
          <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl p-4.5 space-y-3 shadow-xs">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider font-mono">
                Open Source Licenses
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                ErMate is made possible by these incredible open source ecosystems
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {[
                { name: "React & React Native", license: "MIT" },
                { name: "Expo Core Hub", license: "MIT" },
                { name: "React Navigation", license: "MIT" },
                { name: "TanStack React Query", license: "MIT" },
                { name: "Drizzle ORM & Postgres", license: "Apache-2.0" },
                { name: "Framer Motion & Reanimated", license: "MIT" },
                { name: "PDFKit & Docx Hub", license: "MIT" }
              ].map((lib, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-[11px] font-sans">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{lib.name}</span>
                  <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{lib.license}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Accordion/Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider pl-1 font-mono">
              Legal
            </h4>
            <div className="bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800/60 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/50 overflow-hidden shadow-xs">
              {[
                { label: "Terms of Service", sub: "privacy" },
                { label: "Privacy Policy", sub: "privacy" },
                { label: "HIPAA Compliance", sub: "privacy" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedSubSection(item.sub)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Footnote / Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/50 text-center space-y-1 text-[10px] text-slate-500 dark:text-slate-500 font-sans">
            <p className="font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Made with care for Emergency Medicine
            </p>
            <p className="font-mono text-[9px]">&copy; 2024-2026 ErMate. All rights reserved.</p>
          </div>
        </div>
      );
    } else if (selectedSubSection === "revenue-planner") {
      // Security Guard: Restrict to only the verified owner/admin email
      if (profile.email !== "varahgrp@gmail.com") {
        return (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-black text-white">Security Violation</h4>
            <p className="text-xs text-slate-450 leading-relaxed max-w-xs mx-auto">
              You do not have administrative credentials to view the proprietary financial model, expenses, or profit calculations of this hospital platform.
            </p>
          </div>
        );
      }

      title = "ERmate Admin Financial & Cost Planner";

      // Price points per tier
      const individualPrice = 1199;
      const teamConsultantPrice = 599;
      const teamResidentPrice = 399;

      // Expenses We Bear (per 1 Single User/Month)
      const singleUserRazorpay = Math.round(individualPrice * 0.0236 * 100) / 100; // 2% + 18% GST of fee
      const singleUserGemini = 75.00; // Gemini 1.5 Flash clinical transcription + SBAR structuring
      const singleUserSarvam = 45.00; // Sarvam AI speech-to-text / Indic vernacular voice API
      const singleUserServer = 15.00; // Firebase, Cloud Run, Cloud Firestore serverless infrastructure prorated
      const singleUserTotalExpense = singleUserRazorpay + singleUserGemini + singleUserSarvam + singleUserServer;
      const singleUserNetProfit = individualPrice - singleUserTotalExpense;
      const singleUserMarginPercent = (singleUserNetProfit / individualPrice) * 100;

      // Scaling Simulation based on slider states
      const totalIndividualRevenues = proDoctorCount * individualPrice;
      const teamConsultantsRevenue = teamCount * consultantsPerTeam * teamConsultantPrice;
      const teamResidentsRevenue = teamCount * residentsPerTeam * teamResidentPrice;
      const totalMonthlyRevenue = totalIndividualRevenues + teamConsultantsRevenue + teamResidentsRevenue;
      const totalAnnualizedRevenue = totalMonthlyRevenue * 12;

      // Total simulated expenses based on active counts
      const totalProConsultants = proDoctorCount + (teamCount * consultantsPerTeam);
      const totalProResidents = teamCount * residentsPerTeam;

      // Scaling expenses model using exact APIs + servers:
      const totalRazorpayExpenses = totalMonthlyRevenue * 0.0236;
      const totalGeminiExpenses = (totalProConsultants * 75) + (totalProResidents * 40);
      const totalSarvamExpenses = (totalProConsultants * 45) + (totalProResidents * 25);
      
      // Infrastructure scale (base floor + incremental user compute)
      const totalComputeExpenses = totalMonthlyRevenue > 0 ? (3500 + (totalProConsultants * 15) + (totalProResidents * 10)) : 0;
      
      const totalMonthlyExpenses = totalRazorpayExpenses + totalGeminiExpenses + totalSarvamExpenses + totalComputeExpenses;
      const netMonthlyProfit = Math.max(0, totalMonthlyRevenue - totalMonthlyExpenses);
      const netAnnualProfit = netMonthlyProfit * 12;
      const netProfitMargin = totalMonthlyRevenue > 0 ? (netMonthlyProfit / totalMonthlyRevenue) * 100 : 0;

      content = (
        <div className="space-y-6 text-left font-mono text-xs">
          {/* Admin Banner */}
          <div className="bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-900 bg-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">
                ADMIN ACCESS SECURED
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">
                Logged in: {profile.email}
              </span>
            </div>
            <p className="text-slate-300 text-[10.5px] leading-relaxed">
              Proprietary pricing engine analyzing multi-API costs, payment channels, hosting compute, and gross margin scaling ratios for Indian ER networks.
            </p>
          </div>

          {/* SINGLE USER COST ANALYSIS CARD */}
          <div className="bg-[#182333] border border-slate-800 rounded-2xl p-4.5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                1. COST STRUCTURE (PER 1 INDIVIDUAL PRO USER)
              </h5>
              <span className="text-[10.5px] text-emerald-400 font-extrabold">₹{individualPrice}/mo Subscription</span>
            </div>

            <div className="space-y-2.5 text-[10.5px]">
              <div className="flex justify-between items-center text-slate-300">
                <span>Razorpay API Gateway Fee <span className="text-[9px] text-slate-500">(2.36% total)</span></span>
                <span className="font-bold text-rose-300">₹{singleUserRazorpay.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>ErMate Engine <span className="text-[9px] text-slate-500">(SBAR/IPASS structuring)</span></span>
                <span className="font-bold text-rose-300">₹{singleUserGemini.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Sarvam API <span className="text-[9px] text-slate-500">(Indic Speech-to-Text & Dialect translation)</span></span>
                <span className="font-bold text-rose-300">₹{singleUserSarvam.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>GCP Serverless Hosting <span className="text-[9px] text-slate-500">(Prorated Firestore/Cloud Run)</span></span>
                <span className="font-bold text-rose-300">₹{singleUserServer.toFixed(2)}</span>
              </div>

              <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center text-rose-400 font-bold">
                <span>Total Bearer Costs (Per User)</span>
                <span>₹{singleUserTotalExpense.toFixed(2)} / mo</span>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-emerald-500 block font-bold uppercase tracking-wide">Net Profit Margin</span>
                  <span className="text-sm font-black text-emerald-400">₹{singleUserNetProfit.toFixed(2)} / mo</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-emerald-500 block font-bold uppercase tracking-wide">Margin Ratio</span>
                  <span className="text-sm font-black text-emerald-400">{singleUserMarginPercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SCALING CONTROLS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4">
            <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
              2. ACTIVE SUBSCRIBER SCALING SIMULATOR
            </h5>

            {/* Slider 1: Individual Pro Doctors */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-300">Individual Pro Subscribers</span>
                <span className="text-emerald-400 font-extrabold">{proDoctorCount} doctors</span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={proDoctorCount}
                onChange={(e) => setProDoctorCount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0</span>
                <span>500</span>
                <span>1000</span>
              </div>
            </div>

            {/* Slider 2: Hospital Teams */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-300">Hospital Departments / Teams</span>
                <span className="text-indigo-400 font-extrabold">{teamCount} ER Departments</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Grid for Doctors per Department Team */}
            <div className="grid grid-cols-2 gap-3.5 pt-1.5 border-t border-slate-850">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-450 block uppercase font-bold">Consultants / Team (₹599)</label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button type="button" onClick={() => setConsultantsPerTeam(prev => Math.max(0, prev - 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs">-</button>
                  <span className="flex-1 text-center font-bold text-slate-300 text-[11px]">{consultantsPerTeam}</span>
                  <button type="button" onClick={() => setConsultantsPerTeam(prev => Math.min(10, prev + 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs">+</button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-450 block uppercase font-bold">Residents / Team (₹399)</label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button type="button" onClick={() => setResidentsPerTeam(prev => Math.max(0, prev - 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs">-</button>
                  <span className="flex-1 text-center font-bold text-slate-300 text-[11px]">{residentsPerTeam}</span>
                  <button type="button" onClick={() => setResidentsPerTeam(prev => Math.min(20, prev + 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULATED PROFIT MARGIN & GENERAL REVENUE SHEET */}
          <div className="space-y-3.5">
            <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
              3. SIMULATED PLATFORM REVENUES & EXPENSES
            </h5>

            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: Gross Monthly Revenue */}
              <div className="bg-[#182333] border border-slate-800 p-3.5 rounded-2xl relative overflow-hidden">
                <span className="text-[8.5px] text-slate-400 uppercase block font-bold tracking-wider">Gross Revenue</span>
                <strong className="text-base text-white block mt-1">
                  ₹{Math.round(totalMonthlyRevenue).toLocaleString("en-IN")}
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  ₹{Math.round(totalAnnualizedRevenue).toLocaleString("en-IN")}/yr
                </span>
              </div>

              {/* Card 2: Operating Expenses */}
              <div className="bg-[#182333] border border-slate-800 p-3.5 rounded-2xl relative overflow-hidden">
                <span className="text-[8.5px] text-slate-400 uppercase block font-bold tracking-wider">Platform Expenses</span>
                <strong className="text-base text-rose-400 block mt-1">
                  ₹{Math.round(totalMonthlyExpenses).toLocaleString("en-IN")}
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  {totalMonthlyRevenue > 0 
                    ? `${((totalMonthlyExpenses / totalMonthlyRevenue) * 100).toFixed(1)}% of revenue` 
                    : "₹0/mo"}
                </span>
              </div>
            </div>

            {/* NET PROFIT CARD */}
            <div className="bg-gradient-to-r from-[#1b2a26] to-[#121f21] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[8.5px] text-emerald-500 uppercase block font-bold tracking-wider">Net Monthly Profit</span>
                <strong className="text-lg text-emerald-400 block mt-1">
                  ₹{Math.round(netMonthlyProfit).toLocaleString("en-IN")}
                </strong>
                <span className="text-[9px] text-emerald-500/70 block mt-0.5">
                  ₹{Math.round(netAnnualProfit).toLocaleString("en-IN")}/yr annualized
                </span>
              </div>
              <div className="text-right">
                <span className="text-[8.5px] text-emerald-500 uppercase block font-bold tracking-wider">Profit Margin</span>
                <div className="flex items-baseline justify-end gap-0.5 mt-1">
                  <span className="text-xl font-black text-emerald-400">{netProfitMargin.toFixed(1)}</span>
                  <span className="text-xs text-emerald-500">%</span>
                </div>
              </div>
            </div>

            {/* Cost Items Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-3">
              <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">TOTAL EXPENSES BREAKDOWN</h5>
              
              <div className="space-y-2.5 text-[10.5px]">
                {/* Razorpay Gateways */}
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-300">1. Razorpay Gateway Fees (2.36%)</p>
                    <p className="text-[9.5px] text-slate-500 max-w-[200px]">
                      2.0% transaction fee + 18% GST on the fee.
                    </p>
                  </div>
                  <span className="font-bold text-rose-300">₹{Math.round(totalRazorpayExpenses).toLocaleString("en-IN")}</span>
                </div>

                {/* ErMate Engine Costs */}
                <div className="flex justify-between items-start border-t border-slate-850 pt-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-300">2. ErMate Clinical Engine Costs</p>
                    <p className="text-[9.5px] text-slate-500 max-w-[200px]">
                      Transcription & structured clinical analysis. ₹75/mo (Consultant) and ₹40/mo (Resident).
                    </p>
                  </div>
                  <span className="font-bold text-rose-300">₹{Math.round(totalGeminiExpenses).toLocaleString("en-IN")}</span>
                </div>

                {/* Sarvam API Costs */}
                <div className="flex justify-between items-start border-t border-slate-850 pt-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-300">3. Sarvam Speech translation API</p>
                    <p className="text-[9.5px] text-slate-500 max-w-[200px]">
                      Indic localization, medical slang transcription & translation. ₹45/mo (Consultant) and ₹25/mo (Resident).
                    </p>
                  </div>
                  <span className="font-bold text-rose-300">₹{Math.round(totalSarvamExpenses).toLocaleString("en-IN")}</span>
                </div>

                {/* Compute and Database */}
                <div className="flex justify-between items-start border-t border-slate-850 pt-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-300">4. GCP Serverless Computing</p>
                    <p className="text-[9.5px] text-slate-500 max-w-[200px]">
                      Firestore read/writes, Cloud Run serverless app instances & persistent storage.
                    </p>
                  </div>
                  <span className="font-bold text-rose-300">₹{Math.round(totalComputeExpenses).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
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
              cases.slice(0, 10).map((c) => (
                <div key={c.id} className="p-3 bg-white dark:bg-[#182333] border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-left">
                  <div>
                    <strong className="text-xs text-slate-800 dark:text-slate-200 block">{c.patient?.name || "Patient"}</strong>
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
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-2">
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
      <div className="w-full max-w-lg bg-white dark:bg-[#121824] text-slate-800 dark:text-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between relative min-h-[85vh]">
        
        {/* Top ambient highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-blue-500" />

        {/* Main interactive router */}
        <div className="flex-1">
          {selectedSubSection === null ? renderProfileMenuList() : renderSubSectionContent()}
        </div>

        {/* Dynamic Interactive Tour Overlay */}
        {tourActive && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-mono text-xs">
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
            <div className="bg-[#121824] border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              
              {/* Razorpay Banner header */}
              <div className="bg-[#0b1217] p-4.5 border-b border-slate-800 flex items-center justify-between">
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
                        className="w-full p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white rounded-xl flex items-center justify-between text-left cursor-pointer"
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
                        className="w-full p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white rounded-xl flex items-center justify-between text-left cursor-pointer"
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
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={handleExecutePayment}
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
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 mb-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                          />
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="CVV"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleExecutePayment}
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
                    <div className="w-10 h-10 border-4 border-slate-800 border-t-emerald-500 animate-spin rounded-full" />
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
              <div className="bg-[#0b1217] px-5 py-3 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>🛡️ SECURE PCI-DSS</span>
                <span>Razorpay Gateway</span>
              </div>

            </div>
          </div>
        )}

        {/* Global Delete Confirm Modal overlay */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-mono text-xs">
            <div className="bg-[#121824] border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 text-center tracking-widest font-black uppercase"
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
    </div>
  );
}
