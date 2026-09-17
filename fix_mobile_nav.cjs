const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const target = `            <button
              onClick={() => onOpenPediatricCalculator()}
              className={\`flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer \${`;

const replacement = `            <button
              onClick={() => onOpenPediatricCalculator()}
              className={\`hidden md:flex flex-1 md:flex-none px-3 py-1.5 border font-bold rounded-xl text-[10px] md:text-[11px] transition-all items-center justify-center gap-1.5 cursor-pointer \${`;

if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DashboardView.tsx', code);
  console.log("Hidden on mobile");
} else {
  console.log("Target not found");
}
