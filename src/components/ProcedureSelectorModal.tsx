import React from "react";
import { 
  ProcedureType, 
  ProcedureCategory 
} from "../types/procedureNotes";
import { 
  PROCEDURE_DEFINITIONS, 
  PROCEDURE_CATEGORIES, 
  ProcedureDefinition 
} from "../data/procedureDefinitions";
import { 
  Activity, 
  Search, 
  Star, 
  ChevronRight, 
  X, 
  Stethoscope, 
  Syringe, 
  Pipette, 
  Bone, 
  Bandage, 
  HeartPulse 
} from "lucide-react";

interface ProcedureSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProcedure: (procDef: ProcedureDefinition) => void;
}

export const ProcedureSelectorModal: React.FC<ProcedureSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectProcedure,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<ProcedureCategory | "ALL">("ALL");
  const [showMoreProcedures, setShowMoreProcedures] = React.useState(false);

  if (!isOpen) return null;

  const categoryIcons: Record<ProcedureCategory, React.ReactNode> = {
    "AIRWAY & BREATHING": <Stethoscope className="w-4 h-4 text-sky-500" />,
    "VASCULAR & MONITORING": <Syringe className="w-4 h-4 text-emerald-500" />,
    "TUBES & DRAINS": <Pipette className="w-4 h-4 text-indigo-500" />,
    "TRAUMA & ORTHOPEDICS": <Bone className="w-4 h-4 text-amber-500" />,
    "WOUND / MINOR PROCEDURES": <Bandage className="w-4 h-4 text-rose-500" />,
    "RESUSCITATION / OTHER": <HeartPulse className="w-4 h-4 text-purple-500" />,
  };

  // Filter procedures
  const filteredProcedures = PROCEDURE_DEFINITIONS.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      return matchName || matchDesc || matchCat;
    }
    if (selectedCategory !== "ALL") {
      return p.category === selectedCategory;
    }
    // If not searching and no specific category selected:
    // If showMoreProcedures is false, only show favorites or implemented
    if (!showMoreProcedures) {
      return p.isFavorite || p.implemented;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Procedure Library & Guided Note
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select an emergency procedure to launch structured clinical documentation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search procedures by name, system, or keyword (e.g. foley, intubation, slab)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            <button
              onClick={() => { setSelectedCategory("ALL"); setShowMoreProcedures(false); }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                selectedCategory === "ALL" && !searchQuery
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              ⭐ Favorites & Common
            </button>
            {PROCEDURE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setShowMoreProcedures(true); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {categoryIcons[cat]}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Procedures Grid / List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2">
          {filteredProcedures.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No procedures found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredProcedures.map((proc) => {
                const isReady = proc.implemented;
                return (
                  <div
                    key={proc.type}
                    onClick={() => {
                      if (isReady) {
                        onSelectProcedure(proc);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative group flex flex-col justify-between ${
                      isReady
                        ? "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md cursor-pointer"
                        : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {categoryIcons[proc.category]}
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {proc.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {proc.isFavorite && (
                            <span className="text-amber-500" title="Frequent ER Procedure">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                            </span>
                          )}
                          {!isReady && (
                            <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                              Phase 2
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {proc.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {proc.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      {isReady ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                          Open Guided Form <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium italic">
                          Template in preparation
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* "More Procedures" toggle when viewing favorites */}
          {selectedCategory === "ALL" && !searchQuery && (
            <div className="pt-2 text-center">
              <button
                onClick={() => setShowMoreProcedures(!showMoreProcedures)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60"
              >
                {showMoreProcedures ? "Show Less" : "More Procedures (View Full ER Directory)"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>7 Guided Templates Implemented • Strict Clinical Safety Active</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
