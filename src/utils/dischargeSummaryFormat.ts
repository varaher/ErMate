import { withVitalUnit, VITAL_KINDS } from "./vitalUnits";
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
  primaryBreathing?: string;
  primaryCirculation?: string;
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

  hospitalName?: string;
  hospitalAddressLine?: string;
  hospitalPhone?: string;
  pediatric?: {
    weight?: string;
    workOfBreathing?: string;
    circulation?: string;
    immunization?: string;
  } | null;
}

// State-neutral statutory wording. Institution-specific or state-specific
// legal text must never be hardcoded here — it is printed on every
// discharge summary for every hospital using ErMate.
export const STATUTORY_FOOTER =
  "This discharge summary provides clinical information to facilitate continuity of patient care. A treatment/discharge certificate for statutory purposes will be issued on request as per applicable state medico-legal regulations. For a disability certificate, approach the Government-constituted Medical Board.";

// A number means years ("45 Years"); text such as "6 months" or "14 days" is printed as given (infants were printed as "N Years").
function ageText(age: string | number): string {
  if (typeof age === "string" && /[a-z]/i.test(age)) return age;
  return age ? age + " Years" : "Not documented";
}

const HOSPITAL_NAME_NOT_SET = "[Hospital name not set]";
const HOSPITAL_ADDRESS_NOT_SET = "Hospital address not set in profile";
const HOSPITAL_PHONE_NOT_SET = "Hospital contact number not set in profile";

function dispositionBox(current: string, label: string): string {
  return current === label ? "[x] " + label : "[ ] " + label;
}

function resolveHospitalLines(d: DischargeSummaryData) {
  return {
    nameLine: (d.hospitalName && d.hospitalName.trim() ? d.hospitalName.trim() : HOSPITAL_NAME_NOT_SET).toUpperCase(),
    addressLine: d.hospitalAddressLine && d.hospitalAddressLine.trim() ? d.hospitalAddressLine.trim() : HOSPITAL_ADDRESS_NOT_SET,
    phoneLine: d.hospitalPhone && d.hospitalPhone.trim() ? "Phone: " + d.hospitalPhone.trim() : HOSPITAL_PHONE_NOT_SET,
  };
}

// One vital per line, in the same order everywhere (preview, print, copy).
/** Every vital is printed with its unit (HR 84/min, BP 130/80 mmHg, SpO2 98%, GRBS 141 mg/dL, Temp 97.8°F). */
export function vitalLines(d: any, when: "arrival" | "discharge"): string[] {
  return VITAL_KINDS.map(([label, key, kind]) => label + "- " + (withVitalUnit(kind, d[when + key]) || "Not documented"));
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

  var hosp = resolveHospitalLines(d);

  var lines = [];
  lines.push("**" + hosp.nameLine + "**");
  lines.push(hosp.addressLine);
  lines.push("");
  lines.push("**Discharge Summary**");
  lines.push("");
  lines.push("**PATIENT NAME:** " + d.patientName);
  lines.push("**AGE / GENDER:** " + ageText(d.patientAge) + " / " + (d.patientGender || "Not documented"));
  lines.push("**UHID / CR NUMBER:** " + (d.uhid || "Not documented"));
  lines.push("");
  lines.push("**MLC:** " + (d.isMlc === "Yes" ? ("Yes" + (d.mlcNo ? " (" + d.mlcNo + ")" : "")) : "No"));
  lines.push("");
  lines.push("**Allergy :** " + (d.allergies || "Not documented"));
  lines.push("");
  lines.push("**Vitals at the time of arrival:**");
  lines.push(...vitalLines(d, "arrival"));
  lines.push("");
  lines.push("**Presenting Complaints:**");
  lines.push(d.presentingComplaints || "Not documented");
  lines.push("");
  lines.push("**History of Present Illness:**");
  lines.push(d.historyOfPresentIllness || "Not documented");
  lines.push("");
  lines.push("**Past Medical/Surgical Histories:**");
  lines.push(d.pastMedicalHistory || "Not documented");
  lines.push("");
  lines.push("**Family / Gynae History :** " + (d.familyGynaeHistory || "Not documented"));
  lines.push("");
  if (d.lmp) lines.push("**LMP :** " + d.lmp);
  if (pedInfo) lines.push(pedInfo);
  lines.push("**General Examination / Systemic examination:**");
  lines.push(d.generalExamination || "Not documented");
  lines.push("");
  lines.push("**Primary Assessment:**");
  lines.push("");
  lines.push("**Airway** \u2192 " + (d.primaryAirway || "Not documented") + " ,Intervention- " + (d.primaryAirwayIntervention || "Not documented"));
  lines.push("");
  lines.push("**Breathing** \u2192 " + (d.primaryBreathing ? "Findings- " + d.primaryBreathing + " ," : "") + "Work of breathing- " +(d.primaryBreathingWork || "Not documented") + " ,Air entry- " + (d.primaryBreathingAirEntry || "Not documented") + " ,CCT- " + (d.primaryBreathingCct || "Not documented") + " ,Subcutaneous emphysema- " + (d.primaryBreathingSubcut || "Not documented") + " ,EFAST- " + (d.primaryBreathingEfast || "Not documented") + " ,Intervention- " + (d.primaryBreathingIntervention || "Not documented") + ".");
  lines.push("");
  lines.push("**Circulation** \u2192 " + (d.primaryCirculation ? "Findings- " + d.primaryCirculation + " ," : "") + "CRT- " +(d.primaryCirculationCrt || "Not documented") + " , Distended Neck Veins- " + (d.primaryCirculationDnv || "Not documented") + " , PCT- " + (d.primaryCirculationPct || "Not documented") + " ,Long bone deformity- " + (d.primaryCirculationDeformity || "Not documented") + " ,FAST- " + (d.primaryCirculationFast || "Not documented") + " ,Interventions- " + (d.primaryCirculationInterventions || "Not documented") + ".");
  lines.push("");
  lines.push("**Disability** \u2192 AVPU/GCS- " + (d.primaryDisabilityAvpuGcs || "Not documented") + " ,Pupils- " + (d.primaryDisabilityPupils || "Not documented") + " ,GRBS- " + (withVitalUnit("grbs", d.primaryDisabilityGrbs) || "Not documented"));
  lines.push("");
  lines.push("**Exposure** \u2192 Temp- " + (withVitalUnit("temp", d.primaryExposureTemp) || "Not documented") + " | Trauma-Logroll- " + (d.primaryExposureTrauma || "Not documented"));
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
  lines.push(d.courseInHospital || "Not documented");
  lines.push("");
  lines.push("**Investigations:**");
  lines.push(d.investigationsResults || "Not documented");
  lines.push("");
  lines.push("**Diagnosis at the time of discharge:**");
  lines.push((d.primaryDiagnosis || "Not documented") + (d.secondaryDiagnosis ? "\n" + d.secondaryDiagnosis : ""));
  lines.push("");
  lines.push("**Discharge Medications:**");
  lines.push(d.dischargeMedications || "Not documented");
  lines.push("");
  lines.push("**Disposition:**");
  lines.push(dispositionBox(d.dispositionStatus, "Normal Discharge"));
  lines.push(dispositionBox(d.dispositionStatus, "Discharge at Request"));
  lines.push(dispositionBox(d.dispositionStatus, "Discharge Against Medical Advice"));
  lines.push(dispositionBox(d.dispositionStatus, "Referred"));
  lines.push(dispositionBox(d.dispositionStatus, "Admitted"));
  lines.push(dispositionBox(d.dispositionStatus, "Expired"));
  if (d.dispositionStatus && !["Normal Discharge", "Discharge at Request", "Discharge Against Medical Advice", "Referred", "Admitted", "Expired", "Pending / Not Documented"].includes(d.dispositionStatus)) lines.push("[x] " + d.dispositionStatus);
  lines.push("");
  lines.push("**Condition at time of discharge:(STABLE/UNSTABLE)** " + (d.dischargeCondition || "Not documented"));
  lines.push("");
  lines.push("**Vitals at the time of Discharge:**");
  lines.push(...vitalLines(d, "discharge"));
  lines.push("");
  lines.push("**Follow-Up Advice:**");
  lines.push(d.followUpPlan || "Not documented");
  lines.push("");
  lines.push("**ED Resident: **" + (d.emResidentName || "Not documented") + " | **ED Consultant: **" + (d.emConsultantName || "Not documented"));
  lines.push("");
  lines.push("**Sign and Time: **___________________ | **Sign and Time: **___________________");
  lines.push("");
  lines.push("**Date: **" + d.dischargeDateTime);
  lines.push("");
  lines.push("Hospital Address and Contact Information:");
  lines.push("");
  lines.push(hosp.nameLine);
  lines.push(hosp.addressLine);
  lines.push(hosp.phoneLine);
  lines.push("");
  lines.push(STATUTORY_FOOTER);

  return lines.join("\n");
}

/** Escape a value and keep its line breaks (EMR editors collapse raw newlines into one line). */
function htmlText(v: string | undefined | null): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br/>");
}
/** Section heading for the EMR copy: bold and a little larger than the text (25 Nov 2026). */
function htmlHeading(label: string): string {
  return '<strong style="font-size:13.5px">' + label + "</strong>";
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

  var hosp = resolveHospitalLines(d);

  var parts = [];
  parts.push("<strong>" + hosp.nameLine + "</strong><br/>");
  parts.push(hosp.addressLine + "<br/><br/>");
  parts.push("<strong>Discharge Summary</strong><br/><br/>");
  parts.push("<strong>PATIENT NAME:</strong> " + d.patientName + "<br/>");
  parts.push("<strong>AGE / GENDER:</strong> " + ageText(d.patientAge) + " / " + (d.patientGender || "Not documented") + "<br/>");
  parts.push("<strong>UHID / CR NUMBER:</strong> " + (d.uhid || "Not documented") + "<br/><br/>");
  parts.push("<strong>MLC:</strong> " + (d.isMlc === "Yes" ? ("Yes" + (d.mlcNo ? " (" + d.mlcNo + ")" : "")) : "No") + "<br/><br/>");
  parts.push("<strong>Allergy :</strong> " + (d.allergies || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Vitals at the time of arrival:") + "<br/>");
  parts.push(vitalLines(d, "arrival").join("<br/>") + "<br/><br/>");
  parts.push(htmlHeading("Presenting Complaints:") + "<br/>");
  parts.push(htmlText(d.presentingComplaints || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("History of Present Illness:") + "<br/>");
  parts.push(htmlText(d.historyOfPresentIllness || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Past Medical/Surgical Histories:") + "<br/>");
  parts.push(htmlText(d.pastMedicalHistory || "Not documented") + "<br/><br/>");
  parts.push("<strong>Family / Gynae History :</strong> " + (d.familyGynaeHistory || "Not documented") + "<br/>");
  parts.push(d.lmp ? "<strong>LMP :</strong> " + d.lmp + "<br/><br/>" : "<br/>");
  if (pedHtml) parts.push(pedHtml);
  parts.push(htmlHeading("General Examination / Systemic examination:") + "<br/>");
  parts.push(htmlText(d.generalExamination || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Primary Assessment:") + "<br/><br/>");
  parts.push("<strong>Airway</strong> \u2192 " + (d.primaryAirway || "Not documented") + " ,Intervention- " + (d.primaryAirwayIntervention || "Not documented") + "<br/><br/>");
  parts.push("<strong>Breathing</strong> \u2192 " + (d.primaryBreathing ? "Findings- " + d.primaryBreathing + " ," : "") + "Work of breathing- " +(d.primaryBreathingWork || "Not documented") + " ,Air entry- " + (d.primaryBreathingAirEntry || "Not documented") + " ,CCT- " + (d.primaryBreathingCct || "Not documented") + " ,Subcutaneous emphysema- " + (d.primaryBreathingSubcut || "Not documented") + " ,EFAST- " + (d.primaryBreathingEfast || "Not documented") + " ,Intervention- " + (d.primaryBreathingIntervention || "Not documented") + ".<br/><br/>");
  parts.push("<strong>Circulation</strong> \u2192 " + (d.primaryCirculation ? "Findings- " + d.primaryCirculation + " ," : "") + "CRT- " +(d.primaryCirculationCrt || "Not documented") + " , Distended Neck Veins- " + (d.primaryCirculationDnv || "Not documented") + " , PCT- " + (d.primaryCirculationPct || "Not documented") + " ,Long bone deformity- " + (d.primaryCirculationDeformity || "Not documented") + " ,FAST- " + (d.primaryCirculationFast || "Not documented") + " ,Interventions- " + (d.primaryCirculationInterventions || "Not documented") + ".<br/><br/>");
  parts.push("<strong>Disability</strong> \u2192 AVPU/GCS- " + (d.primaryDisabilityAvpuGcs || "Not documented") + " ,Pupils- " + (d.primaryDisabilityPupils || "Not documented") + " ,GRBS- " + (withVitalUnit("grbs", d.primaryDisabilityGrbs) || "Not documented") + "<br/><br/>");
  parts.push("<strong>Exposure</strong> \u2192 Temp- " + (withVitalUnit("temp", d.primaryExposureTemp) || "Not documented") + " | Trauma-Logroll- " + (d.primaryExposureTrauma || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Secondary Assesment:") + "<br/><br/>");
  parts.push("Pallor Icterus Cyanosis Clubbing Lymphadenopathy Edema- " + (d.secondaryPicle || "Not documented") + "<br/><br/>");
  parts.push("<strong>CHEST-</strong> " + (d.secondaryChest || "Not documented") + "<br/><br/>");
  parts.push("<strong>CVS-</strong> " + (d.secondaryCvs || "Not documented") + "<br/><br/>");
  parts.push("<strong>P/A-</strong> " + (d.secondaryPa || "Not documented") + "<br/><br/>");
  parts.push("<strong>CNS-</strong> " + (d.secondaryCns || "Not documented") + "<br/><br/>");
  parts.push("<strong>EXTREMITIES-</strong> " + (d.secondaryExtremities || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Course in Hospital with Medications and Procedure:") + "<br/>");
  parts.push(htmlText(d.courseInHospital || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Investigations:") + "<br/>");
  parts.push(htmlText(d.investigationsResults || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Diagnosis at the time of discharge:") + "<br/>");
  parts.push(htmlText(d.primaryDiagnosis || "Not documented") + (d.secondaryDiagnosis ? "<br/>" + htmlText(d.secondaryDiagnosis) : "") + "<br/><br/>");
  parts.push(htmlHeading("Discharge Medications:") + "<br/>");
  parts.push(htmlText(d.dischargeMedications || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Disposition:") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Normal Discharge") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Discharge at Request") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Discharge Against Medical Advice") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Referred") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Admitted") + "<br/>");
  parts.push(dispositionBox(d.dispositionStatus, "Expired") + "<br/>");
  if (d.dispositionStatus && !["Normal Discharge", "Discharge at Request", "Discharge Against Medical Advice", "Referred", "Admitted", "Expired", "Pending / Not Documented"].includes(d.dispositionStatus)) parts.push("[x] " + htmlText(d.dispositionStatus) + "<br/>");
  parts.push("<br/>");
  parts.push(htmlHeading("Condition at time of discharge:(STABLE/UNSTABLE)") + " " + (d.dischargeCondition || "Not documented") + "<br/><br/>");
  parts.push(htmlHeading("Vitals at the time of Discharge:") + "<br/>");
  parts.push(vitalLines(d, "discharge").join("<br/>") + "<br/><br/>");
  parts.push(htmlHeading("Follow-Up Advice:") + "<br/>");
  parts.push(htmlText(d.followUpPlan || "Not documented") + "<br/><br/>");
  parts.push("<strong>ED Resident: </strong>" + (d.emResidentName || "Not documented") + " | <strong>ED Consultant: </strong>" + (d.emConsultantName || "Not documented") + "<br/><br/>");
  parts.push("<strong>Sign and Time: </strong>___________________ | <strong>Sign and Time: </strong>___________________<br/><br/>");
  parts.push("<strong>Date: </strong>" + d.dischargeDateTime + "<br/><br/>");
  parts.push(htmlHeading("Hospital Address and Contact Information:") + "<br/>");
  parts.push(hosp.nameLine + "<br/>");
  parts.push(hosp.addressLine + "<br/>");
  parts.push(hosp.phoneLine + "<br/><br/>");
  parts.push(STATUTORY_FOOTER);

  return parts.join("");
}

/**
 * Plain-text flavour for EMR boxes that do not keep formatting (25 Nov 2026): a heading on its own line is
 * written in CAPITALS so it still stands out; "**" markers are removed everywhere else.
 */
export function dischargeSummaryPlainForEmr(markdownText: string): string {
  return markdownText
    .replace(/^\*\*([^*\n]+?)\*\*\s*$/gm, (_m, h: string) => h.trim().toUpperCase())
    .replace(/\*\*/g, "");
}