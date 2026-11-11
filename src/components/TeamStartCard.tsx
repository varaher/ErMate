import React from "react";
import { Users, Crown, Link2, Lock, ChevronRight } from "lucide-react";

/**
 * Plain-words "Work as a team" card for doctors who are not in a team yet (More → Team).
 * Presentation only. Create / Join open the existing team modals.
 */
export default function TeamStartCard({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="space-y-4 text-left">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center"><Users className="w-5 h-5" /></span>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Work as a team</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          The rota, shift timings and team handover need a team.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Your own cases stay private either way.
        </p>
      </div>

      <div className="rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">1</span>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-500" /> Are you the department lead?</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Create your team, then share the invite link with your colleagues.</p>
          </div>
        </div>
        <button type="button" onClick={onCreate} className="w-full min-h-[48px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2">
          Create team <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 shrink-0 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center justify-center">2</span>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Link2 className="w-4 h-4 text-indigo-500" /> Got a link from your lead?</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Paste it to join. Your lead approves you, and you're in.</p>
          </div>
        </div>
        <button type="button" onClick={onJoin} className="w-full min-h-[48px] rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
          Join with link <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Once you're in a team, this page shows</p>
        <div className="flex flex-wrap gap-1.5">
          {["Edit team", "Edit shift timings", "Sync rota", "Members"].map((t) => (
            <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}