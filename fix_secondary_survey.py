import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

replacement = """              {currentCase.isPediatric ? (
                <div className="space-y-4">
                  <PediatricFocusedPhysicalExam
                    state={{
                      heent: currentCase.pediatricDetails?.focusedHeent || "",
                      respiratory: currentCase.pediatricDetails?.focusedRespiratory || "",
                      cardiovascular: currentCase.pediatricDetails?.focusedCardiovascular || "",
                      abdomen: currentCase.pediatricDetails?.focusedAbdomen || "",
                      back: currentCase.pediatricDetails?.focusedBack || "",
                      extremities: currentCase.pediatricDetails?.focusedExtremities || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        focusedHeent: s.heent,
                        focusedRespiratory: s.respiratory,
                        focusedCardiovascular: s.cardiovascular,
                        focusedAbdomen: s.abdomen,
                        focusedBack: s.back,
                        focusedExtremities: s.extremities
                      }
                    }))}
                  />
                  <PediatricGeneralExamSection
                    state={{
                      pallor: currentCase.pediatricDetails?.examHeent?.includes("Pallor") || false,
                      icterus: currentCase.pediatricDetails?.examHeent?.includes("Icterus") || false,
                      cyanosis: currentCase.pediatricDetails?.examHeent?.includes("Cyanosis") || false,
                      clubbing: currentCase.pediatricDetails?.examHeent?.includes("Clubbing") || false,
                      lymphadenopathy: currentCase.pediatricDetails?.examHeent?.includes("Lymphadenopathy") || false,
                      edema: currentCase.pediatricDetails?.examHeent?.includes("Edema") || false
                    }}
                    onChange={s => {
                       const findings = [];
                       if (s.pallor) findings.push("Pallor");
                       if (s.icterus) findings.push("Icterus");
                       if (s.cyanosis) findings.push("Cyanosis");
                       if (s.clubbing) findings.push("Clubbing");
                       if (s.lymphadenopathy) findings.push("Lymphadenopathy");
                       if (s.edema) findings.push("Edema");
                       setCurrentCase(prev => ({
                         ...prev,
                         pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           examHeent: findings.length > 0 ? findings.join(", ") : "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."
                         }
                       }));
                    }}
                  />
                  <PediatricQuickNormalPresets
                    onApply={(section, text) => {
                      setCurrentCase(prev => ({
                        ...prev,
                        pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           ...(section === 'general' ? { examHeent: text } : {}),
                           ...(section === 'heent' ? { focusedHeent: text } : {}),
                           ...(section === 'respiratory' ? { focusedRespiratory: text } : {}),
                           ...(section === 'cardiovascular' ? { focusedCardiovascular: text } : {}),
                           ...(section === 'abdomen' ? { focusedAbdomen: text } : {}),
                           ...(section === 'back' ? { focusedBack: text } : {}),
                           ...(section === 'extremities' ? { focusedExtremities: text } : {})
                        }
                      }));
                    }}
                    onFillAll={() => {
                      setCurrentCase(prev => ({
                        ...prev,
                        pediatricDetails: {
                           ...(prev.pediatricDetails || {}),
                           examHeent: PEDIATRIC_NORMAL_PRESETS.general,
                           focusedHeent: PEDIATRIC_NORMAL_PRESETS.heent,
                           focusedRespiratory: PEDIATRIC_NORMAL_PRESETS.respiratory,
                           focusedCardiovascular: PEDIATRIC_NORMAL_PRESETS.cardiovascular,
                           focusedAbdomen: PEDIATRIC_NORMAL_PRESETS.abdomen,
                           focusedBack: PEDIATRIC_NORMAL_PRESETS.back,
                           focusedExtremities: PEDIATRIC_NORMAL_PRESETS.extremities
                        }
                      }));
                    }}
                  />
                </div>
              ) : (
                <>
                  <SecondarySurveySection
                    secondaryAssessment={currentCase.secondaryAssessment || ""}
                    onChange={(val) => setCurrentCase(prev => ({ ...prev, secondaryAssessment: val }))}
                    onMarkNormal={markSecondarySurveyNormal}
                  />
                  {/* Normal Exam Presets (from user adult normal template)  */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wide">
                      Quick Normal Presets (Adult Normal & Trauma Case Sheet Format)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Click a preset to instantly append standard JCI/NABH-compliant normal findings to the clinical review of systems:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        {
                          label: "Normal CNS",
                          text: "CNS: Higher Mental Functions: Normal, alert and oriented; Cranial Nerves: Intact (I-XII); Sensory System: Normal, intact to light touch, pain, and temperature; Motor System: Normal muscle tone, strength 5/5 in all limbs; Reflexes: Normal deep tendon reflexes (2+), no pathological reflexes; Romberg Sign: Negative; Cerebellar Signs: Normal."
                        },
                        {
                          label: "Normal CVS",
                          text: "CVS: S1 S2 heard, no murmurs, no gallops, peripheral pulses felt equally bilateral."
                        },
                        {
                          label: "Normal Respiratory (RS)",
                          text: "RS: Bilateral normal vesicular breath sounds, chest symmetrical, no added sounds (wheeze/crepitations)."
                        },
                        {
                          label: "Normal P/A (Abdomen)",
                          text: "P/A: Soft, non-tender, non-distended, no organomegaly, bowel sounds present."
                        },
                        {
                          label: "Normal Extremities",
                          text: "Extremities: No clubbing, cyanosis, edema. Normal range of motion, peripheral pulses 2+ and symmetric."
                        },
                        {
                          label: "General Examination",
                          text: "General: Patient is conscious, cooperative, comfortably seated. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema."
                        }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentCase(prev => ({
                              ...prev,
                              secondaryAssessment: (prev.secondaryAssessment || "") + "\n\n" + preset.text
                            }));
                          }}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors"
                        >
                          + {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                           const cns = "CNS: Higher Mental Functions: Normal, alert and oriented; Cranial Nerves: Intact (I-XII); Sensory System: Normal, intact to light touch, pain, and temperature; Motor System: Normal muscle tone, strength 5/5 in all limbs; Reflexes: Normal deep tendon reflexes (2+), no pathological reflexes; Romberg Sign: Negative; Cerebellar Signs: Normal.";
                           const cvs = "CVS: S1 S2 heard, no murmurs, no gallops, peripheral pulses felt equally bilateral.";
                           const rs = "RS: Bilateral normal vesicular breath sounds, chest symmetrical, no added sounds (wheeze/crepitations).";
                           const pa = "P/A: Soft, non-tender, non-distended, no organomegaly, bowel sounds present.";
                           const ext = "Extremities: No clubbing, cyanosis, edema. Normal range of motion, peripheral pulses 2+ and symmetric.";
                           const gen = "General: Patient is conscious, cooperative, comfortably seated. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.";
                           setCurrentCase(prev => ({
                              ...prev,
                              secondaryAssessment: [gen, cns, cvs, rs, pa, ext].join("\n\n")
                           }));
                        }}
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 font-medium rounded transition-colors"
                      >
                        🚀 Fill All Normal Findings
                      </button>
                    </div>
                  </div>
                </>
              )}"""

text = re.sub(r'<SecondarySurveySection\n\s*secondaryAssessment=\{currentCase\.secondaryAssessment \|\| ""\}\n\s*onChange=\{\(val\) => setCurrentCase\(prev => \(\{ \.\.\.prev, secondaryAssessment: val \}\)\)\}\n\s*onMarkNormal=\{markSecondarySurveyNormal\}\n\s*/>.*?</button>\n\s*</div>\n\s*</div>', replacement, text, flags=re.DOTALL)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

