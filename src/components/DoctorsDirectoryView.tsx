import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { UserProfile, HodClaimRequest } from "../types";
import { Search, Building2, MapPin, ShieldAlert, Crown, CheckCircle2, AlertCircle, Clock, UserCheck, ChevronRight, Users, Sparkles } from "lucide-react";

interface DoctorsDirectoryViewProps {
  currentProfile: UserProfile;
  onNavigateToTab?: (tabId: string) => void;
}

export default function DoctorsDirectoryView({ currentProfile, onNavigateToTab }: DoctorsDirectoryViewProps) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Search & Filter state
  const [searchHospital, setSearchHospital] = useState(currentProfile.hospital || "");
  const [searchState, setSearchState] = useState(currentProfile.state || "All");
  const [searchQuery, setSearchQuery] = useState("");

  // Claim HOD Modal State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimReason, setClaimReason] = useState("");
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState("");
  const [claimErrorMsg, setClaimErrorMsg] = useState("");
  const [existingUserClaims, setExistingUserClaims] = useState<HodClaimRequest[]>([]);

  // 1. Fetch live users collection
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      setAllUsers(users);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Error fetching users directory:", err);
      setLoadingUsers(false);
    });

    return () => unsub();
  }, []);

  // 2. Fetch user's existing HOD claim requests
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "hodClaimRequests"),
      where("claimedByUid", "==", auth.currentUser.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const claims: HodClaimRequest[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HodClaimRequest));
      setExistingUserClaims(claims);
    }, (err) => {
      console.warn("Could not fetch user claim requests:", err);
    });

    return () => unsub();
  }, []);

  // Filter users based on hospital, state, and text query
  const filteredDoctors = allUsers.filter((u) => {
    const matchesHospital = !searchHospital.trim() || u.hospital?.toLowerCase().includes(searchHospital.toLowerCase().trim());
    const matchesState = searchState === "All" || u.state === searchState;
    const matchesQuery = !searchQuery.trim() || 
      u.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase().trim());

    return matchesHospital && matchesState && matchesQuery;
  });

  // Target hospital for HOD existence check
  const activeHospital = searchHospital.trim() || currentProfile.hospital;

  // Check if HOD exists for the active hospital
  const isHODRole = (role?: string) => {
    if (!role) return false;
    const r = role.toLowerCase();
    return r.includes("hod") || r.includes("owner") || r.includes("head") || r.includes("lead");
  };

  const activeHospitalDoctors = allUsers.filter(u => u.hospital?.toLowerCase().trim() === activeHospital.toLowerCase().trim());
  const verifiedHOD = activeHospitalDoctors.find(u => isHODRole(u.role));
  const hodExists = !!verifiedHOD;

  // Pending claim for active hospital
  const pendingClaimForHospital = existingUserClaims.find(
    c => c.hospital.toLowerCase().trim() === activeHospital.toLowerCase().trim() && c.status === "pending"
  );

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimReason.trim()) {
      setClaimErrorMsg("Please explain why you are requesting to lead this department.");
      return;
    }

    if (!auth.currentUser) {
      setClaimErrorMsg("You must be logged in to submit an HOD claim.");
      return;
    }

    setIsSubmittingClaim(true);
    setClaimErrorMsg("");
    setClaimSuccessMsg("");

    try {
      await addDoc(collection(db, "hodClaimRequests"), {
        hospital: activeHospital,
        place: currentProfile.place || "",
        state: currentProfile.state || "Maharashtra",
        pincode: currentProfile.pincode || "",
        claimedByUid: auth.currentUser.uid,
        claimedByName: currentProfile.name,
        claimedByEmail: currentProfile.email,
        reason: claimReason.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionNote: null,
      });

      setClaimSuccessMsg(`Your request to lead ${activeHospital} as Head of Department has been submitted to ErMate Admin (varahgrp@gmail.com) for verification.`);
      setClaimReason("");
      setTimeout(() => {
        setIsClaimModalOpen(false);
      }, 3500);
    } catch (err: any) {
      console.error("Error submitting HOD claim:", err);
      setClaimErrorMsg(err.message || "Failed to submit claim request.");
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 dark:text-slate-100">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-indigo-500/30">
                <Building2 className="w-3.5 h-3.5" /> Self-Reported Informational Directory
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-display tracking-tight">
              Doctors Directory
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Browse clinicians across institutions. Directory listings are self-reported for searchability and DO NOT grant access to patient cases or EMR handovers.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("team")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 font-mono cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Go to Verified Team Roster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-Tier Architectural Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider">
              Two-Tier Security Notice
            </h3>
            <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              <strong>Directory vs. Team Roster:</strong> Being listed in the Directory is self-reported and grants <strong>zero access</strong> to patient data or handovers. Real PHI access requires verified Team Roster membership approved by the Head of Department.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Bootstrapping HOD Claim Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500" /> Search Hospital Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter self-reported clinicians by hospital name, state, or doctor identity.
            </p>
          </div>

          {/* Hospital HOD Status Badge or Bootstrapping Claim Button */}
          <div>
            {hodExists ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Verified HOD: {verifiedHOD.name}</span>
              </div>
            ) : pendingClaimForHospital ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>HOD Claim Pending Admin Review</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 font-mono cursor-pointer"
              >
                <Crown className="w-4 h-4 text-amber-200" />
                <span>Request to Lead This Department</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500 block">
              Hospital Name Filter
            </label>
            <input
              type="text"
              value={searchHospital}
              onChange={(e) => setSearchHospital(e.target.value)}
              placeholder="e.g. Rajagiri Hospital"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500 block">
              State Filter
            </label>
            <select
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All States</option>
              <option value="Kerala">Kerala</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi NCR</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Telangana">Telangana</option>
              <option value="Gujarat">Gujarat</option>
              <option value="West Bengal">West Bengal</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500 block">
              Doctor Name / Email Query
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctor or email..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Clinicians Self-Reporting "{activeHospital || 'All Hospitals'}" ({filteredDoctors.length})
          </h3>
          <span className="text-[10px] font-mono text-slate-400 font-bold">
            Public Directory View
          </span>
        </div>

        {loadingUsers ? (
          <div className="py-8 text-center text-xs font-mono text-slate-400">
            Loading directory listings...
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 font-mono">
              No doctors found matching "{activeHospital}".
            </p>
            {!hodExists && (
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
              >
                Be the first to claim & lead {activeHospital}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="py-3 px-4">Doctor Name</th>
                  <th className="py-3 px-4">Self-Reported Hospital</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4 text-right">Access Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredDoctors.map((doc, idx) => {
                  const isHOD = isHODRole(doc.role);
                  return (
                    <tr key={doc.email || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">{doc.name || "Dr. Clinician"}</p>
                          {isHOD && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase flex items-center gap-1">
                              👑 HOD
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">{doc.email}</p>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {doc.hospital || "Emergency Dept"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {doc.state || "Maharashtra"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold rounded-md">
                          {doc.role || "EM Resident"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold rounded-xl border border-slate-200 dark:border-slate-700">
                          Directory Only (No PHI Access)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Claim HOD Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  Request to Lead {activeHospital}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                No verified Head of Department currently exists for <strong>{activeHospital}</strong>. Submitting this claim initiates the manual verification gate with ErMate Administrator.
              </p>

              {claimErrorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl font-mono">
                  ⚠️ {claimErrorMsg}
                </div>
              )}

              {claimSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl font-mono leading-relaxed">
                  ✓ {claimSuccessMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500 block">
                  Why are you requesting to lead this department? *
                </label>
                <textarea
                  value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value)}
                  placeholder="e.g. I am the senior-most Emergency Physician / HOD at Rajagiri Hospital, creating our official ER team roster."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClaim ? "Submitting Request..." : "Submit HOD Claim Request"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
