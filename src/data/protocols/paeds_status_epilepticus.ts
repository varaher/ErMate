import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Status epilepticus in children (under 16). v0.1, 23 Nov 2026.
// AES 2016 guideline; ESETT (2019) / EcLiPSE / ConSEPT (2019): levetiracetam, fosphenytoin and valproate equivalent second line.
export const STATUS_EPILEPTICUS_PAEDS: ProtocolTopic = {
  id: "status-epilepticus-paeds",
  title: "Status epilepticus — child",
  summary:
    "A seizure lasting 5 minutes or more, or repeated seizures without recovery. Treat by the clock: benzodiazepine at 5 minutes, a second-line drug at 15–20, anaesthesia by 40.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (AES 2016, ESETT 2019)",
  keywords: ["status epilepticus", "seizure child", "convulsion", "fits", "febrile seizure", "midazolam", "lorazepam", "levetiracetam", "phenytoin", "valproate", "paediatric seizure"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Airway, oxygen, recovery position; check glucose now (treat if below 3 mmol/L / 54 mg/dL).",
    "At 5 minutes: benzodiazepine — midazolam 0.2 mg/kg buccal / intranasal or 0.2 mg/kg IM (maximum 10 mg), or lorazepam 0.1 mg/kg IV (maximum 4 mg).",
    "Still seizing 5–10 minutes later: repeat the benzodiazepine once.",
    "Still seizing: second-line — levetiracetam 60 mg/kg IV (maximum 4.5 g), or fosphenytoin / phenytoin 20 mg/kg, or valproate 40 mg/kg.",
    "Still seizing at 40 minutes: RSI and anaesthetic infusion with PICU.",
  ],
  references: [
    "Glauser T et al. Evidence-based guideline: treatment of convulsive status epilepticus in children and adults (American Epilepsy Society). Epilepsy Curr. 2016",
    "Kapur J et al. Randomized trial of three anticonvulsant medications for status epilepticus (ESETT). N Engl J Med. 2019",
    "Lyttle MD et al. Levetiracetam versus phenytoin for second-line treatment of paediatric convulsive status epilepticus (EcLiPSE). Lancet. 2019",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Generalised tonic-clonic movements, eye deviation, unresponsiveness; subtle twitching in a child who does not wake (non-convulsive status)." },
        { text: "Fever, rash, neck stiffness, bulging fontanelle, head injury, toxin exposure." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Failure of seizure-stopping mechanisms; GABA receptors internalise over time so benzodiazepines lose effect — treat early." },
        { text: "Beyond 30 minutes, neuronal injury, hypoxia, acidosis, hyperthermia and rhabdomyolysis follow." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Time it", text: "Note the start time; act at 5 minutes.", critical: true },
        { label: "Cause", text: "Febrile seizure, epilepsy with missed drugs, CNS infection, hypoglycaemia, hyponatraemia, hypocalcaemia, head injury, poisoning." },
        { label: "Limit benzodiazepines", text: "Two doses in total (including pre-hospital) — more causes respiratory depression without benefit." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Meningitis / encephalitis", text: "Fever, altered sensorium" },
        { label: "Hypoglycaemia", text: "Check glucose first" },
        { label: "Hyponatraemia / hypocalcaemia", text: "Infants, diarrhoea, rickets" },
        { label: "Head injury / NAI", text: "Bruises, inconsistent story" },
        { label: "Poisoning", text: "Isoniazid, TCA, OP, camphor" },
        { label: "Rigors / dystonia / syncope", text: "Mimics" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bedside", text: "Glucose immediately; VBG." },
        { label: "Bloods", text: "Sodium, calcium, magnesium, CBC, antiepileptic drug levels if on them, cultures if febrile." },
        { label: "Imaging / LP", text: "CT head for trauma, focal signs or no recovery; lumbar puncture when stable if CNS infection is possible." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "First line (5 minutes)", text: "Midazolam 0.2 mg/kg buccal or intranasal, or IM (maximum 10 mg); or lorazepam 0.1 mg/kg IV (maximum 4 mg); or diazepam 0.2–0.3 mg/kg IV (rectal 0.5 mg/kg).", critical: true },
        { label: "Second line (after 2 benzodiazepine doses)", text: "Levetiracetam 60 mg/kg IV over 5–10 minutes (maximum 4.5 g); or fosphenytoin 20 mg PE/kg / phenytoin 20 mg/kg over 20 minutes with ECG monitoring; or valproate 40 mg/kg (maximum 3 g; avoid in liver disease or suspected metabolic disease under 2 years).", critical: true },
        { label: "Third line (refractory)", text: "RSI with thiopentone, propofol or ketamine; midazolam infusion; PICU and EEG." },
        { label: "Specific causes", text: "Hypoglycaemia: 10% dextrose 2 mL/kg. Hypocalcaemia: 10% calcium gluconate 0.5 mL/kg slowly. Hyponatraemia with seizures: 3% saline 2–3 mL/kg. Isoniazid: pyridoxine." },
        { label: "Fever", text: "Antipyretic; antibiotics and aciclovir if CNS infection is possible." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "PICU", text: "Refractory status, intubated, or not recovering consciousness." },
        { label: "Admit", text: "Status epilepticus of any cause." },
        { label: "Discharge", text: "Simple febrile seizure, fully recovered, a source identified, carers confident." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Giving a third and fourth benzodiazepine instead of moving to second line." },
        { text: "Missing hypoglycaemia or hyponatraemia." },
        { text: "Assuming the seizure has stopped when the child is still not waking — non-convulsive status." },
      ],
    },
  ],
};