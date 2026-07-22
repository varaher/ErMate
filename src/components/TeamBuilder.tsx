import React, { useState, useEffect } from "react";
import { 
  Users, Mail, Plus, Trash2, Link, Copy, Check, Info, Sparkles, 
  Building2, ArrowRight, ShieldCheck, CheckCircle2, UserCheck, 
  AlertCircle, ShieldAlert, FileText, Send, UserX, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TeamMember } from "../types";

interface TeamBuilderProps {
  hospitalName: string;
  onHospitalChange: (name: string) => void;
  members?: TeamMember[];
  onMembersChange?: (members: TeamMember[]) => void;
  profile?: any;
  onSaveConfig?: (teamName: string, department: string, teamColor: "emerald" | "blue" | "indigo" | "violet") => void;
}

export default function TeamBuilder({ 
  hospitalName, 
  onHospitalChange,
  members: externalMembers,
  onMembersChange: setExternalMembers,
  profile,
  onSaveConfig
}: TeamBuilderProps) {
  // Team configuration states
  const [teamName, setTeamName] = useState(profile?.teamName || "Varah Emergency Core");
  const [department, setDepartment] = useState(profile?.department || "Trauma & Resuscitation Unit");
  const [teamColor, setTeamColor] = useState<"emerald" | "blue" | "indigo" | "violet">(profile?.teamColor || "blue");
  const [isConfigSaved, setIsConfigSaved] = useState(true);

  // Sync state with props when profile loads
  useEffect(() => {
    if (profile?.teamName) {
      setTeamName(profile.teamName);
    }
  }, [profile?.teamName]);

  useEffect(() => {
    if (profile?.department) {
      setDepartment(profile.department);
    }
  }, [profile?.department]);

  useEffect(() => {
    if (profile?.teamColor) {
      setTeamColor(profile.teamColor);
    }
  }, [profile?.teamColor]);

  // Members states
  const [localMembers, setLocalMembers] = useState<TeamMember[]>([
    { id: "mem-1", email: "dr.vipin@gmail.com", role: "HOD / Shift Lead", status: "Pending Invite" },
    { id: "mem-2", email: "priya.nair@gmail.com", role: "Senior Consultant", status: "Pending Invite" },
    { id: "mem-3", email: "sanjay.verma@gmail.com", role: "EM Resident", status: "Pending Invite" },
    { id: "mem-4", email: "dr.ananya@gmail.com", role: "Scribe Specialist", status: "Pending Invite" },
  ]);

  const members = externalMembers || localMembers;
  const setMembers = (update: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) => {
    if (setExternalMembers && externalMembers) {
      if (typeof update === "function") {
        setExternalMembers(update(externalMembers));
      } else {
        setExternalMembers(update);
      }
    } else {
      if (typeof update === "function") {
        setLocalMembers(update);
      } else {
        setLocalMembers(update);
      }
    }
  };

  // Input states
  const [singleEmail, setSingleEmail] = useState("");
  const [singleRole, setSingleRole] = useState("EM Resident");
  const [bulkEmailsText, setBulkEmailsText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputMode, setInputMode] = useState<"single" | "bulk">("single");

  // Notification and simulation states
  const [copiedLink, setCopiedLink] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedSimEmail, setSelectedSimEmail] = useState("");

  // Helper: Slugify names to generate clean URLs
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const getThemeClasses = () => {
    switch (teamColor) {
      case "emerald":
        return {
          primary: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
          accent: "text-emerald-500 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-900/40",
          bgLight: "bg-emerald-50/50 dark:bg-emerald-950/20",
          gradient: "from-emerald-950 via-slate-900 to-teal-950",
          badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30",
        };
      case "indigo":
        return {
          primary: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
          accent: "text-indigo-500 dark:text-indigo-400",
          border: "border-indigo-200 dark:border-indigo-900/40",
          bgLight: "bg-indigo-50/50 dark:bg-indigo-950/20",
          gradient: "from-indigo-950 via-slate-900 to-slate-950",
          badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30",
        };
      case "violet":
        return {
          primary: "bg-violet-600 hover:bg-violet-700 focus:ring-violet-500",
          accent: "text-violet-500 dark:text-violet-400",
          border: "border-violet-200 dark:border-violet-900/40",
          bgLight: "bg-violet-50/50 dark:bg-violet-950/20",
          gradient: "from-violet-950 via-slate-900 to-fuchsia-950",
          badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200/50 dark:border-violet-900/30",
        };
      default:
        return {
          primary: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          accent: "text-blue-500 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-900/40",
          bgLight: "bg-blue-50/50 dark:bg-blue-950/20",
          gradient: "from-blue-950 via-slate-900 to-indigo-950",
          badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30",
        };
    }
  };

  const theme = getThemeClasses();

  // Generated Link format based on hospital & team configurations
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital.in";
  const generatedLink = `${currentOrigin}/join/${slugify(hospitalName)}?team=${slugify(teamName)}&dept=${slugify(department)}&ref=hosp_sub_active`;

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    showNotification("Dynamic Invite Link copied to clipboard! Share this with your team.", "success");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddSingleMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmail.trim()) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }
    if (!singleEmail.includes("@")) {
      showNotification("Email must contain @ (e.g. amit@gmail.com).", "error");
      return;
    }

    const emailLower = singleEmail.trim().toLowerCase();
    const isDuplicate = members.some(m => m.email.toLowerCase() === emailLower);

    if (isDuplicate) {
      showNotification(`${singleEmail} is already whitelisted on this team.`, "error");
      return;
    }

    const newMem: TeamMember = {
      id: `mem-${Date.now()}`,
      email: emailLower,
      role: singleRole,
      status: "Pending Invite",
    };

    setMembers(prev => [...prev, newMem]);
    setSingleEmail("");
    showNotification(`Successfully whitelisted ${emailLower} for the team!`, "success");
  };

  const handleBulkAddMembers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmailsText.trim()) {
      showNotification("Please enter emails to bulk import.", "error");
      return;
    }

    const emailTokens = bulkEmailsText
      .split(/[,;\n\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.includes("@"));

    if (emailTokens.length === 0) {
      showNotification("No valid email addresses found in the bulk input.", "error");
      return;
    }

    let addedCount = 0;
    let duplicateCount = 0;
    const newMems: TeamMember[] = [];

    emailTokens.forEach((email, idx) => {
      const isDuplicate = members.some(m => m.email.toLowerCase() === email) || newMems.some(m => m.email.toLowerCase() === email);
      if (isDuplicate) {
        duplicateCount++;
      } else {
        newMems.push({
          id: `mem-${Date.now()}-${idx}`,
          email,
          role: "EM Resident",
          status: "Pending Invite",
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setMembers(prev => [...prev, ...newMems]);
      setBulkEmailsText("");
      showNotification(`Bulk imported ${addedCount} team members successfully!${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ""}`, "success");
    } else {
      showNotification("All entered email addresses are already whitelisted on the team.", "error");
    }
  };

  const handleRemoveMember = (id: string, email: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    if (selectedSimEmail === email) {
      setSelectedSimEmail("");
    }
    showNotification(`Removed ${email} from the whitelist pool.`, "success");
  };

  // Simulate a clinical team colleague receiving the invite link, clicking it, and joining!
  const handleSimulateClickJoin = () => {
    if (!selectedSimEmail) {
      showNotification("Please select a colleague to simulate joining.", "error");
      return;
    }

    setMembers(prev =>
      prev.map(m => {
        if (m.email === selectedSimEmail) {
          return {
            ...m,
            status: "Active (Joined)",
            joinedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (Just Now)",
          };
        }
        return m;
      })
    );

    showNotification(`SIMULATION SUCCESS: ${selectedSimEmail} clicked the invite link and activated their clinical seat!`, "success");
  };

  // Filtering whitelisted roster
  const filteredMembers = members.filter(
    m => m.email.toLowerCase().includes(searchQuery.toLowerCase()) || m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = members.filter(m => m.status === "Active (Joined)").length;
  const pendingCount = members.filter(m => m.status === "Pending Invite").length;

  return (
    <div className="space-y-6" id="team-builder-workspace">
      {/* Dynamic Animated Status Toast banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-3 max-w-sm font-sans ${
              notification.type === "success"
                ? "bg-emerald-950/95 text-emerald-200 border-emerald-800"
                : "bg-rose-950/95 text-rose-200 border-rose-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-semibold">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header with Active Status Banner */}
      <div className={`bg-gradient-to-r p-6 rounded-2xl border shadow-md relative overflow-hidden transition-all duration-300 ${theme.gradient} text-white`}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full border font-mono tracking-widest ${
                activeCount > 0
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/20 animate-pulse"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/20"
              }`}>
                {activeCount > 0 ? "🟢 Group Subscription Activated" : "🟡 Team Awaiting First Link Claim"}
              </span>
              <span className="bg-white/10 text-white/80 text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-white/5">
                Hospital License Panel
              </span>
            </div>
            
            <h2 className="text-2xl font-black font-display tracking-tight text-white mt-1">
              {hospitalName}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl font-mono leading-relaxed">
              Create your hospital team workspace, whitelist member doctors by their Gmail addresses, and generate a secure clinical invitation link. Once any colleague clicks and joins, your Group License instantly activates!
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[210px] text-center font-mono space-y-1">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Roster Activation State</span>
            <div className="text-2xl font-black text-white flex items-center justify-center gap-1.5">
              <span>{activeCount} Joined</span>
              <span className="text-xs text-slate-400 font-normal">/ {members.length} seats</span>
            </div>
            <span className={`text-[9.5px] block font-bold ${activeCount > 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {activeCount > 0 ? "✓ Roster Go-Live Active" : "Awaiting colleague click..."}
            </span>
          </div>
        </div>

        {/* Informational Warning about subscription requirements */}
        {activeCount === 0 && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-[11px] font-mono leading-relaxed text-amber-200 animate-pulse">
            <span className="text-base shrink-0">⚠️</span>
            <div>
              <strong>Pending Condition:</strong> To trigger hospital team subscription activation, copy the prepared invite link, paste it in the simulator box below, and simulate a colleague joining the team.
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Team Configuration & Invite Link Builder (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Team Configuration */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                Team Workplace Info
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Customize metadata to brand the invitation link landing pages.</p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Hospital / Institution Name</label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => {
                    onHospitalChange(e.target.value);
                    setIsConfigSaved(false);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                  placeholder="e.g. Varah Group Emergency Care"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Team Core Identifier</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setIsConfigSaved(false);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                  placeholder="e.g. EM Trauma Response Core"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Specialty Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setIsConfigSaved(false);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                  placeholder="e.g. Emergency & Trauma Medicine"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Brand Theme Accent</label>
                <div className="flex gap-2">
                  {(["blue", "emerald", "indigo", "violet"] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setTeamColor(color);
                        setIsConfigSaved(false);
                      }}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-mono capitalize border transition-all ${
                        teamColor === color
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-800 dark:border-slate-200 font-extrabold"
                          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {!isConfigSaved && (
                <button
                  type="button"
                  onClick={() => {
                    setIsConfigSaved(true);
                    showNotification("Team details updated successfully!", "success");
                    if (onSaveConfig) {
                      onSaveConfig(teamName, department, teamColor);
                    }
                  }}
                  className={`w-full py-2 ${theme.primary} text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5`}
                >
                  <ShieldCheck className="w-4 h-4" /> Apply & Update Configuration
                </button>
              )}
            </div>
          </div>

          {/* Secure Live Link Generator */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Link className="w-4 h-4 text-blue-500" />
                  Prepared Invitation Link
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Copy this secure token to onboard whitelisted medical staff.</p>
              </div>
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                Secure SSL
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-850 flex items-center gap-2">
              <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 select-all truncate flex-1">
                {generatedLink}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 transition-all shrink-0"
                title="Copy Invite Link"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Simulated Vector QR Mockup */}
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900 flex items-center gap-4">
              {/* QR Pattern visual */}
              <div className="w-14 h-14 bg-slate-900 dark:bg-slate-100 rounded-lg p-1 shrink-0 flex flex-wrap gap-[2.5px] overflow-hidden opacity-90 relative">
                <div className="absolute inset-1.5 border border-red-500/30 animate-pulse pointer-events-none" />
                {Array.from({ length: 49 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-[5px] h-[5px] rounded-xs ${
                      (i % 3 === 0 || i % 7 === 0 || i < 12 || i > 38) 
                        ? "bg-slate-100 dark:bg-slate-900" 
                        : "bg-slate-900 dark:bg-slate-100"
                    }`} 
                  />
                ))}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 block font-mono">Scan QR for On-Call Access</span>
                <p className="text-[9px] text-slate-400 leading-normal">
                  Colleagues can scan to join the group EMR workflow during emergency ward rounds.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: whitelists & Sandbox simulator (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Member Management Console */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 shadow-xs space-y-4">
            
            <div className="border-b border-slate-100 dark:border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Roster Whitelist Pool
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Whitelist doctors by email so they can unlock the shared hospital subscription.</p>
              </div>

              {/* Add Modes selectors */}
              <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-150 dark:border-slate-850 self-start">
                <button
                  type="button"
                  onClick={() => setInputMode("single")}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    inputMode === "single"
                      ? `${theme.primary} text-white shadow-xs`
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Single Email
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("bulk")}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    inputMode === "bulk"
                      ? `${theme.primary} text-white shadow-xs`
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Bulk Import
                </button>
              </div>
            </div>

            {/* Inputs based on current active tab */}
            {inputMode === "single" ? (
              <form onSubmit={handleAddSingleMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Gmail Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)}
                      placeholder="e.g. amit.verma@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Clinical Designation</label>
                  <select
                    value={singleRole}
                    onChange={(e) => setSingleRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="HOD / Shift Lead">HOD / Shift Lead</option>
                    <option value="Senior Consultant">Senior Consultant</option>
                    <option value="EM Resident">EM Resident</option>
                    <option value="Scribe Specialist">Scribe Specialist</option>
                    <option value="EM Intern">EM Intern</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className={`w-full py-2 ${theme.primary} text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Whitelist
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkAddMembers} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Paste Gmail List</label>
                  <textarea
                    rows={2}
                    value={bulkEmailsText}
                    onChange={(e) => setBulkEmailsText(e.target.value)}
                    placeholder="e.g. rahul.sharma@gmail.com, amit.clinical@gmail.com, priya.nair@gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-none font-mono"
                  />
                  <p className="text-[9.5px] text-slate-400 font-mono">
                    Separate emails using commas, semicolons, or lines. Non-emails are safely parsed out.
                  </p>
                </div>
                <button
                  type="submit"
                  className={`w-full py-2 ${theme.primary} text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm`}
                >
                  <Plus className="w-3.5 h-3.5" /> Bulk Whitelist Team
                </button>
              </form>
            )}

            {/* Search and Table of whitelisted members */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                  Current Whitelisted Members List ({filteredMembers.length})
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter roster..."
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10.5px] focus:outline-none max-w-[150px]"
                />
              </div>

              {filteredMembers.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <UserX className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-400 font-bold">No whitelisted members found</p>
                  <p className="text-[10px] text-slate-400 font-mono">Try clearing your filters or whitelist a doctor.</p>
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-slate-900/10">
                  <table className="min-w-full text-left border-collapse font-sans">
                    <thead className="bg-slate-100/50 dark:bg-slate-900 text-[9px] font-bold uppercase font-mono text-slate-500">
                      <tr>
                        <th className="p-2.5">Email Address</th>
                        <th className="p-2.5">Designation</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-xs text-slate-700 dark:text-slate-300">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/30">
                          <td className="p-2.5 font-mono text-[11px] truncate max-w-[160px]" title={member.email}>
                            {member.email}
                          </td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-[10.5px]">
                            {member.role}
                          </td>
                          <td className="p-2.5">
                            {member.status === "Active (Joined)" ? (
                              <span className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {member.joinedAt || "Joined"}
                              </span>
                            ) : (
                              <span className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 font-bold font-mono text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                Pending Link Click
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id, member.email)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                              title="Remove whitelist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sandbox Invitation Activator Simulator */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950/90 text-white border border-indigo-800/40 rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="border-b border-indigo-900/60 pb-3 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-1.5 font-mono">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                  Link Click Sandbox Simulator
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Simulate a coworker clicking the generated invitation link on their device.
                </p>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-mono border border-emerald-500/30 rounded px-1.5 py-0.2 uppercase font-bold tracking-wider animate-pulse">
                Interactive DEMO
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-indigo-200 uppercase tracking-wider font-mono">
                  Select Whitelisted Colleague to Join
                </label>
                <div className="flex gap-2.5">
                  <select
                    value={selectedSimEmail}
                    onChange={(e) => setSelectedSimEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="">-- Choose whitelisted doctor --</option>
                    {members
                      .filter(m => m.status === "Pending Invite")
                      .map((m) => (
                        <option key={m.id} value={m.email}>
                          {m.email} ({m.role})
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleSimulateClickJoin}
                    disabled={!selectedSimEmail}
                    className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-md ${
                      selectedSimEmail 
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/25 cursor-pointer" 
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Simulate Join
                  </button>
                </div>
              </div>

              {members.filter(m => m.status === "Pending Invite").length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5 text-[10.5px] font-mono leading-relaxed text-emerald-300">
                  <span className="text-base shrink-0">🎉</span>
                  <div>
                    <strong>Roster Sandbox Fully Joined!</strong> All whitelisted doctors have completed their simulated onboarding. The entire emergency ward is active under your premium EMR group license!
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-mono leading-relaxed italic">
                  💡 <strong>How to test:</strong> Whitelist an email like <code>doctor.varah@hospital.in</code>, select it in the dropdown above, and click "Simulate Join" to witness automatic activation of your team license!
                </p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
