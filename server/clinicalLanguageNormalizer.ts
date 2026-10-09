/**

 * clinicalLanguageNormalizer.ts

 *

 * Deterministic clinical-language normalizer for ErMate Scribe.

 *

 * Goal: doctors may speak naturally (Indian ED shorthand, abbreviations,

 * casual/slang wording, or compact phrases) without having to memorize

 * exact commands. This module does NOT invent findings. It only detects

 * an explicit NORMAL intent for a named examination scope.

 *

 * Safety rule:

 *   "CVS fine"              -> CVS explicitly normal

 *   "secondary all good"    -> secondary/systemic exam explicitly normal

 *   "patient fine"          -> NO exam inference

 *   "abdomen soft"          -> finding only, NOT full abdomen normal

 *   "conscious oriented"    -> finding only, NOT full CNS normal

 */

 

export type SecondaryExamSection =

  | "general"

  | "cvs"

  | "respiratory"

  | "abdomen"

  | "cns"

  | "extremities";

 

export interface ClinicalNormalcyDetection {

  abcdeNormal: boolean;

  systemicNormal: boolean;

  sectionNormals: Record<SecondaryExamSection, boolean>;

}

 

export const NORMAL_PRIMARY_SURVEY_TEMPLATES = {
  airway: "Airway patent. No stridor or obstruction.",
  breathing: "Equal chest expansion. Vesicular breath sounds bilaterally. No added sounds.",
  circulation: "Warm peripheries. CRT < 2 seconds. Pulses palpable bilaterally.",
  disability: "GCS 15/15. Pupils equal and reactive to light. No focal neurological deficit.",
  exposure: "No external injuries or significant findings.",
} as const;

export const NORMAL_EXAM_TEMPLATES = {
  airway: "Airway patent. No stridor or obstruction.",
  generalExamination:
    "Conscious, alert, and oriented. No pallor, no icterus, no cyanosis, no clubbing, no lymphadenopathy, no edema.",
  cvsExamination:
    "S1 and S2 heard, normal intensity. Regular pulse. Normal apex beat, no precordial heave. No murmurs, no gallops or rubs. JVP not elevated. Peripheral pulses well felt bilaterally.",
  respiratoryExamination:
    "Equal chest expansion. Bilateral equal air entry. Vesicular breath sounds. Resonant percussion. Normal vocal resonance. No wheeze, no crackles, no rhonchi.",
  abdomenExamination:
    "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Tympanic percussion. Bowel sounds present and normal. Normal umbilicus, normal external genitalia, normal hernial orifices.",
  cnsExamination:
    "Conscious and oriented to time, place, and person. GCS 15/15. Higher mental functions intact. Cranial nerves intact. Pupils: BERL. Sensory system intact. Motor system normal. Motor power 5/5 in all limbs. Reflexes normal. Romberg sign negative. Cerebellar examination normal.",
  extremitiesExamination:
    "Peripheral pulses present and well felt. No edema. No cyanosis or clubbing. No deformity. No swelling. Full range of motion.",
  psychologicalAssessment:
    "No features of depression, anxiety, psychosis, agitation, suicidal ideation, or substance use.",
} as const;

 

const NORMAL_WORD = String.raw`(?:normal|norml|wnl|nad|unremarkable|fine|okay|ok|all\s+good|looks?\s+good|clear|no\s+abnormalit(?:y|ies)|nothing\s+significant)`;

 

const SECTION_ALIASES: Record<SecondaryExamSection, string> = {

  general: String.raw`(?:general(?:\s+(?:exam|examination))?|gen(?:eral)?\s+exam|g\s*e)`,

  cvs: String.raw`(?:cvs(?:\s+(?:exam|examination))?|cardio(?:vascular)?(?:\s+(?:exam|examination|system))?|cardiac(?:\s+(?:exam|examination))?|heart(?:\s+(?:exam|examination))?)`,

  respiratory: String.raw`(?:rs(?:\s+(?:exam|examination))?|resp(?:iratory)?(?:\s+(?:exam|examination|system))?|chest(?:\s+(?:exam|examination))?|lungs?(?:\s+(?:exam|examination))?)`,

  abdomen: String.raw`(?:p\s*\/?\s*a|pa|per\s+abdomen|abd(?:omen|ominal)?(?:\s+(?:exam|examination))?|abdo(?:\s+(?:exam|examination))?)`,

  cns: String.raw`(?:cns(?:\s+(?:exam|examination))?|neuro(?:logical)?(?:\s+(?:exam|examination|system))?)`,

  extremities: String.raw`(?:extremit(?:y|ies)(?:\s+(?:exam|examination))?|limbs?(?:\s+(?:exam|examination))?|peripher(?:y|ies)|msk(?:\s+(?:exam|examination))?|musculoskeletal(?:\s+(?:exam|examination))?)`,

};

 

function phraseHasExplicitNormalIntent(text: string, aliasPattern: string): boolean {

  const t = text.toLowerCase();

  const forward = new RegExp(`\\b${aliasPattern}\\b[\\s,:;\\-]*(?:is\\s+|was\\s+|looks?\\s+)?${NORMAL_WORD}\\b`, "i");

  const reverse = new RegExp(`\\b${NORMAL_WORD}\\b[\\s,:;\\-]*(?:${aliasPattern})\\b`, "i");

  return forward.test(t) || reverse.test(t);

}

 

/** Detect explicit normal intent for primary, secondary, and individual systems. */

export function detectClinicalNormalcy(text: string): ClinicalNormalcyDetection {

  const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();

 

  const abcdeNormal =

    /\b(?:abcde|primary(?:\s+(?:survey|assessment|exam(?:ination)?))?)\b[^.;\n]{0,45}\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good|no\s+abnormalit(?:y|ies)|nothing\s+significant)\b/i.test(t) ||

    /\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good)\b[^.;\n]{0,20}\b(?:abcde|primary(?:\s+(?:survey|assessment|exam(?:ination)?))?)\b/i.test(t);

 

  const systemicNormal =
    /\b(?:secondary(?:\s+(?:survey|assessment|exam(?:ination)?))?|systemic(?:\s+(?:exam|examination))?|general\s+and\s+systemic\s+(?:exam|examination)|all\s+systems?|clinical\s+examinations?)\b[^.;\n]{0,55}\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good|no\s+abnormalit(?:y|ies)|nothing\s+significant|everything\s+(?:as\s+)?normal)\b/i.test(t) ||
    /\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good)\b[^.;\n]{0,25}\b(?:secondary(?:\s+(?:survey|assessment|exam(?:ination)?))?|systemic(?:\s+(?:exam|examination))?|all\s+systems?|clinical\s+examinations?)\b/i.test(t) ||
    /\bnothing\s+significant\s+on\s+(?:systemic\s+|secondary\s+)?exam(?:ination)?\b/i.test(t);

 

  const sectionNormals = {} as Record<SecondaryExamSection, boolean>;

  (Object.keys(SECTION_ALIASES) as SecondaryExamSection[]).forEach((section) => {

    sectionNormals[section] = phraseHasExplicitNormalIntent(t, SECTION_ALIASES[section]);

  });

 

  return { abcdeNormal, systemicNormal, sectionNormals };

}

 

/**

 * True only when a model-returned section value is essentially a normalcy

 * label rather than a specific finding. Specific findings are preserved.

 */

export function isNormalOnlySectionValue(value: unknown): boolean {

  if (typeof value !== "string") return false;

  const v = value.toLowerCase().trim().replace(/[.]+$/g, "").trim();

  return new RegExp(`^(?:${NORMAL_WORD})$`, "i").test(v) ||

    new RegExp(`^(?:exam(?:ination)?\s+)?(?:${NORMAL_WORD})$`, "i").test(v);

}

