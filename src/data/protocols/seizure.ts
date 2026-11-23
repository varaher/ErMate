import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Seizures and status epilepticus (adult). v0.1, 23 Nov 2026. ACEP clinical policy 2024; ESETT 2019.
export const SEIZURE_ADULT: ProtocolTopic = {
  id: "seizure-adult",
  title: "Seizures and status epilepticus (adult)",
  summary:
    "A seizure lasting 5 minutes or more, or repeated seizures without recovery, is status epilepticus. Benzodiazepine first, a second-line drug next, anaesthesia if still seizing — and find the cause.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — neurology pathway v0.1 (ACEP 2024, ESETT)",
  keywords: ["seizure", "fits", "convulsion", "epilepsy", "status epilepticus", "first seizure", "lorazepam", "midazolam", "levetiracetam", "phenytoin", "valproate", "eclampsia"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Airway, oxygen, recovery position; check glucose (treat if low) and give thiamine in alcohol use.",
    "At 5 minutes: lorazepam 0.1 mg/kg IV (maximum 4 mg) or midazolam 10 mg IM / buccal (5 mg if under 40 kg); repeat once after 5 minutes.",
    "Still seizing: levetiracetam 60 mg/kg IV (maximum 4.5 g), or fosphenytoin 20 mg PE/kg, or valproate 40 mg/kg (maximum 3 g).",
    "Still seizing: RSI with propofol, midazolam or ketamine infusion; ICU and EEG.",
    "Pregnant or postpartum: treat as eclampsia — magnesium sulphate.",
  ],
  references: [
    "ACEP Clinical Policy: Critical issues in the evaluation and management of adult patients presenting to the ED with seizures. Ann Emerg Med. 2024",
    "Kapur J et al. Randomized trial of three anticonvulsant medications for status epilepticus (ESETT). N Engl J Med. 2019",
    "Glauser T et al. Evidence-based guideline: treatment of convulsive status epilepticus (American Epilepsy Society). Epilepsy Curr. 2016",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Tonic-clonic movements, tongue biting (lateral), incontinence, post-ictal confusion." },
        { text: "Non-convulsive status: persistent confusion or coma after a seizure, subtle twitching, eye deviation." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Seizures that do not stop by 5 minutes rarely stop on their own; GABA receptors are internalised over time, so benzodiazepines must be given early and in full dose." },
        { text: "Beyond 30 minutes: hypoxia, acidosis, hyperthermia, rhabdomyolysis and neuronal injury." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Under-dosing", text: "The commonest error — give full weight-based doses.", critical: true },
        { label: "Cause", text: "Missed antiepileptics, alcohol withdrawal, hypoglycaemia, hyponatraemia, hypocalcaemia, stroke, bleed, trauma, infection (including neurocysticercosis, TB, cerebral malaria), eclampsia, toxins." },
        { label: "First unprovoked seizure, back to normal", text: "Glucose, sodium, pregnancy test, ECG; neuroimaging (CT in the ED or outpatient MRI); EEG and neurology follow-up; driving advice." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Syncope with jerks", text: "Brief, quick recovery" },
        { label: "Hypoglycaemia", text: "Check glucose", link: "hypoglycaemia-adult" },
        { label: "Alcohol withdrawal", text: "6–48 h after last drink", link: "alcohol-withdrawal-adult" },
        { label: "Stroke / ICH", text: "Focal deficit", link: "intracranial-haemorrhage-adult" },
        { label: "Meningitis / encephalitis", text: "Fever, confusion", link: "meningitis-adult" },
        { label: "Eclampsia", text: "Pregnant up to 6 weeks postpartum, high BP" },
        { label: "Poisoning", text: "Isoniazid, TCA, OP", link: "poisoning-approach-adult" },
        { label: "Psychogenic non-epileptic", text: "Eyes closed, pelvic thrusting, long duration" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bedside", text: "Glucose; VBG (lactate rises after a seizure)." },
        { label: "Bloods", text: "Sodium, calcium, magnesium, renal and liver function, CBC, antiepileptic levels, CK, beta-hCG; alcohol and toxicology as indicated." },
        { label: "Imaging", text: "CT head for first seizure, focal signs, trauma, anticoagulation, persistent confusion, immunocompromise; MRI later for neurocysticercosis and structural causes." },
        { label: "LP", text: "Fever, immunocompromise or persisting confusion without another cause." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "First line", text: "Lorazepam 0.1 mg/kg IV (maximum 4 mg per dose), or midazolam 10 mg IM / intranasal / buccal (5 mg if 13–40 kg), or diazepam 0.15–0.2 mg/kg IV (maximum 10 mg); may repeat once.", critical: true },
        { label: "Second line", text: "Levetiracetam 60 mg/kg IV over 10 minutes (maximum 4.5 g), fosphenytoin 20 mg PE/kg (maximum 1500 mg PE) or phenytoin 20 mg/kg at no more than 50 mg/minute with cardiac monitoring, or valproate 40 mg/kg (maximum 3 g; avoid in pregnancy and liver disease).", critical: true },
        { label: "Refractory", text: "Intubate; propofol, midazolam or ketamine infusion; continuous EEG in ICU." },
        { label: "Eclampsia", text: "Magnesium sulphate 4 g IV over 15–20 minutes (Pritchard: plus 10 g IM split), then maintenance; deliver the baby." },
        { label: "Alcohol-related", text: "Benzodiazepines; IV thiamine; phenytoin is not effective for withdrawal seizures.", link: "alcohol-withdrawal-adult" },
        { label: "Hyponatraemia with seizures", text: "3% saline 100–150 mL bolus, repeated up to 3 times." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Refractory status, intubated." },
        { label: "Admit", text: "Status epilepticus, a serious cause, not back to baseline." },
        { label: "Discharge", text: "Known epilepsy with a single typical seizure and recovery, or first seizure fully recovered with normal tests and follow-up arranged; advice not to drive." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Small repeated benzodiazepine doses." },
        { text: "Missing non-convulsive status in a patient who does not wake up." },
        { text: "Missing eclampsia in a postpartum woman." },
      ],
    },
  ],
};