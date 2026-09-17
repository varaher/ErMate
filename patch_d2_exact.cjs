const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const topBtn = `            <button
              onClick={() => {
                if (onStartDischargeSummary) {
                  if (!isOnShift) setShowShiftCheckIn(true); else onStartDischargeSummary();
                } else {
                  onNavigateToTab("handover");
                }
              }}
              className={\`flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer \${
                isDarkMode 
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200" 
                  : "bg-white/15 hover:bg-white/25 border-white/20 text-white"
              }\`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-150" />
              Discharge Summary
            </button>`;

const mobileCard = `          {/* Card 2: Discharge Summary Generator (Mobile) */}
          <button 
            onClick={() => {
              if (onStartDischargeSummary) {
                if (!isOnShift) setShowShiftCheckIn(true); else onStartDischargeSummary();
              } else {
                onNavigateToTab("handover");
              }
            }}
            className="flex items-center gap-3 bg-purple-500/10 dark:bg-purple-900/20 border border-purple-500/20 dark:border-purple-500/10 rounded-xl p-3 text-left w-full hover:bg-purple-500/20 active:scale-[0.98] transition-all shrink-0 min-w-[200px]"
          >
            <div className="w-7 h-7 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-purple-500" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300 truncate">Discharge Summary</span>
              <span className="block text-[8px] text-slate-400 font-medium truncate">EMR case dump processor</span>
            </div>
          </button>`;

const desktopCard = `          {/* Card 2: Discharge Summary Generator (Desktop) */}
          <div 
            onClick={() => {
              if (onStartDischargeSummary) {
                if (!isOnShift) setShowShiftCheckIn(true); else onStartDischargeSummary();
              } else {
                onNavigateToTab("handover");
              }
            }}
            className="group relative bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/25 dark:border-purple-500/10 rounded-2xl p-5 hover:border-purple-500 dark:hover:border-purple-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Discharge Summary Generator
                </h3>
                <span className="text-[8px] font-mono text-purple-500 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded uppercase">AI FORMATTER</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste raw EMR notes or case sheet dumps to generate standardized, medico-legal discharge summaries for any hospital.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 border-t border-purple-500/10 pt-3">
              <span>Open Generator</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>`;

if(code.includes(topBtn)) code = code.replace(topBtn, '');
else console.log("topBtn not found");

if(code.includes(mobileCard)) code = code.replace(mobileCard, '');
else console.log("mobileCard not found");

if(code.includes(desktopCard)) code = code.replace(desktopCard, '');
else console.log("desktopCard not found");

fs.writeFileSync('src/components/DashboardView.tsx', code);
