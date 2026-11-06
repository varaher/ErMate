// NEW FILE. Simple Team home: five plain actions, in the order a lead needs them.
import React from "react";
import { ChevronRight, Users } from "lucide-react";

export interface TeamHomeViewProps {
  teamName: string;
  hospitalName: string;
  department: string;
  bedCapacity?: number | null;
  memberCount: number;
  pendingCount: number;
  /** Lead or rota manager: can change shift timings and the rota. Others can only view. */
  canEditRota: boolean;
  onEditProfile?: () => void;
  onEditHospital?: () => void;
  onEditTeam: () => void;
  onEditShiftTimings: () => void;
  onSyncRota: () => void;
  onOpenMembers: () => void;
}

interface RowProps {
  testId: string;
  title: string;
  hint: string;
  onClick?: () => void;
  highlight?: boolean;
}

function Row({ testId, title, hint, onClick, highlight }: RowProps) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`w-full min-h-[56px] text-left rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-all ${
        highlight
          ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
    >
      <span className="min-w-0">
        <strong className="block text-sm font-bold text-slate-900 dark:text-white">{title}</strong>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
    </button>
  );
}

export default function TeamHomeView(props: TeamHomeViewProps) {
  const {
    teamName, hospitalName, department, bedCapacity, memberCount, pendingCount, canEditRota,
    onEditProfile, onEditHospital, onEditTeam, onEditShiftTimings, onSyncRota, onOpenMembers,
  } = props;
  const facts = [department, bedCapacity ? `${bedCapacity} beds` : "", `${memberCount} member${memberCount === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div data-testid="team-home" className="space-y-3 max-w-xl mx-auto text-left">
      <button
        type="button"
        data-testid="team-home-members"
        onClick={onOpenMembers}
        className="w-full text-left rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <strong className="text-sm font-black text-emerald-900 dark:text-emerald-200">{teamName || `${hospitalName} Team`}</strong>
        </span>
        <span className="block text-xs text-emerald-800 dark:text-emerald-300 mt-1">{facts}</span>
        {pendingCount > 0 && (
          <span className="block text-xs font-bold text-amber-700 dark:text-amber-400 mt-1">
            {pendingCount} request{pendingCount === 1 ? "" : "s"} waiting for your approval. Tap to review.
          </span>
        )}
      </button>

      <Row testId="team-home-edit-profile" title="Edit my profile" hint="Name, role, department" onClick={onEditProfile} />
      <Row testId="team-home-edit-hospital" title="Edit hospital profile" hint="Hospital name, place, district, state, beds" onClick={onEditHospital} />
      <Row testId="team-home-edit-team" title="Edit team" hint="Team name, invite colleagues, approve requests" onClick={onEditTeam} />
      <Row
        testId="team-home-edit-shifts"
        title={canEditRota ? "Edit shift timings" : "See shift timings"}
        hint="Morning, Evening, Night and your own shifts"
        onClick={onEditShiftTimings}
      />
      <Row
        testId="team-home-sync-rota"
        title={canEditRota ? "Sync rota with team members" : "See the team rota"}
        hint={canEditRota ? "Choose who works which shift. Everyone sees it in their app" : "Who is on which shift"}
        onClick={onSyncRota}
        highlight
      />
    </div>
  );
}