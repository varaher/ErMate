const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const targetStr = `                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Presenting Complaint</label>`;

const replacementStr = `                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">UHID / CR</label>
                    <input
                      type="text"
                      value={currentCase.patient.uhid || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, uhid: val } }));
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Arrival</label>
                    <select
                      value={currentCase.patient.arrivalMode || "Walk-in"}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, arrivalMode: val } }));
                      }}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="Walk-in">Walk-in</option>
                      <option value="Ambulance">Ambulance</option>
                      <option value="Referred">Referred</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Case Type</label>
                  <select
                    value={currentCase.patient.caseType || "Medical"}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setCurrentCase(prev => ({ ...prev, patient: { ...prev.patient, caseType: val } }));
                    }}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Trauma">Trauma</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono font-semibold uppercase mb-1">Presenting Complaint</label>`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
