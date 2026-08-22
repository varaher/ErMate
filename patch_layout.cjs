const fs = require('fs');
let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf8');

content = content.replace(
  'lg:col-span-7 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-lg overflow-hidden flex flex-col print:border-0 print:shadow-none print:rounded-none print:col-span-12 print:w-full print:p-0 print:m-0',
  'lg:col-span-7 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-lg overflow-hidden print:overflow-visible h-[calc(100vh-140px)] print:h-auto flex flex-col print:border-0 print:shadow-none print:rounded-none print:col-span-12 print:w-full print:p-0 print:m-0'
);

content = content.replace(
  'p-8 md:p-10 font-sans leading-relaxed text-[12px] text-slate-900 bg-white space-y-4 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full print:text-[12px] whitespace-pre-wrap',
  'flex-1 overflow-y-auto p-8 md:p-10 font-sans leading-relaxed text-[12px] text-slate-900 bg-white space-y-4 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full print:text-[12px] whitespace-pre-wrap'
);

fs.writeFileSync('src/components/DischargeSummaryView.tsx', content, 'utf8');
