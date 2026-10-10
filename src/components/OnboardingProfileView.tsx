import React, { useState, useEffect } from "react";
import {
  User, Building2, Stethoscope, Bed, Sparkles, Check, ArrowRight,
  Shield, Users, Share2, Copy, CheckCircle2, AlertCircle, Eye, EyeOff,
  Edit3, Save, RotateCcw
} from "lucide-react";
import { UserProfile } from "../types";
import { ErMateLogo } from "./shared/ErMateLogo";
import { isClinicalProfileComplete, getProfileCompletenessDetails } from "../utils/profileCompleteness";
import { createHospitalWorkspace, createTeamInvite } from "../services/teamInviteService";

interface OnboardingProfileViewProps {
  profile: UserProfile | null;
  erPhysicalBedCapacity?: number | null;
  onSaveProfile: (updatedProfile: UserProfile, capacity?: number | null) => Promise<void>;
  onContinueToDashboard?: () => void;
  onSkipToTrial: () => void;
  onTeamCreated?: (hospitalId: string, hospitalName: string) => void;
  hasActiveTrialCase?: boolean;
  onSaveActiveTrialCase?: () => Promise<void> | void;
}

export const ROLE_OPTIONS = [
  "EM Resident",
  "Consultant",
  "Senior Consultant",
  "Medical Officer",
  "Emergency Physician",
  "EM Intern",
  "Fellow",
  "HOD / Department Lead",
  "Staff Nurse"
];

export const DEPARTMENT_OPTIONS = [
  "Emergency & Trauma Medicine",
  "Emergency Medicine",
  "Trauma Resuscitation Unit",
  "Pediatric Emergency",
  "Acute Care & Resuscitation",
  "Emergency Department"
];

export default function OnboardingProfileView({
  profile,
  erPhysicalBedCapacity,
  onSaveProfile,
  onContinueToDashboard,
  onSkipToTrial,
  onTeamCreated,
  hasActiveTrialCase = false,
  onSaveActiveTrialCase,
}: OnboardingProfileViewProps) {
  const initialCap =
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0
      ? erPhysicalBedCapacity
      : typeof (profile as any)?.erPhysicalBedCapacity === "number" && (profile as any).erPhysicalBedCapacity > 0
      ? (profile as any).erPhysicalBedCapacity
      : 30;

  // 1. Initial field values
  const [name, setName] = useState<string>(profile?.name || "Dr. ");
  const [role, setRole] = useState<string>(profile?.displayRole || profile?.role || "EM Resident");
  const [hospital, setHospital] = useState<string>(
    profile?.workplaceName || profile?.hospitalLabel || profile?.hospital || ""
  );
  const [department, setDepartment] = useState<string>(
    profile?.department || "Emergency & Trauma Medicine"
  );
  const [bedCapacity, setBedCapacity] = useState<number>(initialCap);

  // Saved values snapshot (to support Cancel in EDITING and render SAVED state)
  const [savedData, setSavedData] = useState<{
    name: string;
    role: string;
    hospital: string;
    department: string;
    bedCapacity: number;
  }>({
    name: profile?.name || "",
    role: profile?.displayRole || profile?.role || "EM Resident",
    hospital: profile?.workplaceName || profile?.hospitalLabel || profile?.hospital || "",
    department: profile?.department || "Emergency & Trauma Medicine",
    bedCapacity: initialCap,
  });

  const isInitiallyComplete = isClinicalProfileComplete(profile, erPhysicalBedCapacity);

  // Profile State Machine: "INCOMPLETE" | "SAVED" | "EDITING"
  const [profileMode, setProfileMode] = useState<"INCOMPLETE" | "SAVED" | "EDITING">(
    isInitiallyComplete ? "SAVED" : "INCOMPLETE"
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sub-step for optional team creation flow: "profile" | "team_create" | "invite_share"
  const [step, setStep] = useState<"profile" | "team_create" | "invite_share">("profile");

  // Keep savedData in sync with profile prop when it updates
  useEffect(() => {
    if (profile) {
      const cap =
        typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0
          ? erPhysicalBedCapacity
          : typeof (profile as any)?.erPhysicalBedCapacity === "number" && (profile as any).erPhysicalBedCapacity > 0
          ? (profile as any).erPhysicalBedCapacity
          : 30;
      setSavedData({
        name: profile.name || "",
        role: profile.displayRole || profile.role || "EM Resident",
        hospital: profile.workplaceName || profile.hospitalLabel || profile.hospital || "",
        department: profile.department || "Emergency & Trauma Medicine",
        bedCapacity: cap,
      });
      if (isClinicalProfileComplete(profile, erPhysicalBedCapacity) && profileMode === "INCOMPLETE") {
        setProfileMode("SAVED");
      }
    }
  }, [profile, erPhysicalBedCapacity]);

  // Team creation local state
  const [teamCustomName, setTeamCustomName] = useState<string>("");
  const [teamHospitalName, setTeamHospitalName] = useState<string>("");
  const [teamDepartment, setTeamDepartment] = useState<string>("");
  const [teamBedCapacity, setTeamBedCapacity] = useState<number>(30);
  const [creatingTeam, setCreatingTeam] = useState<boolean>(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Invite share state
  const [inviteLink, setInviteLink] = useState<string>("");
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  // Handle Profile Save / Save Changes
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanRole = role.trim();
    const cleanHospital = hospital.trim();
    const cleanDept = department.trim();
    const parsedCapacity = Math.floor(Number(bedCapacity));

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg("Please enter your doctor name (at least 2 characters).");
      return;
    }
    if (!cleanRole) {
      setErrorMsg("Please select or enter your professional role.");
      return;
    }
    if (!cleanHospital || cleanHospital.length < 2) {
      setErrorMsg("Please enter your hospital or workplace name.");
      return;
    }
    if (!cleanDept || cleanDept.length < 2) {
      setErrorMsg("Please specify your department.");
      return;
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0 || parsedCapacity > 1000) {
      setErrorMsg("ER Physical Bed Capacity must be a positive integer between 1 and 1000.");
      return;
    }

    setSaving(true);
    try {
      const updated: UserProfile = {
        ...(profile || {}),
        email: profile?.email || "",
        aiCredits: profile?.aiCredits ?? 100,
        streak: profile?.streak ?? 1,
        subscriptionTier: profile?.subscriptionTier || "Free Standard",
        name: cleanName,
        role: profile?.role || "EM Resident",
        displayRole: cleanRole,
        hospital: profile?.hospital || "",
        workplaceName: cleanHospital,
        hospitalLabel: cleanHospital,
        department: cleanDept,
        erPhysicalBedCapacity: parsedCapacity,
        onboardingComplete: true
      };

      await onSaveProfile(updated, parsedCapacity);

      // On successful Firestore save:
      setSavedData({
        name: cleanName,
        role: cleanRole,
        hospital: cleanHospital,
        department: cleanDept,
        bedCapacity: parsedCapacity,
      });

      // Pre-fill team creation defaults in case user optionally creates team
      setTeamCustomName(cleanHospital ? `${cleanHospital} ER Team` : "Emergency Team");
      setTeamHospitalName(cleanHospital);
      setTeamDepartment(cleanDept);
      setTeamBedCapacity(parsedCapacity);

      // Switch to SAVED state
      setProfileMode("SAVED");
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Profile save failed:", err);
      // SAVE FAILED: Keep entered values, display actionable error, offer Retry, NEVER switch to SAVED
      setErrorMsg(err?.message || "Failed to save profile. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Start Editing (populate fields from saved Firestore values)
  const handleStartEdit = () => {
    setName(savedData.name);
    setRole(savedData.role);
    setHospital(savedData.hospital);
    setDepartment(savedData.department);
    setBedCapacity(savedData.bedCapacity);
    setErrorMsg(null);
    setProfileMode("EDITING");
  };

  // Cancel Editing (restore previous saved values)
  const handleCancelEdit = () => {
    setName(savedData.name);
    setRole(savedData.role);
    setHospital(savedData.hospital);
    setDepartment(savedData.department);
    setBedCapacity(savedData.bedCapacity);
    setErrorMsg(null);
    setProfileMode("SAVED");
  };

  // Continue to Dashboard
  const handleContinueToDashboard = async () => {
    if (hasActiveTrialCase && onSaveActiveTrialCase) {
      try {
        await onSaveActiveTrialCase();
      } catch (err) {
        console.warn("Could not save active trial case:", err);
      }
    }
    if (onContinueToDashboard) {
      onContinueToDashboard();
    } else {
      onSkipToTrial();
    }
  };

  // Handle Team Creation Submit
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);

    const cleanHospital = teamHospitalName.trim();
    const cleanTeam = teamCustomName.trim() || `${cleanHospital} ER Team`;
    const cleanDept = teamDepartment.trim() || "Emergency Medicine";
    const parsedCap = Math.floor(Number(teamBedCapacity));

    if (!cleanHospital || cleanHospital.length < 2) {
      setTeamError("Please enter a valid hospital or workplace name.");
      return;
    }
    if (!Number.isInteger(parsedCap) || parsedCap <= 0 || parsedCap > 1000) {
      setTeamError("Bed capacity must be a positive integer between 1 and 1000.");
      return;
    }

    setCreatingTeam(true);
    try {
      const result = await createHospitalWorkspace(cleanHospital, cleanDept, parsedCap, cleanTeam, role);
      onTeamCreated?.(result.hospitalId, result.hospitalName);

      // Generate canonical invite link to share immediately
      try {
        const invite = await createTeamInvite({
          hospitalId: result.hospitalId,
          hospitalName: result.hospitalName,
          role: "resident",
          maxUses: 25,
        });
        setInviteLink(invite.link);
      } catch (invErr: any) {
        console.warn("Could not pre-generate invite link:", invErr);
      }

      setStep("invite_share");
    } catch (err: any) {
      console.error("Failed to create hospital workspace:", err);
      setTeamError(err?.message || "Failed to create hospital workspace.");
    } finally {
      setCreatingTeam(false);
    }
  };

  // Copy invite link
  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    } catch (e) {
      console.warn("Copy failed:", e);
    }
  };

  // Web Share API
  const handleShareInvite = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${teamHospitalName || "our"} Emergency Department on ErMate`,
          text: `You are invited to join the ${teamHospitalName || "Emergency Department"} team on ErMate for collaborative clinical workflows.`,
          url: inviteLink,
        });
      } catch (e) {
        // User cancelled or share failed
      }
    } else {
      handleCopyInvite();
    }
  };

  // ==========================================
  // STATE: SAVED (Read-Only Profile Summary)
  // ==========================================
  if (step === "profile" && profileMode === "SAVED") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <ErMateLogo size="md" variant="full" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Profile Saved & Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Individual Clinical Profile
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Your clinical identity is confirmed. Bedside documentation, Voice Scribe, and permanent individual case saving are enabled.
            </p>
          </div>

          {/* Active Trial Case Notice */}
          {hasActiveTrialCase && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="text-emerald-900 dark:text-emerald-200 font-bold block">
                  Trial Case Ready to Sync
                </strong>
                <p className="text-emerald-800 dark:text-emerald-300">
                  Your trial dictation is safely preserved and will synchronize to your persistent individual census when you enter the dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Read-only Profile Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Doctor Name</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block">
                    {savedData.name || "Doctor"}
                  </strong>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                {savedData.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-500" /> Hospital / Workplace
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {savedData.hospital || "Not Specified"}
                </p>
              </div>

              <div className="space-y-1 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-500" /> Department
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {savedData.department || "Emergency Medicine"}
                </p>
              </div>

              <div className="space-y-1 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
                    <Bed className="w-3 h-3 text-amber-500" /> Physical Bed Capacity
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {savedData.bedCapacity} Emergency Beds
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Ready for Bedside MATE
                </span>
              </div>
            </div>
          </div>

          {/* CTAs: Primary "Edit Profile", Secondary "Continue to Dashboard" */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleStartEdit}
              className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={handleContinueToDashboard}
              className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Optional Team Workspace creation card (Non-blocking) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Want to collaborate with colleagues? You can create or join an ER team anytime.
            </p>
            <button
              type="button"
              onClick={() => setStep("team_create")}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Create Team Workspace (Optional)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE: INCOMPLETE or EDITING (Form View)
  // ==========================================
  if (step === "profile" && (profileMode === "INCOMPLETE" || profileMode === "EDITING")) {
    const isEditing = profileMode === "EDITING";

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <ErMateLogo size="md" variant="full" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {isEditing ? "Edit Clinical Profile" : "Complete Your ErMate Profile"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {isEditing
                ? "Update your clinical identity, workplace details, or bed capacity."
                : "Set up your clinical identity to enable permanent case saving, Voice Scribe, and bedside documentation."}
            </p>
          </div>

          {/* Active Trial Case Notice (if in incomplete mode) */}
          {hasActiveTrialCase && !isEditing && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="text-amber-900 dark:text-amber-200 font-bold block">
                  Active Clinical Draft Preserved
                </strong>
                <p className="text-amber-800 dark:text-amber-300">
                  Your current trial dictation will remain safely in memory and can be permanently saved once your profile is completed.
                </p>
              </div>
            </div>
          )}

          {/* Actionable Error Banner (SAVE FAILED state) */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <strong className="font-bold block">Save Error</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Profile Form */}
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* 1. Doctor Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>Doctor Name *</span>
              </label>
              <input
                type="text"
                disabled={saving}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Sarah Rao"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                required
              />
            </div>

            {/* 2. Professional Role */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />
                <span>Professional Role *</span>
              </label>
              <select
                disabled={saving}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                required
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                Informational clinical credential.
              </span>
            </div>

            {/* 3. Hospital / Workplace Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Hospital / Workplace Name *</span>
              </label>
              <input
                type="text"
                disabled={saving}
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="e.g. City General Hospital"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                required
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                Personal workplace metadata. Every clinician starts in an Individual workspace.
              </span>
            </div>

            {/* 4. Department */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-500" />
                <span>Department *</span>
              </label>
              <input
                type="text"
                disabled={saving}
                list="dept-options"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Emergency & Trauma Medicine"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                required
              />
              <datalist id="dept-options">
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept} value={dept} />
                ))}
              </datalist>
            </div>

            {/* 5. ER Physical Bed Capacity */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
                <Bed className="w-3.5 h-3.5 text-amber-500" />
                <span>ER Physical Bed Capacity *</span>
              </label>
              <input
                type="number"
                disabled={saving}
                min={1}
                max={1000}
                value={bedCapacity}
                onChange={(e) => setBedCapacity(parseInt(e.target.value, 10) || 0)}
                placeholder="e.g. 30"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                required
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                Total physical emergency beds (1..1000) for MATE bedside referencing.
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="pt-3 space-y-2.5">
              {isEditing ? (
                <>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleCancelEdit}
                    className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer text-center disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Profile & Save</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={onSkipToTrial}
                    className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer text-center disabled:opacity-50"
                  >
                    Skip for now — Explore in Trial Mode
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE: Optional Create Team Workspace Form
  // ==========================================
  if (step === "team_create") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Create Team Workspace
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You will become the first Team Admin for this workspace while preserving your professional clinical designation.
            </p>
          </div>

          {teamError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠️ {teamError}
            </div>
          )}

          <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                Team Name *
              </label>
              <input
                type="text"
                value={teamCustomName}
                onChange={(e) => setTeamCustomName(e.target.value)}
                placeholder="e.g. City ER Team"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                Hospital or Workplace Name *
              </label>
              <input
                type="text"
                value={teamHospitalName}
                onChange={(e) => setTeamHospitalName(e.target.value)}
                placeholder="e.g. City General Hospital"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                Department
              </label>
              <input
                type="text"
                value={teamDepartment}
                onChange={(e) => setTeamDepartment(e.target.value)}
                placeholder="e.g. Emergency & Trauma Medicine"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                ER Physical Bed Capacity (1–1000) *
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={teamBedCapacity}
                onChange={(e) => setTeamBedCapacity(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={creatingTeam}
                className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creatingTeam ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Create Hospital Workspace</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("profile")}
                className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // STATE: Share Team Invite Link
  // ==========================================
  if (step === "invite_share") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Your Emergency Department Workspace is ready!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Invite your team members to join {teamHospitalName}. They will immediately share census, handovers, and rota.
            </p>
          </div>

          {inviteLink ? (
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-left">
              <label className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                Canonical Team Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInvite ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              You can generate invitation links anytime from More → Team Roster.
            </p>
          )}

          <div className="space-y-2.5 pt-2">
            {inviteLink && (
              <button
                type="button"
                onClick={handleShareInvite}
                className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Invitation Link</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleContinueToDashboard}
              className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
