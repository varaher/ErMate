import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  Building2,
  Search,
  X,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Moon,
  Sun,
  Sparkles,
  Download,
  Settings,
  LogOut,
  ShieldCheck,
  User,
  BookOpen,
  Archive,
  ChevronRight,
} from "lucide-react";
import { GlobalRefreshButton } from "./shared/GlobalRefreshButton";
import { ErMateLogo } from "./shared/ErMateLogo";
import type { ClinicalCase } from "../types";
import type { UserProfile } from "../types";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  timestamp: string;
  read: boolean;
  resolved?: boolean;
  resolvedAt?: string;
  linkView?: string;
  actionKey?: string;
}

export interface GlobalHeaderProps {
  profile: UserProfile | null;
  hospitalSubscription: { active: boolean; plan?: string } | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResultsOpen: boolean;
  onSearchResultsOpenChange: (open: boolean) => void;
  matchedCases: ClinicalCase[];
  matchedReferences: any[];
  onSelectCase: (caseId: string) => void;
  onSelectReference: (ref: any) => void;
  onQueryAIReference: (query: string) => void;
  // Refresh
  onManualRefresh: () => Promise<void>;
  isCaseSheetDirty: boolean;
  selectedCaseId: string | null;
  activeFormMode: string | null;
  showDischargeSummaryId: string | null;
  isScribeBusy: boolean;
  caseSheetActionsRef: React.MutableRefObject<any>;
  // Notifications
  notifications: AppNotification[];
  onUpdateNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  // Updates & PWA
  appUpdateBanner: boolean;
  onShowUpdatesModal: () => void;
  currentVersion: string;
  isInstalled: boolean;
  onInstallApp: () => void;
  // Navigation & Actions
  onNavigateToTab: (tabId: string) => void;
  onSignOut: () => void;
  onOpenProfile?: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  profile,
  hospitalSubscription,
  isDarkMode,
  onToggleDarkMode,
  searchQuery,
  onSearchChange,
  searchResultsOpen,
  onSearchResultsOpenChange,
  matchedCases,
  matchedReferences,
  onSelectCase,
  onSelectReference,
  onQueryAIReference,
  onManualRefresh,
  isCaseSheetDirty,
  selectedCaseId,
  activeFormMode,
  showDischargeSummaryId,
  isScribeBusy,
  caseSheetActionsRef,
  notifications,
  onUpdateNotifications,
  appUpdateBanner,
  onShowUpdatesModal,
  currentVersion,
  isInstalled,
  onInstallApp,
  onNavigateToTab,
  onSignOut,
  onOpenProfile,
}) => {
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<"active" | "history">("active");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Synchronize exact runtime header height to CSS variable for child subheaders & safe positioning
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty("--ermate-header-height", `${height}px`);
      }
    };
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotificationsDropdown(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Compute initials for doctor avatar
  const getInitials = (name?: string) => {
    if (!name) return "ER";
    const cleaned = name.replace(/^Dr\.?\s+/i, "").trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase() || "ER";
  };

  const doctorInitials = getInitials(profile?.name);

  // Format single-line workplace context
  const workplaceText = (() => {
    const hosp = profile?.hospital?.trim();
    const dept = profile?.department?.trim();
    if (hosp && dept) {
      // If hosp already includes dept name, avoid duplication
      if (hosp.toLowerCase().includes(dept.toLowerCase())) return hosp;
      return `${hosp} • ${dept}`;
    }
    return hosp || dept || "Emergency Department";
  })();

  // Notification lifecycle filtering
  // State 1: UNREAD (!read && !resolved) -> counts toward bell badge, visible in active
  // State 2: READ BUT PENDING (read && !resolved) -> visible in active, 0 badge impact
  // State 3: RESOLVED (resolved === true) -> removed from active, retained in history
  const activeNotifications = notifications.filter(n => !n.resolved);
  const historyNotifications = notifications.filter(n => n.resolved);
  const activeUnreadCount = activeNotifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdateNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    onUpdateNotifications(prev =>
      prev.map(n => (!n.resolved ? { ...n, read: true } : n))
    );
  };

  const handleResolveNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdateNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, resolved: true, resolvedAt: new Date().toISOString() }
          : n
      )
    );
  };

  const handleResolveAll = () => {
    onUpdateNotifications(prev =>
      prev.map(n =>
        !n.resolved
          ? { ...n, resolved: true, resolvedAt: new Date().toISOString() }
          : n
      )
    );
  };

  const handleClearHistory = () => {
    onUpdateNotifications(prev => prev.filter(n => !n.resolved));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    if (notif.linkView) {
      onNavigateToTab(notif.linkView);
    }
    setShowNotificationsDropdown(false);
  };

  return (
    <header ref={headerRef} className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 pt-safe px-3 md:px-6 shadow-xs sticky top-0 z-40 no-print relative select-none">
      {/* Top accent gradient border line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-600" />

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-h-[50px] py-1.5 sm:py-2">
        {/* LEFT: ErMate Logo & Branding */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ErMateLogo 
            variant="header" 
            size="sm" 
            onClick={() => onNavigateToTab("dashboard")}
          />

          {/* CONTEXT: Current Workplace / Department (Desktop Only) */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs shrink-0 max-w-[200px] lg:max-w-[300px]"
            title={workplaceText}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate whitespace-nowrap">
              {workplaceText}
            </span>
          </div>
        </div>

        {/* CENTER / SEARCH: Desktop Search Input */}
        <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md mx-2 relative z-50">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patient, ID, UHID, or protocol..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onSearchResultsOpenChange(true);
              }}
              onFocus={() => onSearchResultsOpenChange(true)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  onSearchResultsOpenChange(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {searchResultsOpen && searchQuery.trim().length > 0 && (
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => onSearchResultsOpenChange(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 animate-fade-in select-none">
                {/* Matched ER Patients */}
                {matchedCases.length > 0 && (
                  <div className="p-2.5">
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono px-2 mb-1">
                      Matched ER Patients ({matchedCases.length})
                    </span>
                    <div className="space-y-1">
                      {matchedCases.map((c, idx) => (
                        <div
                          key={`${c.id}-${idx}`}
                          onClick={() => {
                            onSelectCase(c.id);
                            onSearchChange("");
                            onSearchResultsOpenChange(false);
                          }}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-all"
                        >
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                              {c.patient.name}
                            </span>
                            <span className="block text-[10px] text-slate-400 truncate">
                              Age {c.patient.age || "N/A"} • {c.patient.gender} • Complaint: {c.patient.presentingComplaint}
                            </span>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1 ml-2">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-extrabold">
                              {c.displayId || c.id}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical Reference Protocols */}
                {matchedReferences.length > 0 && (
                  <div className="p-2.5">
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono px-2 mb-1">
                      Clinical Protocols ({matchedReferences.length})
                    </span>
                    <div className="space-y-1">
                      {matchedReferences.map(r => (
                        <div
                          key={r.id}
                          onClick={() => {
                            onSelectReference(r);
                            onSearchChange("");
                            onSearchResultsOpenChange(false);
                          }}
                          className="flex items-start gap-2 p-2 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 rounded-lg cursor-pointer transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                              {r.title}
                            </span>
                            <span className="block text-[10px] text-slate-400 truncate">
                              {r.category} • {r.summary}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ask AI Reference fallback */}
                <div className="p-2 bg-slate-50/60 dark:bg-slate-900/40">
                  <button
                    type="button"
                    onClick={() => {
                      onQueryAIReference(searchQuery);
                      onSearchChange("");
                      onSearchResultsOpenChange(false);
                    }}
                    className="w-full py-1.5 px-2.5 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-slate-800 text-left rounded-lg text-xs font-bold flex items-center gap-2 text-slate-600 dark:text-slate-300 transition-all border border-dashed border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    <span>Ask ErMate Reference for <strong className="text-indigo-600 dark:text-indigo-400">"{searchQuery}"</strong></span>
                  </button>
                </div>

                {matchedCases.length === 0 && matchedReferences.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No direct matches for "{searchQuery}". Try searching for chest pain, sepsis, STEMI, or specific patients.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Compact Controls [Search (Mobile)] [Refresh] [Bell] [Avatar] */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
            title="Search"
            aria-label="Toggle search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Global Refresh Button (Icon Only, ↻) */}
          <GlobalRefreshButton
            onRefresh={onManualRefresh}
            isDirty={isCaseSheetDirty && Boolean(selectedCaseId && !activeFormMode && !showDischargeSummaryId)}
            isVoiceBusy={isScribeBusy}
            compact={true}
            onSaveAndRefresh={async () => {
              if (caseSheetActionsRef.current?.save) {
                await caseSheetActionsRef.current.save();
              }
            }}
            onDiscardAndRefresh={() => {
              if (caseSheetActionsRef.current?.discard) {
                caseSheetActionsRef.current.discard();
              }
            }}
          />

          {/* Real-time Notifications Bell */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotificationsDropdown(!showNotificationsDropdown);
                setShowProfileMenu(false);
              }}
              className="w-8 h-8 md:w-8.5 md:h-8.5 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors relative cursor-pointer"
              title="Notifications"
              id="notifications-bell"
              aria-label="Notifications"
            >
              {activeUnreadCount > 0 ? (
                <>
                  <BellRing className="w-4 h-4 text-rose-500 animate-bounce" />
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                    {activeUnreadCount > 9 ? "9+" : activeUnreadCount}
                  </span>
                </>
              ) : (
                <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900 animate-fade-in select-none">
                {/* Header */}
                <div className="p-3 bg-slate-50/90 dark:bg-slate-900/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-display">
                      ER Alerts
                    </span>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {notificationsTab === "active" && (
                      <>
                        {activeUnreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 cursor-pointer"
                            title="Mark all as read"
                          >
                            <Check className="w-3 h-3" />
                            <span>Read All</span>
                          </button>
                        )}
                        {activeNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleResolveAll}
                            className="text-[10px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer"
                            title="Resolve all active alerts"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Resolve All</span>
                          </button>
                        )}
                      </>
                    )}
                    {notificationsTab === "history" && historyNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        className="text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-bold flex items-center gap-1 cursor-pointer"
                        title="Clear resolved notification history"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear History</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs: Active vs History */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setNotificationsTab("active")}
                    className={`flex-1 py-1.5 text-center transition-colors cursor-pointer border-b-2 ${
                      notificationsTab === "active"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Active ({activeNotifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsTab("history")}
                    className={`flex-1 py-1.5 text-center transition-colors cursor-pointer border-b-2 ${
                      notificationsTab === "history"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    History ({historyNotifications.length})
                  </button>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 scrollbar-thin">
                  {notificationsTab === "active" ? (
                    activeNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                        <CheckCheck className="w-6 h-6 text-emerald-400 animate-pulse-slow" />
                        <span className="font-bold text-slate-600 dark:text-slate-300">All caught up</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          No active clinical or system alerts.
                        </span>
                      </div>
                    ) : (
                      activeNotifications.map((notif) => {
                        const isUnread = !notif.read;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex gap-2.5 items-start ${
                              isUnread
                                ? "bg-indigo-50/30 dark:bg-indigo-950/20 border-l-2 border-indigo-500"
                                : ""
                            }`}
                          >
                            <div
                              className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
                                notif.type === "success"
                                  ? "bg-emerald-500"
                                  : notif.type === "warning"
                                  ? "bg-rose-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[11px] block truncate ${
                                    isUnread
                                      ? "font-extrabold text-slate-900 dark:text-white"
                                      : "font-semibold text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {notif.title}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[8px] text-slate-400 font-mono">
                                    {notif.timestamp.split(" | ")[0]}
                                  </span>

                                  {/* Mark Read Button */}
                                  {isUnread && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                                      className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-600 rounded transition-colors cursor-pointer"
                                      title="Mark read"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Resolve Button (✓) */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleResolveNotification(notif.id, e)}
                                    className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                    title="Mark completed/resolved"
                                  >
                                    <CheckCheck className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug font-medium">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    // History Tab
                    historyNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                        <Archive className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                        <span className="font-bold text-slate-600 dark:text-slate-400">No resolved alerts</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Completed alerts will appear here for audit.
                        </span>
                      </div>
                    ) : (
                      historyNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-3 text-left bg-slate-50/40 dark:bg-slate-900/20 opacity-75 flex gap-2.5 items-start"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                                {notif.title}
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono">
                                Resolved
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar & Menu (Avatar Only in Header) */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotificationsDropdown(false);
              }}
              className="w-8 h-8 md:w-8.5 md:h-8.5 rounded-full bg-gradient-to-tr from-indigo-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center ring-2 ring-indigo-100 dark:ring-indigo-900/60 hover:ring-indigo-300 transition-all cursor-pointer relative shadow-xs"
              title={`Dr. ${profile?.name || "Clinician"}`}
              aria-label="Profile menu"
              id="profile-avatar-btn"
            >
              <span>{doctorInitials}</span>

              {/* Small update indicator dot on avatar if update available */}
              {appUpdateBanner && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-1 ring-white dark:ring-slate-950" />
                </span>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-fade-in select-none text-slate-800 dark:text-slate-100"
                id="profile-dropdown-menu"
              >
                {/* Clinician Identity Card */}
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {doctorInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                      Dr. {profile?.name || "Physician"}
                    </strong>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                        {profile?.role || "Emergency Physician"}
                      </span>
                    </div>
                    {profile?.email && (
                      <span className="block text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                        {profile.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Workplace & Subscription Info */}
                <div className="p-2.5 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Workplace:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={workplaceText}>
                      {workplaceText}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Subscription:</span>
                    {hospitalSubscription?.active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Team Plan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        <User className="w-3 h-3" />
                        Individual Plan
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Preferences & Navigation Links */}
                <div className="space-y-1 pt-1 text-xs font-medium">
                  {/* Appearance / Theme Toggle */}
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      {isDarkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                      <span>Appearance</span>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {isDarkMode ? "Dark" : "Light"}
                    </button>
                  </div>

                  {/* Edit Clinical Profile Link */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenProfile) onOpenProfile();
                      else onNavigateToTab("profile");
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Edit Clinical Profile</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Account & Settings Link */}
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToTab("profile");
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Account & Facility Settings</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* What's New & Release Notes */}
                  <button
                    type="button"
                    onClick={() => {
                      onShowUpdatesModal();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>What's New</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      v{currentVersion}
                    </span>
                  </button>

                  {/* Install App / PWA (if not installed) */}
                  {!isInstalled && (
                    <button
                      type="button"
                      onClick={() => {
                        onInstallApp();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-indigo-500" />
                        <span>Download ErMate App</span>
                      </div>
                      <span className="text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded uppercase">
                        Install
                      </span>
                    </button>
                  )}
                </div>

                {/* Sign Out Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Second Row: Workplace Subtitle */}
      <div className="flex sm:hidden items-center justify-between pt-1.5 px-0.5">
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate max-w-full">
          <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
          <span className="truncate">{workplaceText}</span>
        </div>
      </div>

      {/* Mobile Search Expandable Bar */}
      {mobileSearchOpen && (
        <div className="md:hidden mt-2 pt-2 border-t border-slate-100 dark:border-slate-850">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patient, ID, UHID..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onSearchResultsOpenChange(true);
              }}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                onSearchChange("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default GlobalHeader;
