const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// The loading UI used in the app
const fallbackUI = `
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest animate-pulse">Loading Module...</span>
          </div>
        }>`;

// Insert the Suspense opening tag after <div className="max-w-7xl mx-auto"> inside <main>
content = content.replace(
  /<main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">\s*<div className="max-w-7xl mx-auto">/,
  `<main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">\n        <div className="max-w-7xl mx-auto">\n${fallbackUI}`
);

// Insert the Suspense closing tag before </main>
content = content.replace(
  /        <\/div>\s*<\/main>/,
  `        </Suspense>\n        </div>\n      </main>`
);

fs.writeFileSync('src/App.tsx', content);
