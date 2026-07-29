import React, { useState } from "react";
import { ArrowLeft, Sparkles, CheckCircle, Save, RefreshCw, AlertCircle, Printer, ShieldAlert, FileText, Check, AlertTriangle, ListFilter, Copy, Download, ChevronDown, FileCheck } from "lucide-react";
import { ClinicalCase, DischargeInfo, UserProfile } from "../types";
import SpeechMicButton from "./SpeechMicButton";
import { triggerPrintWithTip } from "../utils/printWithTip";

interface DischargeSummaryViewProps {
  currentCase: ClinicalCase;
  onBack: () => void;
  onSaveDischarge: (dischargeInfo: DischargeInfo) => void;
  profile?: UserProfile;
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

  // --- Secondary Assessment ---
  const [secondaryPicle, setSecondaryPicle] = useState(
    currentCase.dischargeInfo?.secondaryPicle || (typeof currentCase.secondaryAssessment === "string" ? currentCase.secondaryAssessment : "")
  );
  const [secondaryChest, setSecondaryChest] = useState(
    currentCase.dischargeInfo?.secondaryChest || ""
  );
  const [secondaryCvs, setSecondaryCvs] = useState(
    currentCase.dischargeInfo?.secondaryCvs || ""
  );
  const [secondaryPa, setSecondaryPa] = useState(
    currentCase.dischargeInfo?.secondaryPa || ""
  );
  const [secondaryCns, setSecondaryCns] = useState(
    currentCase.dischargeInfo?.secondaryCns || ""
  );
  const [secondaryExtremities, setSecondaryExtremities] = useState(
    currentCase.dischargeInfo?.secondaryExtremities || ""
  );

  // --- Course, Investigations, Diagnosis, Medications ---
  const [courseInHospital, setCourseInHospital] = useState(
    currentCase.dischargeInfo?.courseInHospital || currentCase.progressNotes || `Patient evaluated in ER for ${currentCase.patient.presentingComplaint || "acute presentation"}. Clinical evaluation and stabilization provided.`
  );
  const [investigationsResults, setInvestigationsResults] = useState(
    currentCase.dischargeInfo?.investigationsResults || (currentCase.investigations && currentCase.investigations.length > 0 ? currentCase.investigations.map(i => `${i.testName}: ${i.result || "Done"}`).join("\n") : "No investigations ordered.")
  );
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(
    currentCase.dischargeInfo?.primaryDiagnosis || currentCase.provisionalPrimaryDiagnosis || (currentCase.differentials?.[0]?.diagnosis) || currentCase.patient.presentingComplaint || ""
  );
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState(
    currentCase.dischargeInfo?.secondaryDiagnosis || currentCase.sampleHistory?.pastHistory || ""
  );
  const [dischargeMedications, setDischargeMedications] = useState(
    currentCase.dischargeInfo?.dischargeMedications || (currentCase.treatments && currentCase.treatments.length > 0 ? currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose || ""} (${t.route || ""}) - ${t.timeGiven || "Given in ER"}`).join("\n") : "No outpatient medications prescribed.")
  );

  // --- Discharge Vitals & Follow-Up ---
  const [dischargeHr, setDischargeHr] = useState(currentCase.dischargeInfo?.dischargeHr || currentCase.dispositionDetails?.dischargeVitals?.hr || currentCase.vitals.hr || "");
  const [dischargeBp, setDischargeBp] = useState(currentCase.dischargeInfo?.dischargeBp || currentCase.dispositionDetails?.dischargeVitals?.bp || currentCase.vitals.bp || "");
  const [dischargeRr, setDischargeRr] = useState(currentCase.dischargeInfo?.dischargeRr || currentCase.dispositionDetails?.dischargeVitals?.rr || currentCase.vitals.rr || "");
  const [dischargeSpo2, setDischargeSpo2] = useState(currentCase.dischargeInfo?.dischargeSpo2 || currentCase.dispositionDetails?.dischargeVitals?.spo2 || currentCase.vitals.spo2 || "");
  const [dischargeGcs, setDischargeGcs] = useState(currentCase.dischargeInfo?.dischargeGcs || currentCase.dispositionDetails?.dischargeVitals?.gcs || currentCase.vitals.gcs || "");
  const [dischargePainScore, setDischargePainScore] = useState(currentCase.dischargeInfo?.dischargePainScore || currentCase.vitals.painScore || "");
  const [dischargeGrbs, setDischargeGrbs] = useState(currentCase.dischargeInfo?.dischargeGrbs || currentCase.vitals.grbs || "");
  const [dischargeTemp, setDischargeTemp] = useState(currentCase.dischargeInfo?.dischargeTemp || currentCase.vitals.temp || "");

  const [dischargeCondition, setDischargeCondition] = useState(
    currentCase.dischargeInfo?.dischargeCondition || "Stable at time of discharge"
  );
  const [followUpPlan, setFollowUpPlan] = useState(
    currentCase.dischargeInfo?.followUpPlan || "Review in OPD / Primary care clinic in 3-5 days. Return to emergency department immediately if warning symptoms develop."
  );

  // Consultant / Resident Names
  const [emResidentName, setEmResidentName] = useState(
    currentCase.dischargeInfo?.emResidentName || currentCase.dispositionDetails?.residentName || ""
  );
  const [emConsultantName, setEmConsultantName] = useState(
    currentCase.dischargeInfo?.emConsultantName || currentCase.dispositionDetails?.consultantName || ""
  );

  // States for actions
  const [aiDrafted, setAiDrafted] = useState(currentCase.dischargeInfo?.aiDrafted || false);
  const [aiLoading, setAiLoading] = useState(false);
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
    return `**CLINICAL DISCHARGE SUMMARY & INSTRUCTIONS CARD**
**${displayHospitalName}**
**${displayHospitalAddress}**
--------------------------------------------------
**PATIENT NAME:** ${currentCase.patient.name}
**AGE / GENDER:** ${currentCase.patient.age || "N/A"} Years / ${currentCase.patient.gender}
**UHID / CR NUMBER:** ${uhid}
**MLC RECORD STATUS:** ${isMlc === "Yes" ? `Yes (${mlcNo})` : "No / Non-MedicoLegal"}
**ALLERGIES:** ${allergies}

**DATE OF ARRIVAL:** ${currentCase.patient.dateOpened || "Immediate on-shift"}
**DATE OF DISCHARGE:** ${dischargeDateTime}
**BROUGHT BY / INFORMANT:** ${broughtBy}
**CASE CATEGORY:** ${currentCase.patient.caseType || "Medical"}
**LAST MENSTRUAL PERIOD:** ${lmp}

**Vitals on Arrival:**
--------------------------------------------------
- **HR / Pulse:** ${arrivalHr} bpm
- **Blood Pres.:** ${arrivalBp} mmHg
- **Resp Rate:** ${arrivalRr} /min
- **SpO2 %:** ${arrivalSpo2}%
- **GCS Score:** ${arrivalGcs}/15
- **Pain Score:** ${arrivalPainScore}/10
- **GRBS Glu.:** ${arrivalGrbs} mg/dL
- **Body Temp:** ${arrivalTemp} °F

**PRESENTING COMPLAINTS:**
${presentingComplaints || "None recorded"}

**HISTORY OF PRESENT ILLNESS:**
${historyOfPresentIllness || "None recorded"}

**PAST MEDICAL / SURGICAL HISTORIES:**
${pastMedicalHistory || "None"}

**FAMILY / GYNAE HISTORY:**
${familyGynaeHistory} (LMP: ${lmp})

**Primary Survey:**
--------------------------------------------------
- **Airway:** ${primaryAirway} | **Intervention:** ${primaryAirwayIntervention}
- **Breathing:** ${primaryBreathing}
  - **Chest Work:** ${primaryBreathingWork} | **Air Entry:** ${primaryBreathingAirEntry}
  - **CCT:** ${primaryBreathingCct} | **Subcut Emphysema:** ${primaryBreathingSubcut} | **EFAST:** ${primaryBreathingEfast}
  - **Intervention:** ${primaryBreathingIntervention}
- **Circulation:**
  - **CRT:** ${primaryCirculationCrt} | **Dist. Neck Veins:** ${primaryCirculationDnv}
  - **PCT:** ${primaryCirculationPct} | **Long Bone Deformity:** ${primaryCirculationDeformity} | **FAST:** ${primaryCirculationFast}
  - **Intervention:** ${primaryCirculationInterventions}
- **Disability:**
  - **AVPU/GCS:** ${primaryDisabilityAvpuGcs} | **Pupils:** ${primaryDisabilityPupils} | **GRBS:** ${primaryDisabilityGrbs}
- **Exposure:**
  - **Temp:** ${primaryExposureTemp} °F | **Trauma-Logroll:** ${primaryExposureTrauma}

**Secondary Physical & Systemic Examinations:**
--------------------------------------------------
- **General Exam (P/I/C/C/L/E):** ${secondaryPicle}
- **Respiratory (CHEST):** ${secondaryChest}
- **Cardiovascular (CVS):** ${secondaryCvs}
- **Abdominal / Gastro (P/A):** ${secondaryPa}
- **Central Nervous System (CNS):** ${secondaryCns}
- **Musculoskeletal / Extremities:** ${secondaryExtremities}

**Course in Emergency Ward with Medications & Procedures:**
--------------------------------------------------
${courseInHospital}

**Diagnostic Investigations Performed & Results Summary:**
--------------------------------------------------
${investigationsResults}

**Diagnosis at Discharge:**
--------------------------------------------------
- **FINAL DIAGNOSIS:** ${primaryDiagnosis}
- **ASSOCIATED COMORBIDITIES:** ${secondaryDiagnosis || "None"}

**Discharge medications:**
--------------------------------------------------
${dischargeMedications}

**Disposition Stats & Decision:**
--------------------------------------------------
- **DISPOSITION MODE:** ${dispositionStatus}
- **PATIENT CONDITION AT DISCHARGE:** ${dischargeCondition}
- **DISCHARGE VITALS:**
  - **HR:** ${dischargeHr} bpm | **BP:** ${dischargeBp} mmHg
  - **RR:** ${dischargeRr} /min | **SpO2:** ${dischargeSpo2}%
  - **GCS:** ${dischargeGcs}/15 | **Pain:** ${dischargePainScore}/10
  - **GRBS:** ${dischargeGrbs} mg/dL | **Temp:** ${dischargeTemp} °F

**FOLLOW-UP PLAN & SAFE-RETURN WARNINGS:**
--------------------------------------------------
${followUpPlan}

**ATTENDING CLINICIANS:**
--------------------------------------------------
**Emergency Medicine Duty Resident:** ${emResidentName}
**Attending EM Consultant:** ${emConsultantName}

🚨 **IN CASE OF EMERGENCY / RE-ACCESS TO TRAUMA SERVICES, CALL ER HOTLINE** 🚨
`;
  };

  const getFormattedDischargeSummaryHtml = () => {
    return `<h3><strong>CLINICAL DISCHARGE SUMMARY & INSTRUCTIONS CARD</strong></h3>
<h4><strong>${displayHospitalName}</strong></h4>
<h5><strong>${displayHospitalAddress}</strong></h5>
<hr/>
<strong>PATIENT NAME:</strong> ${currentCase.patient.name}<br/>
<strong>AGE / GENDER:</strong> ${currentCase.patient.age || "N/A"} Years / ${currentCase.patient.gender}<br/>
<strong>UHID / CR NUMBER:</strong> ${uhid}<br/>
<strong>MLC RECORD STATUS:</strong> ${isMlc === "Yes" ? `Yes (${mlcNo})` : "No / Non-MedicoLegal"}<br/>
<strong>ALLERGIES:</strong> ${allergies}<br/>
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
  <li><strong>HR / Pulse:</strong> ${arrivalHr} bpm</li>
  <li><strong>Blood Pres.:</strong> ${arrivalBp} mmHg</li>
  <li><strong>Resp Rate:</strong> ${arrivalRr} /min</li>
  <li><strong>SpO2 %:</strong> ${arrivalSpo2}%</li>
  <li><strong>GCS Score:</strong> ${arrivalGcs}/15</li>
  <li><strong>Pain Score:</strong> ${arrivalPainScore}/10</li>
  <li><strong>GRBS Glu.:</strong> ${arrivalGrbs} mg/dL</li>
  <li><strong>Body Temp:</strong> ${arrivalTemp} °F</li>
</ul>
<br/>
<strong>PRESENTING COMPLAINTS:</strong><br/>
${presentingComplaints || "None recorded"}<br/>
<br/>
<strong>HISTORY OF PRESENT ILLNESS:</strong><br/>
${historyOfPresentIllness || "None recorded"}<br/>
<br/>
<strong>PAST MEDICAL / SURGICAL HISTORIES:</strong><br/>
${pastMedicalHistory || "None"}<br/>
<br/>
<strong>FAMILY / GYNAE HISTORY:</strong><br/>
${familyGynaeHistory} (LMP: ${lmp})<br/>
<br/>
<strong>Primary Survey:</strong>
<hr/>
<ul>
  <li><strong>Airway:</strong> ${primaryAirway} | <strong>Intervention:</strong> ${primaryAirwayIntervention}</li>
  <li><strong>Breathing:</strong> ${primaryBreathing}
    <ul>
      <li><strong>Chest Work:</strong> ${primaryBreathingWork} | <strong>Air Entry:</strong> ${primaryBreathingAirEntry}</li>
      <li><strong>CCT:</strong> ${primaryBreathingCct} | <strong>Subcut Emphysema:</strong> ${primaryBreathingSubcut} | <strong>EFAST:</strong> ${primaryBreathingEfast}</li>
      <li><strong>Intervention:</strong> ${primaryBreathingIntervention}</li>
    </ul>
  </li>
  <li><strong>Circulation:</strong>
    <ul>
      <li><strong>CRT:</strong> ${primaryCirculationCrt} | <strong>Dist. Neck Veins:</strong> ${primaryCirculationDnv}</li>
      <li><strong>PCT:</strong> ${primaryCirculationPct} | <strong>Long Bone Deformity:</strong> ${primaryCirculationDeformity} | <strong>FAST:</strong> ${primaryCirculationFast}</li>
      <li><strong>Intervention:</strong> ${primaryCirculationInterventions}</li>
    </ul>
  </li>
  <li><strong>Disability:</strong>
    <ul>
      <li><strong>AVPU/GCS:</strong> ${primaryDisabilityAvpuGcs} | <strong>Pupils:</strong> ${primaryDisabilityPupils} | <strong>GRBS:</strong> ${primaryDisabilityGrbs}</li>
    </ul>
  </li>
  <li><strong>Exposure:</strong>
    <ul>
      <li><strong>Temp:</strong> ${primaryExposureTemp} °F | <strong>Trauma-Logroll:</strong> ${primaryExposureTrauma}</li>
    </ul>
  </li>
</ul>
<br/>
<strong>Secondary Physical & Systemic Examinations:</strong>
<hr/>
<ul>
  <li><strong>General Exam (P/I/C/C/L/E):</strong> ${secondaryPicle}</li>
  <li><strong>Respiratory (CHEST):</strong> ${secondaryChest}</li>
  <li><strong>Cardiovascular (CVS):</strong> ${secondaryCvs}</li>
  <li><strong>Abdominal / Gastro (P/A):</strong> ${secondaryPa}</li>
  <li><strong>Central Nervous System (CNS):</strong> ${secondaryCns}</li>
  <li><strong>Musculoskeletal / Extremities:</strong> ${secondaryExtremities}</li>
</ul>
<br/>
<strong>Course in Emergency Ward with Medications & Procedures:</strong>
<hr/>
${courseInHospital}<br/>
<br/>
<strong>Diagnostic Investigations Performed & Results Summary:</strong>
<hr/>
${investigationsResults}<br/>
<br/>
<strong>Diagnosis at Discharge:</strong>
<hr/>
<ul>
  <li><strong>FINAL DIAGNOSIS:</strong> ${primaryDiagnosis}</li>
  <li><strong>ASSOCIATED COMORBIDITIES:</strong> ${secondaryDiagnosis || "None"}</li>
</ul>
<br/>
<strong>Discharge medications:</strong>
<hr/>
${dischargeMedications}<br/>
<br/>
<strong>Disposition Stats & Decision:</strong>
<hr/>
<ul>
  <li><strong>DISPOSITION MODE:</strong> ${dispositionStatus}</li>
  <li><strong>PATIENT CONDITION AT DISCHARGE:</strong> ${dischargeCondition}</li>
  <li><strong>DISCHARGE VITALS:</strong>
    <ul>
      <li><strong>HR:</strong> ${dischargeHr} bpm | <strong>BP:</strong> ${dischargeBp} mmHg</li>
      <li><strong>RR:</strong> ${dischargeRr} /min | <strong>SpO2:</strong> ${dischargeSpo2}%</li>
      <li><strong>GCS:</strong> ${dischargeGcs}/15 | <strong>Pain:</strong> ${dischargePainScore}/10</li>
      <li><strong>GRBS:</strong> ${dischargeGrbs} mg/dL | <strong>Temp:</strong> ${dischargeTemp} °F</li>
    </ul>
  </li>
</ul>
<br/>
<strong>FOLLOW-UP PLAN & SAFE-RETURN WARNINGS:</strong>
<hr/>
${followUpPlan}<br/>
<br/>
<strong>ATTENDING CLINICIANS:</strong>
<hr/>
<strong>Emergency Medicine Duty Resident:</strong> ${emResidentName}<br/>
<strong>Attending EM Consultant:</strong> ${emConsultantName}<br/>
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
    try {
      const response = await fetch("/api/ai-discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        if (resData.data.conditionAtDischarge) setGeneralExamination(resData.data.conditionAtDischarge);
        if (resData.data.dischargeMedications) setDischargeMedications(resData.data.dischargeMedications);
        if (resData.data.followUpPlan) setFollowUpPlan(resData.data.followUpPlan);
        if (resData.data.courseInHospital) setCourseInHospital(resData.data.courseInHospital);
        setAiDrafted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = () => {
    const info: DischargeInfo = {
      primaryDiagnosis,
      secondaryDiagnosis,
      conditionAtDischarge: generalExamination,
      dischargeMedications,
      followUpPlan,
      patientInstructions: "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain.",
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
                
                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-4 gap-2">
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
                <div className="grid grid-cols-4 gap-2">
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
                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-4 gap-2">
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
                <div className="grid grid-cols-4 gap-2">
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
                    <SpeechMicButton onTranscript={(txt) => setPresentingComplaints(prev => prev ? `${prev} ${txt}` : txt)} />
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
                    <SpeechMicButton onTranscript={(txt) => setHistoryOfPresentIllness(prev => prev ? `${prev} ${txt}` : txt)} />
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
                    <SpeechMicButton onTranscript={(txt) => setPastMedicalHistory(prev => prev ? `${prev} ${txt}` : txt)} />
                  </div>
                  <textarea
                    rows={2}
                    value={pastMedicalHistory}
                    onChange={(e) => setPastMedicalHistory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                    <SpeechMicButton onTranscript={(txt) => setGeneralExamination(prev => prev ? `${prev} ${txt}` : txt)} />
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
                
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border">
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
                  <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-2 gap-2">
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

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border grid grid-cols-3 gap-2">
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

                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border grid grid-cols-2 gap-2">
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

                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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
                    rows={3}
                    value={followUpPlan}
                    onChange={(e) => setFollowUpPlan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
        <div className="lg:col-span-7 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-lg overflow-hidden flex flex-col print:border-0 print:shadow-none print:rounded-none print:col-span-12 print:w-full print:p-0 print:m-0">
          
          {/* Top Banner (No Print) */}
          <div className="bg-slate-100 dark:bg-slate-900 border-b p-3 px-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 no-print">
            <span className="font-extrabold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Printer className="w-4 h-4" /> LIVE PRINTABLE SHIELDED PREVIEW
            </span>
            <span className="font-mono text-[10px]">A4 Clinical Card Formats</span>
          </div>

          {/* Actual Printable Page Wrapper */}
          <div className="p-8 md:p-10 font-sans leading-relaxed text-[11px] text-slate-900 bg-white space-y-5 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full" id="print-sheet-content">
            
            {/* Header section matching clinical template layout */}
            <div className="border-b-4 border-double border-slate-800 pb-3 text-center space-y-1">
              <h2 className="text-sm md:text-base font-extrabold tracking-wide uppercase font-serif text-slate-950">
                <strong>{displayHospitalName}</strong>
              </h2>
              <p className="text-[10px] text-slate-600 tracking-wide uppercase font-semibold">
                <strong>Department of Emergency Medicine & Trauma Services</strong>
              </p>
              <div className="text-[9px] text-slate-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1">
                <span><strong>{displayHospitalAddress}</strong></span>
                <span>•</span>
                <span><strong>24x7 ER Hotline Available</strong></span>
              </div>
              <h1 className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white py-1 px-4 rounded-md inline-block mt-2">
                <strong>CLINICAL DISCHARGE SUMMARY & INSTRUCTIONS CARD</strong>
              </h1>
            </div>

            {/* Patient Demographics & Arrivals block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 border border-slate-300 p-3.5 rounded-xl bg-slate-50/40">
              <div className="space-y-1">
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>PATIENT NAME:</strong></span> <span className="font-bold text-[12px] text-slate-950 uppercase"><strong>{currentCase.patient.name}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>AGE / GENDER:</strong></span> <span className="font-bold text-slate-850"><strong>{currentCase.patient.age || "N/A"} Years / {currentCase.patient.gender}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>UHID / CR NUMBER:</strong></span> <span className="font-bold font-mono text-slate-950"><strong>{uhid}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>MLC RECORD STATUS:</strong></span> <span className="font-bold text-rose-700"><strong>{isMlc === "Yes" ? `Yes (${mlcNo})` : "No / Non-MedicoLegal"}</strong></span></p>
                <p className="flex justify-between"><span className="font-extrabold text-slate-500 uppercase"><strong>ALLERGIES:</strong></span> <span className="font-black text-rose-600 bg-rose-50 px-1.5 rounded"><strong>{allergies}</strong></span></p>
              </div>
              <div className="space-y-1 md:border-l md:pl-4">
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>DATE OF ARRIVAL:</strong></span> <span className="font-semibold text-slate-850"><strong>{currentCase.patient.dateOpened || "Immediate on-shift"}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>DATE OF DISCHARGE:</strong></span> <span className="font-bold text-slate-950"><strong>{dischargeDateTime}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>BROUGHT BY / INFORMANT:</strong></span> <span className="font-semibold text-slate-850"><strong>{broughtBy}</strong></span></p>
                <p className="flex justify-between border-b border-slate-100 pb-0.5"><span className="font-extrabold text-slate-500 uppercase"><strong>CASE CATEGORY:</strong></span> <span className="font-semibold text-slate-800"><strong>{currentCase.patient.caseType || "Medical"}</strong></span></p>
                <p className="flex justify-between"><span className="font-extrabold text-slate-500 uppercase"><strong>LAST MENSTRUAL PERIOD:</strong></span> <span className="font-bold text-slate-800"><strong>{lmp}</strong></span></p>
              </div>
            </div>

            {/* Arrival Vitals Table */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Vitals on Arrival</strong>
              </span>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 text-center font-mono">
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>HR / Pulse</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalHr} bpm</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>Blood Pres.</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalBp}</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>Resp Rate</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalRr} /min</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>SpO2 %</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalSpo2}%</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>GCS Score</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalGcs}/15</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>Pain Score</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalPainScore}/10</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>GRBS Glu.</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalGrbs} mg/dl</strong></span>
                </div>
                <div className="border border-slate-200 p-1.5 rounded bg-slate-50/50">
                  <span className="block text-[7px] font-bold text-slate-500 uppercase"><strong>Body Temp</strong></span>
                  <span className="font-bold text-[10px] text-slate-950"><strong>{arrivalTemp} °F</strong></span>
                </div>
              </div>
            </div>

            {/* Complaints and History Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-black text-[9px] text-slate-500 block uppercase"><strong>PRESENTING COMPLAINTS</strong></span>
                <p className="bg-slate-50/40 p-2 border border-slate-200 rounded text-slate-850 whitespace-pre-wrap">
                  {presentingComplaints || "None recorded"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-black text-[9px] text-slate-500 block uppercase"><strong>HISTORY OF PRESENT ILLNESS</strong></span>
                <p className="bg-slate-50/40 p-2 border border-slate-200 rounded text-slate-850 whitespace-pre-wrap">
                  {historyOfPresentIllness || "None recorded"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-black text-[9px] text-slate-500 block uppercase"><strong>PAST MEDICAL / SURGICAL HISTORIES</strong></span>
                <p className="bg-slate-50/40 p-2 border border-slate-200 rounded text-slate-850 whitespace-pre-wrap">
                  {pastMedicalHistory}
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-black text-[9px] text-slate-500 block uppercase"><strong>FAMILY / GYNAE HISTORY</strong></span>
                <p className="bg-slate-50/40 p-2 border border-slate-200 rounded text-slate-850 whitespace-pre-wrap">
                  {familyGynaeHistory} (LMP: {lmp})
                </p>
              </div>
            </div>

            {/* Primary Assessment Section */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Primary Survey</strong>
              </span>
              <div className="border border-slate-300 rounded-xl overflow-hidden text-[9.5px]">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                      <th className="p-1.5 border-r border-slate-200 w-1/4"><strong>Assessment System</strong></th>
                      <th className="p-1.5 border-r border-slate-200"><strong>Clinical Findings & Status</strong></th>
                      <th className="p-1.5 w-1/3"><strong>Interventions Applied</strong></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 font-extrabold text-slate-700"><strong>Airway</strong></td>
                      <td className="p-1.5 border-r border-slate-200"><strong>{primaryAirway}</strong></td>
                      <td className="p-1.5 text-slate-800 font-mono"><strong>{primaryAirwayIntervention}</strong></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 font-extrabold text-slate-700"><strong>Breathing</strong></td>
                      <td className="p-1.5 border-r border-slate-200 space-y-0.5">
                        <p><strong><span className="font-bold text-slate-500">Chest:</span> {primaryBreathing}</strong></p>
                        <p><strong><span className="font-bold text-slate-500">Work:</span> {primaryBreathingWork} | <span className="font-bold text-slate-500">Air Entry:</span> {primaryBreathingAirEntry}</strong></p>
                        <p><strong><span className="font-bold text-slate-500">CCT:</span> {primaryBreathingCct} | <span className="font-bold text-slate-500">Subcut Emphysema:</span> {primaryBreathingSubcut} | <span className="font-bold text-slate-500">EFAST:</span> {primaryBreathingEfast}</strong></p>
                      </td>
                      <td className="p-1.5 text-slate-800 font-mono"><strong>{primaryBreathingIntervention}</strong></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 font-extrabold text-slate-700"><strong>Circulation</strong></td>
                      <td className="p-1.5 border-r border-slate-200 space-y-0.5">
                        <p><strong><span className="font-bold text-slate-500">CRT:</span> {primaryCirculationCrt} | <span className="font-bold text-slate-500">Dist. Neck Veins:</span> {primaryCirculationDnv}</strong></p>
                        <p><strong><span className="font-bold text-slate-500">PCT:</span> {primaryCirculationPct} | <span className="font-bold text-slate-500">Long Bone Deformity:</span> {primaryCirculationDeformity} | <span className="font-bold text-slate-500">FAST:</span> {primaryCirculationFast}</strong></p>
                      </td>
                      <td className="p-1.5 text-slate-800 font-mono"><strong>{primaryCirculationInterventions}</strong></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 font-extrabold text-slate-700"><strong>Disability</strong></td>
                      <td className="p-1.5 border-r border-slate-200 space-y-0.5">
                        <p><strong><span className="font-bold text-slate-500">AVPU/GCS:</span> {primaryDisabilityAvpuGcs}</strong></p>
                        <p><strong><span className="font-bold text-slate-500">Pupils:</span> {primaryDisabilityPupils} | <span className="font-bold text-slate-500">GRBS:</span> {primaryDisabilityGrbs}</strong></p>
                      </td>
                      <td className="p-1.5 text-slate-400 italic font-mono"><strong>Continuous Monitor</strong></td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-slate-200 font-extrabold text-slate-700"><strong>Exposure</strong></td>
                      <td className="p-1.5 border-r border-slate-200">
                        <p><strong><span className="font-bold text-slate-500">Temp:</span> {primaryExposureTemp} °F | <span className="font-bold text-slate-500">Trauma-Logroll:</span> {primaryExposureTrauma}</strong></p>
                      </td>
                      <td className="p-1.5 text-slate-400 italic font-mono"><strong>Environment safe</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Secondary Systemic Assessment */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Secondary Physical & Systemic Examinations</strong>
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 p-3 border border-slate-200 rounded-xl bg-slate-50/30">
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">General Exam (P/I/C/C/L/E)</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryPicle}</strong></span></p>
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">Respiratory (CHEST)</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryChest}</strong></span></p>
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">Cardiovascular (CVS)</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryCvs}</strong></span></p>
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">Abdominal / Gastro (P/A)</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryPa}</strong></span></p>
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">Central Nervous System (CNS)</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryCns}</strong></span></p>
                <p><strong><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] block">Musculoskeletal / Extremities</span></strong> <span className="text-slate-950 font-medium"><strong>{secondaryExtremities}</strong></span></p>
              </div>
            </div>

            {/* Hospital Course and Labs */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Course in Emergency Ward with Medications & Procedures</strong>
              </span>
              <p className="bg-slate-50 border p-2.5 rounded-lg leading-relaxed text-slate-950 font-mono text-[9.5px] whitespace-pre-wrap">
                {courseInHospital}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-black text-slate-950 block uppercase text-[10px] tracking-wide border-b pb-0.5 border-slate-400">
                <strong>Diagnostic Investigations Performed & Results Summary</strong>
              </span>
              <p className="bg-slate-50 border p-2.5 rounded-lg leading-relaxed text-slate-950 font-mono text-[9.5px] whitespace-pre-wrap">
                {investigationsResults}
              </p>
            </div>

            {/* Diagnoses block */}
            <div className="border-2 border-slate-800 rounded-xl p-3.5 space-y-2 bg-white">
              <div>
                <span className="font-extrabold text-[9px] text-blue-700 uppercase tracking-wider block"><strong>FINAL DIAGNOSIS AT DISCHARGE</strong></span>
                <p className="text-[13px] font-black text-slate-950 border-l-4 border-blue-600 pl-3 uppercase">
                  <strong>{primaryDiagnosis}</strong>
                </p>
              </div>

              {secondaryDiagnosis && (
                <div className="border-t pt-2 mt-2">
                  <span className="font-bold text-[9px] text-slate-500 uppercase tracking-wider block"><strong>ASSOCIATED COMORBIDITIES</strong></span>
                  <p className="font-bold text-slate-900 pl-3 text-[10.5px]">
                    <strong>{secondaryDiagnosis}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Outpatient Prescriptions */}
            <div className="border border-emerald-300 bg-emerald-50/10 rounded-xl p-3.5 space-y-1.5">
              <span className="font-extrabold text-[10px] text-emerald-850 uppercase tracking-wide block border-b border-emerald-200 pb-0.5 flex items-center gap-1">
                <strong>💊 Discharge medications</strong>
              </span>
              <p className="font-mono text-[11px] text-emerald-950 font-bold whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-emerald-500">
                <strong>{dischargeMedications}</strong>
              </p>
              <p className="text-[8px] text-slate-500 italic mt-1 leading-normal">
                <strong>* Please consult your pharmacist or general practitioner for proper demonstration, correct drug scheduling, and safety directions.</strong>
              </p>
            </div>

            {/* Disposition Status, Condition, Vitals at Discharge */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-300 p-3.5 rounded-xl bg-slate-50/20">
              <div className="space-y-1.5">
                <span className="font-black text-slate-500 text-[9px] uppercase tracking-wide block"><strong>DISPOSITION STATS & DECISION</strong></span>
                <div className="space-y-1 text-[9.5px] font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 border border-slate-400 rounded flex items-center justify-center text-[10px] ${dispositionStatus === "Normal Discharge" ? "bg-slate-900 text-white border-slate-900" : ""}`}>
                      {dispositionStatus === "Normal Discharge" ? "✓" : ""}
                    </span>
                    <span><strong>Normal Discharge</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 border border-slate-400 rounded flex items-center justify-center text-[10px] ${dispositionStatus === "Discharge at Request" ? "bg-slate-900 text-white border-slate-900" : ""}`}>
                      {dispositionStatus === "Discharge at Request" ? "✓" : ""}
                    </span>
                    <span><strong>Discharge at Request</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 border border-slate-400 rounded flex items-center justify-center text-[10px] ${dispositionStatus === "Discharge Against Medical Advice" ? "bg-slate-900 text-white border-slate-900" : ""}`}>
                      {dispositionStatus === "Discharge Against Medical Advice" ? "✓" : ""}
                    </span>
                    <span><strong>Discharge Against Medical Advice (DAMA)</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 border border-slate-400 rounded flex items-center justify-center text-[10px] ${dispositionStatus === "Referred" ? "bg-slate-900 text-white border-slate-900" : ""}`}>
                      {dispositionStatus === "Referred" ? "✓" : ""}
                    </span>
                    <span><strong>Referred / Higher Center Clinic</strong></span>
                  </div>
                </div>
                <div className="pt-2 border-t mt-2">
                  <span className="font-black text-slate-500 text-[8.5px] uppercase block"><strong>PATIENT CONDITION AT DISCHARGE:</strong></span>
                  <span className="font-extrabold text-[12px] text-blue-700"><strong>{dischargeCondition}</strong></span>
                </div>
              </div>

              <div className="space-y-1 md:border-l md:pl-4">
                <span className="font-black text-slate-500 text-[9px] uppercase tracking-wide block"><strong>DISCHARGE VITAL SIGNS</strong></span>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[9.5px] font-mono leading-normal pt-1 text-slate-900 font-semibold">
                  <p><strong>HR: {dischargeHr} bpm</strong></p>
                  <p><strong>BP: {dischargeBp}</strong></p>
                  <p><strong>RR: {dischargeRr} /min</strong></p>
                  <p><strong>SpO2: {dischargeSpo2}%</strong></p>
                  <p><strong>GCS: {dischargeGcs}/15</strong></p>
                  <p><strong>Pain: {dischargePainScore}/10</strong></p>
                  <p><strong>GRBS: {dischargeGrbs} mg/dl</strong></p>
                  <p><strong>Temp: {dischargeTemp} °F</strong></p>
                </div>
              </div>
            </div>

            {/* Follow up advice */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
              <span className="font-black text-[9px] text-slate-600 uppercase block tracking-wider mb-1"><strong>Follow-Up advice & safe-return warnings</strong></span>
              <p className="font-semibold text-slate-900 whitespace-pre-wrap leading-relaxed text-[10px]">
                <strong>{followUpPlan}</strong>
              </p>
            </div>

            {/* Hospital Signatures section with Dates / Times */}
            <div className="border-t border-slate-300 pt-7 flex justify-between gap-4">
              <div className="text-center w-40 space-y-0.5">
                <div className="h-9 border-b border-dashed border-slate-400"></div>
                <span className="block font-bold text-slate-900 uppercase text-[10px]"><strong>{emResidentName}</strong></span>
                <span className="block text-[7.5px] text-slate-400 uppercase tracking-wide"><strong>Emergency Medicine Duty Resident</strong></span>
                <p className="text-[7px] text-slate-400 font-mono">Sign & Time: __________________</p>
                <p className="text-[7px] text-slate-400 font-mono">Date: {new Date().toLocaleDateString([], { dateStyle: 'short' })}</p>
              </div>

              <div className="text-center w-40 space-y-0.5">
                <div className="h-9 border-b border-dashed border-slate-400"></div>
                <span className="block font-extrabold text-slate-950 uppercase text-[10px]"><strong>{emConsultantName}</strong></span>
                <span className="block text-[7.5px] text-slate-400 uppercase tracking-wide"><strong>Attending EM Consultant (Sign & Stamp)</strong></span>
                <p className="text-[7px] text-slate-400 font-mono">Sign & Time: __________________</p>
                <p className="text-[7px] text-slate-400 font-mono">Date: {new Date().toLocaleDateString([], { dateStyle: 'short' })}</p>
              </div>
            </div>

            {/* Emergency Contacts & Hospital Legal Universal disclaimer */}
            <div className="border-t-2 border-slate-800 pt-3 text-center space-y-1">
              <div className="text-[8.5px] font-black text-rose-700 uppercase">
                <strong>🚨 IN CASE OF EMERGENCY / RE-ACCESS TO TRAUMA SERVICES, CALL ER HOTLINE 🚨</strong>
              </div>
              <p className="text-[8px] text-slate-500 leading-normal italic text-justify">
                <strong>Universal Clinical Notice:</strong> This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request (As per the clinical Medico-legal Code approved by the Government). For a disability certificate, approach a Government-constituted Medical Board.
              </p>
            </div>

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

    </div>
  );
}
