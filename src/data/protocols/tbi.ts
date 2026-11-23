import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Traumatic brain injury (adult). v0.1, 23 Nov 2026.
// ATLS 11th edition (SBP above 100–110 by age, tiered ICP care); Brain Trauma Foundation 4th edition; CRASH-3.
export const TBI_ADULT: ProtocolTopic = {
  id: "tbi-adult",
  title: "Traumatic brain injury (adult)",
  summary:
    "Head injury with a risk of brain damage. The ED's job is to prevent secondary injury: no hypoxia, no hypotension, find the bleed that needs surgery, and reverse anticoagulation.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "trauma-primary-survey-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["head injury", "tbi", "traumatic brain injury", "head trauma", "edh", "sdh", "extradural", "subdural", "contusion", "concussion", "gcs", "raised icp", "herniation", "mannitol", "hypertonic saline", "ct head"],
  notice: "Draft for clinical sign-off. Early neurosurgical contact for every moderate or severe TBI.",
  firstTen: [
    "Airway and breathing: SpO2 at least 94%; intubate for GCS 8 or less or a failing airway, with neuroprotective RSI.",
    "Prevent hypotension: SBP at least 100 mmHg (110 if aged 15–49 or over 70).",
    "Record GCS (eye, verbal, motor separately) and pupils; check glucose.",
    "Ask about anticoagulants and antiplatelets — reverse them if there is a bleed.",
    "Urgent CT head and neurosurgical contact.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Carney N et al. Guidelines for the Management of Severe Traumatic Brain Injury, 4th edition. Neurosurgery. 2017",
    "CRASH-3 trial collaborators. Effects of tranexamic acid on death, disability, vascular occlusive events in TBI. Lancet. 2019",
    "Stiell IG et al. The Canadian CT Head Rule for patients with minor head injury. Lancet. 2001",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Loss of consciousness, amnesia, headache, vomiting, seizure, confusion, drowsiness." },
        { text: "Base of skull fracture: raccoon eyes, Battle's sign, CSF leak, haemotympanum." },
        { text: "Herniation: falling GCS, a unilateral dilated pupil, extensor posturing, Cushing's response (hypertension, bradycardia, irregular breathing).", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Primary injury happens at impact; secondary injury (hypoxia, hypotension, high or low CO2, fever, seizures, hypoglycaemia) is what the ED can prevent." },
        { text: "Cerebral perfusion pressure = MAP − ICP. A single episode of hypotension or hypoxia markedly worsens outcome." },
        { text: "Extradural haematoma: arterial bleed, lucid interval, rapid deterioration — a surgical emergency." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Severity", text: "Mild GCS 13–15, moderate 9–12, severe 3–8." },
        { label: "Who needs CT", text: "Use a decision rule (Canadian CT Head Rule): GCS below 15 at 2 hours, suspected open or depressed or basal skull fracture, 2 or more vomits, age 65 or over, dangerous mechanism, amnesia over 30 minutes — and everyone on anticoagulants." },
        { label: "Neuroprotection", text: "SpO2 94–98%, PaCO2 35–45 mmHg, normoglycaemia, normothermia, head up 30 degrees, collar not tight on the neck.", critical: true },
        { label: "Associated injuries", text: "Assume cervical spine injury in severe TBI until cleared.", link: "spinal-injury-adult" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Extradural haematoma", text: "Lucid interval, temporal fracture" },
        { label: "Acute subdural haematoma", text: "Elderly, anticoagulants, falls" },
        { label: "Diffuse axonal injury", text: "Low GCS, little on CT" },
        { label: "Intoxication", text: "Alcohol masks or mimics TBI — always CT if in doubt" },
        { label: "Hypoglycaemia", text: "Check glucose", link: "hypoglycaemia-adult" },
        { label: "Stroke or bleed causing the fall", text: "Spontaneous ICH, SAH", link: "intracranial-haemorrhage-adult" },
        { label: "Seizure", text: "Post-ictal state", link: "seizure-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "CT head", text: "Non-contrast CT; add CT cervical spine for moderate and severe TBI or a dangerous mechanism." },
        { label: "Bloods", text: "Glucose, CBC, coagulation (INR), sodium, VBG / ABG, crossmatch if other injuries, alcohol level." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Blood pressure", text: "SBP at least 100 mmHg (aged 50–69) or at least 110 mmHg (aged 15–49 or over 70). No permissive hypotension.", critical: true },
        { label: "Raised ICP / herniation", text: "Head up 30 degrees, sedation and analgesia, then 3% saline (250 mL) or mannitol 0.25–1 g/kg; brief hyperventilation (PaCO2 30–35) only as a bridge to surgery.", critical: true },
        { label: "Tranexamic acid", text: "1 g over 10 minutes then 1 g over 8 hours within 3 hours of injury in mild to moderate TBI (CRASH-3); a 2 g bolus is an accepted alternative." },
        { label: "Anticoagulant reversal", text: "Warfarin: 4-factor PCC plus vitamin K 10 mg IV. Dabigatran: idarucizumab. Factor Xa inhibitors: andexanet or PCC per local policy. Platelet transfusion only before surgery." },
        { label: "Seizures", text: "Treat seizures; levetiracetam or phenytoin prophylaxis for 7 days in severe TBI per neurosurgery." },
        { label: "Avoid", text: "Steroids (harmful in TBI), hypotonic fluids, hyperthermia, hypoglycaemia." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Neuroprotective RSI", text: "Pre-oxygenate, avoid hypotension (ketamine or reduced-dose induction), smooth laryngoscopy, confirm with capnography.", link: "rsi-procedure" },
        { label: "Burr hole / craniotomy", text: "Neurosurgery for extradural or subdural haematoma with mass effect." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Neurosurgery / ICU", text: "Moderate or severe TBI, any bleed with mass effect, GCS falling." },
        { label: "Admit and observe", text: "Abnormal CT without surgery, persistent symptoms, anticoagulated, no safe carer." },
        { label: "Discharge", text: "Mild TBI, normal CT or no CT indicated, GCS 15, responsible adult at home, written head-injury advice." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Blaming alcohol for a low GCS." },
        { text: "Hypotension during intubation." },
        { text: "Routine hyperventilation." },
        { text: "Discharging an anticoagulated elderly patient without a CT." },
      ],
    },
  ],
};