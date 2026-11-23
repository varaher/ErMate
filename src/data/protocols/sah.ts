import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Subarachnoid haemorrhage (adult). v0.1, 23 Nov 2026. 2023 AHA/ASA aSAH guideline; Ottawa SAH rule.
export const SAH_ADULT: ProtocolTopic = {
  id: "sah-adult",
  title: "Subarachnoid haemorrhage",
  summary:
    "Sudden severe ('worst ever', thunderclap) headache. CT within 6 hours rules it out reliably; after that, CT plus LP or CTA. Prevent rebleeding until the aneurysm is secured.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "stroke-adult",
  source: "ErMate Handbook — neurology pathway v0.1 (2023 AHA/ASA aSAH guideline)",
  keywords: ["subarachnoid haemorrhage", "subarachnoid hemorrhage", "sah", "thunderclap headache", "worst headache", "aneurysm", "nimodipine", "xanthochromia"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Thunderclap headache (peak within 1 minute): non-contrast CT head now.",
    "Low GCS: secure the airway; analgesia and antiemetic.",
    "SAH confirmed: CT angiography; call neurosurgery / interventional neuroradiology.",
    "Before the aneurysm is secured: keep SBP below 160 mmHg (avoid hypotension); reverse anticoagulants.",
    "Nimodipine 60 mg orally (or by NG) every 4 hours.",
  ],
  references: [
    "Hoh BL et al. 2023 Guideline for the Management of Patients With Aneurysmal Subarachnoid Hemorrhage (AHA/ASA). Stroke. 2023",
    "Perry JJ et al. Validation of the Ottawa Subarachnoid Hemorrhage Rule. JAMA. 2017",
    "Perry JJ et al. Sensitivity of CT performed within six hours of onset of headache for SAH. BMJ. 2011",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Sudden severe headache reaching maximum within 1 minute, often with exertion; vomiting, neck stiffness, photophobia, collapse or seizure." },
        { text: "A sentinel headache days earlier is common." },
        { text: "Third nerve palsy (posterior communicating aneurysm); subhyaloid haemorrhages." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Mostly ruptured berry aneurysms at the circle of Willis; the rest perimesencephalic or traumatic." },
        { text: "Early dangers: rebleeding (highest in the first 24 hours), hydrocephalus; later: delayed cerebral ischaemia (days 3–14), hyponatraemia." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Ottawa SAH rule", text: "For alert patients with headache peaking within 1 hour: investigate if age 40 or over, neck pain or stiffness, witnessed loss of consciousness, onset during exertion, thunderclap onset, or limited neck flexion." },
        { label: "CT within 6 hours", text: "A normal modern CT read by an experienced radiologist within 6 hours of onset effectively rules out SAH in neurologically normal patients.", critical: true },
        { label: "After 6 hours", text: "CT, then LP (xanthochromia at least 12 hours after onset) or CT angiography." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Reversible cerebral vasoconstriction", text: "Recurrent thunderclap headaches" },
        { label: "Intracerebral haemorrhage", text: "Focal deficit", link: "intracranial-haemorrhage-adult" },
        { label: "Meningitis", text: "Fever, slower onset", link: "meningitis-adult" },
        { label: "Venous sinus thrombosis", text: "Progressive, papilloedema" },
        { label: "Cervical artery dissection", text: "Neck pain, Horner's" },
        { label: "Pituitary apoplexy", text: "Visual loss, ophthalmoplegia" },
        { label: "Migraine", text: "Gradual onset, previous episodes" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "CT head", text: "Non-contrast, as soon as possible." },
        { label: "LP", text: "If CT is negative after 6 hours: opening pressure, cell counts in tubes 1 and 4, xanthochromia." },
        { label: "CTA", text: "To find the aneurysm once SAH is confirmed." },
        { label: "Bloods", text: "Sodium, coagulation, CBC, troponin, ECG (neurogenic changes)." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Blood pressure", text: "Before the aneurysm is secured, keep SBP below 160 mmHg with titratable agents; avoid hypotension.", critical: true },
        { label: "Nimodipine", text: "60 mg orally every 4 hours for 21 days (30 mg every 2 hours if it drops BP)." },
        { label: "Reversal", text: "Reverse anticoagulants immediately." },
        { label: "Analgesia / antiemetic", text: "Paracetamol, opioids as needed; ondansetron." },
        { label: "Hydrocephalus", text: "External ventricular drain by neurosurgery." },
        { label: "Not recommended", text: "Routine tranexamic acid; routine seizure prophylaxis." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Neurosurgical / neuro-ICU centre", text: "All confirmed SAH, for aneurysm coiling or clipping within 24 hours." },
        { label: "Discharge", text: "Ottawa-negative, or negative CT within 6 hours in a neurologically normal patient, with return advice." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Labelling a first thunderclap headache as migraine." },
        { text: "Relying on CT alone after 6 hours." },
        { text: "Doing the LP too early (under 12 hours) for xanthochromia." },
      ],
    },
  ],
};