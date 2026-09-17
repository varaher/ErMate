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
              <span className="block text-[8px] text-slate-400 font-medium leading-tight mt-0.5">Weight-based pediatric medication reference</span>
            </div>
          </button>
`;

// Insert new Mobile Card before Card 3: Voice Scribe Desk
code = code.replace(
  '{/* Card 3: Voice Scribe Desk */}',
  newMobileCard.trim() + '\n\n          {/* Card 3: Voice Scribe Desk */}'
);

// Remove old Mobile Card 7
const oldMobileCardRegex = /\{\/\* Card 7: Pediatric Drug Calculator \(Mobile\) \*\/\}[\s\S]*?<button[\s\S]*?onOpenPediatricCalculator[\s\S]*?<\/button>/;
code = code.replace(oldMobileCardRegex, '');


// --- DESKTOP ---
const newDesktopCard = `
          {/* Card 2: Pediatric Dosing (Desktop) */}
          <div 
            onClick={() => onOpenPediatricCalculator()}
            className="group relative bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/25 dark:border-sky-500/10 rounded-2xl p-5 hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-48"
          >
            <div className="absolute right-4 top-4 p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl group-hover:scale-110 transition-transform">
              <Calculator className="w-5.5 h-5.5" />
            </div>
            
            <div className="space-y-1.5 max-w-[85%]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Pediatric Dosing
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Weight-based pediatric medication reference. Enter weight for immediate calculations across 24 drug categories.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400 border-t border-sky-500/10 pt-3">
              <span>Open Dosing</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
`;

// It seems there are two Card 3s? Let's check which is which. 
// We know Card 3 Mobile was replaced above. 
// We will replace the SECOND occurrence of "{/* Card 3: Voice Scribe Desk */}" for Desktop.

