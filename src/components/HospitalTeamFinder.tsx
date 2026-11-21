import React, { useEffect, useState } from "react";
import { Users, Check, Clock } from "lucide-react";
import { getMyHospitalTeam, requestJoinHospitalTeam, ExistingHospitalTeam } from "../services/teamInviteService";

/**
 * One team per hospital (Neeraj, 20 Nov 2026).
 * Looks up whether the doctor's hospital already has a team. If it does, shows it with
 * "Request to join" and tells the parent (onResult(true)) so "Create team" can be hidden.
 * Shows nothing while checking or when there is no team, so the normal Create/Join choice stays.
 */
export default function HospitalTeamFinder({
  role,
  onResult,
}: {
  role?: string;
  onResult?: (found: boolean) => void;
}) {
  const [team, setTeam] = useState<ExistingHospitalTeam | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMyHospitalTeam()
      .then((r) => {
        if (cancelled) return;
        setTeam(r.existingTeam || null);
        setSent(!!r.pendingForThisTeam);
        onResult?.(!!r.existingTeam);
      })
      .catch(() => { if (!cancelled) onResult?.(false); }); // lookup failure never blocks Create/Join
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!team) return null;

  const handleRequest = async () => {
    setSending(true);
    setError("");
    try {
      await requestJoinHospitalTeam(team.teamId, role);
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Could not send the request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-testid="hospital-team-finder" className="rounded-3xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-3 text-left">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Users className="w-5 h-5" /></span>
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white">Your hospital already has a team</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
            <strong>{team.teamName}</strong>{team.hospitalName ? ` · ${team.hospitalName}` : ""}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {team.activeMembers} member{team.activeMembers === 1 ? "" : "s"}. Ask to join: the team's lead approves you.
          </p>
        </div>
      </div>
      {sent ? (
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Request sent. You'll be in as soon as the lead approves.
        </p>
      ) : (
        <button
          type="button"
          data-testid="hospital-team-request-join"
          disabled={sending}
          onClick={handleRequest}
          className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" /> {sending ? "Sending..." : "Request to join"}
        </button>
      )}
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}