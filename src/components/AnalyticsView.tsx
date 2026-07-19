import React from "react";
import { 
  TrendingUp, Activity, BarChart3, Users, CheckCircle2, AlertTriangle, PieChart as PieIcon, ShieldAlert,
  ChevronLeft
} from "lucide-react";
import { ClinicalCase, UserProfile } from "../types";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell
} from "recharts";

interface AnalyticsViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  onNavigateToTab?: (tabId: string) => void;
  isDarkMode?: boolean;
}

export default function AnalyticsView({ profile, cases, onNavigateToTab, isDarkMode = false }: AnalyticsViewProps) {
  // Parse dates and count active vs discharged for "ER Patient Flow Trends"
  const parseDateOpened = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    const parts = dateStr.split("|");
    const datePart = parts.length > 1 ? parts[1].trim() : dateStr.trim();
    return datePart;
  };

  const dateMap: { [date: string]: { date: string; active: number; discharged: number; total: number } } = {};

  cases.forEach(c => {
    const dateKey = parseDateOpened(c.patient.dateOpened);
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = { date: dateKey, active: 0, discharged: 0, total: 0 };
    }
    if (c.status === "Discharged") {
      dateMap[dateKey].discharged += 1;
    } else {
      dateMap[dateKey].active += 1;
    }
    dateMap[dateKey].total += 1;
  });

  // Convert to array and sort chronologically by date
  const trendData = Object.values(dateMap).sort((a, b) => {
    const months: { [key: string]: number } = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const getMonthAndDay = (d: string) => {
      const parts = d.split(" ");
      if (parts.length >= 2) {
        return { month: months[parts[0]] || 0, day: parseInt(parts[1], 10) || 0 };
      }
      return { month: 0, day: 0 };
    };
    const aVal = getMonthAndDay(a.date);
    const bVal = getMonthAndDay(b.date);
    if (aVal.month !== bVal.month) return aVal.month - bVal.month;
    return aVal.day - bVal.day;
  });

  // Count triage categories for "Triage Category Distribution"
  const triageMap = {
    "P1 (Immediate)": 0,
    "P2 (Urgent)": 0,
    "P3 (Non-Urgent)": 0
  };

  cases.forEach(c => {
    const cat = c.patient.triageCategory as string;
    if (cat === "P1 (Immediate)" || cat.includes("P1")) {
      triageMap["P1 (Immediate)"] += 1;
    } else if (cat === "P2 (Urgent)" || cat.includes("P2")) {
      triageMap["P2 (Urgent)"] += 1;
    } else if (cat === "P3 (Non-Urgent)" || cat.includes("P3")) {
      triageMap["P3 (Non-Urgent)"] += 1;
    }
  });

  const triageData = [
    { name: "P1 (Immediate)", value: triageMap["P1 (Immediate)"], color: "#ef4444" }, // Red 500
    { name: "P2 (Urgent)", value: triageMap["P2 (Urgent)"], color: "#f59e0b" },    // Amber 500
    { name: "P3 (Non-Urgent)", value: triageMap["P3 (Non-Urgent)"], color: "#10b981" } // Emerald 500
  ];

  // Custom tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl shadow-lg font-sans text-xs">
          <p className="font-bold text-slate-850 dark:text-slate-200 mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} style={{ color: p.color }} className="text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span>{p.name}: <strong>{p.value}</strong></span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl shadow-lg font-sans text-xs">
          <p className="font-bold mb-1" style={{ color: data.color }}>{data.name}</p>
          <p className="text-slate-600 dark:text-slate-400">
            Cases: <strong className="text-slate-800 dark:text-slate-200">{data.value}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  // Metric variables
  const totalAdmissions = cases.length;
  const activeCasesCount = cases.filter(c => c.status === "Active").length;
  const dischargedCasesCount = cases.filter(c => c.status === "Discharged").length;
  const p1CasesCount = triageMap["P1 (Immediate)"];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fade-in" id="analytics-section">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${isDarkMode ? 'from-slate-900 to-indigo-950 border-indigo-900/40' : 'from-indigo-600 to-indigo-800 border-transparent'} rounded-2xl p-6 text-white shadow-md border relative overflow-hidden`}>
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10">
          <BarChart3 className="w-80 h-80" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono border ${
                  isDarkMode 
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                    : "bg-white/15 text-white border-white/20"
                }`}>
                  Operational Intelligence
                </span>
              </div>
              <h1 className="text-2xl font-black font-display tracking-tight">ER Quality & Flow Analytics</h1>
              <p className={`text-xs max-w-xl font-medium leading-relaxed ${
                isDarkMode ? "text-slate-300" : "text-indigo-100"
              }`}>
                Real-time visual monitoring of clinical triage stratification, admission velocities, and case disposition cycles at <span className="font-semibold text-white">{profile.hospital}</span>.
              </p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("dashboard")}
                className="self-start md:self-center py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl transition-all flex items-center gap-2 font-bold font-mono text-[11px] uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
              >
                <ChevronLeft className="w-4 h-4 text-emerald-400" /> Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Admissions</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{totalAdmissions}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Boarding</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{activeCasesCount}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discharged</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{dischargedCasesCount}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical (P1)</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{p1CasesCount}</h4>
          </div>
        </div>
      </div>

      {/* Main Charts Side-by-Side Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: ER Patient Flow Trends */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-1 mb-4">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
              <TrendingUp className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              ER Patient Flow Trends
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              Daily caseload velocity (Active versus Discharged) mapped across recent admission dates.
            </p>
          </div>
          
          <div className="h-[280px] w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorDischarged" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" className="hidden dark:block" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    className="dark:stroke-slate-800"
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    className="dark:stroke-slate-800"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="active" 
                    name="Active Cases" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorActive)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="discharged" 
                    name="Discharged Cases" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorDischarged)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Triage Category Distribution */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-1 mb-4">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 font-display">
              <PieIcon className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
              Triage Category Distribution
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              Real-time stratification of active and registered cases by clinical emergency levels (P1 to P3).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-[280px]">
            <div className="h-full w-full sm:w-[50%] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={triageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {triageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Customized Triage Legend Card */}
            <div className="w-full sm:w-[45%] flex flex-col justify-center space-y-3 pr-2">
              {triageData.map((item, idx) => {
                const total = triageData.reduce((acc, curr) => acc + curr.value, 0);
                const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="font-extrabold text-slate-850 dark:text-white">{item.value}</span>
                      <span className="text-slate-400 ml-1.5 text-[10px]">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Informative Quality Guidelines Notice */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-slate-850 dark:text-slate-200">Clinical Dashboard Guidelines</h4>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Data values above are automatically compiled from actual active records in the Cases Registry. Triage categories are derived from verified Emergency Severity Index (ESI) levels. Use these clinical indicators to gauge facility volume, resource allocation trends, and emergency response velocities.
          </p>
        </div>
      </div>
    </div>
  );
}
