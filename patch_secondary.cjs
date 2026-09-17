const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const oldPresets = `<div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wide">
                      Quick Normal Presets (Adult Normal & Trauma Case Sheet Format)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Click a preset to instantly append standard JCI/NABH-compliant normal findings to the clinical review of systems:
                    </p>`;

const newPresets = `<details className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs group">
                    <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
                      Normal Presets ▾
                    </summary>
                    <div className="pt-2 space-y-2">
                      <p className="text-[10px] text-slate-500">
                        Click a preset to instantly append normal findings:
                      </p>`;

code = code.replace(oldPresets, newPresets);

const endPresets = `Mark All Normal                      </button>                    </div>                  </div>`;

const newEndPresets = `Mark All Normal                      </button>                    </div>                    </div>                  </details>`;

code = code.replace(endPresets, newEndPresets);

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
