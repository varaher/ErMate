import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Acute asthma in children (under 16). v0.1, 23 Nov 2026. GINA 2025; BTS/SIGN/NICE 2024.
export const ASTHMA_PAEDS: ProtocolTopic = {
  id: "asthma-paeds",
  title: "Acute asthma — child",
  summary:
    "Wheeze and breathlessness from bronchospasm in a child over 2. Assess severity, give salbutamol early and repeatedly, oral steroid within the hour, and escalate fast in life-threatening asthma.",
  population: "paediatric",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — paediatric pathway v0.1 (GINA 2025)",
  keywords: ["asthma child", "paediatric asthma", "pediatric asthma", "wheeze", "bronchospasm", "salbutamol", "nebulisation", "magnesium", "status asthmaticus"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Assess severity: speech, SpO2, work of breathing, heart rate, mental state; silent chest = life-threatening.",
    "Oxygen to SpO2 94–98%.",
    "Salbutamol: spacer 2–10 puffs (moderate) or nebulised 2.5 mg (under 5) / 5 mg (5 and over); repeat every 20 minutes for the first hour, back-to-back if severe.",
    "Add ipratropium 250 micrograms nebulised every 20 minutes for 3 doses in severe attacks.",
    "Oral prednisolone 1–2 mg/kg (maximum 40 mg) within the first hour.",
  ],
  references: [
    "Global Initiative for Asthma. Global Strategy for Asthma Management and Prevention. 2025 update",
    "BTS/NICE/SIGN. Asthma: diagnosis, monitoring and chronic asthma management. 2024",
    "Griffiths B, Kew KM. Intravenous magnesium sulfate for treating children with acute asthma. Cochrane Database Syst Rev. 2016",
  ],
  sections: [
    {
      heading: "Severity",
      kind: "symptoms",
      items: [
        { label: "Moderate", text: "Talks in phrases, SpO2 92% or more, some recession." },
        { label: "Severe", text: "Cannot complete sentences or feed, SpO2 below 92%, marked recession, heart rate above 140 (2–5 yrs) or 125 (over 5), RR above 40 (2–5 yrs) or 30 (over 5).", critical: true },
        { label: "Life-threatening", text: "Silent chest, cyanosis, poor effort, exhaustion, confusion, hypotension, SpO2 below 92% despite oxygen.", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Airway inflammation, bronchospasm and mucus plugging cause air trapping; a rising or normal CO2 in a tiring child means respiratory failure." },
        { text: "Triggers: viral infection (most common), allergens, smoke, cold air, missed preventer." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Under 2 years", text: "Wheeze is more often bronchiolitis or viral wheeze.", link: "bronchiolitis-paeds" },
        { label: "Reassess", text: "After each salbutamol round — severity guides the next step." },
        { label: "No improvement", text: "IV magnesium, then IV salbutamol or aminophylline with PICU; prepare for intubation by the most experienced operator.", critical: true },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Bronchiolitis", text: "Under 1, first episode, crackles", link: "bronchiolitis-paeds" },
        { label: "Foreign body", text: "Sudden onset, unilateral wheeze" },
        { label: "Pneumonia", text: "Fever, focal signs" },
        { label: "Anaphylaxis", text: "Exposure, urticaria, stridor" },
        { label: "Pneumothorax", text: "Sudden worsening, unequal air entry" },
        { label: "Heart failure (infant)", text: "Hepatomegaly, murmur" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Usually none", text: "Asthma is a clinical diagnosis." },
        { label: "Severe / life-threatening", text: "VBG (normal or rising CO2 is a danger sign), potassium (falls with salbutamol), chest X-ray if pneumothorax, consolidation or no response." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Salbutamol", text: "Spacer up to 10 puffs, or nebulised 2.5–5 mg; every 20 minutes in the first hour, then by response.", critical: true },
        { label: "Ipratropium", text: "250 micrograms nebulised every 20 minutes for the first hour in severe attacks." },
        { label: "Steroid", text: "Prednisolone 1–2 mg/kg orally (maximum 40 mg) for 3–5 days; IV hydrocortisone 4 mg/kg or dexamethasone if vomiting." },
        { label: "Magnesium", text: "IV magnesium sulphate 40–50 mg/kg (maximum 2 g) over 20 minutes for severe asthma not responding to first-line treatment.", critical: true },
        { label: "Refractory", text: "IV salbutamol (bolus 15 micrograms/kg, then infusion 1–2 micrograms/kg/minute) or aminophylline in PICU; monitor potassium and lactate." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "PICU", text: "Life-threatening asthma, IV bronchodilator infusions, rising CO2." },
        { label: "Admit", text: "Severe, or still needing salbutamol more than every 2–4 hours." },
        { label: "Discharge", text: "Stable on 3–4 hourly salbutamol, SpO2 94% or more, inhaler technique checked, written action plan, steroid course, follow-up in 48 hours." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Reassurance from a quiet chest — it may be silent." },
        { text: "Under-dosing salbutamol or giving it too infrequently." },
        { text: "Sedating an agitated hypoxic child." },
      ],
    },
  ],
};