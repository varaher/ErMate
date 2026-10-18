/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Emergency triage suggestion (Priority I-V) from the presenting complaint AND vital signs.
 *
 * Reference: the department's Adult and Paediatric Emergency Triage charts (conditions per priority).
 * This is a SUGGESTION: the clinician always confirms or overrides. Design rules:
 *   1. The highest-priority (lowest number) match wins; all matches are returned in `reasons`.
 *   2. Vital signs can only RAISE priority, never lower it.
 *   3. Complaint keywords are matched on word starts and ignore negated mentions ("no chest pain").
 *   4. Nothing matched => Priority IV with `needsClinician: true` (never a silent "all clear").
 *   5. Priority V (non-urgent) is clinician-selected only; the chart lists no conditions for it.
 * Numeric vital-sign thresholds are collected in ADULT_VITAL_THRESHOLDS / PEDIATRIC_VITAL_RULES below so
 * they can be reviewed and tuned in one place. Paediatric ranges reuse the validated age-band tables.
 */

import { PatientVitals, TriageCategory, TriageLevel } from "../types";
import { levelToLegacyCategory, TRIAGE_LEVELS } from "./triageScale";
import { getPediatricVitalRange, isPediatricPatient } from "./pediatricRanges";

export interface TriageReason {
  /** Legacy 3-bucket category (what older consumers read). */
  category: TriageCategory;
  /** Priority I-V as 1-5. */
  level: TriageLevel;
  /** Headline reason for the winning priority. */
  reason: string;
  /** Every rule that fired, most urgent first. */
  reasons: string[];
  /** True when nothing on the chart matched, so the clinician must decide. */
  needsClinician: boolean;
}

// ───────────────────────── tunable numeric thresholds ─────────────────────────

/** Adult vital-sign rules (raise-only). Values are the department's working proposal; edit here to tune. */
export const ADULT_VITAL_THRESHOLDS = {
  gcs: { p1Below: 9, p2UpTo: 13 },                       // GCS <9 -> I ; 9-13 -> II
  sbp: { p1Below: 90, severeHtnSbp: 180, severeHtnDbp: 120 }, // SBP <90 -> I ; >=180 or DBP >=120 -> III
  shockIndex: { p2AtOrAbove: 1.0 },                      // HR/SBP >= 1.0 -> II (circulatory compromise)
  spo2: { p1Below: 90, p2Below: 94 },                    // <90 -> I ; 90-93 -> II
  rr: { p1AtOrAbove: 30, p1AtOrBelow: 8, p2AtOrAbove: 25, p2AtOrBelow: 10 },
  hr: { p1AtOrAbove: 150, p1AtOrBelow: 40, p2AtOrAbove: 130, p2AtOrBelow: 50 },
  tempF: { p2AtOrAbove: 104, p2AtOrBelow: 95 },
  grbs: { p2Below: 54, p2Above: 350 },                   // mg/dL
  pain: { p2AtOrAbove: 9, p3AtOrAbove: 7 },              // NRS 0-10
} as const;

/** Paediatric rules. Age-band HR/RR/SBP ranges come from the validated reference tables. */
export const PEDIATRIC_VITAL_RULES = {
  gcs: { p1Below: 8, p2UpTo: 12 },                       // chart: "GCS < 8" -> I (8 treated as I) ; 9-12 -> II
  spo2Below: 94,
  tachycardiaBeatsAboveRange: 20,                        // chart: "tachycardia more than 20 beats for age"
  fever: { tempF: 102, infantUnderYears: 2, childUpToYears: 5 }, // <2y -> II ; 2-5y -> III ; >5y -> IV
  grbs: { p2Below: 54, dkaAbove: 250 },
} as const;

// ───────────────────────────────── helpers ─────────────────────────────────

type Hit = { level: TriageLevel; reason: string };

const num = (v: string | undefined | null): number | null => {
  if (!v || !String(v).trim()) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

function parseBp(bp: string | undefined | null): { sbp: number | null; dbp: number | null } {
  const m = String(bp || "").match(/(\d{2,3})\s*[\/\\]\s*(\d{2,3})/);
  if (m) return { sbp: parseInt(m[1], 10), dbp: parseInt(m[2], 10) };
  const only = String(bp || "").match(/^\s*(\d{2,3})\s*$/);
  return { sbp: only ? parseInt(only[1], 10) : null, dbp: null };
}

/** Temperature is stored in °F; a value under 45 is assumed to be °C and converted. */
function tempToF(raw: string | undefined | null): number | null {
  const t = num(raw);
  if (t === null) return null;
  return t < 45 ? (t * 9) / 5 + 32 : t;
}

const NEGATION = /\b(no|not|nil|denies|denied|without|negative for|absent|ruled out|rule out|r\/o|free of|never)\b/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * First phrase found in `text` that is not negated within its own clause.
 * Matching is on word starts so "seizure" also matches "seizures" but "slip" does not match "slurred";
 * a phrase ending in "$" must match a whole word (e.g. "uti$" does not match "utility").
 */
export function findPhrase(text: string, phrases: readonly string[]): string | null {
  for (const phrase of phrases) {
    const whole = phrase.endsWith("$");
    const core = whole ? phrase.slice(0, -1) : phrase;
    const re = new RegExp(`\\b${escapeRe(core)}${whole ? "\\b" : ""}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const clauseBefore = text.slice(Math.max(0, m.index - 40), m.index).split(/[.;,\n]/).pop() || "";
      if (!NEGATION.test(clauseBefore)) return core;
    }
  }
  return null;
}

const any = (text: string, phrases: readonly string[]) => findPhrase(text, phrases) !== null;

// ───────────────────────────── ADULT PROTOCOL ─────────────────────────────

function adultComplaintHits(c: string): Hit[] {
  const hits: Hit[] = [];
  const add = (level: TriageLevel, reason: string) => hits.push({ level, reason });
  let p: string | null;

  // ── Priority I (immediate)
  if ((p = findPhrase(c, ["cardiac arrest", "respiratory arrest", "asystole", "pulseless", "not breathing", "cpr$"]))) add(1, `Cardiac / respiratory arrest ("${p}")`);
  if ((p = findPhrase(c, ["hypotension", "hypovolem", "anaphyla", "neurogenic shock", "cardiogenic shock", "hypovolemic shock", "hypoglycemic shock", "hypoglycaemic shock"]))) add(1, `Shock state ("${p}")`);
  if (any(c, ["hypoglyc"]) && any(c, ["unconscious", "unresponsive", "altered", "seizure", "shock", "drowsy"])) add(1, "Hypoglycaemia with altered consciousness / seizure");
  if ((p = findPhrase(c, ["active seizure", "ongoing seizure", "continuous seizure", "status epilepticus", "seizing", "convulsing"]))) add(1, `Active seizure ("${p}")`);
  if (any(c, ["head injury", "head trauma"]) && any(c, ["unconscious", "unresponsive", "altered", "drowsy", "loss of consciousness", "loc$"])) add(1, "Major head injury with altered mental status / unconsciousness");
  if ((p = findPhrase(c, ["severe bleeding", "massive bleeding", "profuse bleeding", "exsanguinat", "major trauma", "polytrauma"])) && (p !== "major trauma" && p !== "polytrauma" || any(c, ["bleed", "haemorrhage", "hemorrhage"]))) add(1, `Major trauma with severe bleeding ("${p}")`);
  if ((p = findPhrase(c, ["severe respiratory distress", "respiratory failure", "cannot breathe", "can't breathe", "unable to breathe", "severe breathlessness", "gasping"]))) add(1, `Severe respiratory distress ("${p}")`);
  if ((p = findPhrase(c, ["pneumothorax", "tamponade"]))) add(1, `Life-threatening chest condition ("${p}")`);
  if ((p = findPhrase(c, ["unconscious", "unresponsive", "comatose", "coma", "delirious", "delirium"]))) add(1, `Unconscious / delirious ("${p}")`);
  if ((any(c, ["burn"]) && any(c, ["airway", "inhalation", "singed"])) ) add(1, "Severe burns with airway compromise");
  if (any(c, ["myocardial infarction", "heart attack", "stemi", "nstemi", "mi$"]) && any(c, ["chf", "heart failure", "pulmonary edema", "pulmonary oedema", "cardiogenic", "complication"])) add(1, "Acute MI with complications (CHF / cardiogenic)");
  if ((p = findPhrase(c, ["drowning", "near drowning", "hanging", "hanged"]))) add(1, `Drowning / hanging ("${p}")`);
  if ((any(c, ["foreign body"]) && any(c, ["aspirat", "choking", "airway", "cannot breathe"])) || any(c, ["choking"])) add(1, "Foreign body aspiration (life-threatening)");
  if ((p = findPhrase(c, ["poison", "overdose", "snake bite", "snakebite", "organophosphate", "opc$"]))) add(1, `Poisoning / snake bite / overdose ("${p}")`);
  if ((p = findPhrase(c, ["neonate", "newborn"])) && any(c, ["complication", "distress", "cyanosis", "not feeding"])) add(1, "Neonate with major complications");

  // ── Priority II (very urgent)
  if ((p = findPhrase(c, ["chest pain", "chest discomfort", "chest tightness", "angina", "myocardial", "heart attack", "radiating chest"]))) add(2, `Cardiac-sounding chest pain ("${p}") — confirm with ECG`);
  if ((p = findPhrase(c, ["stroke", "cerebrovascular", "hemiplegia", "hemiparesis", "facial droop", "face drooping", "slurred speech", "aphasia", "one sided weakness", "one-sided weakness"]))) add(2, `Acute stroke features ("${p}") — check window period`);
  if ((p = findPhrase(c, ["circulatory compromise", "poor perfusion", "cold peripheries", "cold clammy"]))) add(2, `Circulatory compromise ("${p}")`);
  if ((p = findPhrase(c, ["altered sensorium", "altered mental", "drowsy", "confused", "disoriented"]))) add(2, `Altered consciousness ("${p}")`);
  if ((p = findPhrase(c, ["severe pain", "excruciating", "pain shock"]))) add(2, `Severe pain ("${p}")`);
  if ((p = findPhrase(c, ["sepsis", "septic", "meningococc"]))) add(2, `Suspected sepsis ("${p}")`);
  if ((p = findPhrase(c, ["slip and fall", "slipped and fell"]))) add(2, `Slip and fall ("${p}")`);
  if ((p = findPhrase(c, ["open fracture", "compound fracture", "exposed bone"]))) add(2, `Open fracture ("${p}")`);
  if ((p = findPhrase(c, ["dka$", "diabetic ketoacidosis", "ketoacidosis"]))) add(2, `Suspected DKA ("${p}")`);
  if ((p = findPhrase(c, ["violent", "aggressive", "combative"]))) add(2, `Violent / aggressive patient ("${p}")`);
  if (any(c, ["hypoglyc"])) add(2, "Hypoglycaemia");
  if ((p = findPhrase(c, ["respiratory distress", "shortness of breath", "breathlessness", "dyspnea", "dyspnoea", "difficulty breathing", "sob$"]))) add(2, `Breathing difficulty ("${p}") — SpO₂ / RR will escalate if abnormal`);

  // ── Priority III (urgent)
  if (any(c, ["head injury", "head trauma"]) && any(c, ["vomit", "blackout", "loss of consciousness", "loc$", "moderate"])) add(3, "Moderate head injury");
  else if (any(c, ["head injury", "head trauma"]) && !any(c, ["alert", "no vomiting"])) add(3, "Head injury (severity not stated)");
  if ((p = findPhrase(c, ["spinal cord", "spinal injury", "spine injury", "paraplegia", "quadriplegia", "paraparesis"]))) add(3, `Spinal cord injury ("${p}")`);
  if ((p = findPhrase(c, ["moderate trauma", "hip fracture", "fracture neck of femur", "pelvic fracture", "fracture pelvis", "dislocat"]))) add(3, `Moderate trauma / major fracture or dislocation ("${p}")`);
  if (any(c, ["diarrhea", "diarrhoea", "loose stool", "loose motion", "vomit"]) && any(c, ["severe dehydration", "dehydrat"])) add(3, "Diarrhoea / vomiting with dehydration");
  if ((p = findPhrase(c, ["uti$", "urinary tract infection", "burning micturition", "dysuria"]))) add(3, `Urinary tract infection ("${p}")`);
  if ((p = findPhrase(c, ["vaginal bleeding", "per vaginal bleeding", "pv bleed", "menorrhagia"]))) add(3, `Vaginal bleeding ("${p}")`);
  if ((p = findPhrase(c, ["renal colic", "renal calcul", "flank pain", "loin pain", "ureteric"]))) add(3, `Renal calculi / flank pain ("${p}")`);
  if ((p = findPhrase(c, ["abdominal pain", "abdomen pain", "pain abdomen", "pain in abdomen", "appendicitis", "cholecystitis"]))) add(3, `Acute abdominal pain ("${p}")`);
  if ((p = findPhrase(c, ["psychosis", "psychotic", "suicid"]))) add(3, `Acute psychosis / suicidal ideation ("${p}")`);
  if ((p = findPhrase(c, ["cellulitis", "abscess", "wound infection", "surgical site", "post-op", "post op", "postoperative", "post operative", "post surgery", "post-surgery"]))) add(3, `Signs of infection / post-surgical complication ("${p}")`);
  if ((p = findPhrase(c, ["bedridden", "bed ridden", "bed-ridden"]))) add(3, `Chronic bedridden patient ("${p}")`);
  if ((p = findPhrase(c, ["allergic", "allergy", "hives", "urticaria", "angioedema"]))) add(3, `Acute allergic reaction ("${p}")`);

  // ── Priority IV (standard) — recorded so the reason is explicit
  if (any(c, ["fever"]) && any(c, ["sore throat", "throat pain"])) add(4, "Fever with sore throat");
  if (any(c, ["diarrhea", "diarrhoea", "vomit"]) && !any(c, ["dehydrat"])) add(4, "Diarrhoea / vomiting without dehydration");
  if ((p = findPhrase(c, ["ankle sprain", "sprain", "minor trauma", "simple fracture", "minor injury"]))) add(4, `Minor trauma ("${p}")`);
  if ((p = findPhrase(c, ["earache", "headache", "backache", "body ache"]))) add(4, `Minor pain complaint ("${p}")`);
  if (any(c, ["head injury"]) && any(c, ["alert", "no vomiting"])) add(4, "Head injury, alert, no vomiting");
  if (any(c, ["foreign body"]) && any(c, ["eye", "nose", "ear", "throat"]) && !any(c, ["aspirat", "choking", "airway"])) add(4, "Foreign body (eye / nose / ear / throat), not life-threatening");
  if ((p = findPhrase(c, ["urti", "lrti", "respiratory tract infection", "cough", "cold$", "mild"]))) add(4, `Mild respiratory symptoms ("${p}")`);
  if ((p = findPhrase(c, ["suture removal", "catheterization", "catheterisation", "biopsy", "dressing"]))) add(4, `Minor procedure ("${p}")`);
  if ((p = findPhrase(c, ["first aid", "primary care", "medical certificate", "check up", "checkup", "follow up"]))) add(4, `Simple first aid / primary care ("${p}")`);

  return hits;
}

function adultVitalHits(v: PatientVitals): Hit[] {
  const T = ADULT_VITAL_THRESHOLDS;
  const hits: Hit[] = [];
  const add = (level: TriageLevel, reason: string) => hits.push({ level, reason });

  const gcs = num(v.gcs);
  const { sbp, dbp } = parseBp(v.bp);
  const hr = num(v.hr);
  const spo2 = num(v.spo2);
  const rr = num(v.rr);
  const tempF = tempToF(v.temp);
  const grbs = num(v.grbs);
  const pain = num(v.painScore);

  if (gcs !== null) {
    if (gcs < T.gcs.p1Below) add(1, `GCS ${gcs} (< ${T.gcs.p1Below})`);
    else if (gcs <= T.gcs.p2UpTo) add(2, `GCS ${gcs} — altered level of consciousness`);
  }
  if (sbp !== null && sbp < T.sbp.p1Below) add(1, `Hypotension: SBP ${sbp} (< ${T.sbp.p1Below})`);
  if (sbp !== null && hr !== null && sbp > 0 && hr / sbp >= T.shockIndex.p2AtOrAbove) add(2, `Shock index ${(hr / sbp).toFixed(1)} (HR ${hr} / SBP ${sbp}) — possible circulatory compromise`);
  if ((sbp !== null && sbp >= T.sbp.severeHtnSbp) || (dbp !== null && dbp >= T.sbp.severeHtnDbp)) add(3, `Severe hypertension: BP ${sbp ?? "?"}/${dbp ?? "?"}`);
  if (spo2 !== null) {
    if (spo2 < T.spo2.p1Below) add(1, `SpO₂ ${spo2}% (< ${T.spo2.p1Below}) — critical hypoxia`);
    else if (spo2 < T.spo2.p2Below) add(2, `SpO₂ ${spo2}% (< ${T.spo2.p2Below}) — hypoxia`);
  }
  if (rr !== null) {
    if (rr >= T.rr.p1AtOrAbove || rr <= T.rr.p1AtOrBelow) add(1, `RR ${rr}/min — critical`);
    else if (rr >= T.rr.p2AtOrAbove || rr <= T.rr.p2AtOrBelow) add(2, `RR ${rr}/min — abnormal`);
  }
  if (hr !== null) {
    if (hr >= T.hr.p1AtOrAbove || hr <= T.hr.p1AtOrBelow) add(1, `HR ${hr}/min — critical`);
    else if (hr >= T.hr.p2AtOrAbove || hr <= T.hr.p2AtOrBelow) add(2, `HR ${hr}/min — marked abnormality`);
  }
  if (tempF !== null && (tempF >= T.tempF.p2AtOrAbove || tempF <= T.tempF.p2AtOrBelow)) add(2, `Temperature ${tempF.toFixed(1)}°F — extreme`);
  if (grbs !== null) {
    if (grbs < T.grbs.p2Below) add(2, `GRBS ${grbs} mg/dL — hypoglycaemia`);
    else if (grbs > T.grbs.p2Above) add(2, `GRBS ${grbs} mg/dL — possible DKA / severe hyperglycaemia`);
  }
  if (pain !== null) {
    if (pain >= T.pain.p2AtOrAbove) add(2, `Pain ${pain}/10 — severe`);
    else if (pain >= T.pain.p3AtOrAbove) add(3, `Pain ${pain}/10`);
  }
  return hits;
}

// ─────────────────────────── PAEDIATRIC PROTOCOL ───────────────────────────

/** PALS lower limit of systolic BP (hypotension) by age. */
function paedHypotensionSbp(ageYears: number, ageMonths?: number | null): number {
  if (ageMonths !== null && ageMonths !== undefined && ageYears <= 1) return ageMonths < 1 ? 60 : 70;
  if (ageYears === 0) return 70;      // integer age 0 = infant of unknown month: use the infant limit
  if (ageYears < 0.1) return 60;      // neonate
  if (ageYears < 1) return 70;        // infant
  if (ageYears <= 10) return 70 + 2 * ageYears;
  return 90;
}

function paedComplaintHits(c: string, age: number, vitals: PatientVitals, ageMonths?: number | null): Hit[] {
  const R = PEDIATRIC_VITAL_RULES;
  const hits: Hit[] = [];
  const add = (level: TriageLevel, reason: string) => hits.push({ level, reason });
  let p: string | null;

  const spo2 = num(vitals.spo2);
  const rr = num(vitals.rr);
  const hr = num(vitals.hr);
  const { sbp } = parseBp(vitals.bp);
  const monthsForBand = ageMonths ?? (age === 0 ? 6 : undefined); // integer age 0 with no months = infant band
  const hrRange = getPediatricVitalRange("hr", age, monthsForBand);
  const rrRange = getPediatricVitalRange("rr", age, monthsForBand);

  const abcCue = any(c, ["abc", "airway", "breathing difficulty", "difficulty breathing", "drooling", "drowsy", "unconscious", "cyanosis", "bleeding", "compromise", "respiratory distress"]);

  // ── Priority I
  if ((p = findPhrase(c, ["gasping", "cardiac arrest", "respiratory arrest", "apnea", "apnoea", "impending arrest"]))) add(1, `Impending / actual arrest ("${p}")`);
  if ((p = findPhrase(c, ["active seizure", "ongoing seizure", "continuous seizure", "status epilepticus", "seizing", "convulsing"]))) add(1, `Active seizure ("${p}")`);
  const distress = any(c, ["respiratory distress", "tachypnoea", "tachypnea", "rapid breathing", "fast breathing", "chest retraction", "retractions", "indrawing", "difficulty breathing", "breathlessness"]);
  if (distress) {
    if (spo2 === null) add(2, "Respiratory distress — SpO₂ not entered, clinician to assess");
    else if (spo2 < R.spo2Below) add(1, `Respiratory distress with SpO₂ ${spo2}% (< ${R.spo2Below})`);
    else add(3, `Rapid breathing / retractions with SpO₂ ${spo2}% (≥ ${R.spo2Below})`);
  }
  if ((p = findPhrase(c, ["grunting", "stridor", "audible wheeze", "severe asthma", "acute severe asthma"]))) add(1, `Grunting / stridor / audible wheeze / severe asthma ("${p}")`);

  // Shock: two or more signs
  const shockSigns: string[] = [];
  if (any(c, ["altered mentation", "drowsy", "irritable", "lethargic", "altered sensorium"])) shockSigns.push("altered mentation");
  if (hr !== null && hrRange && hr > hrRange.high + R.tachycardiaBeatsAboveRange) shockSigns.push(`tachycardia (HR ${hr}, > ${hrRange.high} + ${R.tachycardiaBeatsAboveRange})`);
  if (any(c, ["cold peripheries", "poor perfusion", "crt > 3", "crt >3", "crt more than 3", "decreased urine", "reduced urine", "poor urine output"])) shockSigns.push("poor perfusion");
  if (sbp !== null && sbp < paedHypotensionSbp(age, ageMonths)) shockSigns.push(`hypotension (SBP ${sbp} < ${paedHypotensionSbp(age, ageMonths)})`);
  if (shockSigns.length >= 2) add(1, `Signs of shock (${shockSigns.join(", ")})`);
  else if (sbp !== null && sbp < paedHypotensionSbp(age, ageMonths)) add(1, `Hypotension for age (SBP ${sbp} < ${paedHypotensionSbp(age, ageMonths)})`);
  else if (shockSigns.length === 1 && shockSigns[0] !== "altered mentation") add(2, `Possible early shock (${shockSigns[0]})`);
  if (any(c, ["shock"])) add(1, "Shock stated");

  // Severe dehydration: two or more signs
  const dehySigns = ["sunken eye", "depressed fontanel", "dry tongue", "loss of skin turgor", "skin turgor", "decreased urine output", "reduced urine"].filter((s) => any(c, [s]));
  if (dehySigns.length >= 2) add(1, `Severe dehydration (${dehySigns.join(", ")})`);

  // Bites / poisoning / foreign body
  if (any(c, ["unknown bite"])) add(1, "Unknown bite");
  if ((p = findPhrase(c, ["snake bite", "snakebite", "scorpion"]))) add(abcCue ? 1 : 2, abcCue ? `Snake / scorpion bite with ABC compromise ("${p}")` : `Snake / scorpion bite without ABC compromise ("${p}")`);
  if (any(c, ["poison", "ingestion", "overdose"]) && abcCue) add(1, "Poisoning with ABC compromise");
  if ((any(c, ["foreign body"]) && any(c, ["aspirat", "choking", "airway"])) || any(c, ["choking"])) add(1, "Foreign body aspiration / airway obstruction");
  if ((p = findPhrase(c, ["neonate", "newborn", "neonatal", "days old", "day old"]))) add(1, `Neonate ("${p}")`);
  if (any(c, ["trauma", "injury", "accident"]) && any(c, ["bleeding", "hemorrhage", "haemorrhage"]) && abcCue) add(1, "Paediatric trauma with ABC compromise and bleeding");

  // Chest pain: abnormal vitals => I ; normal vitals => IV
  if (any(c, ["chest pain"])) {
    const hrAbn = hr !== null && hrRange ? hr > hrRange.high || hr < hrRange.low : false;
    const rrAbn = rr !== null && rrRange ? rr > rrRange.high || rr < rrRange.low : false;
    const sbpAbn = sbp !== null && sbp < paedHypotensionSbp(age, ageMonths);
    const spo2Abn = spo2 !== null && spo2 < R.spo2Below;
    if (hrAbn || rrAbn || sbpAbn || spo2Abn) add(1, "Chest pain with abnormal vitals (rule out SVT / tension pneumothorax)");
    else if (hr !== null || rr !== null || sbp !== null || spo2 !== null) add(4, "Chest pain with normal vitals");
    else add(2, "Chest pain — vitals not entered, clinician to assess");
  }

  // ── Priority II
  if (any(c, ["seizure", "convuls", "fit$", "fits$"]) && !any(c, ["active seizure", "status epilepticus"])) {
    if (/\b(\d+\s*(days?|d)\b|yesterday|last night|24 h|4-24|1 day)/.test(c)) add(3, "Seizure 4–24 hours ago");
    else add(2, "Seizure within the last 4 hours");
  }
  if (any(c, ["diarrhea", "diarrhoea", "loose motion", "loose stool"]) && any(c, ["some dehydration", "dehydrat"]) && !any(c, ["no dehydration"])) add(2, "Acute diarrhoea with some dehydration");
  if (any(c, ["fever"]) && any(c, ["neck pain", "neck stiff", "neck rigid", "headache", "meningitis"])) add(2, "Fever with neck pain / headache (meningitis concern)");
  if (any(c, ["hypertension", "high bp", "raised bp"])) {
    if (any(c, ["blurring", "blurred vision", "seizure", "headache"])) add(2, "Hypertension with blurring of vision / seizure / headache");
    else add(3, "Hypertension without headache or blurring");
  }
  if ((p = findPhrase(c, ["cardiac disease", "congenital heart", "heart disease", "rheumatic", "chd$"]))) add(2, `Cardiac disease without ABC compromise ("${p}")`);
  if ((p = findPhrase(c, ["neurosurg", "craniotomy", "vp shunt", "shunt"]))) add(2, `Neurosurgical patient ("${p}")`);
  if ((p = findPhrase(c, ["post op", "post-op", "postoperative", "post operative", "after surgery"]))) add(2, `Post-operative child ("${p}") — chart: within 15 days of surgery`);
  if ((p = findPhrase(c, ["child abuse", "abuse", "neglect", "non-accidental", "non accidental"]))) add(2, `Suspected child abuse ("${p}") — inform the senior doctor`);
  if ((p = findPhrase(c, ["immunocompromis", "immuno-compromis", "immuno compromis", "pnep", "prh"]))) add(2, `Immunocompromised / special-programme child ("${p}")`);
  if ((p = findPhrase(c, ["burns", "burn injury", "burnt", "burned", "scald"]))) add(2, `Burns, any degree ("${p}")`);

  // ── Priority III
  if ((p = findPhrase(c, ["active bleed", "hemoptysis", "haemoptysis", "hematemesis", "haematemesis", "epistaxis"]))) add(3, `Active bleeding ("${p}")`);
  if ((p = findPhrase(c, ["hemato-oncology", "haemato-oncology", "hematooncology", "haematooncology", "oncology", "leukemia", "leukaemia", "chemotherapy"]))) add(3, `Haemato-oncology child ("${p}")`);
  if (any(c, ["scrotal", "testicular", "testis"]) && any(c, ["pain", "painful", "acute"])) add(3, "Acute painful scrotal / testicular swelling");
  else if (any(c, ["scrotal", "penile", "testicular"]) && any(c, ["swelling"])) add(4, "Scrotal / penile swelling");
  if ((p = findPhrase(c, ["dog bite", "animal bite"]))) add(3, `Dog / animal bite ("${p}")`);
  if ((p = findPhrase(c, ["abdominal pain", "abdomen pain", "pain abdomen"]))) add(3, `Acute abdominal pain ("${p}")`);
  if (any(c, ["distension", "distention"]) && any(c, ["vomit"])) add(3, "Abdominal pain / distension with vomiting");
  if (age < 1 && any(c, ["irritable", "inconsolable", "crying"])) add(3, "Irritable crying infant (< 1 year)");
  if (/\bhb\s*(<|less than|below)\s*6\b/.test(c) || /\bplatelets?\s*(<|less than|below)\s*50[, ]?000/.test(c)) add(3, "Referral with Hb < 6 g/dL or platelets < 50,000");

  // ── Priority IV
  if ((p = findPhrase(c, ["cough", "cold$", "common cold", "runny nose"]))) add(4, `Cough / cold symptoms ("${p}")`);
  if ((p = findPhrase(c, ["throat pain", "sore throat"]))) add(4, `Throat pain ("${p}")`);
  if ((p = findPhrase(c, ["rash", "cellulitis", "skin infection", "joint pain", "joint swelling", "skin bleed"]))) add(4, `Skin rash / infection / joint pain ("${p}")`);
  if ((p = findPhrase(c, ["rat bite", "human bite"]))) add(4, `Rat / human bite ("${p}")`);
  if (any(c, ["diarrhea", "diarrhoea", "loose motion"]) && (any(c, ["no dehydration"]) || !any(c, ["dehydrat"]))) add(4, "Acute diarrhoea with no dehydration");
  if ((p = findPhrase(c, ["referral", "referred"])) && !abcCue) add(4, `Outside referral without ABC compromise ("${p}")`);
  if ((p = findPhrase(c, ["elective", "bp check", "sample collection", "iv line", "iv cannula"]))) add(4, `Elective procedure / sample collection ("${p}")`);

  return hits;
}

function paedVitalHits(v: PatientVitals, age: number, ageMonths?: number | null): Hit[] {
  const R = PEDIATRIC_VITAL_RULES;
  const hits: Hit[] = [];
  const add = (level: TriageLevel, reason: string) => hits.push({ level, reason });

  const gcs = num(v.gcs);
  const spo2 = num(v.spo2);
  const rr = num(v.rr);
  const tempF = tempToF(v.temp);
  const grbs = num(v.grbs);
  const monthsForBand = ageMonths ?? (age === 0 ? 6 : undefined);
  const rrRange = getPediatricVitalRange("rr", age, monthsForBand);
  const hrRange = getPediatricVitalRange("hr", age, monthsForBand);
  const hr = num(v.hr);

  if (gcs !== null) {
    if (gcs <= R.gcs.p1Below) add(1, `GCS ${gcs} (≤ ${R.gcs.p1Below})`);
    else if (gcs <= R.gcs.p2UpTo) add(2, `GCS ${gcs} — altered, ABC not compromised`);
  }
  if (spo2 !== null && spo2 < R.spo2Below) {
    const rrHigh = rr !== null && rrRange ? rr > rrRange.high : false;
    if (rrHigh) add(1, `SpO₂ ${spo2}% (< ${R.spo2Below}) with tachypnoea (RR ${rr})`);
    else add(2, `SpO₂ ${spo2}% (< ${R.spo2Below})`);
  }
  // Out-of-range HR / RR alone prompts a closer look (II); the shock / distress combinations above escalate to I.
  if (hr !== null && hrRange && (hr > hrRange.high + 20 || hr < hrRange.low - 20)) add(2, `HR ${hr}/min well outside age range (${hrRange.low}–${hrRange.high})`);
  if (rr !== null && rrRange && (rr > rrRange.high + 10 || rr < rrRange.low - 10)) add(2, `RR ${rr}/min well outside age range (${rrRange.low}–${rrRange.high})`);

  if (tempF !== null && tempF >= R.fever.tempF) {
    if (age < R.fever.infantUnderYears) add(2, `Fever ${tempF.toFixed(1)}°F in a child under ${R.fever.infantUnderYears} years`);
    else if (age <= R.fever.childUpToYears) add(3, `Fever ${tempF.toFixed(1)}°F in a child aged ${R.fever.infantUnderYears}–${R.fever.childUpToYears} years`);
    else add(4, `Fever ${tempF.toFixed(1)}°F in a child over ${R.fever.childUpToYears} years`);
  }
  if (grbs !== null) {
    if (grbs < R.grbs.p2Below) add(2, `GRBS ${grbs} mg/dL — hypoglycaemia`);
    else if (grbs > R.grbs.dkaAbove && rr !== null && rrRange && rr > rrRange.high) add(3, `GRBS ${grbs} mg/dL with tachypnoea — suspected DKA`);
  }
  return hits;
}

// ─────────────────────────────── entry point ───────────────────────────────

/**
 * Suggest a triage priority from age, presenting complaint and vitals.
 * Never throws; unknown / empty input yields Priority IV with needsClinician = true.
 */
export function classifyEmergencyTriage(
  age: number | null,
  complaint: string,
  vitals: PatientVitals,
  ageMonths?: number | null
): TriageReason {
  const c = (complaint || "").toLowerCase().replace(/\s+/g, " ").trim();
  const v: PatientVitals = vitals || ({} as PatientVitals);
  const paediatric = age !== null && isPediatricPatient(age);
  const protocol = paediatric ? "Paediatric" : "Adult";

  const hits = paediatric
    ? [...paedComplaintHits(c, age as number, v, ageMonths), ...paedVitalHits(v, age as number, ageMonths)]
    : [...adultComplaintHits(c), ...adultVitalHits(v)];

  if (hits.length === 0) {
    const level: TriageLevel = 4;
    return {
      category: levelToLegacyCategory(level),
      level,
      reason: `${protocol} P4: no listed condition or abnormal vital found in the entered data — clinician to confirm`,
      reasons: [],
      needsClinician: true,
    };
  }

  hits.sort((a, b) => a.level - b.level);
  const top = hits[0];
  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const h of hits) {
    const line = `P${h.level} · ${h.reason}`;
    if (!seen.has(line)) { seen.add(line); reasons.push(line); }
  }
  return {
    category: levelToLegacyCategory(top.level),
    level: top.level,
    reason: `${protocol} ${TRIAGE_LEVELS[top.level].code} (${TRIAGE_LEVELS[top.level].name}): ${top.reason}`,
    reasons,
    needsClinician: false,
  };
}
