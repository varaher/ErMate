import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Methanol / toxic alcohol poisoning (adult). v0.1, 23 Nov 2026. EXTRIP 2015 dialysis criteria.
export const METHANOL_ADULT: ProtocolTopic = {
  id: "methanol-poisoning-adult",
  title: "Methanol poisoning (toxic alcohol)",
  summary:
    "Illicit or adulterated liquor ('hooch'), often in clusters. Delayed severe metabolic acidosis and blindness. Block alcohol dehydrogenase early, correct acidosis, give folate, and dialyse.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1 (EXTRIP 2015)",
  keywords: ["methanol", "hooch", "spurious liquor", "illicit liquor", "toxic alcohol", "ethylene glycol", "fomepizole", "high anion gap", "blindness", "osmolar gap"],
  notice: "Draft for clinical sign-off. Hooch tragedies come in clusters — alert the hospital and public health.",
  firstTen: [
    "Suspect in anyone with visual blurring, breathlessness or high anion gap acidosis after drinking illicit liquor — especially if others are affected.",
    "VBG: pH, bicarbonate, anion gap; serum osmolality for the osmolar gap.",
    "Start an alcohol dehydrogenase blocker now: fomepizole, or ethanol if fomepizole is not available.",
    "Sodium bicarbonate for pH below 7.3; folinic or folic acid 50 mg IV every 6 hours.",
    "Call nephrology for urgent haemodialysis.",
  ],
  references: [
    "Roberts DM et al. Recommendations for the role of extracorporeal treatments in methanol poisoning (EXTRIP). Crit Care Med. 2015",
    "Barceloux DG et al. American Academy of Clinical Toxicology practice guidelines on the treatment of methanol poisoning. Clin Toxicol. 2002",
    "Zakharov S et al. Fomepizole versus ethanol in the treatment of acute methanol poisoning. Clin Toxicol. 2014",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Latent period of 12–24 hours (longer with ethanol co-ingestion)." },
        { text: "Then: headache, vomiting, abdominal pain, blurred or 'snowfield' vision, blindness, Kussmaul breathing, confusion, seizures, coma." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Methanol itself is relatively harmless; alcohol dehydrogenase converts it to formaldehyde and formic acid, which cause acidosis and optic nerve damage." },
        { text: "Blocking alcohol dehydrogenase (fomepizole or ethanol) stops new formic acid; dialysis removes methanol and formate." },
        { text: "Early: high osmolar gap; late: high anion gap as methanol is converted." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Treat on suspicion", text: "Methanol levels are rarely available in India — act on history, acidosis and gaps.", critical: true },
        { label: "Clusters", text: "One case means others: alert colleagues and the district authorities." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Diabetic ketoacidosis", text: "High glucose, ketones" },
        { label: "Alcoholic ketoacidosis", text: "Normal glucose, ketones, recent binge" },
        { label: "Lactic acidosis / sepsis", text: "Source, high lactate", link: "sepsis-adult" },
        { label: "Ethylene glycol", text: "Antifreeze, calcium oxalate crystals, AKI" },
        { label: "Salicylate", text: "Tinnitus, mixed acid–base" },
        { label: "Aluminium phosphide", text: "Shock, acidosis", link: "aluminium-phosphide-poisoning-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Gases", text: "VBG / ABG, lactate, anion gap = Na − (Cl + HCO3)." },
        { label: "Osmolar gap", text: "Measured osmolality − (2 × Na + glucose + urea, all in mmol/L, + ethanol); above 10–20 suggests a toxic alcohol." },
        { label: "Others", text: "Methanol / ethanol levels if available, glucose, ketones, renal function, CT head if comatose (basal ganglia changes)." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Fomepizole", text: "15 mg/kg IV loading, then 10 mg/kg every 12 hours (increase frequency during dialysis).", critical: true },
        { label: "Ethanol (if no fomepizole)", text: "IV 10% ethanol or oral 40% spirits to a blood ethanol level of about 100–150 mg/dL (loading about 0.8 g/kg, then maintenance); monitor glucose and sedation." },
        { label: "Bicarbonate", text: "Sodium bicarbonate to keep pH above 7.3." },
        { label: "Folate", text: "Folinic acid (or folic acid) 50 mg IV every 6 hours." },
        { label: "Haemodialysis", text: "Severe acidosis (pH 7.15 or below), anion gap above 24, visual changes, coma or seizures, or methanol above 700 mg/L (on fomepizole) — continue the ADH blocker during dialysis.", critical: true },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / dialysis unit", text: "All patients with acidosis or symptoms." },
        { label: "Observe", text: "Asymptomatic exposed patients for at least 12–24 hours with repeat gases." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Discharging an asymptomatic patient during the latent period." },
        { text: "Waiting for a methanol level that will not come." },
        { text: "Stopping the ADH blocker during dialysis." },
      ],
    },
  ],
};