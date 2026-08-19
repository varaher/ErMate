const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

// Inside handleApplyExtraction
const toastCode = `
      // Update local state first
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      
      // Show feedback toast
      const toast = document.createElement("div");
      toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4";
      toast.innerHTML = \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied to Case Sheet\`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
`;

code = code.replace(
  /\/\/ Update local state first\n\s*setMessages\(prev => prev\.map\(m => m\.id === msgId \? \{ \.\.\.m, extractionApplied: true \} : m\)\);/g,
  toastCode
);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log("Added toast!");
