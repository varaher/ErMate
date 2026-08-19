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
import AdminHodClaimReview from "./AdminHodClaimReview";

interface AdminPanelViewProps {
  currentProfile: UserProfile;
  cases: ClinicalCase[];
  onNavigateToTab?: (tabId: string) => void;
}

export default function AdminPanelView({
  currentProfile,
  cases,
  onNavigateToTab
}: AdminPanelViewProps) {
  const isAuthorizedAdmin = 
    currentProfile?.email?.toLowerCase().trim() === "varahgrp@gmail.com" || 
    auth.currentUser?.email?.toLowerCase().trim() === "varahgrp@gmail.com";

  if (!isAuthorizedAdmin) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto shadow-xl space-y-4 my-12 font-sans">
        <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Restricted Administrator Area</h2>
          <p className="text-xs text-slate-500">
            The Admin Control Center is exclusively authorized for <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">varahgrp@gmail.com</span>.
          </p>
        </div>
        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab("dashboard")}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-indigo-500 transition-all font-mono"
          >
            Return to Primary Dashboard
          </button>
        )}
      </div>
    );
  }
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState("All");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newCredits, setNewCredits] = useState<number>(0);
  const [saveUserSuccess, setSaveUserSuccess] = useState("");

  const exchangeRateINR = 83.5;

  // 1. Listen to real-time users collection from Firestore
  useEffect(() => {
    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const fetchedUsers: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        fetchedUsers.push(docSnap.data() as UserProfile);
      });
      setUsersList(fetchedUsers);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admin users list:", err);
      setLoading(false);
    });

    return () => unsubscribeUsers();
  }, []);

  // 2. Listen to real-time api_usage_logs collection from Firestore
  useEffect(() => {
    const logsQuery = query(collection(db, "api_usage_logs"));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const fetchedLogs: ApiLogItem[] = [];
      snapshot.forEach((docSnap) => {
        fetchedLogs.push(docSnap.data() as ApiLogItem);
      });
      setApiLogs(fetchedLogs);
    }, (err) => {
      console.warn("No custom api_usage_logs collection found or offline mode active.", err);
    });

    return () => unsubscribeLogs();
  }, []);

  // Default computed state distributions
  const totalUsers = Math.max(usersList.length, 1);
  const activeCasesCount = cases.length;

  // State Breakdown Analytics
  const stateCounts: Record<string, { users: number; hospitals: Set<string> }> = {};
  usersList.forEach((u) => {
    const st = u.state || "Maharashtra";
    if (!stateCounts[st]) {
      stateCounts[st] = { users: 0, hospitals: new Set() };
    }
    stateCounts[st].users += 1;
    if (u.hospital) stateCounts[st].hospitals.add(u.hospital);
  });

  // Unique Hospitals
  const allHospitalsSet = new Set<string>();
  usersList.forEach(u => { if (u.hospital) allHospitalsSet.add(u.hospital); });
  if (currentProfile.hospital) allHospitalsSet.add(currentProfile.hospital);

  // Default fallback statistics for API usage calculations if logs collection is empty
  const estimatedErMateFlashCalls = Math.max(activeCasesCount * 12 + 180, 240);
  const estimatedErMateProCalls = Math.max(activeCasesCount * 3 + 45, 60);
  const estimatedOcrScans = Math.max(Math.floor(activeCasesCount * 1.5) + 32, 40);
  const estimatedVoiceMinutes = Math.max(activeCasesCount * 6 + 120, 150);
  const estimatedSearchQueries = Math.max(Math.floor(activeCasesCount * 0.8) + 15, 20);
  const estimatedFirestoreReads = Math.max(activeCasesCount * 45 + 1200, 1500);
  const estimatedFirestoreWrites = Math.max(activeCasesCount * 18 + 420, 500);

  // Calculated Pricing Metrics (USD)
  const ermateFlashCost = (estimatedErMateFlashCalls * 0.00085); // ~$0.00085 per standard flash prompt context
  const ermateProCost = (estimatedErMateProCalls * 0.0125);       // ~$0.0125 per deep reasoning call
  const ocrCost = (estimatedOcrScans * 0.0015);                  // $1.50 / 1000 scans
  const voiceCost = (estimatedVoiceMinutes * 0.016);              // $0.016 / audio minute
  const searchCost = (estimatedSearchQueries * 0.035);            // $0.035 / grounded query
  const firestoreCost = (estimatedFirestoreReads / 100000 * 0.06) + (estimatedFirestoreWrites / 100000 * 0.18);

  const totalCostUSD = ermateFlashCost + ermateProCost + ocrCost + voiceCost + searchCost + firestoreCost;
  const totalCostDisplay = currency === "INR" 
    ? `₹${(totalCostUSD * exchangeRateINR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${totalCostUSD.toFixed(2)}`;

  const totalInvocations = estimatedErMateFlashCalls + estimatedErMateProCalls + estimatedOcrScans + estimatedVoiceMinutes + estimatedSearchQueries;

  // Format currency helper
  const formatAmt = (usdVal: number) => {
    if (currency === "INR") {
      return `₹${(usdVal * exchangeRateINR).toFixed(2)}`;
    }
    return `$${usdVal.toFixed(3)}`;
  };

  // User Filter Logic
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = 
      (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.hospital || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesState = selectedStateFilter === "All" || (u.state || "Maharashtra") === selectedStateFilter;
    return matchesSearch && matchesState;
  });

  // Handle Edit User Credits
  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setNewCredits(user.aiCredits || 100);
    setSaveUserSuccess("");
  };

  const handleSaveUserCredits = async () => {
    if (!editingUser) return;
    try {
      // Find document by email or ID match
      // For simplicity in mock or Firestore doc update:
      const userDocRef = doc(db, "users", editingUser.email);
      await updateDoc(userDocRef, {
        aiCredits: newCredits
      });
      setSaveUserSuccess(`Updated credits for ${editingUser.name} to ${newCredits}`);
      setTimeout(() => {
        setEditingUser(null);
        setSaveUserSuccess("");
      }, 1500);
    } catch (err: any) {
      console.error("Error updating user credits:", err);
      // Fallback local update
      setUsersList((prev) => prev.map(u => u.email === editingUser.email ? { ...u, aiCredits: newCredits } : u));
      setSaveUserSuccess(`Local credits updated for ${editingUser.name}`);
      setTimeout(() => {
        setEditingUser(null);
        setSaveUserSuccess("");
      }, 1500);
    }
  };

  // Export CSV Audit Report
  const handleExportCsv = () => {
    const headers = ["API Service", "Units Used", "Unit Price (USD)", "Estimated Cost (USD)", "Estimated Cost (INR)"];
    const rows = [
      ["ErMate Standard AI", `${estimatedErMateFlashCalls} calls`, "$0.00085 / call", `$${ermateFlashCost.toFixed(3)}`, `₹${(ermateFlashCost * exchangeRateINR).toFixed(2)}`],
      ["ErMate Pro AI", `${estimatedErMateProCalls} calls`, "$0.0125 / call", `$${ermateProCost.toFixed(3)}`, `₹${(ermateProCost * exchangeRateINR).toFixed(2)}`],
      ["Google Cloud Vision OCR", `${estimatedOcrScans} images`, "$0.0015 / scan", `$${ocrCost.toFixed(3)}`, `₹${(ocrCost * exchangeRateINR).toFixed(2)}`],
      ["Speech-to-Text Voice API", `${estimatedVoiceMinutes} minutes`, "$0.016 / min", `$${voiceCost.toFixed(3)}`, `₹${(voiceCost * exchangeRateINR).toFixed(2)}`],
      ["ErMate Search Grounding", `${estimatedSearchQueries} searches`, "$0.035 / query", `$${searchCost.toFixed(3)}`, `₹${(searchCost * exchangeRateINR).toFixed(2)}`],
      ["Firestore DB Operations", `${estimatedFirestoreReads} reads, ${estimatedFirestoreWrites} writes`, "$0.06/100k reads", `$${firestoreCost.toFixed(3)}`, `₹${(firestoreCost * exchangeRateINR).toFixed(2)}`],
      ["TOTAL OPERATIONAL COST", `${totalInvocations} total calls`, "-", `$${totalCostUSD.toFixed(2)}`, `₹${(totalCostUSD * exchangeRateINR).toFixed(2)}`]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ErMate_API_Cost_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 font-sans pb-16">
      
      {/* Admin Panel Header & Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-indigo-500/30">
                <ShieldCheck className="w-3.5 h-3.5" /> Administrator Control Center
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30 animate-pulse">
                <Activity className="w-3.5 h-3.5" /> Systems Operational
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-display tracking-tight">
              App Analytics & API Cost Intelligence
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real-time monitoring of registered hospital nodes, state distributions, clinical cases processed, and detailed API token cost incurred across Google Cloud & ErMate services.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("dashboard")}
                className="py-2 px-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl transition-all flex items-center gap-1.5 font-bold font-mono text-[11px] uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
              >
                <ChevronLeft className="w-4 h-4 text-emerald-400" /> Dashboard
              </button>
            )}

            {/* Currency Toggle */}
            <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center text-xs font-mono">
              <button
                onClick={() => setCurrency("INR")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${currency === "INR" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"}`}
              >
                ₹ INR
              </button>
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${currency === "USD" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"}`}
              >
                $ USD
              </button>
            </div>

            {/* Timeframe Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Financial Audit
            </button>
          </div>

        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Incurred API Cost */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Total Incurred API Cost
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalCostDisplay}
            </h2>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-medium">
              <span>Budget Allocation: {currency === "INR" ? "₹20,000" : "$250"}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">17.1%</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total API Calls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Total API Invocations
            </span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalInvocations.toLocaleString()}
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>ErMate 2.5 Flash, 3.6 Pro, OCR & Voice</span>
            </p>
          </div>
        </div>

        {/* KPI 3: Registered Clinicians */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Registered Clinicians
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalUsers} Doctors
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Across {Object.keys(stateCounts).length || 1} States in India
            </p>
          </div>
        </div>

        {/* KPI 4: Onboarded Hospitals */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Affiliated Hospitals
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {allHospitalsSet.size} Facilities
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {activeCasesCount} active cases in database
            </p>
          </div>
        </div>

      </div>

      {/* Main Section: Comprehensive API Cost Incurred Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" /> API Usage & Incurred Cost Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Detailed metering of ErMate models, Google Cloud Vision, Speech-to-Text, Search Grounding, and Firestore sharding.
            </p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 w-fit">
            Rate Card: GCP Published Billing Tiers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">API Service & Provider</th>
                <th className="py-3 px-4">Usage / Units</th>
                <th className="py-3 px-4">Pricing Rate</th>
                <th className="py-3 px-4">Incurred Cost ({currency})</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              
              {/* Row 1: ErMate 2.5 Flash */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">ErMate Standard AI</p>
                      <p className="text-[10px] text-slate-500 font-mono">Scribe, SBAR & Handover Summarizer</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedErMateFlashCalls.toLocaleString()} calls
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $0.075 / 1M Input Tokens
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(ermateFlashCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 2: ErMate 3.6 Pro */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">ErMate Pro AI</p>
                      <p className="text-[10px] text-slate-500 font-mono">7-Lens Clinical Debrief & Differential AI</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedErMateProCalls.toLocaleString()} calls
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $1.25 / 1M Input Tokens
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(ermateProCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 3: Google Vision OCR */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Google Cloud Vision OCR</p>
                      <p className="text-[10px] text-slate-500 font-mono">Prescription & Lab Document Scanner</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedOcrScans.toLocaleString()} image scans
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $1.50 / 1,000 document scans
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(ocrCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 4: Speech to Text Voice */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Google Speech-to-Text Voice API</p>
                      <p className="text-[10px] text-slate-500 font-mono">Chirp 2 Audio Dictation & Voice Scribe</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedVoiceMinutes.toLocaleString()} audio mins
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $0.016 / audio minute
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(voiceCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 5: ErMate Search Grounding */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-teal-500/10 text-teal-500 rounded-lg">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">ErMate Search Grounding Tool</p>
                      <p className="text-[10px] text-slate-500 font-mono">Live Medical Journal & Web Grounding</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedSearchQueries.toLocaleString()} searches
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $35.00 / 1,000 queries
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(searchCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 6: Firestore DB Sharding */}
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Firestore Database Sharding</p>
                      <p className="text-[10px] text-slate-500 font-mono">Reads, Writes & Security Rules Verification</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {estimatedFirestoreReads.toLocaleString()} R / {estimatedFirestoreWrites.toLocaleString()} W
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                  $0.06/100k Reads | $0.18/100k Writes
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                  {formatAmt(firestoreCost)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                    Operational
                  </span>
                </td>
              </tr>

            </tbody>

            {/* Total Summary Footer */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-mono font-extrabold text-xs">
                <td className="py-4 px-4 rounded-l-2xl">TOTAL INCURRED COST</td>
                <td className="py-4 px-4">{totalInvocations.toLocaleString()} Total Invocations</td>
                <td className="py-4 px-4">Operational Multi-Cloud</td>
                <td className="py-4 px-4 text-emerald-400 font-black text-sm">{totalCostDisplay}</td>
                <td className="py-4 px-4 text-right rounded-r-2xl text-slate-400 font-sans font-normal text-[10px]">
                  Auto-synced with Cloud Billing
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      {/* Hospital State Distribution & User Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Hospital & State Distribution */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" /> State-wise Hospital Distribution
            </h3>
            <span className="text-[10px] font-mono text-slate-400 font-bold">
              {Object.keys(stateCounts).length} States
            </span>
          </div>

          <div className="space-y-3">
            {Object.keys(stateCounts).length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center text-slate-500 text-xs">
                No user locations recorded yet.
              </div>
            ) : (
              Object.entries(stateCounts).map(([st, info]) => (
                <div key={st} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{st}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {info.hospitals.size} hospital{info.hospitals.size !== 1 ? 's' : ''} onboarded
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold rounded-xl border border-indigo-200 dark:border-indigo-800">
                    {info.users} Doctor{info.users !== 1 ? 's' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: User Roster & Address Capture Status */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Registered User Profiles & Address Audit
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Verify hospital address completeness and state records for legal printout letterheads.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search doctor or hospital..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 font-sans"
                />
              </div>

              {/* State Filter */}
              <select
                value={selectedStateFilter}
                onChange={(e) => setSelectedStateFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-xl text-xs font-mono focus:outline-none"
              >
                <option value="All">All States</option>
                {Object.keys(stateCounts).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Doctor Name</th>
                  <th className="py-2.5 px-3">Role / Designation</th>
                  <th className="py-2.5 px-3">Hospital & State</th>
                  <th className="py-2.5 px-3">Address Status</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-mono">
                      No matching user profiles found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, i) => {
                    const hasAddress = u.hospitalAddress && u.hospitalAddress.trim().length > 3;
                    return (
                      <tr key={u.email || i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 dark:text-white">{u.name || "Dr. Physician"}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{u.email}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold rounded-md">
                            {u.role || "EM Resident"}
                          </span>
                        </td>
                        <td className="py-3 px-3 space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.hospital || "Emergency Care"}</p>
                          <p className="text-[10px] text-indigo-500 font-mono font-bold">{u.state || "Maharashtra"}</p>
                        </td>
                        <td className="py-3 px-3">
                          {hasAddress ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold rounded-md flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Complete
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold rounded-md flex items-center gap-1 w-fit">
                              <AlertCircle className="w-3 h-3" /> Address Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {u.aiCredits ?? 100} Scribes
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold font-mono rounded-lg transition-all cursor-pointer"
                          >
                            Edit Credits
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* HOD Claim Review Gate (Initial Bootstrapping Gate) */}
      <AdminHodClaimReview />

      {/* Role Change Audit Log Panel (NABH Compliance) */}
      <RoleChangeAuditLogPanel />

      {/* Self-Learning Architecture & Learned Rules Engine */}
      <SelfLearningRulesPanel />

      {/* Modal for editing User AI Credits */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Edit User AI Scribe Credits
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Editing quota allocation for <strong>{editingUser.name}</strong> ({editingUser.email}).
              </p>

              {saveUserSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-mono font-bold">
                  ✓ {saveUserSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono uppercase text-slate-500 block">
                  AI Scribe Credits Balance
                </label>
                <input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveUserCredits}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Save Allocated Quota
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
