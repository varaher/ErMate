import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Bronchiolitis (infants). v0.1, 23 Nov 2026. AAP 2014 (reaffirmed); NICE NG9 (updated 2021).
export const BRONCHIOLITIS_PAEDS: ProtocolTopic = {
  id: "bronchiolitis-paeds",
  title: "Bronchiolitis — infant",
  summary:
    "Viral lower respiratory infection in children under 2, mostly RSV. Treatment is supportive: oxygen, feeding support and respiratory support when needed. Medicines do not help.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (AAP, NICE NG9)",
  keywords: ["bronchiolitis", "rsv", "infant wheeze", "infant breathing difficulty", "high flow nasal cannula", "hfnc", "apnoea infant"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Assess work of breathing, SpO2, feeding, hydration and apnoeas.",
    "Oxygen if SpO2 is persistently below 90–92%.",
    "Gentle nasal suction if the nose is blocked before feeds.",
    "Feeding support: NG feeds or IV fluids (isotonic) if not feeding enough.",
    "Increasing work of breathing despite oxygen: high-flow nasal cannula or CPAP; call PICU for apnoeas or exhaustion.",
  ],
  references: [
    "Ralston SL et al. AAP Clinical Practice Guideline: diagnosis, management and prevention of bronchiolitis. Pediatrics. 2014 (reaffirmed)",
    "National Institute for Health and Care Excellence. Bronchiolitis in children: diagnosis and management (NG9). 2015, updated 2021",
    "Franklin D et al. A randomized trial of high-flow oxygen therapy in infants with bronchiolitis (PARIS). N Engl J Med. 2018",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Coryza for 1–3 days, then cough, fast breathing, recession, wheeze and / or fine crackles; poor feeding." },
        { text: "Worst on days 3–5; young infants may present with apnoea alone." },
        { label: "Red flags", text: "Apnoea, grunting, severe recession, SpO2 below 90% in oxygen, poor feeding below half normal, dehydration, lethargy.", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Virus infects small airway epithelium: inflammation, oedema, mucus and cell debris block small airways — air trapping and atelectasis." },
        { text: "Not bronchospasm, which is why bronchodilators and steroids do not help." },
        { text: "Higher risk: under 3 months, prematurity, congenital heart disease, chronic lung disease, immunodeficiency." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Clinical diagnosis", text: "No routine tests or X-ray." },
        { label: "Risk", text: "Age under 3 months, prematurity and comorbidity lower the threshold to admit." },
        { label: "Over 1 year with recurrent wheeze", text: "Consider viral wheeze or asthma instead.", link: "asthma-paeds" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Pneumonia", text: "High fever, focal crackles" },
        { label: "Viral wheeze / asthma", text: "Older child, recurrent, responds to salbutamol", link: "asthma-paeds" },
        { label: "Heart failure", text: "Hepatomegaly, murmur, poor feeding since birth" },
        { label: "Sepsis", text: "Toxic, high fever, poor perfusion", link: "septic-shock-paeds" },
        { label: "Pertussis", text: "Paroxysmal cough, whoop, apnoea" },
        { label: "Foreign body", text: "Sudden choking episode" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Routinely none", text: "No routine blood tests, chest X-ray or viral swabs." },
        { label: "When severe", text: "VBG if respiratory failure is suspected; chest X-ray only if the diagnosis is uncertain or PICU is needed; glucose." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Oxygen", text: "If SpO2 persistently below 90% (AAP) or 92% (NICE); stop when consistently above.", critical: true },
        { label: "Fluids / feeds", text: "Small frequent feeds, NG feeds, or isotonic IV fluids at a restricted rate." },
        { label: "Respiratory support", text: "High-flow nasal cannula (about 2 L/kg/minute) or CPAP for increasing work of breathing or hypoxia despite low-flow oxygen." },
        { label: "Do not use", text: "Salbutamol, adrenaline nebulisers, steroids, antibiotics, hypertonic saline in the ED, or chest physiotherapy." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "PICU", text: "Apnoeas, rising CO2, exhaustion, needing CPAP that is not improving." },
        { label: "Admit", text: "Oxygen requirement, feeding less than half to two-thirds of normal, dehydration, age under 3 months with significant symptoms, comorbidity." },
        { label: "Discharge", text: "SpO2 at or above target in air, feeding adequately, carers know when to return (day 3–5 is worst)." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Giving salbutamol and steroids." },
        { text: "Discharging on day 2 without warning that days 3–5 are worst." },
        { text: "Missing apnoea in a young infant." },
      ],
    },
  ],
};