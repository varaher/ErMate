// ============================================================
// ErMate — Canonical Discharge Summary Formatter
// Single source of truth for discharge summary text/HTML output.
// Used by DischargeSummaryView (ErMate case sheet path) AND
// HandoverView (paste-from-third-party-EMR path) — both must
// funnel through these two functions, not maintain their own
// rendering logic.
// ============================================================

export interface DischargeSummaryData {
  patientName: string;
  patientAge: string | number;
  patientGender: string;
  uhid: string;

  isMlc: string;
  mlcNo: string;
  allergies: string;

  arrivalHr: string;
  arrivalBp: string;
  arrivalRr: string;
  arrivalSpo2: string;
  arrivalGcs: string;
  arrivalPainScore: string;
  arrivalGrbs: string;
  arrivalTemp: string;

  presentingComplaints: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  familyGynaeHistory: string;
  lmp: string;
  generalExamination: string;

  primaryAirway: string;
  primaryAirwayIntervention: string;
  primaryBreathingWork: string;
  primaryBreathingAirEntry: string;
  primaryBreathingCct: string;
  primaryBreathingSubcut: string;
  primaryBreathingEfast: string;
  primaryBreathingIntervention: string;
  primaryCirculationCrt: string;
  primaryCirculationDnv: string;
  primaryCirculationPct: string;
  primaryCirculationDeformity: string;
  primaryCirculationFast: string;
  primaryCirculationInterventions: string;
  primaryDisabilityAvpuGcs: string;
  primaryDisabilityPupils: string;
  primaryDisabilityGrbs: string;
  primaryExposureTemp: string;
  primaryExposureTrauma: string;

  secondaryPicle: string;
  secondaryChest: string;
  secondaryCvs: string;
  secondaryPa: string;
  secondaryCns: string;
  secondaryExtremities: string;

  courseInHospital: string;
  investigationsResults: string;
  primaryDiagnosis: string;
  secondaryDiagnosis: string;
  dischargeMedications: string;

  dispositionStatus: string;
  dischargeCondition: string;

  dischargeHr: string;
  dischargeBp: string;
  dischargeRr: string;
  dischargeSpo2: string;
  dischargeGcs: string;
  dischargePainScore: string;
  dischargeGrbs: string;
  dischargeTemp: string;

  followUpPlan: string;
  emResidentName: string;
  emConsultantName: string;
  dischargeDateTime: string;

  hospitalAddressLine?: string;
  pediatric?: {
    weight?: string;
    workOfBreathing?: string;
    circulation?: string;
    immunization?: string;
  } | null;
}

const DEFAULT_HOSPITAL_ADDRESS = "Chunangamvely, Aluva, Ernakulam, Kerala - 683 112";

function dispositionBox(current: string, label: string): string {
  return current === label ? "[x] " + label : "[ ] " + label;
}

export function formatDischargeSummaryText(d: DischargeSummaryData): string {
  var pedInfo = "";
  if (d.pediatric) {
    pedInfo = "\n**PEDIATRIC NOTES (supplemental — not part of standard card):**\n" +
      "- Weight: " + (d.pediatric.weight ? d.pediatric.weight + " kg" : "Not recorded") + "\n" +
      "- Work of Breathing: " + (d.pediatric.workOfBreathing || "Not recorded") + "\n" +
      "- Circulation: " + (d.pediatric.circulation || "Not recorded") + "\n" +
      "- Immunization Status: " + (d.pediatric.immunization || "Not recorded") + "\n";
  }

  var hospitalAddressLine = d.hospitalAddressLine || DEFAULT_HOSPITAL_ADDRESS;

  var lines = [];
  lines.push("**Discharge Summary**");
  lines.push("");
  lines.push("**PATIENT NAME:** " + d.patientName);
  lines.push("**AGE / GENDER:** " + (d.patientAge || "N/A") + " Years / " + d.patientGender);
  lines.push("**UHID / CR NUMBER:** " + d.uhid);
  lines.push("");
  lines.push("**MLC:** " + (d.isMlc === "Yes" ? "Yes (" + d.mlcNo + ")" : "No"));
  lines.push("");
  lines.push("**Allergy :** " + (d.allergies || "NKDA"));
  lines.push("");
  lines.push("**Vitals at the time of arrival:**");
  lines.push("HR-" + d.arrivalHr + " ,BP-" + d.arrivalBp + " ,RR-" + d.arrivalRr + " ,Spo2-" + d.arrivalSpo2 + " ,GCS-" + d.arrivalGcs + " ,Pain Score-" + d.arrivalPainScore + " ,GRBS-" + d.arrivalGrbs + " ,Temp-" + d.arrivalTemp);
  lines.push("");
  lines.push("**Presenting Complaints:**");
  lines.push(d.presentingComplaints || "None recorded");
  lines.push("");
  lines.push("**History of Present Illness:**");
  lines.push(d.historyOfPresentIllness || "None recorded");
  lines.push("");
  lines.push("**Past Medical/Surgical Histories:**");
  lines.push(d.pastMedicalHistory || "None recorded");
  lines.push("");
  lines.push("**Family / Gynae History :** " + (d.familyGynaeHistory || "None recorded"));
  lines.push("");
  lines.push("**LMP :** " + d.lmp);
  if (pedInfo) lines.push(pedInfo);
  lines.push("**General Examination / Systemic examination:**");
  lines.push(d.generalExamination || "Not documented");
  lines.push("");
  lines.push("**Primary Assessment:**");
  lines.push("");
  lines.push("**Airway** \u2192 " + (d.primaryAirway || "Not documented") + " ,Intervention- " + (d.primaryAirwayIntervention || "Not documented"));
  lines.push("");
  lines.push("**Breathing** \u2192 Work of breathing- " + (d.primaryBreathingWork || "Not documented") + " ,Air entry- " + (d.primaryBreathingAirEntry || "Not documented") + " ,CCT- " + (d.primaryBreathingCct || "Not documented") + " ,Subcutaneous emphysema- " + (d.primaryBreathingSubcut || "Not documented") + " ,EFAST- " + (d.primaryBreathingEfast || "Not documented") + " ,Intervention- " + (d.primaryBreathingIntervention || "Not documented") + ".");
  lines.push("");
  lines.push("**Circulation** \u2192 CRT- " + (d.primaryCirculationCrt || "Not documented") + " , Distended Neck Veins- " + (d.primaryCirculationDnv || "Not documented") + " , PCT- " + (d.primaryCirculationPct || "Not documented") + " ,Long bone deformity- " + (d.primaryCirculationDeformity || "Not documented") + " ,FAST- " + (d.primaryCirculationFast || "Not documented") + " ,Interventions- " + (d.primaryCirculationInterventions || "Not documented") + ".");
  lines.push("");
  lines.push("**Disability** \u2192 AVPU/GCS- " + (d.primaryDisabilityAvpuGcs || "Not documented") + " ,Pupils- " + (d.primaryDisabilityPupils || "Not documented") + " ,GRBS- " + (d.primaryDisabilityGrbs || "Not documented"));
  lines.push("");
  lines.push("**Exposure** \u2192 Temp- " + (d.primaryExposureTemp || "Not documented") + " | Trauma-Logroll- " + (d.primaryExposureTrauma || "Not documented"));
  lines.push("");
  lines.push("**Secondary Assesment:**");
  lines.push("");
  lines.push("Pallor Icterus Cyanosis Clubbing Lymphadenopathy Edema- " + (d.secondaryPicle || "Not documented"));
  lines.push("");
  lines.push("CHEST- " + (d.secondaryChest || "Not documented"));
  lines.push("");
  lines.push("CVS- " + (d.secondaryCvs || "Not documented"));
  lines.push("");
  lines.push("P/A- " + (d.secondaryPa || "Not documented"));
  lines.push("");
  lines.push("CNS- " + (d.secondaryCns || "Not documented"));
  lines.push("");
  lines.push("EXTREMITIES- " + (d.secondaryExtremities || "Not documented"));
  lines.push("");
  lines.push("**Course in Hospital with Medications and Procedure:**");
  lines.push(d.courseInHospital || "Patient evaluated and stabilized in ER.");
  lines.push("");
  lines.push("**Investigations:**");
  lines.push(d.investigationsResults || "No investigations ordered.");
  lines.push("");
  lines.push("**Diagnosis at the time of discharge:**");
  lines.push((d.primaryDiagnosis || "Under Evaluation") + (d.secondaryDiagnosis ? "\n" + d.secondaryDiagnosis : ""));
  lines.push("");
  lines.push("**Discharge Medications:**");
  lines.push(d.dischargeMedications || "No outpatient medications prescribed.");
  lines.push("");
  lines.push("**Disposition:**");
  lines.push(dispositionBox(d.dispositionStatus, "Normal Discharge"));
  lines.push(dispositionBox(d.dispositionStatus, "Discharge at Request"));
  lines.push(dispositionBox(d.dispositionStatus, "Discharge Against Medical Advice"));
  lines.push(dispositionBox(d.dispositionStatus, "Referred"));
  lines.push("");
  lines.push("**Condition at time of discharge:(STABLE/UNSTABLE)** " + (d.dischargeCondition || "Not Recorded"));
  lines.push("");
  lines.push("**Vitals at the time of Discharge:**");
  lines.push("HR-" + d.dischargeHr + " ,BP-" + d.dischargeBp + " ,RR-" + d.dischargeRr + " ,Sp02-" + d.dischargeSpo2 + " ,GCS-" + d.dischargeGcs + " ,Pain Score-" + d.dischargePainScore + " ,GRBS-" + d.dischargeGrbs + " ,Temp-" + d.dischargeTemp);
  lines.push("");
  lines.push("**Follow-Up Advice:**");
  lines.push(d.followUpPlan || "None recorded");
  lines.push("");
  lines.push("**ED Resident: **" + (d.emResidentName || "Not Recorded") + " | **ED Consultant: **" + (d.emConsultantName || "Not Recorded"));
  lines.push("");
  lines.push("**Sign and Time: **___________________ | **Sign and Time: **___________________");
  lines.push("");
  lines.push("**Date: **" + d.dischargeDateTime);
  lines.push("");
  lines.push("In case of emergency, contact: 0484-2905100");
  lines.push("");
  lines.push("Hospital Address and Contact Information:");
  lines.push("");
  lines.push(hospitalAddressLine);
  lines.push("");
  lines.push("Phone: 0484-2905000 / 0484-2905100");
  lines.push("");
  lines.push("This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request (As per the Kerala Medico-legal Code approved by the Government of Kerala in 2011). For a disability certificate, approach a Government-constituted Medical Board.");

  return lines.join("\n");
}

export function formatDischargeSummaryHtml(d: DischargeSummaryData): string {
  var pedHtml = "";
  if (d.pediatric) {
    pedHtml = "<strong>PEDIATRIC NOTES (supplemental):</strong><br/>" +
      "Weight: " + (d.pediatric.weight ? d.pediatric.weight + " kg" : "Not recorded") + "<br/>" +
      "Work of Breathing: " + (d.pediatric.workOfBreathing || "Not recorded") + "<br/>" +
      "Circulation: " + (d.pediatric.circulation || "Not recorded") + "<br/>" +
      "Immunization Status: " + (d.pediatric.immunization || "Not recorded") + "<br/><br/>";
  }

  var hospitalAddressLine = d.hospitalAddressLine || DEFAULT_HOSPITAL_ADDRESS;

  var parts = [];
  parts.push("<strong>Discharge Summary</strong><br/><br/>");
  parts.push("<strong>PATIENT NAME:</strong> " + d.patientName + "<br/>");
  parts.push("<strong>AGE / GENDER:</strong> " + (d.patientAge || "N/A") + " Years / " + d.patientGender + "<br/>");
  parts.push("<strong>UHID / CR NUMBER:</strong> " + d.uhid + "<br/><br/>");
  parts.push("<strong>MLC:</strong> " + (d.isMlc === "Yes" ? "Yes (" + d.mlcNo + ")" : "No") + "<br/><br/>");
  parts.push("<strong>Allergy :</strong> " + (d.allergies || "NKDA") + "<br/><br/>");
  parts.push("<strong>Vitals at the time of arrival:</strong><br/>");
  parts.push("HR-" + d.arrivalHr + " ,BP-" + d.arrivalBp + " ,RR-" + d.arrivalRr + " ,Spo2-" + d.arrivalSpo2 + " ,GCS-" + d.arrivalGcs + " ,Pain Score-" + d.arrivalPainScore + " ,GRBS-" + d.arrivalGrbs + " ,Temp-" + d.arrivalTemp + "<br/><br/>");
  parts.push("<strong>Presenting Complaints:</strong><br/>");
  parts.push((d.presentingComplaints || "None recorded") + "<br/><br/>");
  parts.push("<strong>History of Present Illness:</strong><br/>");
  parts.push((d.historyOfPresentIllness || "None recorded") + "<br/><br/>");
  parts.push("<strong>Past Medical/Surgical Histories:</strong><br/>");
  parts.push((d.pastMedicalHistory || "None recorded") + "<br/><br/>");
  parts.push("<strong>Family / Gynae History :</strong> " + (d.familyGynaeHistory || "None recorded") + "<br/>");
  parts.push("<strong>LMP :</strong> " + d.lmp + "<br/><br/>");
  if (pedHtml) parts.push(pedHtml);
  parts.push("<strong>General Examination / Systemic examination:</strong><br/>");
  parts.push((d.generalExamination || "Not documented") + "<br/><br/>");
  parts.push("<strong>Primary Assessment:</strong><br/><br/>");
  parts.push("<strong>Airway</strong> \u2192 " + (d.primaryAirway || "Not documented") + " ,Intervention- " + (d.primaryAirwayIntervention || "Not documented") + "<br/><br/>");
  parts.push("<strong>Breathing</strong> \u2192 Work of breathing- " + (d.primaryBreathingWork || "Not documented") + " ,Air entry- " + (d.primaryBreathingAirEntry || "Not documented") + " ,CCT- " + (d.primaryBreathingCct || "Not documented") + " ,Subcutaneous emphysema- " + (d.primaryBreathingSubcut || "Not documented") + " ,EFAST- " + (d.primaryBreathingEfast || "Not documented") + " ,Intervention- " + (d.primaryBreathingIntervention || "Not documented") + ".<br/><br/>");
  parts.push("<strong>Circulation</strong> \u2192 CRT- " + (d.primaryCirculationCrt || "Not documented") + " , Distended Neck Veins- " + (d.primaryCirculationDnv || "Not documented") + " , PCT- " + (d.primaryCirculationPct || "Not documented") + " ,Long bone deformity- " + (d.primaryCirculationDeformity || "Not documented") + " ,FAST- " + (d.primaryCirculationFast || "Not documented") + " ,Interventions- " + (d.primaryCirculationInterventions || "Not documented") + ".<br/><br/>");
  parts.push("<strong>Disability</strong> \u2192 AVPU/GCS- " + (d.primaryDisabilityAvpuGcs || "Not documented") + " ,Pupils- " + (d.primaryDisabilityPupils || "Not documented") + " ,GRBS- " + (d.primaryDisabilityGrbs || "Not documented") + "<br/><br/>");
  parts.push("<strong>Exposure</strong> \u2192 Temp- " + (d.primaryExposureTemp || "Not documented") + " | Trauma-Logroll- " + (d.primaryExposureTrauma || "Not documented") + "<br/><br/>");
  parts.push("<strong>Secondary Assesment:</strong><br/><br/>");
  parts.push("Pallor Icterus Cyanosis Clubbing Lymphadenopathy Edema- " + (d.secondaryPicle || "Not documented") + "<br/><br/>");
  parts.push("CHEST- " + (d.secondaryChest || "Not documented") + "<br/><br/>");
  parts.push("CVS- " + (d.secondaryCvs || "Not documented") + "<br/><br/>");
  parts.push("P/A- " + (d.secondaryPa || "Not documented") + "<br/><br/>");
  parts.push("CNS- " + (d.secondaryCns || "Not documented") + "<br/><br/>");
  parts.push("EXTREMITIES- " + (d.secondaryExtremities || "Not documented") + "<br/><br/>");
  parts.push("<strong>Course in Hospital with Medications and Procedure:</strong><br/>");
  parts.push((d.courseInHospital || "Patient evaluated and stabilized in ER.") + "<br/><br/>");
  parts.push("<strong>Investigations:</strong><br/>");
  parts.push((d.investigationsResults || "No investigations ordered.") + "<br/><br/>");
  parts.push("<strong>Diagnosis at the time of discharge:</strong><br/>");
  parts.push((d.primaryDiagnosis || "Under Evaluation") + (d.secondaryDiagnosis ? "<br/>" + d.secondaryDiagnosis : "") + "<br/><br/>");
  parts.push("<strong>Discharge Medications:</strong><br/>");
  parts.push((d.dischargeMedications || "No outpatient medications prescribed.") + "<br/><br/>");
  parts.push("<strong>Disposition:</strong><br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Normal Discharge") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Discharge at Request") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Discharge Against Medical Advice") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Referred") + "<br/><br/>");
  parts.push("<strong>Condition at time of discharge:(STABLE/UNSTABLE)</strong> " + (d.dischargeCondition || "Not Recorded") + "<br/><br/>");
  parts.push("<strong>Vitals at the time of Discharge:</strong><br/>");
  parts.push("HR-" + d.dischargeHr + " ,BP-" + d.dischargeBp + " ,RR-" + d.dischargeRr + " ,Sp02-" + d.dischargeSpo2 + " ,GCS-" + d.dischargeGcs + " ,Pain Score-" + d.dischargePainScore + " ,GRBS-" + d.dischargeGrbs + " ,Temp-" + d.dischargeTemp + "<br/><br/>");
  parts.push("<strong>Follow-Up Advice:</strong><br/>");
  parts.push((d.followUpPlan || "None recorded") + "<br/><br/>");
  parts.push("<strong>ED Resident: </strong>" + (d.emResidentName || "Not Recorded") + " | <strong>ED Consultant: </strong>" + (d.emConsultantName || "Not Recorded") + "<br/><br/>");
  parts.push("<strong>Sign and Time: </strong>___________________ | <strong>Sign and Time: </strong>___________________<br/><br/>");
  parts.push("<strong>Date: </strong>" + d.dischargeDateTime + "<br/><br/>");
  parts.push("In case of emergency, contact: 0484-2905100<br/><br/>");
  parts.push("Hospital Address and Contact Information:<br/>");
  parts.push(hospitalAddressLine + "<br/>");
  parts.push("Phone: 0484-2905000 / 0484-2905100<br/><br/>");
  parts.push("This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request (As per the Kerala Medico-legal Code approved by the Government of Kerala in 2011). For a disability certificate, approach a Government-constituted Medical Board.");

  return parts.join("");
}