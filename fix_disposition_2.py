import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

pattern = r'\{\/\* Patient Demographics & Disposition Tab \(Accreditation Level\)  \*\/\}\s*\{activeTab === "disposition" && \(\s*<div className="space-y-6">\s*<div className="flex justify-end mb-2"><SaveSectionButton onSave=\{handleSave\} /></div>\s*<div>\s*<h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1\.5">\s*<User className="w-4 h-4 text-blue-500" />\s*Demographics & Registration Details\s*</h3>'

replacement = """{/* Patient Demographics & Disposition Tab (Accreditation Level)  */}
          {activeTab === "disposition" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2"><SaveSectionButton onSave={handleSave} /></div>

              {currentCase.isPediatric && (
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
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  Demographics & Registration Details
                </h3>"""

text = re.sub(pattern, replacement, text)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

