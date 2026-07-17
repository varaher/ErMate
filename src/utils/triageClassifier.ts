/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatientVitals, TriageCategory } from "../types";

export interface TriageReason {
  category: TriageCategory;
  reason: string;
}

/**
 * Automatically classifies a patient's emergency triage priority (P1 to P5)
 * based on clinical rules from Pediatric & Adult Emergency Triage protocols.
 */
export function classifyEmergencyTriage(
  age: number | null,
  complaint: string,
  vitals: PatientVitals
): TriageReason {
  const comp = (complaint || "").toLowerCase();
  
  // Parse numeric vitals
  const hr = vitals.hr ? parseInt(vitals.hr) : null;
  const spo2 = vitals.spo2 ? parseInt(vitals.spo2) : null;
  const rr = vitals.rr ? parseInt(vitals.rr) : null;
  const tempC = vitals.temp ? parseFloat(vitals.temp) : null;
  const gcs = vitals.gcs ? parseInt(vitals.gcs) : 15;
  const grbs = vitals.grbs ? parseInt(vitals.grbs) : null;
  const pain = vitals.painScore ? parseInt(vitals.painScore) : 0;

  // Convert temp from F to C if needed, or assume >95 as Fahrenheit
  let tempF = tempC;
  if (tempC !== null && tempC < 45) {
    tempF = (tempC * 9) / 5 + 32;
  }

  const isPediatric = age !== null && age <= 16;

  // -------------------------------------------------------------
  // PEDIATRIC EMERGENCY TRIAGE PROTOCOL (Age <= 16)
  // -------------------------------------------------------------
  if (isPediatric) {
    // 1. PRIORITY I (IMMEDIATE)
    if (gcs < 8) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: GCS < 8 is critical" };
    }
    if (
      comp.includes("gasping") ||
      comp.includes("cardiac arrest") ||
      comp.includes("respiratory arrest")
    ) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Cardiac or respiratory arrest/gasping" };
    }
    if (comp.includes("active seizure") || comp.includes("status epilepticus")) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Active/continuous seizures" };
    }
    if (
      (comp.includes("respiratory distress") || comp.includes("tachypnoea") || comp.includes("asthma")) &&
      spo2 !== null && spo2 < 94
    ) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Severe respiratory distress with hypoxia (SpO2 < 94%)" };
    }
    if (
      comp.includes("grunting") ||
      comp.includes("stridor") ||
      comp.includes("audible wheeze") ||
      comp.includes("severe asthma")
    ) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Grunting, stridor, or acute severe asthma" };
    }
    // Signs of shock (altered mental, tachycardia, poor perfusion, BP low, CRT > 3)
    if (comp.includes("shock") || comp.includes("perfusion") || comp.includes("crt > 3") || comp.includes("cold peripheries")) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Signs of clinical shock or poor perfusion" };
    }
    // Severe dehydration (sunken eyeballs, depressed fontanels, dry tongue, loss of skin turgor)
    if (
      (comp.includes("sunken eyeball") || comp.includes("depressed fontanel") || comp.includes("turgor") || comp.includes("dehydration")) &&
      (comp.includes("dry tongue") || comp.includes("vomiting"))
    ) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Severe dehydration signs in child" };
    }
    // Unknown bites, snake/scorpion stings
    if (comp.includes("snake bite") || comp.includes("snakebite") || comp.includes("scorpion") || comp.includes("unknown bite")) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: High-risk toxic bite (Snake/Scorpion/Unknown)" };
    }
    // Neonates
    if (age !== null && age <= 0.1) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Neonate status (0-28 days)" };
    }
    if (comp.includes("poisoning") && comp.includes("compromise")) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Poisoning with airway compromise" };
    }
    if (comp.includes("foreign body") && (comp.includes("aspiration") || comp.includes("choking"))) {
      return { category: TriageCategory.P1, reason: "Pediatric P1: Foreign body aspiration/airway obstruction" };
    }

    // 2. PRIORITY II (VERY URGENT)
    if (gcs >= 9 && gcs <= 12) {
      return { category: TriageCategory.P1, reason: "Pediatric P1/P2: GCS 9-12 indicating severe neurological distress" };
    }
    if (grbs !== null && grbs < 54) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Critical hypoglycemia (GRBS < 54 mg/dL)" };
    }
    if (tempF !== null && tempF >= 102 && age !== null && age < 2) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: High fever (>=102°F) in infant less than 2 years" };
    }
    if (comp.includes("seizure") && (comp.includes("last 4 hours") || comp.includes("recent"))) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Recent seizure activity within last 4 hours" };
    }
    if (comp.includes("diarrhea") && (comp.includes("some dehydration") || comp.includes("lethargic"))) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Acute diarrhea with dehydration" };
    }
    if (comp.includes("neck pain") || comp.includes("rigidity") || comp.includes("meningitis")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Suspicion of meningitis (fever with neck stiffness)" };
    }
    if (comp.includes("burns") || comp.includes("burn")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Pediatric burn injury" };
    }
    if (comp.includes("abuse") || comp.includes("child abuse") || comp.includes("neglect")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Suspicion of child abuse or non-accidental trauma" };
    }

    // 3. PRIORITY III (URGENT)
    if (tempF !== null && tempF >= 102 && age !== null && age >= 2 && age <= 5) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: High fever (>=102°F) in child aged 2-5 years" };
    }
    if (comp.includes("active bleed") || comp.includes("hemoptysis") || comp.includes("hematemesis") || comp.includes("epistaxis")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Active bleeding (Epistaxis/Hemoptysis/Hematemesis)" };
    }
    if (comp.includes("dog bite") || comp.includes("animal bite")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: High-risk animal/dog bite" };
    }
    if (comp.includes("testicular") || comp.includes("scrotal") || comp.includes("swelling")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Acute scrotal/testicular swelling" };
    }
    if (comp.includes("dka") || (grbs !== null && grbs > 250 && comp.includes("vomiting"))) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Suspected Diabetic Ketoacidosis (DKA)" };
    }
    if (comp.includes("abdominal pain") || comp.includes("abdomen pain")) {
      return { category: TriageCategory.P2, reason: "Pediatric P2: Acute pediatric abdominal pain" };
    }

    // 4. PRIORITY IV (STANDARD)
    if (comp.includes("cough") || comp.includes("cold") || comp.includes("sore throat") || comp.includes("throat pain")) {
      return { category: TriageCategory.P3, reason: "Pediatric P3: Mild respiratory symptoms (Cough/Cold/Throat pain)" };
    }
    if (comp.includes("rash") || comp.includes("cellulitis") || comp.includes("joint pain")) {
      return { category: TriageCategory.P3, reason: "Pediatric P3: Localized infection, rash, or minor joint pain" };
    }
    if (comp.includes("rat bite") || comp.includes("human bite")) {
      return { category: TriageCategory.P3, reason: "Pediatric P3: Minor bite injury (Rat/Human)" };
    }

    // Default to P3 for pediatric otherwise
    return { category: TriageCategory.P3, reason: "Pediatric P3: Standard non-critical pediatric case" };
  }

  // -------------------------------------------------------------
  // ADULT EMERGENCY TRIAGE PROTOCOL (Age > 16 or unspecified)
  // -------------------------------------------------------------
  
  // 1. PRIORITY I (IMMEDIATE)
  if (gcs < 8) {
    return { category: TriageCategory.P1, reason: "Adult P1: GCS < 8 indicating severe neurological crisis" };
  }
  if (
    comp.includes("cardiac arrest") ||
    comp.includes("respiratory arrest") ||
    comp.includes("asystole")
  ) {
    return { category: TriageCategory.P1, reason: "Adult P1: Confirmed or impending cardio-respiratory arrest" };
  }
  if (
    comp.includes("anaphylactic shock") ||
    comp.includes("anaphylaxis") ||
    comp.includes("neurogenic shock") ||
    comp.includes("septic shock") ||
    comp.includes("hypovolemic shock") ||
    comp.includes("hypovolemia")
  ) {
    return { category: TriageCategory.P1, reason: "Adult P1: Patient in active clinical shock state" };
  }
  if (comp.includes("active seizure") || comp.includes("continuous seizure")) {
    return { category: TriageCategory.P1, reason: "Adult P1: Active / ongoing generalized seizures" };
  }
  if (comp.includes("head injury") && (comp.includes("unconscious") || comp.includes("altered mental") || comp.includes("unresponsive"))) {
    return { category: TriageCategory.P1, reason: "Adult P1: Major head injury with altered neurological state" };
  }
  if (comp.includes("severe respiratory distress") || comp.includes("cannot breathe") || (spo2 !== null && spo2 < 85)) {
    return { category: TriageCategory.P1, reason: "Adult P1: Severe respiratory distress / critical hypoxia (SpO2 < 85%)" };
  }
  if (comp.includes("pneumothorax") || comp.includes("tamponade") || comp.includes("hanging") || comp.includes("drowning")) {
    return { category: TriageCategory.P1, reason: "Adult P1: Imminent life-threatening trauma/injury" };
  }
  if (comp.includes("overdose") || comp.includes("poisoning") || comp.includes("snake bite") || comp.includes("snakebite")) {
    return { category: TriageCategory.P1, reason: "Adult P1: Acute poisoning, high-risk snake bite, or toxic overdose" };
  }

  // 2. PRIORITY II (VERY URGENT)
  if (
    comp.includes("chest pain") ||
    comp.includes("myocardial") ||
    comp.includes("heart attack") ||
    comp.includes("radiating chest pain")
  ) {
    return { category: TriageCategory.P1, reason: "Adult P1: Cardiac-sounding chest pain with potential ACS" };
  }
  if (
    comp.includes("stroke") ||
    comp.includes("hemiplegia") ||
    comp.includes("facial droop") ||
    comp.includes("slurred speech")
  ) {
    return { category: TriageCategory.P1, reason: "Adult P1: Hyperacute Stroke protocol within window period" };
  }
  if (gcs >= 9 && gcs <= 13) {
    return { category: TriageCategory.P2, reason: "Adult P2: Altered level of consciousness (GCS 9-13)" };
  }
  if (pain >= 9) {
    return { category: TriageCategory.P2, reason: "Adult P2: Intolerable pain scale (NRS 9-10)" };
  }
  if (comp.includes("sepsis") || comp.includes("meningococcal") || comp.includes("rigors")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Suspected severe sepsis / septic syndrome" };
  }
  if (comp.includes("open fracture") || comp.includes("compound fracture")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Open/Compound fracture requiring urgent reduction" };
  }
  if (comp.includes("dka") || comp.includes("diabetic ketoacidosis") || (grbs !== null && grbs > 350)) {
    return { category: TriageCategory.P2, reason: "Adult P2: Suspected severe hyperglycemia / diabetic ketoacidosis" };
  }
  if (comp.includes("violent") || comp.includes("aggressive") || comp.includes("psychosis")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Severe psychiatric agitation / violent behavior" };
  }

  // 3. PRIORITY III (URGENT)
  if (
    comp.includes("abdominal pain") ||
    comp.includes("appendicitis") ||
    comp.includes("cholecystitis") ||
    comp.includes("renal calculi") ||
    comp.includes("flank pain")
  ) {
    return { category: TriageCategory.P2, reason: "Adult P2: Acute abdominal pain suggesting surgical crisis" };
  }
  if (comp.includes("spinal") || comp.includes("moderate trauma") || comp.includes("dislocation")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Moderate skeletal trauma / major joint dislocation" };
  }
  if (comp.includes("diarrhea") && comp.includes("dehydration")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Profuse diarrhea and vomiting with severe dehydration" };
  }
  if (comp.includes("allergic") || comp.includes("allergy") || comp.includes("hives")) {
    return { category: TriageCategory.P2, reason: "Adult P2: Moderate systemic allergic reaction" };
  }

  // 4. PRIORITY IV (STANDARD)
  if (comp.includes("fever") || comp.includes("sore throat") || comp.includes("throat pain")) {
    return { category: TriageCategory.P3, reason: "Adult P3: Febrile illness with localizing ENT symptoms" };
  }
  if (comp.includes("diarrhea") || comp.includes("vomiting")) {
    return { category: TriageCategory.P3, reason: "Adult P3: Gastroenteritis without signs of severe dehydration" };
  }
  if (comp.includes("ankle sprain") || comp.includes("simple fracture") || comp.includes("minor trauma") || comp.includes("slip")) {
    return { category: TriageCategory.P3, reason: "Adult P3: Minor musculoskeletal trauma / simple fracture" };
  }
  if (comp.includes("headache") || comp.includes("earache") || comp.includes("backache")) {
    return { category: TriageCategory.P3, reason: "Adult P3: Minor acute localized pain symptom" };
  }

  // Default to non-urgent standard P3
  return { category: TriageCategory.P3, reason: "Adult P3: Standard non-critical ER case" };
}
