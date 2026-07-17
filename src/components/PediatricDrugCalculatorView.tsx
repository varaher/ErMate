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
    <div className="bg-slate-900 min-h-screen text-slate-100 p-4 md:p-6 pb-20 font-sans" id="pediatric-calculator-container">
      
      {/* Header section */}
      <div className="max-w-4xl mx-auto flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
        <button 
          onClick={selectedCategory ? () => setSelectedCategory(null) : onBack}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg md:text-xl font-bold font-display tracking-tight text-white flex items-center gap-2">
            Pediatric Drug Calculator
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            {selectedCategory ? `Dosing reference • ${selectedCategory}` : "Weight-based pediatric emergency dosing reference"}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-5">

        {/* 1. Weight Input Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/25">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Patient Weight (kg)</label>
                <span className="text-[10px] text-slate-500 font-mono block">Type weight below to calculate immediate precise dosing</span>
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
                className="w-full pl-4 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-center font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 uppercase tracking-wider pointer-events-none">
                KG
              </span>
            </div>
          </div>
          
          <div className="text-[10px] text-amber-500/90 font-medium font-mono flex items-center gap-1 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Enter patient weight for dose calculations</span>
          </div>
        </div>

        {/* 2. Global Drug Search Bar (only shown on categories list screen) */}
        {!selectedCategory && (
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
              className="w-full pl-11 pr-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>
        )}

        {/* 3. Main content area */}
        {searchQuery.trim() !== "" ? (
          // SEARCH RESULTS ACTIVE
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-400 tracking-wider">
                Search Results ({filteredDrugs.length})
              </h3>
              <button 
                onClick={() => setSearchQuery("")}
                className="text-[11px] text-sky-400 hover:underline font-mono"
              >
                Clear Search
              </button>
            </div>

            {filteredDrugs.length === 0 ? (
              <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-mono">
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
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 px-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs text-sky-400 hover:underline font-mono flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Categories
                </button>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-bold font-mono text-slate-300">{selectedCategory}</span>
              </div>
              <span className="text-xs bg-slate-850 text-slate-400 px-2.5 py-0.5 rounded-full font-mono font-bold">
                {filteredDrugs.length} drugs
              </span>
            </div>

            {filteredDrugs.length === 0 ? (
              <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-mono">
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
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Drug Categories
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                133 drugs across 24 categories • Compliant with PALS standard guidelines
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
                    className="bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-sky-500/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col items-center text-center justify-center space-y-2.5 h-36 relative group"
                  >
                    <div className={`p-3 rounded-full ${cat.bgClass} ${cat.colorClass} group-hover:scale-110 transition-transform`}>
                      <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-200 block tracking-tight group-hover:text-white leading-tight">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {count > 0 ? `${count} drug${count > 1 ? "s" : ""}` : "Coming soon"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Disclaimer Banner (Screenshot 2 bottom) */}
        <div className="bg-slate-950/80 border border-slate-850 p-4.5 rounded-2xl space-y-2 text-slate-400 text-[10px] leading-relaxed font-mono mt-10">
          <div className="flex items-start gap-2.5 text-amber-500/90 font-bold uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Clinical Disclaimer</span>
          </div>
          <p>
            Dosages referenced from Harriet Lane Handbook, Nelson's Textbook of Pediatrics, and BNF for Children. Always verify doses before administration. This calculator is a clinical aid, not a substitute for clinical judgment. Standard concentration values may vary by local hospital formulary protocols.
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
      className={`bg-slate-950/50 border rounded-2xl p-4 hover:border-slate-700 transition-all ${
        isExpanded ? "border-sky-500/30 ring-1 ring-sky-500/10" : "border-slate-850"
      }`}
    >
      <div className="flex justify-between items-start gap-3 cursor-pointer" onClick={onToggle}>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white tracking-tight">{drug.name}</h4>
          {drug.genericName && (
            <p className="text-[10px] text-slate-500 font-mono">{drug.genericName}</p>
          )}
          <p className="text-xs text-sky-400 font-mono font-semibold pt-1">
            {drug.standardDose} | {drug.route} | {drug.frequency}
          </p>
          {drug.maxDose && (
            <p className="text-[9.5px] text-rose-400 font-mono font-medium">{drug.maxDose}</p>
          )}
        </div>

        <button className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-slate-300 transition-all">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Realtime Calculated Dose Alert Block */}
      {isWeightValid && calculation ? (
        <div className="mt-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3 flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Calculated Dose ({weight} kg)</span>
            <span className="text-[10px] text-slate-300 font-semibold font-sans block leading-normal whitespace-pre-line">
              {calculation.breakdown || `${calculation.doseValue} ${drug.route} ${drug.frequency}`}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-black text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
              {calculation.doseValue}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 bg-slate-900/40 border border-slate-850 rounded-xl p-2.5 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Type weight in the calculator above to display calculated doses.</span>
        </div>
      )}

      {/* Expanded detailed clinical instructions panel */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-900 space-y-3 text-[11px] leading-relaxed">
          {drug.indications && drug.indications.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Clinical Indications:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                {drug.indications.map((ind, idx) => (
                  <li key={idx}>{ind}</li>
                ))}
              </ul>
            </div>
          )}

          {calculation?.notes && (
            <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
              <span className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider font-mono block">Clinical Dilution & Safe Administration notes:</span>
              <p className="text-slate-300 font-mono text-[10px]">{calculation.notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono pt-1">
            <span>Reference: {drug.source}</span>
            <span className="text-slate-600">PALS Emergency Guidelines</span>
          </div>
        </div>
      )}

      {/* Card Footer Reference Source (Screenshot 4) */}
      {!isExpanded && (
        <div className="mt-2 text-[9px] text-slate-500 font-mono border-t border-slate-900/40 pt-1.5">
          {drug.source}
        </div>
      )}
    </div>
  );
}
