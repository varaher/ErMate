import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Hyperkalaemia (adult). v0.1, 23 Nov 2026. UK Kidney Association clinical practice guideline 2023.
export const HYPERKALAEMIA_ADULT: ProtocolTopic = {
  id: "hyperkalaemia-adult",
  title: "Hyperkalaemia",
  summary:
    "High potassium can stop the heart without warning. Protect the heart with calcium, shift potassium into cells with insulin–glucose and salbutamol, then remove it — and watch for hypoglycaemia.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — metabolic pathway v0.1 (UK Kidney Association 2023)",
  keywords: ["hyperkalaemia", "hyperkalemia", "high potassium", "potassium 6", "peaked t waves", "renal failure", "missed dialysis", "calcium gluconate", "insulin dextrose"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "12-lead ECG and cardiac monitoring for potassium 6.0 or more, or any ECG change.",
    "ECG changes or potassium 6.5 or more: 10% calcium gluconate 30 mL IV over 5–10 minutes (or 10% calcium chloride 10 mL via a large vein); repeat if ECG changes persist.",
    "Soluble insulin 10 units with 25 g glucose IV over 15 minutes.",
    "Nebulised salbutamol 10–20 mg as an add-on.",
    "Check glucose at 15, 30, 60, 90, 120 minutes and hourly to 6 hours; start a 10% dextrose infusion if pre-treatment glucose was below 7 mmol/L (126 mg/dL).",
  ],
  references: [
    "UK Kidney Association. Clinical Practice Guidelines: Treatment of Acute Hyperkalaemia in Adults. 2023",
    "Palmer BF, Clegg DJ. Physiology and pathophysiology of potassium homeostasis. Adv Physiol Educ. 2016",
    "KDIGO Controversies Conference on potassium management. Kidney Int. 2020",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Often none; weakness, paraesthesia, palpitations, bradycardia, collapse." },
        { text: "ECG: peaked T waves, flattened P, prolonged PR, wide QRS, sine wave, bradycardia, VF / asystole — changes do not track the level reliably." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Potassium sets the resting membrane potential; a high level depolarises cardiac cells and slows conduction." },
        { text: "Causes: kidney failure, missed dialysis, drugs (ACE inhibitors, ARBs, spironolactone, NSAIDs, trimethoprim), DKA, rhabdomyolysis, tumour lysis, adrenal insufficiency, haemolysed sample." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Severity", text: "Mild 5.5–5.9, moderate 6.0–6.4, severe 6.5 or more (mmol/L).", critical: true },
        { label: "Real or not?", text: "Haemolysed or delayed samples falsely raise potassium — repeat with a blood gas, but treat ECG changes immediately." },
        { label: "Three steps", text: "Protect the heart (calcium), shift (insulin–glucose, salbutamol), remove (binders, diuretics, dialysis)." },
      ],
    },
    {
      heading: "Differential diagnosis (causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "AKI / CKD / missed dialysis", text: "High creatinine", link: "hrs-aki-adult" },
        { label: "DKA", text: "Acidosis, high glucose" },
        { label: "Adrenal crisis", text: "Low sodium, low BP", link: "adrenal-crisis-adult" },
        { label: "Rhabdomyolysis", text: "High CK, crush, seizures" },
        { label: "Drugs", text: "ACEi / ARB, spironolactone, trimethoprim" },
        { label: "Pseudohyperkalaemia", text: "Haemolysed sample" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "ECG", text: "12-lead and continuous monitoring." },
        { label: "Bloods", text: "VBG (fast potassium, pH, glucose), renal function, glucose, CK, CBC; repeat potassium 1, 2, 4, 6 and 24 hours after treatment." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Calcium", text: "10% calcium gluconate 30 mL IV over 5–10 minutes (or 10% calcium chloride 10 mL); effect within minutes, lasts 30–60 minutes; repeat up to a total of 90 mL gluconate if ECG changes persist.", critical: true },
        { label: "Insulin–glucose", text: "10 units soluble insulin with 25 g glucose (for example 50 mL of 50% or 125 mL of 20% dextrose) over 15 minutes; lowers potassium by about 0.6–1.0 mmol/L for 4–6 hours.", critical: true },
        { label: "Hypoglycaemia prevention", text: "If pre-treatment glucose is below 7 mmol/L, follow with 10% dextrose 50 mL/hour for 5 hours; monitor glucose for 6 hours.", link: "hypoglycaemia-adult" },
        { label: "Salbutamol", text: "10–20 mg nebulised (caution in ischaemic heart disease and tachyarrhythmia)." },
        { label: "Sodium bicarbonate", text: "Only for severe metabolic acidosis — not routine." },
        { label: "Remove potassium", text: "Sodium zirconium cyclosilicate 10 g three times a day or patiromer where available; loop diuretic if passing urine and not dry; dialysis for refractory or severe hyperkalaemia with kidney failure." },
        { label: "Stop", text: "ACE inhibitors, ARBs, spironolactone, NSAIDs, potassium supplements." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Dialysis / ICU", text: "Refractory, severe with kidney failure, ECG changes despite treatment." },
        { label: "Admit with monitoring", text: "6.5 or more, or 6.0 or more with ECG changes or a progressive cause." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for a repeat sample when the ECG is abnormal." },
        { text: "Missing late hypoglycaemia after insulin." },
        { text: "Thinking calcium lowers potassium — it only protects the heart." },
      ],
    },
  ],
};