import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Hypoglycaemia (adult). v0.1, 23 Nov 2026. ADA Standards of Care 2025; JBDS 2023.
export const HYPOGLYCAEMIA_ADULT: ProtocolTopic = {
  id: "hypoglycaemia-adult",
  title: "Hypoglycaemia (adult)",
  summary:
    "Glucose below 70 mg/dL (3.9 mmol/L); below 54 mg/dL is clinically significant. Check glucose in every confused, drowsy, seizing or 'stroke' patient and correct it immediately.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — neurology / metabolic pathway v0.1 (ADA 2025)",
  keywords: ["hypoglycaemia", "hypoglycemia", "low sugar", "low glucose", "insulin overdose", "sulfonylurea", "gliclazide", "glimepiride", "dextrose", "glucagon", "octreotide"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Bedside glucose; confirm with a lab sample but do not wait for it.",
    "Conscious and able to swallow: 15–20 g oral glucose, recheck in 15 minutes, repeat if still low.",
    "Unable to swallow: 10% dextrose 150–200 mL IV (15–20 g) over 10–15 minutes, or 25% dextrose 50–80 mL; recheck at 10–15 minutes.",
    "No IV access: glucagon 1 mg IM (less effective in malnutrition, alcohol use or sulfonylurea overdose).",
    "Thiamine IV in alcohol use or malnutrition — alongside, never delaying, glucose.",
  ],
  references: [
    "American Diabetes Association. Standards of Care in Diabetes — 2025: Glycemic goals and hypoglycemia. Diabetes Care. 2025",
    "Joint British Diabetes Societies. The hospital management of hypoglycaemia in adults with diabetes mellitus. 2023",
    "Glatstein M et al. Octreotide for the treatment of sulfonylurea poisoning. Clin Toxicol. 2012",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Autonomic", text: "Sweating, tremor, palpitations, hunger, anxiety (may be absent with beta-blockers or long diabetes)." },
        { label: "Neuroglycopenic", text: "Confusion, behaviour change, slurred speech, focal weakness, seizures, coma." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "The brain depends on glucose; prolonged severe hypoglycaemia causes permanent injury." },
        { text: "Sulfonylureas and long-acting insulin cause prolonged, recurrent hypoglycaemia — dextrose triggers more insulin release with sulfonylureas." },
        { text: "Other causes: missed meals, renal failure (reduced insulin clearance), sepsis, liver failure, alcohol, adrenal insufficiency, insulinoma." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Treat immediately", text: "Any low reading with symptoms.", critical: true },
        { label: "Why?", text: "Look for the cause: drug and dose, renal function, sepsis, alcohol, intentional overdose." },
        { label: "Duration of risk", text: "Sulfonylureas and long-acting insulin need prolonged observation." },
      ],
    },
    {
      heading: "Differential diagnosis (causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Insulin / sulfonylurea excess", text: "Diabetic, dose change, poor intake" },
        { label: "Intentional overdose", text: "Poisoning assessment", link: "poisoning-approach-adult" },
        { label: "Sepsis", text: "Fever, source", link: "sepsis-adult" },
        { label: "Liver failure", text: "Cirrhosis, paracetamol", link: "cirrhosis-liver-adult" },
        { label: "Alcohol", text: "Binge, starvation", link: "alcohol-withdrawal-adult" },
        { label: "Adrenal crisis", text: "Steroid use, low sodium", link: "adrenal-crisis-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Glucose", text: "Bedside and lab; repeat every 15 minutes until stable, then hourly." },
        { label: "Bloods", text: "Renal function, electrolytes, liver function; in unexplained hypoglycaemia without diabetes, take insulin, C-peptide and sulfonylurea screen during the low before treatment where possible." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "IV dextrose", text: "10% dextrose 150–200 mL (preferred: less vein injury) or 25% dextrose 50–80 mL; avoid 50% where possible.", critical: true },
        { label: "Maintenance", text: "After recovery: a long-acting carbohydrate meal; 10% dextrose infusion if not eating or on long-acting agents." },
        { label: "Sulfonylurea hypoglycaemia", text: "Octreotide 50 micrograms SC or IV every 6–12 hours to stop recurrent episodes; admit for at least 24 hours." },
        { label: "Glucagon", text: "1 mg IM / SC when IV access is not available." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Admit", text: "Sulfonylurea or long-acting insulin cause, overdose, recurrent episodes, renal failure, no clear cause, or no one to watch at home." },
        { label: "Discharge", text: "Short-acting insulin cause, fully recovered, eaten, cause understood, a responsible adult present, diabetes review arranged." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Not checking glucose in 'stroke' or seizure." },
        { text: "Discharging a sulfonylurea hypoglycaemia after one dextrose dose." },
        { text: "Relying on glucagon in a starved or alcoholic patient." },
      ],
    },
  ],
};