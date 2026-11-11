import React from "react";
import { Users, ChevronRight } from "lucide-react";

/** Small card on the Profile page for doctors not yet in a team. Presentation only. */
export default function ProfileTeamPrompt({ onOpenTeam }: { onOpenTeam: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3 text-left">
      <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Users className="w-5 h-5" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Share the rota with your ER team?</p>
        <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">Create or join your hospital team.</p>
      </div>
      <button type="button" onClick={onOpenTeam} className="shrink-0 min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1">
        Open Team <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}