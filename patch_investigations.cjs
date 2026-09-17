const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const oldInvest = `<div className="flex items-center gap-1.5 border-b pb-2 border-slate-150 dark:border-slate-800">
                  <ClipboardCheck className="w-4.5 h-4.5 text-blue-600" />
                  <span className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Standard JCI/NABH Investigation Panels (Auto-Order Sets)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">`;

const newInvest = `<details className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs group mb-4">
                  <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-blue-600" /> Quick Order Sets ▾</div>
                  </summary>
                  <div className="pt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">`;

code = code.replace(oldInvest, newInvest);

const endInvest = `                      </div>
                    ))}
                </div>`;

const newEndInvest = `                      </div>
                    ))}
                </div>
                </details>`;

code = code.replace(endInvest, newEndInvest);

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
