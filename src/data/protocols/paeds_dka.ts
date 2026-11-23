import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Diabetic ketoacidosis in children (under 16). v0.1, 23 Nov 2026. ISPAD 2022 (Ch. 11), BSPED 2021.
export const DKA_PAEDS: ProtocolTopic = {
  id: "dka-paeds",
  title: "Diabetic ketoacidosis — child",
  summary:
    "Hyperglycaemia, ketosis and acidosis in a child. Replace fluid steadily over 24–48 hours, start insulin after the first hour, keep potassium up, and watch for cerebral oedema.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (ISPAD 2022)",
  keywords: ["dka", "diabetic ketoacidosis", "child diabetes", "new onset diabetes", "kussmaul", "ketones", "cerebral oedema", "insulin infusion", "paediatric dka"],
  notice: "Draft for clinical sign-off. Use your unit's DKA calculator for exact fluid volumes.",
  firstTen: [
    "Confirm DKA: glucose above 11 mmol/L (200 mg/dL), pH below 7.3 or bicarbonate below 18 mmol/L, ketones raised.",
    "Shock (poor perfusion): 10–20 mL/kg 0.9% saline or Ringer's lactate bolus, repeat with reassessment. Not shocked: 10 mL/kg over 30–60 minutes.",
    "Then deficit (5–10% of body weight) plus maintenance evenly over 24–48 hours.",
    "Start insulin infusion 0.05–0.1 unit/kg/hour at least 1 hour after fluids begin. No insulin bolus.",
    "Add potassium 40 mmol/L to fluids once potassium is known and urine passed (unless above 5.5 mmol/L); hourly neuro observations.",
  ],
  references: [
    "Glaser N et al. ISPAD Clinical Practice Consensus Guidelines 2022: Diabetic ketoacidosis and hyperglycemic hyperosmolar state. Pediatr Diabetes. 2022",
    "British Society for Paediatric Endocrinology and Diabetes. BSPED Integrated Care Pathway for the management of children and young people with DKA. 2021",
    "Kuppermann N et al. Clinical trial of fluid infusion rates for pediatric DKA (PECARN FLUID). N Engl J Med. 2018",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Polyuria, polydipsia, weight loss, vomiting, abdominal pain, deep sighing (Kussmaul) breathing, ketotic breath, drowsiness." },
        { text: "Dehydration often over-estimated clinically; shock is uncommon." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Insulin deficiency → hyperglycaemia and osmotic diuresis (water, sodium and potassium loss) and ketone production (metabolic acidosis)." },
        { text: "Total body potassium is low even when serum potassium is normal or high; insulin drives it into cells." },
        { text: "Cerebral oedema (about 1%) is the main cause of death — risk higher with young age, new diagnosis, severe acidosis, high urea, low pCO2." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Severity", text: "Mild pH below 7.3, moderate below 7.2, severe below 7.1 (or bicarbonate below 15, 10, 5)." },
        { label: "Fluids", text: "Steady replacement; PECARN FLUID showed faster or slower rates do not change cerebral injury — avoid large boluses unless shocked." },
        { label: "Cerebral oedema watch", text: "Headache, slowing heart rate, rising BP, falling GCS, irritability, incontinence — treat immediately.", critical: true },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Sepsis", text: "Fever, may trigger DKA", link: "septic-shock-paeds" },
        { label: "Gastroenteritis", text: "Check glucose in every vomiting, breathless child" },
        { label: "Acute abdomen", text: "DKA pain settles as acidosis improves" },
        { label: "Salicylate poisoning", text: "Acidosis with normal glucose" },
        { label: "Hyperosmolar state", text: "Very high glucose, little ketosis" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Glucose, blood ketones (beta-hydroxybutyrate), VBG, sodium, potassium, chloride, urea, creatinine, CBC; HbA1c; repeat glucose hourly and gas / electrolytes every 2–4 hours." },
        { label: "ECG", text: "For potassium changes (peaked or flat T waves)." },
        { label: "Corrected sodium", text: "Measured Na + 0.3 × (glucose mmol/L − 5.5); it should rise as glucose falls." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Fluids", text: "Isotonic (0.9% saline or Ringer's lactate) with potassium; deficit plus maintenance over 24–48 hours; subtract initial boluses (except for shock) per your calculator." },
        { label: "Insulin", text: "0.05–0.1 unit/kg/hour IV, started 1 hour after fluids; no bolus. Continue long-acting insulin if already on it.", critical: true },
        { label: "Glucose", text: "Add 5% dextrose when glucose falls below 14–17 mmol/L (250–300 mg/dL); 10% if it keeps falling — do not stop insulin while ketotic." },
        { label: "Potassium", text: "40 mmol/L in fluids; hold if above 5.5 mmol/L or anuric; delay insulin if potassium is below 3.5 mmol/L until replaced." },
        { label: "Cerebral oedema", text: "Mannitol 0.5–1 g/kg over 10–15 minutes or 3% saline 2.5–5 mL/kg; head up, reduce fluids, PICU.", critical: true },
        { label: "Bicarbonate", text: "Not used, except in life-threatening hyperkalaemia or cardiac arrest." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "PICU / HDU", text: "Severe DKA, age under 5, altered consciousness, cerebral oedema." },
        { label: "Ward with 1:1 monitoring", text: "Mild to moderate DKA." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Giving an insulin bolus or starting insulin in the first hour." },
        { text: "Treating a missed cerebral oedema as 'just tired'." },
        { text: "Stopping insulin when glucose normalises instead of adding dextrose." },
        { text: "Forgetting potassium." },
      ],
    },
  ],
};