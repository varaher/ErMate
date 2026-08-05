import React, { useState } from "react";
import { Search, Filter, Plus, Calendar, Activity, Eye, Edit, Trash2, Clock, CheckCircle, ChevronLeft, MessageSquare, FileText } from "lucide-react";
import { ClinicalCase } from "../types";

interface CasesListViewProps {
  cases: ClinicalCase[];
  onSelectCase: (caseId: string) => void;
  onViewSheet?: (caseId: string) => void;
  onNavigateToDischarge?: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onStartFullFlow: () => void;
  onStartQuickCase: () => void;
  onNavigateToTab?: (tabId: string) => void;
  onDiscussCase?: (patientCase: ClinicalCase) => void;
}

export default function CasesListView({
  cases,
  onSelectCase,
  onViewSheet,
  onNavigateToDischarge,
  onDeleteCase,
  onStartFullFlow,
  onStartQuickCase,
  onNavigateToTab,
  onDiscussCase,
}: CasesListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Triage" | "Discharged">("All");
  const [ageGroupFilter, setAgeGroupFilter] = useState<"All" | "Adult" | "Pediatric">("All");

  const filteredCases = cases.filter((c) => {
    const matchesSearch = 
      c.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient.presentingComplaint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "All" || 
      c.status === statusFilter;

    const matchesAgeGroup = 
      ageGroupFilter === "All" ||
      (ageGroupFilter === "Pediatric" && c.isPediatric) ||
      (ageGroupFilter === "Adult" && !c.isPediatric);

    return matchesSearch && matchesStatus && matchesAgeGroup;
  });

  return (
    <div className="space-y-6 animate-fade-in" id="cases-list-container">
      {onNavigateToTab && (
        <button
          type="button"
          onClick={() => onNavigateToTab("dashboard")}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-emerald-500" /> Back to Dashboard
        </button>
      )}

      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white">
            Active Cases Registry
          </h1>
          <p className="text-xs text-slate-400">
            Search, manage, and audit clinical documentation records and emergency triage status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onStartFullFlow}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-purple-600 hover:from-emerald-700 hover:via-teal-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Standard Triage Case
          </button>
          <button
            onClick={onStartQuickCase}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all"
          >
            Quick Case
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID or chief complaint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter buttons */}
        <div className="flex gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(["All", "Active", "Triage", "Discharged"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`text-[11px] px-3 py-1 font-bold rounded-md transition-all shrink-0 ${
                statusFilter === filter
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Age Group Filter */}
        <div className="flex gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(["All", "Adult", "Pediatric"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setAgeGroupFilter(filter)}
              className={`text-[11px] px-3 py-1 font-bold rounded-md transition-all shrink-0 ${
                ageGroupFilter === filter
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of cases */}
      {filteredCases.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Activity className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-4 animate-pulse-slow" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No cases matched your filter criteria</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Try adjusting your search query, status filters, or age filters to show existing entries.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => {
            const abnormalVitals = Object.entries(c.vitals).filter(([k, v]) => {
              if (!v) return false;
              const n = parseFloat(v);
              if (isNaN(n)) return false;
              if (c.isPediatric) {
                if (k === "hr" && (n < 70 || n > 120)) return true;
                if (k === "rr" && (n < 18 || n > 30)) return true;
                if (k === "spo2" && n < 94) return true;
              } else {
                if (k === "hr" && (n < 60 || n > 100)) return true;
                if (k === "rr" && (n < 12 || n > 20)) return true;
                if (k === "spo2" && n < 94) return true;
              }
              return false;
            }).length;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-900 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border ${
                          c.patient.triageCategory.includes("P1")
                            ? "bg-rose-50 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                            : c.patient.triageCategory.includes("P2")
                            ? "bg-amber-50 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                            : "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                        }`}>
                          {c.patient.triageCategory.split(" ")[0]}
                        </span>
                        {c.isPediatric ? (
                          <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                            Pediatric
                          </span>
                        ) : (
                          <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                            Adult
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">
                        {c.patient.name}
                      </h3>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      c.status === "Discharged"
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse-slow"
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-900 font-mono">
                    <p className="truncate"><span className="font-semibold text-slate-700 dark:text-slate-300">Complaint:</span> {c.patient.presentingComplaint}</p>
                    <p><span className="font-semibold text-slate-700 dark:text-slate-300">Vitals:</span> HR {c.vitals.hr || "N/A"} | BP {c.vitals.bp || "N/A"}</p>
                    <p className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Opened:</span> {c.patient.dateOpened}
                    </p>
                  </div>

                  {abnormalVitals > 0 && (
                    <div className="bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      {abnormalVitals} Abnormal vital parameter alerts flagged
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-3 mt-4">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{c.timeSpentMin} mins spent
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onDiscussCase && (
                      <button
                        onClick={() => onDiscussCase(c)}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                        title="Discuss case with AI Assistant"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Discuss</span>
                      </button>
                    )}
                    <button
                      onClick={() => onViewSheet ? onViewSheet(c.id) : onSelectCase(c.id)}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-lg transition-all cursor-pointer"
                      title="View Case Sheet"
                    >
                      <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </button>
                    <button
                      onClick={() => onSelectCase(c.id)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
                      title="Edit Case Sheet Form"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {onNavigateToDischarge && (
                      <button
                        onClick={() => onNavigateToDischarge(c.id)}
                        className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 dark:text-purple-300 rounded-lg transition-all cursor-pointer"
                        title="View / Edit Discharge Summary Card"
                      >
                        <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteCase(c.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                      title="Archived/Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
