import React, { useState } from "react";
import { Search, BookOpen, ChevronRight, HelpCircle, ArrowUpRight, Sparkles, AlertCircle } from "lucide-react";
import { GUIDE_SECTIONS, GuideSection } from "../data/guide";

interface UserGuideViewProps {
  onNavigateToFeature?: (featureId: string) => void;
}

export default function UserGuideView({ onNavigateToFeature }: UserGuideViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(GUIDE_SECTIONS[0].id);
  const [activeTab, setActiveTab] = useState<"all" | "core" | "clinical" | "ai" | "account">("all");

  const filteredSections = GUIDE_SECTIONS.filter((section) => {
    const matchesSearch =
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === "all") return true;
    if (activeTab === "core" && section.badge === "Core") return true;
    if (activeTab === "clinical" && section.badge === "Clinical") return true;
    if (activeTab === "ai" && section.badge === "ErMate Feature") return true;
    if (activeTab === "account" && (section.badge === "Account" || section.badge === "Workflow")) return true;
    return true;
  });

  const selectedSection = GUIDE_SECTIONS.find((s) => s.id === selectedSectionId) || GUIDE_SECTIONS[0];

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case "Core":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "Clinical":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
      case "ErMate Feature":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
      case "Account":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800";
    }
  };

  const getFeatureRoute = (sectionId: string): string | null => {
    if (sectionId.includes("triage")) return "triage";
    if (sectionId.includes("case-sheet") || sectionId.includes("voice") || sectionId.includes("scan") || sectionId.includes("decision")) return "casesheet";
    if (sectionId.includes("discharge")) return "discharge";
    if (sectionId.includes("learn")) return "learn";
    if (sectionId.includes("profile") || sectionId.includes("stats") || sectionId.includes("night")) return "profile";
    if (sectionId.includes("your-cases")) return "cases";
    if (sectionId.includes("dashboard")) return "dashboard";
    return null;
  };

  const formatMarkdown = (text: string) => {
    return text.split("\n").map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-2" />;

      // Header h3
      if (trimmed.startsWith("###")) {
        return (
          <h3 key={index} className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-5 mb-2 font-display">
            {trimmed.replace("###", "").trim()}
          </h3>
        );
      }
      
      // Header h2
      if (trimmed.startsWith("##")) {
        return (
          <h2 key={index} className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3 font-display border-b border-slate-100 dark:border-slate-800 pb-1">
            {trimmed.replace("##", "").trim()}
          </h2>
        );
      }

      // Bold tips/notes
      if (trimmed.startsWith(">")) {
        return (
          <blockquote key={index} className="border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 p-4 rounded-r-lg my-4 text-sm flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>{trimmed.replace(">", "").trim()}</div>
          </blockquote>
        );
      }

      // List item
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        const itemContent = trimmed.substring(2);
        return (
          <li key={index} className="ml-5 list-disc text-slate-600 dark:text-slate-300 mb-1 leading-relaxed">
            {renderBoldText(itemContent)}
          </li>
        );
      }

      // Numbered lists
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        return (
          <li key={index} className="ml-5 list-decimal text-slate-600 dark:text-slate-300 mb-1 leading-relaxed">
            {renderBoldText(numberedMatch[2])}
          </li>
        );
      }

      // Normal paragraph
      return (
        <p key={index} className="text-slate-600 dark:text-slate-300 mb-3 leading-relaxed text-sm md:text-base">
          {renderBoldText(trimmed)}
        </p>
      );
    });
  };

  const renderBoldText = (text: string) => {
    // Basic regex parser for bold **text** and code `text`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-mono text-xs rounded border border-slate-200 dark:border-slate-700">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[500px]" id="user-guide-container">
      {/* Search & Index Drawer/Sidebar */}
      <div className="w-full lg:w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-900">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search User Guide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Categories Tab */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-900 flex gap-1 overflow-x-auto scrollbar-thin">
          {[
            { id: "all", label: "All" },
            { id: "core", label: "Core" },
            { id: "clinical", label: "Clinical" },
            { id: "ai", label: "ErMate Support" },
            { id: "account", label: "Workflow" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-all shrink-0 font-medium ${
                activeTab === tab.id
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Index List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[300px] lg:max-h-none scrollbar-thin">
          {filteredSections.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No guide sections found
            </div>
          ) : (
            filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-all border ${
                  selectedSectionId === section.id
                    ? "bg-blue-50/80 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300"
                    : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium truncate">{section.title}</p>
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border mt-1 font-mono ${getBadgeColor(section.badge)}`}>
                    {section.badge || "General"}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedSectionId === section.id ? "translate-x-0.5 text-blue-500" : "text-slate-400"}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
        <div className="p-6 md:p-8 flex-1 max-w-4xl w-full mx-auto">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-5 mb-5">
              <div>
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full border mb-2 font-mono font-semibold uppercase tracking-wider ${getBadgeColor(selectedSection.badge)}`}>
                  {selectedSection.badge || "Guide Section"}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold font-display text-slate-900 dark:text-white">
                  {selectedSection.title}
                </h1>
              </div>
              
              {/* Context Action Button to jump into the clinical simulation */}
              {onNavigateToFeature && getFeatureRoute(selectedSection.id) && (
                <button
                  onClick={() => onNavigateToFeature(getFeatureRoute(selectedSection.id)!)}
                  className="inline-flex items-center gap-1.5 px-4  py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all transform hover:-translate-y-0.5"
                >
                  {selectedSection.badge === "ErMate Feature" ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <BookOpen className="w-4 h-4" />
                  )}
                  Try Feature in App
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Markdown Styled Contents */}
            <div className="prose dark:prose-invert max-w-none">
              {formatMarkdown(selectedSection.content)}
            </div>
          </div>

          {/* Quick Help Footer Banner */}
          <div className="bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/80 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Need specialized assistance with ErMate?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reach out to Varah Group at <span className="font-semibold text-blue-600 dark:text-blue-400">support@ermate.com</span> or access our website <span className="underline font-semibold text-blue-600 dark:text-blue-400">ermate.in</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
