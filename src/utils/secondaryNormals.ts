import { parseSecondaryAssessmentToSurvey } from "../components/SecondarySurveySection";

/**
 * Adult secondary-survey "normal" findings, in ONE place for the Mark-Normal button and the
 * per-system presets. Rules (same as the primary survey):
 *  - fill a system only when nothing is recorded for it (typed in the system box OR already in the narrative);
 *  - never invent a value: GCS appears only when one is already documented elsewhere on the case.
 */
export const SECONDARY_KEYS = ["general", "cvs", "respiratory", "abdomen", "cns", "extremities"] as const;
export type SecondaryKey = typeof SECONDARY_KEYS[number];
export const SECONDARY_LABELS: Record<SecondaryKey, string> = {
  general: "General", cvs: "CVS", respiratory: "RS", abdomen: "PA", cns: "CNS", extremities: "Extremities",
};

export function adultSecondaryNormals(documentedGcs: number | null): Record<SecondaryKey, string> {
  return {
    general: "Conscious, alert, and oriented. No pallor, no icterus, no cyanosis, no clubbing, no lymphadenopathy, no edema.",
    cvs: "S1 and S2 heard, normal intensity. Regular pulse. Normal apex beat, no precordial heave. No murmurs, no gallops or rubs. JVP not elevated. Peripheral pulses well felt bilaterally.",
    respiratory: "Equal chest expansion. Bilateral equal air entry. Vesicular breath sounds. Resonant percussion. Normal vocal resonance. No wheeze, no crackles, no rhonchi.",
    abdomen: "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Tympanic percussion. Bowel sounds present and normal. Normal umbilicus, normal external genitalia, normal hernial orifices.",
    cns: `Conscious and oriented to time, place, and person. ${documentedGcs !== null ? `GCS ${documentedGcs}/15. ` : ""}Higher mental functions intact. Cranial nerves intact. Pupils: BERL. Sensory system intact. Motor system normal. Motor power 5/5 in all limbs. Reflexes normal. Romberg sign negative. Cerebellar examination normal.`,
    extremities: "Peripheral pulses present and well felt. No edema. No cyanosis or clubbing. No deformity. No swelling. Full range of motion.",
  };
}

/** A GCS the clinician already documented (vitals, primary survey, or primary narrative). Never defaults. */
export function documentedGcsOf(c: any): number | null {
  const ok = (n: number) => !isNaN(n) && n >= 3 && n <= 15;
  const v = c?.vitals?.gcs ? parseInt(String(c.vitals.gcs).trim(), 10) : NaN;
  if (ok(v)) return v;
  const s = c?.primaryAssessment?.survey?.disability?.gcsTotal;
  const sn = s !== undefined && s !== null ? parseInt(String(s).trim(), 10) : NaN;
  if (ok(sn)) return sn;
  const m = typeof c?.primaryAssessment?.disability === "string" ? c.primaryAssessment.disability.match(/GCS[:\s]*(\d+)/i) : null;
  if (m && ok(parseInt(m[1], 10))) return parseInt(m[1], 10);
  return null;
}

const has = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";

/** What is already recorded per system: the system boxes, plus anything only present in the narrative text. */
export function recordedSecondary(c: any): Partial<Record<SecondaryKey, string>> {
  const out: Partial<Record<SecondaryKey, string>> = {};
  const parsed = parseSecondaryAssessmentToSurvey(typeof c?.secondaryAssessment === "string" ? c.secondaryAssessment : "");
  for (const k of SECONDARY_KEYS) {
    if (has(parsed[k])) out[k] = parsed[k];
    if (has(c?.secondarySurvey?.[k])) out[k] = c.secondarySurvey[k];
  }
  return out;
}

export function buildSecondaryNarrative(survey: Partial<Record<SecondaryKey, string>>): string {
  return SECONDARY_KEYS.filter(k => has(survey[k])).map(k => `${SECONDARY_LABELS[k]}: ${String(survey[k]).trim()}`).join("\n");
}

/**
 * Fill ONLY the requested systems that have nothing recorded. Anything recorded is kept untouched.
 * The narrative is rebuilt from the merged systems, so it can never repeat or contradict the boxes.
 */
export function applySecondaryNormals(c: any, keys: readonly SecondaryKey[]): { secondarySurvey: Record<string, string>; secondaryAssessment: string; filled: SecondaryKey[]; kept: SecondaryKey[] } {
  const normals = adultSecondaryNormals(documentedGcsOf(c));
  const recorded = recordedSecondary(c);
  const merged: Record<string, string> = { ...(c?.secondarySurvey || {}) };
  const filled: SecondaryKey[] = [];
  const kept: SecondaryKey[] = [];
  for (const k of keys) {
    if (has(recorded[k])) { kept.push(k); if (!has(merged[k])) merged[k] = recorded[k] as string; continue; }
    merged[k] = normals[k];
    filled.push(k);
  }
  if (filled.length === 0 && kept.every(k => has(c?.secondarySurvey?.[k]))) {
    return { secondarySurvey: merged, secondaryAssessment: typeof c?.secondaryAssessment === "string" ? c.secondaryAssessment : "", filled, kept };
  }
  const full: Partial<Record<SecondaryKey, string>> = {};
  for (const k of SECONDARY_KEYS) if (has(merged[k])) full[k] = merged[k];
  for (const k of SECONDARY_KEYS) if (!has(full[k]) && has(recorded[k])) full[k] = recorded[k];
  return { secondarySurvey: merged, secondaryAssessment: buildSecondaryNarrative(full), filled, kept };
}