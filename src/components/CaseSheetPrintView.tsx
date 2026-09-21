import React from "react";
import { formatFlagged, isCulturePositive, type ClinicalParam } from "./clinicalRanges";
import { ArrowLeft, Edit3, Printer, FileText } from "lucide-react";
import { ClinicalCase, LegacyPediatricDetails } from "../types";

interface VitalReading {
  label: string;
  param: ClinicalParam;
  value: number | null;
  displayValue?: string;
  unit?: string;
}

interface LabPanel {
  panelName: string;
  values: { name: string; param: ClinicalParam | null; value: number | null; unit?: string }[];
}

export interface PrimarySurveyData {
  airway: string | null;
  breathing: string | null;
  circulation: string | null;
  disability: string | null;
  exposure: string | null;
  vitalsContext?: {
    rr?: string | number | null;
    spo2?: string | number | null;
    hr?: string | number | null;
    bp?: string | null;
    gcs?: string | number | null;
    gcsComponents?: string | null;
    grbs?: string | number | null;
    temp?: string | number | null;
  };
}

export interface SecondarySurveyData {
  general: string | null;
  cvs: string | null;
  respiratory: string | null;
  abdomen: string | null;
  cns: string | null;
  extremities: string | null;
}

export interface PsychologicalAssessmentData {
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  intentToHarmOthers: boolean;
  substanceAbuse: boolean;
  psychiatricHistory: boolean;
  currentlyOnPsychiatricTreatment: boolean;
  hasSupportSystem: boolean;
  notes: string | null;
}

export interface CaseSheetData {
  caseId: string;
  hospitalName?: string;
  triageCategory?: string | null;
  caseType?: string | null;
  patient: {
    name: string | null;
    age: number | null;
    sex: "M" | "F" | "O" | null;
    uhid: string | null;
    bed: string | null;
  };
  arrival: { date: string | null; time: string | null };
  clinician: string | null;
  presentingComplaint: string;

  initialVitals: VitalReading[];
  vbgAbg: { type: "VBG" | "ABG" | null; performed: boolean; values: { name: string; param: ClinicalParam; value: number | null }[]; notes?: string };
  ecg: { performed: boolean; findings: string };
  bedsideEcho: { performed: boolean; findings: string };
  efast: { performed: boolean; findings: string };

  symptoms: string[];
  allergies: string[];
  currentMedications: string[];
  pastHistory: string[];
  lastMeal: string | null;
  events: string | null;
  treatment: { otherNotes?: string } | null;
  primarySurvey: PrimarySurveyData;
  secondarySurvey: SecondarySurveyData;
  psychologicalAssessment: PsychologicalAssessmentData | null;
  provisionalDiagnosis: string;
  provisionalDifferentialDiagnoses?: string | null;
  differentials: { diagnosis: string; status: string }[];

  labs: LabPanel[];
  cultureResults?: { name: string; result: string }[];
  investigationImaging?: string | null;
  investigationLabsOrdered?: string | null;
  investigationResultsSummary?: string | null;

  treatmentGiven: string[];
  treatmentNotes?: string | null;

  procedures: {
    proceduresChecked: string[];
    otherProcedures: string | null;
  };

  consultation: {
    consultsRequested: string[];
    consultantReview: { reviewedBy: string; reviewText: string; timestamp: string } | null;
  };

  // Disposition & Outcome
  disposition: {
    status: string | null;
    destinationUnit: string | null;
    durationInEr: string | null;
    conditionAtShift: string | null;
    managementPlan: string | null;
    consultsRequested: string[];
    followUpAdvice: string | null;
  };
  isPediatric: boolean;
  pediatricDetails: {
    weight: string | null;
    patAppearanceTone: string | null;
    patAppearanceInteractivity: string | null;
    patAppearanceConsolability: string | null;
    patAppearanceLookGaze: string | null;
    patAppearanceSpeechCry: string | null;
    patWorkOfBreathing: string | null;
    patCirculation: string | null;
    immunizationHistory: string | null;
    birthHistory: string | null;
    feedingHistory: string | null;
    developmentalHistory: string | null;
    broughtBy: string | null;
    informant: string | null;
  } | null;
  notes: { progressNotes: string | null; addendum: string | null };

  safetyAndAccreditation: {
    ipsg: string[];
    vulnerability: string[];
    fallRisk: string | null;
    consentTimeOut: string[];
  } | null;

  isMlc: boolean;

  signatureBlock: {
    clinicianName: string | null; // null means "not recorded" — never a fallback name
    consultantName: string | null; // EM Consultant name
    timestamp: string | null;
  };
}

interface Props {
  data?: CaseSheetData;
  clinicalCase?: ClinicalCase;
  onBack?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
}

// ── Known lab-name → ClinicalParam mapping for abnormal flagging ─────
// Only these get range-based ⚠️ flags. Anything else displays plainly
// — this avoids both false "everything is normal" silence AND false
// matches from casting arbitrary strings as ClinicalParam.
const LAB_NAME_TO_PARAM: Record<string, ClinicalParam> = {
  "hb": "hb", "hemoglobin": "hb", "haemoglobin": "hb",
  "wbc": "wbc", "tlc": "wbc",
  "platelets": "platelets", "plt": "platelets",
  "creatinine": "creatinine", "cr": "creatinine",
  "urea": "urea",
  "crp": "crp",
  "inr": "inr",
  "na": "na", "sodium": "na",
  "k": "k", "potassium": "k",
};

function matchLabParam(labName: string): ClinicalParam | null {
  const key = (labName || "").toLowerCase().trim();
  return LAB_NAME_TO_PARAM[key] || null;
}

// ── Helper to convert ClinicalCase model to CaseSheetData ────────────
export function convertClinicalCaseToCaseSheetData(c: ClinicalCase, defaultHospital?: string): CaseSheetData {
  const parseVal = (val: any): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
    return isNaN(num) ? null : num;
  };

  const vitals = c.vitals || ({} as any);
  const sysBp = vitals.bp ? parseVal(vitals.bp.split("/")[0]) : null;

  // SAMPLE History: separate cleanly, do not merge into past medical history
  // Canonical sampleHistory fields always take priority; fall back to legacy fields for read-only display
  const pastHx: string[] = [];
  if (c.sampleHistory?.pastHistory && typeof c.sampleHistory.pastHistory === "string" && c.sampleHistory.pastHistory.trim()) {
    pastHx.push(c.sampleHistory.pastHistory.trim());
  } else if ((c as any).pastMedicalHistory && typeof (c as any).pastMedicalHistory === "string" && (c as any).pastMedicalHistory.trim()) {
    pastHx.push((c as any).pastMedicalHistory.trim());
  } else if ((c as any).pastHistory && typeof (c as any).pastHistory === "string" && (c as any).pastHistory.trim()) {
    pastHx.push((c as any).pastHistory.trim());
  }

  let meds: string[] = [];
  if (c.sampleHistory?.medications && typeof c.sampleHistory.medications === "string" && c.sampleHistory.medications.trim()) {
    meds = [c.sampleHistory.medications.trim()];
  } else if ((c as any).currentMedications) {
    const rawM = (c as any).currentMedications;
    if (typeof rawM === "string" && rawM.trim()) {
      meds = [rawM.trim()];
    } else if (Array.isArray(rawM) && rawM.length > 0) {
      const parsed = rawM.map((m: any) => typeof m === "string" ? m : (m?.drugName || m?.name || "")).filter(Boolean);
      if (parsed.length > 0) meds = [parsed.join(", ")];
    }
  }

  const resolvedEvents = (c.sampleHistory?.events && typeof c.sampleHistory.events === "string" && c.sampleHistory.events.trim())
    ? c.sampleHistory.events.trim()
    : ((c as any).events && typeof (c as any).events === "string" && (c as any).events.trim())
      ? (c as any).events.trim()
      : null;

  const resolvedSymptoms: string[] = [];
  if (c.sampleHistory?.symptoms && typeof c.sampleHistory.symptoms === "string" && c.sampleHistory.symptoms.trim()) {
    resolvedSymptoms.push(c.sampleHistory.symptoms.trim());
  } else if (c.patient?.presentingComplaint && c.patient.presentingComplaint !== "Not documented") {
    resolvedSymptoms.push(c.patient.presentingComplaint);
  } else if ((c as any).symptoms) {
    const s = (c as any).symptoms;
    if (typeof s === "string" && s.trim()) resolvedSymptoms.push(s.trim());
    else if (Array.isArray(s) && s.length > 0) resolvedSymptoms.push(s.join(", "));
  }

  const resolvedAllergies: string[] = [];
  if (c.sampleHistory?.allergies && typeof c.sampleHistory.allergies === "string" && c.sampleHistory.allergies.trim()) {
    resolvedAllergies.push(c.sampleHistory.allergies.trim());
  } else if ((c as any).allergies) {
    const a = (c as any).allergies;
    if (typeof a === "string" && a.trim()) resolvedAllergies.push(a.trim());
    else if (Array.isArray(a) && a.length > 0) resolvedAllergies.push(a.join(", "));
  }

  const resolvedLastMeal = (c.sampleHistory?.lastMeal && typeof c.sampleHistory.lastMeal === "string" && c.sampleHistory.lastMeal.trim())
    ? c.sampleHistory.lastMeal.trim()
    : ((c as any).lastMeal && typeof (c as any).lastMeal === "string" && (c as any).lastMeal.trim())
      ? (c as any).lastMeal.trim()
      : null;

  const surveyObj = c.primaryAssessment?.survey;
  const primarySurvey: PrimarySurveyData = {
    airway: c.primaryAssessment?.airway || (surveyObj?.airway ? (
      surveyObj.airway.status ? `Status: ${surveyObj.airway.status}${surveyObj.airway.intervention ? `, Intervention: ${surveyObj.airway.intervention}` : ""}` : null
    ) : null),
    breathing: c.primaryAssessment?.breathing || (surveyObj?.breathing ? [
      surveyObj.breathing.workOfBreathing ? `Work: ${surveyObj.breathing.workOfBreathing}` : "",
      surveyObj.breathing.airEntry ? `Air Entry: ${surveyObj.breathing.airEntry}` : "",
      surveyObj.breathing.addedSounds ? `Sounds: ${surveyObj.breathing.addedSounds}` : "",
    ].filter(Boolean).join(", ") || null : null),
    circulation: c.primaryAssessment?.circulation || (surveyObj?.circulation ? [
      surveyObj.circulation.rhythm ? `Rhythm: ${surveyObj.circulation.rhythm}` : "",
      surveyObj.circulation.crt ? `CRT: ${surveyObj.circulation.crt}` : "",
      surveyObj.circulation.skinPerfusion ? `Skin: ${surveyObj.circulation.skinPerfusion}` : "",
      surveyObj.circulation.peripheralPulses ? `Pulses: ${surveyObj.circulation.peripheralPulses}` : "",
    ].filter(Boolean).join(", ") || null : null),
    disability: c.primaryAssessment?.disability || (surveyObj?.disability ? [
      surveyObj.disability.gcsTotal ? `GCS: ${surveyObj.disability.gcsTotal}` : "",
      surveyObj.disability.pupilReaction ? `Pupils: ${surveyObj.disability.pupilReaction}` : "",
      surveyObj.disability.focalDeficit ? `Focal Deficit: ${surveyObj.disability.focalDeficit}` : "",
    ].filter(Boolean).join(", ") || null : null),
    exposure: c.primaryAssessment?.exposure || (surveyObj?.exposure ? [
      surveyObj.exposure.skin ? `Skin: ${surveyObj.exposure.skin}` : "",
      surveyObj.exposure.logRoll ? `Log Roll: ${surveyObj.exposure.logRoll}` : "",
    ].filter(Boolean).join(", ") || null : null),
    vitalsContext: {
      rr: vitals.rr || (surveyObj?.breathing as any)?.rr || null,
      spo2: vitals.spo2 || (surveyObj?.breathing as any)?.spo2 || null,
      hr: vitals.hr || (surveyObj?.circulation as any)?.hr || null,
      bp: vitals.bp || (surveyObj?.circulation as any)?.bp || null,
      gcs: vitals.gcs || (surveyObj?.disability?.gcsTotal ? String(surveyObj.disability.gcsTotal) : null),
      gcsComponents: (vitals.gcs_e || vitals.gcs_v || vitals.gcs_m) ? `E${vitals.gcs_e || "?"}V${vitals.gcs_v || "?"}M${vitals.gcs_m || "?"}` : null,
      grbs: vitals.grbs || null,
      temp: vitals.temp || (surveyObj?.exposure as any)?.temp || null,
    }
  };

  const secInfo = c.dischargeInfo;
  const sec = (c as any).secondarySurvey || {};
  
  let parsedGeneral = secInfo?.secondaryPicle || sec.general || null;
  let parsedCvs = secInfo?.secondaryCvs || sec.cvs || null;
  let parsedRs = secInfo?.secondaryChest || sec.respiratory || sec.rs || null;
  let parsedPa = secInfo?.secondaryPa || sec.abdomen || sec.pa || null;
  let parsedCns = secInfo?.secondaryCns || sec.cns || null;
  let parsedExtremities = sec.extremities || null;

  if (c.secondaryAssessment && typeof c.secondaryAssessment === "string" && c.secondaryAssessment.trim()) {
    const text = c.secondaryAssessment;
    const normalizeSecKey = (k: string): "General" | "CVS" | "RS" | "PA" | "CNS" | "Extremities" | null => {
      const lower = k.trim().toLowerCase();
      if (lower === "rs" || lower === "respiratory" || lower === "chest" || lower.includes("respiratory") || lower.includes("chest / rs") || lower.includes("chest")) return "RS";
      if (lower === "pa" || lower === "abdomen" || lower.includes("abdomen") || lower.includes("per abdomen")) return "PA";
      if (lower === "cvs") return "CVS";
      if (lower === "cns") return "CNS";
      if (lower === "general") return "General";
      if (lower === "extremities" || lower.includes("extremities") || lower.includes("local") || lower.includes("trauma")) return "Extremities";
      return null;
    };

    const firstHeaderMatch = text.match(/(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Chest|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:\s*/i);
    const narrativeBuckets: Record<string, string> = {};
    if (firstHeaderMatch && firstHeaderMatch.index !== undefined && firstHeaderMatch.index > 0) {
      const preamble = text.substring(0, firstHeaderMatch.index).trim();
      if (preamble) narrativeBuckets.General = preamble;
    }

    const regex = /(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Chest|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:\s*(.*?)(?=(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Chest|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:\s*|$)/igs;
    let match;
    let foundAny = false;
    while ((match = regex.exec(text)) !== null) {
      foundAny = true;
      const bucket = normalizeSecKey(match[1]);
      const val = match[2].trim();
      if (bucket && val) {
        narrativeBuckets[bucket] = narrativeBuckets[bucket] ? `${narrativeBuckets[bucket]}\n${val}` : val;
      }
    }
    if (!foundAny && !parsedGeneral) {
      parsedGeneral = text.trim();
    } else {
      if (!parsedGeneral && narrativeBuckets.General) parsedGeneral = narrativeBuckets.General;
      if (!parsedCvs && narrativeBuckets.CVS) parsedCvs = narrativeBuckets.CVS;
      if (!parsedRs && narrativeBuckets.RS) parsedRs = narrativeBuckets.RS;
      if (!parsedPa && narrativeBuckets.PA) parsedPa = narrativeBuckets.PA;
      if (!parsedCns && narrativeBuckets.CNS) parsedCns = narrativeBuckets.CNS;
      if (!parsedExtremities && narrativeBuckets.Extremities) parsedExtremities = narrativeBuckets.Extremities;
    }
  }

  const secondarySurvey: SecondarySurveyData = {
    general: parsedGeneral,
    cvs: parsedCvs,
    respiratory: parsedRs,
    abdomen: parsedPa,
    cns: parsedCns,
    extremities: parsedExtremities,
  };

  let psychologicalAssessment: PsychologicalAssessmentData | null = null;
  if (c.psychologicalAssessment) {
    psychologicalAssessment = c.psychologicalAssessment;
  } else if (c.vulnerableAssessment || c.sampleHistory?.psychiatricFlags) {
    psychologicalAssessment = {
      suicidalIdeation: !!c.vulnerableAssessment?.suicidalIdeationRisk,
      selfHarmHistory: !!c.vulnerableAssessment?.suicidalIdeationRisk,
      intentToHarmOthers: false,
      substanceAbuse: false,
      psychiatricHistory: false,
      currentlyOnPsychiatricTreatment: false,
      hasSupportSystem: true,
      notes: c.sampleHistory?.psychiatricFlags || null,
    };
  }

  const treatmentList: string[] = [];
  if (Array.isArray(c.treatments) && c.treatments.length > 0) {
    c.treatments.forEach(t => {
      const parts: string[] = [];
      if (t.drugName) parts.push(t.drugName);
      if (t.dose) parts.push(t.dose);
      if (t.route) parts.push(t.route);
      if ((t as any).frequency) parts.push(`Freq: ${(t as any).frequency}`);
      if (t.timeGiven) parts.push(`Given: ${t.timeGiven}`);
      if (t.instruction) parts.push(`(${t.instruction})`);
      treatmentList.push(parts.join(" · ") || "Medication");
    });
  } else if (Array.isArray(c.medications)) {
    c.medications.forEach(m => {
      if (typeof m === "string") {
        treatmentList.push(m);
      } else if (m && typeof m === "object") {
        const parts: string[] = [];
        if (m.drugName) parts.push(m.drugName);
        if (m.dose) parts.push(m.dose);
        if (m.route) parts.push(m.route);
        if (m.frequency) parts.push(`Freq: ${m.frequency}`);
        treatmentList.push(parts.join(" · ") || "Medication");
      }
    });
  }
  if (Array.isArray(c.infusions)) {
    c.infusions.forEach(f => {
      const parts: string[] = [];
      if (f.fluidName) parts.push(f.fluidName);
      if (f.dose) parts.push(`Dose: ${f.dose}`);
      if (f.dilution) parts.push(`Dilution: ${f.dilution}`);
      if (f.rate) parts.push(`Rate: ${f.rate}`);
      treatmentList.push(parts.join(" · "));
    });
  }

  const labValues: LabPanel["values"] = [];
  if (Array.isArray(c.investigationResults)) {
    c.investigationResults.forEach(r => {
      labValues.push({
        name: r.name || "Lab Test",
        param: matchLabParam(r.name || ""),
        value: parseVal(r.value),
        unit: r.unit || ""
      });
    });
  }
  if (Array.isArray(c.investigations)) {
    c.investigations.forEach(i => {
      // Legacy array — only add if not already covered by investigationResults
      if (!labValues.some(lv => lv.name === i.testName)) {
        labValues.push({ name: i.testName, param: matchLabParam(i.testName), value: null, unit: "" });
      }
    });
  }

  // ── Adjuncts to Primary Assessment (Canonical first, legacy fallback) ──
  const adj = (c as any).adjuncts || {};
  const surveyAdj = surveyObj?.adjuncts;
  const surveyCirc = surveyObj?.circulation;

  // ECG
  const ecgFindings = surveyCirc?.ecg || surveyAdj?.ecgStatus || adj.ecgFindings || adj.ecgRhythm || "";
  const ecgDone = !!(surveyCirc?.ecg && surveyCirc.ecg !== "Not done") || !!(surveyAdj?.ecgStatus && surveyAdj.ecgStatus !== "Not done") || !!adj.ecgDone;

  // Echo
  const echoFindings = (surveyCirc as any)?.echo || surveyAdj?.echoStatus || adj.echoFindings || "";
  const echoDone = !!((surveyCirc as any)?.echo && (surveyCirc as any).echo !== "Not done") || !!(surveyAdj?.echoStatus && surveyAdj.echoStatus !== "Not done") || !!adj.echoDone;

  // eFAST
  let efastFindings = "";
  if (surveyCirc?.efast && typeof surveyCirc.efast === "object") {
    const ef = surveyCirc.efast;
    const pos = Object.entries(ef).filter(([_, v]) => v && v !== "not_done" && v !== "negative" && v !== "no_blines");
    if (pos.length > 0) {
      efastFindings = `Positive (${pos.map(([k, v]) => `${k}: ${v}`).join(", ")})`;
    } else {
      const anyDone = Object.values(ef).some(v => v && v !== "not_done");
      if (anyDone) efastFindings = "Negative";
    }
  }
  if (!efastFindings) {
    efastFindings = surveyAdj?.efastStatus || adj.efastInterpretation || adj.efastFindings || adj.efastNotes || "";
  }
  const efastDone = (efastFindings && efastFindings !== "Not done" && efastFindings !== "not_done") || !!adj.efastDone;

  // ABG / VBG
  const abgObj = surveyAdj?.abg;
  const vbgPerformed = !!(abgObj && (abgObj.interpretation || abgObj.ph || abgObj.finalDiagnosis)) || adj.abgStatus === "done";
  const abgType: "VBG" | "ABG" | null = (abgObj?.sampleType?.includes("VBG") || abgObj?.sampleType?.includes("Venous")) ? "VBG" : "ABG";
  const abgNotes = abgObj?.finalDiagnosis || abgObj?.interpretation || abgObj?.clinicalInterpretation || "";
  
  const vbgValues = vbgPerformed
    ? [
        { name: "pH", param: "ph" as ClinicalParam, value: parseVal(abgObj?.ph || adj.abgPh) },
        { name: "pCO2", param: "pco2" as ClinicalParam, value: parseVal(abgObj?.pco2 || adj.abgPco2) },
        { name: "HCO3", param: "hco3" as ClinicalParam, value: parseVal(abgObj?.hco3 || adj.abgHco3) },
        { name: "Lactate", param: "lactate" as ClinicalParam, value: parseVal(abgObj?.lactate || adj.abgLactate) },
        { name: "Na", param: "na" as ClinicalParam, value: parseVal(abgObj?.na || adj.abgNa) },
        { name: "K", param: "k" as ClinicalParam, value: parseVal(abgObj?.k || adj.abgK) },
      ].filter(v => v.value !== null)
    : [];

  const pediatricRaw = c.pediatricDetails as any;


  // Safety & Accreditation extraction
  const ipsgList: string[] = [];
  if (c.ipsgChecklist?.ipsg1IdentifiersVerified) ipsgList.push("Patient identifiers verified");
  if (c.ipsgChecklist?.ipsg2ReadBackPerformed) ipsgList.push("Verbal order read-back performed");
  if (c.ipsgChecklist?.ipsg3HighAlertDoubleChecked) ipsgList.push("High-alert meds double-checked");
  if (c.ipsgChecklist?.ipsg4TimeOutPerformed) ipsgList.push("Time-Out performed");
  if (c.ipsgChecklist?.ipsg5HandHygieneComplied) ipsgList.push("Hand hygiene complied");

  const fallRisk = c.ipsgChecklist?.ipsg6FallRiskAssessed || null;

  const vulnList: string[] = [];
  if (c.vulnerableAssessment?.severePainDistress) vulnList.push("Severe pain/distress identified");
  if (c.vulnerableAssessment?.isAlertOriented === false) vulnList.push("Impaired mental alertness");
  if (c.vulnerableAssessment?.suicidalIdeationRisk) vulnList.push("Psychiatric/suicidal risk");
  if (c.vulnerableAssessment?.confusionAgitation) vulnList.push("Active confusion or agitation");
  if (c.vulnerableAssessment?.needsMobilityAssistance) vulnList.push("Mobility assistance required");
  if (c.vulnerableAssessment?.recentFall) vulnList.push("Recent fall incidents");

  const consentList: string[] = [];
  if (c.consentTimeOut?.procedureConsentObtained) consentList.push("Written informed consent verified");
  if (c.consentTimeOut?.procedureTimeOutPerformed) consentList.push("Procedure time-out completed");

  let safetyAndAccreditation = null;
  if (ipsgList.length > 0 || vulnList.length > 0 || consentList.length > 0 || fallRisk) {
    safetyAndAccreditation = {
      ipsg: ipsgList,
      vulnerability: vulnList,
      fallRisk: fallRisk,
      consentTimeOut: consentList
    };
  }

  return {
    caseId: c.id,
    hospitalName: c.hospital || defaultHospital || undefined, // no hardcoded hospital name fallback either
    triageCategory: c.patient?.triageCategory || (c as any).triageCategory || null,
    caseType: c.patient?.caseType || (c as any).caseType || null,
    patient: {
      name: c.patient?.name || null,
      age: c.patient?.age ? parseVal(c.patient.age) : null,
      sex: c.patient?.gender ? (c.patient.gender.toUpperCase().startsWith("M") ? "M" : c.patient.gender.toUpperCase().startsWith("F") ? "F" : "O") : null,
      uhid: c.patient?.uhid || null,
      bed: c.bedNo || null
    },
    arrival: {
      date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null,
      time: c.admissionTime || null
    },
    // NEVER default to a specific named physician — a missing name
    // must display as "Not recorded", not a real doctor's name.
    clinician: c.doctorName || c.lastEditedByName || null,
    presentingComplaint: c.patient?.presentingComplaint || c.sampleHistory?.symptoms || "",

    initialVitals: [
      { label: "HR", param: "hr", value: parseVal(vitals.hr), unit: "bpm" },
      { label: "BP", param: "sbp", value: sysBp, unit: "mmHg" },
      { label: "RR", param: "rr", value: parseVal(vitals.rr), unit: "/min" },
      { label: "SpO2", param: "spo2", value: parseVal(vitals.spo2), unit: "%" },
      { label: "Temp", param: "temp", value: parseVal(vitals.temp), unit: "°C" },
      { label: "GRBS", param: "grbs", value: parseVal(vitals.grbs), unit: "mg/dL" },
      { label: "GCS", param: "gcs" as ClinicalParam, value: parseVal(vitals.gcs), displayValue: vitals.gcs || (vitals.gcs_e || vitals.gcs_v || vitals.gcs_m ? `${vitals.gcs_e || "?"}/${vitals.gcs_v || "?"}/${vitals.gcs_m || "?"}` : "15/15") }
    ],

    vbgAbg: { type: abgType, performed: vbgPerformed, values: vbgValues, notes: abgNotes || undefined },

    // NEVER default to a fabricated "normal" finding — only real data
    // or an explicit "Not documented" state.
    ecg: { performed: ecgDone, findings: ecgFindings },
    bedsideEcho: { performed: echoDone, findings: echoFindings },
    efast: { performed: efastDone, findings: efastFindings },

    symptoms: resolvedSymptoms,
    allergies: resolvedAllergies,
    currentMedications: meds,
    lastMeal: resolvedLastMeal,
    events: resolvedEvents,
    pastHistory: pastHx,
    treatment: { otherNotes: c.treatmentNotes || c.treatment?.otherNotes || undefined },
    primarySurvey,
    secondarySurvey,
    psychologicalAssessment,
    provisionalDiagnosis: (() => {
      // Canonical provisionalPrimaryDiagnosis first
      if (c.provisionalPrimaryDiagnosis && typeof c.provisionalPrimaryDiagnosis === "string" && c.provisionalPrimaryDiagnosis.trim()) {
        return c.provisionalPrimaryDiagnosis.trim();
      }
      // Historical diagnosis fields fallback for old saved cases (no assistant reasoning or differentials)
      if ((c as any).provisionalDiagnosis && typeof (c as any).provisionalDiagnosis === "string" && (c as any).provisionalDiagnosis.trim()) {
        return (c as any).provisionalDiagnosis.trim();
      }
      if (c.dischargeInfo?.primaryDiagnosis && typeof c.dischargeInfo.primaryDiagnosis === "string" && c.dischargeInfo.primaryDiagnosis.trim()) {
        return c.dischargeInfo.primaryDiagnosis.trim();
      }
      if ((c as any).primaryDiagnosis && typeof (c as any).primaryDiagnosis === "string" && (c as any).primaryDiagnosis.trim()) {
        return (c as any).primaryDiagnosis.trim();
      }
      if ((c.pediatricDetails as any)?.provisionalDiagnosisDischarge && typeof (c.pediatricDetails as any).provisionalDiagnosisDischarge === "string" && (c.pediatricDetails as any).provisionalDiagnosisDischarge.trim()) {
        return (c.pediatricDetails as any).provisionalDiagnosisDischarge.trim();
      }
      if ((c.pediatricDetails as any)?.dispositionProvisionalDiagnosis && typeof (c.pediatricDetails as any).dispositionProvisionalDiagnosis === "string" && (c.pediatricDetails as any).dispositionProvisionalDiagnosis.trim()) {
        return (c.pediatricDetails as any).dispositionProvisionalDiagnosis.trim();
      }
      if ((c as any).dispositionProvisionalDiagnosis && typeof (c as any).dispositionProvisionalDiagnosis === "string" && (c as any).dispositionProvisionalDiagnosis.trim()) {
        return (c as any).dispositionProvisionalDiagnosis.trim();
      }
      if ((c as any).diagnosis && typeof (c as any).diagnosis === "string" && (c as any).diagnosis.trim()) {
        return (c as any).diagnosis.trim();
      }
      return "";
    })(),
    provisionalDifferentialDiagnoses: c.provisionalDifferentialDiagnoses || null,
    differentials: (c.differentials || []).map(d => ({ diagnosis: d.diagnosis, status: d.status })),

    labs: labValues.length > 0 ? [{ panelName: "INVESTIGATIONS & LAB RESULTS", values: labValues }] : [],
    cultureResults: [],
    investigationImaging: (() => {
      if (c.investigationImaging && typeof c.investigationImaging === "string" && c.investigationImaging.trim()) {
        return c.investigationImaging.trim();
      }
      // Read-only fallback if investigationsOrdered contains imaging
      if ((c as any).investigationsOrdered) {
        const rawOrdered = (c as any).investigationsOrdered;
        const isImaging = (name: string, cat?: string) => {
          if (cat && /imaging|radiology|x-?ray|ct|mri|usg|scan|ultrasound/i.test(cat)) return true;
          return /\b(x-?ray|cxr|ct|mri|usg|ultrasound|pocus|2d echo|echo|radiograph|scan)\b/i.test(name.toLowerCase());
        };
        const imagingNames: string[] = [];
        if (Array.isArray(rawOrdered)) {
          rawOrdered.forEach((item: any) => {
            const name = (typeof item === "string" ? item : (item?.name || "")).trim();
            const cat = typeof item === "object" ? item?.category : undefined;
            if (name && isImaging(name, cat)) imagingNames.push(name);
          });
        } else if (typeof rawOrdered === "string" && rawOrdered.trim()) {
          rawOrdered.split(/[,;\n]+/).map(p => p.trim()).forEach(p => {
            if (p && isImaging(p)) imagingNames.push(p);
          });
        }
        if (imagingNames.length > 0) return imagingNames.join(", ");
      }
      return null;
    })(),
    investigationLabsOrdered: (() => {
      if (c.investigationLabsOrdered && typeof c.investigationLabsOrdered === "string" && c.investigationLabsOrdered.trim()) {
        return c.investigationLabsOrdered.trim();
      }
      // Read-only fallback if existing investigationsOrdered contains actual named lab investigations
      if ((c as any).investigationsOrdered) {
        const rawOrdered = (c as any).investigationsOrdered;
        const isImaging = (name: string, cat?: string) => {
          if (cat && /imaging|radiology|x-?ray|ct|mri|usg|scan|ultrasound/i.test(cat)) return true;
          return /\b(x-?ray|cxr|ct|mri|usg|ultrasound|pocus|2d echo|echo|radiograph|scan)\b/i.test(name.toLowerCase());
        };
        const labNames: string[] = [];
        if (Array.isArray(rawOrdered)) {
          rawOrdered.forEach((item: any) => {
            const name = (typeof item === "string" ? item : (item?.name || "")).trim();
            const cat = typeof item === "object" ? item?.category : undefined;
            if (name && !isImaging(name, cat)) labNames.push(name);
          });
        } else if (typeof rawOrdered === "string" && rawOrdered.trim()) {
          rawOrdered.split(/[,;\n]+/).map(p => p.trim()).forEach(p => {
            if (p && !isImaging(p)) labNames.push(p);
          });
        }
        if (labNames.length > 0) return labNames.join(", ");
      }
      return null;
    })(),
    investigationResultsSummary: c.investigationResultsSummary || null,

    treatmentGiven: treatmentList,
    treatmentNotes: c.treatmentNotes || c.treatment?.otherNotes || null,

    procedures: {
      proceduresChecked: Array.isArray(c.proceduresChecked) ? c.proceduresChecked : [],
      otherProcedures: c.otherProcedures || null,
    },

    consultation: {
      consultsRequested: Array.isArray(c.dispositionAndPlan?.consultsRequested) ? c.dispositionAndPlan.consultsRequested : [],
      consultantReview: c.consultantReview && (c.consultantReview.reviewedBy || c.consultantReview.reviewText) ? {
        reviewedBy: c.consultantReview.reviewedBy || "",
        reviewText: c.consultantReview.reviewText || "",
        timestamp: c.consultantReview.timestamp || "",
      } : null,
    },

    // Disposition & Outcome
    disposition: {
      status: c.dispositionDetails?.dispositionType || c.dispositionAndPlan?.dispositionStatus || null,
      destinationUnit: c.dispositionAndPlan?.destinationUnit || null,
      durationInEr: c.dispositionDetails?.durationInEr || null,
      conditionAtShift: c.conditionAtShift || (c.dispositionDetails as any)?.conditionAtShift || (c.pediatricDetails as any)?.dispositionConditionAtShift || null,
      managementPlan: c.dispositionAndPlan?.managementPlan || null,
      consultsRequested: Array.isArray(c.dispositionAndPlan?.consultsRequested) ? c.dispositionAndPlan.consultsRequested : [],
      followUpAdvice: c.dispositionAndPlan?.followUpAdvice || null,
    },

    isPediatric: !!c.isPediatric || (c.patient.age !== null && c.patient.age <= 16),
    pediatricDetails: (!!c.isPediatric || (c.patient.age !== null && c.patient.age <= 16)) && pediatricRaw ? {
      weight: pediatricRaw.patientWeight || pediatricRaw.weight || null,
      patAppearanceTone: pediatricRaw.patAppearanceTone || null,
      patAppearanceInteractivity: pediatricRaw.patAppearanceInteractivity || null,
      patAppearanceConsolability: pediatricRaw.patAppearanceConsolability || null,
      patAppearanceLookGaze: pediatricRaw.patAppearanceLookGaze || null,
      patAppearanceSpeechCry: pediatricRaw.patAppearanceSpeechCry || null,
      patWorkOfBreathing: pediatricRaw.patWorkOfBreathing || pediatricRaw.workOfBreathing || null,
      patCirculation: pediatricRaw.patCirculation || pediatricRaw.circulation || null,
      immunizationHistory: pediatricRaw.immunizationHistory || null,
      birthHistory: pediatricRaw.birthHistory || null,
      feedingHistory: pediatricRaw.feedingHistory || null,
      developmentalHistory: pediatricRaw.developmentalHistory || null,
      broughtBy: pediatricRaw.broughtBy || null,
      informant: pediatricRaw.informant || null,
    } : null,

    safetyAndAccreditation,
    notes: {
      progressNotes: (() => {
        const raw = c.progressNotes;
        if (!raw || typeof raw !== "string") return null;
        if (raw.trim() === "Case created via ErMate Voice Scribe dictation.") return null;
        return raw;
      })(),
      addendum: c.addendumNotes || null,
    },
    isMlc: !!(c.patient as any)?.isMlc,

    signatureBlock: {
      clinicianName: (c as any).emResident || c.doctorName || c.dispositionDetails?.residentName || (c.pediatricDetails as any)?.dispositionEmResident || null, // treating ER doctor / resident
      consultantName: (c as any).emConsultant || c.consultantName || c.dispositionDetails?.consultantName || c.consultantReview?.reviewedBy || (c.pediatricDetails as any)?.dispositionEmConsultant || null, // consultant
      timestamp: c.lastEditedAt || null
    }
  };
}

// ── Presentational helpers ────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-black tracking-widest uppercase border-b border-black pb-1 mb-2 print:text-black">
      {children}
    </h3>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`case-sheet-section py-3 border-b border-slate-300 print:border-black ${className}`}>
      {children}
    </div>
  );
}

function EmptyLine({ text = "Not documented" }: { text?: string }) {
  return <p className="text-sm text-slate-500 italic print:text-black">{text}</p>;
}

function PrimarySurveySection({ data }: { data: PrimarySurveyData }) {
  const v = data.vitalsContext;

  const airwayFindings = data.airway;
  const breathingFindings = data.breathing;
  const circulationFindings = data.circulation;
  const disabilityFindings = data.disability;
  const exposureFindings = data.exposure;

  const hasAnyData = airwayFindings || breathingFindings || circulationFindings || disabilityFindings || exposureFindings ||
    v?.rr || v?.spo2 || v?.hr || v?.bp || v?.gcs || v?.grbs || v?.temp;

  if (!hasAnyData) {
    return (
      <Section>
        <SectionHeading>Primary Survey (ABCDE)</SectionHeading>
        <EmptyLine />
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeading>Primary Survey (ABCDE)</SectionHeading>
      <div className="space-y-2 text-sm">
        {/* A - Airway */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">A — Airway: </span>
          <span>{airwayFindings || "Not documented"}</span>
        </div>

        {/* B - Breathing */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">B — Breathing: </span>
          <span>{breathingFindings || "Not documented"}</span>
          {(v?.rr || v?.spo2) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {v.rr && <span><strong className="font-sans text-[11px] text-slate-600">RR:</strong> {v.rr} /min</span>}
              {v.spo2 && <span><strong className="font-sans text-[11px] text-slate-600">SpO2:</strong> {v.spo2}%</span>}
            </div>
          )}
        </div>

        {/* C - Circulation */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">C — Circulation: </span>
          <span>{circulationFindings || "Not documented"}</span>
          {(v?.hr || v?.bp) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {v.hr && <span><strong className="font-sans text-[11px] text-slate-600">HR:</strong> {v.hr} bpm</span>}
              {v.bp && <span><strong className="font-sans text-[11px] text-slate-600">BP:</strong> {v.bp} mmHg</span>}
            </div>
          )}
        </div>

        {/* D - Disability */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">D — Disability: </span>
          <span>{disabilityFindings || "Not documented"}</span>
          {(v?.gcs || v?.gcsComponents || v?.grbs) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {v.gcs && <span><strong className="font-sans text-[11px] text-slate-600">GCS:</strong> {v.gcs}/15 {v.gcsComponents ? `(${v.gcsComponents})` : ""}</span>}
              {v.grbs && <span><strong className="font-sans text-[11px] text-slate-600">GRBS:</strong> {v.grbs} mg/dL</span>}
            </div>
          )}
        </div>

        {/* E - Exposure */}
        <div className="pb-0.5">
          <span className="font-bold text-slate-900">E — Exposure: </span>
          <span>{exposureFindings || "Not documented"}</span>
          {v?.temp && (
            <div className="inline-flex items-center gap-2 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              <span><strong className="font-sans text-[11px] text-slate-600">Temp:</strong> {v.temp}°C</span>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function AdjunctsSection({
  ecg,
  bedsideEcho,
  efast,
  vbgAbg,
}: {
  ecg: CaseSheetData["ecg"];
  bedsideEcho: CaseSheetData["bedsideEcho"];
  efast: CaseSheetData["efast"];
  vbgAbg: CaseSheetData["vbgAbg"];
}) {
  const hasAdjuncts =
    ecg.performed ||
    bedsideEcho.performed ||
    efast.performed ||
    vbgAbg.performed ||
    ecg.findings ||
    bedsideEcho.findings ||
    efast.findings ||
    (vbgAbg.values && vbgAbg.values.length > 0) ||
    vbgAbg.notes;

  if (!hasAdjuncts) {
    return (
      <Section>
        <SectionHeading>Adjuncts to Primary Assessment</SectionHeading>
        <EmptyLine text="No bedside adjuncts performed / documented" />
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeading>Adjuncts to Primary Assessment</SectionHeading>
      <div className="text-sm space-y-1.5">
        <div>
          <span className="font-semibold text-slate-900">ECG: </span>
          <span>{ecg.performed && ecg.findings ? ecg.findings : ecg.findings || "Not done"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">Bedside Echo / POCUS: </span>
          <span>{bedsideEcho.performed && bedsideEcho.findings ? bedsideEcho.findings : bedsideEcho.findings || "Not done"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">eFAST: </span>
          <span>{efast.performed && efast.findings ? efast.findings : efast.findings || "Not done"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">{vbgAbg.type || "ABG/VBG"}: </span>
          {vbgAbg.performed && vbgAbg.values.length > 0 ? (
            <span className="font-mono text-xs">
              {vbgAbg.values.map(v => `${v.name} ${formatFlagged(v.param, v.value)}`).join(" · ")}
              {vbgAbg.notes ? ` (${vbgAbg.notes})` : ""}
            </span>
          ) : vbgAbg.notes ? (
            <span>{vbgAbg.notes}</span>
          ) : (
            <span>Not documented</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function SecondarySurveySection({ data, title = "Secondary Survey / Systemic Examination" }: { data: SecondarySurveyData, title?: string }) {
  const items = [
    { label: "General", value: data.general },
    { label: "CVS", value: data.cvs },
    { label: "Respiratory", value: data.respiratory },
    { label: "Abdomen", value: data.abdomen },
    { label: "CNS", value: data.cns },
    { label: "Extremities", value: data.extremities },
  ].filter(item => item.value);

  return (
    <Section>
      <SectionHeading>{title}</SectionHeading>
      {items.length > 0 ? (
        <ul className="text-sm list-disc pl-5 space-y-0.5">
          {items.map((item, i) => (
            <li key={i}><span className="font-semibold">{item.label}:</span> {item.value}</li>
          ))}
        </ul>
      ) : <EmptyLine />}
    </Section>
  );
}

function PsychologicalAssessmentSection({ data }: { data: PsychologicalAssessmentData | null }) {
  if (!data) {
    return (
      <Section>
        <SectionHeading>Psychological Assessment</SectionHeading>
        <EmptyLine />
      </Section>
    );
  }

  const fields: { label: string; value: boolean; isRiskFlag: boolean }[] = [
    { label: "Suicidal Ideation", value: data.suicidalIdeation, isRiskFlag: true },
    { label: "Self-Harm History", value: data.selfHarmHistory, isRiskFlag: true },
    { label: "Intent to Harm Others", value: data.intentToHarmOthers, isRiskFlag: true },
    { label: "Substance Abuse", value: data.substanceAbuse, isRiskFlag: false },
    { label: "Psychiatric History", value: data.psychiatricHistory, isRiskFlag: false },
    { label: "Currently on Psychiatric Treatment", value: data.currentlyOnPsychiatricTreatment, isRiskFlag: false },
    { label: "Has Support System", value: data.hasSupportSystem, isRiskFlag: false },
  ];

  const hasActiveRiskFlag = fields.some(f => f.isRiskFlag && f.value === true);

  return (
    <Section className={hasActiveRiskFlag ? "bg-red-50 print:bg-transparent" : ""}>
      <SectionHeading>Psychological Assessment</SectionHeading>
      {hasActiveRiskFlag && (
        <p className="text-xs font-black text-red-700 uppercase mb-2 print:text-black">
          ⚠ Active Risk Flag(s) — Review Immediately
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {fields.map((f, i) => (
          <div key={i} className={f.isRiskFlag && f.value ? "font-bold text-red-700 print:text-black" : ""}>
            <span className="font-semibold">{f.label}:</span> {f.value ? "Yes" : "No"}
          </div>
        ))}
      </div>
      {data.notes && (
        <p className="text-sm mt-2"><span className="font-semibold">Notes:</span> {data.notes}</p>
      )}
    </Section>
  );
}


function SafetyAndAccreditationSection({ data }: { data: CaseSheetData["safetyAndAccreditation"] }) {
  if (!data) return null;

  return (
    <Section>
      <SectionHeading>Safety & Accreditation</SectionHeading>
      <div className="space-y-3">
        {(data.ipsg.length > 0 || data.fallRisk) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Patient Safety Goals</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.ipsg.map((item, i) => <li key={i}>{item}</li>)}
              {data.fallRisk && <li>Fall risk: <span className="font-semibold">{data.fallRisk}</span></li>}
            </ul>
          </div>
        )}
        
        {data.vulnerability.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Vulnerability Screening</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.vulnerability.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {data.consentTimeOut.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Consent / Time-Out</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.consentTimeOut.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

export default function CaseSheetPrintView({ data: propData, clinicalCase, onBack, onEdit, onPrint }: Props) {
  const data = propData || (clinicalCase ? convertClinicalCaseToCaseSheetData(clinicalCase) : null);

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <p className="font-bold text-lg">No Case Sheet Data Available</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-semibold">
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  const hospitalName = data.hospitalName || "[Hospital name not set]";

  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white text-slate-900 dark:text-slate-100 font-sans">
      {/* Toolbar — unchanged from original */}
      <div className="no-print sticky top-0 z-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all">
                <ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 hidden sm:block" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">Printable Case Sheet</span>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">ID: {data.caseId}</span>
              {data.isMlc && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">MLC</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onEdit && (
            <button onClick={onEdit} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all">
              <Edit3 className="w-3.5 h-3.5 text-slate-500" /><span>Edit<span className="hidden sm:inline"> Case Sheet</span></span>
            </button>
          )}
          <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 sm:px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
            <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Print / Download PDF</span><span className="sm:hidden">Print / PDF</span>
          </button>
        </div>
      </div>

      <div className="case-sheet-print max-w-3xl mx-auto bg-white shadow-md print:shadow-none px-8 py-8 my-6 print:my-0 text-slate-900 border border-slate-200 print:border-none rounded-xl print:rounded-none">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wide">{hospitalName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 print:text-black">Emergency Department — Case Sheet{data.isMlc ? " · MLC CASE" : ""}</p>
          </div>
          <div className="text-right text-xs font-mono">
            <div className="font-bold">Case ID: {data.caseId}</div>
            <div className="text-[10px] text-slate-500 print:text-black mt-0.5">Captured: {data.arrival.date || "N/A"} {data.arrival.time || ""}</div>
            <div className="text-[10px] text-slate-500 print:text-black">Confidential Medical Record</div>
          </div>
        </div>

        <Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div><span className="font-bold">Name:</span> {data.patient.name || "Not recorded"}</div>
            <div><span className="font-bold">Age / Sex:</span> {data.patient.age !== null ? `${data.patient.age}y` : "—"} {data.patient.sex || "—"}</div>
            <div><span className="font-bold">UHID:</span> {data.patient.uhid || "—"}</div>
            <div><span className="font-bold">Bed / Location:</span> {data.patient.bed || "—"}</div>
            <div><span className="font-bold">Arrival:</span> {data.arrival.date || "—"} {data.arrival.time || ""}</div>
            <div><span className="font-bold">Treating Clinician:</span> {data.clinician || "Not recorded"}</div>
            {data.triageCategory && (
              <div><span className="font-bold">Triage Category:</span> <span className="font-semibold uppercase">{data.triageCategory}</span></div>
            )}
            {data.caseType && (
              <div><span className="font-bold">Case Type:</span> <span className="capitalize">{data.caseType}</span></div>
            )}
          </div>
        </Section>

        <Section>
          <SectionHeading>Presenting Complaint</SectionHeading>
          <div className="text-sm font-medium">{data.presentingComplaint || <EmptyLine />}</div>
        </Section>

        {data.isPediatric ? (
          <>
            {data.pediatricDetails && (
              <Section>
                <SectionHeading>Pediatric Assessment (PAT)</SectionHeading>
                <div className="text-sm space-y-1">
                  <div><span className="font-bold">Weight:</span> {data.pediatricDetails.weight ? `${data.pediatricDetails.weight} kg` : "Not recorded"}</div>
                  <div>
                    <span className="font-bold">PAT — Appearance (TICLS):</span> 
                    Tone: {data.pediatricDetails.patAppearanceTone || "—"}, 
                    Interactivity: {data.pediatricDetails.patAppearanceInteractivity || "—"}, 
                    Consolability: {data.pediatricDetails.patAppearanceConsolability || "—"}, 
                    Look/Gaze: {data.pediatricDetails.patAppearanceLookGaze || "—"}, 
                    Speech/Cry: {data.pediatricDetails.patAppearanceSpeechCry || "—"}
                  </div>
                  <div><span className="font-bold">Work of Breathing:</span> {data.pediatricDetails.patWorkOfBreathing || "—"} | <span className="font-bold">Circulation:</span> {data.pediatricDetails.patCirculation || "—"}</div>
                  {data.pediatricDetails.birthHistory && <div><span className="font-bold">Birth History:</span> {data.pediatricDetails.birthHistory}</div>}
                  {data.pediatricDetails.feedingHistory && <div><span className="font-bold">Feeding History:</span> {data.pediatricDetails.feedingHistory}</div>}
                  {data.pediatricDetails.developmentalHistory && <div><span className="font-bold">Developmental History:</span> {data.pediatricDetails.developmentalHistory}</div>}
                  <div><span className="font-bold">Immunization History:</span> {data.pediatricDetails.immunizationHistory || "Not recorded"}</div>
                  {data.pediatricDetails.broughtBy && <div><span className="font-bold">Brought By:</span> {data.pediatricDetails.broughtBy}</div>}
                  {data.pediatricDetails.informant && <div><span className="font-bold">Informant:</span> {data.pediatricDetails.informant}</div>}
                </div>
              </Section>
            )}

            <PrimarySurveySection data={data.primarySurvey} />

            <AdjunctsSection
              ecg={data.ecg}
              bedsideEcho={data.bedsideEcho}
              efast={data.efast}
              vbgAbg={data.vbgAbg}
            />

            <Section>
              <SectionHeading>Secondary Assessment / SAMPLE History</SectionHeading>
              <div className="text-sm space-y-1.5">
                <div><span className="font-semibold text-slate-900">S — Signs & Symptoms:</span> {data.symptoms.length > 0 ? data.symptoms.join(", ") : ((data.pediatricDetails as LegacyPediatricDetails)?.historySignsSymptoms || "None documented")}</div>
                <div><span className="font-semibold text-slate-900">A — Allergies:</span> {data.allergies.length > 0 ? data.allergies.join(", ") : ((data.pediatricDetails as LegacyPediatricDetails)?.historyAllergies || "None documented")}</div>
                <div><span className="font-semibold text-slate-900">M — Medications:</span> {data.currentMedications.length > 0 ? data.currentMedications.join(", ") : ((data.pediatricDetails as LegacyPediatricDetails)?.historyMedications || "None documented")}</div>
                <div><span className="font-semibold text-slate-900">P — Past Medical History:</span> {data.pastHistory.length > 0 ? data.pastHistory.join(" · ") : ((data.pediatricDetails as LegacyPediatricDetails)?.historyPastMedical || "Not significant")}</div>
                <div><span className="font-semibold text-slate-900">L — Last Meal:</span> {data.lastMeal || (data.pediatricDetails as LegacyPediatricDetails)?.historyLastMeal || "Not documented"}</div>
                <div><span className="font-semibold text-slate-900">E — Events Preceding:</span> {data.events || (data.pediatricDetails as LegacyPediatricDetails)?.historyEvents || "Not documented"}</div>
              </div>
            </Section>

            <SecondarySurveySection data={data.secondarySurvey} title="Focused Physical Examination" />

            <Section>
              <SectionHeading>Investigations & Diagnostic Studies</SectionHeading>
              <div className="space-y-3">
                {data.investigationLabsOrdered && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Laboratory Investigations Ordered</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationLabsOrdered}</p>
                  </div>
                )}

                {data.labs.length > 0 && (
                  <div>
                    {data.labs.map((panel, i) => (
                      <div key={i} className="mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">{panel.panelName}</p>
                        <p className="text-sm font-mono leading-relaxed">
                          {panel.values.map(v => `${v.name}: ${v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending")}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`).join("  |  ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {data.investigationImaging && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Diagnostic Imaging (X-Ray / CT / MRI / USG)</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationImaging}</p>
                  </div>
                )}

                {data.investigationResultsSummary && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Investigation Results Summary</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationResultsSummary}</p>
                  </div>
                )}

                {!data.investigationLabsOrdered && data.labs.length === 0 && !data.investigationImaging && !data.investigationResultsSummary && (
                  <EmptyLine />
                )}
              </div>
            </Section>

            <Section>
              <SectionHeading>Treatment Given & Emergency Orders</SectionHeading>
              {data.treatmentGiven.length > 0 && (
                <ul className="text-sm list-disc pl-5 space-y-0.5 font-mono mb-2">
                  {data.treatmentGiven.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
              {data.treatmentNotes ? (
                <div>
                  {data.treatmentGiven.length > 0 && <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Treatment Notes & Orders</p>}
                  <p className="text-sm whitespace-pre-line font-mono">{data.treatmentNotes}</p>
                </div>
              ) : !data.treatmentGiven.length && (data.pediatricDetails as LegacyPediatricDetails)?.treatmentGiven ? (
                <div className="text-sm font-mono">{(data.pediatricDetails as LegacyPediatricDetails)?.treatmentGiven}</div>
              ) : !data.treatmentGiven.length && <EmptyLine />}
            </Section>

            {(data.procedures.proceduresChecked.length > 0 || data.procedures.otherProcedures) && (
              <Section>
                <SectionHeading>Procedures & Interventions</SectionHeading>
                <div className="text-sm space-y-1">
                  {data.procedures.proceduresChecked.length > 0 && (
                    <div><span className="font-bold">Procedures Performed:</span> {data.procedures.proceduresChecked.join(", ")}</div>
                  )}
                  {data.procedures.otherProcedures && (
                    <div><span className="font-bold">Procedure Details:</span> {data.procedures.otherProcedures}</div>
                  )}
                </div>
              </Section>
            )}

            <Section>
              <SectionHeading>Provisional Diagnosis</SectionHeading>
              <div className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || (data.pediatricDetails as LegacyPediatricDetails)?.provisionalDiagnosisDischarge || <EmptyLine />}</div>
            </Section>

            <Section>
              <SectionHeading>Differential Diagnosis</SectionHeading>
              {data.differentials.length > 0 ? (
                <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
                  {data.differentials.map((d, i) => <li key={i}>{d.diagnosis} ({d.status})</li>)}
                </ul>
              ) : data.provisionalDifferentialDiagnoses ? (
                <div className="text-sm whitespace-pre-line">{data.provisionalDifferentialDiagnoses}</div>
              ) : (data.pediatricDetails as LegacyPediatricDetails)?.differentialDiagnosis ? (
                <div className="text-sm">{((data.pediatricDetails as LegacyPediatricDetails)?.differentialDiagnosis)}</div>
              ) : <EmptyLine />}
              {data.differentials.length > 0 && data.provisionalDifferentialDiagnoses && (
                <div className="text-sm whitespace-pre-line mt-2 text-slate-700 print:text-black">
                  <span className="font-semibold">Notes / Differential Details:</span> {data.provisionalDifferentialDiagnoses}
                </div>
              )}
            </Section>

            {(data.consultation.consultsRequested.length > 0 || data.consultation.consultantReview) && (
              <Section>
                <SectionHeading>Specialist Consultation & Review</SectionHeading>
                <div className="text-sm space-y-1.5">
                  {data.consultation.consultsRequested.length > 0 && (
                    <div><span className="font-bold">Consults Requested:</span> {data.consultation.consultsRequested.join(", ")}</div>
                  )}
                  {data.consultation.consultantReview && (
                    <div className="bg-slate-50 print:bg-transparent p-2 rounded border border-slate-200 print:border-none">
                      <div className="font-bold text-xs uppercase tracking-wide text-slate-700 print:text-black">
                        Consultant Review{data.consultation.consultantReview.reviewedBy ? ` — ${data.consultation.consultantReview.reviewedBy}` : ""}
                        {data.consultation.consultantReview.timestamp ? ` (${data.consultation.consultantReview.timestamp})` : ""}
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-line">{data.consultation.consultantReview.reviewText}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section>
              <SectionHeading>Condition at Time of Shift / Disposition</SectionHeading>
              <div className="text-sm space-y-1">
                <div><span className="font-bold">Status:</span> {data.disposition.status || "Not yet determined"}</div>
                {data.disposition.destinationUnit && <div><span className="font-bold">Destination:</span> {data.disposition.destinationUnit}</div>}
                {data.disposition.durationInEr && <div><span className="font-bold">Duration in ER:</span> {data.disposition.durationInEr}</div>}
                {data.disposition.conditionAtShift && <div><span className="font-bold">Condition at Shift:</span> {data.disposition.conditionAtShift}</div>}
                {data.disposition.managementPlan && <div><span className="font-bold">Management Plan:</span> {data.disposition.managementPlan}</div>}
                {data.disposition.consultsRequested.length > 0 && <div><span className="font-bold">Consults Requested:</span> {data.disposition.consultsRequested.join(", ")}</div>}
                {data.disposition.followUpAdvice && <div><span className="font-bold">Follow-Up Advice:</span> {data.disposition.followUpAdvice}</div>}
              </div>
            </Section>
          </>
        ) : (
          <>
            <PrimarySurveySection data={data.primarySurvey} />

            <AdjunctsSection
              ecg={data.ecg}
              bedsideEcho={data.bedsideEcho}
              efast={data.efast}
              vbgAbg={data.vbgAbg}
            />

            <Section>
              <SectionHeading>SAMPLE History</SectionHeading>
              <div className="text-sm space-y-1.5">
                <div><span className="font-semibold text-slate-900">S — Signs & Symptoms:</span> {data.symptoms.length > 0 ? data.symptoms.join(", ") : "None documented"}</div>
                <div><span className="font-semibold text-slate-900">A — Allergies:</span> {data.allergies.length > 0 ? data.allergies.join(", ") : "None documented"}</div>
                <div><span className="font-semibold text-slate-900">M — Current Medications:</span> {data.currentMedications.length > 0 ? data.currentMedications.join(", ") : "None documented"}</div>
                <div><span className="font-semibold text-slate-900">P — Past Medical History:</span> {data.pastHistory.length > 0 ? data.pastHistory.join(" · ") : "Not significant"}</div>
                <div><span className="font-semibold text-slate-900">L — Last Meal:</span> {data.lastMeal || "Not documented"}</div>
                <div><span className="font-semibold text-slate-900">E — Events Preceding:</span> {data.events || "Not documented"}</div>
              </div>
            </Section>

            <SecondarySurveySection data={data.secondarySurvey} />
            <PsychologicalAssessmentSection data={data.psychologicalAssessment} />
            
            <Section>
              <SectionHeading>Provisional & Differential Diagnosis</SectionHeading>
              <div className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || <EmptyLine />}</div>
              {data.differentials.length > 0 && (
                <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
                  {data.differentials.map((d, i) => <li key={i}>{d.diagnosis} ({d.status})</li>)}
                </ul>
              )}
              {data.provisionalDifferentialDiagnoses && (
                <div className="text-sm whitespace-pre-line mt-2 text-slate-700 print:text-black">
                  {data.differentials.length > 0 && <span className="font-semibold">Notes / Differential Details: </span>}
                  {data.provisionalDifferentialDiagnoses}
                </div>
              )}
            </Section>

            <Section>
              <SectionHeading>Investigations & Diagnostic Studies</SectionHeading>
              <div className="space-y-3">
                {data.investigationLabsOrdered && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Laboratory Investigations Ordered</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationLabsOrdered}</p>
                  </div>
                )}

                {data.labs.length > 0 && (
                  <div>
                    {data.labs.map((panel, i) => (
                      <div key={i} className="mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">{panel.panelName}</p>
                        <p className="text-sm font-mono leading-relaxed">
                          {panel.values.map(v => `${v.name}: ${v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending")}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`).join("  |  ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {data.investigationImaging && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Diagnostic Imaging (X-Ray / CT / MRI / USG)</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationImaging}</p>
                  </div>
                )}

                {data.investigationResultsSummary && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Investigation Results Summary</p>
                    <p className="text-sm whitespace-pre-line text-slate-900 print:text-black">{data.investigationResultsSummary}</p>
                  </div>
                )}

                {!data.investigationLabsOrdered && data.labs.length === 0 && !data.investigationImaging && !data.investigationResultsSummary && (
                  <EmptyLine />
                )}
              </div>
            </Section>

            <Section>
              <SectionHeading>Treatment Given & Emergency Orders</SectionHeading>
              {data.treatmentGiven.length > 0 && (
                <ul className="text-sm list-disc pl-5 space-y-0.5 font-mono mb-2">
                  {data.treatmentGiven.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
              {data.treatmentNotes ? (
                <div>
                  {data.treatmentGiven.length > 0 && <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Treatment Notes & Orders</p>}
                  <p className="text-sm whitespace-pre-line font-mono">{data.treatmentNotes}</p>
                </div>
              ) : !data.treatmentGiven.length && <EmptyLine />}
            </Section>

            {(data.procedures.proceduresChecked.length > 0 || data.procedures.otherProcedures) && (
              <Section>
                <SectionHeading>Procedures & Interventions</SectionHeading>
                <div className="text-sm space-y-1">
                  {data.procedures.proceduresChecked.length > 0 && (
                    <div><span className="font-bold">Procedures Performed:</span> {data.procedures.proceduresChecked.join(", ")}</div>
                  )}
                  {data.procedures.otherProcedures && (
                    <div><span className="font-bold">Procedure Details:</span> {data.procedures.otherProcedures}</div>
                  )}
                </div>
              </Section>
            )}

            {(data.consultation.consultsRequested.length > 0 || data.consultation.consultantReview) && (
              <Section>
                <SectionHeading>Specialist Consultation & Review</SectionHeading>
                <div className="text-sm space-y-1.5">
                  {data.consultation.consultsRequested.length > 0 && (
                    <div><span className="font-bold">Consults Requested:</span> {data.consultation.consultsRequested.join(", ")}</div>
                  )}
                  {data.consultation.consultantReview && (
                    <div className="bg-slate-50 print:bg-transparent p-2 rounded border border-slate-200 print:border-none">
                      <div className="font-bold text-xs uppercase tracking-wide text-slate-700 print:text-black">
                        Consultant Review{data.consultation.consultantReview.reviewedBy ? ` — ${data.consultation.consultantReview.reviewedBy}` : ""}
                        {data.consultation.consultantReview.timestamp ? ` (${data.consultation.consultantReview.timestamp})` : ""}
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-line">{data.consultation.consultantReview.reviewText}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <SafetyAndAccreditationSection data={data.safetyAndAccreditation} />

            <Section>
              <SectionHeading>Disposition & Outcome</SectionHeading>
              <div className="text-sm space-y-1">
                <div><span className="font-bold">Status:</span> {data.disposition.status || "Not yet determined"}</div>
                {data.disposition.destinationUnit && <div><span className="font-bold">Destination:</span> {data.disposition.destinationUnit}</div>}
                {data.disposition.durationInEr && <div><span className="font-bold">Duration in ER:</span> {data.disposition.durationInEr}</div>}
                {data.disposition.conditionAtShift && <div><span className="font-bold">Condition at Shift:</span> {data.disposition.conditionAtShift}</div>}
                {data.disposition.managementPlan && <div><span className="font-bold">Management Plan:</span> {data.disposition.managementPlan}</div>}
                {data.disposition.consultsRequested.length > 0 && <div><span className="font-bold">Consults Requested:</span> {data.disposition.consultsRequested.join(", ")}</div>}
                {data.disposition.followUpAdvice && <div><span className="font-bold">Follow-Up Advice:</span> {data.disposition.followUpAdvice}</div>}
              </div>
            </Section>
          </>
        )}

        {((data.notes.progressNotes && data.notes.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation.") || data.notes.addendum) && (
          <Section>
            <SectionHeading>Clinical Notes & Addendum</SectionHeading>
            {data.notes.progressNotes && data.notes.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation." && (
              <p className="text-sm whitespace-pre-line">{data.notes.progressNotes}</p>
            )}
            {data.notes.addendum && <p className="text-sm whitespace-pre-line mt-1"><span className="font-bold">Addendum:</span> {data.notes.addendum}</p>}
          </Section>
        )}

        <div className="pt-8 mt-4 flex flex-wrap items-end justify-between text-sm gap-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="border-t border-black pt-1.5 w-52 text-center font-bold">
                {data.signatureBlock.clinicianName || "Not recorded"}
              </div>
              <p className="text-xs text-center text-slate-500 print:text-black">
                {data.isPediatric ? "EM Resident" : "Treating ER Physician"}
              </p>
            </div>
            {data.signatureBlock.consultantName && (
              <div>
                <div className="border-t border-black pt-1.5 w-52 text-center font-bold">
                  {data.signatureBlock.consultantName}
                </div>
                <p className="text-xs text-center text-slate-500 print:text-black">EM Consultant</p>
              </div>
            )}
          </div>
          
          <div className="text-xs text-right font-mono text-slate-500 print:text-black">
            <div>Date/Time: {data.signatureBlock.timestamp || "Not recorded"}</div>
            <div className="text-[10px] italic">Electronically Signed Record</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .case-sheet-print { font-family: 'Times New Roman', Times, serif !important; font-size: 11pt !important; color: #000 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          .case-sheet-section { page-break-inside: avoid !important; border-color: #000 !important; padding-top: 6px !important; padding-bottom: 6px !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
