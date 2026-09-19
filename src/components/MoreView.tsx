import React from "react";
import { 
  Settings, Building2, FileWarning, BookOpen, Users, 
  TrendingUp, ShieldAlert, Sparkles, ChevronRight, ShieldCheck, 
  User, Award, Wrench, MoreHorizontal
} from "lucide-react";
import { UserProfile } from "../types";
import { NormalizedRole } from "../utils/roleUtils";

interface MoreViewProps {
  profile: UserProfile | null;
  normalizedRole: NormalizedRole;
  onNavigateToTab: (tabId: string) => void;
  isDarkMode?: boolean;
  onOpenUpdatesModal: () => void;
}

export default function MoreView({
  profile,
  normalizedRole,
  onNavigateToTab,
  isDarkMode = false,
  onOpenUpdatesModal,
}: MoreViewProps) {
  const isAdminUser = profile?.email?.toLowerCase().trim() === "varahgrp@gmail.com";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in" id="more-utilities-hub">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="p-2 bg-slate-500/10 text-slate-700 dark:text-slate-300 rounded-xl">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white">
              More Clinical & Department Utilities
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Access secondary registries, directory lookup, medico-legal tools, and clinician governance.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Secondary Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Profile & Settings */}
        <div
          onClick={() => onNavigateToTab("profile")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              Profile & Clinical Credentials
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Manage GMC/NMC registration number, clinical qualifications, device link pairing, theme preferences, and security.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <span>Open Profile Settings</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Clinician Network / Doctors Directory */}
        <div
          onClick={() => onNavigateToTab("directory")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              Clinician Directory & Network
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Explore state-wide emergency physicians, verified emergency departments, and professional collegial network.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <span>Open Directory</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. Medico-Legal (MLC) Certificates */}
        <div
          onClick={() => onNavigateToTab("mlc")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-orange-500 dark:hover:border-orange-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileWarning className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              Medico-Legal (MLC) Certificates
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Draft, sign, and print Medico-Legal case certificates, wound inspection notes, and police intimations.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-orange-600 dark:text-orange-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <span>Open MLC Registry</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 4. Department Team Roster (Visible in More ONLY for hospital-affiliated non-HODs, since HOD already has it in primary nav; never for independent) */}
        {normalizedRole !== "hod" && normalizedRole !== "independent" && (
          <div
            onClick={() => onNavigateToTab("team")}
            className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Department Team & Roster
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Hospital duty shifts, physician roster, active clinical coverage, onboarding invites, and shift timing.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>View Team Roster</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {/* 5. Department Clinical Analytics (Visible in More ONLY for hospital-affiliated non-HODs, since HOD already has it in primary nav; never for independent) */}
        {normalizedRole !== "hod" && normalizedRole !== "independent" && (
          <div
            onClick={() => onNavigateToTab("analytics")}
            className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                Clinical Analytics & KPIs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Triage acuity distribution, P1 resuscitation metrics, patient turnaround timelines, and case volume trends.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>View Analytics</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {/* 6. System Updates & What's New */}
        <div
          onClick={onOpenUpdatesModal}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 rounded-2xl p-5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              ErMate Updates & Changelog
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Review recent clinical workflow enhancements, protocol additions, offline optimizations, and security patches.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-teal-600 dark:text-teal-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <span>View Changelog</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Subordinate Contextual Links Section */}
      <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Clinical Governance:</span>
          <span>End-to-end encrypted • DPDP Act 2023 compliant</span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          {/* Subordinate Admin Link for Platform Admin (who already has Admin Panel in primary nav) */}
          {isAdminUser && (
            <button
              type="button"
              onClick={() => onNavigateToTab("admin")}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 font-bold cursor-pointer transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Admin Center</span>
            </button>
          )}

          {/* Subordinate Quick Link for HOD to Roster & Analytics */}
          {normalizedRole === "hod" && (
            <>
              <button
                type="button"
                onClick={() => onNavigateToTab("team")}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Department Team</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab("analytics")}
                className="hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
