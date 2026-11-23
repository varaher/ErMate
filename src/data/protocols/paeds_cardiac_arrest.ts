import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Paediatric cardiac arrest (under 16). v0.1, 23 Nov 2026.
// 2025 AHA PALS (Part 8): 2 J/kg first shock; adrenaline as soon as possible in non-shockable rhythms;
// 1 breath every 2–3 s with an advanced airway; avoid hyperventilation; avoid temperature > 37.5 °C after ROSC.
export const CARDIAC_ARREST_PAEDS: ProtocolTopic = {
  id: "cardiac-arrest-paeds",
  title: "Cardiac arrest — child (PALS)",
  summary:
    "Most paediatric arrests are respiratory or shock in origin, not primary cardiac. Excellent CPR with ventilation, early adrenaline in non-shockable rhythms, and weight-based doses.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (2025 AHA PALS)",
  keywords: ["paediatric cardiac arrest", "pediatric cardiac arrest", "child arrest", "pals", "infant cpr", "child cpr", "code blue child", "paediatric resuscitation"],
  notice: "Draft for clinical sign-off. Use a length-based tape or the ErMate paediatric dosing calculator for weight.",
  firstTen: [
    "Start CPR: 100–120 per minute, at least one-third of chest depth; 15:2 with two rescuers before puberty (30:2 after puberty or one rescuer).",
    "Oxygen with bag-valve-mask — ventilation matters most in children.",
    "Pads on: shock VF / pulseless VT at 2 J/kg, then 4 J/kg (maximum 10 J/kg or the adult dose).",
    "IV / IO access; adrenaline 0.01 mg/kg (0.1 mL/kg of 0.1 mg/mL, maximum 1 mg) as soon as possible in asystole / PEA, every 3–5 minutes.",
    "Look for reversible causes: hypoxia, hypovolaemia, hypoglycaemia, hyperkalaemia, hypothermia, tension pneumothorax, toxins.",
  ],
  references: [
    "Part 8: Pediatric Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "AHA PALS Cardiac Arrest Algorithm. 2025",
    "ILCOR Pediatric Life Support 2025 Consensus on Science with Treatment Recommendations. 2025",
  ],
  sections: [
    {
      heading: "Recognition",
      kind: "symptoms",
      items: [
        { text: "Unresponsive, not breathing normally, no pulse within 10 seconds — or a heart rate below 60 with poor perfusion despite oxygenation and ventilation: start CPR." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Children usually arrest after progressive hypoxia or shock (bradycardia → PEA → asystole); shockable rhythms are less common." },
        { text: "Restoring oxygenation and circulation early is the key; hyperventilation reduces venous return and brain blood flow." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Shockable (VF / pVT)", text: "Shock → 2 minutes CPR → rhythm check; adrenaline if a shock cannot be given immediately or after the second shock; amiodarone or lidocaine for refractory VF.", critical: true },
        { label: "Non-shockable", text: "CPR and adrenaline as soon as possible, every 3–5 minutes; search for the cause." },
        { label: "Weight", text: "Use the known weight, a length-based tape, or an age estimate." },
      ],
    },
    {
      heading: "Differential diagnosis (reversible causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Respiratory failure", text: "Asthma, bronchiolitis, pneumonia, foreign body", link: "asthma-paeds" },
        { label: "Septic shock", text: "Fever, poor perfusion", link: "septic-shock-paeds" },
        { label: "Hypovolaemia", text: "Diarrhoea, dengue shock, bleeding" },
        { label: "DKA", text: "Hyperglycaemia, acidosis", link: "dka-paeds" },
        { label: "Status epilepticus", text: "Prolonged seizure, hypoxia", link: "status-epilepticus-paeds" },
        { label: "Poisoning", text: "OP, kerosene, iron, drugs" },
        { label: "Drowning / trauma", text: "Hypoxia, head injury" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "During CPR", text: "Bedside glucose, VBG with potassium and lactate." },
        { label: "After ROSC", text: "Chest X-ray, ECG, electrolytes, calcium, cultures as indicated." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Adrenaline", text: "0.01 mg/kg IV/IO (0.1 mL/kg of 0.1 mg/mL), maximum 1 mg, every 3–5 minutes.", critical: true },
        { label: "Defibrillation", text: "2 J/kg, then 4 J/kg, subsequent 4 J/kg or more, maximum 10 J/kg or the adult dose.", critical: true },
        { label: "Amiodarone", text: "5 mg/kg IV/IO bolus (maximum 300 mg), repeat up to 3 doses for refractory VF / pVT. Lidocaine 1 mg/kg is an alternative." },
        { label: "Ventilation", text: "Without an airway 15:2 (two rescuers). With an advanced airway: 1 breath every 2–3 seconds with continuous compressions; avoid hyperventilation." },
        { label: "Glucose", text: "Treat hypoglycaemia: 10% dextrose 2–5 mL/kg." },
      ],
    },
    {
      heading: "After ROSC",
      kind: "disposition",
      items: [
        { label: "Targets", text: "Avoid temperature above 37.5 °C; keep systolic and mean BP above the 10th centile for age; SpO2 94–99%; normocapnia." },
        { label: "Monitoring", text: "Continuous EEG where available; PICU." },
        { label: "Prognosis", text: "Multimodal and over time — not in the ED." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Using the adult 1 mg/mL adrenaline without dilution." },
        { text: "Forgetting ventilation — most arrests are hypoxic." },
        { text: "Delaying adrenaline in asystole / PEA." },
        { text: "Hyperventilating after intubation." },
      ],
    },
  ],
};