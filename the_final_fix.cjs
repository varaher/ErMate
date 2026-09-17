const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const strStart = '{/* Mobile Minimalist Action Pad (Visible on Mobile only) */}';
const strEnd = '{/* 2. Stats Cards Row */}';

let idxStart = code.indexOf(strStart);
let idxEnd = code.indexOf(strEnd);

if(idxStart === -1 || idxEnd === -1) {
  console.log("Error finding boundaries.");
  process.exit(1);
}

const theGoodCode = `        {/* Mobile Minimalist Action Pad (Visible on Mobile only) */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {/* Card 3: Voice Scribe Desk */}
          <button 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartVoiceScribe(); }}
            className="flex flex-col justify-between p-3 bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 rounded-xl text-left hover:bg-purple-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <Mic className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300">Assistant</span>
              <span className="block text-[8px] text-slate-400 font-medium leading-tight mt-0.5">Scribe in native language or discuss any complex case</span>
            </div>
          </button>

          {/* Card 1: New Patient Intake */}
          <button 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartFullFlow(); }}
            className="flex flex-col justify-between p-3 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-left hover:bg-emerald-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
              <PlusCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-emerald-300">New Patient</span>
              <span className="block text-[8px] text-slate-400 font-medium">AI triage intake</span>
            </div>
          </button>

          {/* Card 4: Shift Handover */}
          <button 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}
            className="flex flex-col justify-between p-3 bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-left hover:bg-indigo-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-indigo-300">Shift Handover</span>
              <span className="block text-[8px] text-slate-400 font-medium">AI SBAR builder</span>
            </div>
          </button>

          {/* Card 2: Pediatric Dosing (Mobile) */}
          <button 
            onClick={() => onOpenPediatricCalculator()}
            className="flex flex-col justify-between p-3 bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/20 rounded-xl text-left hover:bg-sky-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-lg flex items-center justify-center">
              <Calculator className="w-4.5 h-4.5 text-sky-500" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-sky-300 truncate">Pediatric Dosing</span>
              <span className="block text-[8px] text-slate-400 font-medium leading-tight mt-0.5">Weight-based reference</span>
            </div>
          </button>

          {/* Card 5: iPhone Pocket Mirror */}
          <button 
            onClick={() => onOpenPocketMirror()}
            className="col-span-2 flex items-center justify-between p-3 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/20 rounded-xl text-left hover:bg-rose-500/15 transition-all shadow-xs h-[64px] w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <span className="block font-black text-xs text-slate-800 dark:text-rose-300">iPhone Pocket Mirror</span>
                <span className="block text-[8px] text-slate-400 font-medium">Diagnostic eye & throat mirror</span>
              </div>
            </div>
            <span className="text-[8px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">NEW</span>
          </button>

          {/* Card 6: EM Drugs & Procedures (Mobile) */}
          <button 
            onClick={() => onNavigateToTab("emdrugs")}
            className="col-span-2 flex items-center justify-between p-3 bg-red-500/10 dark:bg-red-950/20 border border-red-500/20 rounded-xl text-left hover:bg-red-500/15 transition-all shadow-xs h-[64px] w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <span className="block font-black text-xs text-slate-800 dark:text-red-300">EM Drugs & Procedures</span>
                <span className="block text-[8px] text-slate-400 font-medium">RSI, Sedation, Vents, Lines</span>
              </div>
            </div>
            <span className="text-[8px] font-mono text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded uppercase font-black">CRITICAL</span>
          </button>
        </div>

        {/* Desktop Detailed Grid (Visible on Desktop only) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 3: Voice Scribe Desk */}
          <div 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartVoiceScribe(); }}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-purple-500 dark:hover:border-purple-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <Mic className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Assistant
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Scribe in native language or discuss any complex case.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open Assistant</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 1: New Patient Intake */}
          <div 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartFullFlow(); }}
            className="group relative bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 dark:border-emerald-500/10 rounded-2xl p-5 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <PlusCircle className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                New Patient
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Speak your case — ErMate fills the case sheet. Dynamic triage scaling, voice dictation, and medical codes.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 border-t border-emerald-500/10 pt-3">
              <span>Start Intake Scribe</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Shift Handover */}
          <div 
            onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500 dark:hover:border-indigo-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Shift Handover
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Start a new handover, build AI SBAR cards, or generate printable PDF/Word handover reports for active cases.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Start Handover & Sheets</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 6: iPhone Pocket Mirror */}
          <div 
            onClick={() => onOpenPocketMirror()}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-rose-500 dark:hover:border-rose-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform">
              <Camera className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  iPhone Pocket Mirror
                </h3>
                <span className="text-[8px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">NEW</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Horizontal reflected clinical camera feed. Includes a mm pupil size comparator gauge and Mallampati airway classification checklists.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open Mirror Cam</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 7: EM Drugs & Procedures (Desktop) */}
          <div 
            onClick={() => onNavigateToTab("emdrugs")}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500 dark:hover:border-red-600 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  EM Drugs & Procedures
                </h3>
                <span className="text-[8px] font-mono text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded uppercase">CRITICAL</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                RSI 7 Ps timeline & drug estimators, sedation agent dose calculators, predicted Tidal Volume (lung protective) models, and Seldinger CVC guidelines.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <span>Open EM Reference</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>\n\n      `;

const newCode = code.substring(0, idxStart) + theGoodCode + code.substring(idxEnd);
fs.writeFileSync('src/components/DashboardView.tsx', newCode);
console.log("Success! File structure completely restored and ordered exactly as requested.");
