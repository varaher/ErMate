import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Organophosphate / carbamate poisoning (adult). v0.1, 23 Nov 2026.
// Atropine titration per Eddleston et al (Lancet 2008). Oximes: benefit unproven (Eddleston, PLoS Med 2009;
// Cochrane 2011) — kept as a documented local-practice option, not a guideline requirement.
export const ORGANOPHOSPHATE_ADULT: ProtocolTopic = {
  id: "organophosphate-poisoning-adult",
  title: "Organophosphate / carbamate poisoning",
  summary:
    "Pesticide poisoning causing cholinergic crisis. Atropine — given fast and doubled until the chest is clear — saves lives; watch for respiratory failure and intermediate syndrome over the next days.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1",
  keywords: ["organophosphate", "op poisoning", "opc", "pesticide", "insecticide", "carbamate", "chlorpyrifos", "monocrotophos", "atropine", "pralidoxime", "pam", "cholinesterase", "intermediate syndrome"],
  notice: "Draft for clinical sign-off. Medico-legal case.",
  firstTen: [
    "Airway and oxygen; suction secretions; intubate for respiratory failure or GCS 8 or less (avoid suxamethonium).",
    "Remove contaminated clothes and wash the skin; staff wear gloves.",
    "Atropine 1.8–3 mg IV bolus now. Every 5 minutes, double the dose until atropinised: clear chest, heart rate above 80, SBP above 80, dry axillae, pupils no longer pinpoint.",
    "Then atropine infusion at 10–20% of the total loading dose per hour; reassess every 15 minutes.",
    "IV fluids for hypotension; treat seizures with benzodiazepines.",
  ],
  references: [
    "Eddleston M et al. Management of acute organophosphorus pesticide poisoning. Lancet. 2008",
    "Eddleston M et al. Pralidoxime in acute organophosphorus insecticide poisoning: a randomised controlled trial. PLoS Med. 2009",
    "Buckley NA et al. Oximes for acute organophosphate pesticide poisoning. Cochrane Database Syst Rev. 2011",
    "Abedin MJ et al. Open-label randomized clinical trial of atropine bolus injection versus incremental boluses plus infusion for organophosphate poisoning. J Med Toxicol. 2012",
  ],
  reviewNotes: [
    "Pralidoxime: unproven benefit in trials but widely used in India — shown as local practice. Decide whether the ErMate base standard includes it.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Muscarinic", text: "Salivation, lacrimation, urination, diarrhoea, vomiting, bronchorrhoea, bronchospasm, bradycardia, pinpoint pupils, sweating." },
        { label: "Nicotinic", text: "Fasciculations, weakness, paralysis, tachycardia, hypertension." },
        { label: "CNS", text: "Confusion, seizures, coma, respiratory depression." },
        { label: "Clue", text: "Kerosene-like smell (solvent), history of pesticide exposure." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Organophosphates inhibit acetylcholinesterase; acetylcholine accumulates at muscarinic, nicotinic and CNS synapses." },
        { text: "Death is mostly respiratory: bronchorrhoea, bronchospasm, respiratory muscle weakness and central apnoea." },
        { text: "The enzyme 'ages' (binds permanently) over hours to days depending on the compound — the rationale for early oximes. Carbamates bind reversibly." },
        { text: "Intermediate syndrome (24–96 hours): proximal, neck flexor and respiratory muscle weakness after the cholinergic crisis." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Atropinise fast", text: "Aim for a clear chest within 30 minutes. Pupils and heart rate alone are not the end-point; secretions are.", critical: true },
        { label: "Avoid toxicity", text: "Atropine toxicity: confusion, fever, absent bowel sounds, urinary retention — stop the infusion, restart at 70–80% when settled." },
        { label: "Watch the breathing", text: "Check neck flexion strength, single breath count and SpO2 regularly for days; intermediate syndrome can cause sudden respiratory arrest." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Carbamate poisoning", text: "Similar picture, shorter course" },
        { label: "Opioid overdose", text: "Pinpoint pupils without secretions" },
        { label: "Aluminium phosphide", text: "Shock, no cholinergic signs", link: "aluminium-phosphide-poisoning-adult" },
        { label: "Mixed pesticide / solvent", text: "Aspiration pneumonitis" },
        { label: "Neurotoxic snakebite", text: "Ptosis, weakness, no secretions", link: "snakebite-adult" },
        { label: "Pontine haemorrhage", text: "Pinpoint pupils, coma", link: "intracranial-haemorrhage-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Cholinesterase", text: "Plasma (pseudo)cholinesterase supports the diagnosis; it does not guide atropine dosing." },
        { label: "Bloods", text: "VBG, electrolytes, renal function, glucose, CK, amylase, lipase." },
        { label: "ECG", text: "Bradycardia, QTc prolongation, torsades." },
        { label: "Chest X-ray", text: "Aspiration." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Atropine", text: "1.8–3 mg IV, doubling every 5 minutes until atropinised; then infusion of 10–20% of the loading dose per hour. There is no maximum dose.", critical: true },
        { label: "Pralidoxime", text: "Commonly 30 mg/kg IV over 30 minutes, then 8 mg/kg/hour infusion, started early (WHO regimen). Benefit in trials is unproven.", tier: "local", origin: "Common in Indian EDs" },
        { label: "Seizures / agitation", text: "Diazepam or midazolam." },
        { label: "Intubation", text: "Use rocuronium, not suxamethonium (prolonged paralysis)." },
        { label: "Decontamination", text: "Skin washing; activated charcoal only within 1 hour with a protected airway; no routine gastric lavage." },
        { label: "QT / torsades", text: "Magnesium; correct potassium." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "All symptomatic patients — respiratory failure can develop late." },
        { label: "Observation", text: "At least 48–72 hours after stopping atropine for intermediate syndrome." },
        { label: "Before discharge", text: "Psychiatric assessment; medico-legal documentation." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Small, slow atropine doses — delays control of secretions." },
        { text: "Using heart rate alone as the target (tachycardia may be from hypoxia or nicotinic effect)." },
        { text: "Missing intermediate syndrome on the ward." },
        { text: "Suxamethonium for intubation." },
      ],
    },
  ],
};