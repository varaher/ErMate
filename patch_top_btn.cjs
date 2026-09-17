const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const topBtn = `            <button
              onClick={() => onOpenPediatricCalculator()}
              className={\`flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer \${
                isDarkMode 
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200" 
                  : "bg-white/15 hover:bg-white/25 border-white/20 text-white"
              }\`}
            >
              <Calculator className="w-3.5 h-3.5 text-slate-150" />
              Pediatric Dosing
            </button>`;

code = code.replace(
  '<button\n              onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}',
  topBtn + '\n            <button\n              onClick={() => { if (!isOnShift) setShowShiftCheckIn(true); else onStartHandoverChat(); }}'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
