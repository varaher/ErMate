import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

replacement = """          {/* Patient Demographics & Disposition Tab (Accreditation Level)  */}
          {activeTab === "disposition" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>

              {currentCase.isPediatric ? (
                <PediatricDispositionSection
                  state={{
                    provisionalDiagnosis: currentCase.pediatricDetails?.dispositionProvisionalDiagnosis || "",
                    conditionAtShift: currentCase.pediatricDetails?.dispositionConditionAtShift || "",
                    dispositionType: currentCase.disposition?.dispositionType || "Ward",
                    differentialDiagnosis: currentCase.differentials ? currentCase.differentials.map((d: any) => d.diagnosis).join(", ") : "",
                    emResident: currentCase.pediatricDetails?.dispositionEmResident || currentCase.treatingERPhysician || "",
                    emConsultant: currentCase.pediatricDetails?.dispositionEmConsultant || ""
                  }}
                  onChange={s => setCurrentCase(prev => ({
                    ...prev,
                    pediatricDetails: {
                      ...(prev.pediatricDetails || {}),
                      dispositionProvisionalDiagnosis: s.provisionalDiagnosis,
                      dispositionConditionAtShift: s.conditionAtShift,
                      dispositionEmResident: s.emResident,
                      dispositionEmConsultant: s.emConsultant
                    },
                    disposition: {
                      ...(prev.disposition || { recommendedSpecialty: "", estimatedStayHrs: 0, dispositionType: "Ward" }),
                      dispositionType: s.dispositionType as any
                    }
                  }))}
                />
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 mb-6">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-emerald-500" />
                    Clinical Disposition & Action Plan
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Decision Status</label>
                      <select
                        value={currentCase.disposition?.dispositionType || "Ward"}
                        onChange={(e) => setCurrentCase(prev => ({ 
                          ...prev, 
                          disposition: { 
                            ...prev.disposition, 
                            recommendedSpecialty: prev.disposition?.recommendedSpecialty || "",
                            estimatedStayHrs: prev.disposition?.estimatedStayHrs || 0,
                            dispositionType: e.target.value as any 
                          } 
                        }))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="ICU">Admit to Intensive Care Unit (ICU)</option>
                        <option value="Ward">Admit to General Ward</option>
                        <option value="Room">Admit to Private Room</option>
                        <option value="Referral">Transfer / Referral to Higher Center</option>
                        <option value="DAMA">Discharge Against Medical Advice (DAMA/LAMA)</option>
                        <option value="Home">Discharge to Home</option>
                      </select>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Consulting Specialty</label>
                      <input 
                        type="text" 
                        value={currentCase.disposition?.recommendedSpecialty || ""}
                        onChange={(e) => setCurrentCase(prev => ({ 
                          ...prev, 
                          disposition: { 
                            ...prev.disposition,
                            dispositionType: prev.disposition?.dispositionType || "Ward",
                            estimatedStayHrs: prev.disposition?.estimatedStayHrs || 0,
                            recommendedSpecialty: e.target.value 
                          } 
                        }))}
                        placeholder="e.g., Cardiology, General Surgery..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  Demographics & Registration Details
                </h3>"""

text = re.sub(r'          \{/\* Patient Demographics & Disposition Tab \(Accreditation Level\)  \*/\}\n          \{activeTab === "disposition" && \(\n            <div className="space-y-6">\n              <div className="flex justify-end mb-2"><SaveSectionButton onSave=\{handleSave\} /></div>\n\n              <div>\n                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1\.5">\n                  <User className="w-4 h-4 text-blue-500" />\n                  Demographics & Registration Details\n                </h3>', replacement, text)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

