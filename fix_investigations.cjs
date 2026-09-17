const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const startMarker = `          {/* Investigations (Labs & Imaging) Tab  */}`;
const endMarker = `          {/* Treatment Logs & Resuscitation Dosages Tab with IPSG Drug Double-Checks  */}`;

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers.");
  process.exit(1);
}

const replacement = `          {/* Investigations (Labs & Imaging) Tab  */}
          {activeTab === "investigations" && (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">Investigations & Results</h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-mono font-bold">OCR Sync Ready</span>
              </div>

              {/* === ORDERED SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 mb-2">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  Orders
                </h4>
                
                <details className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs group">
                  <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
                    <span>Quick Order Sets ▾</span>
                  </summary>
                  <div className="pt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                  {[
                    {
                      name: "ADULT SEIZURE PANEL",
                      desc: "CBC, CRP, LFT, RFT, ELECTROLYTES, UREA, CALCIUM, MAGNESIUM, PHOSPHORUS",
                      color: "from-blue-50 to-indigo-50 border-blue-200 text-blue-700 dark:from-blue-950/20 dark:to-indigo-950/10 dark:border-blue-900 dark:text-blue-300",
                    },
                    {
                      name: "PEDIA MINI PANEL",
                      desc: "CBC, CRP, CREATININE, LFT MINIS, ELECTROLYTES",
                      color: "from-sky-50 to-teal-50 border-sky-200 text-sky-700 dark:from-sky-950/20 dark:to-teal-950/10 dark:border-sky-900 dark:text-sky-300",
                    },
                    {
                      name: "PA PANEL PEDIATRICS SURGERY",
                      desc: "CBC, CRP, RFT, HIV ANTIGEN/ANTIBODY, HBSAG, ANTI HCV, LFT MINI",
                      color: "from-amber-50 to-orange-50 border-amber-200 text-amber-700 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-900 dark:text-amber-300",
                    },
                    {
                      name: "PEDIATRIC FEBRILE SEIZURE PANEL",
                      desc: "CBC, CRP, RFT, LFT, ELECTROLYTES, UREA, CALCIUM, PHOSPHORUS, MAGNESIUM, ESR, BLOOD CS",
                      color: "from-purple-50 to-pink-50 border-purple-200 text-purple-700 dark:from-purple-950/20 dark:to-pink-950/10 dark:border-purple-900 dark:text-purple-300",
                    }
                  ].map((panel) => (
                    <button
                      key={panel.name}
                      type="button"
                      onClick={() => handleOrderPanel(panel.name)}
                      className="p-2 text-left rounded-lg border border-slate-200 dark:border-slate-850 bg-gradient-to-br transition-all hover:scale-[1.01] hover:shadow-xs flex flex-col justify-between h-full group"
                    >
                      <div>
                        <span className="font-bold text-[10px] block uppercase tracking-wider text-slate-800 dark:text-slate-200">{panel.name}</span>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 leading-tight">{panel.desc}</p>
                      </div>
                      <span className="text-[8px] font-bold uppercase mt-1 bg-blue-50 dark:bg-slate-850 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded self-start border border-blue-200 dark:border-blue-900 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                        + Auto-Order
                      </span>
                    </button>
                  ))}
                  </div>
                </details>

                {currentCase.investigationsOrdered && currentCase.investigationsOrdered.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Ordered Checklist</span>
                      <span className="text-[9px] font-mono font-bold bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">{currentCase.investigationsOrdered.length} items</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {currentCase.investigationsOrdered.map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={inv.status === "COMPLETED"}
                              onChange={() => {
                                const updated = [...(currentCase.investigationsOrdered || [])];
                                updated[idx] = {
                                  ...updated[idx],
                                  status: updated[idx].status === "COMPLETED" ? "ORDERED" : "COMPLETED"
                                };
                                setCurrentCase(prev => ({ ...prev, investigationsOrdered: updated }));
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                            />
                            <span className={\`font-semibold text-[11px] \${inv.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}\`}>
                              {inv.name}
                            </span>
                          </div>
                          <span className={\`text-[9px] px-1 py-0.5 rounded font-mono font-bold uppercase \${
                            inv.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }\`}>
                            {inv.status || "ORDERED"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Labs Ordered (Notes)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. CBC, Troponin..."
                      value={currentCase.investigationLabsOrdered || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationLabsOrdered: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Imaging / Radiology (Notes)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. CXR, FAST..."
                      value={currentCase.investigationImaging || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationImaging: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Add Investigation</label>
                    <input
                      type="text"
                      placeholder="e.g. Troponin T"
                      value={newTest}
                      onChange={(e) => setNewTest(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Result (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Pending, Negative"
                      value={newResult}
                      onChange={(e) => setNewResult(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInvestigation}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* === RESULTS SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  Results
                </h4>
                
                {currentCase.investigationResults && currentCase.investigationResults.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[9px]">
                          <th className="p-2">Parameter (Extracted)</th>
                          <th className="p-2">Value</th>
                          <th className="p-2">Ref</th>
                          <th className="p-2 text-right">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-mono text-[10px]">
                        {currentCase.investigationResults.map((res, idx) => {
                          const isAbnormal = res.isAbnormal || res.flag === "HIGH" || res.flag === "LOW" || res.flag === "ABNORMAL";
                          const arrow = res.flag === "HIGH" ? "↑" : res.flag === "LOW" ? "↓" : isAbnormal ? "⚠" : "";
                          return (
                            <tr key={idx} className={\`hover:bg-slate-50/50 dark:hover:bg-slate-900/10 \${isAbnormal ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}\`}>
                              <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{res.name}</td>
                              <td className="p-2 font-bold">
                                <span className={isAbnormal ? "text-rose-600 dark:text-rose-400 flex items-center gap-1 font-black" : "text-slate-700 dark:text-slate-300"}>
                                  {res.value} {arrow && <span className="font-black">{arrow}</span>}
                                </span>
                              </td>
                              <td className="p-2 text-slate-400">{res.referenceRange || "—"}</td>
                              <td className="p-2 text-right">
                                {isAbnormal ? (
                                  <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-1 py-0.5 rounded font-extrabold border border-rose-200 dark:border-rose-900">
                                    {res.flag || "ABNORMAL"} {arrow}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-1 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-900">
                                    NORMAL
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {currentCase.investigations && currentCase.investigations.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[9px]">
                          <th className="p-2">Manual Order Name</th>
                          <th className="p-2">Result / Findings</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                        {currentCase.investigations.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                            <td className="p-2 text-slate-600 dark:text-slate-300">{item.result || <span className="text-slate-400 italic">Pending...</span>}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveInvestigation(item.id)}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-md transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {(!currentCase.investigationResults || currentCase.investigationResults.length === 0) && (!currentCase.investigations || currentCase.investigations.length === 0) && (
                  <div className="text-center p-3 text-slate-400 text-[11px] bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    No results logged yet.
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Results/Findings Summary
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Troponin positive, X-ray clear..."
                    value={currentCase.investigationResultsSummary || ""}
                    onChange={(e) => setCurrentCase(prev => ({ ...prev, investigationResultsSummary: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* === DIAGNOSIS SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Diagnosis / Interpretation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Provisional Primary Diagnosis
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Primary diagnostic impression..."
                      value={currentCase.provisionalPrimaryDiagnosis || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, provisionalPrimaryDiagnosis: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Provisional Differential Diagnoses
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Alternative differentials considered..."
                      value={currentCase.provisionalDifferentialDiagnoses || ""}
                      onChange={(e) => setCurrentCase(prev => ({ ...prev, provisionalDifferentialDiagnoses: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
