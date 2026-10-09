import React, { useState } from "react";
import {
  User, Building2, Stethoscope, Bed, Sparkles, Check, ArrowRight,
  Shield, Users, Share2, Copy, CheckCircle2, AlertCircle, Eye, EyeOff
} from "lucide-react";
import { UserProfile } from "../types";
import { ErMateLogo } from "./shared/ErMateLogo";
import { isClinicalProfileComplete, getProfileCompletenessDetails } from "../utils/profileCompleteness";
import { createHospitalWorkspace, createTeamInvite } from "../services/teamInviteService";

interface OnboardingProfileViewProps {
  profile: UserProfile | null;
  erPhysicalBedCapacity?: number | null;
  onSaveProfile: (updatedProfile: UserProfile, capacity?: number | null) => Promise<void> | void;
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
  onSkipToTrial,
  onTeamCreated,
  hasActiveTrialCase = false,
  onSaveActiveTrialCase,
}: OnboardingProfileViewProps) {
  // 1. Initial field values
  const [name, setName] = useState<string>(profile?.name || "Dr. ");
  const [role, setRole] = useState<string>(profile?.role || "EM Resident");
  const [hospital, setHospital] = useState<string>(
    profile?.workplaceName || profile?.hospital || profile?.hospitalLabel || ""
  );
  const [department, setDepartment] = useState<string>(
    profile?.department || "Emergency & Trauma Medicine"
  );
  const [bedCapacity, setBedCapacity] = useState<number>(
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0
      ? erPhysicalBedCapacity
      : typeof (profile as any)?.erPhysicalBedCapacity === "number" && (profile as any).erPhysicalBedCapacity > 0
      ? (profile as any).erPhysicalBedCapacity
      : 30
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Post-Profile Step Machine:
  // "profile_form" -> "team_question" -> "team_create" -> "invite_share" -> "done"
  const [step, setStep] = useState<"profile_form" | "team_question" | "team_create" | "invite_share">(
    "profile_form"
  );

  // Team creation local state
  const [teamHospitalName, setTeamHospitalName] = useState<string>("");
  const [teamDepartment, setTeamDepartment] = useState<string>("");
  const [teamBedCapacity, setTeamBedCapacity] = useState<number>(30);
  const [creatingTeam, setCreatingTeam] = useState<boolean>(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Invite share state
  const [inviteLink, setInviteLink] = useState<string>("");
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  // Handle Profile Save
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
        name: cleanName,
        email: profile?.email || "",
        role: cleanRole,
        hospital: cleanHospital,
        workplaceName: cleanHospital,
        department: cleanDept,
        erPhysicalBedCapacity: parsedCapacity,
        aiCredits: profile?.aiCredits ?? 100,
        streak: profile?.streak ?? 1,
        subscriptionTier: profile?.subscriptionTier || "Free Standard",
        onboardingComplete: true,
        ...(profile || {}),
      };

      await onSaveProfile(updated, parsedCapacity);

      // Pre-fill team creation defaults from newly completed profile
      setTeamHospitalName(cleanHospital);
      setTeamDepartment(cleanDept);
      setTeamBedCapacity(parsedCapacity);

      // Advance to Step 8: Post-profile team question
      setStep("team_question");
    } catch (err: any) {
      console.error("Profile save failed:", err);
      setErrorMsg(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Team Creation
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);

    const cleanTeamName = teamHospitalName.trim();
    const cleanDept = teamDepartment.trim();
    const parsedCap = Math.floor(Number(teamBedCapacity));

    if (!cleanTeamName || cleanTeamName.length < 2) {
      setTeamError("Please enter a valid hospital or workspace name.");
      return;
    }
    if (!Number.isInteger(parsedCap) || parsedCap <= 0 || parsedCap > 1000) {
      setTeamError("Bed capacity must be a positive integer between 1 and 1000.");
      return;
    }

    setCreatingTeam(true);
    try {
      const result = await createHospitalWorkspace(cleanTeamName, cleanDept, parsedCap);
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

  // Render Step 1: Complete Your ErMate Profile
  if (step === "profile_form") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <ErMateLogo size="md" variant="full" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Complete Your ErMate Profile
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Set up your clinical identity to enable permanent case saving, Voice Scribe, and bedside documentation.
            </p>
          </div>

          {/* Active Trial Case Notice */}
          {hasActiveTrialCase && (
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

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠️ {errorMsg}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Sarah Rao"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
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
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
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
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="e.g. City General Hospital"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
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
                list="dept-options"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Emergency & Trauma Medicine"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
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
                min={1}
                max={1000}
                value={bedCapacity}
                onChange={(e) => setBedCapacity(parseInt(e.target.value, 10) || 0)}
                placeholder="e.g. 30"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                required
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Total physical emergency beds (1..1000) for MATE bedside referencing.
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="pt-3 space-y-2.5">
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Profile & Enable Saving</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onSkipToTrial}
                className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Skip for now — Explore in Trial Mode
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Step 2: Post-Profile Team Question Modal
  if (step === "team_question") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
            <Users className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
              Optional Step
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Work with a team?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Create a shared Emergency Department workspace for your clinicians, cases, handovers, rota, and team workflows.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => setStep("team_create")}
              className="w-full min-h-[46px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Create Team Workspace</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (hasActiveTrialCase && onSaveActiveTrialCase) {
                  await onSaveActiveTrialCase();
                }
                onSkipToTrial(); // Closes modal and opens Dashboard
              }}
              className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Not Now (Continue as Individual)
            </button>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            You can always create or join a team later from More → Team Roster.
          </p>
        </div>
      </div>
    );
  }

  // Render Step 3: Create Team Workspace Form
  if (step === "team_create") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Create Hospital Workspace
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You will be registered as the verified department lead (HOD) for this workspace.
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
                Team / Hospital Workspace Name *
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
                Bed Capacity
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
                onClick={() => setStep("team_question")}
                className="w-full min-h-[40px] py-2 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Step 4: Share Team Invite Link
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
              onClick={async () => {
                if (hasActiveTrialCase && onSaveActiveTrialCase) {
                  await onSaveActiveTrialCase();
                }
                onSkipToTrial(); // Return to Dashboard
              }}
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
