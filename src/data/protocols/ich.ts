import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Spontaneous intracerebral haemorrhage (adult). v0.1, 23 Nov 2026. 2022 AHA/ASA ICH guideline; INTERACT3 (2023).
export const ICH_ADULT: ProtocolTopic = {
  id: "intracranial-haemorrhage-adult",
  title: "Intracerebral haemorrhage (spontaneous)",
  summary:
    "Bleeding into the brain, usually from hypertension or anticoagulation. Lower the blood pressure promptly but smoothly, reverse anticoagulants fast, and involve neurosurgery early.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "stroke-adult",
  source: "ErMate Handbook — neurology pathway v0.1 (2022 AHA/ASA ICH guideline)",
  keywords: ["intracerebral haemorrhage", "intracerebral hemorrhage", "ich", "brain bleed", "haemorrhagic stroke", "hemorrhagic stroke", "hypertensive bleed", "anticoagulant bleed"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "ABC; intubate for GCS 8 or less or failing airway.",
    "Non-contrast CT head; CT angiography if a vascular cause is possible (young, lobar, no hypertension).",
    "SBP 150–220: lower to about 140 mmHg (keep within 130–150) within the first hour, smoothly; avoid dropping below 130.",
    "Ask about anticoagulants and antiplatelets now; reverse anticoagulation immediately.",
    "Neurosurgery for cerebellar bleeds, hydrocephalus or large lobar bleeds with deterioration.",
  ],
  references: [
    "Greenberg SM et al. 2022 Guideline for the Management of Patients With Spontaneous Intracerebral Hemorrhage (AHA/ASA). Stroke. 2022",
    "Ma L et al. The third Intensive Care Bundle with Blood Pressure Reduction in Acute Cerebral Haemorrhage Trial (INTERACT3). Lancet. 2023",
    "Baharoglu MI et al. Platelet transfusion versus standard care after antiplatelet-associated ICH (PATCH). Lancet. 2016",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Sudden focal deficit with headache, vomiting and falling consciousness; very high BP." },
        { text: "Cerebellar bleed: vertigo, vomiting, ataxia, then sudden coma (brainstem compression)." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Hypertensive small-vessel disease (basal ganglia, thalamus, pons, cerebellum) or amyloid angiopathy (lobar, elderly)." },
        { text: "The haematoma expands in the first hours in about one-third — the target for BP control and reversal." },
        { text: "Intraventricular extension causes hydrocephalus." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Prevent expansion", text: "Blood pressure, reversal, avoid fever and hyperglycaemia (INTERACT3 care bundle).", critical: true },
        { label: "Severity", text: "GCS, haematoma volume (ABC/2), intraventricular blood, infratentorial location, age — ICH score." },
        { label: "Find a cause", text: "CTA for spot sign or vascular lesion in younger or atypical patients." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Ischaemic stroke", text: "CT without blood", link: "stroke-adult" },
        { label: "Subarachnoid haemorrhage", text: "Blood in cisterns", link: "sah-adult" },
        { label: "Traumatic brain injury", text: "Fall, injury pattern", link: "tbi-adult" },
        { label: "Haemorrhagic transformation", text: "After infarct or thrombolysis" },
        { label: "Tumour bleed", text: "Surrounding oedema, known cancer" },
        { label: "Venous sinus thrombosis", text: "Young, headache, bilateral bleeds" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Imaging", text: "Non-contrast CT; CTA head and neck where indicated; repeat CT for deterioration." },
        { label: "Bloods", text: "CBC with platelets, PT/INR, aPTT, fibrinogen, renal function, glucose, group and screen." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Blood pressure", text: "SBP 150–220: target about 140 (130–150) with labetalol, nicardipine or urapidil infusion; avoid falls below 130 and large swings.", critical: true },
        { label: "Warfarin", text: "4-factor PCC 25–50 units/kg (by INR) plus vitamin K 10 mg IV; FFP only if PCC is unavailable.", critical: true },
        { label: "Dabigatran", text: "Idarucizumab 5 g IV; PCC if unavailable." },
        { label: "Factor Xa inhibitors", text: "Andexanet alfa where available, otherwise 4-factor PCC 50 units/kg." },
        { label: "Heparin", text: "Protamine." },
        { label: "Antiplatelets", text: "No platelet transfusion unless going to surgery." },
        { label: "Raised ICP", text: "Head up 30 degrees, analgesia and sedation, hyperosmolar therapy as a bridge.", link: "tbi-adult" },
        { label: "Other", text: "No routine seizure prophylaxis; treat fever; glucose 140–180 mg/dL; intermittent pneumatic compression for DVT prevention." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Neurosurgery", text: "Cerebellar haemorrhage over 3 cm or with brainstem compression or hydrocephalus; external ventricular drain for hydrocephalus." },
        { label: "ICU / stroke unit", text: "All patients." },
        { label: "Goals of care", text: "Avoid early do-not-resuscitate decisions in the first 24 hours unless previously expressed wishes." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Dropping SBP too fast or below 130." },
        { text: "Delaying reversal while waiting for INR." },
        { text: "Missing a cerebellar bleed that needs surgery." },
      ],
    },
  ],
};