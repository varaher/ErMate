import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Crown, Check, X, Building2, Mail, Clock } from "lucide-react";

interface HodClaimRequest {
  id: string;
  hospital: string;
  place: string;
  state: string;
  pincode: string;
  claimedByUid: string;
  claimedByName: string;
  claimedByEmail: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionNote: string | null;
}

export default function AdminHodClaimReview() {
  const [claims, setClaims] = useState<HodClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionNote, setRejectionNote] = useState<{ [id: string]: string }>({});
  const [activeRejectingId, setActiveRejectingId] = useState<string | null>(null);

  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim();
  const isAdmin = currentUserEmail === "varahgrp@gmail.com";

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "hodClaimRequests"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: HodClaimRequest[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<HodClaimRequest, "id">),
        }));
        setClaims(items);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading HOD claim requests:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-4 bg-rose-50 text-rose-700 text-xs rounded-xl font-mono">
        Access restricted. Only varahgrp@gmail.com can review HOD claims.
      </div>
    );
  }

  const handleApprove = async (claim: HodClaimRequest) => {
    const confirmMsg = `Approve ${claim.claimedByName} (${claim.claimedByEmail}) as HOD for ${claim.hospital}? This will elevate their account role to "HOD / Department Lead".`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();

      // 1. Mark claim approved
      await updateDoc(doc(db, "hodClaimRequests", claim.id), {
        status: "approved",
        reviewedAt: now,
        reviewedBy: auth.currentUser?.uid || "admin",
      });

      // 2. Elevate claimant's role in their user profile
      await updateDoc(doc(db, "users", claim.claimedByUid), {
        role: "HOD / Department Lead",
        hospital: claim.hospital,
        state: claim.state,
      });

      alert(`Approved! ${claim.claimedByName} is now the verified HOD of ${claim.hospital}.`);
    } catch (err: any) {
      console.error("Approve failed:", err);
      alert("Failed to approve claim: " + err.message);
    }
  };

  const handleReject = async (claim: HodClaimRequest) => {
    const note = rejectionNote[claim.id] || "Request declined by administrator.";
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "hodClaimRequests", claim.id), {
        status: "rejected",
        reviewedAt: now,
        reviewedBy: auth.currentUser?.uid || "admin",
        rejectionNote: note,
      });
      setActiveRejectingId(null);
      alert(`Claim for ${claim.hospital} rejected.`);
    } catch (err: any) {
      console.error("Reject failed:", err);
      alert("Failed to reject claim: " + err.message);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase font-mono tracking-wider">
              Pending HOD Claim Requests ({claims.length})
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Initial bootstrapping gate — doctors requesting to be registered as the first HOD for unassigned hospitals.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs font-mono text-slate-400">Loading claim queue...</p>
      ) : claims.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 text-slate-500 text-xs font-mono">
          No pending HOD claims. All hospital departments are either claimed or unrequested.
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => (
            <div
              key={c.id}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Hospital: {c.hospital}
                  </span>
                  <h3 className="text-sm font-bold text-white pt-1">{c.claimedByName}</h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                    <Mail className="w-3 h-3 text-slate-500" /> {c.claimedByEmail}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono space-y-0.5">
                  <p className="flex items-center gap-1 justify-end">
                    <Building2 className="w-3 h-3 text-indigo-400" /> {c.place || "N/A"}, {c.state} ({c.pincode || "No Pincode"})
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" /> Claimed: {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[9px] font-mono uppercase text-slate-500 font-bold block">
                  Self-Reported Claim Context & Reason:
                </span>
                <p className="text-xs text-slate-200 font-sans leading-relaxed italic">
                  "{c.reason || "No explicit reason provided."}"
                </p>
              </div>

              {activeRejectingId === c.id ? (
                <div className="space-y-2 pt-2 bg-rose-950/20 p-3 rounded-xl border border-rose-900/40">
                  <label className="text-[10px] font-mono uppercase text-rose-400 font-bold block">
                    Reason for Rejection (sent to user):
                  </label>
                  <textarea
                    value={rejectionNote[c.id] || ""}
                    onChange={(e) =>
                      setRejectionNote({ ...rejectionNote, [c.id]: e.target.value })
                    }
                    placeholder="Provide a clear reason why this HOD claim is being declined..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveRejectingId(null)}
                      className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(c)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveRejectingId(c.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Reject Claim
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(c)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve as HOD
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
