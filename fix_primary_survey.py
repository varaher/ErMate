import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

replacement = """              {currentCase.isPediatric ? (
                <div className="space-y-4">
                  <PediatricAirwaySection
                    state={{
                      cry: currentCase.pediatricDetails?.airwayCry || "",
                      airwayStatus: currentCase.pediatricDetails?.airwayStatus || "",
                      intervention: currentCase.pediatricDetails?.airwayIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        airwayCry: s.cry as any,
                        airwayStatus: s.airwayStatus as any,
                        airwayIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricBreathingSection
                    state={{
                      rr: currentCase.pediatricDetails?.breathingRr || "",
                      spo2: currentCase.pediatricDetails?.breathingSpo2 || "",
                      wobFindings: currentCase.pediatricDetails?.breathingWob ? currentCase.pediatricDetails.breathingWob.split(",").filter(Boolean) : [],
                      abnormalPositioning: currentCase.pediatricDetails?.breathingAbnormalPositioning ? [currentCase.pediatricDetails.breathingAbnormalPositioning] : [],
                      airEntry: currentCase.pediatricDetails?.breathingAirEntry || "",
                      subcutaneousEmphysema: currentCase.pediatricDetails?.breathingSubcutaneousEmphysema || "",
                      intervention: currentCase.pediatricDetails?.breathingIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        breathingRr: s.rr,
                        breathingSpo2: s.spo2,
                        breathingWob: s.wobFindings.join(","),
                        breathingAbnormalPositioning: s.abnormalPositioning[0] as any || "",
                        breathingAirEntry: s.airEntry as any,
                        breathingSubcutaneousEmphysema: s.subcutaneousEmphysema as any,
                        breathingIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricCirculationSection
                    state={{
                      crt: currentCase.pediatricDetails?.circulationCrt || "",
                      hr: currentCase.pediatricDetails?.circulationHr || "",
                      bp: currentCase.pediatricDetails?.circulationBp || "",
                      skinColorTemp: currentCase.pediatricDetails?.circulationSkinColorTemp || "",
                      distendedNeckVeins: currentCase.pediatricDetails?.circulationDistendedNeckVeins || "",
                      intervention: currentCase.pediatricDetails?.circulationIntervention || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        circulationCrt: s.crt as any,
                        circulationHr: s.hr,
                        circulationBp: s.bp,
                        circulationSkinColorTemp: s.skinColorTemp,
                        circulationDistendedNeckVeins: s.distendedNeckVeins as any,
                        circulationIntervention: s.intervention
                      }
                    }))}
                  />
                  <PediatricDisabilitySection
                    state={{
                      avpuGcs: currentCase.pediatricDetails?.disabilityAvpuGcs || "",
                      pupils: currentCase.pediatricDetails?.disabilityPupils || "",
                      abnormalResponses: currentCase.pediatricDetails?.disabilityAbnormalResponses || "",
                      grbs: currentCase.pediatricDetails?.disabilityGrbs || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        disabilityAvpuGcs: s.avpuGcs,
                        disabilityPupils: s.pupils,
                        disabilityAbnormalResponses: s.abnormalResponses,
                        disabilityGrbs: s.grbs
                      }
                    }))}
                  />
                  <PediatricExposureSection
                    state={{
                      temperature: currentCase.pediatricDetails?.exposureTemp || "",
                      traumaLogroll: currentCase.pediatricDetails?.exposureTraumaLogroll || "",
                      signsOfTrauma: currentCase.pediatricDetails?.exposureSignsOfTrauma ? currentCase.pediatricDetails.exposureSignsOfTrauma.split(",").filter(Boolean) : [],
                      infectionBleedingEvidence: currentCase.pediatricDetails?.exposureEvidenceInfectionBleeding || "",
                      longBoneDeformities: currentCase.pediatricDetails?.exposureLongBoneDeformities || "",
                      extremitiesFindings: currentCase.pediatricDetails?.exposureExtremitiesCheck || "",
                      extremitiesImmobilized: currentCase.pediatricDetails?.exposureImmobilizeInjuredLimbs || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        exposureTemp: s.temperature,
                        exposureTraumaLogroll: s.traumaLogroll,
                        exposureSignsOfTrauma: s.signsOfTrauma.join(","),
                        exposureEvidenceInfectionBleeding: s.infectionBleedingEvidence,
                        exposureLongBoneDeformities: s.longBoneDeformities as any,
                        exposureExtremitiesCheck: s.extremitiesFindings,
                        exposureImmobilizeInjuredLimbs: s.extremitiesImmobilized as any
                      }
                    }))}
                  />
                  <PediatricEfastSection
                    state={{
                      heart: currentCase.pediatricDetails?.adjuvantEfastHeart || "",
                      abdomen: currentCase.pediatricDetails?.adjuvantEfastAbdomen || "",
                      lungs: currentCase.pediatricDetails?.adjuvantEfastLungs || "",
                      pelvis: currentCase.pediatricDetails?.adjuvantEfastPelvis || "",
                      extremities: currentCase.pediatricDetails?.adjuvantEfastExtremities || ""
                    }}
                    onChange={s => setCurrentCase(prev => ({
                      ...prev,
                      pediatricDetails: {
                        ...(prev.pediatricDetails || {}),
                        adjuvantEfastHeart: s.heart,
                        adjuvantEfastAbdomen: s.abdomen,
                        adjuvantEfastLungs: s.lungs,
                        adjuvantEfastPelvis: s.pelvis,
                        adjuvantEfastExtremities: s.extremities
                      }
                    }))}
                  />
                </div>
              ) : (
                <PrimarySurveySection
                  data={currentCase.primaryAssessment?.survey || getInitialPrimarySurvey(currentCase.patient.caseType)}
                  onChange={handleSurveyChange}
                  caseType={currentCase.patient.caseType}
                  onMarkNormal={markPrimarySurveyNormal}
                  onInterpretABG={handleInterpretABG}
                  vitals={currentCase.vitals}
                  onUpdateVitals={updateVitals}
                />
              )}"""

text = re.sub(r'<PrimarySurveySection\n\s*data=\{currentCase\.primaryAssessment\?\.survey \|\| getInitialPrimarySurvey\(currentCase\.patient\.caseType\)\}\n\s*onChange=\{handleSurveyChange\}\n\s*caseType=\{currentCase\.patient\.caseType\}\n\s*onMarkNormal=\{markPrimarySurveyNormal\}\n\s*onInterpretABG=\{handleInterpretABG\}\n\s*vitals=\{currentCase\.vitals\}\n\s*onUpdateVitals=\{updateVitals\}\n\s*/>', replacement, text)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

