/**
 * Mate -> ErMate deterministic mutation adapter.
 *
 * This is the only bridge from validated Mate clinical facts into the existing
 * ErMate write layer. It does not call a model and it never guesses values.
 */

import type { ClinicalPatch } from "./clinicalTaskApplier";
import {
  validateMateClinicalFacts,
  type MateClinicalFact,
  type MateFactValidationResult,
} from "./mateClinicalFacts";

export interface MateCaseMutationPlan {
  validation: MateFactValidationResult;
  patches: ClinicalPatch[];
  /** Partial GCS components are written separately because ErMate stores them in vitals. */
  vitalsPatch: Record<string, string>;
  /** Structured psychological flags; only explicitly documented values appear. */
  psychologicalPatch: Record<string, boolean>;
  /** Numeric/string blood-gas values; only explicitly documented values appear. */
  bloodGasPatch: Record<string, unknown>;
  requiresClarification: boolean;
}

const PATCH_PATHS: Partial<Record<MateClinicalFact["key"], string>> = {
  "vitals.bp": "vitals.bp",
  "vitals.hr": "vitals.hr",
  "vitals.rr": "vitals.rr",
  "vitals.spo2": "vitals.spo2",
  "vitals.temperature": "vitals.temp",
  "vitals.grbs": "vitals.grbs",
  "sample.symptoms": "sampleHistory.symptoms",
  "sample.allergies": "sampleHistory.allergies",
  "sample.medications": "sampleHistory.medications",
  "sample.pastHistory": "sampleHistory.pastHistory",
  "sample.lastMeal": "sampleHistory.lastMeal",
  "sample.events": "sampleHistory.events",
  "primary.airway": "primaryAssessment.airway",
  "primary.breathing": "primaryAssessment.breathing",
  "primary.circulation": "primaryAssessment.circulation",
  "primary.disability": "primaryAssessment.disability",
  "primary.exposure": "primaryAssessment.exposure",
  "secondary.general": "secondarySurvey.general",
  "secondary.cvs": "secondarySurvey.cvs",
  "secondary.respiratory": "secondarySurvey.respiratory",
  "secondary.abdomen": "secondarySurvey.abdomen",
  "secondary.cns": "secondarySurvey.cns",
  "secondary.extremities": "secondarySurvey.extremities",
  "pocus.wma": "adjuncts.echoFindings",
  "pocus.ivc": "adjuncts.echoFindings",
  "pocus.renal": "adjuncts.echoFindings",
  "pocus.fast": "adjuncts.efastNotes",
  "investigation.lab": "investigationLabsOrdered",
  "investigation.imaging": "investigationImaging",
  "treatment.medication": "treatments",
  "treatment.plan": "treatmentNotes",
  "diagnosis.provisional": "provisionalPrimaryDiagnosis",
  "diagnosis.differential": "differentials",
  "disposition.status": "dispositionAndPlan.dispositionStatus",
};

const ARRAY_PATHS = new Set(["investigations", "treatments", "differentials"]);
const APPEND_PATHS = new Set([
  "sampleHistory.symptoms",
  "sampleHistory.medications",
  "sampleHistory.pastHistory",
  "sampleHistory.events",
  "primaryAssessment.airway",
  "primaryAssessment.breathing",
  "primaryAssessment.circulation",
  "primaryAssessment.disability",
  "primaryAssessment.exposure",
  "secondarySurvey.general",
  "secondarySurvey.cvs",
  "secondarySurvey.respiratory",
  "secondarySurvey.abdomen",
  "secondarySurvey.cns",
  "secondarySurvey.extremities",
  "adjuncts.echoFindings",
  "adjuncts.efastNotes",
  "investigationLabsOrdered",
  "investigationImaging",
  "treatmentNotes",
]);

const PSYCH_FIELD_MAP: Partial<Record<MateClinicalFact["key"], string>> = {
  "psych.depression": "depression",
  "psych.anxiety": "anxiety",
  "psych.psychosis": "psychosis",
  "psych.agitation": "agitation",
  "psych.suicidalIdeation": "suicidalIdeation",
  "psych.substanceUse": "substanceAbuse",
  "psych.selfHarmHistory": "selfHarmHistory",
  "psych.intentToHarmOthers": "intentToHarmOthers",
  "psych.psychiatricHistory": "psychiatricHistory",
  "psych.psychiatricTreatment": "currentlyOnPsychiatricTreatment",
  "psych.supportSystem": "hasSupportSystem",
};

const BLOOD_GAS_MAP: Partial<Record<MateClinicalFact["key"], string>> = {
  "bloodGas.ph": "ph",
  "bloodGas.pco2": "pco2",
  "bloodGas.po2": "po2",
  "bloodGas.hco3": "hco3",
  "bloodGas.lactate": "lactate",
  "bloodGas.sodium": "na",
  "bloodGas.potassium": "k",
  "bloodGas.glucose": "glucose",
  "bloodGas.hb": "hb",
};

function stringifyExact(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value);
}

function patchLabel(fact: MateClinicalFact): string {
  return `Mate → ${fact.key}: ${stringifyExact(fact.value)}`;
}

function sectionForKey(key: MateClinicalFact["key"]): string {
  if (key.startsWith("vitals.") || key.startsWith("gcs.")) return "Vitals";
  if (key.startsWith("sample.")) return "SAMPLE History";
  if (key.startsWith("primary.")) return "Primary Survey";
  if (key.startsWith("secondary.")) return "Secondary Exam";
  if (key.startsWith("pocus.")) return "Bedside Diagnostics";
  if (key.startsWith("investigation.")) return "Investigations";
  if (key.startsWith("treatment.")) return "Treatments";
  if (key.startsWith("diagnosis.")) return "Diagnosis";
  if (key.startsWith("disposition.")) return "Disposition";
  return "Clinical Documentation";
}

/**
 * Produces a deterministic mutation plan from proposed facts.
 *
 * IMPORTANT: Callers MUST NOT apply `validation.rejected` facts or facts involved
 * in unresolved conflicts. If clarifications exist, the plan may still contain
 * independent non-conflicting facts, but the UI should surface the clarification.
 */
export function buildMateCaseMutationPlan(facts: MateClinicalFact[]): MateCaseMutationPlan {
  const validation = validateMateClinicalFacts(facts);
  const patches: ClinicalPatch[] = [];
  const vitalsPatch: Record<string, string> = {};
  const psychologicalPatch: Record<string, boolean> = {};
  const bloodGasPatch: Record<string, unknown> = {};

  const conflictedKeys = new Set(validation.conflicts.flatMap((c) => c.keys));

  for (const fact of validation.accepted) {
    if (conflictedKeys.has(fact.key)) continue;

    if (fact.key === "gcs.eye") {
      vitalsPatch.gcs_e = stringifyExact(fact.value);
      continue;
    }
    if (fact.key === "gcs.verbal") {
      vitalsPatch.gcs_v = stringifyExact(fact.value);
      continue;
    }
    if (fact.key === "gcs.motor") {
      vitalsPatch.gcs_m = stringifyExact(fact.value);
      continue;
    }
    if (fact.key === "gcs.total") {
      vitalsPatch.gcs = stringifyExact(fact.value);
      continue;
    }

    const psychField = PSYCH_FIELD_MAP[fact.key];
    if (psychField) {
      if (typeof fact.value === "boolean") psychologicalPatch[psychField] = fact.value;
      continue;
    }

    const bloodGasField = BLOOD_GAS_MAP[fact.key];
    if (bloodGasField) {
      bloodGasPatch[bloodGasField] = fact.value;
      continue;
    }

    // ECG is deliberately kept as a direct field until the canonical task registry
    // gains an ECG path. The Mate caller can merge this alongside vitalsPatch.
    if (fact.key === "ecg.findings") {
      continue;
    }

    const path = PATCH_PATHS[fact.key];
    if (!path) continue;

    const operation: ClinicalPatch["operation"] = ARRAY_PATHS.has(path)
      ? "addItem"
      : APPEND_PATHS.has(path)
      ? "append"
      : "set";

    patches.push({
      path,
      operation,
      value: fact.value,
      label: patchLabel(fact),
      section: sectionForKey(fact.key),
    });
  }

  // Deterministic GCS total is allowed only when all E/V/M components are present.
  // It is derived by code, never by a model. A partial GCS remains partial.
  if (!vitalsPatch.gcs && vitalsPatch.gcs_e && vitalsPatch.gcs_v && vitalsPatch.gcs_m) {
    const e = Number(vitalsPatch.gcs_e);
    const v = Number(vitalsPatch.gcs_v);
    const m = Number(vitalsPatch.gcs_m);
    if (Number.isFinite(e) && Number.isFinite(v) && Number.isFinite(m)) {
      vitalsPatch.gcs = String(e + v + m);
    }
  }

  return {
    validation,
    patches,
    vitalsPatch,
    psychologicalPatch,
    bloodGasPatch,
    requiresClarification: validation.clarifications.length > 0 || validation.conflicts.length > 0,
  };
}
