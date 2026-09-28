import fetch from "node-fetch";

const TRANSCRIPT_ANAPHYLAXIS = `This patient is a 24-year-old female who presented with sudden onset generalized itching, urticarial rash, swelling of the lips and face, throat tightness, wheezing and giddiness approximately 15 minutes after eating food containing peanuts. She has a previous history of allergy to peanuts.
On arrival, the patient is anxious and has facial and lip swelling. Airway is currently patent, but she complains of throat tightness and her voice is becoming hoarse. Respiratory rate is 30 per minute, SpO2 is 90% on room air and bilateral wheeze is present. Heart rate is 132 per minute, blood pressure is 78/46 mmHg, peripheral pulses are feeble and capillary refill is prolonged. GCS is 15 out of 15.
A diagnosis of anaphylaxis with airway, breathing and circulatory involvement was made. IM adrenaline was administered immediately into the anterolateral thigh according to the recommended adult dose. High-flow oxygen was started, IV access was secured and IV crystalloid resuscitation was initiated. Continuous cardiorespiratory monitoring was started, with preparation for repeat IM adrenaline and advanced airway management if required.
Provisional diagnosis is severe food-triggered anaphylaxis with anaphylactic shock. Plan is repeated reassessment of airway, breathing and circulation, repeat IM adrenaline if clinically indicated, continued resuscitation and appropriate observation after stabilization.`;

const TRANSCRIPT_PEDIATRIC_FEVER = `This is a 5-year-old female child brought by her mother with complaints of fever for the last 3 days associated with cough, running nose, reduced oral intake and two episodes of vomiting since morning. There is no history of seizures, breathing difficulty, rash or altered sensorium. Urine output is maintained. There is no significant past medical history and the child is not on any regular medication.
On assessment, the child is conscious, alert and interacting appropriately. Airway is patent. Respiratory rate is 26 per minute, SpO2 is 98% on room air and bilateral air entry is equal with no significant added sounds. Heart rate is 118 per minute, peripheral pulses are well felt and capillary refill is less than 2 seconds. Temperature is 38.8 degrees Celsius.
Abdomen is soft and non-tender. There is no neck stiffness or focal neurological deficit. Hydration is mildly reduced with slightly dry oral mucosa.
Appropriate investigations were planned based on clinical assessment and duration of fever. Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment.
Provisional diagnosis is acute febrile illness, likely viral, with mild dehydration. Plan is hydration, symptomatic treatment, observation and reassessment for any red-flag features.`;

const TRANSCRIPT_STROKE = `Initial assessment, emergency department case, Date and time of incident: around 1 p.m. on 22-9-2026, place of incident: at his residence, age of incident: found lying on the floor around 1 p.m. on 22-9-2026, then place of incident, then brought by Patma, informant himself, identification mark: there is a surgical mark over the right lower abdomen, presenting complaint: primary assessment airway patent, breathing RR 18 per minute, saturation 98% on room air, breathing normal, air entry bilateral equal, CCT negative, FAST negative, circulation CRT less than 2 seconds, heart rate 80 per minute, saturation, BP 160/90 mmHg, peripheral pulses present, PCD negative, FAST negative, left side kidney: there is a large cyst seen on the left side kidney, disability GCS E4, GCS E4, pupils bilaterally equal and reactive to light, GRBS in exposure temperature 98 degree, pyrexia, log roll, Nion Nidu, adjuvant primary: P2, then adjuvant primary ECG, BBG PAG 7.425, PCO2 38, Hb 15, sodium 135, potassium 3.6, glucose 131, HCO3 24.5, then GRBS 122 milligram per deciliter. Then the VBG, ECG, then history of presenting illness: patient came to ER with complaints of found lying on the home around 10-1 p.m., and the patient found to have left weakness over the left upper limb, lower limb weakness with face, for which he came here for further evaluation and management. Code 7 has activated, no history of any trauma or external injuries, seizure for the patient, secondary survey signs and symptoms, left side upper limb, lower limb weakness, left upper limb, lower limb weakness. Then bedside screening, IVC, collapsing, no bleedance, no WMA. The secondary survey signs and symptoms: the left upper limb, lower limb weakness, past medical history: hypertension. Then surgical history: nil, family or gynec history: LMP, not applicable allergies: nil. General examination: no pallor, icterus, cyanosis, clubbing, lymphadenopathy, or edema. Systemic examination: CVS S1 S2 normal, chest normal expansion, abdomen soft and non-distended, then CNS: conscious, oriented, no focal neurological deficit. Left upper limb zero by 1, left lower limb zero by 5, and right upper limb 5 by 5, right lower limb 5 by 5. Then extremities normal. Psychological assessment: no features of depression, anxiety, psychosis, agitation, suicidal ideation, substance use. Investigations: ER advanced, PT-INR, CT brain with angiogram, code 7 activated, treatment plan: continuous monitoring in ER, symptomatic management with ingestion, symptomatic management with ingestion, this patient ER observation, CT brain with angiogram, differential diagnosis IC brain CVA, MR scan, Doctor Fatima, EM consultant doctor, Doctor Shabnam, Shashi, make a case sheet in number format.`;

async function runCase(name: string, transcript: string, age: number | null) {
  console.log(`\n======================================================`);
  console.log(`RUNNING ${name}`);
  console.log(`======================================================`);
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
  const data: any = await res.json();
  console.log(`\nRESULT FOR ${name}:`);
  console.log(`SUCCESS: ${data.success}`);
  console.log(`RAW:`, JSON.stringify(data.runtimeDebug?.raw, null, 2));
  console.log(`CLEANED:`, JSON.stringify(data.runtimeDebug?.cleaned, null, 2));
  console.log(`UNAPPLIED EXTRACTION:`, JSON.stringify(data.unappliedExtraction, null, 2));
}

async function main() {
  await runCase("CASE 1: ANAPHYLAXIS", TRANSCRIPT_ANAPHYLAXIS, 24);
  await runCase("CASE 2: PEDIATRIC FEVER", TRANSCRIPT_PEDIATRIC_FEVER, 5);
  await runCase("CASE 3: STROKE REGRESSION", TRANSCRIPT_STROKE, null);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
