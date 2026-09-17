const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const mobileCard = `          {/* Card 2: Discharge Summary Generator (Mobile) */}
          <button 
            onClick={() => {
              if (onStartDischargeSummary) {
                if (!isOnShift) setShowShiftCheckIn(true); else onStartDischargeSummary();
              } else {
                onNavigateToTab("handover");
              }
            }}
            className="flex flex-col justify-between p-3 bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 rounded-xl text-left hover:bg-purple-500/15 transition-all shadow-xs h-[88px] w-full"
          >
            <div className="w-7 h-7 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-purple-500" />
            </div>
            <div>
              <span className="block font-black text-xs text-slate-800 dark:text-purple-300 truncate">Discharge Summary</span>
              <span className="block text-[8px] text-slate-400 font-medium truncate">EMR case dump processor</span>
            </div>
          </button>`;

if(code.includes(mobileCard)) {
  code = code.replace(mobileCard, '');
  fs.writeFileSync('src/components/DashboardView.tsx', code);
  console.log("mobileCard removed");
} else {
  console.log("mobileCard still not found");
}
