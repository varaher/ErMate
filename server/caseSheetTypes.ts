/**
 * caseSheetTypes.ts
 *
 * SINGLE SOURCE OF TRUTH for the adult Case Sheet data shape.
 * Both CaseSheetPrintView.tsx (display) and dischargeSummary.ts
 * (discharge generation) import CaseSheetData from here — do not
 * redefine this shape in either of those files.
 *
 * Pediatric cases use pediatricCaseSheet.ts's PediatricCaseSheetData,
 * then convert to this same shape via mapPediatricCaseSheetToCommonFields()
 * so the discharge generation pipeline never branches on patient age.
 */

import type { ClinicalParam } from "./clinicalRanges";

export type Disposition =
  | "Normal Discharge"
  | "Discharge at Request"
  | "Discharge Against Medical Advice"
  | "Referred"
  | null;

export interface VitalsBlock {
  hr: number | null;
  bp: string | null;
  rr: number | null;
  spo2: number | null;
  gcs: string | null;
  painScore: number | null;
  grbs: number | null;
  temp: number | null;
}

export interface PrimaryAssessment {
  airway: string | null;
  breathing: string | null;
  circulation: string | null;
  disability: string | null;
  exposure: string | null;
}

export interface SystemicExamination {
  cvs: string | null;
  chest: string | null;
  abdomen: string | null;
  cns: string | null;
}

export interface LabPanel {
  panelName: string;
  values: { name: string; param: ClinicalParam; value: number | null; unit?: string }[];
}

export interface CultureResult {
  name: string;
  result: string;
}

export interface ChronologicalNote {
  timestamp: string;
  entry: string;
  author?: string;
}

export interface MedicationLogEntry {
  drug: string;
  dose: string;
  route: string;
  timestamp: string;
}

export interface CaseSheetData {
  caseId: string;
  hospitalName?: string; // defaults to "Rajagiri Hospital" if omitted

  patient: {
    name: string | null;   // masked per PHI rules unless treating physician view
    age: number | null;
    sex: "M" | "F" | "O" | null;
    uhid: string | null;
    bed: string | null;
  };

  arrival: {
    date: string | null;
    time: string | null;
  };

  clinician: string | null; // treating physician, re-injected locally per Rule 5

  mlc: string | null;
  allergy: string | null;

  arrivalVitals: VitalsBlock;
  latestVitals: VitalsBlock & { timestamp: string };

  presentingComplaint: string;

  // Initial assessment adjuncts — locked format per handover Rule 12
  vbgAbg: {
    type: "VBG" | "ABG" | null;
    values: { name: string; param: ClinicalParam; value: number | null }[];
  };
  ecg: string;
  bedsideEcho: string;

  historyOfPresentIllness: string;
  pastMedicalSurgicalHistory: string[];
  familyGynaeHistory: string | null;
  lmp: string | null;

  primaryAssessment: PrimaryAssessment;
  generalExamination: string | null;
  systemicExamination: SystemicExamination;
  examinationFindings: string[]; // free-text findings list, used by print view

  provisionalDiagnosis: string;
  differentialDiagnosis: string | null;

  chronologicalNotes: ChronologicalNote[];
  medicationLog: MedicationLogEntry[];
  treatmentGiven: string[];

  investigations: LabPanel[];
  cultureResults?: CultureResult[];

  disposition: Disposition;
  treatingPhysician: string | null; // re-injected locally, never from AI (Rule 5)

  signatureBlock: {
    clinicianName: string | null;
    timestamp: string | null;
  };
}
