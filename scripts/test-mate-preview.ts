import assert from "node:assert/strict";
import { interpretMatePreview } from "../server/matePreviewInterpreter.ts";

const poisoningNarrative = `
This patient is a 28-year-old male who was brought to the emergency department following alleged consumption of an unknown quantity of an agricultural pesticide approximately 1 hour prior to arrival. According to relatives, he subsequently developed repeated vomiting, excessive salivation, sweating and breathing difficulty. Exact compound and quantity are currently unknown. The container has been requested from the relatives.
On arrival, airway is patent but there are excessive oral secretions. Respiratory rate is 28 per minute, SpO2 is 91% on room air and bilateral conducted sounds are present. Heart rate is 58 per minute, blood pressure is 94/60 mmHg and peripheral pulses are palpable. GCS is E3 V4 M6, 13 out of 15. Pupils are bilaterally constricted.
The patient was decontaminated as appropriate while staff used suitable personal protective equipment. Oxygen, suction and continuous cardiorespiratory monitoring were initiated. IV access was secured and ABG, electrolytes, renal and liver function tests and ECG were obtained.
The clinical picture is suggestive of a cholinergic toxidrome with suspected organophosphate poisoning. Atropine therapy was initiated and titrated according to clinical response, with further antidotal and supportive management according to the identified agent and toxicology protocol.
Plan is close airway and respiratory monitoring, repeated clinical assessment, toxicology/critical-care consultation and ICU admission if required.
`.trim();

const pediatricFeverNarrative = `
This is a 5-year-old female child brought by her mother with complaints of fever for the last 3 days associated with cough, running nose, reduced oral intake and two episodes of vomiting since morning. There is no history of seizures, breathing difficulty, rash or altered sensorium. Urine output is maintained. There is no significant past medical history and the child is not on any regular medication.
On assessment, the child is conscious, alert and interacting appropriately. Airway is patent. Respiratory rate is 26 per minute, SpO2 is 98% on room air and bilateral air entry is equal with no significant added sounds. Heart rate is 118 per minute, peripheral pulses are well felt and capillary refill is less than 2 seconds. Temperature is 38.8 degrees Celsius.
Abdomen is soft and non-tender. There is no neck stiffness or focal neurological deficit. Hydration is mildly reduced with slightly dry oral mucosa.
Appropriate investigations were planned based on clinical assessment and duration of fever. Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment.
Provisional diagnosis is acute febrile illness, likely viral, with mild dehydration. Plan is hydration, symptomatic treatment, observation and reassessment for any red-flag features.
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

async function runPoisoningBenchmark() {
  const preview = await interpretMatePreview({ transcript: poisoningNarrative });
  const mapped = preview.mappedFields;
  console.log(
  "\n[MATE POISONING MAPPED]\n",
  JSON.stringify(mapped, null, 2)
);

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
  assertContains(mapped, "e3", "GCS E3 should be preserved");
  assertContains(mapped, "v4", "GCS V4 should be preserved");
  assertContains(mapped, "m6", "GCS M6 should be preserved");
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

  console.log("\nMATE remains PREVIEW-ONLY. No ClinicalCase was written or persisted.\n");
}

main().catch((error) => {
  console.error("\n✗ MATE preview regression failed\n");
  console.error(error);
  process.exitCode = 1;
});
