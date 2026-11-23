import React, { useState, useEffect } from "react";
import { formatFlagged, isCulturePositive, type ClinicalParam } from "./clinicalRanges";
import { ArrowLeft, Edit3, Printer, FileText, AlertTriangle, CheckCircle, RefreshCw, Copy, Check, Pencil } from "lucide-react";
import { ClinicalCase, LegacyPediatricDetails, ProcedureNote, IpsgChecklist } from "../types";
import { deduplicateConsultations } from "../utils/consultationNormalization";
import { displayGcs, displayTemperature, displaySpo2, displayGrbs, displayDocumentedBoolean } from "../utils/clinicalFormatter";
import { getDisplayCaseId } from "../utils/caseIdentity";
import { formatCaseSheetText, formatCaseSheetHtml } from "../utils/caseSheetFormat";
import { buildErCaseRecord, type ErLine } from "../utils/erCaseRecord";
import { EditableBlock, InlineSpan, INLINE_EDIT_CSS, InlineEditCtx, EdText, EdBlock } from "./InlineEdit";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import CopyToEmrPanel from "./CopyToEmrPanel"; // ← NEW
import { getTriageDisplay } from "../utils/triageScale";
import { screeningLines, isolationBanner } from "../utils/triageScreening";
import { formatAge } from "../utils/ageLabel";
import type { TriageScreening } from "../types";
import { EDIT_GROUPS, EDIT_SECTIONS, applySectionEdits, isEditableSection } from "../lib/previewedit";
import { requestTour } from "../lib/coachTours";

export { formatCaseSheetText };

export interface VitalReading {
  label: string;
  param: ClinicalParam;
  value: number | null;
  displayValue?: string;
  unit?: string;
}

export interface LabPanel {
  panelName: string;
  /** `text` carries a result that is not a plain number ("Positive", "Fatty liver", "Positive 2+"), so it is shown as stated and not as "Pending". */
  values: { name: string; param: ClinicalParam | null; value: number | null; unit?: string; text?: string }[];
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
  suicidalIdeation?: boolean | null;
  selfHarmHistory?: boolean | null;
  intentToHarmOthers?: boolean | null;
  substanceAbuse?: boolean | null;
  psychiatricHistory?: boolean | null;
  currentlyOnPsychiatricTreatment?: boolean | null;
  hasSupportSystem?: boolean | null;
  notes?: string | null;
}

export interface CaseSheetData {
  caseId: string;
  internalCaseId?: string;
  hospitalName?: string;
  triageCategory?: string | null;
  triageScreening?: TriageScreening | null;
  caseType?: string | null;
  patient: {
    name: string | null;
    age: number | null;
    ageMonths?: number | null;
    ageDays?: number | null;
    sex: "M" | "F" | "O" | null;
    uhid: string | null;
    bed: string | null;
    weight?: string | null;
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
    procedureNotes?: ProcedureNote[];
  };

  consultation: {
    consultsRequested: string[];
    consultantReview: { reviewedBy: string; reviewText: string; timestamp: string } | null;
  };

  // Disposition & Outcome
  disposition: {
    status: string | null;
    destinationUnit: string | null;
    /** What the doctor said about the disposition in words, when it is longer than a destination. */
    observationNotes?: string | null;
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
    hasAnyIpsg?: boolean;
    ipsgChecklist?: IpsgChecklist | null;
    ipsg: string[];
    vulnerability: string[];
    fallRisk: string | null;
    consentTimeOut: string[];
  } | null;

  isMlc: boolean;
  mlcDetails: {
    natureOfIncident: string | null;
    dateTimeOfIncident: string | null;
    placeOfIncident: string | null;
    identificationMark: string | null;
    informantBroughtBy: string | null;
    policeStation: string | null;
  } | null;
  familyHistory: string | null;
  socialHistory?: string | null;
  hpi: string | null;
  surgicalHistory: string | null;
  lmp: string | null;

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
  isPreview?: boolean;
  onApplyPreview?: (reviewedCase: ClinicalCase) => Promise<void> | void;
  onViewCaseSheet?: (caseId: string) => void;
  // Fallback header name (doctor's workplace) when the case itself has none.
  defaultHospital?: string;
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
      gcsComponents: (vitals.gcs_e || vitals.gcs_v || vitals.gcs_m) ? displayGcs(vitals) : null,
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
      if (lower.startsWith("rs") || lower.includes("respiratory") || lower.includes("chest") || lower.includes("lung")) return "RS";
      if (lower.startsWith("pa") || lower.startsWith("p/a") || lower.startsWith("p / a") || lower.includes("abdomen") || lower.includes("abdominal")) return "PA";
      if (lower.includes("cvs") || lower.includes("cardiovascular") || lower.includes("heart")) return "CVS";
      if (lower.includes("cns") || lower.includes("neurological") || lower.includes("neuro")) return "CNS";
      if (lower.includes("general")) return "General";
      if (lower.includes("extremit") || lower.includes("local") || lower.includes("trauma") || lower.includes("musculoskeletal") || lower.includes("msk")) return "Extremities";
      return null;
    };

    const headerPattern = "(?:general(?:\\s+examination|\\s+exam)?|cvs(?:\\s+examination|\\s+exam)?|cardiovascular(?:\\s+examination|\\s+exam)?|respiratory(?:\\s+system|\\s+examination|\\s+exam)?|rs(?:\\s+examination|\\s+exam)?|chest(?:\\s+examination|\\s+exam)?|per\\s+abdomen(?:\\s+examination|\\s+exam)?|p\\s*\\/\\s*a(?:\\s+examination|\\s+exam)?|pa(?:\\s+examination|\\s+exam)?|abdomen(?:\\s+examination|\\s+exam)?|abdominal(?:\\s+examination|\\s+exam)?|cns(?:\\s+examination|\\s+exam)?|neurological(?:\\s+examination|\\s+exam)?|extremities(?:\\s+examination|\\s+exam)?|extremity(?:\\s+examination|\\s+exam)?|musculoskeletal(?:\\s+examination|\\s+exam)?|msk)";

    const narrativeBuckets: Record<string, string> = {};
    const regex = new RegExp(`(?:^|[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(${headerPattern})\\s*[:\\-]\\s*([\\s\\S]*?)(?=(?:[\\n;,]|\\.\\s+|:\\s*|[-*•]\\s*|\\s+)(?:${headerPattern})\\s*[:\\-]|$)`, "gi");
    let match;
    let foundAny = false;
    while ((match = regex.exec(text)) !== null) {
      foundAny = true;
      const bucket = normalizeSecKey(match[1]);
      let val = (match[2] || "").trim();
      val = val.replace(/^[,\.\s;:\-]+/, "").replace(/[,\.\s;:\-]+$/, "").trim();
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

  // Pediatric fallback: the manual pediatric form stores ABCDE and focused exam in
  // pediatricDetails.* (PediatricABCDESections). Use them only when the shared
  // primary/secondary fields are empty, so adult and dictated cases are unaffected.
  const pedFallback = c.pediatricDetails as any;
  const isPedForSurvey = !!c.isPediatric || (Number.isFinite(parseFloat(String(c.patient?.age ?? ""))) && parseFloat(String(c.patient?.age)) <= 16);
  if (isPedForSurvey && pedFallback) {
    const j = (parts: Array<string | false | null | undefined>) => {
      const out = parts.filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(", ");
      return out || null;
    };
    const lbl = (label: string, v: any) => (v !== undefined && v !== null && String(v).trim() ? `${label}: ${String(v).trim()}` : null);
    primarySurvey.airway = primarySurvey.airway || j([
      lbl("Status", pedFallback.airwayStatus), lbl("Cry", pedFallback.airwayCry), lbl("Intervention", pedFallback.airwayIntervention),
    ]);
    primarySurvey.breathing = primarySurvey.breathing || j([
      lbl("Work of breathing", pedFallback.breathingWob), lbl("Abnormal positioning", pedFallback.breathingAbnormalPositioning),
      lbl("Air entry", pedFallback.breathingAirEntry), lbl("Subcutaneous emphysema", pedFallback.breathingSubcutaneousEmphysema),
      lbl("Intervention", pedFallback.breathingIntervention),
    ]);
    primarySurvey.circulation = primarySurvey.circulation || j([
      lbl("CRT", pedFallback.circulationCrt), lbl("Skin colour/temp", pedFallback.circulationSkinColorTemp),
      lbl("Distended neck veins", pedFallback.circulationDistendedNeckVeins), lbl("Intervention", pedFallback.circulationIntervention),
    ]);
    primarySurvey.disability = primarySurvey.disability || j([
      lbl("AVPU/GCS", pedFallback.disabilityAvpuGcs), lbl("Pupils", pedFallback.disabilityPupils),
      lbl("Abnormal responses", pedFallback.disabilityAbnormalResponses), lbl("GRBS", pedFallback.disabilityGrbs),
    ]);
    primarySurvey.exposure = primarySurvey.exposure || j([
      lbl("Temp", pedFallback.exposureTemp), lbl("Log roll", pedFallback.exposureTraumaLogroll),
      lbl("Signs of trauma", pedFallback.exposureSignsOfTrauma), lbl("Infection/bleeding", pedFallback.exposureEvidenceInfectionBleeding),
      lbl("Long bone deformities", pedFallback.exposureLongBoneDeformities), lbl("Extremities", pedFallback.exposureExtremitiesCheck),
      lbl("Injured limbs immobilised", pedFallback.exposureImmobilizeInjuredLimbs),
    ]);
    primarySurvey.vitalsContext.grbs = primarySurvey.vitalsContext.grbs || pedFallback.disabilityGrbs || null;
    primarySurvey.vitalsContext.temp = primarySurvey.vitalsContext.temp || pedFallback.exposureTemp || null;

    secondarySurvey.general = secondarySurvey.general || lbl("HEENT", pedFallback.examHeent || pedFallback.focusedHeent);
    secondarySurvey.respiratory = secondarySurvey.respiratory || pedFallback.focusedRespiratory || null;
    secondarySurvey.cvs = secondarySurvey.cvs || pedFallback.focusedCardiovascular || null;
    secondarySurvey.abdomen = secondarySurvey.abdomen || pedFallback.focusedAbdomen || null;
    secondarySurvey.extremities = secondarySurvey.extremities || j([
      pedFallback.focusedExtremities, lbl("Back", pedFallback.focusedBack),
    ]);
  }

  // The assessment can arrive as plain text, as a structured object, or only as the SAMPLE-history note.
  // A text value (what extraction and pasted sheets produce) used to be read as an object and showed "Not documented".
  let psychologicalAssessment: PsychologicalAssessmentData | null = null;
  const psyRaw: any = c.psychologicalAssessment;
  const psyFlags = typeof c.sampleHistory?.psychiatricFlags === "string" ? c.sampleHistory.psychiatricFlags.trim() : "";
  if (typeof psyRaw === "string" && psyRaw.trim()) {
    psychologicalAssessment = { notes: psyRaw.trim() };
  } else if (psyRaw && typeof psyRaw === "object") {
    const hasNotes = typeof psyRaw.notes === "string" && psyRaw.notes.trim();
    psychologicalAssessment = psyFlags && !hasNotes ? { ...psyRaw, notes: psyFlags } : psyRaw;
  } else if (psyFlags) {
    psychologicalAssessment = { notes: psyFlags };
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

  // A result that is words ("Positive", "Fatty liver") or starts with words ("Positive 2+") is kept as stated.
  // Only a result that begins with a number is read as a number (and flagged high/low).
  const labText = (raw: any): string | undefined => {
    const t = raw === null || raw === undefined ? "" : String(raw).trim();
    if (!t || /^(?:ordered|pending|sent|awaited|not\s+done)\.?$/i.test(t)) return undefined;
    if (parseVal(t) === null) return t;
    return /^[A-Za-z]/.test(t) ? t : undefined;
  };
  const labValues: LabPanel["values"] = [];
  if (Array.isArray(c.investigationResults)) {
    c.investigationResults.forEach(r => {
      const text = labText(r.value);
      labValues.push({
        name: r.name || "Lab Test",
        param: matchLabParam(r.name || ""),
        value: text ? null : parseVal(r.value),
        unit: r.unit || "",
        ...(text ? { text } : {}),
      });
    });
  }
  if (Array.isArray(c.investigations)) {
    c.investigations.forEach(i => {
      // Legacy array — only add if not already covered by investigationResults
      if (!labValues.some(lv => lv.name === i.testName)) {
        const text = labText(i.result);
        labValues.push({ name: i.testName, param: matchLabParam(i.testName), value: text ? null : parseVal(i.result), unit: "", ...(text ? { text } : {}) });
      }
    });
  }

  // ── Adjuncts to Primary Assessment (Canonical first, legacy fallback) ──
  const adj = (c as any).adjuncts || {};
  const surveyAdj = surveyObj?.adjuncts;
  const surveyCirc = surveyObj?.circulation;

  // ECG
  const ecgDropdown = surveyAdj?.ecgStatus && surveyAdj.ecgStatus !== "Not done" ? surveyAdj.ecgStatus : "";
  const rawEcgNotes = surveyAdj?.ecgNotes || adj.ecgNotes || surveyCirc?.ecg || adj.ecgFindings || adj.ecgRhythm || "";
  const ecgFindings = (() => {
    if (ecgDropdown && rawEcgNotes) {
      return rawEcgNotes.toLowerCase().includes(ecgDropdown.toLowerCase()) ? rawEcgNotes : `${ecgDropdown} — ${rawEcgNotes}`;
    }
    return ecgDropdown || rawEcgNotes || "";
  })();
  const ecgDone = !!(surveyCirc?.ecg && surveyCirc.ecg !== "Not done") || !!(surveyAdj?.ecgStatus && surveyAdj.ecgStatus !== "Not done") || !!adj.ecgDone || !!rawEcgNotes;

  // Echo
  const echoDropdown = surveyAdj?.echoStatus && surveyAdj.echoStatus !== "Not done" ? surveyAdj.echoStatus : "";
  const rawEchoNotes = surveyAdj?.echoNotes || surveyAdj?.echoFindings || adj.echoNotes || adj.echoFindings || (surveyCirc as any)?.echo || "";
  const echoFindings = (() => {
    if (echoDropdown && rawEchoNotes) {
      return rawEchoNotes.toLowerCase().includes(echoDropdown.toLowerCase()) ? rawEchoNotes : `${echoDropdown} — ${rawEchoNotes}`;
    }
    return echoDropdown || rawEchoNotes || "";
  })();
  const echoDone = !!((surveyCirc as any)?.echo && (surveyCirc as any).echo !== "Not done") || !!(surveyAdj?.echoStatus && surveyAdj.echoStatus !== "Not done") || !!adj.echoDone || !!rawEchoNotes;

  // eFAST
  let efastFindings = "";
  const fastFindingsObj = (c as any).fastFindings;
  const combinedEfast: Record<string, any> = {
    ...(surveyCirc?.efast && typeof surveyCirc.efast === "object" ? surveyCirc.efast : {}),
    ...(fastFindingsObj && typeof fastFindingsObj === "object" ? fastFindingsObj : {})
  };

  const pos = Object.entries(combinedEfast).filter(([_, v]) => {
    if (!v) return false;
    const str = String(v).toLowerCase();
    return str !== "not_done" && str !== "negative" && str !== "no_blines" && (str.includes("pos") || str === "done" || str.includes("fluid"));
  });

  if (pos.length > 0) {
    efastFindings = `Positive (${pos.map(([k, v]) => `${k}: ${v}`).join(", ")})`;
  } else if (Object.keys(combinedEfast).length > 0) {
    const anyDone = Object.values(combinedEfast).some(v => v && v !== "not_done");
    if (anyDone) efastFindings = "Negative";
  }

  const explicitNotes = surveyAdj?.efastNotes || adj.efastNotes || adj.efastInterpretation || adj.efastFindings || (surveyAdj?.efastStatus && surveyAdj.efastStatus !== "Not done" ? surveyAdj.efastStatus : "") || "";
  if (explicitNotes) {
    if (!efastFindings || efastFindings === "Negative") {
      efastFindings = explicitNotes;
    } else if (!efastFindings.toLowerCase().includes(explicitNotes.toLowerCase())) {
      efastFindings = `${efastFindings} · ${explicitNotes}`;
    }
  }
  {
    const pedE = c.pediatricDetails as any;
    if (!efastFindings && pedE) {
      const parts = [
        pedE.adjuvantEfastHeart && `Heart: ${pedE.adjuvantEfastHeart}`,
        pedE.adjuvantEfastLungs && `Lungs: ${pedE.adjuvantEfastLungs}`,
        pedE.adjuvantEfastAbdomen && `Abdomen: ${pedE.adjuvantEfastAbdomen}`,
        pedE.adjuvantEfastPelvis && `Pelvis: ${pedE.adjuvantEfastPelvis}`,
      ].filter(Boolean);
      if (parts.length > 0) efastFindings = parts.join(", ");
    }
  }
  const efastDone = Boolean((efastFindings && efastFindings !== "Not done" && efastFindings !== "not_done") || adj.efastDone || (surveyAdj?.efastStatus && surveyAdj.efastStatus !== "Not done"));

  // ABG / VBG
  const abgObj = surveyAdj?.abg;
  const vbgPerformed = !!(abgObj && (abgObj.interpretation || abgObj.ph || abgObj.finalDiagnosis)) || adj.abgStatus === "done";
  const abgType: "VBG" | "ABG" | null = (abgObj?.sampleType?.includes("VBG") || abgObj?.sampleType?.includes("Venous"))
    ? "VBG"
    : ((abgObj?.sampleType?.includes("ABG") || abgObj?.sampleType?.includes("Arterial")) ? "ABG" : null);
  const abgNotes = abgObj?.finalDiagnosis || abgObj?.interpretation || abgObj?.clinicalInterpretation || "";
  
  const vbgValues = vbgPerformed
    ? [
        { name: "pH", param: "ph" as ClinicalParam, value: parseVal(abgObj?.ph || adj.abgPh) },
        { name: "pCO2", param: "pco2" as ClinicalParam, value: parseVal(abgObj?.pco2 || adj.abgPco2) },
        { name: "pO2", param: "po2" as ClinicalParam, value: parseVal(abgObj?.po2 || adj.abgPo2) },
        { name: "HCO3", param: "hco3" as ClinicalParam, value: parseVal(abgObj?.hco3 || adj.abgHco3) },
        { name: "BE", param: "be" as ClinicalParam, value: parseVal(abgObj?.be || adj.abgBe) },
        { name: "Lactate", param: "lactate" as ClinicalParam, value: parseVal(abgObj?.lactate || adj.abgLactate) },
        { name: "SaO2", param: "sao2" as ClinicalParam, value: parseVal(abgObj?.sao2 || adj.abgSao2) },
        { name: "FiO2", param: "fio2" as ClinicalParam, value: parseVal(abgObj?.fio2 || adj.abgFio2) },
        { name: "Na", param: "na" as ClinicalParam, value: parseVal(abgObj?.na || adj.abgNa) },
        { name: "K", param: "k" as ClinicalParam, value: parseVal(abgObj?.k || adj.abgK) },
        { name: "Cl", param: "cl" as ClinicalParam, value: parseVal(abgObj?.cl || adj.abgCl) },
        { name: "AG", param: "anionGap" as ClinicalParam, value: parseVal(abgObj?.ag || adj.abgAnionGap) },
        { name: "Glucose", param: "glucose" as ClinicalParam, value: parseVal(abgObj?.glucose || adj.abgGlucose) },
        { name: "Hb", param: "hb" as ClinicalParam, value: parseVal(abgObj?.hb || adj.abgHb) },
        { name: "A-a", param: "aa" as ClinicalParam, value: parseVal(abgObj?.aa || adj.abgAa) },
      ].filter(v => v.value !== null)
    : [];

  const pediatricRaw = c.pediatricDetails as any;


  // Safety & Accreditation extraction
  const ipsg = c.ipsgChecklist;
  const ipsgList: string[] = [];
  if (ipsg?.ipsg1IdentifiersVerified === true) ipsgList.push("Patient identifiers verified");
  if (ipsg?.ipsg2ReadBackPerformed === true) ipsgList.push("Verbal order read-back performed");
  if (ipsg?.ipsg3HighAlertDoubleChecked === true) ipsgList.push("High-alert meds double-checked");
  if (ipsg?.ipsg4TimeOutPerformed === true) ipsgList.push("Time-Out performed");
  if (ipsg?.ipsg5HandHygieneComplied === true) ipsgList.push("Hand hygiene complied");

  const fallRisk = ipsg?.ipsg6FallRiskAssessed || null;

  const hasAnyIpsg = Boolean(
    ipsg && (
      (ipsg.ipsg1IdentifiersVerified !== undefined && ipsg.ipsg1IdentifiersVerified !== null && (ipsg.ipsg1IdentifiersVerified as any) !== "") ||
      (ipsg.ipsg2ReadBackPerformed !== undefined && ipsg.ipsg2ReadBackPerformed !== null && (ipsg.ipsg2ReadBackPerformed as any) !== "") ||
      (ipsg.ipsg3HighAlertDoubleChecked !== undefined && ipsg.ipsg3HighAlertDoubleChecked !== null && (ipsg.ipsg3HighAlertDoubleChecked as any) !== "") ||
      (ipsg.ipsg4TimeOutPerformed !== undefined && ipsg.ipsg4TimeOutPerformed !== null && (ipsg.ipsg4TimeOutPerformed as any) !== "") ||
      (ipsg.ipsg5HandHygieneComplied !== undefined && ipsg.ipsg5HandHygieneComplied !== null && (ipsg.ipsg5HandHygieneComplied as any) !== "") ||
      (ipsg.ipsg6FallRiskAssessed !== undefined && ipsg.ipsg6FallRiskAssessed !== null && String(ipsg.ipsg6FallRiskAssessed).trim() !== "")
    )
  );

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

  const safetyAndAccreditation = {
    hasAnyIpsg,
    ipsgChecklist: ipsg || null,
    ipsg: ipsgList,
    vulnerability: vulnList,
    fallRisk: fallRisk,
    consentTimeOut: consentList
  };

  return {
    caseId: getDisplayCaseId(c),
    internalCaseId: c.id,
    hospitalName: c.hospital || c.hospitalLabel || c.workplaceName || defaultHospital || undefined, // no hardcoded hospital name fallback either
    triageCategory: c.patient?.triageCategory ? getTriageDisplay(c.patient).label : ((c as any).triageCategory || null),
    triageScreening: c.patient?.triageScreening || null,
    caseType: c.patient?.caseType || (c as any).caseType || null,
    patient: {
      name: c.patient?.name || null,
      age: (c.patient?.age !== null && c.patient?.age !== undefined) ? parseVal(c.patient.age) : null,
      ageMonths: c.patient?.ageMonths ?? null,
      ageDays: c.patient?.ageDays ?? null,
      sex: c.patient?.gender ? (c.patient.gender.toUpperCase().startsWith("M") ? "M" : c.patient.gender.toUpperCase().startsWith("F") ? "F" : "O") : null,
      uhid: c.patient?.uhid || null,
      bed: c.bedNo || null,
      weight: c.patient?.weight || c.vitals?.weight || c.pediatricDetails?.patientWeight || c.pediatricDetails?.weight || null
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
      { label: "SpO2", param: "spo2", value: parseVal(vitals.spo2), displayValue: displaySpo2(vitals.spo2) },
      { label: "Temp", param: "temp", value: parseVal(vitals.temp), displayValue: displayTemperature(vitals.temp) },
      { label: "GRBS", param: "grbs", value: parseVal(vitals.grbs), displayValue: displayGrbs(vitals.grbs) },
      { label: "GCS", param: "gcs" as ClinicalParam, value: parseVal(vitals.gcs), displayValue: displayGcs(vitals) }
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
      procedureNotes: Array.isArray(c.procedureNotes) ? c.procedureNotes : [],
    },

    consultation: {
      consultsRequested: deduplicateConsultations([
        ...(Array.isArray(c.dispositionAndPlan?.consultsRequested) ? c.dispositionAndPlan.consultsRequested : []),
        ...(Array.isArray((c as any).consultsRequested) ? (c as any).consultsRequested : [])
      ]),
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
      observationNotes: (() => {
        const o = typeof (c.dispositionDetails as any)?.observationNotes === "string" ? (c.dispositionDetails as any).observationNotes.trim() : "";
        return o && o !== (c.dispositionAndPlan?.destinationUnit || "").trim() ? o : null;
      })(),
      durationInEr: c.dispositionDetails?.durationInEr || null,
      conditionAtShift: c.conditionAtShift || (c.dispositionDetails as any)?.conditionAtShift || (c.pediatricDetails as any)?.dispositionConditionAtShift || null,
      managementPlan: c.dispositionAndPlan?.managementPlan || (c as any).managementPlan || (c as any).plan || null,
      consultsRequested: deduplicateConsultations([
        ...(Array.isArray(c.dispositionAndPlan?.consultsRequested) ? c.dispositionAndPlan.consultsRequested : []),
        ...(Array.isArray((c as any).consultsRequested) ? (c as any).consultsRequested : [])
      ]),
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
    mlcDetails: (() => {
      const m = (c.patient as any)?.mlcDetails;
      if (!m) return null;
      const v = (x: any) => (typeof x === "string" && x.trim() ? x.trim() : null);
      const out = {
        natureOfIncident: v(m.natureOfIncident),
        dateTimeOfIncident: v(m.dateTimeOfIncident),
        placeOfIncident: v(m.placeOfIncident),
        identificationMark: v(m.identificationMark),
        informantBroughtBy: v(m.informantBroughtBy),
        policeStation: v(m.policeStation),
      };
      return Object.values(out).some(Boolean) ? out : null;
    })(),
    familyHistory: (typeof c.sampleHistory?.familyHistory === "string" && c.sampleHistory.familyHistory.trim()) ? c.sampleHistory.familyHistory.trim() : null,
    socialHistory: (typeof c.sampleHistory?.socialHistory === "string" && c.sampleHistory.socialHistory.trim()) ? c.sampleHistory.socialHistory.trim() : null,
    hpi: (typeof c.sampleHistory?.hpi === "string" && c.sampleHistory.hpi.trim()) ? c.sampleHistory.hpi.trim() : null,
    surgicalHistory: (typeof c.sampleHistory?.surgicalHistory === "string" && c.sampleHistory.surgicalHistory.trim()) ? c.sampleHistory.surgicalHistory.trim() : null,
    lmp: (typeof c.sampleHistory?.lmp === "string" && c.sampleHistory.lmp.trim()) ? c.sampleHistory.lmp.trim() : null,


    signatureBlock: {
      clinicianName: (c as any).emResident || c.doctorName || c.dispositionDetails?.residentName || (c.pediatricDetails as any)?.dispositionEmResident || null, // treating ER doctor / resident
      consultantName: (c as any).emConsultant || c.consultantName || c.dispositionDetails?.consultantName || c.consultantReview?.reviewedBy || (c.pediatricDetails as any)?.dispositionEmConsultant || null, // consultant
      timestamp: c.lastEditedAt || null
    }
  };
}

// ── Presentational helpers ────────────────────────────────────────────

/**
 * Adult ER case record, laid out like the hospital EMR's Visit Notes (bold headings, indented lines).
 * With `onEdit`, every line that belongs to a case field can be clicked and typed into, like a Word
 * document (src/components/InlineEdit.tsx); `onEdit` receives the field (section title + key) and the new text.
 */
function ErCaseRecordBody({ lines, onEdit, editing }: { lines: ErLine[]; onEdit?: (section: string, key: string, value: string) => void; editing?: boolean }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    switch (l.kind) {
      case "title":
        out.push(<p key={i} className="font-black uppercase tracking-wide pt-1 pb-1">{l.text}</p>);
        break;
      case "heading":
        out.push(<p key={i} className="font-bold pt-1.5 break-after-avoid">{l.text}</p>);
        break;
      case "subheading":
        out.push(<p key={i} className="font-bold pl-2 break-after-avoid">{l.text}</p>);
        break;
      case "item":
      case "dash":
      case "para": {
        const edit = onEdit ? l.edit : undefined;
        if (edit) {
          // Consecutive lines of the same field are ONE editable block.
          const run: ErLine[] = [l];
          while (i + 1 < lines.length) {
            const n = lines[i + 1];
            if ((n.kind === "item" || n.kind === "dash" || n.kind === "para") && n.kind === l.kind && n.edit && n.edit.s === edit.s && n.edit.k === edit.k) { run.push(n); i++; } else break;
          }
          out.push(
            <EditableBlock
              key={i}
              kind={l.kind}
              lines={run.map((r) => (r as { text: string }).text)}
              placeholder={edit.ph}
              onCommit={(v) => onEdit!(edit.s, edit.k, v)}
            />
          );
        } else if (l.kind === "item") out.push(<p key={i} className="pl-8 whitespace-pre-line">{l.text}</p>);
        else if (l.kind === "dash") out.push(<p key={i} className="pl-2">- {l.text}</p>);
        else out.push(<p key={i} className="whitespace-pre-line">{l.text}</p>);
        break;
      }
      case "labelled": {
        if (l.arrow && onEdit && l.segs && l.segs.some((sg) => sg.edit)) {
          const editable = l.segs.filter((sg) => sg.edit);
          out.push(
            <p key={i} className="pl-8">
              <span className="font-bold">{l.label}</span> →{" "}
              {l.segs.map((sg, j) => {
                if (!sg.edit) return <span key={j}>{sg.text}</span>;
                const e = sg.edit;
                return (
                  <InlineSpan
                    key={j}
                    text={sg.text}
                    hint={sg.hint}
                    placeholder={e.ph}
                    onCommit={(v) => {
                      // One field can be typed in two pieces (CRT + other findings): join them back together.
                      const parts = editable.map((x) => (x === sg ? v : x.text.trim()));
                      onEdit(e.s, e.k, parts.filter(Boolean).join(", "));
                    }}
                  />
                );
              })}
            </p>
          );
        } else if (l.arrow) out.push(<p key={i} className="pl-8"><span className="font-bold">{l.label}</span> → {l.text}</p>);
        else out.push(<p key={i} className={/^EM (Resident|Consultant)$/.test(l.label) ? "pt-1.5" : ""}><span className="font-bold">{l.label}:</span> {l.text}</p>);
        break;
      }
    }
  }
  return (
    <div data-testid="er-case-record" className={`text-sm leading-relaxed space-y-1.5 pt-1${editing ? " ie-on" : ""}`}>
      {out}
    </div>
  );
}


function MlcDetailsSection({ isMlc, details }: { isMlc: boolean; details: CaseSheetData["mlcDetails"] }) {
  if (!isMlc && !details) return null;
  const row = (label: string, value: string | null) => (
    <div><span className="font-semibold text-slate-900">{label}:</span> {value || "Not documented"}</div>
  );
  return (
    <div className="border border-red-300 rounded-md p-3 text-xs space-y-0.5 print:break-inside-avoid">
      <div className="font-bold text-red-700 uppercase tracking-wide mb-1">Medico-Legal Case Details</div>
      {row("Nature of incident", details?.natureOfIncident ?? null)}
      {row("Date & time of incident", details?.dateTimeOfIncident ?? null)}
      {row("Place of incident", details?.placeOfIncident ?? null)}
      {row("Identification mark", details?.identificationMark ?? null)}
      {row("Brought by / informant", details?.informantBroughtBy ?? null)}
      {details?.policeStation && row("Police station", details.policeStation)}
    </div>
  );
}

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

/** Edit-in-preview: one full-screen form with every editable section, one Save. */
function EditAllForm({ groups, onSave, onClose }: {
  groups: { id: string; label: string; fields: { key: string; label: string; multiline?: boolean; value: string }[] }[];
  onSave: (vals: Record<string, Record<string, string>>) => void;
  onClose: () => void;
}) {
  const initial = React.useMemo(() => Object.fromEntries(groups.map((g) => [g.id, Object.fromEntries(g.fields.map((f) => [f.key, f.value]))])) as Record<string, Record<string, string>>, []);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>(initial);
  const isChanged = (g: string, k: string) => (vals[g]?.[k] ?? "").trim() !== (initial[g]?.[k] ?? "").trim();
  const dirty = groups.reduce((n, g) => n + g.fields.filter((f) => isChanged(g.id, f.key)).length, 0);
  const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };
  const box = "w-full box-border rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white border-2 border-transparent bg-purple-50 dark:bg-purple-950/30 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900";
  const chg = "!bg-emerald-50 dark:!bg-emerald-950/30 !border-emerald-500";
  return (
    <div className="no-print fixed inset-0 z-[60] bg-slate-100 dark:bg-slate-900 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Edit case sheet" data-testid="preview-edit-all">
      <div className="max-w-2xl mx-auto px-4 pb-28">
        <div className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur pt-3 pb-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit case sheet</h2>
          <div className="flex gap-1.5 overflow-x-auto pt-2">
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => document.getElementById(`pe-${g.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="shrink-0 min-h-[34px] px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">{g.label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4 pt-2">
          {groups.map((g) => (
            <section key={g.id} id={`pe-${g.id}`} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5" style={{ scrollMarginTop: 96 }}>
              <h3 className="text-[11px] font-black tracking-widest uppercase text-purple-700 dark:text-purple-300">{g.label}</h3>
              {g.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="block text-[11.5px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">{f.label}</span>
                  {f.multiline === false ? (
                    <input
                      data-testid={`pe-${g.id}-${f.key}`}
                      value={vals[g.id]?.[f.key] ?? ""}
                      onChange={(e) => { const v = e.target.value; setVals((p) => ({ ...p, [g.id]: { ...p[g.id], [f.key]: v } })); }}
                      className={`${box} ${isChanged(g.id, f.key) ? chg : ""}`}
                    />
                  ) : (
                    <textarea
                      data-testid={`pe-${g.id}-${f.key}`}
                      rows={1}
                      value={vals[g.id]?.[f.key] ?? ""}
                      ref={grow}
                      onChange={(e) => { const v = e.target.value; grow(e.target); setVals((p) => ({ ...p, [g.id]: { ...p[g.id], [f.key]: v } })); }}
                      className={`${box} resize-none overflow-hidden ${isChanged(g.id, f.key) ? chg : ""}`}
                    />
                  )}
                </label>
              ))}
            </section>
          ))}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-[61] bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-4 pt-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <span className="flex-1 text-xs text-slate-600 dark:text-slate-400" data-testid="preview-edit-count">{dirty ? `${dirty} edit${dirty > 1 ? "s" : ""} not saved` : "No changes"}</span>
          {dirty > 0 && <button type="button" onClick={() => setVals(initial)} className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">Undo all</button>}
          <button type="button" onClick={onClose} className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">{dirty ? "Discard" : "Close"}</button>
          <button type="button" data-testid="preview-edit-save" disabled={!dirty} onClick={() => onSave(vals)} className="min-h-[42px] px-4 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold">Save edits</button>
        </div>
      </div>
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
  const { editing: ieOn } = React.useContext(InlineEditCtx);

  if (!hasAnyData && !ieOn) {
    return (
      <Section>
        <SectionHeading>Primary Survey</SectionHeading>
        <EmptyLine />
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeading>Primary Survey</SectionHeading>
      <div className="space-y-2 text-sm">
        {/* A - Airway */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">Airway: </span>
          <EdText s="Primary Survey" k="airway" text={airwayFindings || ""} shown={airwayFindings || "Not documented"} />
        </div>

        {/* B - Breathing */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">Breathing: </span>
          <EdText s="Primary Survey" k="breathing" text={breathingFindings || ""} shown={breathingFindings || "Not documented"} />
          {(v?.rr || v?.spo2) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {v.rr && <span><strong className="font-sans text-[11px] text-slate-600">RR:</strong> {v.rr} /min</span>}
              {v.spo2 && <span><strong className="font-sans text-[11px] text-slate-600">SpO2:</strong> {displaySpo2(v.spo2)}</span>}
            </div>
          )}
        </div>

        {/* C - Circulation */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">Circulation: </span>
          <EdText s="Primary Survey" k="circulation" text={circulationFindings || ""} shown={circulationFindings || "Not documented"} />
          {(v?.hr || v?.bp) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {v.hr && <span><strong className="font-sans text-[11px] text-slate-600">HR:</strong> {v.hr} bpm</span>}
              {v.bp && <span><strong className="font-sans text-[11px] text-slate-600">BP:</strong> {v.bp} mmHg</span>}
            </div>
          )}
        </div>

        {/* D - Disability */}
        <div className="border-b border-slate-100 pb-1.5 last:border-b-0">
          <span className="font-bold text-slate-900">Disability: </span>
          <EdText s="Primary Survey" k="disability" text={disabilityFindings || ""} shown={disabilityFindings || "Not documented"} />
          {(v?.gcs || v?.gcsComponents || v?.grbs) && (
            <div className="inline-flex items-center gap-3 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              {(v.gcs || v.gcsComponents) && <span><strong className="font-sans text-[11px] text-slate-600">GCS:</strong> {displayGcs(v)}</span>}
              {v.grbs && <span><strong className="font-sans text-[11px] text-slate-600">GRBS:</strong> {displayGrbs(v.grbs)}</span>}
            </div>
          )}
        </div>

        {/* E - Exposure */}
        <div className="pb-0.5">
          <span className="font-bold text-slate-900">Exposure: </span>
          <EdText s="Primary Survey" k="exposure" text={exposureFindings || ""} shown={exposureFindings || "Not documented"} />
          {v?.temp && (
            <div className="inline-flex items-center gap-2 ml-2 font-mono text-xs bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border border-slate-200 print:border-none">
              <span><strong className="font-sans text-[11px] text-slate-600">Temp:</strong> {displayTemperature(v.temp)}</span>
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
    return null;
  }

  return (
    <Section>
      <SectionHeading>Adjuncts to Primary Assessment</SectionHeading>
      <div className="text-sm space-y-1.5">
        <div>
          <span className="font-semibold text-slate-900">ECG: </span>
          <span>{ecg.findings || (ecg.performed ? "Done" : "Not documented")}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">Bedside Echo / POCUS: </span>
          <span>{bedsideEcho.findings || (bedsideEcho.performed ? "Done" : "Not documented")}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">eFAST: </span>
          <span>{efast.findings || (efast.performed ? "Done" : "Not documented")}</span>
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
            <span>{vbgAbg.performed ? "Done" : "Not documented"}</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function SecondarySurveySection({ data, title = "Secondary Survey / Systemic Examination" }: { data: SecondarySurveyData, title?: string }) {
  const { editing: ieOn } = React.useContext(InlineEditCtx);
  const editSection = isEditableSection(title) ? title : undefined;
  if (ieOn && editSection) {
    const all: { key: string; label: string; value: string }[] = [
      { key: "general", label: "General", value: data.general || "" },
      { key: "cvs", label: "CVS", value: data.cvs || "" },
      { key: "respiratory", label: "Respiratory", value: data.respiratory || "" },
      { key: "abdomen", label: "Abdomen", value: data.abdomen || "" },
      { key: "cns", label: "CNS", value: data.cns || "" },
      { key: "extremities", label: "Extremities", value: data.extremities || "" },
    ];
    return (
      <Section>
        <SectionHeading>{title}</SectionHeading>
        <ul className="text-sm list-disc pl-5 space-y-0.5">
          {all.map((r) => (
            <li key={r.key}><span className="font-semibold">{r.label}:</span> <EdText s={editSection} k={r.key} text={r.value} /></li>
          ))}
        </ul>
      </Section>
    );
  }
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
  const { editing: ieOn } = React.useContext(InlineEditCtx);
  if (!data && !ieOn) {
    return (
      <Section>
        <SectionHeading>Psychological Assessment</SectionHeading>
        <p className="text-sm text-slate-500 italic">Not documented</p>
      </Section>
    );
  }

  data = data ?? ({} as PsychologicalAssessmentData);
  const fields: { label: string; value: boolean | null | undefined; isRiskFlag: boolean }[] = [
    { label: "Suicidal Ideation", value: data.suicidalIdeation, isRiskFlag: true },
    { label: "Self-Harm History", value: data.selfHarmHistory, isRiskFlag: true },
    { label: "Intent to Harm Others", value: data.intentToHarmOthers, isRiskFlag: true },
    { label: "Substance Abuse", value: data.substanceAbuse, isRiskFlag: false },
    { label: "Psychiatric History", value: data.psychiatricHistory, isRiskFlag: false },
    { label: "Currently on Psychiatric Treatment", value: data.currentlyOnPsychiatricTreatment, isRiskFlag: false },
    { label: "Has Support System", value: data.hasSupportSystem, isRiskFlag: false },
  ];

  const hasAnyStructured = fields.some(f => f.value !== undefined && f.value !== null && (f.value as any) !== "");
  const hasNotes = Boolean(data.notes && data.notes.trim());

  if (!hasAnyStructured && !hasNotes && !ieOn) {
    return (
      <Section>
        <SectionHeading>Psychological Assessment</SectionHeading>
        <p className="text-sm text-slate-500 italic">Not documented</p>
      </Section>
    );
  }

  const hasActiveRiskFlag = fields.some(f => f.isRiskFlag && f.value === true);

  return (
    <Section className={hasActiveRiskFlag ? "bg-red-50 print:bg-transparent" : ""}>
      <SectionHeading>Psychological Assessment</SectionHeading>
      {hasActiveRiskFlag && (
        <p className="text-xs font-black text-red-700 uppercase mb-2 print:text-black">
          ⚠ Active Risk Flag(s) — Review Immediately
        </p>
      )}
      {hasAnyStructured && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {fields.map((f, i) => (
            <div key={i} className={f.isRiskFlag && f.value === true ? "font-bold text-red-700 print:text-black" : ""}>
              <span className="font-semibold">{f.label}:</span> {displayDocumentedBoolean(f.value)}
            </div>
          ))}
        </div>
      )}
      {(hasNotes || ieOn) && (
        <p className="text-sm mt-2"><span className="font-semibold">Notes:</span> <EdText s="Psychological Assessment" k="psych" text={data.notes || ""} shown={data.notes} /></p>
      )}
    </Section>
  );
}


function SafetyAndAccreditationSection({ data }: { data: CaseSheetData["safetyAndAccreditation"] }) {
  const hasIpsg = Boolean(data?.hasAnyIpsg);
  const ipsg = data?.ipsgChecklist;
  const vulnList = data?.vulnerability || [];
  const consentList = data?.consentTimeOut || [];

  return (
    <Section>
      <SectionHeading>Safety & Accreditation</SectionHeading>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Patient Safety Goals</p>
          {hasIpsg && ipsg ? (
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              <li>Identifiers Verified: <span className="font-semibold">{displayDocumentedBoolean(ipsg.ipsg1IdentifiersVerified)}</span></li>
              <li>Verbal Order Read-Back: <span className="font-semibold">{displayDocumentedBoolean(ipsg.ipsg2ReadBackPerformed)}</span></li>
              <li>High-Alert Meds Double-Checked: <span className="font-semibold">{displayDocumentedBoolean(ipsg.ipsg3HighAlertDoubleChecked)}</span></li>
              <li>Time-Out Performed: <span className="font-semibold">{displayDocumentedBoolean(ipsg.ipsg4TimeOutPerformed)}</span></li>
              <li>Hand Hygiene Complied: <span className="font-semibold">{displayDocumentedBoolean(ipsg.ipsg5HandHygieneComplied)}</span></li>
              <li>Fall Risk: <span className="font-semibold">{ipsg.ipsg6FallRiskAssessed || "Not documented"}</span></li>
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic">Not documented</p>
          )}
        </div>

        {vulnList.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Vulnerability Screening</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {vulnList.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {consentList.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Consent / Time-Out</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {consentList.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

export default function CaseSheetPrintView({
  data: propData,
  clinicalCase,
  onBack,
  onEdit,
  onPrint,
  isPreview = false,
  onApplyPreview,
  onViewCaseSheet,
  defaultHospital,
}: Props) {
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [copiedCaseText, setCopiedCaseText] = useState(false);
   const [copyFailed, setCopyFailed] = useState(false);
  const [showEmrPanel, setShowEmrPanel] = useState(false); // ← NEW

  // Edit-in-preview: edits change a draft copy of the case; Apply saves that draft.
  const canEditPreview = Boolean(isPreview && clinicalCase && onApplyPreview);
  const [draftCase, setDraftCase] = useState<ClinicalCase | null>(clinicalCase || null);
  const [editMode, setEditMode] = useState(false);
  const [inlineOn, setInlineOn] = useState(false); // adult sheets: the Edit switch (lines are typeable only while it is on)
  const [editCount, setEditCount] = useState(0);
  useEffect(() => {
    setDraftCase(clinicalCase || null);
    setEditCount(0);
    setEditMode(false);
    setInlineOn(false);
  }, [clinicalCase]);
  const shownCase = canEditPreview && draftCase ? draftCase : clinicalCase;
  useEffect(() => { if (canEditPreview) requestTour("preview"); }, [canEditPreview]);

  const data = propData || (shownCase ? convertClinicalCaseToCaseSheetData(shownCase, defaultHospital) : null);

  // Adult and pediatric sheets are edited in place (click a line and type); one shared base (InlineEdit.tsx).
  const inlineEdit = Boolean(canEditPreview && data && !applySuccess);
  const commitInlineEdit = (section: string, key: string, value: string) => {
    if (!shownCase || !data) return;
    const r = applySectionEdits(shownCase, data, section, { [key]: value });
    if (r.changed > 0) {
      setDraftCase(r.next as ClinicalCase);
      setEditCount((n) => n + r.changed);
    }
  };

  const handleCopyCaseSheet = async () => {
    if (!data) return;
    // Plain text for notepad-style fields + an HTML flavour (<p>/<br>) so rich-text EMR editors keep the line breaks.
    const plain = formatCaseSheetText(data);
    const ok = await copyTextToClipboard(plain, formatCaseSheetHtml(data));
    if (ok) {
      setCopyFailed(false);
      setCopiedCaseText(true);
      setTimeout(() => setCopiedCaseText(false), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  };

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

  const ieNow = Boolean(inlineEdit && inlineOn); // the Edit switch is on

  const hasInvestigations = Boolean(
    data.investigationLabsOrdered ||
    data.labs.length > 0 ||
    data.investigationImaging ||
    data.investigationResultsSummary
  );

  const hasTreatments = Boolean(
    data.treatmentGiven.length > 0 ||
    data.treatmentNotes ||
    (data.isPediatric && (data.pediatricDetails as LegacyPediatricDetails)?.treatmentGiven)
  );

  const hasPedProvisionalDiagnosis = Boolean(
    data.provisionalDiagnosis ||
    (data.pediatricDetails as LegacyPediatricDetails)?.provisionalDiagnosisDischarge
  );

  const hasPedDifferentials = Boolean(
    data.differentials.length > 0 ||
    data.provisionalDifferentialDiagnoses ||
    (data.pediatricDetails as LegacyPediatricDetails)?.differentialDiagnosis
  );

  const hasAdultDiagnosis = Boolean(
    data.provisionalDiagnosis ||
    data.differentials.length > 0 ||
    data.provisionalDifferentialDiagnoses
  );

  return (
    <InlineEditCtx.Provider value={{ editing: ieNow, onEdit: ieNow ? commitInlineEdit : undefined }}>
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white text-slate-900 dark:text-slate-100 font-sans`}>
      {/* Sticky Header with Banner & Toolbar for Preview / Print */}
      <div className="no-print sticky top-[var(--ermate-header-height,50px)] z-30 shadow-sm">
        {isPreview && (
          <div
            id="case-sheet-preview-banner"
            className={`px-4 py-2.5 text-center flex items-center justify-center gap-2 text-white font-bold text-xs sm:text-sm tracking-wide ${
              applySuccess ? "bg-emerald-600" : "bg-amber-500"
            }`}
          >
            {applySuccess ? (
              <>
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>✓ Case Sheet prepared successfully.</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{`Preview${inlineEdit ? (inlineOn ? " — Editing: click any highlighted line to change it" : " — press Edit to change anything") : ""} — changes are not saved yet${editCount ? ` · ${editCount} edit${editCount > 1 ? "s" : ""}` : ""}`}</span>
              </>
            )}
          </div>
        )}

        <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  id="preview-back-button"
                  aria-label={isPreview ? "Back to Scribe" : "Back to Cases"}
                  className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 select-none"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-300" />
                  <span>{isPreview ? "Back to Scribe" : "Back"}</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 hidden sm:block" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {isPreview ? "Case Sheet Preview" : "Printable Case Sheet"}
                </span>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">
                  ID: {data.caseId}
                </span>
                {data.isPediatric && (
                  <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">
                    Pediatric
                  </span>
                )}
                {data.isMlc && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    MLC
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isPreview ? (
              <>
                {canEditPreview && !applySuccess && inlineEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setInlineOn((v) => !v)}
                      id="preview-edit-toggle"
                      data-coach="preview-edit"
                      aria-pressed={inlineOn}
                      title={inlineOn ? "Finish editing" : "Edit this case sheet: every highlighted line becomes typeable"}
                      className={`min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                        inlineOn
                          ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                          : "bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                      }`}
                    >
                      {inlineOn ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      <span className="whitespace-nowrap">{inlineOn ? "Done editing" : "Edit"}</span>
                    </button>
                    {inlineOn && (
                      <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        id="preview-edit-more-fields"
                        title="Vitals, patient details and other fields that are not lines on the sheet"
                        className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border bg-white dark:bg-slate-900 hover:bg-slate-50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                      >
                        <span className="whitespace-nowrap">More fields</span>
                      </button>
                    )}
                  </>
                )}
                {canEditPreview && !applySuccess && !inlineEdit && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    id="preview-edit-toggle"
                    data-coach="preview-edit"
                    className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">Edit this preview</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyCaseSheet}
                  id="preview-copy-casesheet-button"
                  className={`min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                    copiedCaseText
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : copyFailed
                      ? "bg-rose-600 border-rose-600 text-white"
                      : "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  }`}
                  title="Copy formatted case sheet to paste directly into any hospital EMR"
                >
                  {copiedCaseText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="whitespace-nowrap">{copiedCaseText ? "Copied to EMR!" : copyFailed ? "Copy failed — try again" : "Copy to EMR"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  id="preview-print-casesheet-button"
                  className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                {applySuccess ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onViewCaseSheet) {
                        onViewCaseSheet(data.internalCaseId || data.caseId);
                      } else if (onEdit) {
                        onEdit();
                      }
                    }}
                    id="preview-view-casesheet-button"
                    className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>View Case Sheet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isApplying}
                    onClick={async () => {
                      if (!clinicalCase || !onApplyPreview) return;
                      try {
                        setIsApplying(true);
                        setApplyError(null);
                        await onApplyPreview((shownCase || clinicalCase) as ClinicalCase);
                        setApplySuccess(true);
                      } catch (err: any) {
                        console.error("Apply preview error:", err);
                        setApplyError(err?.message || "Failed to apply changes.");
                      } finally {
                        setIsApplying(false);
                      }
                    }}
                    id="preview-apply-button"
                    className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {isApplying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Apply to Case Sheet</span>
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCopyCaseSheet}
                  id="print-copy-casesheet-button"
                  className={`min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                    copiedCaseText
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : copyFailed
                      ? "bg-rose-600 border-rose-600 text-white"
                      : "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  }`}
                  title="Copy formatted case sheet to paste directly into any hospital EMR"
                >
                  {copiedCaseText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="whitespace-nowrap">{copiedCaseText ? "Copied to EMR!" : copyFailed ? "Copy failed — try again" : "Copy to EMR"}</span>
                </button>
                                <button // ← NEW
                  type="button" // ← NEW
                  onClick={() => setShowEmrPanel(true)} // ← NEW
                  id="print-emr-fields-button" // ← NEW
                  className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800" // ← NEW
                  title="Copy each part into its own box in your hospital EMR" // ← NEW
                > {/* ← NEW */}
                  <Copy className="w-3.5 h-3.5" /> {/* ← NEW */}
                  <span className="whitespace-nowrap">EMR fields</span> {/* ← NEW */}
                </button> {/* ← NEW */}
                {showEmrPanel && data && <CopyToEmrPanel data={data} onClose={() => setShowEmrPanel(false)} />} {/* ← NEW */}
                <button
                  type="button"
                  onClick={handlePrint}
                  id="print-download-casesheet-button"
                  className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / Download PDF</span>
                  <span className="sm:hidden">Print / PDF</span>
                </button>
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    id="print-edit-casesheet-button"
                    className="min-w-[44px] min-h-[44px] flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit<span className="hidden sm:inline"> Case Sheet</span></span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {applyError && (
          <div className="bg-red-50 dark:bg-red-950/60 border-t border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold px-4 py-2 text-center">
            {applyError}
          </div>
        )}
      </div>

      <div className={`case-sheet-print max-w-3xl mx-auto bg-white shadow-md print:shadow-none px-8 py-8 my-6 print:my-0 text-slate-900 border border-slate-200 print:border-none rounded-xl print:rounded-none${ieNow && data.isPediatric ? " ie-on" : ""}`}>
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="ErMate" className="w-10 h-10 object-contain rounded-lg shrink-0" />
            <div>
              <h1 className="text-lg font-black uppercase tracking-wide">{hospitalName}</h1>
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 print:text-black">Emergency Department — Case Sheet{data.isMlc ? " · MLC CASE" : ""}</p>
            </div>
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
            <div><span className="font-bold">Age / Sex:</span> {data.patient.age !== null ? formatAge(data.patient.age, data.patient.ageMonths, data.patient.ageDays) : "—"} {data.patient.sex || "—"}</div>
            <div><span className="font-bold">Weight:</span> {data.patient.weight ? `${data.patient.weight} kg` : "—"}</div>
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

        {/* Adult ER cases: everything below the patient block follows the hospital's
            "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD" (src/utils/erCaseRecord.ts).
            Pediatric cases keep the pediatric sheet. */}
        {!data.isPediatric && <ErCaseRecordBody editing={inlineEdit && inlineOn} lines={buildErCaseRecord(data)} onEdit={inlineEdit && inlineOn ? commitInlineEdit : undefined} />}

        {data.isPediatric && screeningLines(data.triageScreening).length > 0 && (
          <Section>
            <SectionHeading>Triage Assessment & Infection Screening</SectionHeading>
            {isolationBanner(data.triageScreening) && (
              <div className="text-sm font-bold uppercase mb-1">{isolationBanner(data.triageScreening)}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {screeningLines(data.triageScreening).map((l) => <div key={l}>{l}</div>)}
            </div>
          </Section>
        )}

        {data.isPediatric && (
        <Section>
          <SectionHeading>Presenting Complaint</SectionHeading>
          <div className="text-sm font-medium"><EdText s="Presenting Complaint" k="cc" text={data.presentingComplaint || ""} hint="Add presenting complaint" shown={data.presentingComplaint || <EmptyLine />} /></div>
        </Section>
        )}

        {data.isPediatric && (
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

            <MlcDetailsSection isMlc={data.isMlc} details={data.mlcDetails} />
            <PrimarySurveySection data={data.primarySurvey} />

            <AdjunctsSection
              ecg={data.ecg}
              bedsideEcho={data.bedsideEcho}
              efast={data.efast}
              vbgAbg={data.vbgAbg}
            />

            {/* Pediatric: History of Present Illness as its own section, right after Primary Survey
                and Adjuncts (Neeraj, 21 Nov 2026). Written from the whole case on Preview. */}
            <Section>
              <SectionHeading>History of Present Illness</SectionHeading>
              <div className="text-sm"><EdBlock s="Secondary Assessment / History" k="hpi" lines={data.hpi ? [data.hpi] : []} shown={data.hpi ? <p className="whitespace-pre-line">{data.hpi}</p> : <EmptyLine />} /></div>
            </Section>

            <Section>
              <SectionHeading>Secondary Assessment / History</SectionHeading>
              <div className="text-sm space-y-1.5">
                {(() => {
                  const legacy = (data.pediatricDetails || {}) as LegacyPediatricDetails;
                  const S = "Secondary Assessment / History";
                  const rows: { label: string; k: string; text: string; empty: string; always: boolean }[] = [
                    { label: "Signs & Symptoms", k: "symptoms", text: data.symptoms.length > 0 ? data.symptoms.join(", ") : (legacy.historySignsSymptoms || ""), empty: "None documented", always: true },
                    { label: "Allergies", k: "allergies", text: data.allergies.length > 0 ? data.allergies.join(", ") : (legacy.historyAllergies || ""), empty: "None documented", always: true },
                    { label: "Medications", k: "medications", text: data.currentMedications.length > 0 ? data.currentMedications.join(", ") : (legacy.historyMedications || ""), empty: "None documented", always: true },
                    { label: "Past Medical History", k: "pastHistory", text: data.pastHistory.length > 0 ? data.pastHistory.join(" · ") : (legacy.historyPastMedical || ""), empty: "Not documented", always: true },
                    { label: "Last Meal", k: "lastMeal", text: data.lastMeal || legacy.historyLastMeal || "", empty: "Not documented", always: true },
                    { label: "Events Preceding", k: "events", text: data.events || legacy.historyEvents || "", empty: "Not documented", always: true },
                    { label: "Family History", k: "familyHistory", text: data.familyHistory || "", empty: "Not documented", always: false },
                    { label: "Social History", k: "socialHistory", text: data.socialHistory || "", empty: "Not documented", always: false },
                    { label: "Surgical History", k: "surgicalHistory", text: data.surgicalHistory || "", empty: "Not documented", always: false },
                    { label: "LMP", k: "lmp", text: data.lmp || "", empty: "Not documented", always: false },
                  ];
                  return rows
                    .filter((r) => r.always || r.text || (inlineEdit && inlineOn))
                    .map((r) => (
                      <div key={r.k}>
                        <span className="font-semibold text-slate-900">{r.label}:</span>{" "}
                        <EdText s={S} k={r.k} text={r.text} shown={r.text || r.empty} />
                      </div>
                    ));
                })()}
              </div>
            </Section>

            <SecondarySurveySection data={data.secondarySurvey} title="Focused Physical Examination" />
            <PsychologicalAssessmentSection data={data.psychologicalAssessment} />

            {(hasInvestigations || ieNow) && (
              <Section>
                <SectionHeading>Investigations & Diagnostic Studies</SectionHeading>
                <div className="space-y-3">
                  {(data.investigationLabsOrdered || ieNow) && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Laboratory Investigations Ordered</p>
                      <div className="text-sm text-slate-900 print:text-black"><EdBlock s="Investigations & Diagnostic Studies" k="labsOrdered" lines={(data.investigationLabsOrdered ? String(data.investigationLabsOrdered).split("\n") : [])} shown={<p className="whitespace-pre-line">{data.investigationLabsOrdered}</p>} /></div>
                    </div>
                  )}

                  {data.labs.length > 0 && (
                    <div>
                      {data.labs.map((panel, i) => (
                        <div key={i} className="mb-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">{panel.panelName}</p>
                          <p className="text-sm font-mono leading-relaxed">
                            {panel.values.map(v => `${v.name}: ${v.value === null && v.text ? v.text : (v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending"))}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`).join("  |  ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(data.investigationImaging || ieNow) && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Diagnostic Imaging (X-Ray / CT / MRI / USG)</p>
                      <div className="text-sm text-slate-900 print:text-black"><EdBlock s="Investigations & Diagnostic Studies" k="imaging" lines={(data.investigationImaging ? String(data.investigationImaging).split("\n") : [])} shown={<p className="whitespace-pre-line">{data.investigationImaging}</p>} /></div>
                    </div>
                  )}

                  {(data.investigationResultsSummary || ieNow) && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-0.5">Investigation Results Summary</p>
                      <div className="text-sm text-slate-900 print:text-black"><EdBlock s="Investigations & Diagnostic Studies" k="resultsSummary" lines={(data.investigationResultsSummary ? String(data.investigationResultsSummary).split("\n") : [])} shown={<p className="whitespace-pre-line">{data.investigationResultsSummary}</p>} /></div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(hasTreatments || ieNow) && (
              <Section>
                <SectionHeading>Treatment Given & Emergency Orders</SectionHeading>
                {ieNow ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-0.5">Treatment given (one per line)</p>
                      <EdBlock s="Treatment Given & Emergency Orders" k="drugs" kind="dash" lines={data.treatmentGiven} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-0.5">Treatment Notes & Orders</p>
                      <div className="text-sm font-mono"><EdBlock s="Treatment Given & Emergency Orders" k="treatmentNotes" lines={data.treatmentNotes ? data.treatmentNotes.split("\n") : []} /></div>
                    </div>
                  </div>
                ) : (<>
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
                ) : null}
                </>)}
              </Section>
            )}

            {(hasPedProvisionalDiagnosis || ieNow) && (
              <Section>
                <SectionHeading>Provisional Diagnosis</SectionHeading>
                <div className="text-sm font-bold text-indigo-950 print:text-black"><EdText s="Provisional Diagnosis" k="provisional" text={data.provisionalDiagnosis || (data.pediatricDetails as LegacyPediatricDetails)?.provisionalDiagnosisDischarge || ""} hint="Add provisional diagnosis" /></div>
              </Section>
            )}

            {(hasPedDifferentials || ieNow) && (
              <Section>
                <SectionHeading>Differential Diagnosis</SectionHeading>
                {ieNow && !data.differentials.some((d) => d.status) ? (
                  <div className="text-sm space-y-2">
                    <EdBlock s="Differential Diagnosis" k="differentials" kind="dash" lines={data.differentials.map((d) => d.diagnosis)} hint="Add differentials, one per line" />
                    <div><span className="font-semibold">Notes / Differential Details:</span> <EdBlock s="Differential Diagnosis" k="diffNotes" lines={data.provisionalDifferentialDiagnoses ? data.provisionalDifferentialDiagnoses.split("\n") : []} hint="Add notes" /></div>
                  </div>
                ) : data.differentials.length > 0 ? (
                  <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
                    {data.differentials.map((d, i) => <li key={i}>{d.diagnosis}{d.status ? ` (${d.status})` : ""}</li>)}
                  </ul>
                ) : data.provisionalDifferentialDiagnoses ? (
                  <div className="text-sm whitespace-pre-line">{data.provisionalDifferentialDiagnoses}</div>
                ) : (data.pediatricDetails as LegacyPediatricDetails)?.differentialDiagnosis ? (
                  <div className="text-sm">{((data.pediatricDetails as LegacyPediatricDetails)?.differentialDiagnosis)}</div>
                ) : null}
                {data.differentials.length > 0 && data.provisionalDifferentialDiagnoses && (
                  <div className="text-sm whitespace-pre-line mt-2 text-slate-700 print:text-black">
                    <span className="font-semibold">Notes / Differential Details:</span> {data.provisionalDifferentialDiagnoses}
                  </div>
                )}
              </Section>
            )}

            {((data.procedures.procedureNotes && data.procedures.procedureNotes.length > 0) || data.procedures.proceduresChecked.length > 0 || data.procedures.otherProcedures) && (
              <Section>
                <SectionHeading>Procedures & Interventions</SectionHeading>
                <div className="text-sm space-y-2">
                  {data.procedures.procedureNotes && data.procedures.procedureNotes.length > 0 && (
                    <div className="space-y-3">
                      {data.procedures.procedureNotes.map((note) => (
                        <div key={note.id} className="p-2.5 rounded border border-slate-200 print:border-slate-400 bg-slate-50/50 print:bg-transparent space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800 print:text-black border-b pb-1 border-slate-200 print:border-slate-300">
                            <span className="uppercase tracking-wider">{note.procedureName}</span>
                            <span className="font-mono font-normal text-[11px]">{[note.metadata.date, note.metadata.time].filter(Boolean).join(" ")}</span>
                          </div>
                          <div className="text-xs font-mono whitespace-pre-line leading-relaxed text-slate-900 print:text-black">
                            {note.generatedNarrative}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              <SectionHeading>Condition at Time of Shift / Disposition</SectionHeading>
              <div className="text-sm space-y-1">
                <div><span className="font-bold">Status:</span> <EdText s="Condition at Time of Shift / Disposition" k="status" text={data.disposition.status || ""} shown={data.disposition.status || "Not yet determined"} hint="Not yet determined" /></div>
                {(data.disposition.destinationUnit || ieNow) && <div><span className="font-bold">Destination:</span> <EdText s="Condition at Time of Shift / Disposition" k="destination" text={data.disposition.destinationUnit || ""} hint="Add" /></div>}
                {data.disposition.observationNotes && <div><span className="font-bold">Disposition Notes:</span> {data.disposition.observationNotes}</div>}
                {data.disposition.durationInEr && <div><span className="font-bold">Duration in ER:</span> {data.disposition.durationInEr}</div>}
                {(data.disposition.conditionAtShift || ieNow) && <div><span className="font-bold">Condition at Shift:</span> <EdText s="Condition at Time of Shift / Disposition" k="condition" text={data.disposition.conditionAtShift || ""} hint="Add" /></div>}
                {(data.disposition.managementPlan || ieNow) && <div><span className="font-bold">Management Plan:</span> <EdText s="Condition at Time of Shift / Disposition" k="plan" text={data.disposition.managementPlan || ""} hint="Add" /></div>}
                {data.disposition.consultsRequested.length > 0 && <div><span className="font-bold">Consults Requested:</span> {data.disposition.consultsRequested.join(", ")}</div>}
                {(data.disposition.followUpAdvice || ieNow) && <div><span className="font-bold">Follow-Up Advice:</span> <EdText s="Condition at Time of Shift / Disposition" k="followUp" text={data.disposition.followUpAdvice || ""} hint="Add" /></div>}
              </div>
            </Section>
          </>
        )}

        {data.isPediatric && (ieNow || (data.notes.progressNotes && data.notes.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation.") || data.notes.addendum) && (
          <Section>
            <SectionHeading>Clinical Notes & Addendum</SectionHeading>
            {(() => {
              const pn = data.notes.progressNotes && data.notes.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation." ? data.notes.progressNotes : "";
              return (
                <>
                  {(pn || ieNow) && <div className="text-sm"><EdBlock s="Clinical Notes & Addendum" k="notes" lines={pn ? pn.split("\n") : []} shown={<p className="whitespace-pre-line">{pn}</p>} hint="Add clinical notes" /></div>}
                  {(data.notes.addendum || ieNow) && <div className="text-sm mt-1"><span className="font-bold">Addendum:</span> <EdBlock s="Clinical Notes & Addendum" k="addendum" lines={data.notes.addendum ? data.notes.addendum.split("\n") : []} shown={<span className="whitespace-pre-line">{data.notes.addendum}</span>} hint="Add addendum" /></div>}
                </>
              );
            })()}
          </Section>
        )}

        {data.isPediatric && (
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
        )}
      </div>

      <style>{`${INLINE_EDIT_CSS}
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .case-sheet-print { font-family: 'Times New Roman', Times, serif !important; font-size: 11pt !important; color: #000 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          .case-sheet-section { page-break-inside: avoid !important; border-color: #000 !important; padding-top: 6px !important; padding-bottom: 6px !important; }
          @page { margin: 15mm; }
        }
      `}</style>
      {editMode && canEditPreview && shownCase && (
        <EditAllForm
          groups={EDIT_GROUPS.map((g) => ({ id: g.id, label: g.label, fields: (EDIT_SECTIONS[g.title] || []).map((f) => ({ key: f.key, label: f.label, multiline: f.multiline, value: f.get(shownCase, data) })) }))}
          onClose={() => setEditMode(false)}
          onSave={(vals) => {
            let next: any = shownCase;
            let changed = 0;
            for (const g of EDIT_GROUPS) {
              const r = applySectionEdits(next, data, g.title, vals[g.id] || {});
              next = r.next;
              changed += r.changed;
            }
            if (changed > 0) {
              setDraftCase(next as ClinicalCase);
              setEditCount((n) => n + changed);
            }
            setEditMode(false);
          }}
        />
      )}
    </div>
    </InlineEditCtx.Provider>
  );
}