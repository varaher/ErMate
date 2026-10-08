import React, { useState, useEffect } from "react";
import { 
  Building2, FileWarning, BookOpen, Users, 
  TrendingUp, ShieldAlert, Sparkles, ChevronRight, ShieldCheck, 
  User, Award, Wrench, MoreHorizontal, Lock, Bell, Shield,
  LogOut, Moon, Sun, Clock, RefreshCcw, Laptop, HelpCircle,
  Compass, Info, Trash2, Cpu, CheckCircle2, AlertTriangle, X,
  Save, Eye, Check, ExternalLink, Activity
} from "lucide-react";
import { UserProfile, ClinicalCase, TeamMember, isActiveMembershipStatus, isPendingApprovalStatus } from "../types";
import { NormalizedRole, getRoleDisplayLabel } from "../utils/roleUtils";
import { ConfirmModal } from "./shared/ConfirmModal";
import MortalityAuditModal from "./MortalityAuditModal";
import { SelfLearningRulesPanel } from "./SelfLearningRulesPanel";
import RoleChangeSection from "./RoleChangeSection";
import { ErMateLogo } from "./shared/ErMateLogo";
import { APP_VERSION } from "../changelog";

interface MoreViewProps {
  profile: UserProfile | null;
  normalizedRole: NormalizedRole;
  onNavigateToTab: (tabId: string) => void;
  isDarkMode?: boolean;
  onOpenUpdatesModal: () => void;
  teamMembers?: TeamMember[];
  erPhysicalBedCapacity?: number | null;
  onUpdateBedCapacity?: (newCapacity: number) => Promise<void> | void;
  onSaveProfile?: (updatedProfile: UserProfile) => void;
  onSignOut?: () => void;
  onDeleteAllCases?: () => void;
  cases?: ClinicalCase[];
  hospitalSubscription?: { active: boolean; subscriptionTier: string } | null;
  handovers?: any[];
}

export default function MoreView({
  profile,
  normalizedRole,
  onNavigateToTab,
  isDarkMode = false,
  onOpenUpdatesModal,
  teamMembers = [],
  erPhysicalBedCapacity = 30,
  onUpdateBedCapacity,
  onSaveProfile,
  onSignOut,
  onDeleteAllCases,
  cases = [],
  hospitalSubscription = null,
  handovers = [],
}: MoreViewProps) {
  const isAdminUser = profile?.email?.toLowerCase().trim() === "varahgrp@gmail.com";
  const isHOD = normalizedRole === "hod" || isAdminUser;
  const isConsultant = normalizedRole === "consultant";
  const displayedRoleLabel = getRoleDisplayLabel(normalizedRole, profile?.role);

  // Derive canonical team membership status
  const currentEmail = (profile?.email || "").toLowerCase().trim();
  const myMembership = teamMembers.find(
    (m) => m.email.toLowerCase().trim() === currentEmail
  );

  // Canonical verified HOD authority (strictly matches Firestore security rules)
  const isCanonicalVerifiedHod = Boolean(
    myMembership &&
    isActiveMembershipStatus(myMembership.status) &&
    myMembership.membershipVerified === true &&
    ["hod", "hod / department lead", "hod / shift lead"].includes(
      String(myMembership.role || "").trim().toLowerCase()
    ) &&
    (Boolean(myMembership.hospitalId) || Boolean(myMembership.hospital))
  );

  // The Facility editor is writable ONLY when verified canonical authority is present
  const canEditFacility = isAdminUser || isCanonicalVerifiedHod;

  const isMembershipActive = Boolean(
    isAdminUser || (
      myMembership &&
      isActiveMembershipStatus(myMembership.status) &&
      myMembership.membershipVerified === true
    )
  );

  const isMembershipPending = myMembership
    ? isPendingApprovalStatus(myMembership.status)
    : false;

  const activeHospitalName = (
    myMembership?.hospitalName ||
    myMembership?.hospital ||
    profile?.hospitalLabel ||
    profile?.workplaceName ||
    profile?.hospital ||
    "Emergency Department"
  ).trim();

  // Modal controls
  const [activeModal, setActiveModal] = useState<
    "profile" | "role" | "security" | "notifications" | "privacy" | "mortality" | "self-learning" | "support" | "about" | "tour" | null
  >(null);

  // Facility Setup Local State
  const [facilityHospitalName, setFacilityHospitalName] = useState<string>(activeHospitalName);
  const [facilityDepartment, setFacilityDepartment] = useState<string>("Emergency & Trauma Medicine");
  const [facilitySpecialty, setFacilitySpecialty] = useState<string>("Emergency Medicine");
  const [facilityBedCapacity, setFacilityBedCapacity] = useState<number>(
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0 ? erPhysicalBedCapacity : 30
  );
  const [facilityTeamCore, setFacilityTeamCore] = useState<string>("EM Trauma Core");
  const [facilityThemeAccent, setFacilityThemeAccent] = useState<"emerald" | "blue" | "indigo" | "violet">("indigo");
  const [savingFacility, setSavingFacility] = useState<boolean>(false);
  const [facilitySavedNotice, setFacilitySavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0) {
      setFacilityBedCapacity(erPhysicalBedCapacity);
    }
  }, [erPhysicalBedCapacity]);

  // Profile Edit Local State
  const [editName, setEditName] = useState<string>(profile?.name || "");
  const [editQualifications, setEditQualifications] = useState<string>(profile?.qualifications || "MBBS, MD Emergency Medicine");
  const [editRegNo, setEditRegNo] = useState<string>(profile?.regNo || "");
  const [editPhone, setEditPhone] = useState<string>(profile?.phone || "");
  const [profileSavedNotice, setProfileSavedNotice] = useState<boolean>(false);

  // Security & Notification Preferences
  const [pinEnabled, setPinEnabled] = useState<boolean>(true);
  const [sessionPin, setSessionPin] = useState<string>("4821");
  const [clinicalAlertsOn, setClinicalAlertsOn] = useState<boolean>(true);
  const [handoverAlertsOn, setHandoverAlertsOn] = useState<boolean>(true);
  const [vitalsAudioAlerts, setVitalsAudioAlerts] = useState<boolean>(true);

  // Delete All Cases Safeguards
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");

  // Display Mode Local State
  const [displayMode, setDisplayMode] = useState<"auto" | "light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ermate_display_mode");
      if (saved === "light" || saved === "dark" || saved === "auto") return saved;
    }
    return isDarkMode ? "dark" : "auto";
  });

  const handleDisplayModeChange = (mode: "auto" | "light" | "dark") => {
    setDisplayMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ermate_display_mode", mode);
    }
  };

  const handleSaveFacilitySettings = async () => {
    if (!canEditFacility) {
      setFacilitySavedNotice("Your verified hospital membership could not be confirmed. Facility settings were not changed.");
      return;
    }
    setSavingFacility(true);
    setFacilitySavedNotice(null);
    try {
      const validCapacity = Math.max(1, Math.floor(facilityBedCapacity));
      if (onUpdateBedCapacity) {
        await onUpdateBedCapacity(validCapacity);
      }
      if (onSaveProfile && profile) {
        onSaveProfile({
          ...profile,
          hospital: facilityHospitalName,
          hospitalLabel: facilityHospitalName,
          workplaceName: facilityHospitalName,
          department: facilityDepartment,
        });
      }
      setFacilitySavedNotice(`Facility configuration saved. ER physical capacity set to ${validCapacity} beds.`);
      setTimeout(() => setFacilitySavedNotice(null), 4000);
    } catch (err: any) {
      setFacilitySavedNotice(err?.message || "Failed to save facility settings.");
    } finally {
      setSavingFacility(false);
    }
  };

  const handleSaveProfileDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !onSaveProfile) return;
    onSaveProfile({
      ...profile,
      name: editName.trim() || profile.name,
      qualifications: editQualifications.trim() || profile.qualifications,
      regNo: editRegNo.trim() || profile.regNo,
      phone: editPhone.trim() || profile.phone,
    });
    setProfileSavedNotice(true);
    setTimeout(() => {
      setProfileSavedNotice(false);
      setActiveModal(null);
    }, 1500);
  };

  const handleDeleteAllCasesSecure = () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE ALL") {
      return;
    }
    if (onDeleteAllCases) {
      onDeleteAllCases();
    }
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    setActiveModal(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-16 font-sans" id="more-utilities-hub">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white">
              More & Clinical Hub
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Account credentials, facility configuration, team subscription, and clinical tools.
            </p>
          </div>
        </div>
      </div>

      {/* COMPACT ACCOUNT SUMMARY CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base font-mono shadow-md uppercase shrink-0">
              {profile?.name ? profile.name.slice(0, 2) : "DR"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-bold tracking-tight">
                  Dr. {profile?.name || "Emergency Clinician"}
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wide">
                  {displayedRoleLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {profile?.email || "doctor@ermate.in"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-center">
            <span className="text-[11px] bg-white/10 text-slate-200 border border-white/15 rounded-xl px-3 py-1 font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeHospitalName}</span>
            </span>
            <span className={`text-[11px] rounded-xl px-3 py-1 font-bold font-mono border ${
              isMembershipActive 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                : isMembershipPending 
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
            }`}>
              {isMembershipActive ? "Hospital Team Account" : isMembershipPending ? "Individual (Team Pending)" : "Individual Workspace"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION A: MY ACCOUNT */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              A. MY ACCOUNT
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Personal Credentials & Security</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-xs">
          {/* 1. Profile */}
          <div 
            onClick={() => setActiveModal("profile")}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold text-slate-900 dark:text-white block">Profile & Clinical Credentials</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  Reg: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{profile?.regNo || "Verified"}</span> • Qualifications: <span className="text-slate-700 dark:text-slate-300">{profile?.qualifications || "MBBS, MD EM"}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
              <span>Edit</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* 2. Role & Workplace */}
          <div 
            onClick={() => setActiveModal("role")}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Award className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold text-slate-900 dark:text-white block">Role & Workplace</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{displayedRoleLabel}</span> · {activeHospitalName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-bold shrink-0">
              <span>View</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* 3. Security */}
          <div 
            onClick={() => setActiveModal("security")}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold text-slate-900 dark:text-white block">Security & Access</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  {pinEnabled ? "Session PIN active (••••)" : "Password authentication"} • Biometrics supported
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-bold shrink-0">
              <span>Configure</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* 4. Notifications */}
          <div 
            onClick={() => setActiveModal("notifications")}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Bell className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold text-slate-900 dark:text-white block">Notifications & Alerts</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  Clinical alerts {clinicalAlertsOn ? "on" : "off"} • Handover transfers {handoverAlertsOn ? "active" : "paused"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-bold shrink-0">
              <span>Manage</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* 5. Privacy & Data */}
          <div 
            onClick={() => setActiveModal("privacy")}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <strong className="text-sm font-bold text-slate-900 dark:text-white block">Privacy & Data Controls</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  DPDP Act 2023 compliant • Local cache encryption • Advanced record management
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-bold shrink-0">
              <span>Controls</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: HOSPITAL & ER SETUP */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              B. HOSPITAL & ER SETUP
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {canEditFacility ? "Department Leadership Controls" : "Read-Only Department Identity"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          {canEditFacility ? (
            <>
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Facility Configuration & Bed Allocation</span>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full font-mono font-bold">
                    HOD / Admin
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sets institutional branding and canonical ER bed capacity used by MATE bed resolver, census, and triage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hospital Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                    Hospital / Institution Name
                  </label>
                  <input
                    type="text"
                    value={facilityHospitalName}
                    onChange={(e) => setFacilityHospitalName(e.target.value)}
                    placeholder="e.g. Rajagiri Emergency Care"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                {/* ER Department Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                    ER / Department Name
                  </label>
                  <input
                    type="text"
                    value={facilityDepartment}
                    onChange={(e) => setFacilityDepartment(e.target.value)}
                    placeholder="e.g. Emergency & Trauma Medicine"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                {/* Specialty */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                    Specialty
                  </label>
                  <input
                    type="text"
                    value={facilitySpecialty}
                    onChange={(e) => setFacilitySpecialty(e.target.value)}
                    placeholder="e.g. Emergency Medicine & Trauma Resuscitation"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                {/* ER Physical Bed Capacity */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                      ER Physical Bed Capacity
                    </label>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Canonical MATE Bed Limit
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={facilityBedCapacity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setFacilityBedCapacity(isNaN(val) ? 1 : Math.max(1, val));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                    Enter the number of physical ER bed locations. MATE uses this to validate bed numbers and A/B subdivisions.
                  </p>
                </div>

                {/* Team Core Identifier */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                    Team Core Identifier
                  </label>
                  <input
                    type="text"
                    value={facilityTeamCore}
                    onChange={(e) => setFacilityTeamCore(e.target.value)}
                    placeholder="e.g. EM Trauma Response Core"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                {/* Theme Accent */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase">
                    Brand Theme Accent
                  </label>
                  <div className="grid grid-cols-4 gap-2 pt-0.5">
                    {(["indigo", "emerald", "blue", "violet"] as const).map((accent) => (
                      <button
                        key={accent}
                        type="button"
                        onClick={() => setFacilityThemeAccent(accent)}
                        className={`py-1.5 rounded-xl text-xs font-bold font-mono capitalize border transition-all cursor-pointer ${
                          facilityThemeAccent === accent
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-800 font-black shadow-xs"
                            : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        {accent}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {facilitySavedNotice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{facilitySavedNotice}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveFacilitySettings}
                  disabled={savingFacility}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-mono"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingFacility ? "Saving..." : "Save Facility & Bed Capacity"}</span>
                </button>
              </div>
            </>
          ) : (
            /* Read-Only View for Non-HOD Clinicians */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeHospitalName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Emergency Medicine & Trauma Resuscitation Core
                  </p>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono font-bold px-2 py-0.5 rounded-full">
                  Verified Facility
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block">PHYSICAL BEDS</span>
                  <strong className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                    {erPhysicalBedCapacity || 30} Beds
                  </strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block">DEPARTMENT LEAD</span>
                  <strong className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {(() => {
                      const hod = teamMembers.find(m => m.role?.toLowerCase().includes("hod") || m.role?.toLowerCase().includes("head"));
                      return hod ? `Dr. ${hod.name}` : "HOD Emergency";
                    })()}
                  </strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-mono text-slate-400 block">STATUS</span>
                  <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Live Sync
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 font-mono pt-1">
                Facility parameters and ER bed capacity are managed by your Department Head (HOD).
              </p>
            </div>
          )}
        </div>
      </section>

      {/* SECTION C: TEAM & SUBSCRIPTION */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              C. TEAM & SUBSCRIPTION
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Canonical Workplace Plan</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isMembershipActive ? "Team Plan" : "Individual Plan"}
                </h3>
                <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                  isMembershipActive 
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : isMembershipPending
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }`}>
                  {isMembershipActive ? "Active" : isMembershipPending ? "Invitation awaiting approval" : "Not joined"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isMembershipActive 
                  ? `Covered by ${activeHospitalName} team subscription.`
                  : isMembershipPending 
                    ? "Invitation submitted — awaiting authorization from department lead."
                    : "Your personal ErMate workspace."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab("team")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer font-mono shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Open Team Roster</span>
            </button>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Plan</span>
              <strong className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">
                {isMembershipActive ? "Team Plan" : "Individual Plan"}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Managed By</span>
              <strong className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {isMembershipActive ? activeHospitalName : "Self"}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Team</span>
              <strong className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {isMembershipActive ? activeHospitalName : "Independent Clinician"}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Membership</span>
              <strong className={`text-xs font-bold mt-0.5 block font-mono ${
                isMembershipActive ? "text-emerald-600 dark:text-emerald-400" : isMembershipPending ? "text-amber-500" : "text-slate-500"
              }`}>
                {isMembershipActive ? "Active" : isMembershipPending ? "Pending" : "Not Joined"}
              </strong>
            </div>
          </div>

          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-mono leading-relaxed">
            Note: Every clinician begins with an Individual Plan. When you join an approved hospital team on ErMate, your account automatically shifts to the Hospital Team Plan without requiring manual upgrades.
          </p>
        </div>
      </section>

      {/* SECTION D: MY WORK / CLINICAL TOOLS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              D. MY WORK / CLINICAL TOOLS
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Department Registries & Modules</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Clinical Knowledge & Learn */}
          <div
            onClick={() => onNavigateToTab("learn")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <BookOpen className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Clinical Learn & Protocols
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Evidence-based emergency algorithms, ATLS resuscitation guides, and reference material.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>Open Learn Hub</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Emergency Tools & Calculators */}
          <div
            onClick={() => onNavigateToTab("tools")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Wrench className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Emergency Tools & Calculators
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pediatric weight-based dosing, clinical scores (GCS, Wells, HEART, NIHSS), and resuscitation aids.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-teal-600 dark:text-teal-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>Open Tools</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. My Log Book */}
          <div
            onClick={() => onNavigateToTab("logbook")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Award className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                My Log Book
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                International standard clinical logs for resuscitation, procedures, and patient cases.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>Open Log Book</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 4. Clinical Analytics & KPIs */}
          <div
            onClick={() => onNavigateToTab("analytics")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-rose-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Clinical Analytics & KPIs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Triage acuity distribution, P1 resuscitation metrics, and case volume trends.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>View Analytics</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 5. Incoming Handovers */}
          <div
            onClick={() => onNavigateToTab("handover")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <RefreshCcw className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Incoming Handovers
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Shift transfer sheets, verbal handover logs, and pending sign-offs.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>View Handovers ({handovers.length})</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 6. Medico-Legal (MLC) Certificates */}
          <div
            onClick={() => onNavigateToTab("mlc")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-orange-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <FileWarning className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Medico-Legal (MLC) Certificates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Draft, sign, and print Medico-Legal case certificates & police intimations.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-orange-600 dark:text-orange-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>Open MLC Registry</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 7. Clinician Directory */}
          <div
            onClick={() => onNavigateToTab("directory")}
            className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Clinician Directory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Find and connect with verified emergency physicians across state departments.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span>Open Directory</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 6. Mortality Audit (HOD & Consultant) */}
          {(isHOD || isConsultant) && (
            <div
              onClick={() => setActiveModal("mortality")}
              className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-red-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Mortality & M&M Audit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Conduct clinical case deconstructions, mortality reviews, and debrief notes.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <span>Open M&M Suite</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* 7. Self-Learning Rules Panel (HOD / Admin) */}
          {isHOD && (
            <div
              onClick={() => setActiveModal("self-learning")}
              className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Self-Learning Rules
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Review clinician AI feedback corrections and hospital-specific guidelines.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-teal-600 dark:text-teal-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <span>Manage Rules</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION E: HELP & APP SETTINGS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              E. HELP & APP SETTINGS
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">App Configuration & Support</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
          {/* Theme / Display Mode */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono uppercase block">
              DISPLAY MODE
            </label>
            <div className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-800">
              {[
                { id: "auto" as const, label: "Auto (9pm-6am)" },
                { id: "light" as const, label: "Always Light" },
                { id: "dark" as const, label: "Always Dark" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleDisplayModeChange(m.id)}
                  className={`flex-1 py-1.5 px-2 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    displayMode === m.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-slate-400 font-mono">
              {displayMode === "auto"
                ? "Auto shift mode: Night mode activates during evening and night shifts."
                : displayMode === "dark"
                  ? "Always Dark: High-contrast dark room theme."
                  : "Always Light: Standard daylight medical illumination."}
            </p>
          </div>

          {/* Quick Support & Guide Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal("notifications")}
              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">Notifications</strong>
                  <span className="text-[10px] text-slate-400 font-mono">Alert preferences</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onOpenUpdatesModal}
              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-teal-500 shrink-0" />
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">What's New</strong>
                  <span className="text-[10px] text-slate-400 font-mono">Changelog & Updates</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("support")}
              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">Help & Support</strong>
                  <span className="text-[10px] text-slate-400 font-mono">Ops desk contact</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("about")}
              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">About ErMate</strong>
                  <span className="text-[10px] text-slate-400 font-mono">ErMate v{APP_VERSION}</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Sign Out Button */}
          {onSignOut && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-3 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/30 dark:text-slate-200 dark:hover:text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer font-mono"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout from Clinical Session</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <div className="text-center pt-2 font-mono text-[11px] text-slate-400">
        ErMate v3.0 • Certified ATLS Protocol Engine • DPDP Act 2023 Compliant • End-to-End Encrypted
      </div>

      {/* ----------------- SUBSECTION MODALS ----------------- */}

      {/* 1. Profile Edit Modal */}
      {activeModal === "profile" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Profile Credentials</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileDetails} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">Doctor Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">Qualifications</label>
                <input
                  type="text"
                  value={editQualifications}
                  onChange={(e) => setEditQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD Emergency Medicine, FACEM"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">GMC / State Registration No.</label>
                <input
                  type="text"
                  value={editRegNo}
                  onChange={(e) => setEditRegNo(e.target.value)}
                  placeholder="e.g. KMC/104928"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">Phone Number</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              {profileSavedNotice && (
                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl text-center">
                  ✓ Profile updated successfully!
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Role Modal (RoleChangeSection) */}
      {activeModal === "role" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Role & Workplace Governance</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profile && (
              <RoleChangeSection
                currentProfile={profile}
                onSaveProfile={(updated) => {
                  if (onSaveProfile) onSaveProfile(updated);
                  setActiveModal(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 3. Security Modal */}
      {activeModal === "security" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Security & Access PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Session Quick-Unlock PIN</span>
                  <button
                    type="button"
                    onClick={() => setPinEnabled(!pinEnabled)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-all ${
                      pinEnabled ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pinEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                {pinEnabled && (
                  <div className="pt-1">
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">4-Digit Shift Unlock PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={sessionPin}
                      onChange={(e) => setSessionPin(e.target.value)}
                      className="w-24 text-center font-mono font-bold tracking-widest text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Biometric Screen Lock</span>
                <p className="text-[11px] text-slate-400">
                  Fingerprint and Face ID unlock enabled on supported hospital mobile hardware.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Session Timeout</span>
                <p className="text-[11px] text-slate-400">
                  Auto-locks after 15 minutes of clinical inactivity to protect patient privacy.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Notifications Modal */}
      {activeModal === "notifications" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Clinical Notification Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <strong className="block text-slate-800 dark:text-slate-200">P1 Triage Resuscitation Alarms</strong>
                  <span className="text-[10px] text-slate-400">High-priority alert sound for incoming red cases</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClinicalAlertsOn(!clinicalAlertsOn)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                    clinicalAlertsOn ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {clinicalAlertsOn ? "ON" : "OFF"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <strong className="block text-slate-800 dark:text-slate-200">Shift Handover Transfers</strong>
                  <span className="text-[10px] text-slate-400">Pings when an outgoing doctor transfers a patient</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHandoverAlertsOn(!handoverAlertsOn)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                    handoverAlertsOn ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {handoverAlertsOn ? "ON" : "OFF"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <strong className="block text-slate-800 dark:text-slate-200">Critical Vitals Warning</strong>
                  <span className="text-[10px] text-slate-400">SpO2 &lt; 90% or SBP &lt; 80 mmHg audible chimes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVitalsAudioAlerts(!vitalsAudioAlerts)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                    vitalsAudioAlerts ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {vitalsAudioAlerts ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Privacy & Data Controls Modal (SAFE HOUSING FOR DELETE ALL CASES) */}
      {activeModal === "privacy" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Privacy & Data Governance</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <strong className="text-slate-900 dark:text-white">DPDP Act 2023 & ABDM Compliance</strong>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  All clinical reasoning executes on server-side de-identified streams. Direct identifiers (names, UHIDs, phone numbers, aadhaar) are never transmitted to overseas model inference endpoints.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <strong className="text-slate-800 dark:text-slate-200 block">Local Device Cache</strong>
                <p className="text-[11px] text-slate-400">
                  Patient records on this terminal: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{cases.length} records</span>. Records are synchronized to secure department Firestore and protected via client encryption.
                </p>
              </div>

              {/* DANGER ZONE: SAFELY COLLAPSED / GUARDED */}
              <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <strong className="text-xs uppercase font-mono tracking-wider">Advanced Data Management — Danger Zone</strong>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Purge cached clinical records on this terminal. This will not delete audit logs or verified team memberships.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-mono"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Local Case Records</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-red-500 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Data Purge</h3>
              <p className="text-xs text-slate-500 mt-1">
                Type <span className="font-mono font-bold text-red-600">DELETE ALL</span> to confirm purging all {cases.length} clinical records from this device.
              </p>
            </div>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE ALL"
              className="w-full text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 uppercase"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE ALL"}
                onClick={handleDeleteAllCasesSecure}
                className="flex-1 py-2.5 bg-red-600 disabled:opacity-40 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer font-mono"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Mortality Audit Modal */}
      {activeModal === "mortality" && (
        <MortalityAuditModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          profile={profile || ({} as any)}
          cases={cases}
        />
      )}

      {/* 7. Self-Learning Rules Modal */}
      {activeModal === "self-learning" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Self-Learning Rules Panel</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SelfLearningRulesPanel />
          </div>
        </div>
      )}

      {/* 8. Help & Support Modal */}
      {activeModal === "support" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Hospital Operations Support</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <strong className="block text-slate-900 dark:text-white font-bold">Clinical Operations Hotline</strong>
                <p className="text-slate-500 font-mono">support@ermate.in • 24/7 ER Onboarding Desk</p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <strong className="block text-slate-900 dark:text-white font-bold">Hardware Pairing & Voice Mic</strong>
                <p className="text-slate-500">
                  Bluetooth boundary microphones and desktop workstation pairing available through Team Roster settings.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. About Modal */}
      {activeModal === "about" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">About ErMate Clinical OS</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center py-2">
              <ErMateLogo variant="full" size="lg" showSubtitle={false} />
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                <strong className="text-slate-900 dark:text-white block font-bold">ErMate Clinical Operating System (v{APP_VERSION})</strong>
                Engineered for Emergency Departments, Resuscitation Bays, and Acute Care Wards.
              </p>
              <div className="space-y-1.5 font-mono text-[11px] pt-1">
                <p>• ATLS 10th Edition Clinical Architecture</p>
                <p>• DPDP Act 2023 Server-Side De-identification</p>
                <p>• Local AES Encrypted Persistence</p>
                <p>• Monotonic Sequence Case Identity Counter</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
