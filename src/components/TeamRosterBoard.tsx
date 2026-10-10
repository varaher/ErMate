import { WorkspaceRotaSyncModal } from "./shared/WorkspaceRotaSyncModal";
import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, Plus, Trash2, Shield, Clock, Search, UserCheck, 
  UserX, ShieldAlert, CheckCircle2, Mail, Calendar, Sparkles,
  Building2, Link, Copy, Check, ChevronRight, ClipboardList,
  LayoutDashboard, Settings, Share2, QrCode, UserPlus, Activity,
  RefreshCw, Send, ShieldCheck, X, AlertCircle
} from "lucide-react";
import { TeamMember, UserProfile, ClinicalCase, isPendingApprovalStatus, isActiveMembershipStatus } from "../types";
import GoogleCalendarModal from "./GoogleCalendarModal";
import { createTeamInvite, createHospitalWorkspace, acceptSecureTeamInvite, regenerateTeamInvite, revokeTeamInvite, verifyTeamInstitution, requestToJoinTeam, setTeamAdminRole, setTeamRotaManagerRole } from "../services/teamInviteService";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export const ROTA_SHIFTS = [
  { id: "morning", name: "Morning", time: "08:00 - 14:00", color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20" },
  { id: "evening", name: "Evening", time: "14:00 - 20:00", color: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-400/10 dark:border-orange-400/20" },
  { id: "night", name: "Night", time: "20:00 - 08:00", color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-400/10 dark:border-indigo-400/20" },
  { id: "off", name: "Off Shift", time: "Off Duty", color: "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-400/10 dark:border-slate-400/20" },
  { id: "d1", name: "D1 Shift", time: "08:00 - 18:00", color: "text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-400/10 dark:border-teal-400/20" },
  { id: "d2", name: "D2 Shift", time: "18:00 - 08:00", color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-400/20" },
  { id: "g1", name: "G1 Shift", time: "08:00 - 16:00", color: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-400/10 dark:border-cyan-400/20" },
  { id: "g2", name: "G2 Shift", time: "12:00 - 20:00", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20" },
];

export const SHIFT_COLOR_OPTIONS = [
  { label: "Amber / Morning", color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20" },
  { label: "Orange / Evening", color: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-400/10 dark:border-orange-400/20" },
  { label: "Indigo / Night", color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-400/10 dark:border-indigo-400/20" },
  { label: "Slate / Off Duty", color: "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-400/10 dark:border-slate-400/20" },
  { label: "Teal / D1 Shift", color: "text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-400/10 dark:border-teal-400/20" },
  { label: "Rose / D2 Shift", color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-400/20" },
  { label: "Cyan / G1 Shift", color: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-400/10 dark:border-cyan-400/20" },
  { label: "Emerald / G2 Shift", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20" },
  { label: "Purple / Resus", color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-400/10 dark:border-purple-400/20" },
  { label: "Blue / Triage", color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-400/10 dark:border-blue-400/20" },
];

export interface TeamRosterBoardProps {
  teamMembers: TeamMember[];
  profile: UserProfile;
  cases?: ClinicalCase[];
  onSaveCase?: (updatedCase: ClinicalCase) => Promise<void>;
  onAddMember: (name: string, email: string, role: string, shift: string) => Promise<void> | void;
  onRemoveMember: (id: string) => Promise<void> | void;
  onUpdateShift: (id: string, shift: string) => Promise<void> | void;
  onApproveMember?: (id: string, role?: string, isTeamAdmin?: boolean) => Promise<void> | void;
  onDeclineMember?: (id: string) => Promise<void> | void;
  onUpdateRole?: (id: string, role: string) => Promise<void> | void;
  hospitalSubscriptionActive?: boolean;
  shifts?: any[];
  onUpdateShifts?: (newShifts: any[]) => Promise<void> | void;
  hospitalName?: string;
  onHospitalChange?: (name: string) => void;
  onSaveConfig?: (teamName: string, department: string, teamColor: "emerald" | "blue" | "indigo" | "violet") => void;
  onLeaveTeam?: () => Promise<void>;
  erPhysicalBedCapacity?: number | null;
  onUpdateBedCapacity?: (newCapacity: number) => Promise<void> | void;
}

export type TeamSectionTab = "overview" | "members" | "rota" | "settings";

export default function TeamRosterBoard({
  teamMembers,
  profile,
  cases = [],
  onSaveCase,
  onAddMember,
  onRemoveMember,
  onUpdateShift,
  onApproveMember,
  onDeclineMember,
  onUpdateRole,
  hospitalSubscriptionActive = false,
  shifts = [],
  onUpdateShifts,
  hospitalName = "",
  onHospitalChange,
  onSaveConfig,
  onLeaveTeam,
  erPhysicalBedCapacity = 30,
  onUpdateBedCapacity,
}: TeamRosterBoardProps) {
  // Navigation Tabs: 1. OVERVIEW, 2. MEMBERS, 3. ROTA, 4. SETTINGS
  const [activeTab, setActiveTab] = useState<TeamSectionTab>("overview");

  // Active dynamic shifts
  const activeShifts = shifts && shifts.length > 0 ? shifts : ROTA_SHIFTS;
  const [editedShifts, setEditedShifts] = useState<any[]>([]);

  useEffect(() => {
    setEditedShifts(JSON.parse(JSON.stringify(activeShifts)));
  }, [shifts, activeShifts]);

  // Modal and state controllers
  const [showShiftManagerModal, setShowShiftManagerModal] = useState(false);
  const [isAddingNewShift, setIsAddingNewShift] = useState(false);
  const [showWorkspaceSync, setShowWorkspaceSync] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Add shift state
  const [addShiftName, setAddShiftName] = useState("");
  const [addShiftTime, setAddShiftTime] = useState("");
  const [addShiftColor, setAddShiftColor] = useState(SHIFT_COLOR_OPTIONS[0].color);
  const [shiftActionMsg, setShiftActionMsg] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");

  // Handover state
  const [selectedMemberForCases, setSelectedMemberForCases] = useState<TeamMember | null>(null);
  const [selectedCaseIdsToTake, setSelectedCaseIdsToTake] = useState<string[]>([]);
  const [handoverInProgress, setHandoverInProgress] = useState(false);
  const [handoverSuccessMsg, setHandoverSuccessMsg] = useState("");

  // Add Clinician Form State
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("EM Resident");
  const [newShift, setNewShift] = useState("morning");
  const [bulkEmailsText, setBulkEmailsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Workplace Settings State
  const [workplaceInput, setWorkplaceInput] = useState(hospitalName || profile.workplaceName || profile.hospital || "");
  const [teamNameInput, setTeamNameInput] = useState(profile.teamName || "EM Trauma Response Core");
  const [departmentInput, setDepartmentInput] = useState(profile.department || "Emergency & Trauma Medicine");
  const [teamColorInput, setTeamColorInput] = useState<"emerald" | "blue" | "indigo" | "violet">(profile.teamColor || "blue");
  const [bedCapacityInput, setBedCapacityInput] = useState<number>(
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0 ? erPhysicalBedCapacity : 30
  );
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  useEffect(() => {
    if (typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0) {
      setBedCapacityInput(erPhysicalBedCapacity);
    }
  }, [erPhysicalBedCapacity]);

  // Sandbox Simulator State
  const [selectedSimEmail, setSelectedSimEmail] = useState("");

  // Calendar sync modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarModalConfig, setCalendarModalConfig] = useState<{
    defaultEventType: "shift" | "audit" | "handover";
    initialTitle: string;
    initialDescription: string;
    initialStartTime: string;
    initialEndTime: string;
  }>({
    defaultEventType: "shift",
    initialTitle: `ER Duty Shift — ${profile.hospital || "Hospital"}`,
    initialDescription: `Assigned duty shift for Dr. ${profile.name} at ${profile.hospital || "Emergency Department"}.`,
    initialStartTime: "08:00",
    initialEndTime: "14:00",
  });

  const userEmailLower = profile.email.toLowerCase().trim();
  const isPlatformAdmin = userEmailLower === "varahgrp@gmail.com";

  // CORE PRODUCT RULE:
  // Professional role != Team membership.
  // Team authorization role exists ONLY when there is a valid, active, verified team_members document.
  const myCanonicalMember = teamMembers.find(
    (m) =>
      (m.email || "").toLowerCase().trim() === userEmailLower ||
      (auth.currentUser && (m.uid === auth.currentUser.uid || m.id === auth.currentUser.uid))
  );

  const isTeamMember = isPlatformAdmin || Boolean(
    myCanonicalMember &&
    isActiveMembershipStatus(myCanonicalMember.status)
  );

  const isUserTeamAdmin = isPlatformAdmin || Boolean(
    myCanonicalMember &&
    isActiveMembershipStatus(myCanonicalMember.status) &&
    (
      myCanonicalMember.isTeamAdmin === true ||
      myCanonicalMember.teamRole === "admin" ||
      myCanonicalMember.isAdmin === true ||
      (myCanonicalMember.membershipVerified === true && ["hod", "hod / department lead", "hod / shift lead"].includes(
        String(myCanonicalMember.role || "").trim().toLowerCase()
      ))
    )
  );

  const isCanonicalTeamMember = isTeamMember;
  const isUserHOD = isUserTeamAdmin;

  // Requirement E: Rota manager is a separate permission from HOD and Team Admin
  const isRotaManager = isPlatformAdmin || Boolean(
    myCanonicalMember &&
    isActiveMembershipStatus(myCanonicalMember.status) &&
    (
      myCanonicalMember.isRotaManager === true ||
      myCanonicalMember.rotaManager === true ||
      isUserTeamAdmin
    )
  );

  const isInstitutionalVerified = Boolean(
    myCanonicalMember &&
    myCanonicalMember.membershipVerified === true &&
    myCanonicalMember.verificationStatus === "verified"
  );

  // Individual Workspace Transition States (Option 1 & Option 2)
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState(profile.workplaceName ? `${profile.workplaceName} Emergency Team` : "");
  const [newHospitalName, setNewHospitalName] = useState(profile.workplaceName || profile.hospital || "");
  const [newDepartmentName, setNewDepartmentName] = useState(profile.department || "Emergency Medicine");
  const [newBedCapacity, setNewBedCapacity] = useState<number>(
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0 ? erPhysicalBedCapacity : 30
  );
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);
  const [teamCreatedSuccessNotice, setTeamCreatedSuccessNotice] = useState<string | null>(null);
  const [inviteCopiedNotice, setInviteCopiedNotice] = useState<string | null>(null);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [approvalAdminStatus, setApprovalAdminStatus] = useState<Record<string, boolean>>({});

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState("");
  const [isJoiningTeam, setIsJoiningTeam] = useState(false);
  const [joinTeamError, setJoinTeamError] = useState<string | null>(null);

  const handleCreateHospitalWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTeamError(null);
    const cleanHospital = newHospitalName.trim();
    if (!cleanHospital || cleanHospital.length < 2) {
      setCreateTeamError("Please enter a valid hospital or workplace name (at least 2 characters).");
      return;
    }
    const cleanTeam = newTeamName.trim() || `${cleanHospital} Emergency Team`;
    const cleanDept = newDepartmentName.trim() || "Emergency Medicine";
    const rawCap = Number(newBedCapacity);
    if (isNaN(rawCap) || !Number.isInteger(rawCap) || rawCap < 1 || rawCap > 1000) {
      setCreateTeamError("ER Physical Bed Capacity must be a whole number between 1 and 1000.");
      return;
    }
    const cap = rawCap;

    setIsCreatingTeam(true);
    try {
      await createHospitalWorkspace(
        cleanHospital,
        cleanDept,
        cap,
        cleanTeam,
        profile.role
      );
      setShowCreateTeamModal(false);
      setTeamCreatedSuccessNotice("Your team has been created.");
      setTimeout(() => setTeamCreatedSuccessNotice(null), 5000);
      window.location.reload();
    } catch (err: any) {
      setCreateTeamError(err?.message || "Failed to create team workspace.");
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleAcceptInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinTeamError(null);
    if (!joinTokenInput.trim()) {
      setJoinTeamError("Please enter a valid invitation code or link.");
      return;
    }
    setIsJoiningTeam(true);
    try {
      const res = await requestToJoinTeam(joinTokenInput.trim(), profile.role);
      setShowJoinModal(false);
      alert(res.message || "Join request sent. Waiting for Admin approval.");
      window.location.reload();
    } catch (err: any) {
      setJoinTeamError(err?.message || "Failed to submit join request.");
    } finally {
      setIsJoiningTeam(false);
    }
  };

  const handleVerifyTeamInstitution = async () => {
    if (!isPlatformAdmin) return;
    const teamId = myCanonicalMember?.teamId || myCanonicalMember?.hospitalId || workplaceInput;
    if (!teamId) return;
    try {
      const res = await verifyTeamInstitution(teamId, true);
      alert(res.message || "Team has been institutionally verified.");
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed to verify institution.");
    }
  };

  type InviteGenerationStatus = "idle" | "loading" | "success" | "error";
  const [inviteStatus, setInviteStatus] = useState<InviteGenerationStatus>("idle");
  const [inviteGenerationError, setInviteGenerationError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string>("");

  const activeHospitalName = (workplaceInput || profile.workplaceName || profile.hospital || "Emergency Department").trim();

  const resolveCanonicalHospitalScope = useCallback(async (): Promise<{ hospitalId?: string; hospitalName?: string }> => {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }

    const user = auth.currentUser;
    const userEmail = (user.email || "").trim().toLowerCase();
    const isPlatformAdmin = userEmail === "varahgrp@gmail.com";

    let canonicalHospitalId: string | undefined;
    let canonicalHospitalName: string | undefined;

    // 1. Resolve from canonical team_members/{uid}
    const memberSnap = await getDoc(doc(db, "team_members", user.uid));
    if (memberSnap.exists()) {
      const memberData = memberSnap.data() as any;
      const status = String(memberData.status || "");
      const isMemberAdmin = memberData.isTeamAdmin === true || memberData.teamRole === "admin" || memberData.isAdmin === true || ["hod", "hod / department lead", "hod / shift lead"].includes(String(memberData.role || "").toLowerCase());

      if (memberData.teamId && String(memberData.teamId).trim()) {
        canonicalHospitalId = String(memberData.teamId).trim();
        canonicalHospitalName = String(memberData.teamName || memberData.hospitalName || memberData.hospital || "").trim();
      } else if (memberData.hospitalId && String(memberData.hospitalId).trim()) {
        canonicalHospitalId = String(memberData.hospitalId).trim();
        canonicalHospitalName = String(memberData.hospitalName || memberData.hospital || "").trim();
      } else if (memberData.hospital && String(memberData.hospital).trim()) {
        canonicalHospitalId = String(memberData.hospital).trim();
        canonicalHospitalName = String(memberData.hospital).trim();
      }

      if (!isPlatformAdmin) {
        if (!isActiveMembershipStatus(status) || !isMemberAdmin) {
          throw new Error("Only Team Admins can generate invitations.");
        }
      }
    } else if (!isPlatformAdmin) {
      throw new Error("Only Team Admins can generate invitations.");
    }

    // 2. If platform admin, resolve from users/{uid} if not found in team_members
    if (isPlatformAdmin && (!canonicalHospitalId || !canonicalHospitalName)) {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const userData = userSnap.data() as any;
        if (userData.hospitalId && (userData.hospital || userData.hospitalName)) {
          canonicalHospitalId = String(userData.hospitalId).trim();
          canonicalHospitalName = String(userData.hospital || userData.hospitalName).trim();
        }
      }
    }

    if (isPlatformAdmin && (!canonicalHospitalId || !canonicalHospitalName)) {
      throw new Error("Platform admin invites require a valid hospital workspace.");
    }

    return { hospitalId: canonicalHospitalId, hospitalName: canonicalHospitalName };
  }, []);

  const handleGenerateInvite = useCallback(async () => {
    if (!auth.currentUser) {
      setInviteStatus("error");
      setInviteGenerationError("Not authenticated");
      return;
    }

    setInviteStatus("loading");
    setInviteGenerationError(null);

    try {
      const scope = await resolveCanonicalHospitalScope();
      const res = await createTeamInvite({
        hospitalId: scope.hospitalId,
        hospitalName: scope.hospitalName,
        role: "resident",
        maxUses: 10
      });

      if (res?.link) {
        setGeneratedLink(res.link);
        setInviteStatus("success");
        setInviteGenerationError(null);
      } else {
        throw new Error("Failed to generate invitation link.");
      }
    } catch (err: any) {
      const message = err?.message || "Could not generate invitation.";
      setInviteStatus("error");
      setInviteGenerationError(message);
      setGeneratedLink("");
    }
  }, [resolveCanonicalHospitalScope]);

  useEffect(() => {
    let active = true;
    if (auth.currentUser && inviteStatus === "idle") {
      handleGenerateInvite();
    }
    return () => {
      active = false;
    };
  }, [handleGenerateInvite, inviteStatus]);

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setInviteCopiedNotice("Invitation link copied.");
    setTimeout(() => {
      setCopiedLink(false);
      setInviteCopiedNotice(null);
    }, 3000);
  };

  const handleRegenerateInvite = async () => {
    if (!auth.currentUser) return;
    setInviteStatus("loading");
    setInviteGenerationError(null);
    try {
      const scope = await resolveCanonicalHospitalScope();
      const res = await regenerateTeamInvite(scope.hospitalId);
      if (res?.link) {
        setGeneratedLink(res.link);
        setInviteStatus("success");
      }
    } catch (err: any) {
      setInviteStatus("error");
      setInviteGenerationError(err?.message || "Failed to regenerate invitation link.");
    }
  };

  const handleRevokeInvite = async () => {
    if (!generatedLink) return;
    const token = generatedLink.replace(/^.*\/join\//, "").replace(/^.*\/invite\//, "");
    try {
      await revokeTeamInvite(token);
      setGeneratedLink("");
      setInviteStatus("idle");
    } catch (err: any) {
      alert(err?.message || "Failed to revoke invitation link.");
    }
  };

  const handleShareLink = async () => {
    if (!generatedLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${activeHospitalName} Team on ErMate`,
          text: `Share this secure link with clinicians who have already been added to your team:`,
          url: generatedLink,
        });
        return;
      } catch (err) {
        // Fallback to copy if user dismisses or share fails
      }
    }
    handleCopyLink();
  };

  const handleWhatsAppShare = () => {
    if (!generatedLink) return;
    const shareText = `Join the Emergency Department team at ${activeHospitalName} on ErMate: ${generatedLink}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Add Clinician Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserHOD) {
      setErrorMsg("Only Department Leads / HODs can add team clinicians.");
      return;
    }
    if (!newName.trim() || !newEmail.trim()) {
      setErrorMsg("Please fill in both name and email.");
      return;
    }
    if (!newEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    const emailLower = newEmail.toLowerCase().trim();
    if (teamMembers.some(m => m.email.toLowerCase().trim() === emailLower)) {
      setErrorMsg("A team member with this email already exists.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await onAddMember(newName.trim(), emailLower, newRole, newShift);
      setSuccessMsg(`Successfully added Dr. ${newName.trim()} to the team!`);
      setNewName("");
      setNewEmail("");
      setNewRole("EM Resident");
      setNewShift("morning");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to add clinician. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Add Submit
  const handleBulkAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserHOD) {
      setErrorMsg("Only Department Leads / HODs can add team clinicians.");
      return;
    }
    const rawEmails = bulkEmailsText
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 3 && e.includes("@"));

    if (rawEmails.length === 0) {
      setErrorMsg("Please paste valid email addresses.");
      return;
    }

    const newOnes = rawEmails.filter(email => !teamMembers.some(m => m.email.toLowerCase() === email));
    if (newOnes.length === 0) {
      setErrorMsg("All provided emails are already on the team.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      for (const email of newOnes) {
        const namePart = email.split("@")[0].replace(/[._-]+/g, " ");
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        await onAddMember(formattedName, email, newRole, newShift);
      }
      setSuccessMsg(`Successfully added ${newOnes.length} clinicians to team!`);
      setBulkEmailsText("");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to import clinicians.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shift setup handlers
  const handleCreateNewShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isUserHOD) {
      setShiftActionMsg("Only Department Leads / HODs can configure shifts.");
      return;
    }
    if (!addShiftName.trim()) {
      setShiftActionMsg("Please enter a shift title (e.g. S3 Shift or ICU Night).");
      return;
    }
    const cleanName = addShiftName.trim();
    const cleanTime = addShiftTime.trim() || "08:00 - 16:00";
    const slugId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 10) + "_" + Math.floor(Math.random() * 1000);

    const newShiftObj = {
      id: slugId,
      name: cleanName,
      time: cleanTime,
      color: addShiftColor || SHIFT_COLOR_OPTIONS[0].color,
    };

    const updated = [...editedShifts, newShiftObj];
    setEditedShifts(updated);
    setAddShiftName("");
    setAddShiftTime("");
    setIsAddingNewShift(false);
    setShiftActionMsg(`Shift "${cleanName}" added successfully!`);

    if (onUpdateShifts) {
      await onUpdateShifts(updated);
    }
    setTimeout(() => setShiftActionMsg(""), 4000);
  };

  const handleUpdateShiftField = (shiftId: string, field: "name" | "time" | "color", value: string) => {
    setEditedShifts(prev => prev.map(item => item.id === shiftId ? { ...item, [field]: value } : item));
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!isUserHOD) {
      setShiftActionMsg("Only Department Leads / HODs can delete shifts.");
      return;
    }
    if (editedShifts.length <= 1) {
      alert("At least one shift slot must remain in the roster.");
      return;
    }
    const target = editedShifts.find(s => s.id === shiftId);
    const updated = editedShifts.filter(item => item.id !== shiftId);
    setEditedShifts(updated);
    if (onUpdateShifts) {
      await onUpdateShifts(updated);
    }
    setShiftActionMsg(`Shift "${target?.name || shiftId}" deleted.`);
    setTimeout(() => setShiftActionMsg(""), 3000);
  };

  const handleSaveShifts = async () => {
    if (!isUserHOD) {
      setShiftActionMsg("Only Department Leads / HODs can save shift schedules.");
      return;
    }
    if (onUpdateShifts) {
      try {
        await onUpdateShifts(editedShifts);
        setShiftActionMsg("Universal shift schedule saved and synchronized!");
        setTimeout(() => setShiftActionMsg(""), 4000);
      } catch (err) {
        setShiftActionMsg("Failed to save shifts. Please try again.");
      }
    }
  };

  // Filter calculations
  const filteredMembers = teamMembers.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === "all" || m.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const joinedMembers = teamMembers.filter(m => isActiveMembershipStatus(m.status));
  const pendingApprovals = teamMembers.filter(m => isPendingApprovalStatus(m.status));
  const pendingInvites = teamMembers.filter(m => !isActiveMembershipStatus(m.status) && !isPendingApprovalStatus(m.status));
  const totalPending = pendingApprovals.length + pendingInvites.length;

  const onDutyMembers = teamMembers.filter(m => m.shift && m.shift !== "off" && isActiveMembershipStatus(m.status));
  const onDutyCount = onDutyMembers.length;

  if (!isCanonicalTeamMember) {
    return (
      <div id="team-roster-board" className="space-y-6 text-slate-800 dark:text-slate-100 max-w-4xl mx-auto text-left animate-fade-in">
        {/* Individual Workspace Status Header */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 md:p-8 border border-indigo-900/40 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest font-mono px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              Workspace Mode: Individual Clinician
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Private Storage
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Individual Practice & Clinical Tools
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              You are currently working in an <strong>Individual Workspace</strong>. All your clinical encounters, Voice Scribe dictations, Case Sheets, Rounds learning debriefs, and Log Book entries are strictly private to your personal account.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-slate-300">
            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              Doctor: <strong className="text-white">{profile.name}</strong>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              Professional Role: <strong className="text-white">{profile.role || "Clinician"}</strong> (Informational)
            </div>
            {profile.hospital && (
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                Hospital Label: <strong className="text-white">{profile.hospital}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Transition to Team Workspace Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Transition to Hospital / Department Team
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecting a professional role or listing a hospital in your personal profile does not grant team access. Hospital workspace membership is established only through an explicit trusted event:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Create Team */}
            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs font-mono uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>Option 1</span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Team Workspace
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Establish a shared Emergency Department workspace for your team. You will become Team Admin to manage shifts and invite colleagues, while preserving your clinical role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(true)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Team Workspace</span>
              </button>
            </div>

            {/* Option 2: Join Team */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs font-mono uppercase tracking-wider">
                  <Link className="w-4 h-4" />
                  <span>Option 2</span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Accept Secure Team Invitation
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Have an invitation link or token from your department lead? Enter it to join your team with verified department access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Enter Invitation Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Create Team Workspace */}
        {showCreateTeamModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Create Team Workspace
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateHospitalWorkspaceSubmit} className="space-y-3.5">
                {createTeamError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createTeamError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    Hospital or Workplace Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newHospitalName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHospitalName(val);
                      if (!newTeamName || newTeamName.endsWith("Emergency Team")) {
                        setNewTeamName(val ? `${val} Emergency Team` : "");
                      }
                    }}
                    placeholder="e.g. City General Hospital"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    Team Name (Display Name)
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. City General ER Team"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    placeholder="e.g. Emergency & Trauma Medicine"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                      ER Physical Bed Capacity (1-1000) *
                    </label>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Canonical MATE Bed Limit
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    required
                    value={newBedCapacity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewBedCapacity(val === '' ? ('' as any) : Number(val));
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Used by MATE for bed availability and active department census.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateTeamModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTeam}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isCreatingTeam ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isCreatingTeam ? "Creating..." : "Create Team"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Join Hospital Team */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Link className="w-4 h-4 text-indigo-500" />
                  Join Hospital Team
                </h3>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAcceptInviteSubmit} className="space-y-4">
                {joinTeamError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{joinTeamError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    Invitation Token or Link *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinTokenInput}
                    onChange={(e) => setJoinTokenInput(e.target.value)}
                    placeholder="Paste inv_... or https://ermate.in/join/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningTeam}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isJoiningTeam ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isJoiningTeam ? "Joining..." : "Join Team"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="team-roster-board" className="space-y-5 text-slate-800 dark:text-slate-100 max-w-7xl mx-auto">
      
      {/* Unverified Team Status Banner */}
      {!isInstitutionalVerified && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 text-amber-800 dark:text-amber-200 animate-fade-in shadow-xs" id="unverified-team-banner">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Unverified Team Workspace
                </span>
              </div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-100">
                Awaiting Institutional Verification
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed max-w-3xl">
                Your team workspace is active for shifts, roster scheduling, and team management. Real patient clinical records remain protected in your private individual workspace until institutional verification is completed by the platform administrator.
              </p>
            </div>
          </div>
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={handleVerifyTeamInstitution}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 self-end sm:self-center"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verify Institution</span>
            </button>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP-LEVEL 4-SECTION NAVIGATION BAR (MOBILE-FIRST)        */}
      {/* 1. OVERVIEW  2. MEMBERS  3. ROTA  4. SETTINGS            */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "overview"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "members"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>Members</span>
          {teamMembers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {teamMembers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rota")}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "rota"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Rota</span>
          {onDutyCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              {onDutyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "settings"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span>Settings</span>
          {pendingApprovals.length > 0 && (
            <span className="text-[10px] w-4 h-4 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center">
              !
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. OVERVIEW (DEFAULT SCREEN)                             */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
                TEAM
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeHospitalName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {joinedMembers.length} clinicians · {onDutyCount} on duty
              </p>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("members");
                  setShowAddMemberForm(true);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Clinician</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite Team</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Members */}
            <div 
              onClick={() => setActiveTab("members")}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Members</span>
                <Users className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {joinedMembers.length}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                {teamMembers.length} allowlisted seats
              </p>
            </div>

            {/* 2. Pending Invitations */}
            <div 
              onClick={() => setActiveTab("members")}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Pending Invitations</span>
                <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{totalPending}</span>
                {pendingApprovals.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-bold uppercase font-mono animate-pulse">
                    {pendingApprovals.length} Approval
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                {totalPending > 0 ? "Awaiting join / approval" : "All verified"}
              </p>
            </div>

            {/* 3. On Duty Now */}
            <div 
              onClick={() => setActiveTab("rota")}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">On Duty Now</span>
                <Activity className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{onDutyCount}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                Active clinical shift
              </p>
            </div>

            {/* 4. Configured Shifts */}
            <div 
              onClick={() => setActiveTab("rota")}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Configured Shifts</span>
                <Calendar className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {activeShifts.length}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                Universal shift slots
              </p>
            </div>
          </div>

          {/* Pending Approval Alert if any */}
          {isUserHOD && pendingApprovals.length > 0 && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-600 rounded-xl">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    {pendingApprovals.length} Clinician{pendingApprovals.length > 1 ? "s" : ""} Awaiting HOD Approval
                  </h4>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400 font-mono">
                    Verify and approve registration to grant access to the department roster.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("members")}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                Review Requests →
              </button>
            </div>
          )}

          {/* TODAY'S TEAM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <span>TODAY'S TEAM</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                    {joinedMembers.length} Clinicians
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Current assigned shift and on-call active status</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("rota")}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Shift Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clinician Rows */}
            {joinedMembers.length === 0 ? (
              <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <UserX className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No active clinicians on the team yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Add doctors using the directory or share your team invitation link.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("members");
                    setShowAddMemberForm(true);
                  }}
                  className="mt-2 px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  + Add First Clinician
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {joinedMembers.map((member) => {
                  const isSelf = member.email.toLowerCase().trim() === userEmailLower;
                  const shiftObj = activeShifts.find(s => s.id === member.shift) || activeShifts[0];
                  const isOnDuty = member.shift && member.shift !== "off";

                  return (
                    <div
                      key={member.id}
                      className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar Initial with Status Dot */}
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-200/50 dark:border-indigo-500/20">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          {isOnDuty && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              Dr {member.name}
                            </span>
                            {isSelf && (
                              <span className="text-[8.5px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 font-mono font-bold px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      {/* Shift & Duty Badge */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-xl border ${shiftObj.color}`}>
                          {shiftObj.name} · {isOnDuty ? "On Duty" : "Off Duty"}
                        </span>
                        
                        {isOnDuty ? (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            On Duty
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            Off
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MEMBERS (MEMBER DIRECTORY & INVITATIONS)               */}
      {/* ======================================================== */}
      {activeTab === "members" && (
        <div className="space-y-6 animate-fade-in">

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
                DIRECTORY
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                MEMBER DIRECTORY
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage clinician roster accounts, duty designations, and access credentials.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddMemberForm ? "Close Form" : "+ Add Clinician"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Invite Team</span>
              </button>
            </div>
          </div>

          {/* Add Clinician Form (Collapsible or visible) */}
          {showAddMemberForm && (
            <div className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white">
                    Add Clinician to Department
                  </h3>
                </div>

                {/* Single / Bulk toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px] font-bold font-mono">
                  <button
                    type="button"
                    onClick={() => setAddMode("single")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      addMode === "single" ? "bg-white dark:bg-slate-900 text-indigo-600 font-black shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Single Clinician
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("bulk")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      addMode === "bulk" ? "bg-white dark:bg-slate-900 text-indigo-600 font-black shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Bulk Import
                  </button>
                </div>
              </div>

              {addMode === "single" ? (
                <form onSubmit={handleAddSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Dr Amit Verma"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gmail / Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="e.g. amit@gmail.com"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Designation</label>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="Senior Consultant">Senior Consultant</option>
                        <option value="EM Resident">EM Resident</option>
                        <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                        <option value="Scribe Specialist">Scribe Specialist</option>
                        <option value="EM Intern">EM Intern</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Assigned Shift</label>
                      <select
                        value={newShift}
                        onChange={e => setNewShift(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      >
                        {activeShifts.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.time})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {errorMsg && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-xl font-mono">{errorMsg}</p>}
                  {successMsg && <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-xl font-mono">{successMsg}</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberForm(false)}
                      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? "Adding..." : "Add to Team"}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBulkAddSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Paste Clinician Emails</label>
                    <textarea
                      rows={3}
                      value={bulkEmailsText}
                      onChange={e => setBulkEmailsText(e.target.value)}
                      placeholder="e.g. rahul.sharma@gmail.com, amit.clinical@gmail.com, priya.nair@gmail.com"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 font-mono">
                      Separate addresses by commas, semicolons, or lines.
                    </p>
                  </div>

                  {errorMsg && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-xl font-mono">{errorMsg}</p>}
                  {successMsg && <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-xl font-mono">{successMsg}</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberForm(false)}
                      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      {isSubmitting ? "Importing..." : "Add Clinicians in Bulk"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Canonical Team Invitation Card */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 dark:from-slate-900 dark:to-indigo-950/20 border border-indigo-150 dark:border-indigo-900/40 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono">
                  SECURE ONBOARDING
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  TEAM INVITATION
                </h3>
              </div>
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full font-mono">
                Active 7-Day Link
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Share this reusable invite link with your emergency team. Anyone with the link can request to join, and Team Admins will approve their role.
            </p>

            {inviteStatus === "error" ? (
              <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Could not generate invitation.</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-sans">
                  {inviteGenerationError || "Only active Team Admins can manage team invites."}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 select-all truncate flex-1 px-2 w-full sm:w-auto">
                    {generatedLink || (inviteStatus === "loading" ? "Generating secure invite link..." : "Generating invitation...")}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareLink}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {isUserTeamAdmin && generatedLink && (
                  <div className="flex items-center justify-between pt-1 px-1">
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                      Token is secured & expires in 6 hours.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRegenerateInvite}
                        disabled={inviteStatus === "loading"}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate Link</span>
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={handleRevokeInvite}
                        className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pending Invitations & Join Requests */}
          {(pendingApprovals.length > 0 || pendingInvites.length > 0) && (
            <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-900/30 pb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white font-mono tracking-wider">
                  PENDING INVITATIONS & APPROVALS ({totalPending})
                </h3>
              </div>

              <div className="space-y-2.5">
                {/* Pending Team Admin Approvals */}
                {pendingApprovals.map(req => {
                  const selectedRole = approvalRoles[req.id] || req.role || "Resident";
                  const isMakeAdmin = approvalAdminStatus[req.id] === true;

                  return (
                    <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 p-3.5 rounded-xl">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-slate-900 dark:text-white">Dr {req.name}</strong>
                          <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.2 rounded-full font-bold uppercase font-mono animate-pulse">
                            Awaiting Approval
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {req.email} • Requested: <span className="font-semibold text-slate-700 dark:text-slate-300">{req.role || "Resident"}</span>
                        </p>
                      </div>

                      {isUserHOD && (
                        <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
                          {/* Role selector */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">Role:</span>
                            <select
                              value={selectedRole}
                              onChange={(e) => setApprovalRoles(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                            >
                              <option value="Resident">Resident</option>
                              <option value="Senior Resident">Senior Resident</option>
                              <option value="Consultant">Consultant</option>
                              <option value="Senior Consultant">Senior Consultant</option>
                              <option value="Medical Officer">Medical Officer</option>
                              <option value="Fellow">Fellow</option>
                              <option value="Emergency Physician">Emergency Physician</option>
                              <option value="Staff Nurse">Staff Nurse</option>
                              <option value="Clinical Pharmacist">Clinical Pharmacist</option>
                            </select>
                          </div>

                          {/* Appoint as Admin toggle */}
                          <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isMakeAdmin}
                              onChange={(e) => setApprovalAdminStatus(prev => ({ ...prev, [req.id]: e.target.checked }))}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span>Team Admin</span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onDeclineMember && onDeclineMember(req.id)}
                              className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => onApproveMember && onApproveMember(req.id, selectedRole, isMakeAdmin)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <span>Approve</span>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pending Link Clicks */}
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-3.5 rounded-xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-slate-800 dark:text-slate-200">Dr {inv.name}</strong>
                        <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.2 rounded-full font-bold uppercase font-mono">
                          Invited · Awaiting join
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {inv.email} • {inv.role}
                      </p>
                    </div>

                    {isUserHOD && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(inv.id)}
                        className="text-xs text-rose-500 hover:underline self-end sm:self-center font-bold"
                      >
                        Revoke Invite
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Search & Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                TEAM MEMBERS ({filteredMembers.length})
              </h3>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, designation..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Member Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {filteredMembers.map(member => {
                const isSelf = member.email.toLowerCase().trim() === userEmailLower;
                const shiftObj = activeShifts.find(s => s.id === member.shift) || activeShifts[0];

                return (
                  <div
                    key={member.id}
                    className="p-4 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3 transition-all hover:border-indigo-300 dark:hover:border-indigo-800/60"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            Dr {member.name}
                          </h4>
                          {isSelf && (
                            <span className="text-[8.5px] bg-indigo-50 text-indigo-700 font-mono font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                              You
                            </span>
                          )}
                          {(member.isTeamAdmin === true || member.teamRole === "admin" || (member.membershipVerified === true && ["hod", "hod / department lead", "hod / shift lead"].includes(String(member.role || "").trim().toLowerCase()))) && (
                            <span className="text-[8.5px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono font-bold px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                              Team Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {member.email}
                        </p>
                      </div>

                      {/* Status badge */}
                      {isActiveMembershipStatus(member.status) ? (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                          Active
                        </span>
                      ) : isPendingApprovalStatus(member.status) ? (
                        <span className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase font-mono animate-pulse">
                          Pending Approval
                        </span>
                      ) : (
                        <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                          Invited
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-150 dark:border-slate-800/60">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold font-mono block">Designation</span>
                        {isUserHOD && !isSelf && onUpdateRole ? (
                          <select
                            value={member.role}
                            onChange={e => onUpdateRole(member.id, e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                          >
                            <option value="Senior Consultant">Senior Consultant</option>
                            <option value="Consultant">Consultant</option>
                            <option value="Senior Resident">Senior Resident</option>
                            <option value="EM Resident">EM Resident</option>
                            <option value="Medical Officer">Medical Officer</option>
                            <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                            <option value="Scribe Specialist">Scribe Specialist</option>
                            <option value="EM Intern">EM Intern</option>
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{member.role}</span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold font-mono block">Shift Rota</span>
                        {isUserHOD || isSelf ? (
                          <select
                            value={member.shift}
                            onChange={e => onUpdateShift(member.id, e.target.value)}
                            className="bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer"
                          >
                            {activeShifts.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-700 dark:text-slate-300">{shiftObj.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-150 dark:border-slate-800/60 text-xs">
                      {isUserHOD && !isSelf ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const currentIsAdmin = member.isTeamAdmin === true || member.teamRole === "admin";
                                await setTeamAdminRole(member.id, !currentIsAdmin);
                                window.location.reload();
                              } catch (e: any) {
                                alert(e.message || "Failed to update admin role.");
                              }
                            }}
                            className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-bold cursor-pointer"
                          >
                            {(member.isTeamAdmin === true || member.teamRole === "admin") ? "Revoke Admin" : "Make Admin"}
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          {pendingDeleteId === member.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onRemoveMember(member.id);
                                  setPendingDeleteId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(member.id)}
                              className="text-slate-400 hover:text-rose-600 text-[11px] font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {isSelf ? "My Profile" : "Verified Doctor"}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setCalendarModalConfig({
                            defaultEventType: "shift",
                            initialTitle: `ER Duty Shift (${shiftObj.name}) — Dr. ${member.name}`,
                            initialDescription: `Scheduled Duty Shift for ${member.name} (${member.role}) at ${activeHospitalName}.`,
                            initialStartTime: shiftObj.time.split(" - ")[0] || "08:00",
                            initialEndTime: shiftObj.time.split(" - ")[1] || "14:00",
                          });
                          setIsCalendarModalOpen(true);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Sync Calendar</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ROTA (DUTY SHIFTS & SCHEDULE)                         */}
      {/* ======================================================== */}
      {activeTab === "rota" && (
        <div className="space-y-6 animate-fade-in">

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
                SCHEDULE
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                ROTA & DUTY SHIFTS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active clinical shift windows, duty status toggles, and Google Calendar sync.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowWorkspaceSync(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Sync Google Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setShowShiftManagerModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add / Edit Shifts</span>
              </button>
            </div>
          </div>

          {/* Shift Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setShiftFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                shiftFilter === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
              }`}
            >
              All Shifts ({teamMembers.length})
            </button>
            {activeShifts.map(s => {
              const count = teamMembers.filter(m => m.shift === s.id).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShiftFilter(s.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    shiftFilter === s.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Clinicians on Selected Rota */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              CLINICIANS ON ROTA ({filteredMembers.length})
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMembers.map(member => {
                const shiftObj = activeShifts.find(s => s.id === member.shift) || activeShifts[0];
                const isSelf = member.email.toLowerCase().trim() === userEmailLower;
                const isOnDuty = member.shift && member.shift !== "off";

                return (
                  <div key={member.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-slate-900 dark:text-white">Dr {member.name}</strong>
                        {isSelf && <span className="text-[8.5px] bg-indigo-100 text-indigo-700 font-mono font-bold px-1.5 py-0.2 rounded">You</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {member.role} • {member.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      {/* Shift selector */}
                      <select
                        value={member.shift}
                        onChange={e => onUpdateShift(member.id, e.target.value)}
                        className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border focus:outline-none cursor-pointer ${shiftObj.color}`}
                      >
                        {activeShifts.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.time})
                          </option>
                        ))}
                      </select>

                      {/* On Duty Status Badge */}
                      {isOnDuty ? (
                        <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                          On Duty
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                          Off Shift
                        </span>
                      )}

                      {/* Case logs & handover trigger */}
                      {cases && cases.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMemberForCases(member);
                            const memberCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === member.email.toLowerCase().trim() && c.status === "Active");
                            setSelectedCaseIdsToTake(memberCases.map(c => c.id));
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                          title="View case logs / Handover"
                        >
                          Cases
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Universal Shift Setup (Shift Configuration for HOD) */}
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 font-mono">
                  CONFIGURED SHIFT SLOTS
                </span>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Universal Shift Setup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure duty hours and badge colors for all ER rosters.
                </p>
              </div>

              {isUserHOD && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewShift(!isAddingNewShift)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingNewShift ? "Cancel" : "+ Add Shift"}</span>
                </button>
              )}
            </div>

            {/* Add Shift Inline */}
            {isAddingNewShift && (
              <form onSubmit={handleCreateNewShift} className="p-4 bg-white dark:bg-slate-900 border border-indigo-200 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Shift Name</label>
                    <input
                      type="text"
                      value={addShiftName}
                      onChange={e => setAddShiftName(e.target.value)}
                      placeholder="e.g. S3 Shift"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Duty Hours</label>
                    <input
                      type="text"
                      value={addShiftTime}
                      onChange={e => setAddShiftTime(e.target.value)}
                      placeholder="e.g. 08:00 - 16:00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Color Theme</label>
                    <select
                      value={addShiftColor}
                      onChange={e => setAddShiftColor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    >
                      {SHIFT_COLOR_OPTIONS.map((c, i) => (
                        <option key={i} value={c.color}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsAddingNewShift(false)} className="text-xs font-bold text-slate-500">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl">Save & Add</button>
                </div>
              </form>
            )}

            {shiftActionMsg && (
              <p className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl font-mono">
                {shiftActionMsg}
              </p>
            )}

            {/* Grid of Shifts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {editedShifts.map((s) => (
                <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</span>
                    {isUserHOD && (
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(s.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{s.time}</p>
                </div>
              ))}
            </div>

            {isUserHOD && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveShifts}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Universal Shift Times</span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SETTINGS (WORKPLACE SETUP & LEADERSHIP PANEL)         */}
      {/* ======================================================== */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-fade-in">

          {/* Section Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
              WORKPLACE
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              TEAM & WORKPLACE SETTINGS
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hospital branding, department identity, leadership governance, and license status.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Workplace Setup */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Workplace Branding & Metadata
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Customizes invitations and printable clinical headers.</p>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Hospital / Institution Name</label>
                  <input
                    type="text"
                    value={workplaceInput}
                    onChange={e => {
                      setWorkplaceInput(e.target.value);
                      if (onHospitalChange) onHospitalChange(e.target.value);
                    }}
                    placeholder="e.g. Rajagiri Emergency Care"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Specialty Department</label>
                  <input
                    type="text"
                    value={departmentInput}
                    onChange={e => setDepartmentInput(e.target.value)}
                    placeholder="e.g. Emergency & Trauma Medicine"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Team Core Identifier</label>
                  <input
                    type="text"
                    value={teamNameInput}
                    onChange={e => setTeamNameInput(e.target.value)}
                    placeholder="e.g. EM Trauma Response Core"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">ER Physical Bed Capacity</label>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">MATE Limit</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={bedCapacityInput}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      setBedCapacityInput(isNaN(val) ? 1 : Math.max(1, val));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                    Enter the number of physical ER bed locations. MATE uses this to validate bed numbers and A/B subdivisions.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Brand Theme Accent</label>
                  <div className="flex gap-2">
                    {(["blue", "emerald", "indigo", "violet"] as const).map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTeamColorInput(color)}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-mono capitalize border transition-all ${
                          teamColorInput === color
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-800 font-black shadow-xs"
                            : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {configSavedNotice && (
                  <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-xl font-mono">
                    ✓ Workplace configuration saved successfully!
                  </p>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const validCapacity = Math.max(1, Math.floor(bedCapacityInput));
                    if (onUpdateBedCapacity) {
                      await onUpdateBedCapacity(validCapacity);
                    }
                    if (onSaveConfig) {
                      onSaveConfig(teamNameInput, departmentInput, teamColorInput);
                    }
                    setConfigSavedNotice(true);
                    setTimeout(() => setConfigSavedNotice(false), 3000);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Apply & Update Configuration</span>
                </button>
              </div>
            </div>

            {/* Right: Leadership & Subscription */}
            <div className="space-y-6">
              
              {/* Department Leadership / Team Admins Card */}
              <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-indigo-500/15 border border-amber-500/30 rounded-2xl p-5 shadow-xs space-y-3">
                {(() => {
                  const admins = teamMembers.filter(
                    m => m.isTeamAdmin === true || m.teamRole === "admin" || (m.membershipVerified === true && ["hod", "hod / department lead", "hod / shift lead"].includes(String(m.role || "").trim().toLowerCase()))
                  );
                  const primaryLeader = admins.length > 0 ? admins[0] : null;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                            👑 Team Administration & Leadership
                          </span>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">
                            {primaryLeader ? `Dr. ${primaryLeader.name}` : `Dr. ${profile.name}`}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {primaryLeader?.email || profile.email} • {primaryLeader?.role || "Team Admin"}
                          </p>
                        </div>
                      </div>

                      {admins.length > 1 && (
                        <div className="pt-2 border-t border-amber-500/20 text-xs">
                          <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 block mb-1">
                            Additional Team Admins:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {admins.slice(1).map(adm => (
                              <span key={adm.id} className="text-[11px] bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 font-medium">
                                Dr. {adm.name} ({adm.role || "Admin"})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Hospital License / Subscription Status */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white">
                    Hospital Group License
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                    {hospitalSubscriptionActive || joinedMembers.length > 0 ? "Active" : "Awaiting Verification"}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                  <p>• Department Seats: <strong className="text-slate-900 dark:text-white">{teamMembers.length} allowlisted</strong></p>
                  <p>• Active Clinicians: <strong className="text-emerald-600">{joinedMembers.length} joined</strong></p>
                  <p>• Group License Tier: <strong className="text-indigo-600">Department Covered (Enterprise)</strong></p>
                </div>
              </div>

              {/* Colleague Onboarding Simulator */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950/90 text-white border border-indigo-800/40 rounded-2xl p-5 shadow-lg space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-indigo-900/60 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 font-mono">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    Sandbox Invitation Simulator
                  </h4>
                  <span className="text-[8.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                    Testing
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 font-mono">
                  Simulate a colleague clicking the generated invitation link on their device.
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedSimEmail}
                    onChange={e => setSelectedSimEmail(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="">-- Choose doctor to simulate join --</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.email}>{m.name} ({m.email})</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSimEmail) return;
                      const target = teamMembers.find(m => m.email === selectedSimEmail);
                      if (target && onApproveMember) {
                        onApproveMember(target.id);
                        alert(`Simulated successful join for ${target.name}!`);
                      }
                    }}
                    disabled={!selectedSimEmail}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Simulate</span>
                  </button>
                </div>
              </div>

              {/* Leave Team option */}
              {onLeaveTeam && !isUserHOD && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to leave this clinical team?")) {
                        onLeaveTeam();
                      }
                    }}
                    className="w-full py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Leave Clinical Team
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* CANONICAL TEAM INVITATION MODAL                           */}
      {/* ======================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">TEAM INVITATION</h3>
                  <p className="text-xs text-slate-300">{activeHospitalName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Share this reusable invite link with your emergency team. Anyone with the link can request to join, and Team Admins will approve their role.
              </p>

              {inviteStatus === "error" ? (
                <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Could not generate invitation.</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-sans">
                    {inviteGenerationError || "Only active Team Admins can manage team invites."}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 select-all break-all block">
                    {generatedLink || (inviteStatus === "loading" ? "Generating secure invite link..." : "Generating invitation...")}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="flex-1 min-w-[120px] py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareLink}
                      disabled={!generatedLink || inviteStatus === "loading"}
                      className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>

                  {isUserTeamAdmin && generatedLink && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-mono">Reusable 7-day token</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRegenerateInvite}
                          disabled={inviteStatus === "loading"}
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Regenerate</span>
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={handleRevokeInvite}
                          className="text-rose-500 font-bold hover:underline cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PENDING INVITATIONS IN MODAL */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">
                  PENDING INVITATIONS
                </span>
                {totalPending === 0 ? (
                  <p className="text-[11px] text-slate-400 font-mono">All allowlisted doctors have joined the team.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pendingApprovals.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Dr {p.name}</span>
                        <span className="text-[10px] font-bold text-amber-600">Pending Approval</span>
                      </div>
                    ))}
                    {pendingInvites.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Dr {p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Invited · Awaiting join</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SHIFT MANAGER MODAL                                      */}
      {/* ======================================================== */}
      {showShiftManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 my-auto">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Department Duty Shift Manager</h3>
                  <p className="text-xs text-slate-300">Configure duty shift slots and hours for {activeHospitalName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftManagerModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Add New Shift Section */}
              <div className="p-4 bg-indigo-50/50 dark:bg-slate-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                    <Plus className="w-4 h-4" /> Add New Shift Slot
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">e.g., Night Resus, S1</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Shift Name</label>
                    <input
                      type="text"
                      value={addShiftName}
                      onChange={e => setAddShiftName(e.target.value)}
                      placeholder="e.g. S3 Shift or ICU Night"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Duty Hours</label>
                    <input
                      type="text"
                      value={addShiftTime}
                      onChange={e => setAddShiftTime(e.target.value)}
                      placeholder="e.g. 07:00 - 15:00"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Color Theme</label>
                    <select
                      value={addShiftColor}
                      onChange={e => setAddShiftColor(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                    >
                      {SHIFT_COLOR_OPTIONS.map((c, i) => (
                        <option key={i} value={c.color}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleCreateNewShift()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create & Add Shift</span>
                  </button>
                </div>
              </div>

              {shiftActionMsg && (
                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl font-mono">
                  {shiftActionMsg}
                </p>
              )}

              {/* List of Configured Shifts */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">
                  Configured Shifts ({editedShifts.length})
                </h4>

                <div className="space-y-2.5">
                  {editedShifts.map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => handleUpdateShiftField(s.id, "name", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white flex-1"
                        />
                        <input
                          type="text"
                          value={s.time}
                          onChange={(e) => handleUpdateShiftField(s.id, "time", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200 w-32"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        <select
                          value={s.color}
                          onChange={(e) => handleUpdateShiftField(s.id, "color", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-800 dark:text-slate-200"
                        >
                          {SHIFT_COLOR_OPTIONS.map((c, idx) => (
                            <option key={idx} value={c.color}>{c.label}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDeleteShift(s.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-mono">Changes sync automatically for all department members</span>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveShifts();
                  setShowShiftManagerModal(false);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Handover Overlay */}
      {selectedMemberForCases && (() => {
        const memberEmailLower = selectedMemberForCases.email.toLowerCase().trim();
        const memberCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === memberEmailLower);
        const activeMemberCases = memberCases.filter(c => !c.archivedAt && c.status === "Active");

        const handleToggleSelectCase = (caseId: string) => {
          if (selectedCaseIdsToTake.includes(caseId)) {
            setSelectedCaseIdsToTake(prev => prev.filter(id => id !== caseId));
          } else {
            setSelectedCaseIdsToTake(prev => [...prev, caseId]);
          }
        };

        const handleTakeHandoverAction = async () => {
          if (selectedCaseIdsToTake.length === 0 || !onSaveCase) return;
          setHandoverInProgress(true);
          try {
            for (const caseId of selectedCaseIdsToTake) {
              const targetCase = cases.find(c => c.id === caseId);
              if (targetCase) {
                const updated: ClinicalCase = {
                  ...targetCase,
                  doctorEmail: profile.email,
                  doctorName: "Dr. " + profile.name,
                  currentAssigneeEmail: profile.email,
                  currentAssigneeName: "Dr. " + profile.name,
                };
                await onSaveCase(updated);
              }
            }
            setHandoverSuccessMsg(`✓ Successfully took handover of ${selectedCaseIdsToTake.length} cases!`);
            setSelectedCaseIdsToTake([]);
            setTimeout(() => {
              setHandoverSuccessMsg("");
              setSelectedMemberForCases(null);
            }, 2500);
          } catch (err) {
            console.error("Error taking handover:", err);
          } finally {
            setHandoverInProgress(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end animate-fade-in no-print">
            <div className="w-full max-w-xl bg-white dark:bg-slate-950 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono">
                    Cases Seen By: Dr {selectedMemberForCases.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedMemberForCases.email} • {selectedMemberForCases.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberForCases(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 font-bold text-xs"
                >
                  ✕ Close
                </button>
              </div>

              {handoverSuccessMsg && (
                <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                  {handoverSuccessMsg}
                </div>
              )}

              <div className="p-6 flex-1 space-y-3">
                {activeMemberCases.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono text-center py-10">No active cases assigned to this clinician.</p>
                ) : (
                  activeMemberCases.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleToggleSelectCase(c.id)}
                      className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        selectedCaseIdsToTake.includes(c.id) ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200"
                      }`}
                    >
                      <div>
                        <strong className="text-xs font-bold text-slate-900">{c.displayId || c.id}</strong>
                        <p className="text-[11px] text-slate-500">{c.patient?.gender || "Patient"} • Bed {c.bedNo || "Unassigned"}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedCaseIdsToTake.includes(c.id)}
                        onChange={() => {}}
                        className="rounded text-indigo-600"
                      />
                    </div>
                  ))
                )}
              </div>

              {activeMemberCases.length > 0 && onSaveCase && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTakeHandoverAction}
                    disabled={selectedCaseIdsToTake.length === 0 || handoverInProgress}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    {handoverInProgress ? "Transferring..." : `Take Handover of ${selectedCaseIdsToTake.length} Cases`}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Google Calendar Modal */}
      <GoogleCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        defaultEventType={calendarModalConfig.defaultEventType}
        initialTitle={calendarModalConfig.initialTitle}
        initialDescription={calendarModalConfig.initialDescription}
        initialStartTime={calendarModalConfig.initialStartTime}
        initialEndTime={calendarModalConfig.initialEndTime}
        hospitalName={activeHospitalName}
      />

      {/* Workspace Google Calendar Sync */}
      {showWorkspaceSync && (
        <WorkspaceRotaSyncModal
          onClose={() => setShowWorkspaceSync(false)}
          onSuccess={(count) => {
            setShowWorkspaceSync(false);
            alert(`Successfully synced ${count} shifts to Google Calendar!`);
          }}
          teamMembers={teamMembers.map(m => ({ email: m.email, name: m.name || m.email }))}
        />
      )}

    </div>
  );
}
