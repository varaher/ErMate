const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const newDesktopCard = `          {/* Card 2: Pediatric Dosing (Desktop) */}
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
                Weight-based pediatric medication reference
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400 border-t border-sky-500/10 pt-3">
              <span>Open Dosing</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Voice Scribe Desk */}`;

let parts = code.split('{/* Card 3: Voice Scribe Desk */}');
if(parts.length === 3) {
    code = parts[0] + '{/* Card 3: Voice Scribe Desk */}' + parts[1] + newDesktopCard + parts[2];
    
    // Remove old Card 8 Desktop
    const oldDesktopCardRegex = /\{\/\* Card 8: Pediatric Drug Calculator \(Desktop\) \*\/\}[\s\S]*?<div[\s\S]*?onOpenPediatricCalculator[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
    const oldDesktopCardRegex2 = /\{\/\* Card 8: Pediatric Drug Calculator \(Desktop\) \*\/\}[\s\S]*?Open Calculator[\s\S]*?<\/div>\s*<\/div>/;
    
    if (oldDesktopCardRegex2.test(code)) {
        code = code.replace(oldDesktopCardRegex2, '');
    } else {
        console.log("Could not find old Desktop Card 8 regex match");
    }

    fs.writeFileSync('src/components/DashboardView.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Failed to find Card 3 exactly twice.");
}
