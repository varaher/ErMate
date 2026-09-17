const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const startMarker = `              {/* Extracted & Prescribed Medications Section (from Voice Scribe AI Extraction)  */}`;
const endMarker = `          {/* Progress Notes Tab  */}`;

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers.");
  process.exit(1);
}

// Find the exact spot to cut before `          {/* Progress Notes Tab  */}`
// Note that `endIndex` points to `          {/* Progress Notes Tab  */}`.
// I need to replace from `startIndex` to `endIndex - space` or `endIndex` exactly.

// Wait, the structure inside `activeTab === "treatment" && (` is:
// <div> (parent container for the tab)
//   ... pediatric stuff ...
//   Extracted & Prescribed Medications Section ...
// </div>

const prefix = code.substring(0, startIndex);
const suffix = code.substring(endIndex);

const replacement = `              {/* === MEDICATIONS SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Medications
                    </h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">
                    {((currentCase.medications && currentCase.medications.length) || (currentCase.sampleHistory.medications ? 1 : 0))} Extracted
                  </span>
                </div>
                
                {/* Extracted from Voice */}
                {currentCase.medications && currentCase.medications.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {currentCase.medications.map((med, idx) => {
                      const medStr = typeof med === "string" 
                        ? med 
                        : \`\${med.drugName} \${med.dose || ""} \${med.route || ""} \${med.frequency || ""}\`.trim();
                      const doseOnly = typeof med === "object" ? med.dose || "Stat" : "Stat";
                      const routeOnly = typeof med === "object" ? med.route || "IV" : "IV";
                      
                      return (
                        <div key={idx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{typeof med === "object" ? med.drugName : medStr}</span>
                              {typeof med === "object" && <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{med.dose || "Stat"} • {med.route || "IV"} • {med.frequency || "Once"}</span>}
                            </div>
                            <span className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-[9px] shrink-0 border border-emerald-200 dark:border-emerald-800">
                              {idx + 1}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newTr: TreatmentItem = {
                                id: \`t-extracted-\${Date.now()}-\${idx}\`,
                                drugName: typeof med === "object" ? med.drugName : medStr,
                                dose: doseOnly,
                                route: routeOnly,
                                timeGiven: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                ipsgVerified: true
                              };
                              if (!currentCase.treatments.some(t => t.drugName.toLowerCase() === (typeof med === "object" ? med.drugName.toLowerCase() : medStr.toLowerCase()))) {
                                setCurrentCase(prev => ({ ...prev, treatments: [...prev.treatments, newTr] }));
                              }
                            }}
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 w-full text-center transition-colors cursor-pointer mt-auto"
                          >
                            + Log to Flowsheet
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 italic py-1 bg-white dark:bg-slate-950 rounded-lg p-2 border border-slate-200 dark:border-slate-800 text-center">
                    {currentCase.sampleHistory.medications ? (
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Outpatient: {currentCase.sampleHistory.medications}
                      </span>
                    ) : (
                      "No medications extracted from voice. Add manually below."
                    )}
                  </div>
                )}
                
                {/* Add Manual Form */}
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-2 items-end mt-2">
                  <div className="md:col-span-1.5">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Drug</label>
                    <input
                      type="text"
                      placeholder="e.g. Adrenaline"
                      value={newDrug}
                      onChange={(e) => setNewDrug(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Dose</label>
                    <input
                      type="text"
                      placeholder="e.g. 0.5mg"
                      value={newDose}
                      onChange={(e) => setNewDose(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Route</label>
                    <select
                      value={newRoute}
                      onChange={(e) => setNewRoute(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="IV">IV</option>
                      <option value="IM">IM</option>
                      <option value="IO">IO</option>
                      <option value="PO">PO</option>
                      <option value="PR">PR</option>
                      <option value="SC">SC</option>
                      <option value="Procedure">Procedure Log</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTreatment}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 h-[28px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log
                  </button>
                </div>

                {/* Treatment Table */}
                {currentCase.treatments && currentCase.treatments.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-2">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[9px]">
                          <th className="p-2">Drug / Intervention</th>
                          <th className="p-2">Dose / Route</th>
                          <th className="p-2">IPSG Check</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                        {deduplicateMeds(currentCase.treatments).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">
                              {item.drugName}
                              <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{item.timeGiven}</span>
                            </td>
                            <td className="p-2">
                              <span className="font-mono text-slate-700 dark:text-slate-200">{item.dose}</span>
                              <span className="mx-1 text-slate-300">•</span>
                              <span className="font-bold text-[10px] text-slate-500">{validateMedRoute(item.drugName, item.route)}</span>
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => toggleIpsgMedicationCheck(item.id)}
                                className={\`text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 transition-all \${
                                  item.ipsgVerified
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                                }\`}
                              >
                                {item.ipsgVerified ? (
                                  <><CheckCircle className="w-2.5 h-2.5" /> Verified</>
                                ) : (
                                  <><AlertTriangle className="w-2.5 h-2.5" /> Pending</>
                                )}
                              </button>
                            </td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteTreatment(item.id)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1 rounded transition-colors"
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
                
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Other / Outpatient Medications Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide any additional notes or outpatient prescriptions..."
                    value={currentCase.otherMedications || ""}
                    onChange={(e) => setCurrentCase(prev => ({ ...prev, otherMedications: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* === INFUSIONS SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    Infusions & IV Fluids Log
                  </h4>
                  {currentCase.infusions && currentCase.infusions.length > 0 && (
                    <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded font-bold font-mono border border-cyan-200 dark:border-cyan-800">
                      {currentCase.infusions.length} Running
                    </span>
                  )}
                </div>
                
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Fluid / Drug Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Normal Saline, RL, Dopamine"
                      value={newInfusionFluid}
                      onChange={(e) => setNewInfusionFluid(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Dose</label>
                    <input
                      type="text"
                      placeholder="e.g. 500 mL, 5 mcg/kg"
                      value={newInfusionDose}
                      onChange={(e) => setNewInfusionDose(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Dilution / Rate</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="In 50ml NS"
                        value={newInfusionDilution}
                        onChange={(e) => setNewInfusionDilution(e.target.value)}
                        className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        placeholder="100 mL/hr"
                        value={newInfusionRate}
                        onChange={(e) => setNewInfusionRate(e.target.value)}
                        className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInfusion}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 h-[28px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log
                  </button>
                </div>
                
                {currentCase.infusions && currentCase.infusions.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[9px]">
                          <th className="p-2">Fluid / Drug</th>
                          <th className="p-2">Dose / Dilution</th>
                          <th className="p-2">Rate</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                        {currentCase.infusions.map((inf) => (
                          <tr key={inf.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <td className="p-2 font-bold text-slate-700 dark:text-slate-200">{inf.fluidName}</td>
                            <td className="p-2">
                              <span className="font-mono">{inf.dose}</span>
                              <span className="mx-1 text-slate-300">•</span>
                              <span className="text-slate-500">{inf.dilution}</span>
                            </td>
                            <td className="p-2 font-mono text-emerald-600 font-bold">{inf.rate}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteInfusion(inf.id)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1 rounded-md transition-colors"
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
              </div>

              {/* === PROCEDURES SECTION === */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Procedures Performed
                  </h4>
                  {currentCase.proceduresChecked && currentCase.proceduresChecked.length > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-bold font-mono border border-amber-200 dark:border-amber-800">
                      {currentCase.proceduresChecked.length} Checked
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                  {/* GU & GI Section  */}
                  <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block border-b pb-0.5 border-indigo-100 dark:border-indigo-900 mb-1">GU / GI</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("foleys") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "foleys"] : list.filter(x => x !== "foleys");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                      /> Foley's Catheter
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("ng_tube") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "ng_tube"] : list.filter(x => x !== "ng_tube");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                      /> NG Tube
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("gastric_lavage") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "gastric_lavage"] : list.filter(x => x !== "gastric_lavage");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                      /> Gastric Lavage
                    </label>
                  </div>
                  
                  {/* Wound Section  */}
                  <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block border-b pb-0.5 border-emerald-100 dark:border-emerald-900 mb-1">Wound</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("suturing") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "suturing"] : list.filter(x => x !== "suturing");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                      /> Suturing/Closure
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("irrigation") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "irrigation"] : list.filter(x => x !== "irrigation");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                      /> Irrigation
                    </label>
                  </div>
                  
                  {/* Ortho Section  */}
                  <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 md:col-span-2 lg:col-span-1">
                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block border-b pb-0.5 border-amber-100 dark:border-amber-900 mb-1">Ortho</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("splinting") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "splinting"] : list.filter(x => x !== "splinting");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3"
                      /> Splinting
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={currentCase.proceduresChecked?.includes("reduction") || false}
                        onChange={(e) => {
                          const list = currentCase.proceduresChecked || [];
                          const updated = e.target.checked ? [...list, "reduction"] : list.filter(x => x !== "reduction");
                          setCurrentCase(prev => ({ ...prev, proceduresChecked: updated }));
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3"
                      /> Joint Reduction
                    </label>
                  </div>
                </div>
                
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Other / Custom Procedures Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Bedside FAST scan, reduction of minor subluxation..."
                    value={currentCase.otherProcedures || ""}
                    onChange={(e) => setCurrentCase(prev => ({ ...prev, otherProcedures: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
`;

fs.writeFileSync('src/components/CaseSheetView.tsx', prefix + replacement + suffix);
