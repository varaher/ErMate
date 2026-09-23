import assert from "node:assert/strict";
import { buildMateCaseMutationPlan } from "../server/mateClinicalTaskAdapter";
import type { MateClinicalFact } from "../server/mateClinicalFacts";

const facts: MateClinicalFact[] = [
  { key: "sample.events", value: "Found lying on the floor at residence around 1 PM", evidenceText: "found lying on the floor around 1 PM at his residence", polarity: "explicit_positive", source: "voice" },

  { key: "secondary.general", value: "No pallor, icterus, cyanosis, clubbing, lymphadenopathy or edema", evidenceText: "no pallor, icterus, cyanosis, clubbing, lymphadenopathy or edema", polarity: "explicit_negative", source: "voice" },
  { key: "secondary.cvs", value: "S1 S2 normal", evidenceText: "CVS S1 S2 normal", polarity: "explicit_positive", source: "voice" },
  { key: "secondary.respiratory", value: "Normal chest expansion", evidenceText: "respiratory normal chest expansion", polarity: "explicit_positive", source: "voice" },
  { key: "secondary.abdomen", value: "Soft, non-distended", evidenceText: "abdomen soft and non-distended", polarity: "explicit_positive", source: "voice" },
  { key: "secondary.cns", value: "Conscious and oriented; left-sided weakness", evidenceText: "conscious and oriented with left-sided weakness", polarity: "explicit_positive", source: "voice" },
  { key: "secondary.extremities", value: "Normal", evidenceText: "extremities normal", polarity: "explicit_positive", source: "voice" },

  // Only E4 was dictated. Total MUST NOT be invented.
  { key: "gcs.eye", value: 4, evidenceText: "GCS E4", polarity: "partial_measurement", source: "voice" },

  // Contradiction must be surfaced, not silently reconciled.
  { key: "vitals.temperature", value: 98, unit: "F", evidenceText: "temperature 98 degree Fahrenheit", polarity: "explicit_positive", source: "voice" },
  { key: "primary.exposure", value: "Pyrexia", evidenceText: "pyrexia", polarity: "explicit_positive", source: "voice" },

  { key: "ecg.findings", value: "ECG performed; findings not otherwise specified", evidenceText: "ECG was done", polarity: "explicit_positive", source: "voice" },
  { key: "pocus.ivc", value: "IVC collapsing", evidenceText: "IVC collapsing", polarity: "explicit_positive", source: "voice" },
  { key: "pocus.wma", value: "No WMA", evidenceText: "no WMA", polarity: "explicit_negative", source: "voice" },
  { key: "pocus.renal", value: "Left renal cyst", evidenceText: "left renal cyst", polarity: "explicit_positive", source: "voice" },
  { key: "pocus.fast", value: "FAST negative", evidenceText: "FAST negative", polarity: "explicit_negative", source: "voice" },

  { key: "bloodGas.ph", value: 7.4, evidenceText: "VBG pH 7.4", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.pco2", value: 40, evidenceText: "PCO2 40", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.hco3", value: 24, evidenceText: "HCO3 24", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.sodium", value: 140, evidenceText: "sodium 140", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.potassium", value: 4.2, evidenceText: "potassium 4.2", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.hb", value: 15, evidenceText: "hemoglobin 15", polarity: "explicit_positive", source: "voice" },
  { key: "bloodGas.glucose", value: 131, evidenceText: "glucose 131", polarity: "explicit_positive", source: "voice" },

  // Only these six psychological facts were dictated. No other flags may appear.
  { key: "psych.depression", value: false, evidenceText: "no depression", polarity: "explicit_negative", source: "voice" },
  { key: "psych.anxiety", value: false, evidenceText: "no anxiety", polarity: "explicit_negative", source: "voice" },
  { key: "psych.psychosis", value: false, evidenceText: "no psychosis", polarity: "explicit_negative", source: "voice" },
  { key: "psych.agitation", value: false, evidenceText: "no agitation", polarity: "explicit_negative", source: "voice" },
  { key: "psych.suicidalIdeation", value: false, evidenceText: "no suicidal ideation", polarity: "explicit_negative", source: "voice" },
  { key: "psych.substanceUse", value: false, evidenceText: "no substance use", polarity: "explicit_negative", source: "voice" },

  { key: "investigation.lab", value: "PT/INR", evidenceText: "PT INR", polarity: "explicit_positive", source: "voice" },
  { key: "investigation.imaging", value: "CT brain with angiogram", evidenceText: "CT brain with angiogram", polarity: "explicit_positive", source: "voice" },
  { key: "treatment.plan", value: "Continuous monitoring in ER; symptomatic management; ER observation", evidenceText: "continuous monitoring in ER, symptomatic management and ER observation", polarity: "explicit_positive", source: "voice" },

  { key: "disposition.status", value: "Not yet determined", evidenceText: "disposition not yet determined", polarity: "explicit_positive", source: "voice" },
];

const plan = buildMateCaseMutationPlan(facts);

assert.equal(plan.vitalsPatch.gcs_e, "4");
assert.equal(plan.vitalsPatch.gcs, undefined, "Partial GCS must not generate a total");
assert.ok(plan.validation.clarifications.some((c) => c.code === "GCS_INCOMPLETE"));
assert.ok(plan.validation.conflicts.some((c) => c.keys.includes("vitals.temperature")));
assert.ok(plan.validation.clarifications.some((c) => c.code === "TEMPERATURE_FEVER_CONFLICT"));

assert.deepEqual(plan.psychologicalPatch, {
  depression: false,
  anxiety: false,
  psychosis: false,
  agitation: false,
  suicidalIdeation: false,
  substanceAbuse: false,
});
assert.equal("selfHarmHistory" in plan.psychologicalPatch, false);
assert.equal("intentToHarmOthers" in plan.psychologicalPatch, false);
assert.equal("psychiatricHistory" in plan.psychologicalPatch, false);
assert.equal("currentlyOnPsychiatricTreatment" in plan.psychologicalPatch, false);
assert.equal("hasSupportSystem" in plan.psychologicalPatch, false);

assert.equal(plan.bloodGasPatch.hb, 15);
assert.equal(plan.bloodGasPatch.glucose, 131);

const patchByPath = new Map(plan.patches.map((p) => [p.path + ":" + String(p.value), p]));
assert.ok(patchByPath.has("sampleHistory.events:Found lying on the floor at residence around 1 PM"));
assert.ok(patchByPath.has("secondarySurvey.cvs:S1 S2 normal"));
assert.ok(patchByPath.has("secondarySurvey.respiratory:Normal chest expansion"));
assert.ok(patchByPath.has("secondarySurvey.abdomen:Soft, non-distended"));
assert.ok(patchByPath.has("secondarySurvey.cns:Conscious and oriented; left-sided weakness"));
assert.ok(patchByPath.has("adjuncts.echoFindings:IVC collapsing"));
assert.ok(patchByPath.has("adjuncts.echoFindings:No WMA"));
assert.ok(patchByPath.has("adjuncts.echoFindings:Left renal cyst"));
assert.ok(patchByPath.has("adjuncts.efastNotes:FAST negative"));
assert.ok(patchByPath.has("investigationImaging:CT brain with angiogram"));
assert.ok(patchByPath.has("treatmentNotes:Continuous monitoring in ER; symptomatic management; ER observation"));

console.log("Mate Core safety smoke test passed");
