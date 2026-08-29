const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const searchString = `            {/* Antigravity Sandbox Button */}
            <button
              onClick={() => setShowAntigravity(true)}
              className="p-1.5 px-2.5 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20 rounded-lg text-fuchsia-600 dark:text-fuchsia-400 transition-all flex items-center gap-1.5 cursor-pointer border border-fuchsia-200/50 dark:border-fuchsia-800/30 font-sans shadow-sm"
              title="Remote AI Sandbox (Antigravity)"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="text-[10px] font-extrabold tracking-tight uppercase">Terminal</span>
            </button>`;

if (content.includes(searchString)) {
  fs.writeFileSync('src/App.tsx', content.replace(searchString, ''));
  console.log('Removed successfully.');
} else {
  console.log('Not found.');
}
