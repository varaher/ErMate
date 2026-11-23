import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Paraquat poisoning (adult). v0.1, 23 Nov 2026. No proven antidote.
export const PARAQUAT_ADULT: ProtocolTopic = {
  id: "paraquat-poisoning-adult",
  title: "Paraquat poisoning",
  summary:
    "A herbicide that destroys the lungs and kidneys. Small amounts can kill. Early adsorbent, avoid oxygen unless hypoxic, and be honest with the family about the prognosis.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1",
  keywords: ["paraquat", "herbicide", "weedicide", "gramoxone", "diquat", "dithionite", "pulmonary fibrosis"],
  notice: "Draft for clinical sign-off. Medico-legal case.",
  firstTen: [
    "Activated charcoal 50 g (or Fuller's earth) as early as possible.",
    "Do NOT give supplemental oxygen unless SpO2 is below 90% — oxygen accelerates lung injury.",
    "Urine sodium dithionite test (blue = paraquat present) and plasma level if available.",
    "IV fluids; strict input–output; renal function and potassium.",
    "Analgesia for mouth ulcers; early discussion with ICU and family.",
  ],
  references: [
    "Gawarammana IB, Buckley NA. Medical management of paraquat ingestion. Br J Clin Pharmacol. 2011",
    "Gawarammana I et al. High-dose immunosuppression to prevent death after paraquat self-poisoning: a randomised controlled trial. Clin Toxicol. 2018",
    "Li LR et al. Glucocorticoid with cyclophosphamide for paraquat-induced lung fibrosis. Cochrane Database Syst Rev. 2014",
  ],
  reviewNotes: [
    "Immunosuppression (methylprednisolone + cyclophosphamide) showed no mortality benefit in the 2018 RCT; it is shown as local practice. Decide ErMate's base standard.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Burning in mouth and throat, vomiting, painful oral ulcers ('paraquat tongue') within hours." },
        { text: "Large ingestion (over 50 mL of 20%): multi-organ failure and death within 1–4 days." },
        { text: "Moderate ingestion: AKI and liver injury in days, progressive lung fibrosis over 1–3 weeks." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Paraquat is concentrated in type I and II alveolar cells and undergoes redox cycling, generating superoxide that destroys lipid membranes." },
        { text: "Extra oxygen fuels the reaction — the reason to avoid it unless hypoxic." },
        { text: "Excreted by the kidney; AKI raises levels and worsens toxicity." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Confirm", text: "Urine dithionite test — strongly blue or navy means a poor prognosis.", critical: true },
        { label: "Prognosis", text: "Plasma level plotted against time (Proudfoot nomogram) predicts survival where available." },
        { label: "Communication", text: "Early, honest discussion of likely outcome; palliative care when prognosis is hopeless." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Diquat", text: "Similar, less lung, more CNS and kidney" },
        { label: "Glyphosate", text: "Herbicide, shock, less lung injury" },
        { label: "Corrosive ingestion", text: "Acid or alkali, airway burns" },
        { label: "Organophosphate", text: "Cholinergic features", link: "organophosphate-poisoning-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Urine dithionite test", text: "Add sodium dithionite and bicarbonate to urine; blue colour = paraquat." },
        { label: "Bloods", text: "Renal function, potassium, liver function, VBG, CBC, amylase; plasma paraquat level where available." },
        { label: "Chest X-ray / CT", text: "Baseline, then for progressive hypoxia." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Adsorbent", text: "Activated charcoal 50 g (1 g/kg) or Fuller's earth 1 g/kg as soon as possible." },
        { label: "Oxygen", text: "Only for SpO2 below 90%, then to the lowest acceptable target.", critical: true },
        { label: "Kidneys", text: "IV fluids to maintain urine output; haemodialysis for AKI. Early haemoperfusion has no proven mortality benefit." },
        { label: "Immunosuppression", text: "Methylprednisolone pulse with cyclophosphamide, then dexamethasone — no proven benefit in the 2018 randomised trial.", tier: "local", origin: "Common Indian practice" },
        { label: "Symptom care", text: "Analgesia (oral ulcers), mouth care, antiemetics, nutrition." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "All confirmed ingestions." },
        { label: "Palliative", text: "When prognosis is hopeless, focus on comfort and family." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Routine oxygen." },
        { text: "False reassurance in the first day — lung injury comes later." },
        { text: "Missing the urine test because the history is unclear." },
      ],
    },
  ],
};