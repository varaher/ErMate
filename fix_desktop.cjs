const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regexDesktop = /\{\/\* Card 6: iPhone Pocket Mirror \*\/\}\s*<div\s*onClick=\{\(\) => onOpenPocketMirror\(\)\}/;

const dCardScribe = `          {/* Card 3: Voice Scribe Desk */}
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
          </div>\n\n`;

const dCardNewPat = `          {/* Card 1: New Patient Intake */}
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
          </div>\n\n`;

const dCardHandover = `          {/* Card 4: Shift Handover */}
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
          </div>\n\n`;

code = code.replace(regexDesktop, dCardScribe + dCardNewPat + dCardHandover + "{/* Card 6: iPhone Pocket Mirror */}\n          <div \n            onClick={() => onOpenPocketMirror()}");
fs.writeFileSync('src/components/DashboardView.tsx', code);
console.log("Desktop cards restored in correct order!");
