const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const oldAccordion = `export function AccordionItem({
  title,
  iconLetter,
  iconBgClass,
  iconTextClass,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  iconLetter: string | React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className={\`w-8 h-8 rounded-full text-white font-black text-sm flex items-center justify-center \${iconBgClass}\`}>
            {iconLetter}
          </span>
          <span className={\`font-bold text-base uppercase tracking-wide \${iconTextClass}\`}>
            {title}
          </span>
        </div>
        <ChevronDown className={\`w-5 h-5 text-slate-400 transition-transform \${isOpen ? 'rotate-180' : ''}\`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2">
          {children}
        </div>
      )}
    </div>
  );
}`;

const newAccordion = `export function AccordionItem({
  title,
  summary,
  iconLetter,
  iconBgClass,
  iconTextClass,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  summary?: string;
  iconLetter: string | React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <span className={\`w-7 h-7 md:w-8 md:h-8 rounded-full text-white font-black text-xs md:text-sm flex items-center justify-center shrink-0 \${iconBgClass}\`}>
            {iconLetter}
          </span>
          <div className="flex flex-col md:flex-row md:items-center text-left gap-0.5 md:gap-3 truncate">
            <span className={\`font-bold text-sm md:text-base uppercase tracking-wide shrink-0 \${iconTextClass}\`}>
              {title}
            </span>
            {!isOpen && summary && (
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {summary}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={\`w-4 h-4 md:w-5 md:h-5 text-slate-400 transition-transform shrink-0 ml-2 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>
      {isOpen && (
        <div className="p-3 md:p-4 pt-0 border-t border-slate-100 dark:border-slate-800 mt-1">
          {children}
        </div>
      )}
    </div>
  );
}`;

if(code.includes(oldAccordion)) {
  code = code.replace(oldAccordion, newAccordion);
  fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
  console.log("Accordion updated");
} else {
  console.log("Accordion NOT found");
}
