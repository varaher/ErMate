import { WorkspaceRotaSyncModal } from "./shared/WorkspaceRotaSyncModal";
import React, { useState, useEffect } from "react";
import { 
  Users, Plus, Trash2, Shield, Clock, Search, UserCheck, 
  UserX, ShieldAlert, CheckCircle2, Mail, Calendar, Sparkles,
  Building2, Link, Copy, Check, BookOpen, FileText, CheckSquare, Square, ChevronRight, ClipboardList
} from "lucide-react";
import { TeamMember, UserProfile, ClinicalCase } from "../types";
import GoogleCalendarModal from "./GoogleCalendarModal";
import { createTeamInvite } from "../services/teamInviteService";
import { auth } from "../firebase";

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

interface TeamRosterBoardProps {
  teamMembers: TeamMember[];
  profile: UserProfile;
  cases?: ClinicalCase[];
  onSaveCase?: (updatedCase: ClinicalCase) => Promise<void>;
  onAddMember: (name: string, email: string, role: string, shift: string) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
  onUpdateShift: (id: string, shift: string) => Promise<void>;
  onApproveMember?: (id: string) => Promise<void>;
  onDeclineMember?: (id: string) => Promise<void>;
  onUpdateRole?: (id: string, role: string) => Promise<void>;
  hospitalSubscriptionActive?: boolean;
  shifts?: any[];
  onUpdateShifts?: (newShifts: any[]) => Promise<void> | void;
}

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
}: TeamRosterBoardProps) {
  // Active dynamic shifts
  const activeShifts = shifts && shifts.length > 0 ? shifts : ROTA_SHIFTS;
  const [editedShifts, setEditedShifts] = useState<any[]>([]);

  // Sync editedShifts with activeShifts when props change
  useEffect(() => {
    setEditedShifts(JSON.parse(JSON.stringify(activeShifts)));
  }, [shifts, activeShifts]);

  // Shift Manager State & Form States
  const [showShiftManagerModal, setShowShiftManagerModal] = useState(false);
  const [isAddingNewShift, setIsAddingNewShift] = useState(false);
  const [showWorkspaceSync, setShowWorkspaceSync] = useState(false);

  const [addShiftName, setAddShiftName] = useState("");
  const [addShiftTime, setAddShiftTime] = useState("");
  const [addShiftColor, setAddShiftColor] = useState(SHIFT_COLOR_OPTIONS[0].color);
  const [shiftActionMsg, setShiftActionMsg] = useState("");

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");

  // HOD Member Case view and Handover States
  const [selectedMemberForCases, setSelectedMemberForCases] = useState<TeamMember | null>(null);
  const [selectedCaseIdsToTake, setSelectedCaseIdsToTake] = useState<string[]>([]);
  const [handoverInProgress, setHandoverInProgress] = useState(false);
  const [handoverSuccessMsg, setHandoverSuccessMsg] = useState("");

  // Form States for Add Member
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("EM Resident");
  const [newShift, setNewShift] = useState("off");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Google Calendar Sync Modal State
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
  const isUserHOD = true; // Enabled for all users to allow roster configuration and deleting sample doctors

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://ermate.app";
  const [generatedLink, setGeneratedLink] = useState<string>(
    `${currentOrigin}/join/${slugify(profile.hospital || "department")}?ref=team_invite`
  );

  useEffect(() => {
    let active = true;
    if (profile.hospital) {
      createTeamInvite(profile.hospital, auth.currentUser?.uid || "hod", profile.name || "HOD").then(res => {
        if (active) {
          setGeneratedLink(res.link);
        }
      });
    }
    return () => { active = false; };
  }, [profile.hospital, profile.name]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle adding a new member
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setSuccessMsg(`Successfully whitelisted ${newName}!`);
      setNewName("");
      setNewEmail("");
      setNewRole("EM Resident");
      setNewShift("off");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to add member. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    setEditedShifts(prev => {
      return prev.map(item => {
        if (item.id === shiftId) {
          return { ...item, [field]: value };
        }
        return item;
      });
    });
  };

  const handleDeleteShift = async (shiftId: string) => {
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

  // Filter team members
  const filteredMembers = teamMembers.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesShift = shiftFilter === "all" || m.shift === shiftFilter;
    
    return matchesSearch && matchesShift;
  });

  const joinedMembers = teamMembers.filter(m => m.status === "Active (Joined)");

  return (
    <div id="team-roster-board" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* 1. Header & Roster Metadata */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isUserHOD ? "HOD Admin Control Panel" : "Hospital Clinical Roster & Team"}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hospital / Institution: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{profile.hospital || "Not Configured"}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCalendarModalConfig({
                defaultEventType: "shift",
                initialTitle: `ER Duty Shift — ${profile.hospital || "Emergency Dept"}`,
                initialDescription: `Emergency Department duty shift schedule for Dr. ${profile.name}.`,
                initialStartTime: "08:00",
                initialEndTime: "14:00",
              });
              setIsCalendarModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Sync shift rotas & events with Google Calendar"
          >
            <Calendar className="w-3.5 h-3.5 text-white" />
            <span>Sync Google Calendar</span>
          </button>

          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Logged in as <strong>{profile.name}</strong> ({isUserHOD ? "HOD / Admin" : profile.role})
            </span>
          </div>
        </div>
      </div>

      {/* Department Leadership & HOD Info Banner */}
      {(() => {
        const departmentHODMember = teamMembers.find(m => 
          m.role?.toLowerCase().includes("hod") || 
          m.role?.toLowerCase().includes("head") || 
          m.role?.toLowerCase().includes("lead")
        );
        const isSelfHOD = profile.role?.toLowerCase().includes("hod") || profile.role?.toLowerCase().includes("owner") || profile.role?.toLowerCase().includes("head");
        const hodDisplayName = departmentHODMember ? departmentHODMember.name : (isSelfHOD ? profile.name : (profile.hospital ? `Dr. ${profile.hospital.split(' ')[0]} HOD` : "Department Head"));
        const hodEmail = departmentHODMember ? departmentHODMember.email : (isSelfHOD ? profile.email : "hod@" + (profile.hospital ? profile.hospital.toLowerCase().replace(/[^a-z]/g, '') : "ermate") + ".in");
        const hodShift = departmentHODMember ? (departmentHODMember.shift || "Active") : "On Duty / Oversight";

        return (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-indigo-500/15 border border-amber-500/30 rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1">
                      👑 Head of Department (HOD) / Clinical Chief
                    </span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.2 rounded-full font-bold uppercase font-mono">
                      Department Lead
                    </span>
                  </div>
                  <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    {hodDisplayName}
                    {isSelfHOD && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                        (You are HOD)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {hodEmail} • Hospital: <strong className="text-slate-700 dark:text-slate-200">{profile.hospital || "General Emergency Dept"}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <div className="bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 px-3.5 py-1.5 rounded-xl text-left">
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold block">Duty Shift Status</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono uppercase">{hodShift}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending Join Requests for HOD */}
      {isUserHOD && teamMembers.filter(m => m.status === "Pending Approval").length > 0 && (
        <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-900/20 pb-2">
            <Users className="w-4.5 h-4.5 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 font-mono tracking-wider">
              Pending Join Requests ({teamMembers.filter(m => m.status === "Pending Approval").length})
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
            The following clinicians requested to link their profile and sync with your ER department roster. Please verify and approve their registration:
          </p>
          <div className="space-y-2.5">
            {teamMembers.filter(m => m.status === "Pending Approval").map(req => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 rounded-xl">
                <div className="text-left space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-xs font-bold text-slate-900 dark:text-white">{req.name}</strong>
                    {onUpdateRole ? (
                      <select
                        value={req.role}
                        onChange={async (e) => {
                          try {
                            await onUpdateRole(req.id, e.target.value);
                          } catch (err) {
                            console.error("Error updating pending role:", err);
                          }
                        }}
                        className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-150 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer uppercase font-mono"
                      >
                        <option value="Senior Consultant">Senior Consultant</option>
                        <option value="EM Resident">EM Resident</option>
                        <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                      </select>
                    ) : (
                      <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                        {req.role}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                    Email: {req.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onDeclineMember ? onDeclineMember(req.id) : null}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Decline ✗
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveMember ? onApproveMember(req.id) : null}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    Approve ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. HOD Exclusive Workspace Tools */}
      {isUserHOD ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          
          {/* Shareable Invite Link Section */}
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                Step 1: Share Invitation Link
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pt-1">Dynamic Workspace Link</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Copy and share this secure onboarding link with your team members (via WhatsApp, Slack, or Email). When they tap the link and log in, they will automatically join your hospital group network!
              </p>
            </div>

            <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-450 truncate flex-1 pl-2 select-all">
                {generatedLink}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Add Team Member Section */}
          <form onSubmit={handleAddSubmit} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                Step 2: Whitelist & Add Members
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pt-1">Onboard Team Clinician</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Amit Verma"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email ID / Gmail</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="e.g. amit@gmail.com"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Post / Designation</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                  <option value="Senior Consultant">Senior Consultant</option>
                  <option value="EM Resident">EM Resident</option>
                  <option value="Scribe Specialist">Scribe Specialist</option>
                  <option value="EM Intern">EM Intern</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assign Shift Rota</label>
                <select
                  value={newShift}
                  onChange={e => setNewShift(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none"
                >
                  {activeShifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.time})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {errorMsg && <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 rounded-lg font-mono">{errorMsg}</p>}
            {successMsg && <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-3 py-1.5 rounded-lg font-mono">{successMsg}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? "Onboarding..." : "Whitelist & Onboard Member"}
            </button>
          </form>

          {/* Shift Time Configuration Panel */}
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 p-5 rounded-2xl space-y-4 col-span-1 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  Step 3: Customize Rota Shifts & Time Windows
                </span>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pt-1">Universal Shift Setup</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  As HOD, you can add new custom shifts, edit titles, and set exact duty hours. Modifications immediately update across all team browsers and rosters!
                </p>
              </div>

              
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceSync(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <span>Sync via Workspace</span>
                </button>
  <button
                type="button"
                onClick={() => setIsAddingNewShift(!isAddingNewShift)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingNewShift ? "Cancel Adding" : "+ Add New Shift"}</span>
              </button>
              </div>
            </div>

            {/* Add Shift Inline Form */}
            {isAddingNewShift && (
              <form onSubmit={handleCreateNewShift} className="p-4 bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-300 dark:border-indigo-800/80 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 uppercase font-mono">
                  <Sparkles className="w-3.5 h-3.5" /> Add New Shift Rota Option
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Shift Name / Code</label>
                    <input
                      type="text"
                      value={addShiftName}
                      onChange={e => setAddShiftName(e.target.value)}
                      placeholder="e.g. S3 Shift, Night Resus"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Duty Hours</label>
                    <input
                      type="text"
                      value={addShiftTime}
                      onChange={e => setAddShiftTime(e.target.value)}
                      placeholder="e.g. 07:00 - 15:00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Color Theme</label>
                    <select
                      value={addShiftColor}
                      onChange={e => setAddShiftColor(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                    >
                      {SHIFT_COLOR_OPTIONS.map((c, i) => (
                        <option key={i} value={c.color}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewShift(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Save & Add Shift
                  </button>
                </div>
              </form>
            )}

            {shiftActionMsg && (
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 px-3 py-2 rounded-xl font-mono">
                {shiftActionMsg}
              </p>
            )}

            {/* Grid of Shifts */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
              {editedShifts.map((s) => (
                <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-2.5 shadow-xs relative group">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => handleUpdateShiftField(s.id, "name", e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-slate-50 dark:focus:bg-slate-950 px-1 py-0.5 rounded transition-all w-full"
                      placeholder="Shift Title"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono font-bold ${s.color || 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {s.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(s.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Shift Option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">Duty Hours</label>
                      <input
                        type="text"
                        value={s.time}
                        onChange={(e) => handleUpdateShiftField(s.id, "time", e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-white font-mono"
                        placeholder="e.g. 08:00 - 14:00"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">Badge Color</label>
                      <select
                        value={s.color}
                        onChange={(e) => handleUpdateShiftField(s.id, "color", e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-800 dark:text-white font-bold"
                      >
                        {SHIFT_COLOR_OPTIONS.map((c, idx) => (
                          <option key={idx} value={c.color}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Total configured shift slots: <strong className="text-slate-700 dark:text-slate-200">{editedShifts.length}</strong>
              </span>
              <button
                type="button"
                onClick={handleSaveShifts}
                className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-extrabold"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Save Universal Shift Times</span>
              </button>
            </div>
          </div>

        </div>
      ) : null}

      {/* 3. Clinical Staffing Compliance Metric Banner */}
      <div className="bg-indigo-50/50 dark:bg-slate-950/20 border border-indigo-100 dark:border-slate-850 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/50 dark:border-indigo-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">Department Roster Status</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Currently {joinedMembers.length} team members joined and verified. Roster updates automatically as members log in.
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-mono shrink-0">
          Total allowlisted: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{teamMembers.length} seats</strong>
        </div>
      </div>

      {/* 4. Roster Filters */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search roster by name, email or post..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={shiftFilter}
            onChange={e => setShiftFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-bold"
          >
            <option value="all">All Shifts</option>
            {activeShifts.map(s => (
              <option key={s.id} value={s.id}>{s.name} Duty</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowShiftManagerModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Add new shift or edit existing shift rotas"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Add / Edit Shifts</span>
            <span className="sm:hidden">+ Shifts</span>
          </button>
        </div>
      </div>

      {/* 5. Roster Table */}
      <div className="border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/20">
        
        {/* Table Headers (Desktop) */}
        <div className="hidden md:grid grid-cols-12 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">Clinician & Email</div>
          <div className="col-span-3">Post / Designation</div>
          <div className="col-span-3">Assigned Shift</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Empty State */}
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-mono">
            No clinicians matched your roster filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {filteredMembers.map(member => {
              const isSelf = member.email.toLowerCase().trim() === userEmailLower;
              const activeShift = activeShifts.find(s => s.id === member.shift) || activeShifts[3] || activeShifts[0];

              return (
                <div 
                  key={member.id} 
                  className={`grid grid-cols-1 md:grid-cols-12 px-5 py-4 gap-3 items-center transition-all ${
                    isSelf 
                      ? "bg-indigo-50/20 dark:bg-indigo-950/10 border-l-2 border-indigo-500" 
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                  }`}
                >
                  
                  {/* Name, Email, Status */}
                  <div className="col-span-1 md:col-span-4 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        onClick={() => {
                          if (member.status === "Active (Joined)") {
                            setSelectedMemberForCases(member);
                            const activeCases = cases.filter(
                              c => c.doctorEmail?.toLowerCase().trim() === member.email.toLowerCase().trim() && c.status === "Active"
                            ).map(c => c.id);
                            setSelectedCaseIdsToTake(activeCases);
                          }
                        }}
                        className={`text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 ${
                          member.status === "Active (Joined)" ? "hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer" : ""
                        }`}
                        title={member.status === "Active (Joined)" ? "Click to view case logs & take handover" : undefined}
                      >
                        {member.name}
                      </span>
                      {isSelf && (
                        <span className="text-[8px] bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wide">
                          Self
                        </span>
                      )}
                      {member.status === "Active (Joined)" ? (
                        <span className="text-[8.5px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 px-2 py-0.2 rounded-full font-mono font-bold uppercase">
                          Active (Joined)
                        </span>
                      ) : member.status === "Pending Approval" ? (
                        <span className="text-[8.5px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450 border border-amber-200/50 dark:border-amber-900/30 px-2 py-0.2 rounded-full font-mono font-bold uppercase animate-pulse">
                          Pending Approval
                        </span>
                      ) : (
                        <span className="text-[8.5px] bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 px-2 py-0.2 rounded-full font-mono font-bold uppercase">
                          Claim Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{member.email}</span>
                    </div>
                  </div>

                  {/* Designation (Post) */}
                  <div className="col-span-1 md:col-span-3 flex items-center">
                    {isUserHOD && !isSelf && onUpdateRole ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <select
                          value={member.role}
                          onChange={async (e) => {
                            try {
                              await onUpdateRole(member.id, e.target.value);
                            } catch (err) {
                              console.error("Error updating member role:", err);
                            }
                          }}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-750 dark:text-slate-200"
                        >
                          <option value="Senior Consultant">Senior Consultant</option>
                          <option value="EM Resident">EM Resident</option>
                          <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-sans">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        {member.role}
                      </span>
                    )}
                  </div>

                  {/* Assigned Shift */}
                  <div className="col-span-1 md:col-span-3 space-y-1.5">
                    {/* Shift Dropdown for HOD OR if the user is changing their OWN shift */}
                    {isUserHOD || isSelf ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={member.shift}
                          onChange={async (e) => {
                            try {
                              await onUpdateShift(member.id, e.target.value);
                            } catch (err) {
                              console.error("Error updating shift:", err);
                            }
                          }}
                          className={`bg-white dark:bg-slate-950 border text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                            activeShift.color.split(" ")[0]
                          } ${activeShift.color.split(" ")[2]}`}
                        >
                          {activeShifts.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.time})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setCalendarModalConfig({
                              defaultEventType: "shift",
                              initialTitle: `ER Duty Shift (${activeShift.name}) — Dr. ${member.name}`,
                              initialDescription: `Scheduled Duty Shift (${activeShift.time}) for ${member.name} (${member.role}) at ${profile.hospital || "Emergency Department"}.`,
                              initialStartTime: activeShift.time.split(" - ")[0] || "08:00",
                              initialEndTime: activeShift.time.split(" - ")[1] || "14:00",
                            });
                            setIsCalendarModalOpen(true);
                          }}
                          className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                          title={`Sync ${member.name}'s ${activeShift.name} shift to Google Calendar`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className={`inline-flex flex-col px-3 py-1 border rounded-xl ${activeShift.color}`}>
                        <span className="text-xs font-extrabold">{activeShift.name}</span>
                        <span className="text-[9.5px] opacity-80 font-mono">{activeShift.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons (HOD Only) */}
                  <div className="col-span-1 md:col-span-2 flex justify-start md:justify-end gap-2.5">
                    {isUserHOD ? (
                      pendingDeleteId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              try {
                                await onRemoveMember(member.id);
                                setPendingDeleteId(null);
                              } catch (err) {
                                console.error("Error removing member:", err);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black rounded-lg transition-all cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteId(member.id)}
                          className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-mono">Read Only</span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 6. HOD Cases Review & Handover Sliding Overlay */}
      {selectedMemberForCases && (() => {
        const memberEmailLower = selectedMemberForCases.email.toLowerCase().trim();
        const memberCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === memberEmailLower);
        const activeMemberCases = memberCases.filter(c => c.status === "Active");
        const dischargedMemberCases = memberCases.filter(c => c.status === "Discharged");

        const handleToggleSelectCase = (caseId: string) => {
          if (selectedCaseIdsToTake.includes(caseId)) {
            setSelectedCaseIdsToTake(prev => prev.filter(id => id !== caseId));
          } else {
            setSelectedCaseIdsToTake(prev => [...prev, caseId]);
          }
        };

        const handleSelectAll = () => {
          if (selectedCaseIdsToTake.length === activeMemberCases.length) {
            setSelectedCaseIdsToTake([]);
          } else {
            setSelectedCaseIdsToTake(activeMemberCases.map(c => c.id));
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
                  dispositionDetails: {
                    ...(targetCase.dispositionDetails || { dispositionType: "Discharge", durationInEr: "", residentName: "Dr. " + profile.name, consultantName: "Dr. " + profile.name, observationNotes: "" }),
                    residentName: "Dr. " + profile.name
                  }
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
            alert("An error occurred during handover sync. Please try again.");
          } finally {
            setHandoverInProgress(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end animate-fade-in no-print">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-950 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
              
              {/* Overlay Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
                      Cases Seen By: Dr. {selectedMemberForCases.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {selectedMemberForCases.email} • {selectedMemberForCases.role}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMemberForCases(null)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-all font-bold text-xs"
                >
                  ✕ Close Panel
                </button>
              </div>

              {/* Success Alert */}
              {handoverSuccessMsg && (
                <div className="mx-6 mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {handoverSuccessMsg}
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 p-6 space-y-6">
                
                {/* 1. Active Case Logs for Handover */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2">
                    <h4 className="text-xs font-extrabold uppercase text-indigo-600 dark:text-indigo-400 font-mono tracking-wide flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Active Cases for Handover ({activeMemberCases.length})
                    </h4>
                    {activeMemberCases.length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className="text-[10px] text-indigo-500 hover:underline font-bold"
                      >
                        {selectedCaseIdsToTake.length === activeMemberCases.length ? "Deselect All" : "Select All Active"}
                      </button>
                    )}
                  </div>

                  {activeMemberCases.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-450 italic">No active clinical cases currently managed by this clinician.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {activeMemberCases.map((c, idx) => {
                        const isSelected = selectedCaseIdsToTake.includes(c.id);
                        return (
                          <div
                            key={`${c.id}-${idx}`}
                            onClick={() => handleToggleSelectCase(c.id)}
                            className={`p-3.5 border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10"
                                : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                            }`}
                          >
                            <div className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors">
                              {isSelected ? (
                                <CheckSquare className="w-4.5 h-4.5 text-indigo-500" />
                              ) : (
                                <Square className="w-4.5 h-4.5" />
                              )}
                            </div>
                            
                            <div className="flex-1 text-left space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10.5px] font-black bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-755">
                                  {c.bedNo || "No Bed"}
                                </span>
                                <span className="text-xs font-bold text-slate-850 dark:text-slate-100">{c.patient.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{c.patient.age || "N/A"}y • {c.patient.gender}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal line-clamp-1">
                                <strong className="text-indigo-600 dark:text-indigo-400">CC:</strong> {c.patient.presentingComplaint}
                              </p>
                              {c.provisionalPrimaryDiagnosis && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                  Diagnosis: {c.provisionalPrimaryDiagnosis}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Historic / Discharged Cases */}
                <div className="space-y-3">
                  <div className="border-b border-slate-150 dark:border-slate-800 pb-2">
                    <h4 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 font-mono tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Discharged / Resolved Cases ({dischargedMemberCases.length})
                    </h4>
                  </div>

                  {dischargedMemberCases.length === 0 ? (
                    <div className="py-6 text-center bg-slate-50/50 dark:bg-slate-900/10 rounded-xl">
                      <p className="text-xs text-slate-400 italic">No resolved or archived cases registered on profile.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {dischargedMemberCases.map((c, idx) => (
                        <div
                          key={`${c.id}-${idx}`}
                          className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl flex justify-between items-center text-left"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-1.5 py-0.2 rounded font-mono">
                                Resolved
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.patient.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{c.patient.age || "N/A"}y • {c.patient.gender}</span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {c.patient.presentingComplaint}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{c.savedTime}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Actions Footer */}
              {activeMemberCases.length > 0 && (
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Selected cases for handover:</span>
                    <strong className="text-slate-800 dark:text-white font-bold">{selectedCaseIdsToTake.length} of {activeMemberCases.length}</strong>
                  </div>
                  
                  <button
                    type="button"
                    disabled={selectedCaseIdsToTake.length === 0 || handoverInProgress}
                    onClick={handleTakeHandoverAction}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {handoverInProgress ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Syncing Handover, please wait...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        Take Handover of Selected Cases
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-normal">
                    This action will legally re-route and transfer selected cases to Dr. {profile.name} inside the cloud clinical database.
                  </p>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* Shift Manager Modal */}
      {showShiftManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 my-auto">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Department Duty Shift Manager</h3>
                  <p className="text-xs text-slate-300">Add new shift slots or edit existing duty hours for Dr. {profile.name}'s department</p>
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

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Add New Shift Section */}
              <div className="p-4 bg-indigo-50/50 dark:bg-slate-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                    <Plus className="w-4 h-4" /> Add New Shift Rota
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">e.g., Night Resus, S1, ICU Duty</span>
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
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 px-3 py-2 rounded-xl font-mono">
                  {shiftActionMsg}
                </p>
              )}

              {/* List of Configured Shifts */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-mono">
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
                          placeholder="Shift Name"
                        />
                        <input
                          type="text"
                          value={s.time}
                          onChange={(e) => handleUpdateShiftField(s.id, "time", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200 w-32"
                          placeholder="Duty Hours"
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
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Delete Shift"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
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

      {/* Google Calendar Sync Modal */}
      <GoogleCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        defaultEventType={calendarModalConfig.defaultEventType}
        initialTitle={calendarModalConfig.initialTitle}
        initialDescription={calendarModalConfig.initialDescription}
        initialStartTime={calendarModalConfig.initialStartTime}
        initialEndTime={calendarModalConfig.initialEndTime}
        hospitalName={profile.hospital || "Emergency Department"}
      />
    
      {showWorkspaceSync && (
        <WorkspaceRotaSyncModal
          onClose={() => setShowWorkspaceSync(false)}
          onSuccess={(count) => {
             setShowWorkspaceSync(false);
             alert(`Successfully synced ${count} shifts to Google Calendar!`);
          }}
        />
      )}
    </div>
  );
}
