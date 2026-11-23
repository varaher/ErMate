import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Adrenal crisis (adult). v0.1, 23 Nov 2026. Endocrine Society 2016; ESE/ES glucocorticoid-induced AI guideline 2024.
export const ADRENAL_CRISIS_ADULT: ProtocolTopic = {
  id: "adrenal-crisis-adult",
  title: "Adrenal crisis",
  summary:
    "Life-threatening cortisol deficiency — hypotension, vomiting, collapse. Give hydrocortisone immediately; never wait for test results.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — endocrine pathway v0.1 (Endocrine Society 2016, ESE/ES 2024)",
  keywords: ["adrenal crisis", "addisonian crisis", "adrenal insufficiency", "addison", "hydrocortisone", "steroid dependent", "refractory hypotension", "long term steroids"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Suspect in anyone on long-term steroids (including high-dose inhaled, topical, or traditional remedies containing steroids) or with known adrenal insufficiency who is unwell.",
    "Hydrocortisone 100 mg IV or IM immediately.",
    "0.9% saline 1 litre over the first hour, then by response.",
    "Check and treat glucose.",
    "Take a cortisol (and ACTH) sample before hydrocortisone if it does not delay treatment.",
  ],
  references: [
    "Bornstein SR et al. Diagnosis and treatment of primary adrenal insufficiency: Endocrine Society guideline. J Clin Endocrinol Metab. 2016",
    "Beuschlein F et al. ESE/Endocrine Society guideline on glucocorticoid-induced adrenal insufficiency. Eur J Endocrinol. 2024",
    "Rushworth RL et al. Adrenal crisis. N Engl J Med. 2019",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Hypotension or shock not responding to fluids, vomiting, abdominal pain, weakness, confusion, fever." },
        { text: "Hyperpigmentation (primary), low sodium, high potassium (primary), hypoglycaemia." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Cortisol maintains vascular tone and responds to stress; without it, a minor illness can cause shock." },
        { text: "Commonest cause in the ED: abrupt stopping of long-term steroids or failing to increase the dose during illness." },
        { text: "Primary (Addison's, TB in India) also lacks aldosterone → high potassium and salt loss." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Treat first", text: "Hydrocortisone on suspicion — it is safe; delay kills.", critical: true },
        { label: "Find the trigger", text: "Infection, vomiting illness, surgery, missed doses." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Septic shock", text: "Often coexists", link: "sepsis-adult" },
        { label: "Hypovolaemia (gastroenteritis)", text: "Responds to fluids" },
        { label: "Hyperkalaemia from other causes", text: "Renal failure", link: "hyperkalaemia-adult" },
        { label: "Hyponatraemia (SIADH)", text: "Normal BP", link: "hyponatraemia-adult" },
        { label: "Undifferentiated shock", text: "Use the shock pathway", link: "shock-undifferentiated-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Random cortisol and ACTH (before hydrocortisone if no delay), sodium, potassium, glucose, renal function, CBC, cultures." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Hydrocortisone", text: "100 mg IV / IM bolus, then 200 mg over 24 hours (continuous infusion or 50 mg every 6 hours), tapering as the patient recovers.", critical: true },
        { label: "Fluids", text: "0.9% saline 1 L in the first hour, then guided by volume status; dextrose if hypoglycaemic." },
        { label: "Trigger", text: "Treat infection; antiemetics." },
        { label: "Fludrocortisone", text: "Not needed while hydrocortisone is 50 mg/day or more." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Admit", text: "All adrenal crises; HDU if shocked." },
        { label: "Before discharge", text: "Sick-day rules (double oral dose when ill; injection if vomiting), steroid card, emergency injection kit." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for the cortisol result." },
        { text: "Missing steroid dependence from traditional or over-the-counter remedies." },
        { text: "Using dexamethasone alone in primary adrenal insufficiency (no mineralocorticoid effect)." },
      ],
    },
  ],
};