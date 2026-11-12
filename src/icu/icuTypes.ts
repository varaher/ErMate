/**
 * ErMate — ICU Mode (Other Modes), Phase 1 data types.
 *
 * Storage (Phase 1, personal workspace, owner-only rules):
 *   users/{uid}/icuUnits/{unitId}
 *   users/{uid}/icuAdmissions/{admissionId}
 *   users/{uid}/icuAdmissions/{admissionId}/notes/{noteId}
 *
 * Rule 8 applies everywhere: a value that was not dictated or entered stays null and
 * renders as "Not documented" / "Not reviewed". Nothing here carries a clinical default.
 */

export type IcuUnitType =
  | "MICU"
  | "SICU"
  | "NEURO_ICU"
  | "NEUROSURGERY_ICU"
  | "CCU"
  | "LIVER_TRANSPLANT_ICU"
  | "CTVS_ICU"
  | "PICU";

export const ICU_UNIT_TYPES: { id: IcuUnitType; label: string }[] = [
  { id: "MICU", label: "MICU" },
  { id: "SICU", label: "SICU" },
  { id: "NEURO_ICU", label: "Neuro ICU" },
  { id: "NEUROSURGERY_ICU", label: "Neurosurgery ICU" },
  { id: "CCU", label: "CCU" },
  { id: "LIVER_TRANSPLANT_ICU", label: "Liver / Transplant ICU" },
  { id: "CTVS_ICU", label: "CTVS ICU" },
  { id: "PICU", label: "PICU" },
];

export interface IcuUnit {
  id: string;
  name: string; // hospital's own name, e.g. "MICU 1"
  type: IcuUnitType;
  beds: string[]; // e.g. ["1","2","3"]
  createdAt: string;
}

export type IcuAdmissionSource = "ER" | "WARD" | "OT" | "OUTSIDE" | "DIRECT";
export const ICU_SOURCES: { id: IcuAdmissionSource; label: string }[] = [
  { id: "ER", label: "ER" },
  { id: "WARD", label: "Ward" },
  { id: "OT", label: "OT" },
  { id: "OUTSIDE", label: "Outside hospital" },
  { id: "DIRECT", label: "Direct admission" },
];

export type IcuOutcome =
  | "WARD"
  | "HDU"
  | "OTHER_ICU"
  | "EXTERNAL_TRANSFER"
  | "DISCHARGE"
  | "DAMA_LAMA"
  | "DEATH";

export const ICU_OUTCOMES: { id: IcuOutcome; label: string }[] = [
  { id: "WARD", label: "Shifted to ward" },
  { id: "HDU", label: "Shifted to HDU" },
  { id: "EXTERNAL_TRANSFER", label: "Transferred to another hospital" },
  { id: "DISCHARGE", label: "Discharged home" },
  { id: "DAMA_LAMA", label: "DAMA / LAMA" },
  { id: "DEATH", label: "Death" },
];

export interface IcuStay {
  unitId: string;
  unitName: string;
  bed: string;
  inAt: string;
  outAt: string | null;
}

export interface IcuAdmission {
  id: string;
  patientLabel: string; // stays in the doctor's Firestore; never sent to AI
  uhid: string | null;
  ageYears: number | null;
  sex: "M" | "F" | "Other" | null;
  source: IcuAdmissionSource;
  admittedAt: string;
  status: "active" | "closed";
  outcome: IcuOutcome | null;
  outcomeAt: string | null;
  // current location (mirrors the open stay)
  unitId: string;
  unitName: string;
  unitType: IcuUnitType;
  bed: string;
  stays: IcuStay[];
  // census badges, refreshed whenever a note is saved
  problemsPreview: string | null;
  supportChips: string[];
  fastHugsGapCount: number;
  openFlagCount: number;
  latestNoteId: string | null;
  updatedAt: string;
}

// ── Note ──────────────────────────────────────────────────────

export type ExamSystem =
  | "respiratory"
  | "cardiovascular"
  | "abdomen"
  | "neurological"
  | "renal"
  | "skin"
  | "lines";

export type ExamStatus = "not_documented" | "documented" | "not_assessed" | "unable";

export interface ExamEntry {
  status: ExamStatus;
  text: string | null;
  /** dictated = said by the doctor; attested-normal = normal set the doctor attested or confirmed */
  source: "dictated" | "attested-normal" | "manual" | null;
  reason: string | null; // for not_assessed / unable
  confirmedAt: string | null;
}

export interface IcuProblem {
  id: string;
  text: string;
  status: "active" | "resolved";
  suspected: boolean;
  /** true until the doctor confirms a carried-forward item today */
  carried: boolean;
}

export type IcuVitalName = "HR" | "BP" | "MAP" | "RR" | "SpO2" | "Temp" | "GRBS" | "Other";

export interface IcuObservation {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  /** as dictated ("8 PM", "06:00"); null = time not stated. Never invented. */
  time: string | null;
}

export interface IcuGcs {
  e: number | null;
  v: number | null; // null also when "VT" — see vText
  m: number | null;
  vText: string | null; // e.g. "T" for intubated
  dictatedTotal: number | null;
}

export type PlanGroup =
  | "metabolic"
  | "haemo_resp"
  | "renal"
  | "fluid_glycaemic"
  | "infection"
  | "investigations"
  | "consults"
  | "followup"
  | "other";

export type FastHugsKey =
  | "feeds"
  | "analgesia"
  | "sedation"
  | "thromboprophylaxis"
  | "head_up"
  | "ulcer_prophylaxis"
  | "glucose"
  | "sbt"
  | "bowel"
  | "indwelling"
  | "deescalation";

export type FastHugsStatus = "not_reviewed" | "addressed" | "not_applicable";

export interface FastHugsEntry {
  status: FastHugsStatus;
  detail: string | null;
  reason: string | null; // required for not_applicable
}

export type FastHugsState = Record<FastHugsKey, FastHugsEntry>;

export interface ClarificationFlag {
  id: string;
  order: string; // the order exactly as dictated
  issue: string; // what is missing / ambiguous
  resolved: boolean;
}

export interface IcuTask {
  id: string;
  what: string;
  when: string; // as dictated: "8 PM", "STAT", "Hourly", "Tomorrow"
  dueAt: string | null; // resolved ISO for clock times; null for STAT / Hourly / Tomorrow
  done: boolean;
  doneAt: string | null;
}

export interface IcuDevice {
  id: string;
  type: string; // "CVC", "Arterial line", "Femoral HD catheter", "ETT", "Foley"
  site: string | null;
  status: "ordered" | "in_situ" | "removed";
  insertedAt: string | null; // ISO; day count only exists when this is set
  carried: boolean;
}

export interface IcuNoteSections {
  problems: IcuProblem[];
  background: string | null;
  admissionStory: string | null;
  events: string | null;
  ventilation: string | null;
  neuro: string | null;
  haemodynamic: string | null;
  vitals: IcuObservation[];
  gcs: IcuGcs;
  rass: string | null;
  camIcu: string | null;
  exam: Record<ExamSystem, ExamEntry>;
  investigations: IcuObservation[];
  differentials: string[];
  plan: Record<PlanGroup, string[]>;
  summary: string | null;
}

export interface IcuNote {
  id: string;
  admissionId: string;
  kind: "admission" | "daily";
  status: "draft" | "signed";
  createdAt: string;
  updatedAt: string;
  authorUid: string;
  authorName: string | null;
  signedAt: string | null;
  sections: IcuNoteSections;
  fastHugs: FastHugsState;
  flags: ClarificationFlag[];
  tasks: IcuTask[];
  devices: IcuDevice[];
}

/** Shape returned by /api/icu/extract after client-side sanitising. */
export interface IcuExtraction {
  problems: { text: string; suspected: boolean }[];
  background: string | null;
  admissionStory: string | null;
  events: string | null;
  ventilation: string | null;
  neuro: string | null;
  haemodynamic: string | null;
  vitals: { name: string; value: string; unit: string | null; time: string | null }[];
  gcs: { e: number | null; v: number | null; vText: string | null; m: number | null; total: number | null };
  rass: string | null;
  camIcu: string | null;
  exam: Partial<Record<ExamSystem, string>>;
  attestedNormal: boolean;
  investigations: { name: string; value: string; unit: string | null; time: string | null }[];
  differentials: string[];
  plan: Record<PlanGroup, string[]>;
  fastHugs: Partial<Record<FastHugsKey, string>>;
  flags: { order: string; issue: string }[];
  tasks: { what: string; when: string }[];
  devices: { type: string; site: string | null; status: "ordered" | "in_situ"; insertedTime: string | null }[];
  summary: string | null;
}