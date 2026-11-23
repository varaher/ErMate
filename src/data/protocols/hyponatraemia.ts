import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Hyponatraemia (adult). v0.1, 23 Nov 2026. European clinical practice guideline 2014; US expert panel 2013.
export const HYPONATRAEMIA_ADULT: ProtocolTopic = {
  id: "hyponatraemia-adult",
  title: "Hyponatraemia",
  summary:
    "Sodium below 135 mmol/L. Severe symptoms need hypertonic saline now; everything else needs a cause found and a slow correction to avoid osmotic demyelination.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — metabolic pathway v0.1 (European guideline 2014)",
  keywords: ["hyponatraemia", "hyponatremia", "low sodium", "siadh", "3% saline", "hypertonic saline", "osmotic demyelination", "odS", "confusion low sodium"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Severe symptoms (seizures, coma, vomiting with confusion, respiratory arrest): 3% saline 150 mL IV over 20 minutes (or 100 mL bolus).",
    "Recheck sodium after each bolus; repeat up to 2–3 times until symptoms improve or sodium has risen by 5 mmol/L.",
    "Limit the total rise to 10 mmol/L in the first 24 hours (8 mmol/L if high risk: alcohol, malnutrition, low potassium, liver disease).",
    "Not severely symptomatic: no hypertonic saline — find the cause (volume status, urine osmolality and sodium).",
    "Stop thiazides and other causative drugs.",
  ],
  references: [
    "Spasovski G et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Eur J Endocrinol. 2014",
    "Verbalis JG et al. Diagnosis, evaluation and treatment of hyponatremia: expert panel recommendations. Am J Med. 2013",
    "Baek SH et al. Rapid intermittent bolus vs slow continuous infusion of hypertonic saline (SALSA). JAMA Intern Med. 2021",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Moderate", text: "Nausea, headache, confusion, unsteadiness, falls." },
        { label: "Severe", text: "Vomiting, seizures, drowsiness, coma, respiratory arrest.", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Low plasma osmolality draws water into brain cells — acute falls cause cerebral oedema." },
        { text: "Over 48 hours the brain adapts by losing solutes; correcting too fast then shrinks cells → osmotic demyelination (often days later)." },
        { text: "Causes: hypovolaemic (vomiting, diarrhoea, diuretics), euvolaemic (SIADH, hypothyroidism, adrenal insufficiency, low solute intake), hypervolaemic (heart failure, cirrhosis, nephrotic)." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Severity of symptoms", text: "Symptoms, not the number, decide whether hypertonic saline is needed.", critical: true },
        { label: "Exclude", text: "Hyperglycaemia (pseudo-hyponatraemia) — correct sodium for glucose." },
        { label: "Cause", text: "Volume status, urine osmolality (below 100 = water excess), urine sodium (below 30 = low effective volume)." },
      ],
    },
    {
      heading: "Differential diagnosis (causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Diuretics (thiazide)", text: "Elderly, recent start" },
        { label: "SIADH", text: "Lung, brain, drugs (SSRIs, carbamazepine)" },
        { label: "Adrenal insufficiency", text: "Low BP, high potassium", link: "adrenal-crisis-adult" },
        { label: "Cirrhosis / heart failure", text: "Oedema, ascites", link: "cirrhosis-liver-adult" },
        { label: "Vomiting / diarrhoea", text: "Dry, low urine sodium" },
        { label: "Beer potomania / tea-and-toast", text: "Low solute intake" },
        { label: "Hypothyroidism", text: "Slow, puffy, high TSH" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Sodium (repeat 2–4 hourly during correction), plasma osmolality, glucose, potassium, renal function, TSH, cortisol." },
        { label: "Urine", text: "Osmolality and sodium (before any treatment if possible)." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Severe symptoms", text: "3% saline 150 mL (about 2 mL/kg) over 20 minutes, repeated until improvement or a 5 mmol/L rise.", critical: true },
        { label: "Correction limit", text: "Maximum 10 mmol/L in 24 hours and 18 in 48 hours; 8 mmol/L per 24 hours in high-risk patients.", critical: true },
        { label: "Hypovolaemic", text: "0.9% saline; sodium can rise quickly once volume is restored — monitor urine output and sodium." },
        { label: "SIADH", text: "Fluid restriction (under 800–1000 mL/day); oral urea or salt tablets if needed." },
        { label: "Hypervolaemic", text: "Fluid restriction, treat the underlying condition." },
        { label: "Overcorrection", text: "Stop the cause, give 5% dextrose (water) and desmopressin 2 micrograms IV to bring the sodium back down." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "HDU / ICU", text: "Hypertonic saline, severe symptoms, sodium below 120 with high-risk features." },
        { label: "Admit", text: "Sodium below 125, symptomatic, or unclear cause." },
        { label: "Outpatient", text: "Mild, chronic, asymptomatic with a clear cause and follow-up." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Hypertonic saline for an asymptomatic chronic low sodium." },
        { text: "Over-rapid correction once a diuresis starts." },
        { text: "Missing adrenal insufficiency or hypothyroidism." },
      ],
    },
  ],
};