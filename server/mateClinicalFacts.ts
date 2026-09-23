/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mate Clinical Fact Layer
 *
 * Purpose:
 *   Convert model-understood clinician speech into auditable clinical facts BEFORE
 *   anything is allowed to touch ClinicalCase.
 *
 * Locked safety contract:
 *   - Explicit positive -> capture.
 *   - Explicit negative -> capture.
 *   - Explicit section-normal -> expand only via an approved normal template.
 *   - Unmentioned -> do not create a fact.
 *   - Ambiguous / contradictory -> flag for clarification.
 *   - Never invent.
 *
 * This module is intentionally model-agnostic. GPT/Astra/Claude/Sarvam do not get
 * write access to ClinicalCase through this layer; they may only propose facts.
 */

export type MateFactSource = "voice" | "typed" | "scan" | "manual";
export type MateFactPolarity =
  | "explicit_positive"
  | "explicit_negative"
  | "explicit_normal_template"
  | "partial_measurement";

export type MateCanonicalKey =
  | "vitals.bp"
  | "vitals.hr"
  | "vitals.rr"
  | "vitals.spo2"
  | "vitals.temperature"
  | "vitals.grbs"
  | "gcs.eye"
  | "gcs.verbal"
  | "gcs.motor"
  | "gcs.total"
  | "sample.symptoms"
  | "sample.allergies"
  | "sample.medications"
  | "sample.pastHistory"
  | "sample.lastMeal"
  | "sample.events"
  | "primary.airway"
  | "primary.breathing"
  | "primary.circulation"
  | "primary.disability"
  | "primary.exposure"
  | "secondary.general"
  | "secondary.cvs"
  | "secondary.respiratory"
  | "secondary.abdomen"
  | "secondary.cns"
  | "secondary.extremities"
  | "psych.depression"
  | "psych.anxiety"
  | "psych.psychosis"
  | "psych.agitation"
  | "psych.suicidalIdeation"
  | "psych.substanceUse"
  | "psych.selfHarmHistory"
  | "psych.intentToHarmOthers"
  | "psych.psychiatricHistory"
  | "psych.psychiatricTreatment"
  | "psych.supportSystem"
  | "ecg.findings"
  | "pocus.ivc"
  | "pocus.wma"
  | "pocus.renal"
  | "pocus.fast"
  | "bloodGas.ph"
  | "bloodGas.pco2"
  | "bloodGas.po2"
  | "bloodGas.hco3"
  | "bloodGas.lactate"
  | "bloodGas.sodium"
  | "bloodGas.potassium"
  | "bloodGas.glucose"
  | "bloodGas.hb"
  | "investigation.lab"
  | "investigation.imaging"
  | "treatment.medication"
  | "treatment.plan"
  | "diagnosis.provisional"
  | "diagnosis.differential"
  | "disposition.status";

export interface MateClinicalFact {
  key: MateCanonicalKey;
  value: unknown;
  /** Exact clinician/source phrase supporting this fact. Never model rationale. */
  evidenceText: string;
  polarity: MateFactPolarity;
  source: MateFactSource;
  /** Optional unit exactly as stated. Never inferred. */
  unit?: string | null;
  /** Required only for explicit_normal_template. */
  templateId?: string | null;
  timestamp?: string;
}

export interface MateRejectedFact {
  fact: MateClinicalFact;
  reason: string;
}

export interface MateFactConflict {
  keys: MateCanonicalKey[];
  message: string;
  evidence: string[];
}

export interface MateClarification {
  code:
    | "GCS_INCOMPLETE"
    | "GCS_TOTAL_UNSUPPORTED"
    | "TEMPERATURE_UNIT_REQUIRED"
    | "TEMPERATURE_FEVER_CONFLICT"
    | "CONFLICTING_FACTS";
  question: string;
  keys: MateCanonicalKey[];
}

export interface MateFactValidationResult {
  accepted: MateClinicalFact[];
  rejected: MateRejectedFact[];
  conflicts: MateFactConflict[];
  clarifications: MateClarification[];
}

/**
 * Only templates whose semantics have been explicitly approved may ever expand a
 * general "normal" statement into multiple findings. Psychological normal is
 * intentionally NOT approved here.
 */
export const APPROVED_NORMAL_TEMPLATES = new Set([
  "ABCDE_NORMAL_V1",
  "SYSTEMIC_EXAM_NORMAL_V1",
]);

const PSYCH_KEYS = new Set<MateCanonicalKey>([
  "psych.depression",
  "psych.anxiety",
  "psych.psychosis",
  "psych.agitation",
  "psych.suicidalIdeation",
  "psych.substanceUse",
  "psych.selfHarmHistory",
  "psych.intentToHarmOthers",
  "psych.psychiatricHistory",
  "psych.psychiatricTreatment",
  "psych.supportSystem",
]);

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeComparable(value: unknown): string {
  if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function dedupeFacts(facts: MateClinicalFact[]): MateClinicalFact[] {
  const seen = new Set<string>();
  const out: MateClinicalFact[] = [];
  for (const fact of facts) {
    const sig = [fact.key, normalizeComparable(fact.value), fact.polarity, fact.evidenceText.trim()].join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(fact);
  }
  return out;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function explicitTotalSupportedByEvidence(fact: MateClinicalFact): boolean {
  const total = parseNumeric(fact.value);
  if (total === null) return false;
  const escaped = String(total).replace(".", "\\.");
  const evidence = fact.evidenceText;
  return new RegExp(`\\bgcs\\s*(?:is|:|=)?\\s*${escaped}(?:\\s*\\/\\s*15)?\\b`, "i").test(evidence);
}

function validateGcsRange(key: MateCanonicalKey, value: unknown): string | null {
  const n = parseNumeric(value);
  if (n === null) return `${key} must contain a numeric value.`;
  if (key === "gcs.eye" && (n < 1 || n > 4)) return "GCS eye must be E1-E4.";
  if (key === "gcs.verbal" && (n < 1 || n > 5)) return "GCS verbal must be V1-V5.";
  if (key === "gcs.motor" && (n < 1 || n > 6)) return "GCS motor must be M1-M6.";
  if (key === "gcs.total" && (n < 3 || n > 15)) return "GCS total must be 3-15.";
  return null;
}

function feverFact(facts: MateClinicalFact[]): MateClinicalFact | undefined {
  return facts.find((f) =>
    f.key === "primary.exposure" &&
    /\b(?:fever|febrile|pyrexia|pyrexial)\b/i.test(`${String(f.value)} ${f.evidenceText}`)
  );
}

function evaluateTemperatureConflict(
  accepted: MateClinicalFact[],
  conflicts: MateFactConflict[],
  clarifications: MateClarification[]
): void {
  const temp = accepted.find((f) => f.key === "vitals.temperature");
  const fever = feverFact(accepted);
  if (!temp || !fever) return;

  const n = parseNumeric(temp.value);
  if (n === null) return;
  const unitRaw = (temp.unit || "").trim().toUpperCase();

  if (!unitRaw) {
    clarifications.push({
      code: "TEMPERATURE_UNIT_REQUIRED",
      question: "Temperature and pyrexia were both documented. What unit was the temperature recorded in (°C or °F)?",
      keys: ["vitals.temperature", "primary.exposure"],
    });
    return;
  }

  const isC = unitRaw === "C" || unitRaw === "°C" || unitRaw.includes("CELSIUS");
  const isF = unitRaw === "F" || unitRaw === "°F" || unitRaw.includes("FAHRENHEIT");
  if (!isC && !isF) return;

  const febrileByValue = isC ? n >= 38 : n >= 100.4;
  if (!febrileByValue) {
    conflicts.push({
      keys: ["vitals.temperature", "primary.exposure"],
      message: "Recorded temperature does not support the simultaneously documented pyrexia statement.",
      evidence: [temp.evidenceText, fever.evidenceText],
    });
    clarifications.push({
      code: "TEMPERATURE_FEVER_CONFLICT",
      question: "The recorded temperature and the statement 'pyrexia' conflict. Which finding should be retained?",
      keys: ["vitals.temperature", "primary.exposure"],
    });
  }
}

/**
 * Validate facts proposed by Mate/Astra before they can be adapted to ClinicalCase.
 */
export function validateMateClinicalFacts(inputFacts: MateClinicalFact[]): MateFactValidationResult {
  const accepted: MateClinicalFact[] = [];
  const rejected: MateRejectedFact[] = [];
  const conflicts: MateFactConflict[] = [];
  const clarifications: MateClarification[] = [];

  for (const fact of dedupeFacts(inputFacts || [])) {
    if (!fact || !fact.key) continue;

    if (isBlank(fact.evidenceText)) {
      rejected.push({ fact, reason: "Clinical facts require an exact source/evidence phrase." });
      continue;
    }

    if (isBlank(fact.value)) {
      rejected.push({ fact, reason: "Blank/unknown values are not facts and must remain undocumented." });
      continue;
    }

    if (fact.polarity === "explicit_normal_template") {
      if (!fact.templateId || !APPROVED_NORMAL_TEMPLATES.has(fact.templateId)) {
        rejected.push({ fact, reason: "Normal-template expansion is not approved for this template." });
        continue;
      }
      if (PSYCH_KEYS.has(fact.key)) {
        rejected.push({ fact, reason: "Psychological normal-template expansion is not approved." });
        continue;
      }
    }

    if (fact.key.startsWith("psych.") && typeof fact.value === "boolean") {
      if (fact.polarity !== "explicit_positive" && fact.polarity !== "explicit_negative") {
        rejected.push({ fact, reason: "Psychological boolean findings require explicit positive/negative clinician evidence." });
        continue;
      }
    }

    if (fact.key.startsWith("gcs.")) {
      const rangeError = validateGcsRange(fact.key, fact.value);
      if (rangeError) {
        rejected.push({ fact, reason: rangeError });
        continue;
      }
      if (fact.key === "gcs.total" && !explicitTotalSupportedByEvidence(fact)) {
        // A total can still be generated later deterministically if E+V+M are all present,
        // but a model-proposed total must never masquerade as an explicitly documented fact.
        rejected.push({ fact, reason: "GCS total was not explicitly supported by the clinician's evidence phrase." });
        clarifications.push({
          code: "GCS_TOTAL_UNSUPPORTED",
          question: "A complete GCS total was not explicitly documented. Please provide the missing GCS components if required.",
          keys: ["gcs.total"],
        });
        continue;
      }
    }

    accepted.push(fact);
  }

  // Same canonical field, different values in the same turn -> do not silently choose.
  const byKey = new Map<MateCanonicalKey, MateClinicalFact[]>();
  for (const fact of accepted) {
    const arr = byKey.get(fact.key) || [];
    arr.push(fact);
    byKey.set(fact.key, arr);
  }
  for (const [key, facts] of byKey.entries()) {
    const values = new Set(facts.map((f) => normalizeComparable(f.value)));
    if (values.size > 1) {
      conflicts.push({
        keys: [key],
        message: `Conflicting values were documented for ${key}.`,
        evidence: facts.map((f) => f.evidenceText),
      });
      clarifications.push({
        code: "CONFLICTING_FACTS",
        question: `More than one value was documented for ${key}. Which value should be retained?`,
        keys: [key],
      });
    }
  }

  // GCS partiality is valid; the total must remain undocumented until explicit or E+V+M complete.
  const eye = accepted.find((f) => f.key === "gcs.eye");
  const verbal = accepted.find((f) => f.key === "gcs.verbal");
  const motor = accepted.find((f) => f.key === "gcs.motor");
  const total = accepted.find((f) => f.key === "gcs.total");
  const componentsPresent = [eye, verbal, motor].filter(Boolean).length;
  if (componentsPresent > 0 && componentsPresent < 3 && !total) {
    clarifications.push({
      code: "GCS_INCOMPLETE",
      question: "GCS is incomplete. Please provide the missing eye, verbal or motor response(s) if available.",
      keys: ["gcs.eye", "gcs.verbal", "gcs.motor"],
    });
  }

  evaluateTemperatureConflict(accepted, conflicts, clarifications);

  return { accepted, rejected, conflicts, clarifications };
}
