/**
 * pediatricCaseSheet.ts
 *
 * Structured schema for the Pediatric Case Sheet, distinct from the
 * adult CaseSheetData (caseSheetTypes.ts). Built around the Paediatric
 * Assessment Triangle (PAT); includes fields with no adult equivalent
 * (Cry, Skin Colour/Temp as standalone circulation field, Immunization
 * Status), and correctly OMITS the adult Psychological Assessment
 * section (not clinically applicable at pediatric ED triage).
 *
 * ROUTING: extraction router selects this schema over adult
 * CaseSheetData based on patient age. Assumed pediatric = <18 years,
 * matching pediatricClinicalRanges.ts age bands. Confirm against
 * hospital protocol if different.
 *
 * DischargeSummaryOutput is SHARED between adult and pediatric — no
 * separate pediatric discharge schema. mapPediatricCaseSheetToCommonFields()
 * converts this into the same CaseSheetData shape (caseSheetTypes.ts)
 * that adult cases use, so generateDischargeSummaryFromCaseSheet()
 * never has to branch on patient age.
 */

import { formatFlaggedForAge, ageToMonths, type PediatricVitalParam } from "./pediatricClinicalRanges";
import type { CaseSheetData, Disposition, ChronologicalNote, MedicationLogEntry, LabPanel, CultureResult } from "./caseSheetTypes";

// ── PAT (Paediatric Assessment Triangle) ────────────────────────────

export interface PediatricAssessmentTriangle {
  appearance: string;
  tone: string;
  interactivity: string;
  consolability: string;
  lookGaze: string;
  speechCry: string;
}

// ── Primary assessment (pediatric A-E, differs from adult) ─────────

export interface PediatricAirway {
  cry: "Good" | "Weak" | "Absent" | string | null;
  airwayStatus: "Patent" | "Threatened" | "Compromised" | null;
  intervention: string | null;
}

export interface PediatricBreathing {
  rr: number | null;
  spo2: number | null;
  workOfBreathing: string | null;
  abnormalPositioning: string | null;
  airEntry: string | null;
  subcutaneousEmphysema: "Yes" | "No" | null;
  intervention: string | null;
}

export interface PediatricCirculation {
  crt: string | null;
  hr: number | null;
  skinColourTemperature: string | null;
  distendedNeckVeins: "Yes" | "No" | null;
  intervention: string | null;
}

export interface PediatricDisability {
  avpuGcs: string | null;
  pupils: string | null;
  grbs: number | null;
}

export interface PediatricExposure {
  temperature: number | null;
  rashesOrInfectionSigns: string | null;
  otherTraumaOrIllnessSigns: string | null;
  longBoneDeformities: string | null;
}

// ── Secondary assessment ────────────────────────────────────────────

export interface PediatricFocusedHistory {
  associatedSymptoms: string[];
  allergies: string;
  medications: string;
}

export interface PediatricPastMedicalHistory {
  knownConditions: string[];
  pastSurgeriesAndImmunizationStatus: string | null;
}

export interface PediatricFocusedExamination {
  heent: string | null;
  respiratory: string | null;
  cardiovascular: string | null;
  abdomen: string | null;
  extremities: string | null;
}

// ── Main schema ──────────────────────────────────────────────────────

export interface PediatricCaseSheetData {
  caseId: string;
  patient: {
    name: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    sex: "M" | "F" | "O" | null;
    uhid: string | null;
    bed: string | null;
  };
  arrival: {
    date: string | null;
    time: string | null;
  };
  clinician: string | null; // re-injected locally, per Rule 5

  mlc: string | null;               // pediatric MLC cases occur (trauma, suspected abuse)
  arrivalBP: string | null;         // often skipped in infants/toddlers, relevant for school-age/adolescent
  painScore: {
    value: number | null;
    scale: "FLACC" | "Wong-Baker" | "Numeric" | null;
  };

  presentingComplaint: string;

  pat: PediatricAssessmentTriangle;

  airway: PediatricAirway;
  breathing: PediatricBreathing;
  circulation: PediatricCirculation;
  disability: PediatricDisability;
  exposure: PediatricExposure;

  historyOfPresentingIllness: string;

  focusedHistory: PediatricFocusedHistory;
  pastMedicalHistory: PediatricPastMedicalHistory;
  focusedExamination: PediatricFocusedExamination;

  // Conditional — only populated for female patients >= 10 years.
  // Use isLmpApplicable() to gate extraction/rendering.
  lmp: string | null;

  investigations: string[];     // free-text/individual orders, no adult-style preset panels
  treatmentGiven: string[];
  differentialDiagnosis: string;
  plan: string;

  emResident: string | null;
  emConsultant: string | null;

  // NOTE: No psychologicalAssessment field — intentionally omitted.
  // NOTE: No investigationPresetPanels — pediatric labs ordered individually.
}

// ── Conditional field gate: LMP only applicable for adolescent females ──

export function isLmpApplicable(patient: PediatricCaseSheetData["patient"]): boolean {
  return patient.sex === "F" && (patient.ageYears ?? 0) >= 10;
}

// ── Age helpers ────────────────────────────────────────────────────

export function getTotalAgeMonths(patient: PediatricCaseSheetData["patient"]): number {
  return ageToMonths(patient.ageYears ?? 0, patient.ageMonths ?? 0);
}

export function formatPediatricVital(
  param: PediatricVitalParam,
  value: number | null | undefined,
  patient: PediatricCaseSheetData["patient"]
): string {
  const ageMonths = getTotalAgeMonths(patient);
  return formatFlaggedForAge(param, value, ageMonths);
}

/**
 * Returns true if a given patient age (years) should be routed to the
 * pediatric schema/extraction path instead of adult.
 */
export function isPediatricPatient(ageYears: number | null): boolean {
  return ageYears !== null && ageYears < 18;
}

// ── Adapter: map pediatric case sheet -> shared CaseSheetData ────────

export function mapPediatricCaseSheetToCommonFields(
  peds: PediatricCaseSheetData,
  disposition: Disposition,
  chronologicalNotes: ChronologicalNote[],
  medicationLog: MedicationLogEntry[],
  investigationsStructured: LabPanel[],
  cultureResults: CultureResult[] | undefined,
  latestVitals: CaseSheetData["latestVitals"]
): CaseSheetData {
  return {
    caseId: peds.caseId,
    patient: {
      name: peds.patient.name,
      age: peds.patient.ageYears,
      sex: peds.patient.sex,
      uhid: peds.patient.uhid,
      bed: peds.patient.bed,
    },
    arrival: peds.arrival,
    clinician: peds.clinician,

    mlc: peds.mlc,
    allergy: peds.focusedHistory.allergies,

    arrivalVitals: {
      hr: peds.circulation.hr,
      bp: peds.arrivalBP,
      rr: peds.breathing.rr,
      spo2: peds.breathing.spo2,
      gcs: peds.disability.avpuGcs,
      painScore: peds.painScore.value,
      grbs: peds.disability.grbs,
      temp: peds.exposure.temperature,
    },
    latestVitals,

    presentingComplaint: peds.presentingComplaint,

    vbgAbg: { type: null, values: [] },
    ecg: "Not documented",
    bedsideEcho: "Not documented",

    historyOfPresentIllness: peds.historyOfPresentingIllness,
    pastMedicalSurgicalHistory: [
      ...peds.pastMedicalHistory.knownConditions,
      ...(peds.pastMedicalHistory.pastSurgeriesAndImmunizationStatus
        ? [peds.pastMedicalHistory.pastSurgeriesAndImmunizationStatus]
        : []),
    ],
    familyGynaeHistory: null,
    lmp: isLmpApplicable(peds.patient) ? peds.lmp : null,

    primaryAssessment: {
      airway: `${peds.airway.airwayStatus ?? ""}${peds.airway.cry ? ` — Cry: ${peds.airway.cry}` : ""}`.trim() || null,
      breathing: `RR ${peds.breathing.rr ?? "—"}, SpO2 ${peds.breathing.spo2 ?? "—"}%, WOB ${peds.breathing.workOfBreathing ?? "—"}, Air entry ${peds.breathing.airEntry ?? "—"}`,
      circulation: `CRT ${peds.circulation.crt ?? "—"}, HR ${peds.circulation.hr ?? "—"}, ${peds.circulation.skinColourTemperature ?? ""}`.trim(),
      disability: `${peds.disability.avpuGcs ?? "—"}, Pupils ${peds.disability.pupils ?? "—"}, GRBS ${peds.disability.grbs ?? "—"}`,
      exposure: `Temp ${peds.exposure.temperature ?? "—"}, ${peds.exposure.rashesOrInfectionSigns ?? ""}`.trim(),
    },

    generalExamination: peds.focusedExamination.heent,
    systemicExamination: {
      cvs: peds.focusedExamination.cardiovascular,
      chest: peds.focusedExamination.respiratory,
      abdomen: peds.focusedExamination.abdomen,
      cns: null,
    },
    examinationFindings: [
      peds.focusedExamination.heent,
      peds.focusedExamination.respiratory,
      peds.focusedExamination.cardiovascular,
      peds.focusedExamination.abdomen,
      peds.focusedExamination.extremities,
    ].filter((f): f is string => !!f),

    provisionalDiagnosis: peds.differentialDiagnosis,
    differentialDiagnosis: peds.differentialDiagnosis,

    chronologicalNotes,
    medicationLog,
    treatmentGiven: peds.treatmentGiven,

    investigations: investigationsStructured,
    cultureResults,

    disposition,
    treatingPhysician: peds.clinician,

    signatureBlock: {
      clinicianName: peds.emConsultant || peds.emResident || peds.clinician,
      timestamp: null,
    },
  };
}
