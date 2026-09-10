import React, { useState, useMemo } from "react";
import { 
  ArrowLeft, Search, Thermometer, Shield, Circle, Droplet, 
  Target, Wind, Crosshair, Zap, RotateCcw, Leaf, Heart, 
  Sun, ShieldAlert, Moon, PlusCircle, Box, Info, ChevronRight,
  ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";
import { PEDIATRIC_DRUGS, DRUG_CATEGORIES, PediatricDrug } from "../data/pediatricDrugs";

interface PediatricDrugCalculatorViewProps {
  onBack: () => void;
  initialWeight?: number;
}

// Icon mapper to dynamically render Lucide icons by string name
function CategoryIcon({ iconName, className }: { iconName: string; className?: string }) {
  const props = { className: className || "w-5 h-5", strokeWidth: 2 };
  switch (iconName) {
    case "Thermometer": return <Thermometer {...props} />;
    case "Shield": return <Shield {...props} />;
    case "Circle": return <Circle {...props} />;
    case "Droplet": return <Droplet {...props} />;
    case "Target": return <Target {...props} />;
    case "Wind": return <Wind {...props} />;
    case "Crosshair": return <Crosshair {...props} />;
    case "Zap": return <Zap {...props} />;
    case "RotateCcw": return <RotateCcw {...props} />;
    case "Leaf": return <Leaf {...props} />;
    case "Heart": return <Heart {...props} />;
    case "Sun": return <Sun {...props} />;
    case "ShieldAlert": return <ShieldAlert {...props} />;
    case "Moon": return <Moon {...props} />;
    case "PlusCircle": return <PlusCircle {...props} />;
    default: return <Box {...props} />;
  }
}

export default function PediatricDrugCalculatorView({ onBack, initialWeight }: PediatricDrugCalculatorViewProps) {
  const [weight, setWeight] = useState<string>(initialWeight ? initialWeight.toString() : "");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedDrugId, setExpandedDrugId] = useState<string | null>(null);
  const numericWeight = parseFloat(weight);
  const isWeightValid = !isNaN(numericWeight) && numericWeight > 0;

  const [viewMode, setViewMode] = useState<"drugs" | "fluids">("drugs");
  const [dehydrationPercent, setDehydrationPercent] = useState<string>("");

  // Holliday-Segar 4-2-1 maintenance rate (mL/hr)
  const maintenanceRate = useMemo(() => {
    if (!isWeightValid) return null;
    const w = numericWeight;
    let rate = 0;
    if (w <= 10) {
      rate = w * 4;
    } else if (w <= 20) {
      rate = 40 + (w - 10) * 2;
    } else {
      rate = 60 + (w - 20) * 1;
    }
    return {
      hourlyRate: rate,
      dailyVolume: rate * 24,
      breakdown:
        w <= 10
          ? `${w} kg × 4 mL/kg/hr = ${rate.toFixed(1)} mL/hr`
          : w <= 20
          ? `(10 kg × 4) + (${(w - 10).toFixed(1)} kg × 2) = ${rate.toFixed(1)} mL/hr`
          : `(10 kg × 4) + (10 kg × 2) + (${(w - 20).toFixed(1)} kg × 1) = ${rate.toFixed(1)} mL/hr`
    };
  }, [isWeightValid, numericWeight]);

  // Resuscitation bolus: 10-20 mL/kg isotonic crystalloid
  const bolusRange = useMemo(() => {
    if (!isWeightValid) return null;
    return {
      low: Math.round(numericWeight * 10),
      high: Math.round(numericWeight * 20)
    };
  }, [isWeightValid, numericWeight]);

  // Dehydration deficit: % dehydration x weight x 10 = mL deficit
  const numericDehydration = parseFloat(dehydrationPercent);
  const isDehydrationValid = !isNaN(numericDehydration) && numericDehydration > 0 && numericDehydration <= 15;
  const deficitVolume = useMemo(() => {
    if (!isWeightValid || !isDehydrationValid) return null;
    const deficit = numericDehydration * numericWeight * 10;
       const total = Math.round(deficit);
    const firstHalf = Math.round(total / 2);
    return {
      totalMl: total,
      firstHalf,
      remainingHalf: total - firstHalf
    };
  }, [isWeightValid, isDehydrationValid, numericDehydration, numericWeight]);
  const isWeightImplausible = isWeightValid && (numericWeight > 80 || numericWeight < 1);

  // Filtered drug categories counts for UI display
  const categoryCounts = useMemo(() => {
    const counts: { [cat: string]: number } = {};
    DRUG_CATEGORIES.forEach(cat => {
      counts[cat.name] = PEDIATRIC_DRUGS.filter(d => d.category === cat.name).length;
    });
    return counts;
  }, []);

  // Filter drugs based on search query OR selected category
  const filteredDrugs = useMemo(() => {
    let list = PEDIATRIC_DRUGS;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.genericName?.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    } else if (selectedCategory) {
      list = list.filter(d => d.category === selectedCategory);
    }

    return list;
  }, [searchQuery, selectedCategory]);

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchQuery(""); // Clear search when viewing category
    setExpandedDrugId(null);
  };

  const toggleDrugExpand = (drugId: string) => {
    setExpandedDrugId(expandedDrugId === drugId ? null : drugId);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 p-4 md:p-6 pb-20 font-sans" id="pediatric-calculator-container">
      
      {/* Header section */}
      <div className="max-w-4xl mx-auto flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
        <button 
          onClick={selectedCategory ? () => setSelectedCategory(null) : onBack}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg md:text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Pediatric Drug Calculator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {selectedCategory ? `Dosing reference • ${selectedCategory}` : "Weight-based pediatric emergency dosing reference"}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-5">

        {/* 1. Weight Input Card */}
        <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-500/25">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Patient Weight (kg)</label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">Type weight below to calculate immediate precise dosing</span>
              </div>
            </div>

            <div className="relative w-full sm:w-48">
              <input
                type="number"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setExpandedDrugId(null);
                }}
                placeholder="Enter weight"
                className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-center font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pointer-events-none">
                KG
              </span>
            </div>
          </div>
          
                   <div className="text-[10px] text-amber-600 dark:text-amber-500/90 font-medium font-mono flex items-center gap-1 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Enter patient weight for dose calculations</span>
          </div>

          {isWeightImplausible && (
            <div className="text-[10px] text-rose-700 dark:text-rose-400 font-bold font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{numericWeight} kg is outside the typical pediatric range — double-check this weight before trusting the calculated dose below.</span>
            </div>
          )}
        </div>

               {/* Mode Toggle: Drugs vs Fluids */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
          <button
            type="button"
                        onClick={() => { setViewMode("drugs"); setExpandedDrugId(null); setSelectedCategory(null); setSearchQuery(""); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === "drugs"
                ? "bg-white dark:bg-slate-800 shadow-sm text-sky-600 dark:text-sky-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
            }`}
          >
            Drug Dosing
          </button>
          <button
            type="button"
            onClick={() => setViewMode("fluids")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "fluids"
                ? "bg-white dark:bg-slate-800 shadow-sm text-sky-600 dark:text-sky-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            Fluids & Resuscitation
          </button>
        </div>

        {/* 2. Global Drug Search Bar (only shown on categories list screen) */}
        {viewMode === "drugs" && !selectedCategory && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setExpandedDrugId(null);
              }}
              placeholder="Search drugs by name..."
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>
        )}

                {/* 3. Main content area */}
        {viewMode === "drugs" && (searchQuery.trim() !== "" ? (
          // SEARCH RESULTS ACTIVE
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Search Results ({filteredDrugs.length})
              </h3>
              <button 
                onClick={() => setSearchQuery("")}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-mono"
              >
                Clear Search
              </button>
            </div>

            {filteredDrugs.length === 0 ? (
              <div className="bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-mono">
                No pediatric drugs match "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredDrugs.map(drug => (
                  <DrugCard 
                    key={drug.id} 
                    drug={drug} 
                    weight={numericWeight} 
                    isWeightValid={isWeightValid}
                    isExpanded={expandedDrugId === drug.id}
                    onToggle={() => toggleDrugExpand(drug.id)}
                  />
                ))}
              </div>
            )}
          </div>

        ) : selectedCategory ? (
          // VIEWING A CATEGORY'S DRUGS
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2 px-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Categories
                </button>
                <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">{selectedCategory}</span>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-full font-mono font-bold">
                {filteredDrugs.length} drugs
              </span>
            </div>

            {filteredDrugs.length === 0 ? (
              <div className="bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-mono">
                No drugs added under this category yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredDrugs.map(drug => (
                  <DrugCard 
                    key={drug.id} 
                    drug={drug} 
                    weight={numericWeight} 
                    isWeightValid={isWeightValid}
                    isExpanded={expandedDrugId === drug.id}
                    onToggle={() => toggleDrugExpand(drug.id)}
                  />
                ))}
              </div>
            )}
          </div>

        ) : (
          // MAIN CATEGORIES LIST (Screenshot 1 & 2)
          <div className="space-y-4">
            <div className="px-1">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Drug Categories
              </h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                {PEDIATRIC_DRUGS.length} drugs across {DRUG_CATEGORIES.length} categories • Compliant with PALS standard guidelines
              </p>
            </div>

            {/* Grid of Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {DRUG_CATEGORIES.map(cat => {
                const count = categoryCounts[cat.name] || 0;
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.name)}
                    className="bg-white dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:border-sky-500/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col items-center text-center justify-center space-y-2.5 h-36 relative group"
                  >
                    <div className={`p-3 rounded-full ${cat.bgClass} ${cat.colorClass} group-hover:scale-110 transition-transform`}>
                      <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block tracking-tight group-hover:text-sky-600 dark:group-hover:text-white leading-tight">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">
                        {count > 0 ? `${count} drug${count > 1 ? "s" : ""}` : "Coming soon"}
                      </span>
                    </div>
                  </div>
                               );
              })}
            </div>
          </div>
        ))}

        {/* Fluids & Resuscitation section */}
        {viewMode === "fluids" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Maintenance Fluid Rate — Holliday-Segar (4-2-1 Rule)
              </h3>
              {isWeightValid && maintenanceRate ? (
                <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-150 dark:border-indigo-500/15 rounded-xl p-4 space-y-1">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-300 font-mono">
                    {maintenanceRate.hourlyRate.toFixed(1)} mL/hr
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">{maintenanceRate.breakdown}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    ≈ {maintenanceRate.dailyVolume.toFixed(0)} mL/24hr
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl p-3 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Enter weight above to calculate maintenance rate.</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Resuscitation Bolus (Isotonic Crystalloid — NS / RL)
              </h3>
              {isWeightValid && bolusRange ? (
                <div className="bg-rose-50 dark:bg-rose-500/5 border border-rose-150 dark:border-rose-500/15 rounded-xl p-4 space-y-1">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-300 font-mono">
                    {bolusRange.low}–{bolusRange.high} mL
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    10–20 mL/kg × {numericWeight} kg
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1 pt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Reassess after each bolus (perfusion, lung findings, mental status) before repeating.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl p-3 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Enter weight above to calculate bolus range.</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Dehydration Deficit Replacement
              </h3>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">% Dehydration</label>
                <input
                  type="number"
                  value={dehydrationPercent}
                  onChange={(e) => setDehydrationPercent(e.target.value)}
                  placeholder="e.g. 5, 10"
                  className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-mono text-center focus:outline-none focus:border-sky-500"
                />
                <span className="text-xs text-slate-400 font-mono">%</span>
              </div>

              {isWeightValid && isDehydrationValid && deficitVolume ? (
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-150 dark:border-amber-500/15 rounded-xl p-4 space-y-2">
                  <span className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
                    {deficitVolume.totalMl} mL total deficit
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    {numericDehydration}% × {numericWeight} kg × 10 = {deficitVolume.totalMl} mL
                  </p>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono space-y-0.5 pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                    <p>First 8 hours: {deficitVolume.firstHalf} mL (½ deficit) + maintenance rate</p>
                    <p>Next 16 hours: {deficitVolume.remainingHalf} mL (remaining ½ deficit) + maintenance rate</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl p-3 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Enter weight and % dehydration (typically 5–10%, max 15%) to calculate.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Disclaimer Banner (Screenshot 2 bottom) */}
        <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 p-4.5 rounded-2xl space-y-2 text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed font-mono mt-10">
          <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-500/90 font-bold uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Clinical Disclaimer</span>
          </div>
                   <p>
            Dosages and fluid rates referenced from Harriet Lane Handbook, Nelson's Textbook of Pediatrics, and BNF for Children. Always verify doses before administration. This calculator is a clinical aid, not a substitute for clinical judgment. Standard concentration values may vary by local hospital formulary protocols.
          </p>
          <p className="text-amber-700 dark:text-amber-400 font-bold">
            Always consult a pediatrician or follow your hospital's own protocol before administering any medication or fluid therapy based on this tool.
          </p>
        
        </div>

      </div>
    </div>
  );
}

// Drug Card Subcomponent
interface DrugCardProps {
  key?: React.Key;
  drug: PediatricDrug;
  weight: number;
  isWeightValid: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function DrugCard({ drug, weight, isWeightValid, isExpanded, onToggle }: DrugCardProps) {
  // calculate dynamic dosing if weight valid
  const calculation = useMemo(() => {
    if (isWeightValid && drug.calculateDose) {
      return drug.calculateDose(weight);
    }
    return null;
  }, [isWeightValid, drug, weight]);

  return (
    <div 
      className={`bg-white dark:bg-slate-950/50 border rounded-2xl p-4 hover:border-slate-400 dark:hover:border-slate-700 transition-all ${
        isExpanded ? "border-sky-500/30 ring-1 ring-sky-500/10" : "border-slate-200 dark:border-slate-850"
      }`}
    >
      <div className="flex justify-between items-start gap-3 cursor-pointer" onClick={onToggle}>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{drug.name}</h4>
          {drug.genericName && (
            <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono">{drug.genericName}</p>
          )}
          <p className="text-xs text-sky-600 dark:text-sky-400 font-mono font-semibold pt-1">
            {drug.standardDose} | {drug.route} | {drug.frequency}
          </p>
          {drug.maxDose && (
            <p className="text-[9.5px] text-rose-600 dark:text-rose-400 font-mono font-medium">{drug.maxDose}</p>
          )}
        </div>

        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Realtime Calculated Dose Alert Block */}
      {isWeightValid && calculation ? (
        <div className="mt-3 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-150 dark:border-indigo-500/15 rounded-xl p-3 flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-mono">Calculated Dose ({weight} kg)</span>
            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold font-sans block leading-normal whitespace-pre-line">
              {calculation.breakdown || `${calculation.doseValue} ${drug.route} ${drug.frequency}`}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-300 font-mono bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-2.5 py-1 rounded-md">
              {calculation.doseValue}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl p-2.5 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Type weight in the calculator above to display calculated doses.</span>
        </div>
      )}

      {/* Expanded detailed clinical instructions panel */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-900 space-y-3 text-[11px] leading-relaxed">
          {drug.indications && drug.indications.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Clinical Indications:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                {drug.indications.map((ind, idx) => (
                  <li key={idx}>{ind}</li>
                ))}
              </ul>
            </div>
          )}

          {drug.formulations && drug.formulations.length > 0 ? (
            <div className="space-y-1.5 bg-sky-50 dark:bg-sky-950/20 p-2.5 rounded-lg border border-sky-150 dark:border-sky-900/40">
              <span className="text-[9.5px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider font-mono block">Available Formulations (Syrup, Injection, Tablets, etc.):</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-650 dark:text-slate-300 font-mono text-[10px]">
                {drug.formulations.map((form, idx) => (
                  <li key={idx}>{form}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-1.5 bg-sky-50 dark:bg-sky-950/20 p-2.5 rounded-lg border border-sky-150 dark:border-sky-900/40">
              <span className="text-[9.5px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider font-mono block">Formulation Classifications:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-650 dark:text-slate-300 font-mono text-[10px]">
                {drug.route.includes("PO") && (
                  <>
                    <li><strong className="text-slate-700 dark:text-slate-200">Syrup/Suspension:</strong> Standard pediatric oral suspension liquid drops.</li>
                    <li><strong className="text-slate-700 dark:text-slate-200">Tablets:</strong> Dispersible or crushable tablets (split according to computed dose).</li>
                  </>
                )}
                {drug.route.includes("IV") && <li><strong className="text-slate-700 dark:text-slate-200">Injection:</strong> Reconstituted liquid infusion vial (slow push / IV drip).</li>}
                {drug.route.includes("IM") && <li><strong className="text-slate-700 dark:text-slate-200">Injection (IM):</strong> Concentrated intramuscular vial injection.</li>}
                {drug.route.includes("PR") && <li><strong className="text-slate-700 dark:text-slate-200">Rectal/Suppository:</strong> Safe local pediatric suppository formulations.</li>}
              </ul>
            </div>
          )}

          {calculation?.notes && (
            <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-150 dark:border-slate-850">
              <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono block">Clinical Dilution & Safe Administration notes:</span>
              <p className="text-slate-600 dark:text-slate-300 font-mono text-[10px]">{calculation.notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono pt-1">
            <span>Reference: {drug.source}</span>
            <span className="text-slate-400 dark:text-slate-600">PALS Emergency Guidelines</span>
          </div>
        </div>
      )}

      {/* Card Footer Reference Source (Screenshot 4) */}
      {!isExpanded && (
        <div className="mt-2 text-[9px] text-slate-450 dark:text-slate-500 font-mono border-t border-slate-100 dark:border-slate-900/40 pt-1.5">
          {drug.source}
        </div>
      )}
    </div>
  );
}
