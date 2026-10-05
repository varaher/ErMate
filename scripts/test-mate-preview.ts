import assert from "node:assert/strict";
import { interpretMatePreview } from "../server/matePreviewInterpreter.ts";
import { cleanExtractionOutput } from "../server/extractionCleanup.ts";

// Regression guard: symptom cleanup must preserve clinical polarity and
// anatomical scope. A comma inside a clinician-stated symptom string must
// never detach a negation or anatomical qualifier.
function runSymptomPolarityCleanupRegression() {
  const pediatricNegative = cleanExtractionOutput({
    symptoms:
      "Fever for the last 3 days associated with cough, running nose, reduced oral intake and two episodes of vomiting since morning. No history of seizures, breathing difficulty, rash or altered sensorium. Urine output is maintained."
  }).symptoms ?? [];

  assert.ok(
    pediatricNegative.some(
      (s: any) =>
        typeof s === "string" &&
        /no history of seizures, breathing difficulty, rash or altered sensorium/i.test(s)
    ),
    "Explicit pediatric negative symptom scope must remain intact"
  );

  assert.equal(
    pediatricNegative.some(
      (s: any) =>
        typeof s === "string" &&
        /^(breathing difficulty|rash|rash or altered sensorium)$/i.test(s.trim())
    ),
    false,
    "Negated pediatric symptoms must not become standalone positive symptoms"
  );

  const positivePoisoning = cleanExtractionOutput({
    symptoms:
      "Repeated vomiting, excessive salivation, sweating and breathing difficulty"
  }).symptoms ?? [];

  assert.ok(
    positivePoisoning.some(
      (s: any) =>
        typeof s === "string" &&
        /breathing difficulty/i.test(s)
    ),
    "Explicit positive breathing difficulty must remain captured"
  );

  const rtaAnatomy = cleanExtractionOutput({
    symptoms:
      "C-spine tenderness, right-sided chest tenderness, deformity of the left thigh, multiple abrasions over both forearms, chest, lower abdomen, and chin, tenderness over the left thigh, both arms, chest, and lower abdomen"
  }).symptoms ?? [];

  assert.ok(
    rtaAnatomy.some(
      (s: any) =>
        typeof s === "string" &&
        /multiple abrasions over both forearms, chest, lower abdomen, and chin/i.test(s)
    ),
    "RTA anatomical scope must remain intact"
  );

  for (const unsafeFragment of [
    "Chest",
    "Lower abdomen",
    "And chin",
    "Both arms",
    "And lower abdomen"
  ]) {
    assert.equal(
      rtaAnatomy.some(
        (s: any) =>
          typeof s === "string" &&
          s.trim().toLowerCase() === unsafeFragment.toLowerCase()
      ),
      false,
      `Anatomical fragment must not become standalone symptom: ${unsafeFragment}`
    );
  }

  console.log(
    "✓ Symptom polarity/anatomical-scope cleanup regression passed assertions"
  );
}

runSymptomPolarityCleanupRegression();

const poisoningNarrative = `
This patient is a 28-year-old male who was brought to the emergency department following alleged consumption of an unknown quantity of an agricultural pesticide approximately 1 hour prior to arrival. According to relatives, he subsequently developed repeated vomiting, excessive salivation, sweating and breathing difficulty. Exact compound and quantity are currently unknown. The container has been requested from the relatives.
On arrival, airway is patent but there are excessive oral secretions. Respiratory rate is 28 per minute, SpO2 is 91% on room air and bilateral conducted sounds are present. Heart rate is 58 per minute, blood pressure is 94/60 mmHg and peripheral pulses are palpable. GCS is E3 V4 M6, 13 out of 15. Pupils are bilaterally constricted.
The patient was decontaminated as appropriate while staff used suitable personal protective equipment. Oxygen, suction and continuous cardiorespiratory monitoring were initiated. IV access was secured and ABG, electrolytes, renal and liver function tests and ECG were obtained.
The clinical picture is suggestive of a cholinergic toxidrome with suspected organophosphate poisoning. Atropine therapy was initiated and titrated according to clinical response, with further antidotal and supportive management according to the identified agent and toxicology protocol.
Plan is close airway and respiratory monitoring, repeated clinical assessment, toxicology/critical-care consultation and ICU admission if required.
`.trim();

const adultHyperglycemiaNarrative = `
49year-old male presented with complaints of multiple episodes of vomiting from today morning. Airway patent, breathing respiratory rate 24, saturation 98% room air, chest bilateral equal, air entry sounds, circulation CRT less than 2 seconds Heart rate 1017 BP 130, 90, peripheral pulses present, no radio-radial, no radio-femoral delay. Disability: E4 V5 M6, pupils reactive. GRBS 520, gram positive, exposure, temperature 97.8 degrees Fahrenheit. Adjuvants primary VBG pH 7.40, pCO2 31.3, bicarb 19.1, lactate 10.9, sodium 126, corrected sodium 135, potassium 4.3, lactate of 10.9, creatinine 1.18. History of presenting illness: patient had complaints of multiple episodes of vomiting from today morning, associated with decreased urine output for the last two days. Followed by initially went to general medicine OPD and found to have high sugars, followed by patient was referred here for shifted to ER for further evaluation management. History of fever, abdominal pain, loose stools, breathing difficulty associated. Allergies: no non-drug allergies. General examination: no pallor, clubbing, cyanosis, clubbing, no bruit, chest bilateral air entry present, abdomen soft and non-tender, CNS CNS, no focal neurological deficit, moving all four limbs, CSF1 S2 plus peripheral pulses present. Investigation: CBC, CRP, RFT, LFT, HbA1c. Treatment: injection, IV fluid 1 liter over 1 hour, stat injection human anti-rabies, 6 units IV stat, injection sompraz 40 mg IV stat, injection amoxicillin 4 mg IV stat, monitor vitals, monitor GRBS, as per worsening symptoms, general medicine consultation, plan for admission. Disposition ER observation, differential diagnosis DKA, HHS, ER resident Dr Salih ER consultant Dr. Sharukh prepare case sheet as per our format with initial assessment and emergency case record.
`.trim();

const adultRtaMlcNarrative = `
This patient is a 30-year-old male who was referred from an outside hospital following a road traffic accident, two-wheeler versus four-wheeler, near Chunungambeli at around 8 AM. The patient was the rider of the two-wheeler and, according to the patient, he was hit by a four-wheeler and was thrown off the vehicle. He was initially taken to an outside hospital and later referred here.
On initial assessment, the airway is patent. There is C-spine tenderness. Breathing-wise, respiratory rate is 20 per minute, saturation is 98%, and there is right-sided chest tenderness. In circulation, heart rate is 120 per minute and peripheral pulses are palpable. GCS is 15 out of 15, E4 V5 M6, and pupils are equal and reacting.
On exposure, there is deformity of the left thigh with no open wound. There are multiple abrasions over both forearms, chest, lower abdomen, and chin. There is tenderness over the left thigh, both arms, chest, and lower abdomen. There is no significant past medical history and the patient is not on any regular medications. Last food intake was breakfast in the morning.
ABG shows pH 7.35, PCO2 25, bicarbonate 20, sodium 130, potassium 4, chloride 110, base excess minus 2, and hemoglobin 14. Anion gap is reported as around 12.
On bedside ultrasound, free fluid is noted in the right hepatorenal angle and around the urinary bladder in the pelvis. Bedside echo shows good RV and LV function, no pericardial effusion, and no IVC collapse.
On secondary survey, no other significant abnormality is noted apart from the left thigh deformity and multiple abrasions over both forearms, chest, lower abdomen, and chin.
Treatment given includes tranexamic acid 1 gram IV stat, Sompraz 40 mg IV stat, Emeset 4 mg IV stat, and diclofenac 75 mg IV stat. Provisional diagnosis is blunt abdominal trauma with suspected hemoperitoneum and closed left femur fracture with multiple abrasions following RTA. Orthopaedics, surgery, and neurosurgery consultations were taken. The plan is to review the investigation and imaging reports, compare with the previous reports, and proceed with further definitive management and shift to OT as indicated.
`.trim();

const pediatricFeverNarrative = `
This is a 5-year-old female child brought by her mother with complaints of fever for the last 3 days associated with cough, running nose, reduced oral intake and two episodes of vomiting since morning. There is no history of seizures, breathing difficulty, rash or altered sensorium. Urine output is maintained. There is no significant past medical history and the child is not on any regular medication.
On assessment, the child is conscious, alert and interacting appropriately. Airway is patent. Respiratory rate is 26 per minute, SpO2 is 98% on room air and bilateral air entry is equal with no significant added sounds. Heart rate is 118 per minute, peripheral pulses are well felt and capillary refill is less than 2 seconds. Temperature is 38.8 degrees Celsius.
Abdomen is soft and non-tender. There is no neck stiffness or focal neurological deficit. Hydration is mildly reduced with slightly dry oral mucosa.
Appropriate investigations were planned based on clinical assessment and duration of fever. Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment.
Provisional diagnosis is acute febrile illness, likely viral, with mild dehydration. Plan is hydration, symptomatic treatment, observation and reassessment for any red-flag features.
`.trim();

const pediatricFocusedExamNarrative = `
This is a 5-year-old female child brought to the emergency department with fever and cough.

Focused physical examination was performed.

HEENT examination shows pharyngeal congestion. There is no cervical lymphadenopathy.

Respiratory system examination shows bilateral equal air entry with expiratory wheeze. There are no retractions.

Cardiovascular examination shows S1 and S2 heard with no murmur. Extremities are warm and capillary refill is less than 2 seconds.

Abdomen is soft with mild periumbilical tenderness. There is no hepatomegaly.

Back examination shows no spinal tenderness and no deformity.

Extremity examination shows no swelling, bruising, or deformity.
`.trim();

function searchable(value: unknown): string {
  return JSON.stringify(value ?? {}).toLowerCase();
}

function assertContains(haystack: unknown, needle: string, message: string) {
  assert.ok(searchable(haystack).includes(needle.toLowerCase()), message);
}

function assertDoesNotContain(haystack: unknown, needle: string, message: string) {
  assert.ok(!searchable(haystack).includes(needle.toLowerCase()), message);
}

async function inspectAdultHyperglycemiaBenchmark() {
  console.log("\n=== ADULT HYPERGLYCEMIA / DKA-HHS DIAGNOSTIC ===");

  const preview = await interpretMatePreview({
    transcript: adultHyperglycemiaNarrative,
  });

  console.log("ROUTE:", {
    intents: preview.intents,
    isPediatric: preview.isPediatric,
    executionMode: preview.executionMode,
  });

  console.log(
    "EXTRACTED:",
    JSON.stringify(preview.extracted, null, 2),
  );

  console.log(
    "MAPPED:",
    JSON.stringify(preview.mappedFields, null, 2),
  );

  console.log("WARNINGS:", preview.warnings);
}

async function runPoisoningBenchmark() {
  const preview = await interpretMatePreview({ transcript: poisoningNarrative });
  const mapped = preview.mappedFields;

  assert.equal(preview.executionMode, "PREVIEW");
  assert.equal(preview.isPediatric, false, "28-year-old must route to adult case sheet");
  assert.ok(preview.intents.includes("CLINICAL_NARRATIVE"));

  // High-value facts that the existing extraction/mapping pipeline must preserve.
  assertContains(mapped, "28", "Age should be mapped");
  assertContains(mapped, "male", "Sex should be mapped");
  assertContains(mapped, "vomit", "Vomiting should be captured");
  assertContains(mapped, "salivation", "Excess salivation should be captured");
  assertContains(mapped, "28", "RR 28 should be represented");
  assertContains(mapped, "91", "SpO2 91 should be represented");
  assertContains(mapped, "58", "HR 58 should be represented");
  assertContains(mapped, "94", "BP 94/60 should be represented");
  assert.equal(
    (mapped as any)?.vitals?.gcs_e,
    "3",
    "Explicit GCS E3 should be preserved as gcs_e=3",
  );
  assert.equal(
    (mapped as any)?.vitals?.gcs_v,
    "4",
    "Explicit GCS V4 should be preserved as gcs_v=4",
  );
  assert.equal(
    (mapped as any)?.vitals?.gcs_m,
    "6",
    "Explicit GCS M6 should be preserved as gcs_m=6",
  );
  assert.equal(
    (mapped as any)?.vitals?.gcs,
    "13",
    "Explicit total GCS 13/15 should be preserved",
  );
  assertContains(mapped, "atropine", "Atropine given should be captured as treatment");
  assertContains(mapped, "organophosphate", "Suspected organophosphate poisoning should be captured");

  // Conditional disposition must never be promoted to a completed ICU admission.
  const mappedText = searchable(mapped);
  if (mappedText.includes("icu")) {
    assert.ok(
      mappedText.includes("if required") || mappedText.includes("plan") || mappedText.includes("consider"),
      "ICU must remain conditional/plan-only, not a completed disposition",
    );
  }

  // Explicit unknowns must remain visible to the preview safety layer.
  assert.ok(
    preview.warnings.some((warning) => warning.toLowerCase().includes("unknown")),
    "Unknown compound/quantity should trigger preservation warning",
  );

  return preview;
}

async function runPediatricFeverBenchmark() {
  const preview = await interpretMatePreview({ transcript: pediatricFeverNarrative });
  const mapped = preview.mappedFields;

  assert.equal(preview.executionMode, "PREVIEW");
  assert.equal(preview.isPediatric, true, "5-year-old must route to pediatric case sheet");
  assert.ok(preview.intents.includes("CLINICAL_NARRATIVE"));

  assertContains(mapped, "5", "Age should be mapped");
  assertContains(mapped, "female", "Sex should be mapped");
  assertContains(mapped, "fever", "Fever should be captured");
  assertContains(mapped, "cough", "Cough should be captured");
  assertContains(mapped, "running nose", "Running nose should be captured");
  assertContains(mapped, "vomit", "Vomiting should be captured");
  assertContains(mapped, "26", "RR 26 should be represented");
  assertContains(mapped, "98", "SpO2 98 should be represented");
  assertContains(mapped, "118", "HR 118 should be represented");
  assertContains(mapped, "38.8", "Temperature 38.8 should be represented");
  assertContains(mapped, "soft", "Abdominal finding should be captured");
  assertContains(mapped, "non-tender", "Abdominal negative should be captured");
  assertContains(mapped, "mild", "Mild dehydration should be captured");
  assertContains(mapped, "acute febrile illness", "Provisional diagnosis should be captured");

  // Explicit negatives must survive; unmentioned allergy status must not be invented.
  assertContains(mapped, "seizure", "Explicit negative seizure history should be represented");
  assertContains(mapped, "breathing", "Explicit negative breathing difficulty should be represented");
  assertDoesNotContain(mapped, "nkda", "Unmentioned allergy status must not become NKDA");
  assertDoesNotContain(mapped, "no known drug allergies", "Unmentioned allergy status must not be invented");

  return preview;
}

async function runPediatricFocusedExamBenchmark() {
  const preview = await interpretMatePreview({
    transcript: pediatricFocusedExamNarrative,
  });

  const mapped = preview.mappedFields;
  const pediatricDetails = (mapped as any).pediatricDetails ?? {};

  assert.equal(preview.executionMode, "PREVIEW");
  assert.equal(
    preview.isPediatric,
    true,
    "5-year-old must route to pediatric case sheet",
  );

  assert.ok(
    preview.intents.includes("CLINICAL_NARRATIVE"),
    "Focused pediatric examination must remain a clinical narrative",
  );

  // IMPORTANT:
  // These assertions inspect the actual pediatric destination fields.
  // They do NOT merely search the whole mapped case.
  assertContains(
    pediatricDetails.focusedHeent,
    "pharyngeal",
    "HEENT finding must reach pediatricDetails.focusedHeent",
  );

  assertContains(
    pediatricDetails.focusedHeent,
    "lymph",
    "HEENT negative lymph-node finding must remain in focusedHeent",
  );

  assertContains(
    pediatricDetails.focusedRespiratory,
    "wheeze",
    "Respiratory finding must reach pediatricDetails.focusedRespiratory",
  );

  assertContains(
    pediatricDetails.focusedRespiratory,
    "retraction",
    "Respiratory negative finding must remain in focusedRespiratory",
  );

  assertContains(
    pediatricDetails.focusedCardiovascular,
    "S1",
    "Cardiovascular finding must reach pediatricDetails.focusedCardiovascular",
  );

  assertContains(
    pediatricDetails.focusedCardiovascular,
    "murmur",
    "Cardiovascular negative finding must remain in focusedCardiovascular",
  );

  assertContains(
    pediatricDetails.focusedAbdomen,
    "periumbilical",
    "Abdominal finding must reach pediatricDetails.focusedAbdomen",
  );

  assertContains(
    pediatricDetails.focusedAbdomen,
    "hepatomegaly",
    "Abdominal negative finding must remain in focusedAbdomen",
  );

  assertContains(
    pediatricDetails.focusedBack,
    "spinal",
    "Back finding must reach pediatricDetails.focusedBack",
  );

  assertContains(
    pediatricDetails.focusedExtremities,
    "swelling",
    "Extremity finding must reach pediatricDetails.focusedExtremities",
  );

  assertContains(
    pediatricDetails.focusedExtremities,
    "deformity",
    "Extremity negative deformity finding must remain in focusedExtremities",
  );

  console.log("\n=== PEDIATRIC FOCUSED EXAMINATION DIAGNOSTIC ===");
  console.log("route:", preview.intents);
  console.log("isPediatric:", preview.isPediatric);
  console.log("pediatricDetails:");
  console.dir(pediatricDetails, { depth: null });

  return preview;
}

async function runAdultRtaMlcDiagnostic() {
  const preview = await interpretMatePreview({
    transcript: adultRtaMlcNarrative,
  });

  console.log("\n=== ADULT RTA / MLC DIAGNOSTIC ===");
  console.log("route:", preview.intents);
  console.log("isPediatric:", preview.isPediatric);
  console.log("mappedFields:");
  console.dir(preview.mappedFields, { depth: null });
  console.log("warnings:", preview.warnings);

  return preview;
}

async function main() {
  console.log("\n=== MATE PREVIEW REGRESSION HARNESS ===\n");

  const poisoning = await runPoisoningBenchmark();
  console.log("✓ Poisoning narrative benchmark passed assertions");
  console.log("  proposed facts:", poisoning.proposedFacts.length);
  console.log("  warnings:", poisoning.warnings);

  const pediatric = await runPediatricFeverBenchmark();
  console.log("✓ Pediatric fever narrative benchmark passed assertions");
  console.log("  proposed facts:", pediatric.proposedFacts.length);
  console.log("  warnings:", pediatric.warnings);

  const pediatricFocused = await runPediatricFocusedExamBenchmark();
  console.log("✓ Pediatric focused-examination benchmark passed assertions");
  console.log("  proposed facts:", pediatricFocused.proposedFacts.length);
  console.log("  warnings:", pediatricFocused.warnings);

  await inspectAdultHyperglycemiaBenchmark();

  const rtaMlc = await runAdultRtaMlcDiagnostic();
  console.log("✓ Adult RTA/MLC diagnostic completed");
  console.log("  proposed facts:", rtaMlc.proposedFacts.length);

  console.log("\nMATE remains PREVIEW-ONLY. No ClinicalCase was written or persisted.\n");
}

main().catch((error) => {
  console.error("\n✗ MATE preview regression failed\n");
  console.error(error);
  process.exitCode = 1;
});
