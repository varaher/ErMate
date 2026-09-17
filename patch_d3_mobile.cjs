const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

// --- MOBILE ---
const newMobileCard = `
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
`;

code = code.replace(
  '{/* Card 3: Voice Scribe Desk */}',
  newMobileCard.trim() + '\n\n          {/* Card 3: Voice Scribe Desk */}'
);

const oldMobileCardRegex = /\{\/\* Card 7: Pediatric Drug Calculator \(Mobile\) \*\/\}[\s\S]*?<button[\s\S]*?onOpenPediatricCalculator[\s\S]*?<\/button>/;
code = code.replace(oldMobileCardRegex, '');

fs.writeFileSync('src/components/DashboardView.tsx', code);
