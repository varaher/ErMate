import React, { useState, useEffect, useCallback } from "react";
import {
  Clock, CheckCircle2, AlertCircle, Send, RefreshCw, Lock, Award
} from "lucide-react";
import { auth } from "../firebase";
import { UserProfile } from "../types";
import VoiceRecorder from "./shared/VoiceRecorder";
import { TEAM_ROLE_OPTIONS, teamRoleLabel } from "../lib/teamRoles";
import {
  listRoleRequests, createRoleRequest, cancelRoleRequest, decideRoleRequest, RoleChangeRequest,
} from "../services/teamInviteService";

/**
 * Role changes (Neeraj, 20 Nov 2026): the team's own admins approve them.
 * - Any team member can ask for a new designation, including HOD.
 * - Team Admins (and HODs) of that team see the requests here and approve or reject.
 * Everything goes through /api/team/role-requests*, which checks the team on the server.
 * (Before: requests went straight to Firestore "for the HOD", but the rules let only the
 *  requester read them, so no one could ever approve one.)
 */

interface RoleChangeSectionProps {
  profile?: UserProfile;
  currentProfile?: UserProfile;
  onRoleUpdated?: () => void;
  onSaveProfile?: (updated: any) => void;
}

export default function RoleChangeSection({
  profile: propProfile,
  currentProfile,
  onRoleUpdated,
}: RoleChangeSectionProps) {
  const profile = propProfile || currentProfile || ({} as UserProfile);
  const currentRole = teamRoleLabel(profile.role) || "EM Resident";

  const [loading, setLoading] = useState(true);
  const [inTeam, setInTeam] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [mine, setMine] = useState<RoleChangeRequest | null>(null);
  const [toReview, setToReview] = useState<RoleChangeRequest[]>([]);

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [targetRole, setTargetRole] = useState(() => (currentRole === "Senior Consultant" ? "Consultant" : "Senior Consultant"));
  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) { setLoading(false); return; }
    try {
      const r = await listRoleRequests();
      setInTeam(r.inTeam);
      setCanReview(r.canReview);
      setMine(r.mine);
      setToReview(r.toReview || []);
    } catch (err) {
      console.warn("[RoleRequests] could not load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Light refresh so admins see new requests without reopening the page.
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh, auth.currentUser?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (requestReason.trim().length < 10) {
      setMessage({ ok: false, text: "Please give a reason of at least 10 characters." });
      return;
    }
    setIsSubmitting(true);
    try {
      await createRoleRequest(targetRole, requestReason.trim());
      setMessage({ ok: true, text: "Request sent. Your team's admins will review it." });
      setRequestReason("");
      setShowRequestForm(false);
      await refresh();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || "Could not send the request." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelRoleRequest(id);
      await refresh();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || "Could not cancel the request." });
    }
  };

  const handleDecide = async (req: RoleChangeRequest, decision: "approve" | "reject") => {
    setActioningId(req.id);
    setMessage(null);
    try {
      await decideRoleRequest(req.id, decision);
      setMessage({
        ok: true,
        text: decision === "approve"
          ? `${req.requestedByName} is now ${teamRoleLabel(req.requestedRole)}.`
          : `Request from ${req.requestedByName} rejected.`,
      });
      if (decision === "approve") onRoleUpdated?.();
      await refresh();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || "Could not update the request." });
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div data-testid="role-change-section" className="space-y-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Role & designation
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Your team's admins approve role changes.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0">
          Current: {currentRole}
        </span>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${message.ok
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
          : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
      ) : !inTeam ? (
        <p className="text-xs text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          Join or create a team first. Role changes are approved by your team's admins.
        </p>
      ) : (
        <>
          {/* Requester: own pending request, or ask for a change */}
          {mine ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Waiting for your team admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancel(mine.id)}
                  className="text-[11px] text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                >
                  Cancel request
                </button>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                Asked for <strong>{teamRoleLabel(mine.requestedRole)}</strong> on {new Date(mine.createdAt).toLocaleDateString()}.
              </p>
              <p className="text-[11px] italic text-slate-600 dark:text-slate-400">"{mine.reason}"</p>
            </div>
          ) : !showRequestForm ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 gap-3">
              <div className="space-y-0.5">
                <strong className="text-xs text-slate-900 dark:text-slate-200 block">Need a new designation or HOD?</strong>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Send a request. Your team's admins approve it.</p>
              </div>
              <button
                type="button"
                data-testid="role-request-open"
                onClick={() => setShowRequestForm(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request role change</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">New role</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {TEAM_ROLE_OPTIONS.filter(r => r !== currentRole).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Reason (at least 10 characters)</label>
                <div className="flex gap-2">
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="e.g. Joined as Senior Consultant from 1 November"
                    rows={2}
                    className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-200"
                  />
                  <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setRequestReason(prev => prev ? `${prev} ${txt}` : txt)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRequestForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5">
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send request</span>
                </button>
              </div>
            </form>
          )}

          {/* Team Admins: requests from their own team */}
          {canReview && (
            <div className="space-y-2.5 pt-1" data-testid="role-requests-review">
              <strong className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                <span>Role requests from your team ({toReview.length})</span>
              </strong>
              {toReview.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">No requests waiting.</p>
              ) : toReview.map((req) => (
                <div key={req.id} className="p-3.5 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/50 dark:bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {req.requestedByName} <span className="font-normal text-slate-500">({req.requestedByEmail})</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {teamRoleLabel(req.currentRole) || "—"} → <strong className="text-amber-700 dark:text-amber-300">{teamRoleLabel(req.requestedRole)}</strong>
                      {teamRoleLabel(req.requestedRole) === "HOD" && <span className="text-slate-500"> (also makes them a Team Admin)</span>}
                    </p>
                    <p className="text-[11px] italic text-slate-500 dark:text-slate-400">"{req.reason}"</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleDecide(req, "reject")}
                      disabled={actioningId === req.id}
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecide(req, "approve")}
                      disabled={actioningId === req.id}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                    >
                      {actioningId === req.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}