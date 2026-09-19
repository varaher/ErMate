import React, { useState } from "react";
import { 
  Wrench, ShieldAlert, Baby, Eye, ArrowLeft, ChevronRight, Activity, 
  Sparkles, Stethoscope, Scale, Camera
} from "lucide-react";
import ErGuideView from "./ErGuideView";
import PediatricDrugCalculatorView from "./PediatricDrugCalculatorView";
import PocketMirrorView from "./PocketMirrorView";

interface ToolsViewProps {
  onNavigateToTab: (tabId: string) => void;
  isDarkMode?: boolean;
}

type ToolKey = "hub" | "emdrugs" | "pediatric" | "pocketmirror";

export default function ToolsView({ onNavigateToTab, isDarkMode = false }: ToolsViewProps) {
  const [activeTool, setActiveTool] = useState<ToolKey>("hub");

  // If a specific sub-tool is active, render it directly with a persistent tool switcher bar
  if (activeTool === "emdrugs") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTool("hub")}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Tools
            </button>
            <span className="text-xs font-mono font-bold text-slate-400">|</span>
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              EM Drug & Resuscitation Guide
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTool("pediatric")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <Baby className="w-3.5 h-3.5 text-blue-500" /> Pediatric Dosing
            </button>
            <button
              onClick={() => setActiveTool("pocketmirror")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-500" /> Pocket Mirror
            </button>
          </div>
        </div>

        <ErGuideView onBack={() => setActiveTool("hub")} isDarkMode={isDarkMode} />
      </div>
    );
  }

  if (activeTool === "pediatric") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTool("hub")}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Tools
            </button>
            <span className="text-xs font-mono font-bold text-slate-400">|</span>
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Baby className="w-4 h-4 text-blue-500" />
              Pediatric Dosing & Resuscitation
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTool("emdrugs")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> EM Drugs
            </button>
            <button
              onClick={() => setActiveTool("pocketmirror")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-500" /> Pocket Mirror
            </button>
          </div>
        </div>

        <PediatricDrugCalculatorView onBack={() => setActiveTool("hub")} />
      </div>
    );
  }

  if (activeTool === "pocketmirror") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTool("hub")}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Tools
            </button>
            <span className="text-xs font-mono font-bold text-slate-400">|</span>
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-500" />
              Pocket Mirror & Airway Exam
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTool("emdrugs")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> EM Drugs
            </button>
            <button
              onClick={() => setActiveTool("pediatric")}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <Baby className="w-3.5 h-3.5 text-blue-500" /> Pediatric Dosing
            </button>
          </div>
        </div>

        <PocketMirrorView onBack={() => setActiveTool("hub")} />
      </div>
    );
  }

  // Default: Clinical Tools Hub View
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in" id="clinical-tools-hub">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white">
              Clinical Tools & ER Calculators
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rapid clinical decision support, weight-based pediatric resuscitation, RSI induction calculators, and airway tools.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Core ER Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tool 1: EM Drug Guide & Resuscitation */}
        <div 
          onClick={() => setActiveTool("emdrugs")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-red-500 dark:hover:border-red-500 rounded-2xl p-6 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
              EM Drug & Resuscitation Guide
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Rapid Sequence Intubation (RSI) 7 Ps timeline & drug estimators, sedation agent dosing, ventilator lung-protective IBW calculator, and Seldinger line guidelines.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>Open EM Drug Guide</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tool 2: Pediatric Dosing Calculator */}
        <div 
          onClick={() => setActiveTool("pediatric")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Baby className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
              Pediatric Dosing & Resuscitation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Weight-based emergency pediatric dosing referenced from Nelson & Harriet Lane. Resuscitation boluses, antiepileptics, airway sizing, and maintenance fluids.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>Open Pediatric Dosing</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tool 3: Pocket Mirror & Airway Exam */}
        <div 
          onClick={() => setActiveTool("pocketmirror")}
          className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
              Pocket Mirror & Airway Exam
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Interactive camera tool for pupil gauge measurement, Mallampati airway classification, throat inspection, and high-contrast illumination for emergency evaluations.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>Open Pocket Mirror</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
