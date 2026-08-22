import React, { useState, useEffect } from "react";
import { ArrowLeft, Sparkles, CheckCircle, Save, RefreshCw, AlertCircle, Printer, ShieldAlert, FileText, Check, AlertTriangle, ListFilter, Copy, Download, ChevronDown, FileCheck, MessageSquare } from "lucide-react";
import { ClinicalCase, DischargeInfo, UserProfile } from "../types";
import VoiceRecorder from "./shared/VoiceRecorder";
import { triggerPrintWithTip } from "../utils/printWithTip";
import { BoundChatModal } from "./BoundChatModal";
import { captureFeedbackCorrection } from "../services/learningClient";

interface DischargeSummaryViewProps {
  currentCase: ClinicalCase;
  onBack: () => void;
  onSaveDischarge: (dischargeInfo: DischargeInfo) => void;
  profile?: UserProfile;
  onDeleteCase?: (caseId: string) => void;
}

type TabType = "admin-vitals" | "clinical-hx" | "primary-assessment" | "secondary-assessment" | "course-plans";

export default function DischargeSummaryView({
  currentCase,
  onBack,
  onSaveDischarge,
  profile
}: DischargeSummaryViewProps) {
  // Prepopulate from case records or existing dischargeInfo
  const [activeTab, setActiveTab] = useState<TabType>("admin-vitals");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [isDiscussModalOpen, setIsDiscussModalOpen] = useState(false);

  // --- Administrative & Demographics ---
  const [uhid, setUhid] = useState(
    currentCase.dischargeInfo?.uhid || currentCase.patient.uhid || ""
  );
  const [broughtBy, setBroughtBy] = useState(
    currentCase.dischargeInfo?.broughtBy || "Self / Relatives"
  );
  const [dischargeDateTime, setDischargeDateTime] = useState(
    currentCase.dischargeInfo?.dischargeDateTime || new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  );
  const [dispositionStatus, setDispositionStatus] = useState<string>(
    currentCase.dischargeInfo?.dispositionStatus || currentCase.dispositionDetails?.dispositionType || "Discharge"
  );
  const [isMlc, setIsMlc] = useState(
    currentCase.dischargeInfo?.isMlc || (currentCase.patient.isMlc ? "Yes" : "No")
  );
  const [mlcNo, setMlcNo] = useState(
    currentCase.dischargeInfo?.mlcNo || currentCase.patient.mlcDetails?.ddEntryNo || "N/A"
  );
  const [allergies, setAllergies] = useState(
    currentCase.dischargeInfo?.allergies || currentCase.sampleHistory?.allergies || "No Known Drug Allergies (NKDA)"
  );

  // --- Arrival Vitals ---
  const [arrivalHr, setArrivalHr] = useState(currentCase.dischargeInfo?.arrivalHr || currentCase.vitals.hr || "N/A");
  const [arrivalBp, setArrivalBp] = useState(currentCase.dischargeInfo?.arrivalBp || currentCase.vitals.bp || "N/A");
  const [arrivalRr, setArrivalRr] = useState(currentCase.dischargeInfo?.arrivalRr || currentCase.vitals.rr || "N/A");
  const [arrivalSpo2, setArrivalSpo2] = useState(currentCase.dischargeInfo?.arrivalSpo2 || currentCase.vitals.spo2 || "N/A");
  const [arrivalGcs, setArrivalGcs] = useState(currentCase.dischargeInfo?.arrivalGcs || currentCase.vitals.gcs || "N/A");
  const [arrivalPainScore, setArrivalPainScore] = useState(currentCase.dischargeInfo?.arrivalPainScore || currentCase.vitals.painScore || "N/A");
  const [arrivalGrbs, setArrivalGrbs] = useState(currentCase.dischargeInfo?.arrivalGrbs || currentCase.vitals.grbs || "N/A");
  const [arrivalTemp, setArrivalTemp] = useState(currentCase.dischargeInfo?.arrivalTemp || currentCase.vitals.temp || "N/A");

  // --- Clinical Complaints & Illness ---
  const [presentingComplaints, setPresentingComplaints] = useState(
    currentCase.dischargeInfo?.presentingComplaints || currentCase.patient.presentingComplaint || ""
  );
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState(
    currentCase.dischargeInfo?.historyOfPresentIllness || currentCase.sampleHistory?.events || currentCase.sampleHistory?.symptoms || ""
  );
  const [pastMedicalHistory, setPastMedicalHistory] = useState(
    currentCase.dischargeInfo?.pastMedicalHistory || currentCase.sampleHistory?.pastHistory || "None recorded"
  );
  const [familyGynaeHistory, setFamilyGynaeHistory] = useState(
    currentCase.dischargeInfo?.familyGynaeHistory || currentCase.sampleHistory?.familyHistory || "None recorded"
  );
  const [lmp, setLmp] = useState(
    currentCase.dischargeInfo?.lmp || (currentCase.patient.gender === "Female" ? "Not Recorded" : "N/A")
  );
  const [generalExamination, setGeneralExamination] = useState(
    currentCase.dischargeInfo?.generalExamination || (currentCase.vitals.hr ? "Patient conscious, oriented, vitals recorded on arrival." : "")
  );

  // --- Primary Assessment (Arrival) ---
  const [primaryAirway, setPrimaryAirway] = useState(
    currentCase.dischargeInfo?.primaryAirway || currentCase.primaryAssessment?.airway || ""
  );
  const [primaryAirwayIntervention, setPrimaryAirwayIntervention] = useState(
    currentCase.dischargeInfo?.primaryAirwayIntervention || ""
  );

  const [primaryBreathing, setPrimaryBreathing] = useState(
    currentCase.dischargeInfo?.primaryBreathing || currentCase.primaryAssessment?.breathing || ""
  );
  const [primaryBreathingWork, setPrimaryBreathingWork] = useState(
    currentCase.dischargeInfo?.primaryBreathingWork || ""
  );
  const [primaryBreathingAirEntry, setPrimaryBreathingAirEntry] = useState(
    currentCase.dischargeInfo?.primaryBreathingAirEntry || ""
  );
  const [primaryBreathingCct, setPrimaryBreathingCct] = useState(
    currentCase.dischargeInfo?.primaryBreathingCct || ""
  );
  const [primaryBreathingSubcut, setPrimaryBreathingSubcut] = useState(
    currentCase.dischargeInfo?.primaryBreathingSubcut || ""
  );
  const [primaryBreathingEfast, setPrimaryBreathingEfast] = useState(
    currentCase.dischargeInfo?.primaryBreathingEfast || ""
  );
  const [primaryBreathingIntervention, setPrimaryBreathingIntervention] = useState(
    currentCase.dischargeInfo?.primaryBreathingIntervention || ""
  );

  const [primaryCirculationCrt, setPrimaryCirculationCrt] = useState(
    currentCase.dischargeInfo?.primaryCirculationCrt || ""
  );
  const [primaryCirculationDnv, setPrimaryCirculationDnv] = useState(
    currentCase.dischargeInfo?.primaryCirculationDnv || ""
  );
  const [primaryCirculationPct, setPrimaryCirculationPct] = useState(
    currentCase.dischargeInfo?.primaryCirculationPct || ""
  );
  const [primaryCirculationDeformity, setPrimaryCirculationDeformity] = useState(
    currentCase.dischargeInfo?.primaryCirculationDeformity || ""
  );
  const [primaryCirculationFast, setPrimaryCirculationFast] = useState(
    currentCase.dischargeInfo?.primaryCirculationFast || ""
  );
  const [primaryCirculationInterventions, setPrimaryCirculationInterventions] = useState(
    currentCase.dischargeInfo?.primaryCirculationInterventions || ""
  );

  const [primaryDisabilityAvpuGcs, setPrimaryDisabilityAvpuGcs] = useState(
    currentCase.dischargeInfo?.primaryDisabilityAvpuGcs || (currentCase.vitals.avpu || currentCase.vitals.gcs ? `${currentCase.vitals.avpu || "Alert"} / GCS ${currentCase.vitals.gcs || "15"}` : "")
  );
  const [primaryDisabilityPupils, setPrimaryDisabilityPupils] = useState(
    currentCase.dischargeInfo?.primaryDisabilityPupils || ""
  );
  const [primaryDisabilityGrbs, setPrimaryDisabilityGrbs] = useState(
    currentCase.dischargeInfo?.primaryDisabilityGrbs || currentCase.vitals.grbs || ""
  );

  const [primaryExposureTemp, setPrimaryExposureTemp] = useState(
    currentCase.dischargeInfo?.primaryExposureTemp || currentCase.vitals.temp || ""
  );
  const [primaryExposureTrauma, setPrimaryExposureTrauma] = useState(
    currentCase.dischargeInfo?.primaryExposureTrauma || ""
  );

  // --- Parse Secondary Assessment ---
  let parsedGeneral = "";
  let parsedCvs = "";
  let parsedRs = "";
  let parsedPa = "";
  let parsedCns = "";
  let parsedExtremities = "";
  if (typeof currentCase.secondaryAssessment === "string") {
    const text = currentCase.secondaryAssessment;
    const regex = /(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:\s*(.*?)(?=(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:|$)/igs;
    let match;
    let foundAny = false;
    while ((match = regex.exec(text)) !== null) {
      foundAny = true;
      const key = match[1].toLowerCase();
      const val = match[2].trim();
      if (key.includes('general')) parsedGeneral = val;
      else if (key.includes('cvs')) parsedCvs = val;
      else if (key.includes('rs') || key.includes('respiratory')) parsedRs = val;
      else if (key.includes('abdomen') || key.includes('pa')) parsedPa = val;
      else if (key.includes('cns')) parsedCns = val;
      else if (key.includes('extremities') || key.includes('local') || key.includes('trauma')) parsedExtremities = val;
    }
    if (!foundAny) {
      parsedGeneral = text;
    }
  }

  // --- Secondary Assessment ---
  const [secondaryPicle, setSecondaryPicle] = useState(
    currentCase.dischargeInfo?.secondaryPicle || parsedGeneral
  );
  const [secondaryChest, setSecondaryChest] = useState(
    currentCase.dischargeInfo?.secondaryChest || parsedRs
  );
  const [secondaryCvs, setSecondaryCvs] = useState(
    currentCase.dischargeInfo?.secondaryCvs || parsedCvs
  );
  const [secondaryPa, setSecondaryPa] = useState(
    currentCase.dischargeInfo?.secondaryPa || parsedPa
  );
  const [secondaryCns, setSecondaryCns] = useState(
    currentCase.dischargeInfo?.secondaryCns || parsedCns
  );
  const [secondaryExtremities, setSecondaryExtremities] = useState(
    currentCase.dischargeInfo?.secondaryExtremities || parsedExtremities
  );

  // --- Course, Investigations, Diagnosis, Medications ---
  const _safeCourseInHospital = (course: any) => {
    if (!course) return "";
    if (typeof course === 'string') return course;
    if (typeof course === 'object') return Object.values(course).filter(v => typeof v === 'string').join("\n\n");
    return String(course);
  };

  const [courseInHospital, setCourseInHospital] = useState(
    _safeCourseInHospital(currentCase.dischargeInfo?.courseInHospital) || currentCase.progressNotes || ""
  );
  const [investigationsResults, setInvestigationsResults] = useState(
    currentCase.dischargeInfo?.investigationsResults || (currentCase.investigations && currentCase.investigations.length > 0 ? currentCase.investigations.map(i => `${i.testName}: ${i.result || "Done"}`).join("\n") : "")
  );
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(
    currentCase.dischargeInfo?.primaryDiagnosis || currentCase.provisionalPrimaryDiagnosis || (currentCase.differentials?.[0]?.diagnosis) || currentCase.patient.presentingComplaint || ""
  );
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState(
    currentCase.dischargeInfo?.secondaryDiagnosis || currentCase.sampleHistory?.pastHistory || ""
  );
  const _safeStringFromMixed = (val: any) => {
    if (!val) return "";
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join("\n");
    if (typeof val === 'object') return Object.values(val).filter(v => typeof v === 'string').join("\n");
    return String(val);
  };

  const [dischargeMedications, setDischargeMedications] = useState(
    _safeStringFromMixed(currentCase.dischargeInfo?.dischargeMedications) || (currentCase.treatments && currentCase.treatments.length > 0 ? currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose || ""} (${t.route || ""}) - ${t.timeGiven || "Given in ER"}`).join("\n") : "")
  );

  // --- Discharge Vitals & Follow-Up ---
  const [dischargeHr, setDischargeHr] = useState(currentCase.dischargeInfo?.dischargeHr || currentCase.dispositionDetails?.dischargeVitals?.hr || "");
  const [dischargeBp, setDischargeBp] = useState(currentCase.dischargeInfo?.dischargeBp || currentCase.dispositionDetails?.dischargeVitals?.bp || "");
  const [dischargeRr, setDischargeRr] = useState(currentCase.dischargeInfo?.dischargeRr || currentCase.dispositionDetails?.dischargeVitals?.rr || "");
  const [dischargeSpo2, setDischargeSpo2] = useState(currentCase.dischargeInfo?.dischargeSpo2 || currentCase.dispositionDetails?.dischargeVitals?.spo2 || "");
  const [dischargeGcs, setDischargeGcs] = useState(currentCase.dischargeInfo?.dischargeGcs || currentCase.dispositionDetails?.dischargeVitals?.gcs || "");
  const [dischargePainScore, setDischargePainScore] = useState(currentCase.dischargeInfo?.dischargePainScore || currentCase.dispositionDetails?.dischargeVitals?.painScore || "");
  const [dischargeGrbs, setDischargeGrbs] = useState(currentCase.dischargeInfo?.dischargeGrbs || currentCase.dispositionDetails?.dischargeVitals?.grbs || "");
  const [dischargeTemp, setDischargeTemp] = useState(currentCase.dischargeInfo?.dischargeTemp || currentCase.dispositionDetails?.dischargeVitals?.temp || "");

  const [dischargeCondition, setDischargeCondition] = useState(
    currentCase.dischargeInfo?.dischargeCondition || currentCase.dischargeInfo?.conditionAtDischarge || ""
  );
  const [followUpPlan, setFollowUpPlan] = useState(
    currentCase.dischargeInfo?.followUpPlan || ""
  );
  const [patientInstructions, setPatientInstructions] = useState(
    currentCase.dischargeInfo?.patientInstructions || "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain."
  );

  // Consultant / Resident Names
  const [emResidentName, setEmResidentName] = useState(
    currentCase.dischargeInfo?.emResidentName || currentCase.dispositionDetails?.residentName || profile?.name || profile?.name || ""
  );
  const [emConsultantName, setEmConsultantName] = useState(
    currentCase.dischargeInfo?.emConsultantName || currentCase.dispositionDetails?.consultantName || ""
  );

  // States for actions
  const [aiDrafted, setAiDrafted] = useState(currentCase.dischargeInfo?.aiDrafted || false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState(false);

  // Safety standards
  const [warfarinCheck, setWarfarinCheck] = useState<"Yes" | "No">("No");
  const [readbackConfirmed, setReadbackConfirmed] = useState(true);
  const [doseDoubleChecked, setDoseDoubleChecked] = useState(true);
  const [redFlagsInstructed, setRedFlagsInstructed] = useState(true);

  const [copiedDischargeText, setCopiedDischargeText] = useState(false);

  const displayHospitalName = (currentCase.hospital || profile?.hospital || "Emergency Care & Trauma Center").toUpperCase();
  const displayHospitalAddress = profile?.hospitalAddress 
    ? `${profile.hospitalAddress}${profile?.state ? `, ${profile.state}` : ''}`
    : (profile?.state ? `Department of Emergency Medicine, ${profile.state}` : "Department of Emergency Medicine & Level 1 Trauma Services");

  const getFormattedDischargeSummaryText = () => {
    const pedInfo = currentCase.isPediatric && currentCase.pediatricDetails ? `
**PEDIATRIC INITIAL ASSESSMENT & HISTORY:**
--------------------------------------------------
- **Weight:** ${currentCase.pediatricDetails.patientWeight ? `${currentCase.pediatricDetails.patientWeight} kg` : "Not recorded"}
- **PAT Appearance (TICLS):** Tone: ${currentCase.pediatricDetails.patAppearanceTone || "N/A"}, Interactivity: ${currentCase.pediatricDetails.patAppearanceInteractivity || "N/A"}, Consolability: ${currentCase.pediatricDetails.patAppearanceConsolability || "N/A"}, Look/Gaze: ${currentCase.pediatricDetails.patAppearanceLookGaze || "N/A"}, Speech/Cry: ${currentCase.pediatricDetails.patAppearanceSpeechCry || "N/A"}
- **PAT Work of Breathing:** ${currentCase.pediatricDetails.patWorkOfBreathing || "Not recorded"}
- **PAT Circulation:** ${currentCase.pediatricDetails.patCirculation || "Not recorded"}
- **Immunization Status:** ${currentCase.pediatricDetails.immunizationHistory || "Not recorded"}
- **Brought By / Informant:** ${currentCase.pediatricDetails.broughtBy || currentCase.pediatricDetails.informant || "Not recorded"}
` : "";

    return `**CLINICAL DISCHARGE SUMMARY & INSTRUCTIONS CARD**
**${displayHospitalName}**
**${displayHospitalAddress}**
--------------------------------------------------
**PATIENT NAME:** ${currentCase.patient.name}
**AGE / GENDER:** ${currentCase.patient.age || "N/A"} Years / ${currentCase.patient.gender}
**UHID / CR NUMBER:** ${uhid}
**MLC RECORD STATUS:** ${isMlc === "Yes" ? `Yes (${mlcNo})` : "No / Non-MedicoLegal"}
**ALLERGIES:** ${allergies || "NKDA"}

**DATE OF ARRIVAL:** ${currentCase.patient.dateOpened || "Immediate on-shift"}
**DATE OF DISCHARGE:** ${dischargeDateTime}
**BROUGHT BY / INFORMANT:** ${broughtBy}
**CASE CATEGORY:** ${currentCase.patient.caseType || "Medical"}
**LAST MENSTRUAL PERIOD:** ${lmp}

**Vitals on Arrival:**
--------------------------------------------------
- **HR / Pulse:** ${arrivalHr ? `${arrivalHr} bpm` : "Not recorded"}
- **Blood Pres.:** ${arrivalBp || "Not recorded"}
- **Resp Rate:** ${arrivalRr ? `${arrivalRr} /min` : "Not recorded"}
- **SpO2 %:** ${arrivalSpo2 ? `${arrivalSpo2}%` : "Not recorded"}
- **GCS Score:** ${arrivalGcs ? `${arrivalGcs}/15` : "Not recorded"}
- **Pain Score:** ${arrivalPainScore ? `${arrivalPainScore}/10` : "Not recorded"}
- **GRBS Glu.:** ${arrivalGrbs ? `${arrivalGrbs} mg/dL` : "Not recorded"}
- **Body Temp:** ${arrivalTemp ? `${arrivalTemp} °F` : "Not recorded"}

**PRESENTING COMPLAINTS:**
${presentingComplaints || "None recorded"}

**HISTORY OF PRESENT ILLNESS:**
${historyOfPresentIllness || "None recorded"}

**PAST MEDICAL / SURGICAL HISTORIES:**
${pastMedicalHistory || "None recorded"}

**FAMILY / GYNAE HISTORY:**
${familyGynaeHistory || "None recorded"} (LMP: ${lmp})
${pedInfo}
**Primary Survey:**
--------------------------------------------------
- **Airway:** ${primaryAirway || "Not documented"} | **Intervention:** ${primaryAirwayIntervention || "Not documented"}
- **Breathing:** ${primaryBreathing || "Not documented"}
  - **Chest Work:** ${primaryBreathingWork || "Not documented"} | **Air Entry:** ${primaryBreathingAirEntry || "Not documented"}
  - **CCT:** ${primaryBreathingCct || "Not documented"} | **Subcut Emphysema:** ${primaryBreathingSubcut || "Not documented"} | **EFAST:** ${primaryBreathingEfast || "Not documented"}
  - **Intervention:** ${primaryBreathingIntervention || "Not documented"}
- **Circulation:**
  - **CRT:** ${primaryCirculationCrt || "Not documented"} | **Dist. Neck Veins:** ${primaryCirculationDnv || "Not documented"}
  - **PCT:** ${primaryCirculationPct || "Not documented"} | **Long Bone Deformity:** ${primaryCirculationDeformity || "Not documented"} | **FAST:** ${primaryCirculationFast || "Not documented"}
  - **Intervention:** ${primaryCirculationInterventions || "Not documented"}
- **Disability:**
  - **AVPU/GCS:** ${primaryDisabilityAvpuGcs || "Not documented"} | **Pupils:** ${primaryDisabilityPupils || "Not documented"} | **GRBS:** ${primaryDisabilityGrbs || "Not documented"}
- **Exposure:**
  - **Temp:** ${primaryExposureTemp ? `${primaryExposureTemp} °F` : "Not documented"} | **Trauma-Logroll:** ${primaryExposureTrauma || "Not documented"}

**Secondary Physical & Systemic Examinations:**
--------------------------------------------------
- **General Exam (P/I/C/C/L/E):** ${secondaryPicle || "Not documented"}
- **Respiratory (CHEST):** ${secondaryChest || "Not documented"}
- **Cardiovascular (CVS):** ${secondaryCvs || "Not documented"}
- **Abdominal / Gastro (P/A):** ${secondaryPa || "Not documented"}
- **Central Nervous System (CNS):** ${secondaryCns || "Not documented"}
- **Musculoskeletal / Extremities:** ${secondaryExtremities || "Not documented"}

**Course in Emergency Ward with Medications & Procedures:**
--------------------------------------------------
${courseInHospital || "Patient evaluated and stabilized in ER."}

**Diagnostic Investigations Performed & Results Summary:**
--------------------------------------------------
${investigationsResults || "No investigations ordered."}

**Diagnosis at Discharge:**
--------------------------------------------------
- **FINAL DIAGNOSIS:** ${primaryDiagnosis || "Under Evaluation"}
- **ASSOCIATED COMORBIDITIES:** ${secondaryDiagnosis || "None recorded"}

**Discharge medications:**
--------------------------------------------------
${dischargeMedications || "No outpatient medications prescribed."}

**Disposition Stats & Decision:**
--------------------------------------------------
- **DISPOSITION MODE:** ${dispositionStatus}
- **PATIENT CONDITION AT DISCHARGE:** ${dischargeCondition || "Not Recorded"}
- **DISCHARGE VITALS:**
  - **HR:** ${dischargeHr ? `${dischargeHr} bpm` : "Not recorded"} | **BP:** ${dischargeBp || "Not recorded"}
  - **RR:** ${dischargeRr ? `${dischargeRr} /min` : "Not recorded"} | **SpO2:** ${dischargeSpo2 ? `${dischargeSpo2}%` : "Not recorded"}
  - **GCS:** ${dischargeGcs ? `${dischargeGcs}/15` : "Not recorded"} | **Pain:** ${dischargePainScore ? `${dischargePainScore}/10` : "Not recorded"}
  - **GRBS:** ${dischargeGrbs ? `${dischargeGrbs} mg/dL` : "Not recorded"} | **Temp:** ${dischargeTemp ? `${dischargeTemp} °F` : "Not recorded"}

**FOLLOW-UP PLAN:**
--------------------------------------------------
${followUpPlan || "None recorded"}

**GENERAL INSTRUCTIONS & SAFE-RETURN WARNINGS:**
--------------------------------------------------
${patientInstructions || "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain."}

**ATTENDING CLINICIANS:**
--------------------------------------------------
**Emergency Medicine Duty Resident:** ${emResidentName || "Not Recorded"}
**Attending EM Consultant:** ${emConsultantName || "Not Recorded"}

🚨 **IN CASE OF EMERGENCY / RE-ACCESS TO TRAUMA SERVICES, CALL ER HOTLINE** 🚨
`;
  };

  const getFormattedDischargeSummaryHtml = () => {
    const pedHtml = currentCase.isPediatric && currentCase.pediatricDetails ? `
<strong>PEDIATRIC INITIAL ASSESSMENT & HISTORY:</strong>
<hr/>
<ul>
  <li><strong>Weight:</strong> ${currentCase.pediatricDetails.patientWeight ? `${currentCase.pediatricDetails.patientWeight} kg` : "Not recorded"}</li>
  <li><strong>PAT Appearance (TICLS):</strong> Tone: ${currentCase.pediatricDetails.patAppearanceTone || "N/A"}, Interactivity: ${currentCase.pediatricDetails.patAppearanceInteractivity || "N/A"}, Consolability: ${currentCase.pediatricDetails.patAppearanceConsolability || "N/A"}, Look/Gaze: ${currentCase.pediatricDetails.patAppearanceLookGaze || "N/A"}, Speech/Cry: ${currentCase.pediatricDetails.patAppearanceSpeechCry || "N/A"}</li>
  <li><strong>PAT Work of Breathing:</strong> ${currentCase.pediatricDetails.patWorkOfBreathing || "Not recorded"}</li>
  <li><strong>PAT Circulation:</strong> ${currentCase.pediatricDetails.patCirculation || "Not recorded"}</li>
  <li><strong>Immunization Status:</strong> ${currentCase.pediatricDetails.immunizationHistory || "Not recorded"}</li>
  <li><strong>Brought By / Informant:</strong> ${currentCase.pediatricDetails.broughtBy || currentCase.pediatricDetails.informant || "Not recorded"}</li>
</ul>
<br/>
` : "";

    return `<h3><strong>CLINICAL DISCHARGE SUMMARY & INSTRUCTIONS CARD</strong></h3>
<h4><strong>${displayHospitalName}</strong></h4>
<h5><strong>${displayHospitalAddress}</strong></h5>
<hr/>
<strong>PATIENT NAME:</strong> ${currentCase.patient.name}<br/>
<strong>AGE / GENDER:</strong> ${currentCase.patient.age || "N/A"} Years / ${currentCase.patient.gender}<br/>
<strong>UHID / CR NUMBER:</strong> ${uhid}<br/>
<strong>MLC RECORD STATUS:</strong> ${isMlc === "Yes" ? `Yes (${mlcNo})` : "No / Non-MedicoLegal"}<br/>
<strong>ALLERGIES:</strong> ${allergies || "NKDA"}<br/>
<br/>
<strong>DATE OF ARRIVAL:</strong> ${currentCase.patient.dateOpened || "Immediate on-shift"}<br/>
<strong>DATE OF DISCHARGE:</strong> ${dischargeDateTime}<br/>
<strong>BROUGHT BY / INFORMANT:</strong> ${broughtBy}<br/>
<strong>CASE CATEGORY:</strong> ${currentCase.patient.caseType || "Medical"}<br/>
<strong>LAST MENSTRUAL PERIOD:</strong> ${lmp}<br/>
<br/>
<strong>Vitals on Arrival:</strong>
<hr/>
<ul>
  <li><strong>HR / Pulse:</strong> ${arrivalHr ? `${arrivalHr} bpm` : "Not recorded"}</li>
  <li><strong>Blood Pres.:</strong> ${arrivalBp || "Not recorded"}</li>
  <li><strong>Resp Rate:</strong> ${arrivalRr ? `${arrivalRr} /min` : "Not recorded"}</li>
  <li><strong>SpO2 %:</strong> ${arrivalSpo2 ? `${arrivalSpo2}%` : "Not recorded"}</li>
  <li><strong>GCS Score:</strong> ${arrivalGcs ? `${arrivalGcs}/15` : "Not recorded"}</li>
  <li><strong>Pain Score:</strong> ${arrivalPainScore ? `${arrivalPainScore}/10` : "Not recorded"}</li>
  <li><strong>GRBS Glu.:</strong> ${arrivalGrbs ? `${arrivalGrbs} mg/dL` : "Not recorded"}</li>
  <li><strong>Body Temp:</strong> ${arrivalTemp ? `${arrivalTemp} °F` : "Not recorded"}</li>
</ul>
<br/>
<strong>PRESENTING COMPLAINTS:</strong><br/>
${presentingComplaints || "None recorded"}<br/>
<br/>
<strong>HISTORY OF PRESENT ILLNESS:</strong><br/>
${historyOfPresentIllness || "None recorded"}<br/>
<br/>
<strong>PAST MEDICAL / SURGICAL HISTORIES:</strong><br/>
${pastMedicalHistory || "None recorded"}<br/>
<br/>
<strong>FAMILY / GYNAE HISTORY:</strong><br/>
${familyGynaeHistory || "None recorded"} (LMP: ${lmp})<br/>
<br/>
${pedHtml}
<strong>Primary Survey:</strong>
<hr/>
<ul>
  <li><strong>Airway:</strong> ${primaryAirway || "Not documented"} | <strong>Intervention:</strong> ${primaryAirwayIntervention || "Not documented"}</li>
  <li><strong>Breathing:</strong> ${primaryBreathing || "Not documented"}
    <ul>
      <li><strong>Chest Work:</strong> ${primaryBreathingWork || "Not documented"} | <strong>Air Entry:</strong> ${primaryBreathingAirEntry || "Not documented"}</li>
      <li><strong>CCT:</strong> ${primaryBreathingCct || "Not documented"} | <strong>Subcut Emphysema:</strong> ${primaryBreathingSubcut || "Not documented"} | <strong>EFAST:</strong> ${primaryBreathingEfast || "Not documented"}</li>
      <li><strong>Intervention:</strong> ${primaryBreathingIntervention || "Not documented"}</li>
    </ul>
  </li>
  <li><strong>Circulation:</strong>
    <ul>
      <li><strong>CRT:</strong> ${primaryCirculationCrt || "Not documented"} | <strong>Dist. Neck Veins:</strong> ${primaryCirculationDnv || "Not documented"}</li>
      <li><strong>PCT:</strong> ${primaryCirculationPct || "Not documented"} | <strong>Long Bone Deformity:</strong> ${primaryCirculationDeformity || "Not documented"} | <strong>FAST:</strong> ${primaryCirculationFast || "Not documented"}</li>
      <li><strong>Intervention:</strong> ${primaryCirculationInterventions || "Not documented"}</li>
    </ul>
  </li>
  <li><strong>Disability:</strong>
    <ul>
      <li><strong>AVPU/GCS:</strong> ${primaryDisabilityAvpuGcs || "Not documented"} | <strong>Pupils:</strong> ${primaryDisabilityPupils || "Not documented"} | <strong>GRBS:</strong> ${primaryDisabilityGrbs || "Not documented"}</li>
    </ul>
  </li>
  <li><strong>Exposure:</strong>
    <ul>
      <li><strong>Temp:</strong> ${primaryExposureTemp ? `${primaryExposureTemp} °F` : "Not documented"} | <strong>Trauma-Logroll:</strong> ${primaryExposureTrauma || "Not documented"}</li>
    </ul>
  </li>
</ul>
<br/>
<strong>Secondary Physical & Systemic Examinations:</strong>
<hr/>
<ul>
  <li><strong>General Exam (P/I/C/C/L/E):</strong> ${secondaryPicle || "Not documented"}</li>
  <li><strong>Respiratory (CHEST):</strong> ${secondaryChest || "Not documented"}</li>
  <li><strong>Cardiovascular (CVS):</strong> ${secondaryCvs || "Not documented"}</li>
  <li><strong>Abdominal / Gastro (P/A):</strong> ${secondaryPa || "Not documented"}</li>
  <li><strong>Central Nervous System (CNS):</strong> ${secondaryCns || "Not documented"}</li>
  <li><strong>Musculoskeletal / Extremities:</strong> ${secondaryExtremities || "Not documented"}</li>
</ul>
<br/>
<strong>Course in Emergency Ward with Medications & Procedures:</strong>
<hr/>
${courseInHospital || "Patient evaluated and stabilized in ER."}<br/>
<br/>
<strong>Diagnostic Investigations Performed & Results Summary:</strong>
<hr/>
${investigationsResults || "No investigations ordered."}<br/>
<br/>
<strong>Diagnosis at Discharge:</strong>
<hr/>
<ul>
  <li><strong>FINAL DIAGNOSIS:</strong> ${primaryDiagnosis || "Under Evaluation"}</li>
  <li><strong>ASSOCIATED COMORBIDITIES:</strong> ${secondaryDiagnosis || "None recorded"}</li>
</ul>
<br/>
<strong>Discharge medications:</strong>
<hr/>
${dischargeMedications || "No outpatient medications prescribed."}<br/>
<br/>
<strong>Disposition Stats & Decision:</strong>
<hr/>
<ul>
  <li><strong>DISPOSITION MODE:</strong> ${dispositionStatus}</li>
  <li><strong>PATIENT CONDITION AT DISCHARGE:</strong> ${dischargeCondition || "Not Recorded"}</li>
  <li><strong>DISCHARGE VITALS:</strong>
    <ul>
      <li><strong>HR:</strong> ${dischargeHr ? `${dischargeHr} bpm` : "Not recorded"} | <strong>BP:</strong> ${dischargeBp || "Not recorded"}</li>
      <li><strong>RR:</strong> ${dischargeRr ? `${dischargeRr} /min` : "Not recorded"} | <strong>SpO2:</strong> ${dischargeSpo2 ? `${dischargeSpo2}%` : "Not recorded"}</li>
      <li><strong>GCS:</strong> ${dischargeGcs ? `${dischargeGcs}/15` : "Not recorded"} | <strong>Pain:</strong> ${dischargePainScore ? `${dischargePainScore}/10` : "Not recorded"}</li>
      <li><strong>GRBS:</strong> ${dischargeGrbs ? `${dischargeGrbs} mg/dL` : "Not recorded"} | <strong>Temp:</strong> ${dischargeTemp ? `${dischargeTemp} °F` : "Not recorded"}</li>
    </ul>
  </li>
</ul>
<br/>
<strong>FOLLOW-UP PLAN:</strong>
<hr/>
${followUpPlan || "None recorded"}<br/>
<br/>
<strong>GENERAL INSTRUCTIONS & SAFE-RETURN WARNINGS:</strong>
<hr/>
${patientInstructions || "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain."}<br/>
<br/>
<strong>ATTENDING CLINICIANS:</strong>
<hr/>
<strong>Emergency Medicine Duty Resident:</strong> ${emResidentName || "Not Recorded"}<br/>
<strong>Attending EM Consultant:</strong> ${emConsultantName || "Not Recorded"}<br/>
<br/>
🚨 <strong>IN CASE OF EMERGENCY / RE-ACCESS TO TRAUMA SERVICES, CALL ER HOTLINE</strong> 🚨
`;
  };

  const handleCopyDischargeSummary = () => {
    const plainText = getFormattedDischargeSummaryText();
    const htmlText = getFormattedDischargeSummaryHtml();

    try {
      if (typeof ClipboardItem !== "undefined") {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([htmlText], { type: "text/html" })
        });
        navigator.clipboard.write([clipboardItem]).then(() => {
          setCopiedDischargeText(true);
          setTimeout(() => setCopiedDischargeText(false), 2000);
        }).catch(err => {
          console.warn("ClipboardItem write failed, using writeText fallback:", err);
          navigator.clipboard.writeText(plainText).then(() => {
            setCopiedDischargeText(true);
            setTimeout(() => setCopiedDischargeText(false), 2000);
          });
        });
      } else {
        navigator.clipboard.writeText(plainText).then(() => {
          setCopiedDischargeText(true);
          setTimeout(() => setCopiedDischargeText(false), 2000);
        });
      }
    } catch (err) {
      console.warn("Clipboard API exception, using writeText fallback:", err);
      navigator.clipboard.writeText(plainText).then(() => {
        setCopiedDischargeText(true);
        setTimeout(() => setCopiedDischargeText(false), 2000);
      });
    }
  };

  const handleDownloadDischargeSummary = () => {
    const text = getFormattedDischargeSummaryText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Discharge_Summary_${currentCase.patient.name.replace(/\s+/g, "_")}_${currentCase.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDischargeSummaryWord = () => {
    // Triggers triggerPrintWithTip() using the print-specific CSS media query,
    // ensuring the downloaded output (Save as PDF) exactly matches the live on-screen preview.
    triggerPrintWithTip();
  };

  // Auto-Draft API integration
  
  
  const handleAiDraft = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai-discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileState: profile?.state,
          hospitalName: profile?.hospital,
          caseData: {
            ...currentCase,
            dispositionDetails: {
              ...currentCase.dispositionDetails,
              dispositionType: dispositionStatus,
              residentName: emResidentName,
              consultantName: emConsultantName
            }
          }
        })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        if (resData.data.primaryDiagnosis) setPrimaryDiagnosis(resData.data.primaryDiagnosis);
        if (resData.data.secondaryDiagnosis) setSecondaryDiagnosis(resData.data.secondaryDiagnosis);
        if (resData.data.conditionAtDischarge) setDischargeCondition(resData.data.conditionAtDischarge);
        if (resData.data.dischargeMedications) setDischargeMedications(_safeStringFromMixed(resData.data.dischargeMedications));
        if (resData.data.followUpPlan) setFollowUpPlan(resData.data.followUpPlan);
        if (resData.data.patientInstructions) setPatientInstructions(resData.data.patientInstructions);
        if (resData.data.courseInHospital) {
          setCourseInHospital(_safeCourseInHospital(resData.data.courseInHospital));
        }
        setAiDrafted(true);

        if (resData.simulated) {
          setAiError("⚠️ AI models were unavailable — this draft was generated from case data using a deterministic template, not AI reasoning. Please review carefully before finalizing.");
        }
      } else {
        setAiError("Failed to generate AI draft. Please try again.");
      }
    } catch (err) {
      console.error("AI Discharge Draft error:", err);
      setAiError("Network error generating AI draft.");
    } finally {
      setAiLoading(false);
    }
  };

  
  // Automatically trigger AI Draft / Course Generation on mount if not already done
  useEffect(() => {
    if (!currentCase.dischargeInfo?.courseInHospital && !aiDrafted && !aiLoading) {
      handleAiDraft();
    }
  }, []);

  const handleSave = () => {
    if (aiDrafted && currentCase?.dischargeInfo) {
      const caseAny = currentCase as any;
      if (currentCase.dischargeInfo.primaryDiagnosis !== primaryDiagnosis) {
        captureFeedbackCorrection("primary_diagnosis", currentCase.dischargeInfo.primaryDiagnosis || "", primaryDiagnosis, caseAny.historyOfPresentIllness || caseAny.presentingComplaint || "", "discharge_summary", profile?.name || "Doctor");
      }
      if (currentCase.dischargeInfo.dischargeMedications !== dischargeMedications) {
        captureFeedbackCorrection("discharge_medications", currentCase.dischargeInfo.dischargeMedications || "", dischargeMedications, caseAny.treatmentInEr || caseAny.treatments || "", "discharge_summary", profile?.name || "Doctor");
      }
    }

    const info: DischargeInfo = {
      primaryDiagnosis,
      secondaryDiagnosis,
      conditionAtDischarge: generalExamination,
      dischargeMedications,
      followUpPlan,
      patientInstructions,
      aiDrafted,
      dischargeDateTime,
      dispositionType: dispositionStatus,
      emResidentName,
      emConsultantName,
      uhid,
      broughtBy,

      // Extra fields mapped to type
      isMlc,
      mlcNo,
      allergies,
      arrivalHr,
      arrivalBp,
      arrivalRr,
      arrivalSpo2,
      arrivalGcs,
      arrivalPainScore,
      arrivalGrbs,
      arrivalTemp,

      presentingComplaints,
      historyOfPresentIllness,
      pastMedicalHistory,
      familyGynaeHistory,
      lmp,
      generalExamination,

      primaryAirway,
      primaryAirwayIntervention,
      primaryBreathing,
      primaryBreathingWork,
      primaryBreathingAirEntry,
      primaryBreathingCct,
      primaryBreathingSubcut,
      primaryBreathingEfast,
      primaryBreathingIntervention,

      primaryCirculationCrt,
      primaryCirculationDnv,
      primaryCirculationPct,
      primaryCirculationDeformity,
      primaryCirculationFast,
      primaryCirculationInterventions,

      primaryDisabilityAvpuGcs,
      primaryDisabilityPupils,
      primaryDisabilityGrbs,

      primaryExposureTemp,
      primaryExposureTrauma,

      secondaryPicle,
      secondaryChest,
      secondaryCvs,
      secondaryPa,
      secondaryCns,
      secondaryExtremities,

      courseInHospital,
      investigationsResults,

      dischargeHr,
      dischargeBp,
      dischargeRr,
      dischargeSpo2,
      dischargeGcs,
      dischargePainScore,
      dischargeGrbs,
      dischargeTemp,
      dischargeCondition,
      dispositionStatus
    };
    onSaveDischarge(info);
    setSaveBanner(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setSaveBanner(false);
    }, 5000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6" id="discharge-summary-container">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            id="back-btn-discharge"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 animate-pulse" />
              Discharge Card Scribe
            </h1>
            <p className="text-xs text-slate-400">
              Generate, audit and print JCI/NABH-compliant emergency discharge summary cards.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {onDeleteCase && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the case for "${currentCase.patient.name}"? This action cannot be undone.`)) {
                  onDeleteCase(currentCase.id);
                  onBack();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold rounded-lg transition-all cursor-pointer"
              title="Delete Case"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDiscussModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
            title="Discuss this discharge summary with ErMate AI"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discuss Discharge</span>
          </button>

          <button
            onClick={handleCopyDischargeSummary}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${
              copiedDischargeText
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-900/50"
            }`}
            title="Copy formatted discharge summary to paste directly into any hospital EMR"
          >
            {copiedDischargeText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedDischargeText ? "Copied EMR Text!" : "Copy to EMR"}
          </button>

          <div className="relative inline-block text-left" id="download-dropdown-discharge-container">
            <div className="inline-flex rounded-lg shadow-xs">
              <button
                type="button"
                onClick={() => triggerPrintWithTip()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-l-lg transition-all"
                title="Download / Save as PDF (Matches on-screen preview exactly)"
              >
                <Download className="w-3.5 h-3.5" />
                Download / Export
              </button>
              <button
                type="button"
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                className="px-2 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-r-lg transition-all border-l border-blue-500"
                title="More export options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {downloadMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 text-xs py-1">
                <button
                  onClick={() => {
                    triggerPrintWithTip();
                    setDownloadMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-bold"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Download PDF (1:1 Preview)
                </button>
                <button
                  onClick={() => {
                    handleDownloadDischargeSummaryWord();
                    setDownloadMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  Print / Save Card
                </button>
                <button
                  onClick={() => {
                    handleDownloadDischargeSummary();
                    setDownloadMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Download Plain Text (.txt)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => triggerPrintWithTip()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all dark:bg-slate-800 dark:text-slate-300"
            id="print-btn-discharge"
          >
            <Printer className="w-4 h-4" />
            Print Case Card
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
            id="save-btn-discharge"
          >
            <Save className="w-4 h-4" />
            Finalize & Save Summary
          </button>
        </div>
      </div>

      {/* Save Confirmed Banner */}
      {saveBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl flex items-center gap-2 text-sm font-semibold no-print">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          Discharge Summary Card permanently finalized and archived. Status changed to DISCHARGED!
        </div>
      )}

      {/* AI Error / Simulated Warning Banner */}
      {aiError && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 p-4 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{aiError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid Layout: left inputs, right print sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Hand Editor Section (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 no-print">
          
          {/* Safety standards checks */}
          <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Safety Standards Compliance Audits
            </h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Anti-coagulants Precaution Check</span>
                  <span className="text-[10px] text-slate-400">INR / bleeding warnings needed?</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {["Yes", "No"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWarfarinCheck(opt as any)}
                      className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        warfarinCheck === opt 
                          ? "bg-rose-600 text-white" 
                          : "bg-slate-100 text-slate-500 dark:bg-slate-900"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readbackConfirmed}
                  onChange={(e) => setReadbackConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold block text-slate-700 dark:text-slate-200">Prescription Orders Read-Back Performed</span>
                  <span className="text-[10px] text-slate-400">Prescriptions read-back and reconciled with the patient.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doseDoubleChecked}
                  onChange={(e) => setDoseDoubleChecked(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold block text-slate-700 dark:text-slate-200">Dosages Double Checked & Metric Standards</span>
                  <span className="text-[10px] text-slate-400">Strict dosage limits and no abbreviations used.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Tab Selection Row */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs overflow-x-auto gap-1">
            <button
              onClick={() => setActiveTab("admin-vitals")}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex-1 ${
                activeTab === "admin-vitals" 
                  ? "bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
              }`}
            >
              Admin & Vitals
            </button>
            <button
              onClick={() => setActiveTab("clinical-hx")}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex-1 ${
                activeTab === "clinical-hx" 
                  ? "bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
              }`}
            >
              Clinical Hx
            </button>
            <button
              onClick={() => setActiveTab("primary-assessment")}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex-1 ${
                activeTab === "primary-assessment" 
                  ? "bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
              }`}
            >
              Primary
            </button>
            <button
              onClick={() => setActiveTab("secondary-assessment")}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex-1 ${
                activeTab === "secondary-assessment" 
                  ? "bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
              }`}
            >
              Secondary
            </button>
            <button
              onClick={() => setActiveTab("course-plans")}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex-1 ${
                activeTab === "course-plans" 
                  ? "bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
              }`}
            >
              Course & Rx
            </button>
          </div>

          {/* Dynamic Tab Body */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            
            {activeTab === "admin-vitals" && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1">Administrative & Demographics</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">UHID / CR Number</label>
                    <input
                      type="text"
                      value={uhid}
                      onChange={(e) => setUhid(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Brought By / Informant</label>
                    <input
                      type="text"
                      value={broughtBy}
                      onChange={(e) => setBroughtBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Is MLC Case?</label>
                    <select
                      value={isMlc}
                      onChange={(e) => setIsMlc(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">MLC Record / DD Entry No.</label>
                    <input
                      type="text"
                      value={mlcNo}
                      onChange={(e) => setMlcNo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      placeholder="e.g. DD No 45B / Police Stn"
                      disabled={isMlc === "No"}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Allergies & Drug Reactions</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-400 font-bold"
                  />
                </div>

                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1 pt-2">Admission Arrival Vitals</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">HR</label>
                    <input type="text" value={arrivalHr} onChange={(e) => setArrivalHr(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">BP</label>
                    <input type="text" value={arrivalBp} onChange={(e) => setArrivalBp(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">RR</label>
                    <input type="text" value={arrivalRr} onChange={(e) => setArrivalRr(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">SpO2</label>
                    <input type="text" value={arrivalSpo2} onChange={(e) => setArrivalSpo2(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">GCS</label>
                    <input type="text" value={arrivalGcs} onChange={(e) => setArrivalGcs(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Pain Score</label>
                    <input type="text" value={arrivalPainScore} onChange={(e) => setArrivalPainScore(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">GRBS</label>
                    <input type="text" value={arrivalGrbs} onChange={(e) => setArrivalGrbs(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Temp (°F)</label>
                    <input type="text" value={arrivalTemp} onChange={(e) => setArrivalTemp(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                </div>

                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1 pt-2">Discharge Vitals & Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Discharge Condition</label>
                    <select
                      value={dischargeCondition}
                      onChange={(e) => setDischargeCondition(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-bold"
                    >
                      <option value="STABLE">STABLE</option>
                      <option value="UNSTABLE">UNSTABLE</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Disposition Decision</label>
                    <select
                      value={dispositionStatus}
                      onChange={(e) => setDispositionStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-bold"
                    >
                      <option value="Normal Discharge">Normal Discharge</option>
                      <option value="Discharge at Request">Discharge at Request</option>
                      <option value="Discharge Against Medical Advice">Discharge Against Medical Advice (DAMA)</option>
                      <option value="Referred">Referred (External Clinic)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">HR</label>
                    <input type="text" value={dischargeHr} onChange={(e) => setDischargeHr(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">BP</label>
                    <input type="text" value={dischargeBp} onChange={(e) => setDischargeBp(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">RR</label>
                    <input type="text" value={dischargeRr} onChange={(e) => setDischargeRr(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">SpO2</label>
                    <input type="text" value={dischargeSpo2} onChange={(e) => setDischargeSpo2(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">GCS</label>
                    <input type="text" value={dischargeGcs} onChange={(e) => setDischargeGcs(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Pain Score</label>
                    <input type="text" value={dischargePainScore} onChange={(e) => setDischargePainScore(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">GRBS</label>
                    <input type="text" value={dischargeGrbs} onChange={(e) => setDischargeGrbs(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Temp (°F)</label>
                    <input type="text" value={dischargeTemp} onChange={(e) => setDischargeTemp(e.target.value)} className="w-full p-1 bg-slate-50 border rounded font-mono" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "clinical-hx" && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1">Presenting Complaints & History</h4>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Presenting Complaints</label>
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setPresentingComplaints(prev => prev ? `${prev} ${txt}` : txt)} />
                  </div>
                  <textarea
                    rows={2}
                    value={presentingComplaints}
                    onChange={(e) => setPresentingComplaints(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">History of Present Illness (HPI)</label>
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setHistoryOfPresentIllness(prev => prev ? `${prev} ${txt}` : txt)} />
                  </div>
                  <textarea
                    rows={3}
                    value={historyOfPresentIllness}
                    onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Past Medical / Surgical History</label>
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setPastMedicalHistory(prev => prev ? `${prev} ${txt}` : txt)} />
                  </div>
                  <textarea
                    rows={2}
                    value={pastMedicalHistory}
                    onChange={(e) => setPastMedicalHistory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Family / Gynae History</label>
                    <input
                      type="text"
                      value={familyGynaeHistory}
                      onChange={(e) => setFamilyGynaeHistory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Last Menstrual Period (LMP)</label>
                    <input
                      type="text"
                      value={lmp}
                      onChange={(e) => setLmp(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">General / Systemic Examination Narrative</label>
                    <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setGeneralExamination(prev => prev ? `${prev} ${txt}` : txt)} />
                  </div>
                  <textarea
                    rows={3}
                    value={generalExamination}
                    onChange={(e) => setGeneralExamination(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>
              </div>
            )}

            {activeTab === "primary-assessment" && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1">Primary Assessment (Arrival Stabilization)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Airway Status</label>
                    <input
                      type="text"
                      value={primaryAirway}
                      onChange={(e) => setPrimaryAirway(e.target.value)}
                      className="w-full p-1 bg-white border rounded font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Airway Intervention</label>
                    <input
                      type="text"
                      value={primaryAirwayIntervention}
                      onChange={(e) => setPrimaryAirwayIntervention(e.target.value)}
                      className="w-full p-1 bg-white border rounded"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border space-y-2">
                  <span className="font-extrabold text-[9px] text-slate-500 uppercase block">Breathing Assessment</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Rate/Pattern</label>
                      <input type="text" value={primaryBreathing} onChange={(e) => setPrimaryBreathing(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Work of Breathing</label>
                      <input type="text" value={primaryBreathingWork} onChange={(e) => setPrimaryBreathingWork(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Air Entry</label>
                      <input type="text" value={primaryBreathingAirEntry} onChange={(e) => setPrimaryBreathingAirEntry(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">CCT (Chest Compression)</label>
                      <input type="text" value={primaryBreathingCct} onChange={(e) => setPrimaryBreathingCct(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Subcutaneous Emphysema</label>
                      <input type="text" value={primaryBreathingSubcut} onChange={(e) => setPrimaryBreathingSubcut(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">EFAST (Lungs)</label>
                      <input type="text" value={primaryBreathingEfast} onChange={(e) => setPrimaryBreathingEfast(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Breathing Intervention</label>
                    <input type="text" value={primaryBreathingIntervention} onChange={(e) => setPrimaryBreathingIntervention(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border space-y-2">
                  <span className="font-extrabold text-[9px] text-slate-500 uppercase block">Circulation Assessment</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Capillary Refill (CRT)</label>
                      <input type="text" value={primaryCirculationCrt} onChange={(e) => setPrimaryCirculationCrt(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Distended Neck Veins</label>
                      <input type="text" value={primaryCirculationDnv} onChange={(e) => setPrimaryCirculationDnv(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">PCT / Skin perfusion</label>
                      <input type="text" value={primaryCirculationPct} onChange={(e) => setPrimaryCirculationPct(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Long bone Deformity</label>
                      <input type="text" value={primaryCirculationDeformity} onChange={(e) => setPrimaryCirculationDeformity(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">FAST (Abdomen)</label>
                      <input type="text" value={primaryCirculationFast} onChange={(e) => setPrimaryCirculationFast(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Circulation Interventions</label>
                      <input type="text" value={primaryCirculationInterventions} onChange={(e) => setPrimaryCirculationInterventions(e.target.value)} className="w-full p-1 bg-white border rounded" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Disability GCS</label>
                    <input type="text" value={primaryDisabilityAvpuGcs} onChange={(e) => setPrimaryDisabilityAvpuGcs(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Pupils Response</label>
                    <input type="text" value={primaryDisabilityPupils} onChange={(e) => setPrimaryDisabilityPupils(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Exposure GRBS</label>
                    <input type="text" value={primaryDisabilityGrbs} onChange={(e) => setPrimaryDisabilityGrbs(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Exposure Temp (°F)</label>
                    <input type="text" value={primaryExposureTemp} onChange={(e) => setPrimaryExposureTemp(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Trauma Logroll</label>
                    <input type="text" value={primaryExposureTrauma} onChange={(e) => setPrimaryExposureTrauma(e.target.value)} className="w-full p-1 bg-white border rounded" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "secondary-assessment" && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 border-b pb-1">Secondary Systemic Assessment</h4>
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">P/I/C/C/L/E (Pallor, Icterus, Cyanosis, Clubbing, Lymph, Edema)</label>
                  <input
                    type="text"
                    value={secondaryPicle}
                    onChange={(e) => setSecondaryPicle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Respiratory (CHEST)</label>
                    <input
                      type="text"
                      value={secondaryChest}
                      onChange={(e) => setSecondaryChest(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Cardiovascular (CVS)</label>
                    <input
                      type="text"
                      value={secondaryCvs}
                      onChange={(e) => setSecondaryCvs(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Gastrointestinal (P/A)</label>
                    <input
                      type="text"
                      value={secondaryPa}
                      onChange={(e) => setSecondaryPa(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Neurology (CNS)</label>
                    <input
                      type="text"
                      value={secondaryCns}
                      onChange={(e) => setSecondaryCns(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Musculoskeletal / Extremities</label>
                  <input
                    type="text"
                    value={secondaryExtremities}
                    onChange={(e) => setSecondaryExtremities(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>
              </div>
            )}

            {activeTab === "course-plans" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400">Course, Prescriptions & Follow-up</h4>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={handleAiDraft}
                    className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 disabled:bg-slate-100 text-purple-700 text-[10px] font-extrabold rounded border border-purple-200 transition-all flex items-center gap-1 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900"
                  >
                    {aiLoading ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                    )}
                    ErMate Auto-Draft
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Clinical Course in Hospital</label>
                  <textarea
                    rows={3}
                    value={courseInHospital}
                    onChange={(e) => setCourseInHospital(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Diagnostic investigations done & results</label>
                  <textarea
                    rows={3}
                    value={investigationsResults}
                    onChange={(e) => setInvestigationsResults(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Discharge Diagnosis</label>
                    <input
                      type="text"
                      value={primaryDiagnosis}
                      onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg font-bold text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Secondary Diagnoses / Comorbidities</label>
                    <input
                      type="text"
                      value={secondaryDiagnosis}
                      onChange={(e) => setSecondaryDiagnosis(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      placeholder="Hypertension, DM2, etc."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Discharge Prescriptions (Outpatient Medications)</label>
                  <textarea
                    rows={4}
                    value={dischargeMedications}
                    onChange={(e) => setDischargeMedications(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-emerald-200 rounded-lg font-mono font-bold text-emerald-700 dark:text-emerald-400"
                    placeholder="1. Tab. Drug Name 10mg OD x 5 days"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Follow-Up advice & emergency criteria</label>
                  <textarea
                    rows={2}
                    value={followUpPlan}
                    onChange={(e) => setFollowUpPlan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">General Instructions / Safe-Return Warnings</label>
                  <textarea
                    rows={2}
                    value={patientInstructions}
                    onChange={(e) => setPatientInstructions(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Duty ER Resident</label>
                    <input
                      type="text"
                      value={emResidentName}
                      onChange={(e) => setEmResidentName(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase text-[9px]">Attending ER Consultant</label>
                    <input
                      type="text"
                      value={emConsultantName}
                      onChange={(e) => setEmConsultantName(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Live Printable Paper Preview Sheet (7 Cols) */}
        <div className="lg:col-span-7 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-lg overflow-hidden print:overflow-visible h-[calc(100vh-140px)] print:h-auto flex flex-col print:border-0 print:shadow-none print:rounded-none print:col-span-12 print:w-full print:p-0 print:m-0">
          
          {/* Top Banner (No Print) */}
          <div className="bg-slate-100 dark:bg-slate-900 border-b p-3 px-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 no-print">
            <span className="font-extrabold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Printer className="w-4 h-4" /> LIVE PRINTABLE SHIELDED PREVIEW
            </span>
            <span className="font-mono text-[10px]">A4 Clinical Card Formats</span>
          </div>

          {/* Actual Printable Page Wrapper */}
          <div className="flex-1 overflow-y-auto p-8 md:p-10 font-sans leading-relaxed text-[12px] text-slate-900 bg-white space-y-4 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full print:text-[12px] whitespace-pre-wrap" id="print-sheet-content">
  <div className="font-bold mb-4 text-[14px]">Discharge Summary</div>

  <div><span className="font-bold">MLC:</span> {isMlc === "Yes" ? `Yes (${mlcNo})` : "No"}</div>

  <div><span className="font-bold">Allergy :</span> {allergies}</div>

  <div className="font-bold mt-4">Vitals at the time of arrival:</div>
  <div>HR-{arrivalHr} ,BP-{arrivalBp} ,RR-{arrivalRr} ,SpO2-{arrivalSpo2} ,GCS-{arrivalGcs} ,Pain Score-{arrivalPainScore} ,GRBS-{arrivalGrbs} ,Temp-{arrivalTemp}</div>

  <div className="font-bold mt-4">Presenting Complaints:</div>
  <div>{presentingComplaints}</div>

  <div className="font-bold mt-4">History of Present Illness:</div>
  <div>{historyOfPresentIllness}</div>

  <div className="font-bold mt-4">Past Medical/Surgical Histories:</div>
  <div>{pastMedicalHistory}</div>

  <div><span className="font-bold">Family / Gynae History :</span> {familyGynaeHistory}</div>
  <div><span className="font-bold">LMP :</span> {lmp}</div>

  <div className="font-bold mt-4">General Examination / Systemic examination:</div>
  <div>{generalExamination}</div>
  
  <div className="font-bold mt-4">Primary Assessment:</div>
  <div><span className="font-bold">Airway &rarr;</span> {primaryAirway} ,Intervention- {primaryAirwayIntervention}</div>
  <div><span className="font-bold">Breathing &rarr;</span> Work of breathing- {primaryBreathingWork} ,Air entry- {primaryBreathingAirEntry}</div>
  <div><span className="font-bold">Circulation &rarr;</span> CRT- {primaryCirculationCrt} , Distended Neck Veins- {primaryCirculationDnv} , PCT- {primaryCirculationPct}</div>
  <div>Long bone deformity- {primaryCirculationDeformity} ,FAST- {primaryCirculationFast} ,Interventions- {primaryCirculationInterventions}</div>
  <div><span className="font-bold">Disability &rarr;</span> AVPU/GCS- {primaryDisabilityAvpuGcs} ,Pupils- {primaryDisabilityPupils} ,GRBS- {primaryDisabilityGrbs}</div>
  <div><span className="font-bold">Exposure &rarr;</span> Temp- {primaryExposureTemp} | Trauma- {primaryExposureTrauma}</div>

  <div className="font-bold mt-4">Secondary Assesment:</div>
  <div>Pallor Icterus Cyanosis Clubbing Lymphadenopathy Edema : {secondaryPicle}</div>
  <div><span className="font-bold">CHEST-</span> {secondaryChest}</div>
  <div><span className="font-bold">CVS-</span> {secondaryCvs}</div>
  <div><span className="font-bold">P/A-</span> {secondaryPa}</div>
  <div><span className="font-bold">CNS-</span> {secondaryCns}</div>
  <div><span className="font-bold">EXTREMITIES-</span> {secondaryExtremities}</div>

  <div className="font-bold mt-4">Course in Hospital with Medications and Procedure:</div>
  <div>{courseInHospital}</div>
  <div>{dischargeMedications}</div>

  <div className="font-bold mt-4">Investigations:</div>
  <div>{investigationsResults}</div>

  <div className="font-bold mt-4">Condition at time of discharge:</div>
  <div>({dischargeCondition})</div>

  <div className="font-bold mt-4">Vitals at the time of Discharge:</div>
  <div>HR-{dischargeHr} ,BP-{dischargeBp} ,RR-{dischargeRr} ,SpO2-{dischargeSpo2} ,GCS-{dischargeGcs} ,Pain Score-{dischargePainScore} ,GRBS-{dischargeGrbs} ,Temp-{dischargeTemp}</div>

  <div className="font-bold mt-4">Follow-Up Advice:</div>
  <div>{followUpPlan}</div>

  <div className="font-bold mt-4">General Instructions:</div>
  <div>{patientInstructions}</div>

  <div className="mt-8 flex gap-8">
    <div><span className="font-bold">ED Resident:</span> {emResidentName}</div>
    <div><span className="font-bold">ED Consultant:</span> {emConsultantName}</div>
  </div>

  <div className="flex gap-8 mt-2">
    <div><span className="font-bold">Sign and Time:</span> ___________________</div>
    <div><span className="font-bold">Sign and Time:</span> ___________________</div>
  </div>
  
  <div className="mt-2"><span className="font-bold">Date:</span> {new Date().toLocaleDateString([], { dateStyle: 'short' })}</div>

  <div className="mt-8">In case of emergency, contact: 0484-2905100</div>
  <div className="mt-2 font-bold">Hospital Address and Contact Information:</div>
  <div>Chunangamvely, Aluva, Ernakulam, Kerala - 683 112</div>
  <div>Phone: 0484-2905000 / 0484-2905100</div>

  <div className="mt-8 text-[11px] leading-snug">This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a physical copy of this record must be preserved.</div>

</div>

          {/* Bottom Advice Area (No Print) */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 border-t text-xs text-slate-500 leading-relaxed flex items-start gap-1.5 no-print">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Clinician Advice:</span> Use the tabs in the left-hand panel to compile the clinical variables. The live preview automatically formats for printing. Click <strong>Print Case Card</strong> or press <strong>Cmd/Ctrl + P</strong> to launch the printer driver.
            </div>
          </div>

        </div>

      </div>

      {/* Bound Chat Modal */}
      <BoundChatModal
        context={{
          type: 'discharge',
          id: currentCase.id,
          data: {
            patient: currentCase.patient,
            primaryDiagnosis,
            secondaryDiagnosis,
            dischargeMedications,
            followUpPlan,
            courseInHospital,
            investigationsResults,
            dischargeCondition,
            dispositionStatus
          },
          canEdit: true,
          onRecordUpdated: (updatedFields) => {
            if (updatedFields.primaryDiagnosis) setPrimaryDiagnosis(updatedFields.primaryDiagnosis);
            if (updatedFields.dischargeMedications) setDischargeMedications(updatedFields.dischargeMedications);
            if (updatedFields.followUpPlan) setFollowUpPlan(updatedFields.followUpPlan);
            if (updatedFields.courseInHospital) setCourseInHospital(updatedFields.courseInHospital);
          }
        }}
        isOpen={isDiscussModalOpen}
        onClose={() => setIsDiscussModalOpen(false)}
      />

    </div>
  );
}
