import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Septic shock in children (under 16). v0.1, 23 Nov 2026.
// SSC Children's guidelines 2020; Phoenix Sepsis Criteria (JAMA 2024).
export const SEPTIC_SHOCK_PAEDS: ProtocolTopic = {
  id: "septic-shock-paeds",
  title: "Septic shock — child",
  summary:
    "Infection with poor perfusion or organ dysfunction. Antibiotics within the hour, carefully reassessed fluid boluses, and early adrenaline or noradrenaline.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (SSC Children 2020, Phoenix 2024)",
  keywords: ["paediatric sepsis", "pediatric sepsis", "child sepsis", "septic shock child", "fever child shock", "phoenix criteria", "dengue shock", "meningococcal"],
  notice: "Draft for clinical sign-off. Antibiotic choice must follow your hospital antibiogram.",
  firstTen: [
    "Oxygen, monitoring, IV or IO access within 5 minutes; bedside glucose.",
    "Blood culture, then antibiotics within 1 hour (do not delay for lumbar puncture).",
    "Fluid bolus 10–20 mL/kg balanced crystalloid over 5–10 minutes; reassess after each (heart rate, perfusion, liver size, crackles). Up to 40–60 mL/kg in the first hour if PICU care is available and no overload.",
    "Still shocked after 40–60 mL/kg or sooner if overloaded: adrenaline or noradrenaline infusion (peripheral line or IO acceptable).",
    "Correct glucose and calcium; call PICU.",
  ],
  references: [
    "Weiss SL et al. Surviving Sepsis Campaign international guidelines for septic shock and sepsis-associated organ dysfunction in children. Pediatr Crit Care Med. 2020",
    "Schlapbach LJ et al. International consensus criteria for pediatric sepsis and septic shock (Phoenix). JAMA. 2024",
    "Maitland K et al. Mortality after fluid bolus in African children with severe infection (FEAST). N Engl J Med. 2011",
  ],
  reviewNotes: [
    "SSC Children 2020 is the current paediatric sepsis guideline; check whether a children's update has been published before sign-off.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Fever or hypothermia, lethargy, poor feeding, irritability, mottled skin, cold peripheries, capillary refill over 3 seconds, reduced urine." },
        { text: "Tachycardia and tachypnoea; hypotension is late and ominous in children." },
        { text: "Purpuric rash: meningococcal disease — antibiotics immediately." , critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Children compensate with tachycardia and vasoconstriction until sudden decompensation — 'cold shock' is common." },
        { text: "Phoenix criteria (2024): sepsis = suspected infection with a Phoenix score of 2 or more (respiratory, cardiovascular, coagulation, neurological); septic shock = sepsis with cardiovascular dysfunction." },
        { text: "Fluid overload harms — FEAST showed boluses can increase mortality where intensive care is not available." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Recognise early", text: "Perfusion signs, not blood pressure.", critical: true },
        { label: "Fluids by setting", text: "With PICU available: boluses up to 40–60 mL/kg in the first hour. Without intensive care and not hypotensive: maintenance fluids only, no boluses." },
        { label: "Reassess after each bolus", text: "Stop if liver enlarges, crackles appear, or work of breathing increases." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Dengue shock", text: "Plasma leak, rising haematocrit" },
        { label: "Meningitis / meningococcaemia", text: "Purpura, neck stiffness" },
        { label: "Hypovolaemia (gastroenteritis)", text: "Diarrhoea, vomiting" },
        { label: "Cardiogenic (myocarditis)", text: "Hepatomegaly, gallop, worsening with fluid" },
        { label: "DKA", text: "Kussmaul breathing, high glucose", link: "dka-paeds" },
        { label: "Congenital heart disease (infant)", text: "Duct-dependent lesion in the first weeks" },
        { label: "Anaphylaxis", text: "Exposure, urticaria" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Blood culture, CBC, CRP, VBG with lactate, glucose, ionised calcium, electrolytes, renal and liver function, coagulation." },
        { label: "India tropical screen", text: "Dengue NS1 / IgM, malaria antigen, scrub typhus IgM where the picture fits." },
        { label: "Source", text: "Urine, chest X-ray; lumbar puncture once stable (not before antibiotics)." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Antibiotics", text: "Within 1 hour in septic shock: ceftriaxone 100 mg/kg/day (maximum 4 g) or per local protocol; add vancomycin for suspected MRSA or pneumococcal meningitis per policy.", critical: true },
        { label: "Fluid", text: "Balanced crystalloid 10–20 mL/kg boluses, reassessed each time." },
        { label: "Vasoactive", text: "Adrenaline 0.05–0.3 microgram/kg/minute or noradrenaline 0.05–0.3 microgram/kg/minute, titrated; peripheral or IO line is acceptable until central access.", critical: true },
        { label: "Glucose and calcium", text: "Treat hypoglycaemia (10% dextrose 2–5 mL/kg) and low ionised calcium." },
        { label: "Hydrocortisone", text: "Consider for fluid- and catecholamine-refractory shock or known adrenal insufficiency (2 mg/kg, maximum 100 mg)." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "PICU", text: "All children with septic shock or needing vasoactive drugs." },
        { label: "Transfer", text: "Stabilise (airway, antibiotics, vasoactive) before transfer to a PICU centre." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for hypotension." },
        { text: "Giving fluid boluses without reassessing — or in dengue without monitoring haematocrit." },
        { text: "Delaying antibiotics for a lumbar puncture." },
        { text: "Missing hypoglycaemia." },
      ],
    },
  ],
};