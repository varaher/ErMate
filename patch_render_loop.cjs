const fs = require('fs');
let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const oldRender = `              filteredCases.map((c, idx) => {
                const cProcs = getCaseProcedures(c);
                const triageColor = c.patient.triageCategory === TriageCategory.P1 
                  ? "border-l-rose-500 text-rose-500 dark:text-rose-400 bg-rose-50/5 dark:bg-rose-500/5" 
                  : c.patient.triageCategory === TriageCategory.P2 
                   ? "border-l-amber-500 text-amber-500 dark:text-amber-400 bg-amber-50/5 dark:bg-amber-500/5" 
                   : "border-l-emerald-500 text-emerald-500 dark:text-emerald-400 bg-emerald-50/5 dark:bg-emerald-500/5";
                const triageLabel = c.patient.triageCategory === TriageCategory.P1 ? "P1 (CRITICAL)" : c.patient.triageCategory === TriageCategory.P2 ? "P2 (URGENT)" : "P3 (STABLE)";

                return (
                  <div 
                    key={\`\${c.id}-\${idx}\`} 
                    className={\`border-l-4 rounded-r-xl border border-slate-200 dark:border-slate-200 dark:border-slate-800 p-3 space-y-2 \${triageColor}\`}
                  >
                    {/* Card Header row */}
                    <div className="flex justify-between items-start gap-1">
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-800 dark:text-slate-800 dark:text-slate-200 text-xs font-bold font-sans">
                            {c.patient.name}
                          </strong>
                          <span className="text-[9px] text-slate-400 font-sans font-medium">
                            ({c.patient.age} / {c.patient.gender})
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">
                          UHID: <span className="font-bold">{c.patient.uhid || "N/A"}</span> • Bed: <span className="font-bold">{c.bedNo || "N/A"}</span>
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-sans">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border border-current bg-current/10">
                          {triageLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {c.savedTime ? new Date(c.savedTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Diagnosis & Complaints */}
                    <div className="bg-white/40 dark:bg-[#131b26] p-2 rounded-lg border border-slate-200/50 dark:border-slate-200 dark:border-slate-800/50 space-y-1">
                      <div className="text-[10.5px]">
                        <span className="text-slate-400">Diagnosis: </span>
                        <strong className="text-slate-700 dark:text-slate-700 dark:text-slate-300">
                          {c.provisionalPrimaryDiagnosis || "Under Evaluation"}
                        </strong>
                      </div>
                      <div className="text-[10.5px]">
                        <span className="text-slate-400">Complaint: </span>
                        <span className="text-slate-600 dark:text-slate-600 dark:text-slate-400">
                          {c.patient.presentingComplaint || "Not recorded"}
                        </span>
                      </div>
                    </div>

                    {/* Procedures list */}
                    {cProcs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {cProcs.map((proc, pIdx) => (
                          <span key={pIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-600 dark:text-slate-300 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-200 dark:border-slate-700">
                            {proc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>`;

const newRender = `              filteredCases.map((c, idx) => {
                const cProcs = c.procedures || [];
                const isP1 = c.triageCategory?.includes("P1");
                const isP2 = c.triageCategory?.includes("P2");
                const triageColor = isP1
                  ? "border-l-rose-500 text-rose-500 dark:text-rose-400 bg-rose-50/5 dark:bg-rose-500/5" 
                  : isP2
                   ? "border-l-amber-500 text-amber-500 dark:text-amber-400 bg-amber-50/5 dark:bg-amber-500/5" 
                   : "border-l-emerald-500 text-emerald-500 dark:text-emerald-400 bg-emerald-50/5 dark:bg-emerald-500/5";
                const triageLabel = isP1 ? "P1 (CRITICAL)" : isP2 ? "P2 (URGENT)" : "P3 (STABLE)";

                return (
                  <div 
                    key={\`\${c.id}-\${idx}\`} 
                    className={\`border-l-4 rounded-r-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 \${triageColor}\`}
                  >
                    {/* Card Header row */}
                    <div className="flex justify-between items-start gap-1">
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-slate-800 dark:text-slate-200 text-xs font-bold font-sans">
                            {c.caseCategory || "General Case"}
                          </strong>
                          <span className="text-[9px] text-slate-400 font-sans font-medium">
                            ({c.ageGroup || "Adult"} / {c.gender || "Unknown"})
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 block mt-0.5">
                          Hospital: <span className="font-bold">{c.hospitalNameAtTime || "Independent"}</span>
                          {c.isSnapshot && <span className="ml-2 text-indigo-400 font-bold">✓ Verified Snapshot</span>}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-sans">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase border border-current bg-current/10">
                          {triageLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {c.dateSeen ? new Date(c.dateSeen).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Procedures list */}
                    {cProcs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cProcs.map((proc, pIdx) => (
                          <span key={pIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-700 capitalize">
                            {proc.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>`;

content = content.replace(oldRender, newRender);
fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
