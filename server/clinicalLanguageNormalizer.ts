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

 

export const NORMAL_EXAM_TEMPLATES = {

  airway: "Patent",

  generalExamination:

    "No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.",

  cvsExamination:

    "S1 S2 heard. No murmurs. Peripheral pulses normal.",

  respiratoryExamination:

    "Air entry bilaterally equal. Normal vesicular breath sounds. No added sounds.",

  abdomenExamination:

    "Soft, non-tender. No distension. No organomegaly. Bowel sounds present.",

  cnsExamination:

    "Moving all four limbs. No focal neurological deficit.",

  extremitiesExamination:

    "No visible abnormality.",

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

    /\b(?:secondary(?:\s+(?:survey|assessment|exam(?:ination)?))?|systemic(?:\s+(?:exam|examination))?|general\s+and\s+systemic\s+(?:exam|examination)|all\s+systems?)\b[^.;\n]{0,55}\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good|no\s+abnormalit(?:y|ies)|nothing\s+significant)\b/i.test(t) ||

    /\b(?:normal|wnl|nad|unremarkable|fine|okay|ok|all\s+good)\b[^.;\n]{0,25}\b(?:secondary(?:\s+(?:survey|assessment|exam(?:ination)?))?|systemic(?:\s+(?:exam|examination))?|all\s+systems?)\b/i.test(t) ||

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

