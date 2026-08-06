import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle, 
  UserCheck, AlertCircle, Sparkles, Send, RefreshCw, Lock, Award
} from "lucide-react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { UserProfile } from "../types";

interface RoleChangeSectionProps {
  profile: UserProfile;
  onRoleUpdated?: () => void;
}

interface RoleRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  currentRole: string;
  requestedRole: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  hospital?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export default function RoleChangeSection({ profile, onRoleUpdated }: RoleChangeSectionProps) {
  const currentRole = profile.role || "EM Resident / Duty Doc";
  const userRoleLower = currentRole.toLowerCase();
  const userEmail = (profile.email || auth.currentUser?.email || "").toLowerCase().trim();

  const isHOD = userRoleLower.includes("hod") || 
                userRoleLower.includes("head") || 
                userRoleLower.includes("lead") || 
                userRoleLower.includes("owner") || 
                userEmail === "varahgrp@gmail.com";

  // State for non-HOD applicants
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [targetRole, setTargetRole] = useState("Senior Consultant");
  const [requestReason, setRequestReason] = useState("");
  const [userPendingRequest, setUserPendingRequest] = useState<RoleRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");
  const [requestError, setRequestError] = useState("");

  // State for HOD reviewers
  const [pendingRequests, setPendingRequests] = useState<RoleRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewActioningId, setReviewActioningId] = useState<string | null>(null);

  // Subscribe to user's pending request (for Non-HODs) or all pending requests (for HODs)
  useEffect(() => {
    if (!auth.currentUser) return;

    if (!isHOD) {
      // Non-HOD: fetch/listen to user's own pending request
      const q = query(
        collection(db, "roleChangeRequests"),
        where("requestedBy", "==", auth.currentUser.uid),
        where("status", "==", "pending")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setUserPendingRequest({ id: docData.id, ...docData.data() } as RoleRequest);
        } else {
          setUserPendingRequest(null);
        }
      }, (err) => {
        console.warn("Error fetching role requests:", err);
      });

      return () => unsubscribe();
    } else {
      // HOD: listen to all pending requests
      setLoadingRequests(true);
      const q = query(
        collection(db, "roleChangeRequests"),
        where("status", "==", "pending")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests: RoleRequest[] = [];
        snapshot.forEach((docSnap) => {
          requests.push({ id: docSnap.id, ...docSnap.data() } as RoleRequest);
        });
        setPendingRequests(requests);
        setLoadingRequests(false);
      }, (err) => {
        console.warn("Error fetching HOD pending requests:", err);
        setLoadingRequests(false);
      });

      return () => unsubscribe();
    }
  }, [isHOD, auth.currentUser?.uid]);

  // Submit role change request (Non-HOD)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError("");
    setRequestSuccess("");

    if (!auth.currentUser) {
      setRequestError("You must be logged in to submit a role request.");
      return;
    }

    if (requestReason.trim().length < 10) {
      setRequestError("Please provide a clinical justification of at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "roleChangeRequests"), {
        requestedBy: auth.currentUser.uid,
        requestedByName: profile.name || userEmail,
        requestedByEmail: userEmail,
        currentRole: currentRole,
        requestedRole: targetRole,
        reason: requestReason.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
        hospital: profile.hospital || ""
      });

      setRequestSuccess("Role change request submitted! Sent to Department Head (HOD) for review.");
      setRequestReason("");
      setShowRequestForm(false);
    } catch (err: any) {
      console.error("Failed to submit role request:", err);
      setRequestError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Withdraw/Cancel request
  const handleCancelRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "roleChangeRequests", requestId), {
        status: "rejected",
        reviewedBy: "Cancelled by User",
        reviewedAt: new Date().toISOString()
      });
      setUserPendingRequest(null);
    } catch (err) {
      console.error("Error cancelling request:", err);
    }
  };

  // HOD Approve request
  const handleApproveRequest = async (req: RoleRequest) => {
    setReviewActioningId(req.id);
    try {
      const currentHODEmail = userEmail;
      const currentHODUid = auth.currentUser?.uid || "";

      // 1. Mark request as approved
      await updateDoc(doc(db, "roleChangeRequests", req.id), {
        status: "approved",
        reviewedBy: currentHODEmail,
        reviewedAt: new Date().toISOString()
      });

      // 2. Update user's profile in Firestore `/users/{targetUid}`
      const userDocRef = doc(db, "users", req.requestedBy);
      await updateDoc(userDocRef, {
        role: req.requestedRole
      });

      // 3. Update team_members record if exists
      try {
        const tmQuery = query(collection(db, "team_members"), where("email", "==", req.requestedByEmail));
        const tmSnap = await getDocs(tmQuery);
        tmSnap.forEach(async (tmDoc) => {
          await updateDoc(doc(db, "team_members", tmDoc.id), { role: req.requestedRole });
        });
      } catch (e) {
        console.warn("Could not sync team_members role update:", e);
      }

      // 4. Record audit log entry in `roleChangeLog` (NABH compliance)
      try {
        await addDoc(collection(db, "roleChangeLog"), {
          targetMemberId: req.requestedBy,
          targetEmail: req.requestedByEmail,
          targetName: req.requestedByName,
          previousRole: req.currentRole,
          newRole: req.requestedRole,
          changedByUid: currentHODUid,
          changedByEmail: currentHODEmail,
          changedByName: profile.name || currentHODEmail,
          changedAt: new Date().toISOString(),
          hospital: profile.hospital || req.hospital || ""
        });
      } catch (logErr) {
        console.warn("Role change audit logging failed:", logErr);
      }

      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      console.error("Error approving role request:", err);
      alert("Failed to approve role request: " + (err.message || "Permission error"));
    } finally {
      setReviewActioningId(null);
    }
  };

  // HOD Reject request
  const handleRejectRequest = async (req: RoleRequest) => {
    setReviewActioningId(req.id);
    try {
      await updateDoc(doc(db, "roleChangeRequests", req.id), {
        status: "rejected",
        reviewedBy: userEmail,
        reviewedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Error rejecting role request:", err);
      alert("Failed to reject request: " + err.message);
    } finally {
      setReviewActioningId(null);
    }
  };

  return (
    <div className="space-y-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase font-mono tracking-wider">
              Clinical Role Designation & Governance
            </h3>
            <p className="text-[10px] text-slate-400 font-sans mt-0.5">
              DPDP Act 2023 & NABH Compliant Role-Based Governance (Rule 10)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border ${
            isHOD
              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
              : userRoleLower.includes("consultant")
              ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          }`}>
            Current: {currentRole}
          </span>
        </div>
      </div>

      {/* NON-HOD USER VIEW: Request Role Change */}
      {!isHOD && (
        <div className="space-y-3 pt-1">
          {/* Active Pending Request Card */}
          {userPendingRequest ? (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold font-mono">
                  <Clock className="w-4 h-4 animate-spin-slow shrink-0" />
                  <span>Role Promotion Request Pending HOD Review</span>
                </div>
                <button
                  onClick={() => handleCancelRequest(userPendingRequest.id)}
                  className="text-[10px] font-mono text-slate-400 hover:text-red-400 transition-colors"
                >
                  Cancel Request
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                Requested Elevation to <strong className="text-amber-200">{userPendingRequest.requestedRole}</strong>
              </p>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 font-sans italic">
                "{userPendingRequest.reason}"
              </div>
              <p className="text-[9px] font-mono text-slate-500">
                Submitted on {new Date(userPendingRequest.createdAt).toLocaleDateString()} — Waiting for HOD Approval. Self-elevation is restricted to preserve clinical governance.
              </p>
            </div>
          ) : (
            <>
              {requestSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{requestSuccess}</span>
                </div>
              )}

              {!showRequestForm ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 gap-3">
                  <div className="space-y-0.5">
                    <strong className="text-xs text-slate-200 font-bold block">
                      Need Role Elevation or Title Update?
                    </strong>
                    <p className="text-[10px] text-slate-400">
                      Role changes require official Department Head (HOD) approval according to ErMate governance rules.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs flex items-center space-x-2 shrink-0 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Request Role Promotion</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <strong className="text-xs font-mono font-bold text-indigo-300">
                      Submit Role Elevation Request
                    </strong>
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="text-slate-400 hover:text-slate-200 text-xs font-mono"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {requestError && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] font-mono flex items-center space-x-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span>{requestError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                      Select Requested Designation
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetRole("Senior Consultant")}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                          targetRole === "Senior Consultant"
                            ? "bg-blue-950/50 border-blue-500 text-blue-200 font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs">🩺 Senior Consultant</span>
                        {targetRole === "Senior Consultant" && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetRole("HOD / Department Lead")}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                          targetRole === "HOD / Department Lead"
                            ? "bg-amber-950/50 border-amber-500 text-amber-200 font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs">👑 HOD / Department Lead</span>
                        {targetRole === "HOD / Department Lead" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                      Clinical Justification & Reason (min 10 chars)
                    </label>
                    <textarea
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      placeholder="e.g., Promoted to Senior Consultant following Departmental Committee Review on Aug 2026..."
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900 text-xs font-mono"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center space-x-1.5"
                    >
                      {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Submit Request</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* HOD REVIEWER VIEW: Pending Approval Queue */}
      {isHOD && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-mono font-bold text-amber-300 flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending Role Elevation Requests Queue ({pendingRequests.length})</span>
            </strong>
            {loadingRequests && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center space-y-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
              <p className="text-xs font-mono text-slate-300">All Role Requests Clear</p>
              <p className="text-[10px] text-slate-500 font-sans">
                No pending role elevation requests awaiting HOD review.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100 font-mono">
                        {req.requestedByName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({req.requestedByEmail})
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                      <span className="text-slate-400">{req.currentRole}</span>
                      <span className="text-amber-400 font-bold">➔</span>
                      <span className="text-amber-300 font-bold">{req.requestedRole}</span>
                    </div>

                    <p className="text-[10px] text-slate-400 italic bg-slate-900/80 p-2 rounded border border-slate-800">
                      "{req.reason}"
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleRejectRequest(req)}
                      disabled={reviewActioningId === req.id}
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-mono font-bold transition-all"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={reviewActioningId === req.id}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center space-x-1 transition-all shadow-md shadow-emerald-600/20"
                    >
                      {reviewActioningId === req.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Approve Role</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
