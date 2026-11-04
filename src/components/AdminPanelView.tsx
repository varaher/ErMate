import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Cpu, DollarSign, Activity, Users, Building, Globe, 
  Search, RefreshCw, Download, Database, Layers, CheckCircle2, 
  AlertCircle, BarChart3, TrendingUp, Sparkles, Filter, FileText, 
  Calendar, Zap, Eye, ChevronRight, Lock, MapPin, Award, ShieldAlert, ChevronLeft
} from "lucide-react";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { UserProfile, ClinicalCase, ApiLogItem } from "../types";
import { SelfLearningRulesPanel } from "./SelfLearningRulesPanel";
import { getPublicAppUrl } from "../utils/publicUrl";

interface AdminPanelViewProps {
  currentProfile: UserProfile;
  cases: ClinicalCase[];
  onNavigateToTab?: (tabId: string) => void;
}

function PlatformAdminInviteSection() {
  const [hospitalId, setHospitalId] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [role, setRole] = useState("HOD / Department Lead");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresHours, setExpiresHours] = useState(72);
  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalId.trim() || !hospitalName.trim() || !invitedEmail.trim()) {
      setErrorMsg("Please fill in hospital ID, hospital name, and clinician email.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    setGeneratedLink("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const idToken = await user.getIdToken(true);

      const res = await fetch("/api/team/create-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          hospitalId: hospitalId.trim(),
          hospitalName: hospitalName.trim(),
          invitedEmail: invitedEmail.trim().toLowerCase(),
          role: role.trim(),
          maxUses,
          expiresHours
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create department invitation.");
      }

      const data = await res.json();
      const origin = getPublicAppUrl();
      const link = `${origin}/join/${data.token}`;
      setGeneratedToken(data.token);
      setGeneratedLink(link);
      setSuccessMsg(`Secure department invitation issued successfully for ${invitedEmail.trim()}!`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate invite.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase font-mono tracking-wider">
              Issue Department Invitation
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Platform Admin Gateway — Issue cryptographically signed onboarding invitations with canonical hospital binding and HOD/Consultant assignment.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleCreateInvite} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
            Canonical Hospital ID *
          </label>
          <input
            type="text"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            placeholder="e.g. apollo_greams_er"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            required
          />
          <p className="text-[10px] text-slate-500 mt-1 font-mono">Unique lowercase slug for Firestore hospital scoping.</p>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
            Hospital / Facility Name *
          </label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            placeholder="e.g. Apollo Hospital, Greams Road"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
            Invited Clinician Email *
          </label>
          <input
            type="email"
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
            placeholder="e.g. hod.emergency@apollo.in"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            required
          />
          <p className="text-[10px] text-slate-500 mt-1 font-mono">Restricts token redemption strictly to this email.</p>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
            Assigned Clinical Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="HOD / Department Lead">HOD / Department Lead (Hospital Lead)</option>
            <option value="Senior Consultant">Senior Consultant</option>
            <option value="EM Resident">EM Resident</option>
            <option value="Fellow">Fellow</option>
            <option value="Consultant">Consultant</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-center justify-between pt-2">
          <div className="flex gap-4 text-xs font-mono text-slate-400">
            <span>Expiry: {expiresHours}h</span>
            <span>Max Uses: {maxUses}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 font-mono transition-all cursor-pointer"
          >
            {submitting ? "Issuing..." : "Generate Secure Invite Link"}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-mono">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl font-mono">
          {successMsg}
        </div>
      )}

      {generatedLink && (
        <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">
              Server-Authorized Token: {generatedToken}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all font-mono"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <input
            type="text"
            readOnly
            value={generatedLink}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 select-all"
          />
        </div>
      )}
    </div>
  );
}

export default function AdminPanelView(props: AdminPanelViewProps) {
  const isAuthorizedAdmin =
    props.currentProfile?.email?.toLowerCase().trim() === "varahgrp@gmail.com" ||
    auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com";
  // Owner only. Anyone else sees nothing (no "restricted" message).
  if (!isAuthorizedAdmin) return null;
  return <AdminPanelInner {...props} />;
}

/**
 * The platform reports (users, hospitals, HOD requests, AI usage and provider dues, revenue, credit
 * adjustments) moved to the separate admin portal at /admin (admin.ermate.in once DNS points there).
 * The old in-app dashboard showed estimated costs from case-count multipliers and a credit editor
 * that wrote to the wrong document; both are gone. Invite issuing, role audit and learning rules stay here.
 */
function AdminPanelInner(_props: AdminPanelViewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-2 min-w-0">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Admin portal</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Users, hospitals, locations, HOD requests, AI usage per provider, provider dues, revenue and credit
              adjustments are in the admin portal. Every figure there comes from real records.
            </p>
            <a
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
            >
              Open admin portal <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Platform Admin Department / HOD Invitation Issuer */}
      <PlatformAdminInviteSection />

      {/* Role Change Audit Log Panel (NABH Compliance) */}
      <RoleChangeAuditLogPanel />

      {/* Self-Learning Architecture & Learned Rules Engine */}
      <SelfLearningRulesPanel />
    </div>
  );
}

function RoleChangeAuditLogPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "roleChangeLog"));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());
      setLogs(items);
      setLoading(false);
    }, (err) => {
      console.warn("Could not fetch role change logs:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> NABH Compliance: Clinical Role Access Governance Log
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Immutable audit trail of all clinical role promotions, demotions, and department designations for medical legal governance.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          {logs.length} Logged Role Modifications
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs font-mono text-slate-400">Loading audit trail...</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 font-mono bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          No role modifications logged yet. All user profiles currently maintain their initial HOD-assigned roles.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Target Clinician</th>
                <th className="py-2.5 px-3">Previous Role</th>
                <th className="py-2.5 px-3">New Assigned Role</th>
                <th className="py-2.5 px-3">Modified By (HOD / Owner)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {log.changedAt ? new Date(log.changedAt).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">{log.targetName || log.targetEmail}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.targetEmail}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                      {log.previousRole || 'Unassigned'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px] border border-emerald-500/20">
                      {log.newRole}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{log.changedByName || log.changedByEmail}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.changedByEmail}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}