import fetch from "node-fetch";

const TRANSCRIPT_ANAPHYLAXIS = `A 28-year-old female was brought to the emergency department with sudden onset facial swelling, difficulty breathing, and widespread itchy hives after eating at a restaurant approximately 30 minutes ago. On arrival, she is anxious and in obvious respiratory distress. Airway shows marked lip and tongue swelling, uvular edema, and audible stridor. Breathing: tachypneic at 32 breaths per minute, bilateral expiratory wheezes throughout all lung fields, oxygen saturation 88% on room air. Circulation: pulse 130 beats per minute, weak and thready, blood pressure 75/40 mmHg, capillary refill 4 seconds, cool clammy extremities. Disability: alert, agitated, GCS 15. Exposure: generalized urticaria over face, neck, chest, and abdomen, angioedema of both periorbital regions and lips. No obvious external trauma. Vitals summary: BP 75/40, HR 130, RR 32, SpO2 88% on room air, temperature 36.8 C. Immediate resuscitation initiated. High-flow oxygen via non-rebreather mask at 15 L/min. Intramuscular epinephrine 0.5 mg 1:1000 administered immediately into the anterolateral thigh. Two wide-bore 16-gauge IV lines secured, and 1 liter of warm normal saline bolus commenced under pressure. Intravenous hydrocortisone 200 mg and intravenous chlorpheniramine 10 mg given. Nebulized salbutamol 5 mg with ipratropium 0.5 mg started for persistent bronchospasm. Patient has a known history of peanut allergy, no other significant past medical history. Not on any regular medications. Plan: continuous hemodynamic monitoring, repeat IM epinephrine in 5 minutes if no improvement, prepare for emergency airway intervention including cricothyroidotomy if stridor worsens, repeat blood pressure after fluid bolus, transfer to ICU once stabilized.`;

const TRANSCRIPT_PEDIATRIC_FEVER = `A 3-year-old male is brought by his mother with high grade fever for two days and decreased oral intake. On assessment, the child is conscious, alert and interacting appropriately. Airway is patent and clear. Breathing is comfortable, respiratory rate 26 breaths per minute, chest clear bilaterally, SpO2 99% on room air. Circulation: heart rate 118 beats per minute, regular, peripheral pulses well felt, capillary refill 2 seconds. Disability: alert, active, pupils equal and reactive, GCS 15. Temperature is 38.8 degrees Celsius. Abdomen is soft and non-tender. There is no neck stiffness or focal neurological deficit. Hydration is mildly reduced with slightly dry oral mucosa. No history of cough, vomiting, or loose stools. No known drug allergies. Immunizations up to date. Given syrup paracetamol 15 mg/kg stat in the department. Plan to send blood count and urine routine, encourage oral fluids, review after 30 minutes.`;

async function runCase(name: string, transcript: string, age: number | null) {
  console.log(`\n================== RUNNING ${name} ==================`);
  const res = await fetch("http://localhost:3000/api/scribe-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userInput: transcript,
      patientAgeYears: age,
      caseContext: {},
      caseId: "CASE-" + Date.now(),
      messages: [],
      caseData: {}
    })
  });
  const data = await res.json();
  console.log(`\n================== RESULT FOR ${name} ==================`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  await runCase("CASE 1: ANAPHYLAXIS", TRANSCRIPT_ANAPHYLAXIS, 28);
  await runCase("CASE 2: PEDIATRIC FEVER", TRANSCRIPT_PEDIATRIC_FEVER, 3);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
